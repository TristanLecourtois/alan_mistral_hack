"""
Parse raw OCR markdown → structured medical values.
Covers: spermogram (EN + FR), hormonal panel (FSH, LH, AMH, E2, TSH),
        ovarian reserve, ultrasound basics.

Tested against:
  - YDS Laboratory format (EN, column layout)
  - Labsmart format (EN, column layout)
  - French lab formats
"""
import re
from dataclasses import dataclass, field
from typing import Optional
from logger import get_logger, log_value, log_separator, BOLD, RESET

log = get_logger("parser")

# ── WHO 2021 reference ranges ──────────────────────────────────────────────
# Source: WHO Laboratory Manual for the Examination and Processing of Human Semen, 6th ed.
REFERENCE_RANGES = {
    # Spermogram
    "volume":               {"min": 1.4,  "max": None, "unit": "mL",        "label": "Volume"},
    "concentration":        {"min": 16,   "max": None, "unit": "M/mL",      "label": "Concentration"},
    "motility_progressive": {"min": 32,   "max": None, "unit": "%",         "label": "Motilité progressive"},
    "motility_total":       {"min": 42,   "max": None, "unit": "%",         "label": "Motilité totale"},
    "motility_non":         {"min": None, "max": 20,   "unit": "%",         "label": "Non mobile"},
    "morphology_normal":    {"min": 4,    "max": None, "unit": "%",         "label": "Morphologie normale"},
    "morphology_abnormal":  {"min": None, "max": 96,   "unit": "%",         "label": "Morphologie anormale"},
    "vitality":             {"min": 54,   "max": None, "unit": "%",         "label": "Vitalité"},
    "ph":                   {"min": 7.2,  "max": 8.0,  "unit": "",          "label": "pH"},
    "pus_cells":            {"min": None, "max": 5,    "unit": "WBC/hpf",   "label": "Leucocytes (pus cells)"},
    "liquefaction":         {"min": None, "max": 60,   "unit": "min",       "label": "Liquéfaction"},
    # Hormones
    "amh":                  {"min": 1.0,  "max": 3.5,  "unit": "ng/mL",     "label": "AMH"},
    "fsh":                  {"min": 3.0,  "max": 10.0, "unit": "UI/L",      "label": "FSH"},
    "lh":                   {"min": 2.0,  "max": 15.0, "unit": "UI/L",      "label": "LH"},
    "e2":                   {"min": 20,   "max": 160,  "unit": "pg/mL",     "label": "Estradiol (E2)"},
    "tsh":                  {"min": 0.4,  "max": 4.0,  "unit": "mUI/L",     "label": "TSH"},
    "prolactin":            {"min": None, "max": 25,   "unit": "ng/mL",     "label": "Prolactine"},
    "testosterone":         {"min": 3.0,  "max": None, "unit": "ng/mL",     "label": "Testostérone"},
    # Ovarian reserve
    "antral_follicle_count":{"min": 7,    "max": None, "unit": "follicules", "label": "CFA"},
}

# ── Regex patterns ────────────────────────────────────────────────────────
# Each pattern captures group(1) = numeric value.
# Values like "10-15" (ranges) → we take the first number.
# Order matters: more specific patterns first.
PATTERNS = {
    # ── Volume / Quantity ──────────────────────────────────────────────────
    "volume": [
        r"volume\s*\([^|]*\)\s*\|\s*([\d,.]+)",        # table: | Volume (mL) | 2.5 |
        r"volume\s*\(ml\)\s+([\d,.]+)",
        r"quantity\s+([\d,.]+)\s*ml",
        r"volume\s*[:\-=]?\s*([\d,.]+)\s*m[lL]",
    ],
    # ── Concentration / Sperm count ───────────────────────────────────────
    "concentration": [
        r"sperm\s+count\s*\|\s*([\d,.]+)",             # table: | Sperm Count | 42 |
        r"concentr[a-z]*\s*\|\s*([\d,.]+)",            # table: | Concentration | 42 |
        r"total\s+sperm\s+count\s+([\d,.]+)",
        r"sperm\s+count\s+([\d,.]+)",
        r"concentr[a-z]*\s*[:\-=]?\s*([\d,.]+)",
    ],
    # ── Motility ──────────────────────────────────────────────────────────
    "motility_progressive": [
        r"rapid\s+progressive\s+motility\s*\|\s*([\d,.]+)",   # table YDS
        r"active\s+motility\s*\|\s*([\d,.]+)",                # table
        r"(?:rapid|active)\s+(?:progressive\s+)?motility\s+([\d,.]+)",
        r"active\s+motility\s+([\d,.]+)",
        r"mobi?lit[eé]\s*progr[a-z]*\s*[:\-=]?\s*([\d,.]+)",
        r"rapid\s+progressive\s+([\d,.]+)",
    ],
    "motility_total": [
        r"total\s+motility\s*\|\s*([\d,.]+)",          # table
        r"total\s+motility\s+([\d,.]+)",
        r"mobi?lit[eé]\s*tot[a-z]*\s*[:\-=]?\s*([\d,.]+)",
    ],
    "motility_non": [
        r"non\s+motile\s*\|\s*([\d,.]+)",              # table
        r"non\s+motile\s+([\d,.]+)",
        r"immotile\s+([\d,.]+)",
        r"non[\s-]*mobile\s*[:\-=]?\s*([\d,.]+)",
    ],
    # ── Morphology ────────────────────────────────────────────────────────
    "morphology_normal": [
        r"normal\s+morphology\s*\|\s*([\d,.]+)",       # table
        r"normal\s+morphology\s+([\d,.]+)",
        r"morpholog[a-z]*\s+normal[a-z]*\s*[:\-=]?\s*([\d,.]+)",
    ],
    "morphology_abnormal": [
        r"abnormal\s+(?:morphology|forms)\s*\|\s*([\d,.]+)",  # table
        r"abnormal\s+(?:morphology|forms)\s+([\d,.]+)",
        r"morpholog[a-z]*\s+anormal[a-z]*\s*[:\-=]?\s*([\d,.]+)",
    ],
    # ── Vitality ──────────────────────────────────────────────────────────
    "vitality": [
        r"vital[a-z]*\s*\|\s*([\d,.]+)",               # table
        r"vital[a-z]*\s*[:\-=]?\s*([\d,.]+)",
    ],
    # ── pH ────────────────────────────────────────────────────────────────
    "ph": [
        r"reaction\s*\(ph\)\s*\|\s*([\d,.]+)",         # table: | Reaction (pH) | 7.6 |
        r"reaction\s*\(ph\)\s+([\d,.]+)",
        r"\bph\b\s*[:\-=]?\s*([\d,.]+)",
    ],
    # ── Pus cells (can be range like "10-15") ─────────────────────────────
    "pus_cells": [
        r"pus\s+cell[s]?\s*\|\s*([\d]+)",              # table
        r"pus\s+cell[s]?\s+([\d]+)",
        r"leucocyte[s]?\s*[:\-=]?\s*([\d]+)",
    ],
    # ── Liquefaction ──────────────────────────────────────────────────────
    "liquefaction": [
        r"liquefaction\s+time\s*\|\s*([\d,.]+)",       # table
        r"liquefaction\s+time\s+([\d,.]+)",
        r"liquéfaction\s*[:\-=]?\s*([\d,.]+)",
    ],
    # ── Hormones ──────────────────────────────────────────────────────────
    "amh": [
        r"\bamh\b\s*\|\s*([\d,.]+)",                   # table
        r"\bamh\b\s*[:\-=]?\s*([\d,.]+)",
    ],
    "fsh": [
        r"\bfsh\b\s*\|\s*([\d,.]+)",                   # table
        r"\bfsh\b\s*[:\-=]?\s*([\d,.]+)",
    ],
    "lh": [
        r"\blh\b\s*\|\s*([\d,.]+)",                    # table
        r"\blh\b\s*[:\-=]?\s*([\d,.]+)",
    ],
    "e2": [
        r"(?:e2|estradiol|œstradiol)\s*\|\s*([\d,.]+)",   # table
        r"(?:e2|estradiol|œstradiol)\s*[:\-=]?\s*([\d,.]+)",
    ],
    "tsh": [
        r"\btsh\b\s*\|\s*([\d,.]+)",                   # table
        r"\btsh\b\s*[:\-=]?\s*([\d,.]+)",
    ],
    "prolactin": [
        r"prolactin[e]?\s*\|\s*([\d,.]+)",             # table
        r"prolactin[e]?\s*[:\-=]?\s*([\d,.]+)",
    ],
    "testosterone": [
        r"testostérone?\s*\|\s*([\d,.]+)",             # table
        r"testostérone?\s*[:\-=]?\s*([\d,.]+)",
    ],
    # ── Ovarian reserve ───────────────────────────────────────────────────
    "antral_follicle_count": [
        r"(?:cfa|antral\s*follicle\s*count|compte\s*follicul[a-z]*)\s*\|\s*(\d+)",  # table
        r"(?:cfa|antral\s*follicle\s*count|compte\s*follicul[a-z]*)\s*[:\-=]?\s*(\d+)",
    ],
}


# ── Data classes ──────────────────────────────────────────────────────────
@dataclass
class MedicalValue:
    key: str
    label: str
    value: float
    unit: str
    status: str        # "ok" | "warn" | "alert"
    reference: str
    raw_match: str


@dataclass
class ParseResult:
    values: list[MedicalValue] = field(default_factory=list)
    raw_markdown: str = ""
    page_count: int = 0
    doc_type: str = "unknown"


# ── Helpers ───────────────────────────────────────────────────────────────
def _to_float(s: str) -> Optional[float]:
    try:
        return float(s.replace(",", "."))
    except (ValueError, AttributeError):
        return None


def _get_status(key: str, value: float) -> str:
    ref = REFERENCE_RANGES.get(key)
    if not ref:
        return "ok"
    too_low  = ref["min"] is not None and value < ref["min"]
    too_high = ref["max"] is not None and value > ref["max"]
    if not (too_low or too_high):
        return "ok"
    # Severity: > 30% off → alert, otherwise warn
    if too_low and ref["min"]:
        ratio = value / ref["min"]
        return "alert" if ratio < 0.7 else "warn"
    if too_high and ref["max"]:
        ratio = value / ref["max"]
        return "alert" if ratio > 1.3 else "warn"
    return "warn"


def _ref_string(key: str) -> str:
    ref = REFERENCE_RANGES.get(key, {})
    parts = []
    if ref.get("min") is not None:
        parts.append(f"≥ {ref['min']}")
    if ref.get("max") is not None:
        parts.append(f"≤ {ref['max']}")
    unit = ref.get("unit", "")
    return f"{' et '.join(parts)} {unit}".strip() if parts else "—"


def _detect_doc_type(text: str) -> str:
    t = text.lower()
    types = []
    if any(k in t for k in ["sperm", "semen", "sperme", "motility", "motilité"]):
        types.append("spermogram")
    if any(k in t for k in ["amh", "fsh", "lh", "estradiol", "tsh", "prolactin"]):
        types.append("hormonal_panel")
    if any(k in t for k in ["follicle", "follicule", "endometri", "ovary", "ovaire", "uterus", "utérus"]):
        types.append("ultrasound")
    return " + ".join(types) if types else "unknown"


# ── Main parsing function ─────────────────────────────────────────────────
def parse_ocr_result(ocr_response) -> ParseResult:
    log_separator("PARSING OCR OUTPUT")

    pages = ocr_response.pages
    full_text = "\n\n".join(p.markdown for p in pages)
    page_count = len(pages)

    log.info(f"Pages            : {page_count}")
    log.info(f"Texte extrait    : {len(full_text)} caractères")

    doc_type = _detect_doc_type(full_text)
    log.info(f"Type détecté     : {BOLD}{doc_type}{RESET}")

    result = ParseResult(raw_markdown=full_text, page_count=page_count, doc_type=doc_type)

    log_separator("VALEURS EXTRAITES")

    text_lower = full_text.lower()
    found = []

    for key, patterns in PATTERNS.items():
        matched_val = None
        matched_raw = None

        for pattern in patterns:
            m = re.search(pattern, text_lower, re.IGNORECASE)
            if m:
                matched_val = _to_float(m.group(1))
                matched_raw = m.group(0)
                break   # first matching pattern wins

        if matched_val is None:
            continue

        ref = REFERENCE_RANGES.get(key, {})
        unit    = ref.get("unit", "")
        label   = ref.get("label", key)
        status  = _get_status(key, matched_val)
        ref_str = _ref_string(key)

        log_value(label, f"{matched_val} {unit}  (réf: {ref_str})", status)

        found.append(MedicalValue(
            key=key,
            label=label,
            value=matched_val,
            unit=unit,
            status=status,
            reference=ref_str,
            raw_match=matched_raw,
        ))

    # ── Calcul motilité totale si non trouvée directement ─────────────────
    keys_found = {v.key for v in found}
    if "motility_total" not in keys_found:
        prog  = next((v.value for v in found if v.key == "motility_progressive"), None)
        slugg_match = re.search(r"sluggish\s+progressive\s+([\d,.]+)", text_lower)
        slugg = _to_float(slugg_match.group(1)) if slugg_match else None

        if prog is not None and slugg is not None:
            total = prog + slugg
            ref   = REFERENCE_RANGES["motility_total"]
            status = _get_status("motility_total", total)
            log_value("Motilité totale (calculée)", f"{total} %  (réf: {_ref_string('motility_total')})", status)
            found.append(MedicalValue(
                key="motility_total",
                label="Motilité totale",
                value=total,
                unit="%",
                status=status,
                reference=_ref_string("motility_total"),
                raw_match=f"calculé: {prog} + {slugg}",
            ))

    result.values = found

    if not found:
        log.warning("Aucune valeur médicale reconnue — vérifiez le document")
    else:
        ok    = sum(1 for v in found if v.status == "ok")
        warn  = sum(1 for v in found if v.status == "warn")
        alert = sum(1 for v in found if v.status == "alert")
        log.info(f"\n  → {len(found)} valeur(s)  |  ✓ {ok}  ⚠ {warn}  ✗ {alert}")

    return result
