import os
from openai import OpenAI
from pydantic_settings import BaseSettings, SettingsConfigDict

class AISettings(BaseSettings):
    GROQ_API_KEY: str = ""
    OPENAI_API_KEY: str = "placeholder-dev"
    ANTHROPIC_API_KEY: str = "placeholder-dev"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

ai_settings = AISettings()

# Use Groq Whisper for transcription (free, fast)
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GROQ_WHISPER_MODEL = "whisper-large-v3-turbo"

if ai_settings.GROQ_API_KEY and ai_settings.GROQ_API_KEY not in ("", "placeholder-dev"):
    client = OpenAI(api_key=ai_settings.GROQ_API_KEY, base_url=GROQ_BASE_URL)
    _whisper_model = GROQ_WHISPER_MODEL
    print(f"[Transcription] Using Groq Whisper ({GROQ_WHISPER_MODEL})")
elif ai_settings.OPENAI_API_KEY and ai_settings.OPENAI_API_KEY not in ("", "placeholder-dev"):
    client = OpenAI(api_key=ai_settings.OPENAI_API_KEY)
    _whisper_model = "whisper-1"
    print(f"[Transcription] Using OpenAI Whisper (whisper-1)")
else:
    client = None
    _whisper_model = None
    print(f"[Transcription] WARNING — No API key configured for transcription")

def transcribe_audio(file_path: str, language: str = None) -> str:
    """
    Transcribes audio file using Groq Whisper API (or OpenAI Whisper fallback).
    """
    if client is None:
        raise RuntimeError("Transcription not available. Set GROQ_API_KEY in backend/.env")
    try:
        with open(file_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model=_whisper_model,
                file=audio_file,
                language=language,
                prompt="Medical consultation. Common terms: Paracetamol, Ibuprofen, Crocin, Dolo, fever, cough, pain, BP, sugar, diabetes, prescription, symptoms, diagnosis, medicine, tablets, capsules."
            )
        
        # Filter common Whisper silence hallucinations
        text = transcript.text.strip()
        lower_text = text.lower()
        
        # Reject empty / punctuation-only results
        stripped = lower_text.strip().strip('.!,?-_ ')
        if not stripped:
            return ""
        
        # ── Foreign script detection ──
        import re
        foreign_scripts = re.compile(
            r'[\u3000-\u9fff'
            r'\uac00-\ud7af'
            r'\u0400-\u04ff'
            r'\u0600-\u06ff'
            r'\u0e00-\u0e7f'
            r']'
        )
        if foreign_scripts.search(text):
            return ""
        
        # Only filter obvious hallucinations, not legitimate medical speech
        obvious_hallucinations = [
            "thank you for watching",
            "thanks for watching",
            "subscribe",
            "my channel",
            "like and share",
            "amara.org",
            "subtitle",
            "closed captions",
        ]
        
        for kw in obvious_hallucinations:
            if kw in lower_text:
                return ""
        
        # ── Repetition detector ──
        words = stripped.split()
        if len(words) >= 4:
            from collections import Counter
            word_counts = Counter(words)
            most_common_count = word_counts.most_common(1)[0][1]
            if most_common_count / len(words) > 0.65:
                return ""
        
        # Only reject very short exact matches
        silence_hallucinations = {
            "thank you", "thanks", "you", "bye", ".", "..", "..."
        }
        if stripped in silence_hallucinations and len(text) < 15:
            return ""
            
        return text
    except Exception as e:
        print(f"Error in transcription: {e}")
        raise e
