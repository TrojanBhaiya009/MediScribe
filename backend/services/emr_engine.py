import json
import re
import time
import requests
import os
import logging
import unicodedata
from datetime import datetime
from typing import Any, Optional
from dotenv import load_dotenv
from openai import OpenAI
from services.transcription import ai_settings

load_dotenv()

logger = logging.getLogger("mediscribe.pipeline")

LOW_SIGNAL_TEXTS = {
    "...",
    "..",
    ".",
    "-",
    "--",
    "n/a",
    "na",
    "none",
    "null",
    "not mentioned",
    "not mentioned in transcript",
    "unknown",
    "not sure",
    "unsure",
    "hmm",
    "uh",
    "um",
    "audio unclear",
    "inaudible",
    "unintelligible",
}

# ─── Configuration ────────────────────────────────────────────────────────────
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral")
OLLAMA_TIMEOUT_SECS = float(os.getenv("OLLAMA_TIMEOUT_SECS", "12"))
OLLAMA_NUM_PREDICT = int(os.getenv("OLLAMA_NUM_PREDICT", "768"))
OLLAMA_PROMPT_PROFILE = os.getenv("OLLAMA_PROMPT_PROFILE", "compact").strip().lower()
MAX_RETRIES = int(os.getenv("EMR_MAX_RETRIES", "0"))
RETRY_DELAY_SECS = float(os.getenv("EMR_RETRY_DELAY_SECS", "1.0"))
ENABLE_OPENAI_FALLBACK = os.getenv("ENABLE_OPENAI_FALLBACK", "true").strip().lower() in {"1", "true", "yes", "on"}
OPENAI_EMR_MODEL = os.getenv("OPENAI_EMR_MODEL", "gpt-4o-mini")
OPENAI_TIMEOUT_SECS = float(os.getenv("OPENAI_TIMEOUT_SECS", "20"))
ENABLE_BLACKBOX_FALLBACK = os.getenv("ENABLE_BLACKBOX_FALLBACK", "false").strip().lower() in {"1", "true", "yes", "on"}
BLACKBOX_BASE_URL = os.getenv("BLACKBOX_BASE_URL", "https://api.blackbox.ai")
BLACKBOX_EMR_MODEL = os.getenv("BLACKBOX_EMR_MODEL", "blackboxai/openai/gpt-4")
BLACKBOX_TIMEOUT_SECS = float(os.getenv("BLACKBOX_TIMEOUT_SECS", "20"))
ENABLE_ANTHROPIC_FALLBACK = os.getenv("ENABLE_ANTHROPIC_FALLBACK", "false").strip().lower() in {"1", "true", "yes", "on"}
ANTHROPIC_TIMEOUT_SECS = float(os.getenv("ANTHROPIC_TIMEOUT_SECS", "20"))
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
BLACKBOX_API_KEY = os.getenv("BLACKBOX_API_KEY", "").strip()
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()

# Optional OpenAI client (fast cloud fallback)
_openai_client = None
try:
    if ENABLE_OPENAI_FALLBACK and OPENAI_API_KEY and OPENAI_API_KEY not in ("placeholder-dev", "sk-your-openai-key-here"):
        _openai_client = OpenAI(api_key=OPENAI_API_KEY, timeout=OPENAI_TIMEOUT_SECS)
except Exception:
    pass

# Optional Anthropic client (paid fallback)
_anthropic_client = None
try:
    if ENABLE_ANTHROPIC_FALLBACK and ANTHROPIC_API_KEY and ANTHROPIC_API_KEY not in ("placeholder-dev", "sk-ant-placeholder-dev"):
        from anthropic import Anthropic
        _anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY, timeout=ANTHROPIC_TIMEOUT_SECS)
except Exception:
    pass


def _extract_blackbox_message_content(payload: dict) -> str:
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise RuntimeError("Blackbox response did not include choices")

    message = choices[0].get("message") if isinstance(choices[0], dict) else None
    if not isinstance(message, dict):
        raise RuntimeError("Blackbox response did not include a valid message")

    content = message.get("content", "")
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        text_parts = []
        for item in content:
            if isinstance(item, dict):
                if item.get("type") == "text" and isinstance(item.get("text"), str):
                    text_parts.append(item["text"])
                elif isinstance(item.get("content"), str):
                    text_parts.append(item["content"])
            elif isinstance(item, str):
                text_parts.append(item)
        return "\n".join(part for part in text_parts if part).strip()

    raise RuntimeError("Blackbox response content format was unsupported")


def _call_blackbox_chat(system_prompt: str, user_message: str) -> dict:
    if not (
        ENABLE_BLACKBOX_FALLBACK
        and BLACKBOX_API_KEY
        and BLACKBOX_API_KEY not in ("placeholder-dev", "sk-your-blackbox-key-here")
    ):
        raise RuntimeError("Blackbox provider is not configured")

    response = requests.post(
        f"{BLACKBOX_BASE_URL.rstrip('/')}/chat/completions",
        headers={
            "Authorization": f"Bearer {BLACKBOX_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": BLACKBOX_EMR_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "temperature": 0,
        },
        timeout=BLACKBOX_TIMEOUT_SECS,
    )
    response.raise_for_status()
    raw = _extract_blackbox_message_content(response.json())
    return _parse_json_response(raw)


# Cache Ollama availability for 30s to avoid hammering /api/tags on every call
_ollama_available_cache = {"available": False, "checked_at": 0.0}
_OLLAMA_CACHE_TTL = 30  # seconds


# ═══════════════════════════════════════════════════════════════════════════════
# AGENT 1 — EXTRACTOR
# Reads raw transcript → outputs structured EMR with confidence per field
# ═══════════════════════════════════════════════════════════════════════════════

EXTRACTOR_PROMPT = """You are Agent 1 (Extractor) in a clinical CRM pipeline for Indian clinics.

INPUT: A doctor-patient consultation transcript, often in Hinglish (mixed Hindi-English).
OUTPUT: Structured EMR JSON with confidence tags.

CONFIDENCE RULES (this is the core feature — be precise):
• "green" — Explicitly stated by doctor or patient. Example: "Sir mein bohot severe headache hai" → chiefComplaint = green.
• "yellow" — The transcript explicitly mentions an item but its intent is ambiguous and needs doctor confirmation. Never create a medicine, dose, frequency, diagnosis, or investigation that was not spoken.
• "blank" — Not mentioned at all. Set value to null.

HINGLISH UNDERSTANDING:
• "Zaroorat padne par" / "SOS" → frequency = "As needed (PRN)"
• "Subah shaam" → frequency = "Twice daily (BD)"
• "Khali pet" → note = "Take on empty stomach"
• "BP normal hai" → examFindings includes blood pressure reading
• "Uski purani report dekho" → pastHistory may be referenced but not stated (yellow)

EXTRACTION RULES:
1. Keep the doctor's exact medical terminology. Don't simplify "Sumatriptan 50mg" to "headache medicine".
2. NEVER infer a standard dose, frequency, duration, route, diagnosis, or investigation. Missing medication attributes must be null.
3. A symptom is not a diagnosis. Populate diagnosis only when the clinician explicitly states or clearly proposes it (for example "diagnosis is migraine" or "this looks like dengue").
4. Extract every explicitly mentioned investigation, including CT/CAT scan, MRI, X-ray, USG/ultrasound, ECG/EKG, echo, CBC, LFT, KFT/RFT, HbA1c, glucose, lipid profile, CRP, ESR, TSH/thyroid tests, dengue/NS1, malaria tests, biopsy, and endoscopy.
5. Understand Hindi and Romanized Hindi quantity/frequency phrases: "दो गोली"/"do goli", "दिन में दो बार"/"din mein do baar", "सुबह शाम"/"subah shaam", "रात को"/"raat ko", "खाने के बाद"/"khane ke baad", and "ज़रूरत पर"/"zaroorat par".
6. Extract ALL medications mentioned, even if dosage or frequency are missing. If only the medication name is stated, set dosage/frequency to null.
7. Disease-risk probabilities must remain 0 unless the clinician explicitly discusses that disease or risk. Do not predict disease from symptoms.
8. hallucinationCheck is not a self-assessment substitute: only transcript-supported facts may appear in the JSON.

Return ONLY this JSON (no text before/after):
{
  "chiefComplaint": {"value": "string or null", "confidence": "green|yellow|blank"},
  "hpi": {"value": "string or null", "confidence": "green|yellow|blank"},
  "pastHistory": {"value": "string or null", "confidence": "green|yellow|blank"},
  "medications": [{"name": "string", "dosage": "string or null", "frequency": "string or null", "confidence": "green|yellow|blank"}],
  "allergies": {"value": "string or null", "confidence": "green|yellow|blank"},
  "examFindings": {"value": "string or null", "confidence": "green|yellow|blank"},
  "diagnosis": {"value": "string or null", "confidence": "green|yellow|blank"},
  "plan": {"value": "string or null", "confidence": "green|yellow|blank"},
  "followUpDays": {"value": "number or null", "confidence": "green|yellow|blank"},
  "investigations": [{"name": "string", "confidence": "green|yellow|blank"}],
  "diseaseRisk": {
    "fluProbability": 0.0,
    "migraineProbability": 0.0,
    "fatigueProbability": 0.0,
    "notes": "string or null"
  },
  "hallucinationCheck": {
    "isHallucinated": false,
    "details": "string or null"
  },
  "inferenceNotes": ["list of strings explaining yellow-tagged inferences"]
}"""

EXTRACTOR_PROMPT_COMPACT = """Extract structured EMR JSON from a consultation transcript.

Rules:
- Return JSON only.
- Use confidence green when explicitly stated, yellow only when an explicitly mentioned item's intent is ambiguous, blank when absent.
- Keep medication name, dosage, and frequency exact when present.
- Set missing values to null and confidence to blank.
- Only infer followUpDays if the transcript explicitly says follow up / review / come back / return.
- Extract ALL medications mentioned, even if dosage or frequency are missing. Set missing details to null.
- Extract every explicitly mentioned investigation, including scans, imaging, blood/urine tests, named lab panels, ECG/echo, biopsy, and endoscopy.
- Understand English, Devanagari Hindi, and Romanized Hindi medication instructions.
- Never invent a standard medication dose/frequency or a likely test.
- Do not convert symptoms into a diagnosis. Diagnosis must be explicitly stated by the clinician.
- Keep disease-risk probabilities at 0 unless the clinician explicitly discusses the disease/risk.

Return exactly:
{
  "chiefComplaint": {"value": "string or null", "confidence": "green|yellow|blank"},
  "hpi": {"value": "string or null", "confidence": "green|yellow|blank"},
  "pastHistory": {"value": "string or null", "confidence": "green|yellow|blank"},
  "medications": [{"name": "string", "dosage": "string or null", "frequency": "string or null", "confidence": "green|yellow|blank"}],
  "allergies": {"value": "string or null", "confidence": "green|yellow|blank"},
  "examFindings": {"value": "string or null", "confidence": "green|yellow|blank"},
  "diagnosis": {"value": "string or null", "confidence": "green|yellow|blank"},
  "plan": {"value": "string or null", "confidence": "green|yellow|blank"},
  "followUpDays": {"value": "number or null", "confidence": "green|yellow|blank"},
  "investigations": [{"name": "string", "confidence": "green|yellow|blank"}],
  "diseaseRisk": {"fluProbability": 0.0, "migraineProbability": 0.0, "fatigueProbability": 0.0, "notes": "string or null"},
  "hallucinationCheck": {"isHallucinated": false, "details": "string or null"},
  "inferenceNotes": ["strings"]
}"""


# ═══════════════════════════════════════════════════════════════════════════════
# AGENT 2 — SAFETY CHECKER
# Takes Agent 1's structured EMR → cross-references for safety issues
# ═══════════════════════════════════════════════════════════════════════════════

SAFETY_CHECKER_PROMPT = """You are Agent 2 (Safety Checker) in a clinical CRM pipeline. You receive structured EMR data.

CHECK THESE IN ORDER OF PRIORITY:

1. ALLERGY CONFLICTS (CRITICAL):
   - Cross-reference allergies field against every medication name AND drug class.
   - Penicillin allergy → flag Amoxicillin, Ampicillin (same class).
   - NSAID allergy → flag Ibuprofen, Naproxen, Diclofenac, Aspirin.
   - Sulfa allergy → flag Sulfamethoxazole, Celecoxib.

2. DRUG-DRUG INTERACTIONS (CRITICAL/WARNING):
   - Warfarin + NSAIDs → bleeding risk.
   - ACE Inhibitors + Potassium supplements → hyperkalemia.
   - SSRIs + MAOIs → serotonin syndrome.
   - Metformin + contrast dye → lactic acidosis risk.
   - Statins + Macrolide antibiotics → rhabdomyolysis risk.

3. CONTRAINDICATIONS (WARNING):
   - Gastritis/ulcer history + NSAIDs → GI bleed risk.
   - Pregnancy + Category X drugs (Methotrexate, Isotretinoin, Statins).
   - Renal impairment + nephrotoxic drugs (Gentamicin, NSAIDs high-dose).
   - Asthma + non-selective beta-blockers.

4. DOSAGE CONCERNS (INFO/WARNING):
   - Flag if dose exceeds standard adult maximum.
   - Flag pediatric doses on adult patients or vice versa.

IMPORTANT: CHECK the pastHistory and examFindings fields too, not just allergies. If pastHistory mentions "gastritis" and a medication is an NSAID, that's a contraindication.

Return ONLY this JSON:
{
  "safetyFlags": [
    {
      "severity": "critical|warning|info",
      "type": "drug_interaction|allergy_conflict|contraindication|dosage_concern",
      "message": "Clear description of the issue",
      "affectedMedications": ["medication names"],
      "recommendation": "What the doctor should consider"
    }
  ],
  "overallSafetyStatus": "safe|warnings_present|critical_flags",
  "checkedAt": "ISO timestamp"
}

If no issues: {"safetyFlags": [], "overallSafetyStatus": "safe", "checkedAt": "ISO timestamp"}"""

SAFETY_CHECKER_PROMPT_COMPACT = """Check EMR JSON for medication safety and return JSON only.

Check:
- allergy conflicts
- major drug-drug interactions
- obvious contraindications from pastHistory or examFindings
- major dosage concerns

Return:
{
  "safetyFlags": [
    {
      "severity": "critical|warning|info",
      "type": "drug_interaction|allergy_conflict|contraindication|dosage_concern",
      "message": "string",
      "affectedMedications": ["names"],
      "recommendation": "string"
    }
  ],
  "overallSafetyStatus": "safe|warnings_present|critical_flags",
  "checkedAt": "ISO timestamp"
}
If no issues, return an empty safetyFlags array and overallSafetyStatus safe."""


# ═══════════════════════════════════════════════════════════════════════════════
# AGENT 3 — HINDI SUMMARIZER
# Takes finalized EMR → generates patient-facing summary in Hindi-English
# Only runs AFTER doctor approval
# ═══════════════════════════════════════════════════════════════════════════════

HINDI_SUMMARIZER_PROMPT = """You are Agent 3 (Patient Summarizer) in a clinical CRM pipeline. You receive a doctor-approved EMR.

Your audience: An Indian patient who may have NO medical literacy. They need to understand:
- What is my problem?
- What medicine should I take, when, and how?
- When do I come back?
- What should I be careful about?

LANGUAGE: Write in Hinglish — Hindi words in Devanagari, English medical terms kept as-is but explained.

EXAMPLES of good translations:
- "Migraine" → "माइग्रेन — सिर का तेज़ दर्द जो बार-बार आता है"
- "Take Sumatriptan 50mg PRN" → "Sumatriptan 50mg — जब दर्द शुरू हो तब एक गोली लें"
- "Avoid NSAIDs" → "Ibuprofen, Diclofenac जैसी दर्द की गोलियाँ मत लें — पेट ख़राब हो सकता है"
- "Follow up in 7 days" → "7 दिन बाद दोबारा आएं"

KEEP IT SHORT: A villager at a pharmacy counter should understand this in 30 seconds.

Return ONLY this JSON:
{
  "patientSummary": {
    "diagnosisSimple": "Hindi-English explanation of diagnosis",
    "medicationInstructions": [
      {
        "name": "Medicine name",
        "hindiInstruction": "कब और कैसे लेनी है",
        "warning": "ध्यान रखें (or null if none)"
      }
    ],
    "followUpNote": "अगली visit कब",
    "generalAdvice": "खाने-पीने / lifestyle advice"
  }
}"""


# ═══════════════════════════════════════════════════════════════════════════════
# LLM CALL HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _parse_json_response(response_text: str) -> dict:
    """
    Extract JSON from LLM response text.
    Handles: raw JSON, markdown-fenced JSON, and JSON with trailing text.
    """
    if not response_text or not response_text.strip():
        raise ValueError("Empty response from LLM")

    text = response_text.strip()

    # Strip markdown code fences (```json ... ``` or ``` ... ```)
    fence_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?\s*```', text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()

    # Find the outermost JSON object
    depth = 0
    start_idx = -1
    for i, ch in enumerate(text):
        if ch == '{':
            if depth == 0:
                start_idx = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start_idx != -1:
                json_str = text[start_idx:i + 1]
                try:
                    return json.loads(json_str)
                except json.JSONDecodeError:
                    # Try cleaning common LLM mistakes
                    cleaned = re.sub(r',\s*}', '}', json_str)  # trailing commas
                    cleaned = re.sub(r',\s*]', ']', cleaned)    # trailing commas in arrays
                    return json.loads(cleaned)

    raise ValueError(f"No valid JSON found in response (length={len(response_text)})")


def _get_prompt_variant(full_prompt: str, compact_prompt: str) -> str:
    """Use smaller prompts for local Ollama by default to reduce token overhead."""
    return compact_prompt if OLLAMA_PROMPT_PROFILE == "compact" else full_prompt


def _call_llm(system_prompt: str, user_message: str, retry_count: int = MAX_RETRIES) -> dict:
    """
    Call LLM with Ollama-first, Anthropic-fallback strategy.
    Includes retry logic with backoff for transient failures.
    """
    errors = []

    for attempt in range(retry_count + 1):
        if attempt > 0:
            wait = RETRY_DELAY_SECS * attempt
            logger.info(f"[Pipeline] Retry {attempt}/{retry_count} after {wait}s delay...")
            time.sleep(wait)

        # 1. Try Ollama (free, local)
        if _is_ollama_available():
            try:
                payload = {
                    "model": OLLAMA_MODEL,
                    "prompt": f"{system_prompt}\n\n{user_message}",
                    "stream": False,
                    "format": "json",
                    "options": {
                        "temperature": 0,
                        "num_predict": OLLAMA_NUM_PREDICT,
                        "top_p": 0.9,
                        "repeat_penalty": 1.1,
                    }
                }
                response = requests.post(
                    f"{OLLAMA_BASE_URL}/api/generate",
                    json=payload,
                    timeout=OLLAMA_TIMEOUT_SECS
                )
                response.raise_for_status()
                raw = response.json().get("response", "")
                result = _parse_json_response(raw)
                logger.info(f"[Pipeline] Ollama succeeded (attempt {attempt + 1})")
                return result
            except json.JSONDecodeError as e:
                errors.append(f"Ollama JSON parse (attempt {attempt + 1}): {e}")
                pass
            except requests.exceptions.Timeout:
                errors.append(f"Ollama timeout (attempt {attempt + 1})")
                pass
            except Exception as e:
                errors.append(f"Ollama (attempt {attempt + 1}): {e}")
                break  # non-retryable Ollama error — fall through to Anthropic

        # 2. Try OpenAI (paid fallback)
        if _openai_client:
            try:
                completion = _openai_client.chat.completions.create(
                    model=OPENAI_EMR_MODEL,
                    temperature=0,
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                )
                raw = completion.choices[0].message.content or ""
                result = _parse_json_response(raw)
                logger.info(f"[Pipeline] OpenAI succeeded (attempt {attempt + 1})")
                return result
            except json.JSONDecodeError as e:
                errors.append(f"OpenAI JSON parse (attempt {attempt + 1}): {e}")
                continue
            except Exception as e:
                errors.append(f"OpenAI (attempt {attempt + 1}): {e}")

        # 3. Try Blackbox (OpenAI-compatible chat completions endpoint)
        if ENABLE_BLACKBOX_FALLBACK and BLACKBOX_API_KEY:
            try:
                result = _call_blackbox_chat(system_prompt, user_message)
                logger.info(f"[Pipeline] Blackbox succeeded (attempt {attempt + 1})")
                return result
            except json.JSONDecodeError as e:
                errors.append(f"Blackbox JSON parse (attempt {attempt + 1}): {e}")
                continue
            except Exception as e:
                errors.append(f"Blackbox (attempt {attempt + 1}): {e}")

        # 4. Try Anthropic (paid fallback)
        if _anthropic_client:
            try:
                message = _anthropic_client.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=4096,
                    temperature=0,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_message}]
                )
                raw = message.content[0].text
                result = _parse_json_response(raw)
                logger.info(f"[Pipeline] Anthropic succeeded (attempt {attempt + 1})")
                return result
            except json.JSONDecodeError as e:
                errors.append(f"Anthropic JSON parse (attempt {attempt + 1}): {e}")
                continue
            except Exception as e:
                errors.append(f"Anthropic (attempt {attempt + 1}): {e}")
                break  # non-retryable

        # Neither provider available
        break

    error_msg = "No AI provider could generate valid output. "
    if errors:
        error_msg += f"Errors: {'; '.join(errors)}"
    else:
        error_msg += "Install Ollama (https://ollama.com) and run: ollama pull mistral"
    raise RuntimeError(error_msg)


def _is_ollama_available() -> bool:
    """Check Ollama availability with 30s TTL cache."""
    now = time.time()
    if now - _ollama_available_cache["checked_at"] < _OLLAMA_CACHE_TTL:
        return _ollama_available_cache["available"]

    try:
        r = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
        available = r.status_code == 200
    except Exception:
        available = False

    _ollama_available_cache["available"] = available
    _ollama_available_cache["checked_at"] = now
    return available


def _get_default_emr() -> dict:
    """Structured fallback when Agent 1 fails completely."""
    return {
        "chiefComplaint": {"value": None, "confidence": "blank"},
        "hpi": {"value": None, "confidence": "blank"},
        "pastHistory": {"value": None, "confidence": "blank"},
        "medications": [],
        "allergies": {"value": None, "confidence": "blank"},
        "examFindings": {"value": None, "confidence": "blank"},
        "diagnosis": {"value": None, "confidence": "blank"},
        "plan": {"value": None, "confidence": "blank"},
        "followUpDays": {"value": None, "confidence": "blank"},
        "investigations": [],
        "diseaseRisk": {"fluProbability": 0.0, "migraineProbability": 0.0, "fatigueProbability": 0.0, "notes": None},
        "hallucinationCheck": {"isHallucinated": False, "details": None},
        "inferenceNotes": [],
    }


def _clean_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    cleaned = value.strip()
    if not cleaned:
        return None

    lowered = cleaned.lower()
    if lowered in LOW_SIGNAL_TEXTS:
        return None

    # Reject punctuation-only and symbol-only fragments while preserving Hindi
    # and other Unicode scripts. The former a-z check erased Devanagari fields.
    if not any(char.isalnum() for char in cleaned):
        return None

    # Reject common filler utterances like "uhh", "ummm", "hmmm".
    if re.fullmatch(r"(?:u+h+|u+m+|h+m+|m+h+)", lowered):
        return None
    return cleaned


def _normalize_confidence(confidence: Any, has_value: bool) -> str:
    normalized = str(confidence).strip().lower() if confidence is not None else ""
    if normalized not in {"green", "yellow", "blank"}:
        normalized = "green" if has_value else "blank"
    if not has_value:
        normalized = "blank"
    return normalized


def _normalize_confidence_field(field: Any, *, numeric: bool = False) -> dict:
    raw_value = field
    raw_confidence = None

    if isinstance(field, dict):
        raw_value = field.get("value")
        raw_confidence = field.get("confidence")

    value = None
    if numeric:
        if raw_value not in (None, ""):
            try:
                value = int(float(raw_value))
            except (TypeError, ValueError):
                value = None
    else:
        value = _clean_text(raw_value)

    confidence = _normalize_confidence(raw_confidence, value is not None)
    return {"value": value, "confidence": confidence}


def _normalize_medications(items: Any) -> list[dict]:
    if not isinstance(items, list):
        return []

    normalized = []
    for med in items:
        if isinstance(med, dict):
            name = _clean_text(med.get("name"))
            dosage = _clean_text(med.get("dosage"))
            frequency = _clean_text(med.get("frequency"))
            confidence = _normalize_confidence(med.get("confidence"), name is not None)
        else:
            name = _clean_text(med)
            dosage = None
            frequency = None
            confidence = _normalize_confidence(None, name is not None)

        if not name:
            continue
        normalized.append(
            {
                "name": name,
                "dosage": dosage,
                "frequency": frequency,
                "confidence": confidence,
            }
        )

    return normalized


def _normalize_investigations(items: Any) -> list[dict]:
    if not isinstance(items, list):
        return []

    normalized = []
    for inv in items:
        if isinstance(inv, dict):
            name = _clean_text(inv.get("name"))
            confidence = _normalize_confidence(inv.get("confidence"), name is not None)
        else:
            name = _clean_text(inv)
            confidence = _normalize_confidence(None, name is not None)

        if not name:
            continue
        normalized.append({"name": name, "confidence": confidence})

    return normalized


def _coerce_probability(value: Any) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, number))


def _sanitize_emr_shape(emr_data: Any) -> dict:
    if not isinstance(emr_data, dict):
        return _get_default_emr()

    normalized = _get_default_emr()

    normalized["chiefComplaint"] = _normalize_confidence_field(emr_data.get("chiefComplaint"))
    normalized["hpi"] = _normalize_confidence_field(emr_data.get("hpi"))
    normalized["pastHistory"] = _normalize_confidence_field(emr_data.get("pastHistory"))
    normalized["allergies"] = _normalize_confidence_field(emr_data.get("allergies"))
    normalized["examFindings"] = _normalize_confidence_field(emr_data.get("examFindings"))
    normalized["diagnosis"] = _normalize_confidence_field(emr_data.get("diagnosis"))
    normalized["plan"] = _normalize_confidence_field(emr_data.get("plan"))
    normalized["followUpDays"] = _normalize_confidence_field(emr_data.get("followUpDays"), numeric=True)
    normalized["medications"] = _normalize_medications(emr_data.get("medications"))
    normalized["investigations"] = _normalize_investigations(emr_data.get("investigations"))

    disease_risk = emr_data.get("diseaseRisk") if isinstance(emr_data.get("diseaseRisk"), dict) else {}
    normalized["diseaseRisk"] = {
        "fluProbability": _coerce_probability(disease_risk.get("fluProbability")),
        "migraineProbability": _coerce_probability(disease_risk.get("migraineProbability")),
        "fatigueProbability": _coerce_probability(disease_risk.get("fatigueProbability")),
        "notes": _clean_text(disease_risk.get("notes")),
    }

    hallucination = emr_data.get("hallucinationCheck") if isinstance(emr_data.get("hallucinationCheck"), dict) else {}
    normalized["hallucinationCheck"] = {
        "isHallucinated": bool(hallucination.get("isHallucinated", False)),
        "details": _clean_text(hallucination.get("details")),
    }

    notes = emr_data.get("inferenceNotes")
    normalized["inferenceNotes"] = [note for note in (_clean_text(n) for n in (notes or [])) if note] if isinstance(notes, list) else []

    for key, value in emr_data.items():
        if key not in normalized:
            normalized[key] = value

    return normalized


MEDICATION_ALIASES: dict[str, str] = {
    "paracetamol": "Paracetamol", "acetaminophen": "Paracetamol", "पैरासिटामोल": "Paracetamol",
    "dolo": "Dolo", "डोलो": "Dolo", "crocin": "Crocin", "क्रोसिन": "Crocin", "calpol": "Calpol",
    "ibuprofen": "Ibuprofen", "brufen": "Brufen", "combiflam": "Combiflam", "diclofenac": "Diclofenac",
    "amoxicillin": "Amoxicillin", "azithromycin": "Azithromycin", "doxycycline": "Doxycycline",
    "cefixime": "Cefixime", "ceftriaxone": "Ceftriaxone", "cetirizine": "Cetirizine",
    "levocetirizine": "Levocetirizine", "montelukast": "Montelukast", "pantoprazole": "Pantoprazole",
    "omeprazole": "Omeprazole", "ondansetron": "Ondansetron", "domperidone": "Domperidone",
    "metformin": "Metformin", "amlodipine": "Amlodipine", "losartan": "Losartan",
    "atorvastatin": "Atorvastatin", "aspirin": "Aspirin", "sumatriptan": "Sumatriptan", "insulin": "Insulin",
}

INVESTIGATION_ALIASES: list[tuple[str, str]] = [
    (r"\b(?:ct|cat)\s*(?:scan)?\b|\bसीटी\s*स्कैन\b", "CT scan"),
    (r"\bmri(?:\s+scan)?\b|\bएमआरआई\b", "MRI"),
    (r"\bx[\s-]?ray\b|\bएक्स[\s-]?रे\b", "X-ray"),
    (r"\b(?:ultrasound|usg|sonography)\b|\bअल्ट्रासाउंड\b", "Ultrasound / USG"),
    (r"\b(?:ecg|ekg)\b|\bईसीजी\b", "ECG"),
    (r"\becho(?:cardiogram|cardiography)?\b", "Echocardiogram"),
    (r"\bcbc\b|\bcomplete blood count\b", "CBC"),
    (r"\blft\b|\bliver function tests?\b", "LFT"),
    (r"\b(?:kft|rft)\b|\b(?:kidney|renal) function tests?\b", "KFT / RFT"),
    (r"\bhba1c\b|\bglycated h[ae]moglobin\b", "HbA1c"),
    (r"\b(?:fasting|random) (?:blood )?(?:sugar|glucose)\b", "Blood glucose"),
    (r"\blipid profile\b|\bcholesterol tests?\b", "Lipid profile"),
    (r"\bcrp\b|\bc-reactive protein\b", "CRP"),
    (r"\besr\b", "ESR"),
    (r"\b(?:tsh|thyroid profile|thyroid function tests?)\b", "Thyroid profile / TSH"),
    (r"\b(?:dengue\s+)?ns1\b|\bdengue tests?\b", "Dengue / NS1 test"),
    (r"\bmalaria tests?\b|\bperipheral smear\b", "Malaria test"),
    (r"\b(?:urine test|urinalysis|urine routine)\b", "Urine test"),
    (r"\b(?:blood test|blood work|lab tests?|labs)\b", "Blood tests"),
    (r"\bbiopsy\b|\bबायोप्सी\b", "Biopsy"),
    (r"\bendoscop(?:y|ic)\b|\bएंडोस्कोपी\b", "Endoscopy"),
]

NUMBER_TOKEN = r"(?:\d+(?:\.\d+)?|one|two|three|four|five|half|ek|do|teen|aadha|aadhi|एक|दो|तीन|चार|पांच|आधा|आधी)"
DOSE_UNIT = r"(?:mg|milligrams?|मिलीग्राम|ml|milliliters?|मिलीलीटर|mcg|micrograms?|g|grams?|tablets?|tabs?|capsules?|doses?|गोली|गोलियां|खुराक)"
DOSAGE_PATTERN = re.compile(rf"(?<!\w){NUMBER_TOKEN}\s*{DOSE_UNIT}(?!\w)", re.IGNORECASE)

FREQUENCY_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\b(?:once daily|once a day|od)\b|\b(?:din mein |दिन में )?(?:ek|एक) baar\b", re.I), "Once daily (OD)"),
    (re.compile(r"\b(?:twice daily|twice a day|two times (?:daily|a day)|bd|bid|subah shaam|din mein do baar)\b|दिन में दो बार|सुबह शाम", re.I), "Twice daily (BD)"),
    (re.compile(r"\b(?:thrice daily|three times (?:daily|a day)|tds|tid|din mein teen baar)\b|दिन में तीन बार", re.I), "Three times daily (TDS)"),
    (re.compile(r"\b(?:at night|every night|nightly|raat ko|one dose per night)\b|रात को", re.I), "At night"),
    (re.compile(r"\b(?:in the morning|every morning|subah)\b|सुबह", re.I), "In the morning"),
    (re.compile(r"\b(?:as needed|when needed|prn|sos|zarurat par|zaroorat par|zaroorat padne par)\b|ज़रूरत पर|जरूरत पर", re.I), "As needed (PRN)"),
    (re.compile(r"\b(?:after food|after meals?|khane ke baad)\b|खाने के बाद", re.I), "After food"),
    (re.compile(r"\b(?:before food|before meals?|khane se pehle|empty stomach|khali pet)\b|खाने से पहले|खाली पेट", re.I), "Before food / empty stomach"),
]


def _compact_text(value: str) -> str:
    return "".join(
        char.casefold()
        for char in value
        if char.isalnum() or unicodedata.category(char).startswith("M")
    )


def _medication_key(value: str) -> str:
    compact = _compact_text(value)
    paracetamol_family = {
        _compact_text(name) for name in ("Paracetamol", "Acetaminophen", "Dolo", "Crocin", "Calpol", "पैरासिटामोल", "डोलो", "क्रोसिन")
    }
    return "paracetamol" if compact in paracetamol_family else compact


def _investigation_key(value: str) -> str:
    for pattern_text, canonical_name in INVESTIGATION_ALIASES:
        if re.search(pattern_text, value, re.IGNORECASE):
            return _compact_text(canonical_name)
    return _compact_text(value)


def _context_window(text: str, start: int, end: int, radius: int = 90) -> str:
    left = max(0, start - radius)
    right = min(len(text), end + radius)
    return text[left:right]


def _nearest_match(pattern: re.Pattern, context: str, pivot: int) -> Optional[re.Match]:
    matches = list(pattern.finditer(context))
    if not matches:
        return None
    return min(matches, key=lambda match: abs(((match.start() + match.end()) // 2) - pivot))


def _extract_simple_medications(transcript: str) -> list[dict]:
    """Extract transcript-grounded medicines and spoken instructions.

    This deterministic pass supplements the LLM and remains intentionally
    conservative: it never supplies a standard dose or frequency.
    """
    if not transcript or not transcript.strip():
        return []

    alias_pattern = re.compile(
        "|".join(sorted((re.escape(alias) for alias in MEDICATION_ALIASES), key=len, reverse=True)),
        re.IGNORECASE,
    )
    medications: list[dict] = []
    seen: set[str] = set()
    candidates: list[tuple[int, int, str]] = []

    for match in alias_pattern.finditer(transcript):
        canonical_name = MEDICATION_ALIASES.get(match.group(0).casefold())
        if canonical_name:
            candidates.append((match.start(), match.end(), canonical_name))

    # Recover unfamiliar generic/brand names when speech includes strong
    # prescription evidence (a strength, "doses of", or an action verb).
    generic_patterns = [
        re.compile(rf"(?P<name>[A-Za-z][A-Za-z0-9-]{{2,}})\s+{NUMBER_TOKEN}\s*{DOSE_UNIT}", re.I),
        re.compile(rf"{NUMBER_TOKEN}\s*{DOSE_UNIT}\s+(?:of\s+)?(?P<name>[A-Za-z][A-Za-z0-9-]{{2,}})", re.I),
        re.compile(r"\b(?:prescribe|prescribed|start|started|take|continue|give|given|use|lena|lene|lo)\s+(?:tab(?:let)?\s+|capsule\s+)?(?P<name>[A-Za-z][A-Za-z0-9-]{2,})\b", re.I),
    ]
    generic_stopwords = {
        "the", "this", "that", "some", "medicine", "medicines", "medication", "medications", "tablet", "capsule", "dose", "doses",
        "daily", "twice", "thrice", "morning", "night", "food", "rest", "water", "care",
        "one", "two", "three", "four", "five", "half", "ek", "do", "teen",
    }
    for pattern in generic_patterns:
        for match in pattern.finditer(transcript):
            raw_name = match.group("name")
            if raw_name.casefold() in generic_stopwords:
                continue
            canonical_name = MEDICATION_ALIASES.get(raw_name.casefold(), raw_name.title())
            name_start, name_end = match.span("name")
            candidates.append((name_start, name_end, canonical_name))

    for start, end, canonical_name in sorted(candidates, key=lambda item: item[0]):
        medication_key = _medication_key(canonical_name)
        if not canonical_name or medication_key in seen:
            continue

        context = _context_window(transcript, start, end)
        pivot = start - max(0, start - 90)

        # Do not turn an explicitly avoided/allergic medicine into an Rx item.
        prefix = transcript[max(0, start - 42):start].casefold()
        if re.search(r"(?:do not take|don't take|avoid|allergic to|allergy to|मत (?:लेना|लीजिए)|नहीं लेना)", prefix):
            continue

        dosage_match = _nearest_match(DOSAGE_PATTERN, context, pivot)
        dosage = dosage_match.group(0).strip() if dosage_match else None

        frequency = None
        for pattern, canonical_frequency in FREQUENCY_PATTERNS:
            if pattern.search(context):
                frequency = canonical_frequency
                break

        duration_match = re.search(
            rf"\b(?:for\s+)?({NUMBER_TOKEN})\s+(?:days?|din)\b|((?:एक|दो|तीन|चार|पांच|\d+))\s+दिन(?:\s+तक)?",
            context,
            re.IGNORECASE,
        )
        if duration_match:
            duration = duration_match.group(0).strip()
            frequency = f"{frequency}; {duration}" if frequency else duration

        seen.add(medication_key)
        medications.append({
            "name": canonical_name,
            "dosage": dosage,
            "frequency": frequency,
            "confidence": "green",
        })

    return medications


def _extract_simple_investigations(transcript: str) -> list[dict]:
    """Surface explicitly mentioned tests; ambiguous intent is yellow."""
    if not transcript or not transcript.strip():
        return []

    order_cues = re.compile(
        r"\b(?:order|ordered|advise|advised|recommend|recommended|get|do|book|schedule|send|needs?|karwa|karaye|karao|bhej|likh)\w*\b|"
        r"करवा|कराइए|कराएं|जांच|जाँच|लिख|भेज",
        re.IGNORECASE,
    )
    found: list[dict] = []
    seen: set[str] = set()
    for pattern_text, canonical_name in INVESTIGATION_ALIASES:
        pattern = re.compile(pattern_text, re.IGNORECASE)
        for match in pattern.finditer(transcript):
            if canonical_name.casefold() in seen:
                continue
            context = _context_window(transcript, match.start(), match.end(), radius=70)
            explicit_order = bool(order_cues.search(context))
            found.append({
                "name": canonical_name,
                "confidence": "green" if explicit_order else "yellow",
            })
            seen.add(canonical_name.casefold())
    return found


def _entity_supported(value: Optional[str], transcript: str) -> bool:
    if not value:
        return False
    compact_value = _compact_text(value)
    compact_transcript = _compact_text(transcript)
    if compact_value and compact_value in compact_transcript:
        return True

    value_tokens = {token.casefold() for token in re.findall(r"\w+", value, re.UNICODE) if len(token) > 2}
    transcript_tokens = {token.casefold() for token in re.findall(r"\w+", transcript, re.UNICODE)}
    if not value_tokens:
        return False
    return len(value_tokens & transcript_tokens) / len(value_tokens) >= 0.6


def _apply_transcript_grounding(emr_data: dict, transcript: str) -> dict:
    """Reconcile probabilistic extraction with deterministic transcript evidence."""
    removed: list[str] = []
    explicit_meds = _extract_simple_medications(transcript)
    explicit_investigations = _extract_simple_investigations(transcript)

    grounded_meds: list[dict] = []
    consumed_meds: set[str] = set()
    for med in emr_data.get("medications", []):
        name = med.get("name")
        matching = next((item for item in explicit_meds if _medication_key(item["name"]) == _medication_key(str(name))), None)
        if matching:
            if _medication_key(matching["name"]) in consumed_meds:
                continue
            grounded_meds.append(matching)
            consumed_meds.add(_medication_key(matching["name"]))
            continue
        if not _entity_supported(name, transcript):
            removed.append(f"medication '{name}'")
            continue

        grounded = dict(med)
        if grounded.get("dosage") and not _entity_supported(grounded["dosage"], transcript):
            removed.append(f"unsupported dosage for '{name}'")
            grounded["dosage"] = None
            grounded["confidence"] = "yellow"
        if grounded.get("frequency") and not _entity_supported(grounded["frequency"], transcript):
            removed.append(f"unsupported frequency for '{name}'")
            grounded["frequency"] = None
            grounded["confidence"] = "yellow"
        grounded_meds.append(grounded)

    grounded_meds.extend(item for item in explicit_meds if _medication_key(item["name"]) not in consumed_meds)
    emr_data["medications"] = grounded_meds

    grounded_investigations: list[dict] = []
    consumed_investigations: set[str] = set()
    for investigation in emr_data.get("investigations", []):
        name = investigation.get("name")
        matching = next((item for item in explicit_investigations if _investigation_key(item["name"]) == _investigation_key(str(name))), None)
        if matching:
            if _investigation_key(matching["name"]) in consumed_investigations:
                continue
            grounded_investigations.append(matching)
            consumed_investigations.add(_investigation_key(matching["name"]))
        elif _entity_supported(name, transcript):
            grounded_investigations.append(investigation)
        else:
            removed.append(f"investigation '{name}'")

    grounded_investigations.extend(
        item for item in explicit_investigations if _investigation_key(item["name"]) not in consumed_investigations
    )
    emr_data["investigations"] = grounded_investigations

    diagnosis = emr_data.get("diagnosis", {})
    if diagnosis.get("value") and not _entity_supported(diagnosis.get("value"), transcript):
        removed.append(f"diagnosis '{diagnosis.get('value')}'")
        emr_data["diagnosis"] = {"value": None, "confidence": "blank"}

    ambiguous_tests = [item["name"] for item in explicit_investigations if item["confidence"] == "yellow"]
    if ambiguous_tests:
        emr_data.setdefault("inferenceNotes", []).append(
            "Transcript mentioned these tests without a clear order; doctor confirmation required: " + ", ".join(ambiguous_tests)
        )

    existing_check = emr_data.get("hallucinationCheck", {})
    prior_details = existing_check.get("details") if isinstance(existing_check, dict) else None
    if removed:
        detail = "Grounding removed or cleared unsupported output: " + "; ".join(removed)
        if prior_details:
            detail = f"{prior_details}; {detail}"
        emr_data["hallucinationCheck"] = {"isHallucinated": True, "details": detail}
        emr_data.setdefault("inferenceNotes", []).append(detail)
    else:
        emr_data["hallucinationCheck"] = {
            "isHallucinated": bool(existing_check.get("isHallucinated", False)) if isinstance(existing_check, dict) else False,
            "details": prior_details,
        }

    return emr_data


def _build_fast_fallback_emr(transcript: str, error: Exception) -> dict:
    """
    Return a minimal but structured EMR quickly when providers are unavailable or too slow.
    This keeps the API responsive for local development.
    """
    emr = _get_default_emr()
    cleaned_transcript = transcript.strip()
    first_sentence = re.split(r"(?<=[.!?])\s+", cleaned_transcript, maxsplit=1)[0].strip() if cleaned_transcript else ""
    follow_up_match = re.search(
        r"\b(?:follow[\s-]?up|review|come back|return)\s+(?:in|after)\s+(\d+)\s+days?\b",
        cleaned_transcript,
        re.IGNORECASE,
    )
    if first_sentence:
        emr["chiefComplaint"] = {"value": first_sentence, "confidence": "green"}
        emr["hpi"] = {"value": cleaned_transcript, "confidence": "green"}

    # Symptoms belong in the history. A fallback must never promote them into
    # a diagnosis unless a clinician explicitly supplied one.

    medications = _extract_simple_medications(cleaned_transcript)
    if medications:
        emr["medications"] = medications

    investigations = _extract_simple_investigations(cleaned_transcript)
    if investigations:
        emr["investigations"] = investigations

    if follow_up_match:
        emr["followUpDays"] = {"value": int(follow_up_match.group(1)), "confidence": "yellow"}
        emr["inferenceNotes"].append("Fast fallback inferred follow-up timing from explicit follow-up language in the transcript.")

    emr["mode"] = "fallback"
    emr["modelAttempted"] = OLLAMA_MODEL
    emr["promptProfile"] = OLLAMA_PROMPT_PROFILE
    emr["providerChain"] = [
        "ollama",
        "openai" if ENABLE_OPENAI_FALLBACK else None,
        "blackbox" if ENABLE_BLACKBOX_FALLBACK else None,
        "anthropic" if ENABLE_ANTHROPIC_FALLBACK else None,
        "fast_regex",
    ]
    emr["providerChain"] = [provider for provider in emr["providerChain"] if provider]
    emr["_extractionError"] = str(error)
    emr["_fallbackMode"] = "fast_regex"
    return emr


def _get_default_safety() -> dict:
    """Structured fallback when Agent 2 fails."""
    return {
        "safetyFlags": [],
        "overallSafetyStatus": "unchecked",
        "checkedAt": datetime.now().isoformat()
    }


# ═══════════════════════════════════════════════════════════════════════════════
# PUBLIC API — Called by routers
# ═══════════════════════════════════════════════════════════════════════════════

def generate_emr_from_transcript(transcript: str) -> dict:
    """
    AGENT 1 + AGENT 2 pipeline.
    Returns confidence-annotated EMR + safety check results.
    Gracefully degrades if either agent fails.
    """
    start = time.time()

    # ── Agent 1: Extractor ──
    logger.info("[Pipeline] Agent 1 — Extracting structured EMR with confidence tags...")
    try:
        emr_data = _call_llm(
            _get_prompt_variant(EXTRACTOR_PROMPT, EXTRACTOR_PROMPT_COMPACT),
            f"CONSULTATION TRANSCRIPT:\n\n{transcript}"
        )
        # Validate critical fields exist — merge defaults for any missing
        defaults = _get_default_emr()
        for key, default_val in defaults.items():
            if key not in emr_data:
                emr_data[key] = default_val
        emr_data["mode"] = "llm"
        emr_data["modelAttempted"] = OLLAMA_MODEL
        emr_data["promptProfile"] = OLLAMA_PROMPT_PROFILE
        emr_data["providerChain"] = [
            "ollama",
            "openai" if ENABLE_OPENAI_FALLBACK else None,
            "blackbox" if ENABLE_BLACKBOX_FALLBACK else None,
            "anthropic" if ENABLE_ANTHROPIC_FALLBACK else None,
        ]
        emr_data["providerChain"] = [provider for provider in emr_data["providerChain"] if provider]
    except Exception as e:
        logger.error(f"[Pipeline] Agent 1 FAILED: {e}")
        emr_data = _build_fast_fallback_emr(transcript, e)

    emr_data = _sanitize_emr_shape(emr_data)
    emr_data = _apply_transcript_grounding(emr_data, transcript)

    agent1_time = time.time() - start
    logger.info(f"[Pipeline] Agent 1 completed in {agent1_time:.1f}s")

    # ── Agent 2: Safety Checker ──
    if emr_data.get("_fallbackMode") == "fast_regex":
        logger.info("[Pipeline] Skipping Agent 2 because fast fallback mode is active.")
        safety_result = _get_default_safety()
        total_time = time.time() - start
        emr_data["safetyCheck"] = safety_result
        emr_data["pipelineVersion"] = "3-agent-v1.2-grounded"
        emr_data["agentsCompleted"] = ["extractor"]
        emr_data["pipelineTimeSecs"] = round(total_time, 1)
        logger.info(f"[Pipeline] Complete in {total_time:.1f}s | Safety: {safety_result.get('overallSafetyStatus', 'unknown')}")
        return emr_data

    logger.info("[Pipeline] Agent 2 — Running safety checks on extracted EMR...")
    try:
        safety_input = {
            "medications": emr_data.get("medications", []),
            "allergies": emr_data.get("allergies", {}),
            "pastHistory": emr_data.get("pastHistory", {}),
            "examFindings": emr_data.get("examFindings", {}),
            "diagnosis": emr_data.get("diagnosis", {}),
        }
        safety_result = _call_llm(
            _get_prompt_variant(SAFETY_CHECKER_PROMPT, SAFETY_CHECKER_PROMPT_COMPACT),
            f"EMR DATA TO CHECK:\n\n{json.dumps(safety_input, indent=2, ensure_ascii=False)}"
        )
    except Exception as e:
        logger.warning(f"[Pipeline] Agent 2 failed (non-fatal): {e}")
        safety_result = _get_default_safety()

    total_time = time.time() - start

    # Merge into final response
    emr_data["safetyCheck"] = safety_result
    emr_data["pipelineVersion"] = "3-agent-v1.2-grounded"
    emr_data["agentsCompleted"] = ["extractor", "safety_checker"]
    emr_data["pipelineTimeSecs"] = round(total_time, 1)

    logger.info(f"[Pipeline] Complete in {total_time:.1f}s | Safety: {safety_result.get('overallSafetyStatus', 'unknown')}")
    return emr_data


def generate_hindi_summary(approved_emr: dict) -> dict:
    """
    AGENT 3 — Hindi Summarizer.
    Called ONLY after doctor approval (commit-on-approval).
    """
    logger.info("[Pipeline] Agent 3 — Generating patient-facing Hindi summary...")
    start = time.time()

    # Only send relevant fields to Agent 3 (no need for hallucinationCheck etc.)
    summary_input = {
        "diagnosis": approved_emr.get("diagnosis", {}),
        "medications": approved_emr.get("medications", []),
        "plan": approved_emr.get("plan", {}),
        "followUpDays": approved_emr.get("followUpDays", {}),
        "allergies": approved_emr.get("allergies", {}),
    }

    try:
        result = _call_llm(
            HINDI_SUMMARIZER_PROMPT,
            f"APPROVED EMR:\n\n{json.dumps(summary_input, indent=2, ensure_ascii=False)}"
        )
        logger.info(f"[Pipeline] Agent 3 completed in {time.time() - start:.1f}s")
        return result
    except Exception as e:
        logger.error(f"[Pipeline] Agent 3 FAILED: {e}")
        return {
            "patientSummary": {
                "diagnosisSimple": "Summary generation failed — please explain verbally.",
                "medicationInstructions": [],
                "followUpNote": "",
                "generalAdvice": ""
            }
        }
