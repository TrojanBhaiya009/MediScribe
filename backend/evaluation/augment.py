"""
Data Augmentor
Expands the Eka dataset into a larger fine-tuning corpus.
"""

import argparse
import json
import os
import sys
import time
from typing import Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from anthropic import Anthropic
from services.transcription import ai_settings

try:
    from evaluation.mediscribe_schema import (
        CLINICAL_PERSONA,
        DEFAULT_AUGMENTED_FILE,
        MEDISCRIBE_SCHEMA_TEXT,
        normalize_ground_truth,
    )
except ImportError:
    from mediscribe_schema import (
        CLINICAL_PERSONA,
        DEFAULT_AUGMENTED_FILE,
        MEDISCRIBE_SCHEMA_TEXT,
        normalize_ground_truth,
    )

client = Anthropic(api_key=ai_settings.ANTHROPIC_API_KEY)

AUGMENTATION_TYPES = ["rephrase", "hindi_mix", "marathi_mix", "severity", "demographic"]

AUGMENT_SYSTEM = f"""{CLINICAL_PERSONA}
You will receive a doctor-patient transcript and its structured EMR.
Generate one augmented transcript plus matching ground truth in the exact MediScribe schema below.

STRICT OUTPUT FORMAT:
Return ONLY valid JSON with keys "transcript" and "ground_truth".
The ground_truth object must already use the final camelCase schema.

MediScribe schema:
{MEDISCRIBE_SCHEMA_TEXT}

CRITICAL RULES:
1. Keep the same underlying medical condition and consultation intent unless the augmentation request explicitly changes severity or demographic details.
2. Ground truth must accurately reflect the new transcript.
3. The transcript may sound like natural Indian clinical speech, including Hinglish or Marathi-English mixing when requested, but ground truth must stay in professional English.
4. Do not use placeholders in diseaseRisk. Estimate all five probabilities from transcript evidence on a 0.0-1.0 scale and keep them clinically plausible.
5. hallucinationCheck should usually remain false with high confidence because the transcript and ground truth must match.
6. Return no markdown fences, no preamble, and no extra keys.
"""

AUGMENT_PROMPTS = {
    "rephrase": """Rewrite the transcript with different but natural phrasing.
Change how the doctor asks questions and how the patient describes symptoms.
Keep all medical facts identical. Ground truth should stay semantically the same.""",
    "hindi_mix": """Rewrite the transcript mixing natural Hindi words into the conversation.
Patient should speak in Hinglish as real patients do.
Doctor can use some Hindi too. Examples: "sir dard", "bukhaar", "pet mein dard", "aaram karo".""",
    "marathi_mix": """Rewrite the transcript mixing natural Marathi words.
Examples: "dukhtay", "thakwa", "taap", "kasa watato".
Patient speaks in Marathi-English mix. Doctor responds naturally.""",
    "severity": """Change the severity of the main symptom and adjust duration slightly if needed.
Update any affected clinical fields such as hpi, examFindings, diagnosis, plan, followUpDays, and diseaseRisk.""",
    "demographic": """Change the patient demographic details such as age group, gender, or city/background references.
Update any ground-truth details that should reasonably change, such as dosing or follow-up advice.""",
}


def _has_configured_anthropic_key() -> bool:
    api_key = (ai_settings.ANTHROPIC_API_KEY or "").strip()
    return api_key not in {"", "placeholder-dev", "sk-ant-placeholder-dev"}


def validate_augmentor_configuration():
    """Fail early when Anthropic credentials are missing."""
    if _has_configured_anthropic_key():
        return

    raise RuntimeError(
        "[Augmentor] Missing Anthropic API key. Set ANTHROPIC_API_KEY in "
        "backend/.env before running augmentation."
    )


def augment_single(transcript: str, ground_truth: dict, aug_type: str) -> Optional[dict]:
    """Generate one augmented sample."""
    normalized_ground_truth = normalize_ground_truth(ground_truth)
    prompt = f"""Augmentation type: {aug_type}

Task instructions:
{AUGMENT_PROMPTS[aug_type]}

Original transcript:
{transcript}

Original ground_truth:
{json.dumps(normalized_ground_truth, indent=2)}

Return JSON with keys "transcript" and "ground_truth" only."""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            temperature=0.7,
            system=AUGMENT_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text
        start = text.find("{")
        end = text.rfind("}") + 1
        if start == -1 or end == 0:
            return None

        result = json.loads(text[start:end])
        if "transcript" not in result or "ground_truth" not in result:
            return None

        result["transcript"] = str(result.get("transcript", "")).strip()
        if not result["transcript"]:
            return None

        result["ground_truth"] = normalize_ground_truth(result["ground_truth"])
        result["augmentation_type"] = aug_type
        result["source"] = "augmented"
        return result
    except Exception as e:
        print(f"    [!] Augmentation failed ({aug_type}): {e}")
        return None


def load_eka_dataset(num_samples: int) -> list:
    """Load from HuggingFace or use sample data."""
    try:
        from datasets import load_dataset

        print(f"[Augmentor] Loading {num_samples} Eka dataset samples...")
        ds = load_dataset(
            "ekacare/clinical_note_generation_dataset",
            split="train",
            trust_remote_code=True,
        )
        return list(ds.select(range(min(num_samples, len(ds)))))
    except Exception as e:
        print(f"[Augmentor] HuggingFace load failed: {e}")
        print("[Augmentor] Using built-in samples for demonstration...")
        return _builtin_samples()


def _builtin_samples() -> list:
    """Minimal built-in samples to demonstrate augmentation."""
    return [
        {
            "transcript": "Doctor: What's the problem? Patient: Fever since yesterday, 101F. Dry cough and sore throat. Doctor: Any allergies? Patient: No. Doctor: Throat congested, chest clear. Viral URTI. Paracetamol 500mg TDS, cough syrup TDS. Return in 3 days if no improvement.",
            "chief_complaint": "Fever with sore throat and cough",
            "history_of_present_illness": "Fever 101F since yesterday; dry cough; sore throat",
            "diagnosis": "Viral upper respiratory tract infection",
            "plan": "Paracetamol 500mg TDS; cough syrup TDS; rest; review in 3 days",
            "medications": "Paracetamol 500mg, Cough syrup",
            "examination_findings": "Throat congested; chest clear",
            "past_history": None,
            "allergies": "NKDA",
        },
        {
            "transcript": "Doctor: Kya problem hai? Patient: Sir dard bahut tez, kal se, right side. Doctor: Nausea? Patient: Haan. Light se problem. Doctor: BP 124/80. Migraine hai. Sumatriptan do. 7 din baad aao.",
            "chief_complaint": "Right-sided headache",
            "history_of_present_illness": "Right-sided throbbing headache since yesterday; nausea; photophobia",
            "diagnosis": "Migraine without aura",
            "plan": "Sumatriptan 50mg at onset; rest in dark room; follow up 7 days",
            "medications": "Sumatriptan 50mg",
            "examination_findings": "BP 124/80 mmHg",
            "past_history": None,
            "allergies": None,
        },
    ]


def run_augmentation(num_samples: int = 156, output_file: str = DEFAULT_AUGMENTED_FILE):
    """Generate roughly 5x input samples using multiple augmentation strategies."""
    validate_augmentor_configuration()
    raw_samples = load_eka_dataset(num_samples)
    print(f"[Augmentor] Loaded {len(raw_samples)} original samples")

    augmented = []
    generated = 0
    failed = 0

    for i, sample in enumerate(raw_samples):
        transcript = sample.get("transcript") or sample.get("conversation", "")
        ground_truth = normalize_ground_truth({k: v for k, v in sample.items() if k != "transcript"})

        if not transcript.strip():
            continue

        print(f"\n[{i + 1}/{len(raw_samples)}] Original sample - generating {len(AUGMENTATION_TYPES)} variants...")

        augmented.append(
            {
                "transcript": transcript,
                "ground_truth": ground_truth,
                "augmentation_type": "original",
                "source": "eka_dataset",
            }
        )

        for aug_type in AUGMENTATION_TYPES:
            print(f"  -> {aug_type}...", end=" ", flush=True)
            result = augment_single(transcript, ground_truth, aug_type)

            if result:
                augmented.append(result)
                generated += 1
                print("OK")
            else:
                failed += 1
                print("FAIL")

            time.sleep(1.2)

        if (i + 1) % 10 == 0:
            checkpoint = output_file.replace(".json", f"_checkpoint_{i + 1}.json")
            with open(checkpoint, "w", encoding="utf-8") as f:
                json.dump(augmented, f, indent=2, ensure_ascii=False)
            print(f"\n  [Checkpoint saved: {len(augmented)} samples -> {checkpoint}]")

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(augmented, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 55}")
    print("  AUGMENTATION COMPLETE")
    print(f"{'=' * 55}")
    print(f"  Original samples    : {len(raw_samples)}")
    print(f"  Augmented generated : {generated}")
    print(f"  Failed              : {failed}")
    print(f"  Total dataset size  : {len(augmented)}")
    print(f"  Output file         : {output_file}")
    print(f"{'=' * 55}")
    print(f"\n  Next step: python -m evaluation.finetune_prep --input {output_file}")

    return augmented


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Augment Eka dataset for fine-tuning")
    parser.add_argument("--samples", type=int, default=156, help="Number of original samples to augment")
    parser.add_argument("--output", type=str, default=DEFAULT_AUGMENTED_FILE)
    args = parser.parse_args()
    run_augmentation(num_samples=args.samples, output_file=args.output)
