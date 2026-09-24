import os
from typing import Any, Optional

from pydantic import BaseModel

from services.emr_engine import generate_emr_from_transcript, generate_hindi_summary
from services.nvidia_transcription import get_nvidia_service


class TraeCapability(BaseModel):
    key: str
    name: str
    available: bool
    provider: str
    description: str


class TraeAssistResult(BaseModel):
    transcript: str
    emr: dict[str, Any]
    hindi_summary: Optional[dict[str, Any]] = None
    service: str
    mode: str


class TraeService:
    def __init__(self):
        self.name = "MediScribe Trae Service"
        self.version = "1.0.0"

    def get_capabilities(self) -> list[TraeCapability]:
        asr_service = get_nvidia_service()
        hf_model_id = os.getenv("HF_MISTRAL_MODEL", "negi3961/mediscribe-mistral")
        hf_token = os.getenv("HF_API_TOKEN", "").strip()
        emr_provider = f"huggingface:{hf_model_id}" if hf_token else "fallback:emr_engine"

        return [
            TraeCapability(
                key="live_transcription",
                name="Live Medical Transcription",
                available=asr_service.is_available(),
                provider=f"groq:{asr_service.model}",
                description="Streams doctor-patient audio and returns medical-aware speech recognition results.",
            ),
            TraeCapability(
                key="structured_emr",
                name="Structured EMR Extraction",
                available=True,
                provider=emr_provider,
                description="Converts consultation transcripts into structured clinical notes and safety fields.",
            ),
            TraeCapability(
                key="patient_summary",
                name="Patient Summary",
                available=True,
                provider="emr_engine:hindi_summary",
                description="Generates a patient-friendly Hindi-English summary from approved EMR data.",
            ),
        ]

    def get_status(self) -> dict[str, Any]:
        capabilities = self.get_capabilities()
        return {
            "service": self.name,
            "version": self.version,
            "healthy": True,
            "capabilities": [cap.model_dump() for cap in capabilities],
        }

    def assist(
        self,
        transcript: str,
        include_hindi_summary: bool = False,
    ) -> TraeAssistResult:
        cleaned_transcript = transcript.strip()
        if not cleaned_transcript:
            raise ValueError("Transcript cannot be empty")

        emr = generate_emr_from_transcript(cleaned_transcript)
        hindi_summary = generate_hindi_summary(emr) if include_hindi_summary else None

        return TraeAssistResult(
            transcript=cleaned_transcript,
            emr=emr,
            hindi_summary=hindi_summary,
            service=self.name,
            mode="clinical-assist",
        )


trae_service = TraeService()


def get_trae_service() -> TraeService:
    return trae_service
