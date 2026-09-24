"""
Eka Dataset Benchmark Runner.
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.emr_engine import generate_emr_from_transcript
from services.rouge_evaluator import compute_rouge

try:
    from evaluation.mediscribe_schema import (
        DEFAULT_BENCHMARK_OUTPUT_FILE,
        prepare_for_evaluation,
    )
except ImportError:
    from mediscribe_schema import (
        DEFAULT_BENCHMARK_OUTPUT_FILE,
        prepare_for_evaluation,
    )


def load_eka_dataset(num_samples: int = 20):
    """Load samples from the Eka clinical note generation dataset."""
    try:
        from datasets import load_dataset

        print(f"[Benchmark] Loading Eka dataset ({num_samples} samples)...")
        dataset = load_dataset(
            "ekacare/clinical_note_generation_dataset",
            split="train",
            trust_remote_code=True,
        )
        return list(dataset.select(range(min(num_samples, len(dataset)))))
    except Exception as e:
        print(f"[Benchmark] Could not load dataset: {e}")
        print("[Benchmark] Using built-in sample data for demonstration...")
        return _get_sample_data()


def _get_sample_data():
    """Fallback sample data mimicking Eka dataset structure."""
    return [
        {
            "transcript": "Doctor: What brings you in today? Patient: I have a severe headache for 3 days, mainly on the right side. Also feeling nauseous. Doctor: Any sensitivity to light? Patient: Yes, very much. Doctor: You have migraine. I'll prescribe Sumatriptan 50mg. Take it when the pain starts. Follow up in 7 days.",
            "chief_complaint": "Severe headache for 3 days",
            "history_of_present_illness": "Throbbing right-sided headache for 3 days with nausea and photophobia",
            "diagnosis": "Migraine without aura",
            "plan": "Sumatriptan 50mg at onset of pain. Follow up in 7 days.",
            "medications": "Sumatriptan 50mg",
            "examination_findings": None,
            "past_history": None,
            "allergies": None,
        },
        {
            "transcript": "Doctor: Kya takleef hai aapko? Patient: Bukhaar hai teen din se, 101 degree tak. Khaasi bhi hai. Doctor: Gala dekhta hoon. Haan, infection hai. Azithromycin likhta hoon, 500mg ek baar roz paanch din tak. Aur paracetamol bukhaar ke liye.",
            "chief_complaint": "Fever for 3 days with cough",
            "history_of_present_illness": "Fever up to 101°F for 3 days with cough",
            "diagnosis": "Upper respiratory tract infection",
            "plan": "Azithromycin 500mg once daily for 5 days. Paracetamol for fever.",
            "medications": "Azithromycin 500mg, Paracetamol 500mg",
            "examination_findings": "Throat infection noted",
            "past_history": None,
            "allergies": None,
        },
    ]


def run_benchmark(num_samples: int = 20, output_file: str | None = None):
    """Run the benchmark pipeline with normalized text scoring."""
    raw_samples = load_eka_dataset(num_samples)

    print(f"[Benchmark] Running EMR generation on {len(raw_samples)} samples...")
    prepared = []
    rouge1_scores = []
    rouge2_scores = []
    rougeL_scores = []

    for i, sample in enumerate(raw_samples):
        transcript = sample.get("transcript", sample.get("conversation", ""))
        if not transcript:
            continue

        print(f"  [{i + 1}/{len(raw_samples)}] Generating EMR...", end=" ")
        try:
            generated = generate_emr_from_transcript(transcript)
            eval_generated = prepare_for_evaluation(generated)
            eval_ground_truth = prepare_for_evaluation(sample)
            scores = compute_rouge(eval_generated, eval_ground_truth)

            prepared.append(
                {
                    "sample": i + 1,
                    "generated_emr": eval_generated,
                    "ground_truth": eval_ground_truth,
                    "scores": scores,
                }
            )
            rouge1_scores.append(scores["rouge1"])
            rouge2_scores.append(scores["rouge2"])
            rougeL_scores.append(scores["rougeL"])
            print("OK")
        except Exception as e:
            print(f"FAIL ({e})")

    total = len(prepared)
    avg_rouge1 = round(sum(rouge1_scores) / total, 4) if total else 0.0
    avg_rouge2 = round(sum(rouge2_scores) / total, 4) if total else 0.0
    avg_rougeL = round(sum(rougeL_scores) / total, 4) if total else 0.0

    results = {
        "aggregate": {
            "totalSamples": total,
            "avgRouge1": avg_rouge1,
            "avgRouge2": avg_rouge2,
            "avgRougeL": avg_rougeL,
            "benchmark": 0.72,
            "beatsBenchmark": avg_rouge1 > 0.72,
        },
        "samples": prepared,
    }

    agg = results["aggregate"]
    print("\n" + "=" * 50)
    print("  MEDISCRIBE BENCHMARK RESULTS")
    print("=" * 50)
    print(f"  Samples Evaluated : {agg['totalSamples']}")
    print(f"  ROUGE-1 (ours)    : {agg['avgRouge1']:.4f}")
    print(f"  ROUGE-2 (ours)    : {agg['avgRouge2']:.4f}")
    print(f"  ROUGE-L (ours)    : {agg['avgRougeL']:.4f}")
    print(f"  Target Benchmark  : {agg['benchmark']:.4f}")
    print(f"  Beats 0.72?       : {'YES' if agg['beatsBenchmark'] else 'NO'}")
    print("=" * 50)

    if output_file:
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"\n[Benchmark] Full results saved to {output_file}")

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MediScribe ROUGE Benchmark")
    parser.add_argument("--samples", type=int, default=20, help="Number of samples to evaluate")
    parser.add_argument("--output", type=str, default=DEFAULT_BENCHMARK_OUTPUT_FILE)
    args = parser.parse_args()

    run_benchmark(num_samples=args.samples, output_file=args.output)
