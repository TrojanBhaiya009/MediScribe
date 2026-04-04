from fastapi import APIRouter
from pydantic import BaseModel
from services.emr_engine import generate_hindi_summary

router = APIRouter(tags=["Hindi Summary"])


class HindiSummaryRequest(BaseModel):
    approved_emr: dict


@router.post("/hindi-summary/")
async def create_hindi_summary(request: HindiSummaryRequest):
    """
    Agent 3 — Hindi Summarizer.
    Called AFTER doctor approves the EMR (commit-on-approval).
    Takes the finalized EMR and generates a patient-facing Hindi summary.
    """
    result = generate_hindi_summary(request.approved_emr)
    return result
