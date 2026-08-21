from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import List, Optional
from database import get_session
from models import Patient, Doctor

router = APIRouter(prefix="/patients", tags=["patients"])

# Mock Auth Dependency - Replace with real Clerk verification
def get_current_doctor_id():
    # In a real app, extract from JWT token
    # For now, return a test doctor ID or expect it in header
    return "test_doctor_id"

@router.post("/", response_model=Patient)
def create_patient(
    patient: Patient, 
    session: Session = Depends(get_session),
    # doctor_id: str = Depends(get_current_doctor_id) 
):
    # Ensure doctor exists or create one (if lazy)
    # For MVP, we might need to pass doctorId in the body or infer from auth
    # Here we assume patient.doctorId is passed or we override it
    
    db_patient = Patient.model_validate(patient)
    session.add(db_patient)
    session.commit()
    session.refresh(db_patient)
    return db_patient

@router.get("/", response_model=List[Patient])
def read_patients(
    doctor_id: str,
    skip: int = 0,
    limit: int = 100,
    session: Session = Depends(get_session)
):
    statement = select(Patient).where(Patient.doctorId == doctor_id).offset(skip).limit(limit)
    patients = session.exec(statement).all()
    return patients

@router.get("/{patient_id}", response_model=Patient)
def read_patient(patient_id: str, session: Session = Depends(get_session)):
    patient = session.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient
