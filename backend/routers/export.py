from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session
from database import get_session
from models import Visit, EMR, DiseaseRisk, Patient, Doctor
from services.pdf_generator import generate_visit_pdf

router = APIRouter()

@router.get("/visits/{visit_id}/pdf")
def export_visit_pdf(visit_id: str, session: Session = Depends(get_session)):
    # Fetch all related data
    visit = session.get(Visit, visit_id)
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    patient = session.get(Patient, visit.patientId)
    doctor = session.get(Doctor, patient.doctorId) # Assuming patient linked to doctor
    
    # Fetch EMR (One-to-One)
    # Since we didn't set up eager loading perfectly in basic SQLModel, we query it
    emr = session.query(EMR).filter(EMR.visitId == visit_id).first()
    
    # Fetch Risk
    risk = session.query(DiseaseRisk).filter(DiseaseRisk.visitId == visit_id).first()
    
    if not emr:
        raise HTTPException(status_code=404, detail="EMR not found for this visit")
        
    # Generate PDF
    pdf_buffer = generate_visit_pdf(visit, patient, doctor, emr, risk)
    
    filename = f"Visit_{patient.name.replace(' ', '_')}_{visit.visitDate.strftime('%Y%m%d')}.pdf"
    
    return StreamingResponse(
        pdf_buffer, 
        media_type="application/pdf", 
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
