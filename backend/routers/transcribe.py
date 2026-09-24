from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from typing import Optional
import shutil
import os
from services.transcription import transcribe_audio

router = APIRouter(prefix="/transcribe", tags=["transcribe"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/")
async def transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None)
):
    try:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        transcript_text = transcribe_audio(file_path, language)
        
        # Clean up file after processing
        os.remove(file_path)
        
        return {"text": transcript_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
