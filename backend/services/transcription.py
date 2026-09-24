"""
Transcription Service — NVIDIA Riva Whisper Large v3
────────────────────────────────────────────────────────
Unified transcription interface using NVIDIA Riva ASR (Whisper Large v3) via gRPC.
This is the single transcription provider for the MediScribe pipeline.
"""

import asyncio
from services.nvidia_transcription import get_nvidia_service


async def transcribe_audio(file_path: str, language: str = None) -> str:
    """
    Transcribe audio file using NVIDIA Riva Whisper Large v3.
    
    Args:
        file_path: Path to audio file (WAV/PCM)
        language: Language code (en, hi, auto, multi for Hinglish)
    
    Returns:
        Transcription text
    """
    service = get_nvidia_service()
    
    if not service.is_available():
        raise RuntimeError(
            "NVIDIA Riva ASR not available. "
            "Set NVIDIA_API_KEY in backend/.env (get key at https://build.nvidia.com/)"
        )
    
    try:
        transcript = await service.transcribe_file(file_path, language or "auto")
        return transcript
    except Exception as e:
        print(f"[Transcription] Error: {e}")
        raise
