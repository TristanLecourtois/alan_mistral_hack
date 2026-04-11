"""
Fertility Copilot — Backend
POST /ocr        → upload medical document → Mistral OCR → parsed values
POST /chat       → copilot multi-turn chat with document context
POST /questions  → generate appointment questions from analysis result
"""
import os
import base64
import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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
            raise HTTPException(status_code=500, detail="MISTRAL_API_KEY manquante dans .env")
        _mistral = Mistral(api_key=api_key)
        log.info("Client Mistral initialisé ✓")
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
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic models ───────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str    # "user" | "assistant"
    content: str

class Biomarker(BaseModel):
    name: str
    value: str
    unit: str
    norm: str
    status: str  # "ok" | "warn" | "alert"

class AnalysisContext(BaseModel):
    documentType: Optional[str] = None
    biomarkers: Optional[list[Biomarker]] = None
    globalScore: Optional[int] = None
    copilotSummary: Optional[str] = None

class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    analysis_context: Optional[AnalysisContext] = None
    onboarding_answers: Optional[list[str]] = None

class QuestionsRequest(BaseModel):
    analysis_result: AnalysisContext
    onboarding_answers: Optional[list[str]] = None


# ── System prompt builder ─────────────────────────────────────────────────────
def build_system_prompt(context: Optional[AnalysisContext], onboarding: list[str]) -> str:
    base = """You are Fertility Copilot, a warm and empathetic AI health companion specialized in reproductive medicine and fertility.
Your role is to help patients understand their medical results, feel less anxious, and prepare for their specialist appointments.

Core principles:
- Be warm, reassuring, and honest — never alarmist
- Never make definitive diagnoses or recommend specific treatments
- Always encourage consulting a specialist for important decisions
- Reference the patient's specific values when relevant
- Use plain language, avoid excessive jargon
- Keep answers concise (3-5 sentences) unless the patient asks for detail
- End responses with an actionable suggestion when helpful"""

    if context and context.biomarkers:
        abnormal = [b for b in context.biomarkers if b.status != "ok"]
        all_lines = "\n".join(
            f"  • {b.name}: {b.value} {b.unit} — {b.norm} [{b.status.upper()}]"
            for b in context.biomarkers
        )
        score_line = f"\nOverall fertility score: {context.globalScore}/100" if context.globalScore else ""
        abnormal_line = ""
        if abnormal:
            abnormal_line = f"\nPoints needing attention: {', '.join(b.name for b in abnormal)}"

        base += f"""

PATIENT'S ANALYSIS ({context.documentType or 'Medical Report'}):
{all_lines}{score_line}{abnormal_line}

When answering, refer to these specific values to give personalized, grounded responses."""

    if onboarding:
        base += f"\n\nPatient profile: {' | '.join(onboarding)}"

    return base


# ── Helpers ──────────────────────────────────────────────────────────────────
ALLOWED_MIME = {
    "application/pdf",
    "image/jpeg", "image/jpg", "image/png",
    "image/avif", "image/webp",
}

def _mime_to_type(mime: str) -> str:
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
    log.info(f"Fichier reçu       : {file.filename}")
    log.info(f"Type MIME          : {file.content_type}")

    if file.content_type not in ALLOWED_MIME:
        log.warning(f"Type non supporté : {file.content_type}")
        raise HTTPException(status_code=400, detail=f"Format non supporté: {file.content_type}")

    raw_bytes = await file.read()
    size_kb = len(raw_bytes) / 1024
    log.info(f"Taille             : {size_kb:.1f} KB")

    b64 = base64.standard_b64encode(raw_bytes).decode("utf-8")
    doc_type = _mime_to_type(file.content_type)

    if doc_type == "image_url":
        document = {"type": "image_url",    "image_url":    f"data:{file.content_type};base64,{b64}"}
    else:
        document = {"type": "document_url", "document_url": f"data:{file.content_type};base64,{b64}"}

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
    log.info(f"Pages traitées     : {len(ocr_response.pages)}")

    log_separator("MARKDOWN BRUT (OCR)")
    for i, page in enumerate(ocr_response.pages):
        print(f"\n{DIM}── Page {i+1} ──────────────────────────────────{RESET}")
        print(f"{DIM}{page.markdown[:500]}{'…' if len(page.markdown) > 500 else ''}{RESET}")

    parse_result = parse_ocr_result(ocr_response)

    log_separator("RÉSUMÉ")
    alerts = [v for v in parse_result.values if v.status == "alert"]
    warns  = [v for v in parse_result.values if v.status == "warn"]
    oks    = [v for v in parse_result.values if v.status == "ok"]
    log.info(f"Type               : {parse_result.doc_type}")
    log.info(f"OK                 : {GREEN}{len(oks)}{RESET}")
    log.info(f"Warn               : {YELLOW}{len(warns)}{RESET}")
    log.info(f"Alert              : {RED}{len(alerts)}{RESET}")
    log.info(f"Durée totale       : {time.time() - t0:.2f}s")

    return {
        "filename": file.filename,
        "doc_type": parse_result.doc_type,
        "page_count": parse_result.page_count,
        "raw_markdown": parse_result.raw_markdown,
        "values": [
            {
                "key":       v.key,
                "label":     v.label,
                "value":     v.value,
                "unit":      v.unit,
                "status":    v.status,
                "reference": v.reference,
                "raw":       v.raw_match,
            }
            for v in parse_result.values
        ],
        "summary": {"ok_count": len(oks), "warn_count": len(warns), "alert_count": len(alerts)},
        "processing_time_s": round(time.time() - t0, 2),
    }


@app.post("/chat")
async def chat(req: ChatRequest):
    log_separator("COPILOT CHAT")
    log.info(f"Messages           : {len(req.messages)}")
    log.info(f"Contexte document  : {'✓' if req.analysis_context else '✗'}")

    system_prompt = build_system_prompt(req.analysis_context, req.onboarding_answers or [])

    messages = [{"role": "system", "content": system_prompt}]
    for m in req.messages:
        messages.append({"role": m.role, "content": m.content})

    last_user = next((m.content for m in reversed(req.messages) if m.role == "user"), "")
    log.info(f"Question           : {last_user[:80]}{'…' if len(last_user) > 80 else ''}")

    t0 = time.time()
    try:
        client = get_mistral()
        response = client.chat.complete(
            model="mistral-small-latest",
            messages=messages,
            temperature=0.5,
            max_tokens=400,
        )
    except Exception as e:
        log.error(f"Erreur chat : {e}")
        raise HTTPException(status_code=502, detail=f"Erreur Mistral: {str(e)}")

    reply = response.choices[0].message.content
    log.info(f"Réponse ({time.time()-t0:.2f}s) : {reply[:80]}…")

    return {"reply": reply}


@app.post("/questions")
async def generate_questions(req: QuestionsRequest):
    log_separator("GÉNÉRATION QUESTIONS RDV")

    context = req.analysis_result
    abnormal = [b for b in (context.biomarkers or []) if b.status != "ok"]
    abnormal_text = "\n".join(
        f"- {b.name}: {b.value} {b.unit} ({b.status}, {b.norm})"
        for b in abnormal
    ) or "All parameters within normal range."

    profile = f"\nPatient profile: {' | '.join(req.onboarding_answers)}" if req.onboarding_answers else ""

    prompt = f"""You are a fertility specialist helping a patient prepare questions for their medical appointment.

Document analyzed: {context.documentType or 'Fertility Report'}
Abnormal/borderline results:
{abnormal_text}{profile}

Generate personalized appointment questions. Return a JSON object with this exact structure:
{{
  "priority": [
    {{"text": "specific question based on the abnormal result", "badge": "Based on your result"}}
  ],
  "general": [
    {{"text": "general fertility question"}}
  ]
}}

Rules:
- 2-3 priority questions directly referencing the abnormal values
- 3-4 general questions about next steps, lifestyle, and treatment options
- Questions must be concrete and help the patient have a productive consultation
- Write from the patient's perspective (use "I", "my")
- Return only valid JSON"""

    log.info(f"Document           : {context.documentType}")
    log.info(f"Valeurs anormales  : {len(abnormal)}")

    t0 = time.time()
    try:
        client = get_mistral()
        response = client.chat.complete(
            model="mistral-small-latest",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=600,
            response_format={"type": "json_object"},
        )
    except Exception as e:
        log.error(f"Erreur questions : {e}")
        raise HTTPException(status_code=502, detail=f"Erreur Mistral: {str(e)}")

    import json
    raw = response.choices[0].message.content
    log.info(f"Questions générées en {time.time()-t0:.2f}s")

    try:
        parsed = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=500, detail="Invalid JSON from model")

    return {
        "priority": [{"checked": True,  **q} for q in parsed.get("priority", [])],
        "general":  [{"checked": False, **q} for q in parsed.get("general",  [])],
    }