"""
Shared MediScribe schema, prompt, and evaluation helpers.
"""

from __future__ import annotations

import json
from copy import deepcopy
from typing import Any

DEFAULT_AUGMENTED_FILE = "augmented_data.json"
DEFAULT_TRAIN_FILE = "finetune_train.jsonl"
DEFAULT_VAL_FILE = "finetune_val.jsonl"
DEFAULT_STATS_FILE = "finetune_stats.json"
DEFAULT_MODEL_OUTPUT_FILE = "finetune_model.json"
DEFAULT_BENCHMARK_OUTPUT_FILE = "benchmark_results.json"

DISEASE_RISK_FIELDS = [
    "fluProbability",
    "migraineProbability",
    "fatigueProbability",
    "diabetesProbability",
    "hypertensionProbability",
]

MEDISCRIBE_SCHEMA = {
    "chiefComplaint": None,
    "hpi": None,
    "pastHistory": None,
    "medications": [],
    "allergies": None,
    "examFindings": None,
    "diagnosis": None,
    "plan": None,
    "followUpDays": None,
    "diseaseRisk": {
        "fluProbability": 0.0,
        "migraineProbability": 0.0,
        "fatigueProbability": 0.0,
        "diabetesProbability": 0.0,
        "hypertensionProbability": 0.0,
        "notes": None,
    },
    "hallucinationCheck": {
        "isHallucinated": False,
        "details": None,
        "confidenceScore": 1.0,
    },
}

CLINICAL_PERSONA = (
    "You are an expert Indian Clinical Informatics Specialist and medical scribe "
    "for Indian outpatient clinics. Extract or generate structured EMR data from "
    "doctor-patient consultation transcripts with strict clinical accuracy. "
    "Transcripts may contain Hindi, Marathi, Tamil, or mixed speech, but output "
    "must always remain concise professional English."
)

MEDISCRIBE_SCHEMA_TEXT = """{
  "chiefComplaint": "concise phrase or null",
  "hpi": "symptoms; duration; severity or null",
  "pastHistory": "relevant conditions or null",
  "medications": ["Drug name Dose Frequency Duration"],
  "allergies": "substance or NKDA or null",
  "examFindings": "vitals and physical findings or null",
  "diagnosis": "diagnosis or null",
  "plan": "treatment; advice; investigations or null",
  "followUpDays": <integer or null>,
  "diseaseRisk": {
    "fluProbability": <0.0-1.0>,
    "migraineProbability": <0.0-1.0>,
    "fatigueProbability": <0.0-1.0>,
    "diabetesProbability": <0.0-1.0>,
    "hypertensionProbability": <0.0-1.0>,
    "notes": "brief clinical justification or null"
  },
  "hallucinationCheck": {
    "isHallucinated": <boolean>,
    "details": "explanation or null",
    "confidenceScore": <0.0-1.0>
  }
}"""

FINETUNE_SYSTEM_PROMPT = f"""{CLINICAL_PERSONA}
Return ONLY valid JSON in the exact MediScribe schema below.
Do not add markdown or commentary.
Use null or [] for information not supported by the transcript.
Estimate diseaseRisk probabilities conservatively from the transcript instead of using placeholders.
Set hallucinationCheck.isHallucinated to true only if the EMR contains unsupported content.

MediScribe schema:
{MEDISCRIBE_SCHEMA_TEXT}"""


def build_empty_emr() -> dict:
    return deepcopy(MEDISCRIBE_SCHEMA)


def _unwrap_value(value: Any) -> Any:
    if isinstance(value, dict):
        if "value" in value:
            return value.get("value")
        if {"name", "dosage", "frequency"} & set(value.keys()):
            parts = [
                str(value.get("name", "")).strip(),
                str(value.get("dosage", "")).strip(),
                str(value.get("frequency", "")).strip(),
            ]
            rendered = " ".join(part for part in parts if part and part.lower() != "none")
            return rendered or None
    return value


def _coerce_text(value: Any) -> str | None:
    value = _unwrap_value(value)
    if value is None:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return str(value).strip() or None


def _coerce_medications(value: Any) -> list[str]:
    value = _unwrap_value(value)
    if value is None:
        return []
    if isinstance(value, list):
        medications = []
        for item in value:
            rendered = _coerce_text(item)
            if rendered:
                medications.append(rendered)
        return medications
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    rendered = _coerce_text(value)
    return [rendered] if rendered else []


def _coerce_float(value: Any, default: float) -> float:
    value = _unwrap_value(value)
    if value in (None, ""):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _coerce_int(value: Any) -> int | None:
    value = _unwrap_value(value)
    if value in (None, ""):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _coerce_bool(value: Any, default: bool = False) -> bool:
    value = _unwrap_value(value)
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "yes", "1"}:
            return True
        if lowered in {"false", "no", "0"}:
            return False
    if value is None:
        return default
    return bool(value)


def normalize_ground_truth(gt: dict | None) -> dict:
    """
    Upgrade incoming EMR-like data into the canonical MediScribe schema.
    Accepts snake_case, camelCase, and confidence-wrapped values.
    """
    gt = gt or {}

    normalized = build_empty_emr()
    normalized.update(
        {
            "chiefComplaint": _coerce_text(gt.get("chiefComplaint") or gt.get("chief_complaint")),
            "hpi": _coerce_text(gt.get("hpi") or gt.get("history_of_present_illness")),
            "pastHistory": _coerce_text(gt.get("pastHistory") or gt.get("past_history")),
            "medications": _coerce_medications(gt.get("medications") or gt.get("medication")),
            "allergies": _coerce_text(gt.get("allergies")),
            "examFindings": _coerce_text(gt.get("examFindings") or gt.get("examination_findings")),
            "diagnosis": _coerce_text(gt.get("diagnosis")),
            "plan": _coerce_text(gt.get("plan")),
            "followUpDays": _coerce_int(gt.get("followUpDays") or gt.get("follow_up_days")),
        }
    )

    disease_risk = gt.get("diseaseRisk") or {}
    normalized["diseaseRisk"] = {
        field: _coerce_float(disease_risk.get(field), normalized["diseaseRisk"][field])
        for field in DISEASE_RISK_FIELDS
    }
    normalized["diseaseRisk"]["notes"] = _coerce_text(disease_risk.get("notes"))

    hallucination = gt.get("hallucinationCheck") or {}
    normalized["hallucinationCheck"] = {
        "isHallucinated": _coerce_bool(
            hallucination.get("isHallucinated"),
            normalized["hallucinationCheck"]["isHallucinated"],
        ),
        "details": _coerce_text(hallucination.get("details")),
        "confidenceScore": _coerce_float(
            hallucination.get("confidenceScore"),
            normalized["hallucinationCheck"]["confidenceScore"],
        ),
    }

    return normalized


def unwrap_confidence_emr(data: dict | None) -> dict:
    """
    Convert confidence-tagged extractor output into the flat MediScribe schema.
    """
    data = data or {}
    flattened = {}
    for key, value in data.items():
        if key == "medications":
            flattened[key] = _coerce_medications(value)
        elif key in {"diseaseRisk", "hallucinationCheck"} and isinstance(value, dict):
            flattened[key] = value
        else:
            flattened[key] = _unwrap_value(value)
    return normalize_ground_truth(flattened)


def prepare_for_evaluation(data: dict | None) -> str:
    """
    Flatten any EMR-like dict into a stable text representation for ROUGE.
    """
    normalized = unwrap_confidence_emr(data)
    sections = [
        ("CC", normalized.get("chiefComplaint")),
        ("HPI", normalized.get("hpi")),
        ("PH", normalized.get("pastHistory")),
        ("MEDS", ", ".join(normalized.get("medications", [])) or None),
        ("ALLERGIES", normalized.get("allergies")),
        ("EXAM", normalized.get("examFindings")),
        ("DX", normalized.get("diagnosis")),
        ("PLAN", normalized.get("plan")),
        ("FOLLOWUP", normalized.get("followUpDays")),
    ]
    lines = [f"{label}: {value}" for label, value in sections if value not in (None, "", [])]

    disease_risk = normalized.get("diseaseRisk", {})
    risk_values = [
        f"{field}={disease_risk.get(field, 0.0):.2f}"
        for field in DISEASE_RISK_FIELDS
        if disease_risk.get(field, 0.0) > 0
    ]
    if risk_values:
        risk_notes = disease_risk.get("notes")
        rendered = ", ".join(risk_values)
        if risk_notes:
            rendered = f"{rendered} | notes={risk_notes}"
        lines.append(f"RISK: {rendered}")

    hallucination = normalized.get("hallucinationCheck", {})
    if hallucination.get("isHallucinated"):
        rendered = f"true | confidence={hallucination.get('confidenceScore', 0.0):.2f}"
        details = hallucination.get("details")
        if details:
            rendered = f"{rendered} | details={details}"
        lines.append(f"HALLUCINATION: {rendered}")

    return "\n".join(lines)


def has_nonzero_risk(data: dict | None) -> bool:
    normalized = normalize_ground_truth(data)
    disease_risk = normalized.get("diseaseRisk", {})
    return any(disease_risk.get(field, 0.0) > 0 for field in DISEASE_RISK_FIELDS)


def total_risk_intensity(data: dict | None) -> float:
    normalized = normalize_ground_truth(data)
    disease_risk = normalized.get("diseaseRisk", {})
    return sum(float(disease_risk.get(field, 0.0)) for field in DISEASE_RISK_FIELDS)


def schema_json() -> str:
    return json.dumps(MEDISCRIBE_SCHEMA, indent=2)
