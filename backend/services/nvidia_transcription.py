"""
ASR Transcription Service (NVIDIA Riva/NIM Whisper)
───────────────────────────────────────────────────
Provides speech-to-text transcription using NVIDIA Riva ASR service via gRPC.
Uses Whisper large v3 model hosted on NVIDIA NIM (NVIDIA Inference Microservices).

The WebSocket streaming architecture remains the same:
  Frontend mic → WebSocket → accumulate chunks → NVIDIA Riva ASR → text back
"""

import io
import struct
import asyncio
from typing import Optional, List
from pydantic_settings import BaseSettings, SettingsConfigDict

import riva.client
import riva.client.proto.riva_asr_pb2 as rasr
import riva.client.proto.riva_audio_pb2 as raudio
from riva.client.auth import Auth
from riva.client.asr import ASRService


class ASRSettings(BaseSettings):
    """Settings for ASR integration."""
    NVIDIA_API_KEY: str = ""
    NVIDIA_FUNCTION_ID: str = "b702f636-f60c-4a3d-a6f4-f3568c13bd7d"
    NVIDIA_SERVER_URI: str = "grpc.nvcf.nvidia.com:443"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


asr_settings = ASRSettings()

# NVIDIA Riva Whisper configuration
NVIDIA_WHISPER_MODEL = "whisper-large-v3"
DEFAULT_MEDICAL_PROMPT = (
    "Verbatim multilingual transcription of an Indian doctor-patient consultation, often Hindi-English code-switching. "
    "Do not infer, summarize, continue, paraphrase, or add any words not spoken. "
    "Keep medicine names, quantities, and dosage numbers exactly as spoken. "
    "Preserve investigations exactly, including CT scan, MRI, X-ray, ultrasound, ECG, CBC, LFT, KFT, HbA1c, and biopsy. "
    "Common medicine names include paracetamol, Dolo, Crocin, ibuprofen, cetirizine, azithromycin, amoxicillin, pantoprazole, and metformin. "
    "Hindi may be spoken in Devanagari or Romanized Hindi: subah, shaam, raat, din mein do baar, khane ke baad, zaroorat par. "
    "If speech is unclear, noisy, or absent, return an empty transcript."
)


class NvidiaTranscriptionService:
    """
    ASR transcription service using NVIDIA Riva/NIM Whisper API.

    Class name kept as NvidiaTranscriptionService for backward compatibility
    with existing router imports. Internally uses NVIDIA Riva gRPC client.
    """

    def __init__(self):
        self.api_key = asr_settings.NVIDIA_API_KEY
        self.function_id = asr_settings.NVIDIA_FUNCTION_ID
        self.server_uri = asr_settings.NVIDIA_SERVER_URI
        self._service: Optional[ASRService] = None
        self._auth: Optional[Auth] = None
        self._audio_buffer: List[bytes] = []

        # For backward compat — these attrs are read by the router
        self.model = NVIDIA_WHISPER_MODEL
        self.api_url = self.server_uri

        if self.api_key and self.api_key not in ("", "placeholder-dev"):
            self._init_riva_client()
            print(f"[ASR] Initialized — engine: NVIDIA Riva Whisper ({NVIDIA_WHISPER_MODEL})")
        else:
            print(f"[ASR] WARNING — NVIDIA_API_KEY not set. ASR will not work.")
            print(f"[ASR] Set NVIDIA_API_KEY in backend/.env")

    def _init_riva_client(self):
        """Initialize NVIDIA Riva gRPC client with authentication."""
        self._auth = Auth(
            use_ssl=True,
            uri=self.server_uri,
            metadata_args=[
                ["function-id", self.function_id],
                ["authorization", f"Bearer {self.api_key}"],
            ],
        )
        self._service = ASRService(self._auth)

    def is_available(self) -> bool:
        """Check if ASR service is available and configured."""
        return self._service is not None

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
        language: str = "auto",
        prompt: Optional[str] = None,
    ) -> str:
        """
        Transcribe audio bytes using NVIDIA Riva Whisper API.

        Args:
            audio_bytes: Raw PCM audio bytes (16-bit, mono, 16kHz)
            language: Language code (e.g., 'en', 'hi', 'multi' for auto)

        Returns:
            Transcription text
        """
        if not self.is_available():
            raise RuntimeError("ASR not available. Set NVIDIA_API_KEY in backend/.env")

        # Create WAV from raw PCM
        wav_bytes = self._create_wav(audio_bytes, sample_rate=16000)

        print(f"[ASR] Transcribing {len(audio_bytes)} bytes of audio "
              f"(WAV: {len(wav_bytes)} bytes), language={language}")

        # Retry logic for transient NIM worker cold-start issues
        max_retries = 3
        base_delay = 2.0
        
        for attempt in range(max_retries):
            try:
                # Run the synchronous gRPC call in a thread
                transcript = await asyncio.to_thread(
                    self._call_riva_whisper, wav_bytes, language, prompt
                )

                print(f"[ASR] Transcript: '{transcript[:100]}'" if transcript else "[ASR] Empty transcript")
                return transcript

            except Exception as e:
                error_msg = str(e)
                print(f"[ASR] Transcription error (attempt {attempt + 1}/{max_retries}): {error_msg}")

                # Don't retry on authentication errors
                if "UNAUTHENTICATED" in error_msg or "401" in error_msg:
                    raise RuntimeError("NVIDIA API key is invalid or expired.")
                elif "RESOURCE_EXHAUSTED" in error_msg or "429" in error_msg:
                    raise RuntimeError("NVIDIA API rate limit hit. Wait a moment and try again.")
                
                # Retry on transient errors (worker cold-start, deadline exceeded)
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)
                    print(f"[ASR] Retrying in {delay}s...")
                    await asyncio.sleep(delay)
                else:
                    raise RuntimeError(f"Whisper transcription failed after {max_retries} attempts: {error_msg}")

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

    def _call_riva_whisper(self, wav_bytes: bytes, language: str, prompt: Optional[str]) -> str:
        """Synchronous call to NVIDIA Riva Whisper API via gRPC."""
        # Map language codes to Riva format
        lang_map = {
            "en": "en-US",
            "hi": "hi-IN",
            "es": "es-ES",
            "fr": "fr-FR",
            "de": "de-DE",
            "ja": "ja-JP",
            "zh": "zh-CN",
            "ko": "ko-KR",
            "pt": "pt-BR",
            "ru": "ru-RU",
            "ar": "ar-SA",
        }
        normalized_language = (language or "auto").strip().lower()
        
        # For multilingual/Hinglish, use "multi" which enables auto-detection
        if normalized_language in {"auto", "mixed", "hinglish", "multi"}:
            riva_language = "multi"
        else:
            riva_language = lang_map.get(normalized_language, normalized_language)

        # Create RecognitionConfig
        config = rasr.RecognitionConfig(
            encoding=raudio.AudioEncoding.LINEAR_PCM,
            sample_rate_hertz=16000,
            language_code=riva_language,
            max_alternatives=1,
            enable_automatic_punctuation=True,
            enable_word_time_offsets=False,
            verbatim_transcripts=True,
        )

        # Note: Riva's RecognitionConfig doesn't have a direct "prompt" field like Whisper.
        # The medical context is handled via the model's training. For NIM Whisper,
        # we rely on the model's inherent multilingual capability.
        
        try:
            response = self._service.offline_recognize(wav_bytes, config)
        except Exception as e:
            error_msg = str(e)
            print(f"[ASR] Riva gRPC error: {error_msg}")
            raise

        # Extract transcript from response
        if not response.results or not response.results[0].alternatives:
            return ""

        text = response.results[0].alternatives[0].transcript.strip()

        if not text:
            return ""

# Filter out hallucinated silence transcripts and prompt bleed-through.
        lower_text = text.lower()
        
        # Only reject if the entire transcript matches these patterns.
        silence_hallucinations = {
            "thank you", "thanks", "you", ".", "..", "...", "thank you.",
            "thanks.", "bye.", "bye",
            # Hindi/Devanagari silence hallucinations observed in testing
            "झाल", "अ", "आ", "ह", "हूँ", "है", "हैं", "था", "थी", "थे",
            "जी", "हाँ", "नहीं", "अच्छा", "ठीक", "बस", "चलो"
        }
        
        # Only reject very short, exact matches to silence hallucinations.
        if lower_text.strip().rstrip('.') in silence_hallucinations and len(text) < 15:
            return ""
        
        # Filter obvious hallucinations but don't be too aggressive.
        if (
            "amara.org" in lower_text
            or "subtitle by" in lower_text
            or "thank you for watching" in lower_text
            or "please subscribe" in lower_text
        ):
            return ""
        
        filler_tokens = {"uh", "um", "hmm", "huh", "oh", "ah", "er", "mm",
                         "हूँ", "है", "हैं", "था", "थी", "थे", "जी", "हाँ", "नहीं", "अच्छा", "ठीक", "बस", "चलो"}
        words = [w.strip(".,!?;:'\"()[]{}") for w in lower_text.split() if w.strip()]
        if words and len(words) <= 5 and all(w in filler_tokens for w in words):
            return ""
        
        return text

    async def transcribe_buffer(self, language: str = "auto") -> str:
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

    async def transcribe_file(self, file_path: str, language: str = "auto") -> str:
        """
        Transcribe an audio file.

        Args:
            file_path: Path to audio file
            language: Language code

        Returns:
            Transcription text
        """
        if not self.is_available():
            raise RuntimeError("ASR not available. Set NVIDIA_API_KEY in backend/.env")

        with open(file_path, "rb") as f:
            audio_bytes = f.read()

        return await self.transcribe_audio_bytes(audio_bytes, language)


# Singleton instance
nvidia_transcription_service = NvidiaTranscriptionService()


def get_nvidia_service() -> NvidiaTranscriptionService:
    """Get the ASR transcription service instance."""
    return nvidia_transcription_service