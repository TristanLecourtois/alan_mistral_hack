"""
Fertility Copilot — Backend
POST /ocr  → upload a medical document → Mistral OCR → parsed medical values
"""
import os
import base64
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from mistralai.client import Mistral

from logger import get_logger, log_separator, log_value, BOLD, GREEN, YELLOW, RED, RESET, DIM
from parser import parse_ocr_result

load_dotenv()
log = get_logger("api")

# ── Mistral client (lazy init) ─────────────────────────────────────────────
_mistral: Mistral | None = None

def get_mistral() -> Mistral:
    global _mistral
    if _mistral is None:
        api_key = os.getenv("MISTRAL_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="MISTRAL_API_KEY manquante — copie .env.example en .env et remplis ta clé"
            )
        _mistral = Mistral(api_key=api_key)
        log.info(f"Client Mistral initialisé ✓")
    return _mistral


# ── FastAPI app ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    log_separator("FERTILITY COPILOT BACKEND")
    log.info("Serveur démarré — en attente de documents...")
    log.info(f"API key présente : {'✓' if os.getenv('MISTRAL_API_KEY') else '✗  (manquante !)'}")
    yield
    log.info("Serveur arrêté.")

app = FastAPI(title="Fertility Copilot API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # restreindre en prod
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ──────────────────────────────────────────────────────────────────
ALLOWED_MIME = {
    "application/pdf",
    "image/jpeg", "image/jpg", "image/png",
    "image/avif", "image/webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # docx
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # pptx
}

def _mime_to_type(mime: str) -> str:
    """Map MIME type → Mistral document type field."""
    if mime == "application/pdf":
        return "document_url"
    if mime.startswith("image/"):
        return "image_url"
    return "document_url"


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "api_key_set": bool(os.getenv("MISTRAL_API_KEY"))}


@app.post("/ocr")
async def ocr_document(file: UploadFile = File(...)):
    log_separator(f"NOUVEAU DOCUMENT  —  {file.filename}")

    # ── 1. Validation ──────────────────────────────────────────────────────
    log.info(f"Fichier reçu       : {file.filename}")
    log.info(f"Type MIME          : {file.content_type}")
    log.info(f"Taille             : en cours de lecture…")

    if file.content_type not in ALLOWED_MIME:
        log.warning(f"Type non supporté : {file.content_type}")
        raise HTTPException(
            status_code=400,
            detail=f"Format non supporté: {file.content_type}. Acceptés: PDF, JPG, PNG, AVIF, DOCX, PPTX"
        )

    raw_bytes = await file.read()
    size_kb = len(raw_bytes) / 1024
    log.info(f"Taille             : {size_kb:.1f} KB")

    # ── 2. Encodage base64 ────────────────────────────────────────────────
    log.info("Encodage base64…")
    b64 = base64.standard_b64encode(raw_bytes).decode("utf-8")
    doc_type = _mime_to_type(file.content_type)

    if doc_type == "image_url":
        document = {
            "type": "image_url",
            "image_url": f"data:{file.content_type};base64,{b64}"
        }
    else:
        document = {
            "type": "document_url",
            "document_url": f"data:{file.content_type};base64,{b64}"
        }

    log.info(f"Type Mistral       : {doc_type}")

    # ── 3. Appel Mistral OCR ──────────────────────────────────────────────
    log_separator("APPEL MISTRAL OCR")
    log.info("Envoi vers mistral-ocr-latest…")
    t0 = time.time()

    try:
        client = get_mistral()
        ocr_response = client.ocr.process(
            model="mistral-ocr-latest",
            document=document,
            include_image_base64=False,
        )
    except Exception as e:
        log.error(f"Erreur Mistral OCR : {e}")
        raise HTTPException(status_code=502, detail=f"Erreur Mistral: {str(e)}")

    elapsed = time.time() - t0
    log.info(f"OCR terminé en     : {elapsed:.2f}s")
    log.info(f"Modèle utilisé     : {ocr_response.model}")
    log.info(f"Pages traitées     : {len(ocr_response.pages)}")

    # ── 4. Affichage du markdown brut (logs) ──────────────────────────────
    log_separator("MARKDOWN BRUT (OCR)")
    for i, page in enumerate(ocr_response.pages):
        print(f"\n{DIM}── Page {i+1} ──────────────────────────────────────────{RESET}")
        # Affiche les 500 premiers caractères pour ne pas spammer les logs
        preview = page.markdown[:500]
        print(f"{DIM}{preview}{'…' if len(page.markdown) > 500 else ''}{RESET}")

    # ── 5. Parsing des valeurs médicales ──────────────────────────────────
    parse_result = parse_ocr_result(ocr_response)

    # ── 6. Résumé final ───────────────────────────────────────────────────
    log_separator("RÉSUMÉ")
    alerts = [v for v in parse_result.values if v.status == "alert"]
    warns  = [v for v in parse_result.values if v.status == "warn"]
    oks    = [v for v in parse_result.values if v.status == "ok"]
    log.info(f"Type de document   : {parse_result.doc_type}")
    log.info(f"Valeurs OK         : {GREEN}{len(oks)}{RESET}")
    log.info(f"Valeurs à surveiller: {YELLOW}{len(warns)}{RESET}")
    log.info(f"Alertes            : {RED}{len(alerts)}{RESET}")
    log.info(f"Durée totale       : {time.time() - t0:.2f}s")

    # ── 7. Réponse JSON ───────────────────────────────────────────────────
    return {
        "filename": file.filename,
        "doc_type": parse_result.doc_type,
        "page_count": parse_result.page_count,
        "raw_markdown": parse_result.raw_markdown,
        "values": [
            {
                "key": v.key,
                "label": v.label,
                "value": v.value,
                "unit": v.unit,
                "status": v.status,       # "ok" | "warn" | "alert"
                "reference": v.reference,
                "raw": v.raw_match,
            }
            for v in parse_result.values
        ],
        "summary": {
            "ok_count":    len(oks),
            "warn_count":  len(warns),
            "alert_count": len(alerts),
        },
        "processing_time_s": round(time.time() - t0, 2),
    }
