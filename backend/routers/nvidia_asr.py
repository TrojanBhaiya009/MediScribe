"""
WebSocket endpoint for streaming audio transcription using OpenAI Whisper.

Handles real-time audio streaming from frontend, accumulates audio chunks,
and periodically sends them to Whisper API for transcription.
"""

from array import array
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File
import asyncio
import json
import base64
import re
import unicodedata
from difflib import SequenceMatcher
from typing import Optional
from services.nvidia_transcription import get_nvidia_service

router = APIRouter(prefix="/nvidia-asr", tags=["nvidia-asr"])

BYTES_PER_SAMPLE = 2
STREAM_POLL_SECONDS = 0.5
MIN_CHUNK_SECONDS = 0.8
MIN_FINAL_CHUNK_SECONDS = 0.3
FORCE_FLUSH_SECONDS = 6.0
TRAILING_SILENCE_SECONDS = 0.5
FRAME_MS = 30
SPEECH_THRESHOLD = 900
MAX_CONTEXT_WORDS = 80
MIN_ACTIVE_FRAMES = 4
MIN_SPEECH_FRAME_RATIO = 0.12
MAX_DUPLICATE_SIMILARITY = 0.92
MAX_LOCAL_DUPLICATE_WORDS = 22

BLOCKED_HALLUCINATION_PHRASES = {
    "thank you for watching",
    "thanks for watching",
    "please subscribe",
    "subscribe to",
    "amara.org",
    "subtitle",
}

# Tuned for better phrase integrity and fewer micro-chunk hallucinations.
MIN_CHUNK_SECONDS = 1.5
MIN_FINAL_CHUNK_SECONDS = 0.6
TRAILING_SILENCE_SECONDS = 0.7
MIN_ACTIVE_FRAMES = 8
MIN_SPEECH_FRAME_RATIO = 0.2


def _audio_duration_seconds(audio_bytes: bytes, sample_rate: int) -> float:
    if sample_rate <= 0:
        return 0.0
    return len(audio_bytes) / (sample_rate * BYTES_PER_SAMPLE)


def _frame_level(frame: bytes) -> float:
    if len(frame) < BYTES_PER_SAMPLE:
        return 0.0
    pcm = array("h")
    pcm.frombytes(frame[: len(frame) - (len(frame) % BYTES_PER_SAMPLE)])
    if not pcm:
        return 0.0
    return sum(abs(sample) for sample in pcm) / len(pcm)


def _iter_levels(audio_bytes: bytes, sample_rate: int):
    samples_per_frame = max(1, int(sample_rate * FRAME_MS / 1000))
    bytes_per_frame = samples_per_frame * BYTES_PER_SAMPLE
    for offset in range(0, len(audio_bytes), bytes_per_frame):
        frame = audio_bytes[offset:offset + bytes_per_frame]
        if len(frame) == bytes_per_frame:
            yield _frame_level(frame)


def _contains_speech(audio_bytes: bytes, sample_rate: int) -> bool:
    levels = list(_iter_levels(audio_bytes, sample_rate))
    if not levels:
        return False

    active_frames = [level for level in levels if level >= SPEECH_THRESHOLD]
    speech_ratio = len(active_frames) / len(levels)

    return len(active_frames) >= MIN_ACTIVE_FRAMES and speech_ratio >= MIN_SPEECH_FRAME_RATIO


def _has_trailing_silence(audio_bytes: bytes, sample_rate: int) -> bool:
    samples_per_frame = max(1, int(sample_rate * FRAME_MS / 1000))
    bytes_per_frame = samples_per_frame * BYTES_PER_SAMPLE
    required_frames = max(1, int(TRAILING_SILENCE_SECONDS * 1000 / FRAME_MS))
    required_bytes = required_frames * bytes_per_frame

    if len(audio_bytes) < required_bytes:
        return False

    tail = audio_bytes[-required_bytes:]
    return all(level < SPEECH_THRESHOLD for level in _iter_levels(tail, sample_rate))


def _dedupe_transcript(existing_text: str, new_text: str) -> str:
    cleaned = " ".join(new_text.split()).strip()
    if not cleaned:
        return ""

    existing_words = existing_text.lower().split()
    new_words = cleaned.split()
    new_words_lower = [word.lower() for word in new_words]
    max_overlap = min(15, len(existing_words), len(new_words_lower))

    for overlap in range(max_overlap, 0, -1):
        if existing_words[-overlap:] == new_words_lower[:overlap]:
            cleaned = " ".join(new_words[overlap:]).strip()
            break

    return cleaned


def _normalize_text(text: str) -> str:
    # Keep letters and numbers from every Unicode script. The previous a-z
    # filter treated valid Devanagari transcripts as empty hallucinations.
    normalized_chars = [
        char.casefold() if char.isalnum() or unicodedata.category(char).startswith("M") or char in {"'", " "} else " "
        for char in text
    ]
    return " ".join("".join(normalized_chars).split())


def _looks_repetitive(text: str) -> bool:
    words = _normalize_text(text).split()
    if len(words) < 6:
        return False
    unique_ratio = len(set(words)) / len(words)
    return unique_ratio < 0.45


def _is_hallucinated_fragment(existing_text: str, new_text: str) -> bool:
    normalized_new = _normalize_text(new_text)
    if not normalized_new:
        return True

    if any(phrase in normalized_new for phrase in BLOCKED_HALLUCINATION_PHRASES):
        return True

    if _looks_repetitive(normalized_new):
        return True

    recent_existing = " ".join(existing_text.split()[-MAX_LOCAL_DUPLICATE_WORDS:])
    normalized_existing = _normalize_text(recent_existing)
    if not normalized_existing:
        return False

    similarity = SequenceMatcher(None, normalized_existing, normalized_new).ratio()
    if similarity >= MAX_DUPLICATE_SIMILARITY:
        return True

    new_words = normalized_new.split()
    if len(new_words) <= 5 and normalized_new in normalized_existing:
        return True

    return False


def _recent_context(full_transcript: str) -> str:
    words = full_transcript.split()
    if len(words) <= MAX_CONTEXT_WORDS:
        return full_transcript
    return " ".join(words[-MAX_CONTEXT_WORDS:])


@router.get("/status")
async def check_asr_status():
    """Check if ASR service is available and configured."""
    service = get_nvidia_service()
    available = service.is_available()
    print(f"[ASR Router] Status check — available: {available}")
    return {
        "available": available,
        "api_key_configured": available,
        "model": service.model,
        "api_url": service.api_url,
        "engine": "groq-whisper",
    }


@router.websocket("/stream")
async def websocket_transcription(websocket: WebSocket):
    await websocket.accept()

    service = get_nvidia_service()

    if not service.is_available():
        await websocket.send_json({
            "type": "error",
            "message": "ASR not available. Set OPENAI_API_KEY in backend/.env"
        })
        await websocket.close()
        return

    # Connection state
    language = "auto"
    sample_rate = 16000
    audio_buffer = bytearray()
    full_transcript_parts: list[str] = []
    is_running = True
    buffer_lock = asyncio.Lock()
    transcription_lock = asyncio.Lock()

    def current_full_transcript() -> str:
        return " ".join(full_transcript_parts).strip()

    async def _take_ready_audio(force: bool = False) -> bytes:
        async with buffer_lock:
            if not audio_buffer:
                return b""

            audio_bytes = bytes(audio_buffer)
            duration = _audio_duration_seconds(audio_bytes, sample_rate)
            minimum_duration = MIN_FINAL_CHUNK_SECONDS if force else MIN_CHUNK_SECONDS
            has_speech = _contains_speech(audio_bytes, sample_rate)
            should_flush = (
                duration >= minimum_duration
                and has_speech
                and (
                    force
                    or _has_trailing_silence(audio_bytes, sample_rate)
                    or duration >= FORCE_FLUSH_SECONDS
                )
            )

            if not should_flush:
                return b""

            audio_buffer.clear()
            return audio_bytes

    async def _transcribe_ready_audio(force: bool = False):
        if transcription_lock.locked():
            return

        audio_bytes = await _take_ready_audio(force=force)
        if not audio_bytes:
            return

        print(f"[ASR WS] Processing {len(audio_bytes)} bytes of audio...")

        async with transcription_lock:
            try:
                transcript = await service.transcribe_audio_bytes(
                    audio_bytes,
                    language,
                    # Keep prompt stable for each chunk to avoid context-driven continuations.
                    prompt=service.build_prompt(),
                )

                transcript = _dedupe_transcript(current_full_transcript(), transcript)
                if transcript and not _is_hallucinated_fragment(current_full_transcript(), transcript):
                    full_transcript_parts.append(transcript)
                    await websocket.send_json({
                        "type": "transcript",
                        "text": transcript,
                        "is_final": True
                    })
                    print(f"[ASR WS] Sent transcript: '{transcript[:80]}'")
                else:
                    print("[ASR WS] Dropped empty/duplicate/hallucinated transcript")
            except Exception as e:
                error_msg = str(e)
                print(f"[ASR WS] Transcription error: {error_msg}")
                try:
                    await websocket.send_json({
                        "type": "error",
                        "message": error_msg
                    })
                except Exception:
                    pass

    async def _wait_for_transcription():
        while transcription_lock.locked():
            await asyncio.sleep(0.05)

    async def periodic_transcription():
        while is_running:
            await asyncio.sleep(STREAM_POLL_SECONDS)
            if is_running:
                await _transcribe_ready_audio()

    transcription_task = None

    try:
        while True:
            try:
                # Receive message from client
                message = await websocket.receive_text()
                data = json.loads(message)
                msg_type = data.get("type")

                if msg_type == "config":
                    language = data.get("language", "auto")
                    if "-" in language:
                        language = language.split("-")[0]
                    sample_rate = data.get("sampleRate", 16000)

                    transcription_task = asyncio.create_task(periodic_transcription())

                    await websocket.send_json({
                        "type": "ready",
                        "message": f"Ready for {language} at {sample_rate}Hz (Whisper engine)"
                    })

                elif msg_type == "audio":
                    audio_data = data.get("data", "")
                    if audio_data:
                        audio_bytes = base64.b64decode(audio_data)
                        async with buffer_lock:
                            audio_buffer.extend(audio_bytes)
                        await _transcribe_ready_audio()

                elif msg_type == "stop":
                    is_running = False
                    if transcription_task:
                        await transcription_task

                    await _wait_for_transcription()
                    await _transcribe_ready_audio(force=True)
                    await _wait_for_transcription()

                    await websocket.send_json({
                        "type": "complete",
                        "full_transcript": current_full_transcript()
                    })
                    break

            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid JSON message"
                })

    except WebSocketDisconnect:
        is_running = False

    except Exception as e:
        is_running = False
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass
    finally:
        is_running = False
        if transcription_task:
            try:
                if not transcription_task.done():
                    transcription_task.cancel()
                await transcription_task
            except (asyncio.CancelledError, RuntimeError):
                pass


@router.get("/test")
async def test_asr_connection():
    """
    Diagnostic endpoint: tests ASR service connectivity.
    Sends a tiny silent audio clip to Whisper to verify the API key works.
    """
    service = get_nvidia_service()

    if not service.is_available():
        return {
            "success": False,
            "engine": "groq-whisper",
            "error": "GROQ_API_KEY not configured",
            "hint": "Set GROQ_API_KEY=gsk_xxx in backend/.env (free at console.groq.com)"
        }

    # Generate 1 second of silent audio (16kHz, 16-bit, mono)
    silent_pcm = b'\x00\x00' * 16000

    try:
        transcript = await service.transcribe_audio_bytes(silent_pcm, "en")
        return {
            "success": True,
            "engine": "groq-whisper",
            "model": service.model,
            "transcript": transcript,
            "message": "Groq Whisper API is working correctly"
        }
    except Exception as e:
        return {
            "success": False,
            "engine": "groq-whisper",
            "model": service.model,
            "error": str(e),
            "hint": "Check your GROQ_API_KEY in backend/.env (free at console.groq.com)"
        }


@router.post("/transcribe")
async def transcribe_audio_file(
    file: UploadFile = File(...),
    language: str = "en"
):
    """
    Transcribe an uploaded audio file using Whisper.
    """
    service = get_nvidia_service()

    if not service.is_available():
        raise HTTPException(
            status_code=503,
            detail="ASR not available. Set GROQ_API_KEY in backend/.env (free at console.groq.com)"
        )

    try:
        audio_bytes = await file.read()
        transcript = await service.transcribe_audio_bytes(audio_bytes, language)
        return {"text": transcript}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
