"""
Fine-tune runner for GPT-4o-mini.
"""

import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from openai import OpenAI
from services.transcription import ai_settings

try:
    from evaluation.mediscribe_schema import (
        DEFAULT_MODEL_OUTPUT_FILE,
        DEFAULT_TRAIN_FILE,
        DEFAULT_VAL_FILE,
    )
except ImportError:
    from mediscribe_schema import (
        DEFAULT_MODEL_OUTPUT_FILE,
        DEFAULT_TRAIN_FILE,
        DEFAULT_VAL_FILE,
    )

openai_client = OpenAI(api_key=ai_settings.OPENAI_API_KEY)

MODEL_OUTPUT_FILE = DEFAULT_MODEL_OUTPUT_FILE


def _has_configured_openai_key() -> bool:
    api_key = (ai_settings.OPENAI_API_KEY or "").strip()
    return api_key not in {"", "placeholder-dev", "sk-placeholder-dev"}


def validate_finetune_runner_configuration(train_file: str, val_file: str):
    """Fail early when inputs or credentials are missing."""
    missing_files = [path for path in [train_file, val_file] if not os.path.exists(path)]
    if missing_files:
        raise FileNotFoundError(
            "[FT Runner] Missing training file(s): " + ", ".join(missing_files)
        )

    if _has_configured_openai_key():
        return

    raise RuntimeError(
        "[FT Runner] Missing OpenAI API key. Set OPENAI_API_KEY in backend/.env "
        "before launching fine-tuning."
    )


def upload_file(file_path: str, purpose: str = "fine-tune") -> str:
    """Upload a JSONL file to OpenAI and return its file ID."""
    print(f"[FT Runner] Uploading {file_path}...")
    with open(file_path, "rb") as f:
        response = openai_client.files.create(file=f, purpose=purpose)
    file_id = response.id
    print(f"[FT Runner] Uploaded: {file_id}")
    return file_id


def launch_finetune(train_file_id: str, val_file_id: str, suffix: str = "mediscribe") -> str:
    """Launch a GPT-4o-mini fine-tune job and return the job ID."""
    print("[FT Runner] Launching fine-tune job...")
    job = openai_client.fine_tuning.jobs.create(
        training_file=train_file_id,
        validation_file=val_file_id,
        model="gpt-4o-mini-2024-07-18",
        suffix=suffix,
        hyperparameters={
            "n_epochs": 3,
            "batch_size": 4,
            "learning_rate_multiplier": 1.8,
        },
    )
    print(f"[FT Runner] Job launched: {job.id}")
    print(f"[FT Runner] Status: {job.status}")
    return job.id


def monitor_job(job_id: str, poll_interval: int = 60) -> dict:
    """Poll the fine-tune job until completion."""
    print(f"\n[FT Runner] Monitoring job {job_id}")
    print(f"[FT Runner] Polling every {poll_interval}s (this usually takes 20-60 minutes)...")
    print("[FT Runner] You can close this and check back - job runs on OpenAI servers\n")

    start_time = time.time()
    while True:
        job = openai_client.fine_tuning.jobs.retrieve(job_id)
        elapsed = int(time.time() - start_time)
        print(f"  [{elapsed // 60}m {elapsed % 60}s] Status: {job.status}", end="")
        if job.trained_tokens:
            print(f" | Tokens trained: {job.trained_tokens:,}", end="")
        print()

        if job.status == "succeeded":
            print("\n[FT Runner] Fine-tuning COMPLETE")
            print(f"[FT Runner] Model ID: {job.fine_tuned_model}")
            return job

        if job.status in ("failed", "cancelled"):
            print(f"\n[FT Runner] Job {job.status}")
            if job.error:
                print(f"[FT Runner] Error: {job.error}")
            return job

        try:
            events = openai_client.fine_tuning.jobs.list_events(fine_tuning_job_id=job_id, limit=3)
            for event in reversed(events.data):
                if event.message and "loss" in event.message.lower():
                    print(f"  [event] {event.message}")
        except Exception:
            pass

        time.sleep(poll_interval)


def save_model_id(job, output_file: str = MODEL_OUTPUT_FILE):
    """Save the completed model ID for production use."""
    result = {
        "model_id": job.fine_tuned_model,
        "job_id": job.id,
        "status": job.status,
        "trained_tokens": job.trained_tokens,
        "base_model": "gpt-4o-mini-2024-07-18",
    }
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"[FT Runner] Model info saved to {output_file}")
    return result


def run_finetune(train_file: str, val_file: str, monitor: bool = True):
    """Full pipeline: upload, launch, optionally monitor, and save."""
    validate_finetune_runner_configuration(train_file, val_file)
    train_id = upload_file(train_file)
    val_id = upload_file(val_file)
    job_id = launch_finetune(train_id, val_id)

    if not monitor:
        print(f"\n[FT Runner] Job launched. Run with --check {job_id} to monitor later.")
        print("[FT Runner] Or check https://platform.openai.com/finetune")
        return {"job_id": job_id}

    job = monitor_job(job_id)
    if job.status == "succeeded":
        result = save_model_id(job)
        print(f"\n{'=' * 55}")
        print("  FINE-TUNING COMPLETE")
        print(f"{'=' * 55}")
        print(f"  Model ID: {result['model_id']}")
        print(f"  Trained tokens: {result['trained_tokens']:,}")
        print("\n  Next step: python -m evaluation.benchmark")
        print(f"{'=' * 55}")
        return result

    return {"job_id": job_id, "status": job.status}


def check_job(job_id: str):
    """Check status of an existing fine-tune job."""
    job = openai_client.fine_tuning.jobs.retrieve(job_id)
    print(f"Job ID     : {job.id}")
    print(f"Status     : {job.status}")
    print(f"Model      : {job.fine_tuned_model or 'not ready'}")
    print(f"Tokens     : {job.trained_tokens or 'N/A'}")

    if job.status == "succeeded" and job.fine_tuned_model:
        save_model_id(job)

    return job


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fine-tune GPT-4o-mini on clinical data")
    parser.add_argument("--train", type=str, default=DEFAULT_TRAIN_FILE, help="Training JSONL file")
    parser.add_argument("--val", type=str, default=DEFAULT_VAL_FILE, help="Validation JSONL file")
    parser.add_argument("--no-monitor", action="store_true", help="Launch job without monitoring")
    parser.add_argument("--check", type=str, help="Check status of existing job ID")
    args = parser.parse_args()

    if args.check:
        check_job(args.check)
    else:
        run_finetune(
            train_file=args.train,
            val_file=args.val,
            monitor=not args.no_monitor,
        )
