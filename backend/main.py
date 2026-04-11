"""
Fertility Copilot — Backend
POST /ocr              → upload medical document → Mistral OCR → parsed values
POST /chat             → copilot multi-turn chat with document context
POST /questions        → generate appointment questions from analysis result
POST /thryve/metrics   → fetch & aggregate wearable metrics from Thryve API
"""
import os
import base64
import time
import httpx
from contextlib import asynccontextmanager
from datetime import date, timedelta
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


# ── Thryve wearable integration ───────────────────────────────────────────────

THRYVE_BASE_URL = os.getenv("THRYVE_BASE_URL", "https://api-qa.thryve.de")

# Demo profiles from hackathon (authentication tokens keyed by device slug)
THRYVE_PROFILES = {
    "apple_watch":  "1e2e53da12e0a9aebb3750af3c5857e1",  # work_from_home_apple
    "oura":         "7f82fc3b0abba3a86b5e15c911fc5f6e",  # student_samsung_oura_withings_huawei
    "garmin":       "eb634efc4ac80c9ed6a355c8a99adb83",  # active_tennis_garmin
    "whoop":        "2bfaa7e6f9455ceafa0a59fd5b80496c",  # active_gym_whoop
    "withings":     "a463e0bf26d790d6afdfda0cfd161cf5",  # it_manager_withings
}

MINUTES_TO_HOURS = {"SleepDuration", "SleepLatency", "ActiveDuration", "ActivityDuration"}

RELEVANT = {
    "SleepDuration", "SleepEfficiency", "SleepQuality", "SleepRegularity",
    "SleepLatency", "SleepInterruptions",
    "HeartRate", "HeartRateResting", "HeartRateSleepLowest",
    "Steps", "ActiveDuration", "ActivityIntensity",
    "ActiveBurnedCalories", "BurnedCalories", "SPO2",
}

class ThryveRequest(BaseModel):
    device_id: str          # one of THRYVE_PROFILES keys
    days: Optional[int] = 7

def _thryve_headers() -> dict:
    auth     = os.getenv("THRYVE_AUTHORIZATION")
    app_auth = os.getenv("THRYVE_APP_AUTHORIZATION")
    if not auth and os.getenv("THRYVE_USERNAME") and os.getenv("THRYVE_PASSWORD"):
        token = base64.b64encode(f"{os.environ['THRYVE_USERNAME']}:{os.environ['THRYVE_PASSWORD']}".encode()).decode()
        auth = f"Basic {token}"
    if not app_auth and os.getenv("THRYVE_AUTH_ID") and os.getenv("THRYVE_AUTH_SECRET"):
        token = base64.b64encode(f"{os.environ['THRYVE_AUTH_ID']}:{os.environ['THRYVE_AUTH_SECRET']}".encode()).decode()
        app_auth = f"Basic {token}"
    if not auth or not app_auth:
        raise HTTPException(status_code=503, detail="Thryve credentials not configured in .env")
    return {"Authorization": auth, "AppAuthorization": app_auth}

def _process_thryve_data(raw_users: list, user_lat: float | None, days: int) -> dict:
    """Flatten daily values → latest-day snapshot + 7-day trends."""
    from collections import defaultdict
    series: dict[str, list[float]] = defaultdict(list)
    latest: dict[str, float] = {}

    for user in raw_users:
        for source in (user.get("dataSources") or []):
            for item in (source.get("data") or []):
                name = item.get("dailyDynamicValueTypeName") or ""
                if name not in RELEVANT:
                    continue
                try:
                    val = float(item["value"])
                except (KeyError, TypeError, ValueError):
                    continue
                if name in MINUTES_TO_HOURS:
                    val = round(val / 60, 2)
                series[name].append(val)
                day = item.get("day", "")
                if not latest.get(name) or day >= (item.get("day", "")):
                    latest[name] = val

    def avg(lst):
        return round(sum(lst) / len(lst), 1) if lst else None

    def trend(lst):
        if len(lst) < 2:
            return "stable"
        recent = sum(lst[-3:]) / len(lst[-3:])
        older  = sum(lst[:-3]) / max(len(lst[:-3]), 1)
        diff   = recent - older
        if abs(diff) < older * 0.05:
            return "stable"
        return f"+{diff:+.1f}" if diff > 0 else f"{diff:.1f}"

    return {
        "sleep": {
            "duration_h":  latest.get("SleepDuration") or avg(series["SleepDuration"]),
            "efficiency":  latest.get("SleepEfficiency") or avg(series["SleepEfficiency"]),
            "quality":     latest.get("SleepQuality") or avg(series["SleepQuality"]),
            "latency_h":   latest.get("SleepLatency") or avg(series["SleepLatency"]),
            "trend":       trend(series["SleepDuration"]),
        },
        "heart": {
            "resting":      latest.get("HeartRateResting") or avg(series["HeartRateResting"]),
            "average":      latest.get("HeartRate") or avg(series["HeartRate"]),
            "sleep_lowest": latest.get("HeartRateSleepLowest") or avg(series["HeartRateSleepLowest"]),
            "trend":        trend(series["HeartRateResting"]),
        },
        "activity": {
            "steps":         latest.get("Steps") or avg(series["Steps"]),
            "active_h":      latest.get("ActiveDuration") or avg(series["ActiveDuration"]),
            "intensity":     latest.get("ActivityIntensity") or avg(series["ActivityIntensity"]),
            "calories":      latest.get("ActiveBurnedCalories") or avg(series["ActiveBurnedCalories"]),
            "trend":         trend(series["Steps"]),
        },
        "spo2":        latest.get("SPO2") or avg(series["SPO2"]),
        "days_fetched": len(series.get("Steps", series.get("SleepDuration", []))),
        "last_updated": date.today().isoformat(),
    }


@app.post("/thryve/metrics")
async def thryve_metrics(req: ThryveRequest):
    log_separator(f"THRYVE  —  {req.device_id}")

    auth_token = THRYVE_PROFILES.get(req.device_id)
    if not auth_token:
        raise HTTPException(status_code=400, detail=f"Unknown device_id: {req.device_id}")

    headers = _thryve_headers()
    end_day   = date.today()
    start_day = end_day - timedelta(days=req.days - 1)
    payload   = {
        "authenticationToken": auth_token,
        "startDay": start_day.isoformat(),
        "endDay":   end_day.isoformat(),
        "detailed": "true",
        "displayTypeName": "true",
        "displayPartnerUserID": "true",
    }

    log.info(f"Token  : {auth_token[:8]}…")
    log.info(f"Period : {start_day} → {end_day}")
    t0 = time.time()

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(f"{THRYVE_BASE_URL}/v5/dailyDynamicValues", data=payload, headers=headers)
    except Exception as e:
        log.error(f"Thryve HTTP error: {e}")
        raise HTTPException(status_code=502, detail=f"Thryve unreachable: {e}")

    if resp.status_code != 200:
        log.error(f"Thryve {resp.status_code}: {resp.text[:200]}")
        raise HTTPException(status_code=resp.status_code, detail=f"Thryve error: {resp.text[:200]}")

    raw = resp.json()
    users = raw if isinstance(raw, list) else [raw]
    # flatten nested list-of-chunks format
    if users and isinstance(users[0], list):
        users = [u for chunk in users for u in chunk]

    result = _process_thryve_data(users, None, req.days)
    log.info(f"Thryve OK ({time.time()-t0:.2f}s) — sleep={result['sleep']['duration_h']}h steps={result['activity']['steps']}")
    return result