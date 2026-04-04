"""
Fine-tune data preparation for MediScribe.
"""

import argparse
import json
import os
import random
import sys
from typing import Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

try:
    from evaluation.mediscribe_schema import (
        DEFAULT_STATS_FILE,
        DEFAULT_TRAIN_FILE,
        DEFAULT_VAL_FILE,
        FINETUNE_SYSTEM_PROMPT,
        has_nonzero_risk,
        normalize_ground_truth,
        total_risk_intensity,
    )
except ImportError:
    from mediscribe_schema import (
        DEFAULT_STATS_FILE,
        DEFAULT_TRAIN_FILE,
        DEFAULT_VAL_FILE,
        FINETUNE_SYSTEM_PROMPT,
        has_nonzero_risk,
        normalize_ground_truth,
        total_risk_intensity,
    )


def sample_to_finetune_row(sample: dict) -> Optional[dict]:
    """Convert one sample to OpenAI fine-tune message format."""
    transcript = sample.get("transcript", "")
    ground_truth = sample.get("ground_truth", {})

    if not transcript.strip():
        return None

    normalized = normalize_ground_truth(ground_truth)
    has_content = any(
        [
            normalized.get("chiefComplaint"),
            normalized.get("diagnosis"),
            normalized.get("hpi"),
        ]
    )
    if not has_content:
        return None

    return {
        "messages": [
            {"role": "system", "content": FINETUNE_SYSTEM_PROMPT},
            {"role": "user", "content": f"Consultation transcript:\n\n{transcript}"},
            {
                "role": "assistant",
                "content": json.dumps(normalized, ensure_ascii=False),
            },
        ]
    }


def estimate_tokens(text: str) -> int:
    """Rough token estimate using ~4 chars per token."""
    return len(text) // 4


def prepare_finetune_data(
    input_file: str,
    train_file: str = DEFAULT_TRAIN_FILE,
    val_file: str = DEFAULT_VAL_FILE,
    stats_file: str = DEFAULT_STATS_FILE,
    val_split: float = 0.2,
    min_samples: int = 10,
):
    print(f"[FT Prep] Loading {input_file}...")
    with open(input_file, encoding="utf-8") as f:
        raw_samples = json.load(f)

    print(f"[FT Prep] Loaded {len(raw_samples)} samples, converting...")

    rows = []
    skipped = 0
    for sample in raw_samples:
        row = sample_to_finetune_row(sample)
        if row:
            rows.append(row)
        else:
            skipped += 1

    print(f"[FT Prep] Converted: {len(rows)} valid | Skipped: {skipped}")

    if len(rows) < min_samples:
        print(f"[FT Prep] WARNING: Only {len(rows)} samples - fine-tuning needs at least {min_samples}")

    random.shuffle(rows)
    split_idx = int(len(rows) * (1 - val_split))
    train_rows = rows[:split_idx]
    val_rows = rows[split_idx:]

    def write_jsonl(path: str, data: list):
        with open(path, "w", encoding="utf-8") as f:
            for row in data:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")

    write_jsonl(train_file, train_rows)
    write_jsonl(val_file, val_rows)

    total_tokens = sum(estimate_tokens(json.dumps(row, ensure_ascii=False)) for row in train_rows)
    estimated_cost = round(total_tokens / 1000 * 0.008, 2)

    risk_samples = 0
    total_risk_score = 0.0
    for row in rows:
        content = json.loads(row["messages"][2]["content"])
        if has_nonzero_risk(content):
            risk_samples += 1
            total_risk_score += total_risk_intensity(content)

    risk_density = round((risk_samples / len(rows)) * 100, 2) if rows else 0.0
    avg_risk_intensity = round(total_risk_score / max(risk_samples, 1), 2)

    stats = {
        "totalSamples": len(rows),
        "trainSamples": len(train_rows),
        "valSamples": len(val_rows),
        "skipped": skipped,
        "estimatedTokens": total_tokens,
        "estimatedCostUSD": estimated_cost,
        "trainFile": train_file,
        "valFile": val_file,
        "clinicalMetrics": {
            "samplesWithRiskData": risk_samples,
            "riskDensityPercentage": risk_density,
            "avgRiskIntensity": avg_risk_intensity,
        },
        "augmentationBreakdown": {},
    }

    for sample in raw_samples:
        aug_type = sample.get("augmentation_type", "unknown")
        stats["augmentationBreakdown"][aug_type] = stats["augmentationBreakdown"].get(aug_type, 0) + 1

    with open(stats_file, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)

    if risk_density == 0.0:
        print("[FT Prep] WARNING: Clinical Density is 0.0% - diseaseRisk learning signal is absent.")

    print(f"\n{'=' * 55}")
    print("  FINE-TUNE DATA READY")
    print(f"{'=' * 55}")
    print(f"  Train samples     : {len(train_rows)}")
    print(f"  Val samples       : {len(val_rows)}")
    print(f"  Estimated tokens  : {total_tokens:,}")
    print(f"  Estimated cost    : ~${estimated_cost}")
    print(f"  Clinical Density  : {risk_density}%")
    print(f"  Train file        : {train_file}")
    print(f"  Val file          : {val_file}")
    print(f"{'=' * 55}")
    print(f"\n  Next step: python -m evaluation.finetune_runner --train {train_file} --val {val_file}")

    return stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prepare fine-tuning data")
    parser.add_argument("--input", type=str, required=True, help="Augmented data JSON file")
    parser.add_argument("--train", type=str, default=DEFAULT_TRAIN_FILE)
    parser.add_argument("--val", type=str, default=DEFAULT_VAL_FILE)
    parser.add_argument("--stats", type=str, default=DEFAULT_STATS_FILE)
    args = parser.parse_args()

    prepare_finetune_data(
        input_file=args.input,
        train_file=args.train,
        val_file=args.val,
        stats_file=args.stats,
    )
