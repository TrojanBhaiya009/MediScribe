from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel
import uuid
from database import get_session
from models import Visit, EMR, DiseaseRisk, Patient

router = APIRouter(prefix="/visits", tags=["visits"])

class DiseaseRiskData(BaseModel):
    fluProbability: float
    migraineProbability: float
    fatigueProbability: float
    notes: Optional[str] = None

class CreateVisitRequest(BaseModel):
    patientId: str
    transcript: str
    audioUrl: Optional[str] = None
    emrData: dict
    diseaseRisk: DiseaseRiskData
    hallucinationWarning: bool = False
    hallucinationDetails: Optional[str] = None


class WhatsAppShareResponse(BaseModel):
    success: bool
    share_link: str
    pdf_url: str
    message: str
    simulated: bool = True

@router.get("/", response_model=List[Visit])
def read_visits(
    patient_id: str,
    session: Session = Depends(get_session)
):
    statement = select(Visit).where(Visit.patientId == patient_id).order_by(Visit.visitDate.desc())
    visits = session.exec(statement).all()
    return visits

@router.post("/", response_model=Visit)
def create_visit(
    request: CreateVisitRequest, 
    session: Session = Depends(get_session)
):
    try:
        # 1. Create Visit
        visit = Visit(
            patientId=request.patientId,
            transcript=request.transcript,
            audioUrl=request.audioUrl,
            status="CONFIRMED"
        )
        session.add(visit)
        session.commit()
        session.refresh(visit)
        
        # 2. Create EMR
        emr_data = request.emrData
        emr = EMR(
            visitId=visit.id,
            chiefComplaint=emr_data.get("chiefComplaint"),
            hpi=emr_data.get("hpi"),
            pastHistory=emr_data.get("pastHistory"),
            medications=emr_data.get("medications", []),
            investigations=emr_data.get("investigations", []), # Save investigations
            allergies=emr_data.get("allergies"),
            examFindings=emr_data.get("examFindings"),
            diagnosis=emr_data.get("diagnosis"),
            plan=emr_data.get("plan"),
            followUpDays=emr_data.get("followUpDays"),
            generatedByAI=True,
            editedByDoctor=False, # TODO: Track if edited
            hallucinationWarning=request.hallucinationWarning,
            hallucinationDetails=request.hallucinationDetails
        )
        session.add(emr)
        
        # 3. Create Disease Risk
        risk_data = request.diseaseRisk
        risk = DiseaseRisk(
            visitId=visit.id,
            fluProbability=risk_data.fluProbability,
            migraineProbability=risk_data.migraineProbability,
            fatigueProbability=risk_data.fatigueProbability,
            notes=risk_data.notes
        )
        session.add(risk)
        
        session.commit()
        session.refresh(visit)
        return visit
        
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{visit_id}", response_model=Visit)
def read_visit(visit_id: str, session: Session = Depends(get_session)):
    visit = session.get(Visit, visit_id)
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    return visit


@router.post("/{visit_id}/whatsapp", response_model=WhatsAppShareResponse)
def share_visit_whatsapp(visit_id: str, session: Session = Depends(get_session)):
    """Simulate Twilio WhatsApp prescription sharing and return a shareable link."""
    visit = session.get(Visit, visit_id)
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    patient = session.get(Patient, visit.patientId)
    patient_name = patient.name if patient else "Unknown"

    share_token = str(uuid.uuid4())[:8]
    base_url = "http://localhost:3000"
    pdf_url = f"{base_url}/api/export/visits/{visit_id}/pdf"
    share_link = f"{base_url}/share/{share_token}"

    return WhatsAppShareResponse(
        success=True,
        share_link=share_link,
        pdf_url=pdf_url,
        message=(
            f"Prescription for {patient_name} ready for sharing. "
            "Simulated Twilio WhatsApp dispatch completed."
        ),
        simulated=True,
    )
