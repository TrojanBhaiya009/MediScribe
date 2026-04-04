"""
Seed large demo dataset for MediScribe.

Creates:
- 150-200 patients
- demo doctors + user accounts (JWT login)
- >=20 pharmacy inventory drugs
- sample visits + EMRs + disease risk records

Usage:
    cd backend
    python scripts/seed_demo_data.py
"""

import os
import random
import sys
import uuid
from datetime import datetime, timedelta
from importlib import import_module
from typing import Any, Sequence

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from passlib.context import CryptContext
from sqlmodel import Session, select

from database import engine, create_db_and_tables
from models import (
    DiseaseRisk,
    Doctor,
    EMR,
    Patient,
    PharmacyInventory,
    UserAccount,
    UserRole,
    Visit,
)

Faker: Any = None
try:
    Faker = import_module("faker").Faker
except Exception:
    Faker = None


pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

DRUGS = [
    ("Paracetamol 500mg", "Acetaminophen"),
    ("Dolo 650", "Paracetamol"),
    ("Azithromycin 500mg", "Azithromycin"),
    ("Amoxicillin 500mg", "Amoxicillin"),
    ("Cetirizine 10mg", "Cetirizine"),
    ("Levocetirizine 5mg", "Levocetirizine"),
    ("Pantoprazole 40mg", "Pantoprazole"),
    ("Omeprazole 20mg", "Omeprazole"),
    ("Rabeprazole 20mg", "Rabeprazole"),
    ("Metformin 500mg", "Metformin"),
    ("Glimepiride 1mg", "Glimepiride"),
    ("Amlodipine 5mg", "Amlodipine"),
    ("Telmisartan 40mg", "Telmisartan"),
    ("Losartan 50mg", "Losartan"),
    ("Atorvastatin 10mg", "Atorvastatin"),
    ("Rosuvastatin 10mg", "Rosuvastatin"),
    ("Diclofenac 50mg", "Diclofenac"),
    ("Ibuprofen 400mg", "Ibuprofen"),
    ("Sumatriptan 50mg", "Sumatriptan"),
    ("Naproxen 500mg", "Naproxen"),
    ("ORS Sachets", "Oral Rehydration Salts"),
    ("Vitamin D3 60K", "Cholecalciferol"),
    ("B-Complex Forte", "Vitamin B Complex"),
    ("Calcium + D3", "Calcium Carbonate + Cholecalciferol"),
    ("Montelukast 10mg", "Montelukast"),
]

DIAGNOSES = [
    "Viral fever",
    "Migraine",
    "Upper respiratory infection",
    "Gastritis",
    "Hypertension",
    "Type 2 Diabetes Mellitus",
    "Allergic rhinitis",
    "Lumbar spondylosis",
    "Pharyngitis",
    "Urinary tract infection",
]


def make_abha() -> str:
    return f"{random.randint(10,99)}-{random.randint(1000,9999)}-{random.randint(1000,9999)}-{random.randint(1000,9999)}"


def seed_users_and_doctors(session: Session):
    doctors = [
        ("lorn2", "Dom341@#", "Dr. Rajesh Sharma"),
        ("doc2", "DocPass2!", "Dr. Anjali Gupta"),
        ("doc3", "DocPass3!", "Dr. Vikram Singh"),
    ]

    created_doctors = []
    for username, _, name in doctors:
        existing = session.exec(select(Doctor).where(Doctor.clerkId == f"clerk_{username}")).first()
        if existing:
            created_doctors.append(existing)
            continue
        doc = Doctor(
            id=str(uuid.uuid4()),
            clerkId=f"clerk_{username}",
            name=name,
            phone=f"+91 9{random.randint(100000000, 999999999)}",
            clinicName="MediScribe Demo Clinic",
            city="New Delhi",
        )
        session.add(doc)
        created_doctors.append(doc)

    session.commit()

    doctor_by_username = {u: d for (u, _, _), d in zip(doctors, created_doctors)}

    user_rows = [
        ("lorn2", "Dom341@#", "Dr. Rajesh Sharma", UserRole.DOCTOR, doctor_by_username["lorn2"].id),
        ("doc2", "DocPass2!", "Dr. Anjali Gupta", UserRole.DOCTOR, doctor_by_username["doc2"].id),
        ("doc3", "DocPass3!", "Dr. Vikram Singh", UserRole.DOCTOR, doctor_by_username["doc3"].id),
        ("pharma1", "Pharma123!", "Sunil Kumar", UserRole.PHARMACIST, None),
        ("pharma2", "Pharma456!", "Meena Devi", UserRole.PHARMACIST, None),
        ("reception1", "Recep123!", "Priya Verma", UserRole.RECEPTIONIST, None),
        ("admin", "Admin123!", "System Administrator", UserRole.ADMIN, None),
    ]

    for username, password, display, role, doctor_id in user_rows:
        exists = session.exec(select(UserAccount).where(UserAccount.username == username)).first()
        if exists:
            continue
        hashed = pwd_context.hash(password)
        session.add(
            UserAccount(
                id=str(uuid.uuid4()),
                username=username,
                passwordHash=hashed,
                hashedPassword=hashed,
                displayName=display,
                fullName=display,
                role=role,
                doctorId=doctor_id,
                isActive=True,
            )
        )

    session.commit()
    return created_doctors


def seed_patients(session: Session, doctor_id: str, total_patients: int):
    fake = Faker("en_IN") if Faker else None

    first_names = ["Aarav", "Ishaan", "Kavya", "Ananya", "Rohan", "Sneha", "Neha", "Priya", "Raj", "Vikram"]
    last_names = ["Sharma", "Gupta", "Singh", "Mehta", "Patel", "Kumar", "Verma", "Jain"]

    count_existing = session.exec(select(Patient).where(Patient.doctorId == doctor_id)).all()
    needed = max(0, total_patients - len(count_existing))

    created = []
    for _ in range(needed):
        if fake:
            name = fake.name()
            address = fake.address().replace("\n", ", ")
            age = random.randint(18, 85)
            gender = random.choice(["M", "F"])
            phone = f"+91 {random.randint(7000000000, 9999999999)}"
        else:
            name = f"{random.choice(first_names)} {random.choice(last_names)}"
            address = "Demo Address, India"
            age = random.randint(18, 85)
            gender = random.choice(["M", "F"])
            phone = f"+91 {random.randint(7000000000, 9999999999)}"

        p = Patient(
            id=str(uuid.uuid4()),
            doctorId=doctor_id,
            name=name,
            phone=phone,
            age=age,
            gender=gender,
            abhaId=make_abha(),
            bloodGroup=random.choice(["A+", "B+", "O+", "AB+", "A-", "B-", "O-", "AB-"]),
            address=address,
            notes=random.choice([None, "Regular patient", "Diabetic", "Hypertensive"]),
        )
        session.add(p)
        created.append(p)

    session.commit()
    return created


def seed_inventory(session: Session):
    for drug_name, generic in DRUGS:
        existing = session.exec(select(PharmacyInventory).where(PharmacyInventory.drugName == drug_name)).first()
        if existing:
            continue
        capacity = random.choice([200, 300, 500])
        current = random.randint(10, 250)
        threshold = random.choice([15, 20, 25, 30])
        session.add(
            PharmacyInventory(
                id=str(uuid.uuid4()),
                drugName=drug_name,
                genericName=generic,
                category="general",
                stock=current,
                reorderLevel=threshold,
                lastRestocked=datetime.now(),
                stockCapacity=capacity,
                currentQuantity=current,
                lowStockThreshold=threshold,
                unitType=random.choice(["tablets", "capsules", "bottles", "sachets"]),
                pricePerUnit=round(random.uniform(2, 120), 2),
                manufacturer=random.choice(["Sun Pharma", "Cipla", "Dr. Reddy's", "Abbott", "Mankind"]),
                isActive=True,
            )
        )
    session.commit()


def seed_visits_and_emr(session: Session, patients: Sequence[Patient], max_records: int = 120):
    if not patients:
        return

    target_patients = random.sample(patients, min(len(patients), max_records))
    for patient in target_patients:
        num_visits = random.randint(1, 3)
        for _ in range(num_visits):
            if not patient.id:
                continue
            visit = Visit(
                id=str(uuid.uuid4()),
                patientId=patient.id,
                visitDate=datetime.now() - timedelta(days=random.randint(0, 120)),
                status=random.choice(["DRAFT", "CONFIRMED", "EXPORTED"]),
                transcript=f"Patient {patient.name} reports {random.choice(['fever', 'headache', 'cough', 'fatigue'])}.",
            )
            session.add(visit)
            session.flush()
            if not visit.id:
                continue

            meds = random.sample([d[0] for d in DRUGS], random.randint(1, 3))
            diagnosis = random.choice(DIAGNOSES)

            session.add(
                EMR(
                    id=str(uuid.uuid4()),
                    visitId=visit.id,
                    chiefComplaint=f"{diagnosis} symptoms",
                    hpi="Symptoms started 2-3 days ago.",
                    pastHistory=random.choice([None, "No major history", "HTN", "DM"]),
                    medications=meds,
                    investigations=random.choice([[], ["CBC"], ["LFT", "KFT"], ["ECG"]]),
                    diagnosis=diagnosis,
                    plan="Medication + hydration + follow-up",
                    followUpDays=random.choice([3, 5, 7, 10]),
                    generatedByAI=True,
                )
            )

            session.add(
                DiseaseRisk(
                    id=str(uuid.uuid4()),
                    visitId=visit.id,
                    fluProbability=round(random.random(), 2),
                    migraineProbability=round(random.random(), 2),
                    fatigueProbability=round(random.random(), 2),
                    diabetesProbability=round(random.random() * 0.5, 2),
                    hypertensionProbability=round(random.random() * 0.5, 2),
                    notes=None,
                )
            )

    session.commit()


def main():
    create_db_and_tables()

    with Session(engine) as session:
        doctors = seed_users_and_doctors(session)

        total = random.randint(150, 200)
        primary_doctor = doctors[0].id
        created = seed_patients(session, primary_doctor, total)

        all_primary = session.exec(select(Patient).where(Patient.doctorId == primary_doctor)).all()
        seed_inventory(session)
        seed_visits_and_emr(session, all_primary, max_records=120)

        print("\nDemo seed complete")
        print(f"Patients for demo doctor: {len(all_primary)}")
        print(f"Newly added in this run: {len(created)}")
        print(f"Inventory items: {len(session.exec(select(PharmacyInventory)).all())}")
        print("\nTest logins:")
        print("  lorn2 / Dom341@#")
        print("  doc2 / DocPass2!")
        print("  pharma1 / Pharma123!")
        print("  admin / Admin123!")


if __name__ == "__main__":
    main()
