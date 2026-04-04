from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Any
from services.emr_engine import generate_emr_from_transcript

router = APIRouter(prefix="/generate-emr", tags=["emr"])


class GenerateEMRRequest(BaseModel):
    transcript: str
    patient_allergies: Optional[str] = None  # Pass known allergies for safety check


@router.post("/")
async def generate_emr(request: GenerateEMRRequest):
    """
    3-Agent EMR Pipeline:
    - Agent 1 (Extractor): Structured EMR with confidence tags (green/yellow/blank)
    - Agent 2 (Safety Checker): Drug interactions, allergy conflicts, contraindications
    
    Agent 3 (Hindi Summarizer) runs separately via /hindi-summary/ after doctor approval.
    """
    if not request.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript cannot be empty")

    try:
        emr_data = generate_emr_from_transcript(request.transcript)
        return emr_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
