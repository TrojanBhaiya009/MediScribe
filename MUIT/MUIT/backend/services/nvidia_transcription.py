"""
ASR Transcription Service (Groq Whisper)
─────────────────────────────────────────
Provides speech-to-text transcription using Groq's Whisper API.
Groq offers free, fast Whisper transcription via an OpenAI-compatible API.

The WebSocket streaming architecture remains the same:
  Frontend mic → WebSocket → accumulate chunks → Groq Whisper → text back
"""

import io
import struct
import asyncio
from typing import Optional, List
from pydantic_settings import BaseSettings, SettingsConfigDict
from openai import OpenAI


class ASRSettings(BaseSettings):
    """Settings for ASR integration."""
    GROQ_API_KEY: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


asr_settings = ASRSettings()

# Groq Whisper configuration
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GROQ_WHISPER_MODEL = "whisper-large-v3-turbo"
DEFAULT_MEDICAL_PROMPT = (
    "Medical consultation recording. Common terms include: fever, cough, pain, headache, "
    "nausea, vomiting, diarrhea, BP (blood pressure), sugar (glucose), diabetes, hypertension, "
    "Paracetamol, Ibuprofen, Crocin, Dolo, antibiotics, prescription, diagnosis, symptoms, "
    "vitals, temperature, pulse, medication, tablets, capsules, syrup, injection, test, "
    "X-ray, scan, report. Transcribe all speech accurately including incomplete sentences."
)


class NvidiaTranscriptionService:
    """
    ASR transcription service using Groq Whisper API.

    Class name kept as NvidiaTranscriptionService for backward compatibility
    with existing router imports. Internally uses Groq Whisper.
    """

    def __init__(self):
        self.api_key = asr_settings.GROQ_API_KEY
        self._client: Optional[OpenAI] = None
        self._audio_buffer: List[bytes] = []

        # For backward compat — these attrs are read by the router
        self.model = GROQ_WHISPER_MODEL
        self.api_url = f"{GROQ_BASE_URL}/audio/transcriptions"

        if self.api_key and self.api_key not in ("", "placeholder-dev"):
            self._client = OpenAI(
                api_key=self.api_key,
                base_url=GROQ_BASE_URL,
            )
            print(f"[ASR] Initialized — engine: Groq Whisper ({GROQ_WHISPER_MODEL})")
            print(f"[ASR] API Key configured: True (prefix: {self.api_key[:8]}...)")
        else:
            print(f"[ASR] WARNING — GROQ_API_KEY not set. ASR will not work.")
            print(f"[ASR] Set GROQ_API_KEY in backend/.env (free at console.groq.com)")

    def is_available(self) -> bool:
        """Check if ASR service is available and configured."""
        return self._client is not None

    def add_audio_chunk(self, chunk: bytes):
        """Add audio chunk to buffer for batch processing."""
        self._audio_buffer.append(chunk)

    def clear_buffer(self):
        """Clear the audio buffer."""
        self._audio_buffer = []

    def get_buffer_size(self) -> int:
        """Get total bytes in buffer."""
        return sum(len(chunk) for chunk in self._audio_buffer)

    async def transcribe_audio_bytes(
        self,
        audio_bytes: bytes,
        language: str = "en",
        prompt: Optional[str] = None,
    ) -> str:
        """
        Transcribe audio bytes using Groq Whisper API.

        Args:
            audio_bytes: Raw PCM audio bytes (16-bit, mono, 16kHz)
            language: Language code (e.g., 'en', 'hi', 'es')

        Returns:
            Transcription text
        """
        if not self.is_available():
            raise RuntimeError("ASR not available. Set GROQ_API_KEY in backend/.env (free at console.groq.com)")

        # Create WAV from raw PCM
        wav_bytes = self._create_wav(audio_bytes, sample_rate=16000)

        print(f"[ASR] Transcribing {len(audio_bytes)} bytes of audio "
              f"(WAV: {len(wav_bytes)} bytes), language={language}")

        try:
            # Whisper API expects a file-like object
            audio_file = io.BytesIO(wav_bytes)
            audio_file.name = "audio.wav"

            # Run the synchronous OpenAI-compatible call in a thread
            transcript = await asyncio.to_thread(
                self._call_whisper, audio_file, language, prompt
            )

            print(f"[ASR] Transcript: '{transcript[:100]}'" if transcript else "[ASR] Empty transcript")
            return transcript

        except Exception as e:
            error_msg = str(e)
            print(f"[ASR] Transcription error: {error_msg}")

            if "401" in error_msg or "Unauthorized" in error_msg or "invalid_api_key" in error_msg:
                raise RuntimeError("Groq API key is invalid or expired. Get a new one at console.groq.com")
            elif "429" in error_msg or "rate_limit" in error_msg:
                raise RuntimeError("Groq API rate limit hit. Wait a moment and try again (free tier: 20 req/min).")
            elif "insufficient_quota" in error_msg:
                raise RuntimeError("Groq API quota exceeded. Check your usage at console.groq.com")
            else:
                raise RuntimeError(f"Whisper transcription failed: {error_msg}")

    def build_prompt(self, recent_transcript: str = "") -> str:
        recent_transcript = " ".join(recent_transcript.split()).strip()
        if not recent_transcript:
            return DEFAULT_MEDICAL_PROMPT

        recent_words = recent_transcript.split()
        if len(recent_words) > 80:
            recent_transcript = " ".join(recent_words[-80:])

        return (
            f"{DEFAULT_MEDICAL_PROMPT} "
            f"Continue from: {recent_transcript}"
        )

    def _call_whisper(self, audio_file: io.BytesIO, language: str, prompt: Optional[str]) -> str:
        """Synchronous call to Groq Whisper API (OpenAI-compatible)."""
        # Map short language codes
        lang_map = {
            "en": "en",
            "hi": "hi",
            "es": "es",
            "fr": "fr",
            "de": "de",
            "ja": "ja",
            "zh": "zh",
            "ko": "ko",
            "pt": "pt",
            "ru": "ru",
            "ar": "ar",
        }
        whisper_lang = lang_map.get(language, language)

        result = self._client.audio.transcriptions.create(
            model=GROQ_WHISPER_MODEL,
            file=audio_file,
            language=whisper_lang,
            response_format="verbose_json",
            temperature=0.0,
            prompt=prompt or DEFAULT_MEDICAL_PROMPT,
        )

        # verbose_json returns an object with .text
        if isinstance(result, str):
            return result.strip()
        text = getattr(result, "text", str(result)).strip()
        
        # Filter out hallucinated silence transcripts & prompt bleed-through
        lower_text = text.lower()
        
        # Only reject if the entire transcript matches these patterns
        silence_hallucinations = {
            "thank you", "thanks", "you", ".", "..", "...", "thank you.",
            "thanks.", "bye.", "bye"
        }
        
        # Only reject very short, exact matches to silence hallucinations
        if lower_text.strip().rstrip('.') in silence_hallucinations and len(text) < 15:
            return ""
        
        # Filter obvious hallucinations but don't be too aggressive
        if "amara.org" in lower_text or "subtitle by" in lower_text:
            return ""
            
        return text

    async def transcribe_buffer(self, language: str = "en") -> str:
        """Transcribe accumulated audio buffer and clear it."""
        if not self._audio_buffer:
            return ""

        audio_bytes = b''.join(self._audio_buffer)
        self.clear_buffer()

        return await self.transcribe_audio_bytes(audio_bytes, language)

    def _create_wav(
        self,
        pcm_data: bytes,
        sample_rate: int = 16000,
        channels: int = 1,
        bits_per_sample: int = 16,
    ) -> bytes:
        """Create a WAV file from raw PCM data."""
        byte_rate = sample_rate * channels * bits_per_sample // 8
        block_align = channels * bits_per_sample // 8
        data_size = len(pcm_data)

        header = struct.pack(
            '<4sI4s4sIHHIIHH4sI',
            b'RIFF',
            36 + data_size,
            b'WAVE',
            b'fmt ',
            16,              # Subchunk1Size (PCM)
            1,               # AudioFormat (PCM)
            channels,
            sample_rate,
            byte_rate,
            block_align,
            bits_per_sample,
            b'data',
            data_size,
        )

        return header + pcm_data

    async def transcribe_file(self, file_path: str, language: str = "en") -> str:
        """
        Transcribe an audio file.

        Args:
            file_path: Path to audio file
            language: Language code

        Returns:
            Transcription text
        """
        if not self.is_available():
            raise RuntimeError("ASR not available. Set GROQ_API_KEY in backend/.env")

        with open(file_path, "rb") as f:
            audio_bytes = f.read()

        return await self.transcribe_audio_bytes(audio_bytes, language)


# Singleton instance
nvidia_transcription_service = NvidiaTranscriptionService()


def get_nvidia_service() -> NvidiaTranscriptionService:
    """Get the ASR transcription service instance."""
    return nvidia_transcription_service
