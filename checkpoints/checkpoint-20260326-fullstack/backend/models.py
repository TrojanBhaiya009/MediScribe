from typing import Optional, List
from datetime import datetime
from enum import Enum
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import Column, String, JSON, Integer, DateTime as SADateTime


class UserRole(str, Enum):
    """User roles for access control."""
    DOCTOR = "doctor"
    PHARMACIST = "pharmacist"
    RECEPTIONIST = "receptionist"
    ADMIN = "admin"


class UserAccount(SQLModel, table=True):
    """Local user accounts for JWT authentication."""
    __tablename__ = "user_accounts"
    id: Optional[str] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    passwordHash: str
    hashedPassword: Optional[str] = Field(default=None, sa_column=Column("hashedPassword", String, nullable=True))
    role: UserRole = Field(sa_column=Column(String, nullable=False))
    displayName: str
    fullName: Optional[str] = Field(default=None, sa_column=Column("fullName", String, nullable=True))
    email: Optional[str] = None
    phone: Optional[str] = None
    isActive: bool = Field(default=True)
    doctorId: Optional[str] = Field(default=None, foreign_key="doctors.id")
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)
    lastLoginAt: Optional[datetime] = None


class PharmacyInventory(SQLModel, table=True):
    """Pharmacy drug inventory tracking."""
    __tablename__ = "pharmacy_inventory"
    id: Optional[str] = Field(default=None, primary_key=True)
    drugName: str = Field(index=True)
    genericName: Optional[str] = None
    manufacturer: Optional[str] = None
    category: Optional[str] = Field(default=None, sa_column=Column("category", String, nullable=True))
    stock: Optional[int] = Field(default=None, sa_column=Column("stock", Integer, nullable=True))
    reorderLevel: Optional[int] = Field(default=None, sa_column=Column("reorderLevel", Integer, nullable=True))
    lastRestocked: Optional[datetime] = Field(default=None, sa_column=Column("lastRestocked", SADateTime, nullable=True))
    stockCapacity: int = Field(default=100)
    currentQuantity: int = Field(default=0)
    lowStockThreshold: int = Field(default=20)
    unitType: str = Field(default="tablets")
    pricePerUnit: float = Field(default=0.0)
    expiryDate: Optional[datetime] = None
    batchNumber: Optional[str] = None
    isActive: bool = Field(default=True)
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)


class DispenseLog(SQLModel, table=True):
    """Log of dispensed medications."""
    __tablename__ = "dispense_logs"
    id: Optional[str] = Field(default=None, primary_key=True)
    inventoryId: str = Field(foreign_key="pharmacy_inventory.id", index=True)
    patientId: str = Field(foreign_key="patients.id", index=True)
    visitId: Optional[str] = Field(default=None, foreign_key="visits.id")
    quantityDispensed: int
    dispensedBy: str = Field(foreign_key="user_accounts.id")
    notes: Optional[str] = None
    dispensedAt: datetime = Field(default_factory=datetime.now)


class Doctor(SQLModel, table=True):
    __tablename__ = "doctors"
    id: Optional[str] = Field(default=None, primary_key=True)
    clerkId: str = Field(unique=True, index=True)
    name: str
    phone: Optional[str] = None
    clinicName: Optional[str] = None
    city: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)

    patients: List["Patient"] = Relationship(back_populates="doctor")

class Patient(SQLModel, table=True):
    __tablename__ = "patients"
    id: Optional[str] = Field(default=None, primary_key=True)
    doctorId: str = Field(foreign_key="doctors.id", index=True)
    name: str
    phone: Optional[str] = Field(default=None, index=True)
    age: Optional[int] = None
    gender: Optional[str] = None
    abhaId: Optional[str] = None  # New field for ABHA/Aadhaar
    bloodGroup: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)

    doctor: Doctor = Relationship(back_populates="patients")
    visits: List["Visit"] = Relationship(back_populates="patient")

class Visit(SQLModel, table=True):
    __tablename__ = "visits"
    id: Optional[str] = Field(default=None, primary_key=True)
    patientId: str = Field(foreign_key="patients.id", index=True)
    visitDate: datetime = Field(default_factory=datetime.now)
    status: str = Field(default="DRAFT")  # DRAFT, CONFIRMED, EXPORTED
    language: Optional[str] = Field(default="en")  # Language of transcription/EMR
    
    audioUrl: Optional[str] = None
    audioDuration: Optional[int] = None
    transcript: Optional[str] = None

    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)

    patient: Patient = Relationship(back_populates="visits")
    emr: Optional["EMR"] = Relationship(back_populates="visit")
    disease_risks: Optional["DiseaseRisk"] = Relationship(back_populates="visit")

class EMR(SQLModel, table=True):
    __tablename__ = "emrs"
    id: Optional[str] = Field(default=None, primary_key=True)
    visitId: str = Field(foreign_key="visits.id", unique=True)
    
    chiefComplaint: Optional[str] = None
    hpi: Optional[str] = None
    pastHistory: Optional[str] = None
    
    # Store list as JSON
    medications: List[str] = Field(default=[], sa_column=Column(JSON))
    investigations: List[str] = Field(default=[], sa_column=Column(JSON)) # New field
    
    allergies: Optional[str] = None
    examFindings: Optional[str] = None
    diagnosis: Optional[str] = None
    plan: Optional[str] = None
    followUpDays: Optional[int] = None

    generatedByAI: bool = Field(default=True)
    editedByDoctor: bool = Field(default=False)
    
    hallucinationWarning: Optional[bool] = Field(default=False) # New field
    hallucinationDetails: Optional[str] = None # New field

    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)

    visit: Visit = Relationship(back_populates="emr")

class DiseaseRisk(SQLModel, table=True):
    __tablename__ = "disease_risks"
    id: Optional[str] = Field(default=None, primary_key=True)
    visitId: str = Field(foreign_key="visits.id", unique=True)
    
    fluProbability: float = Field(default=0.0)
    migraineProbability: float = Field(default=0.0)
    fatigueProbability: float = Field(default=0.0)
    diabetesProbability: float = Field(default=0.0)
    hypertensionProbability: float = Field(default=0.0)
    
    notes: Optional[str] = None # To highlight if above average

    createdAt: datetime = Field(default_factory=datetime.now)
    
    visit: Visit = Relationship(back_populates="disease_risks")


class QRCode(SQLModel, table=True):
    __tablename__ = "qrcodes"
    id: Optional[str] = Field(default=None, primary_key=True)
    doctorId: str = Field(foreign_key="doctors.id", unique=True, index=True)
    scanUrl: str
    scanCount: int = Field(default=0)
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)


class ConsentLog(SQLModel, table=True):
    __tablename__ = "consent_logs"
    id: Optional[str] = Field(default=None, primary_key=True)
    patientId: str = Field(foreign_key="patients.id", index=True)
    doctorId: str = Field(foreign_key="doctors.id", index=True)
    consentType: str  # "recording" | "sharing" | "qr_register"
    ipAddress: Optional[str] = None
    extraData: Optional[str] = None  # JSON string for additional context
    consentAt: datetime = Field(default_factory=datetime.now)
    revokedAt: Optional[datetime] = None
    
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)


class PatientShareConsent(SQLModel, table=True):
    __tablename__ = "patient_share_consents"
    id: Optional[str] = Field(default=None, primary_key=True)
    patientId: str = Field(foreign_key="patients.id", index=True)
    fromDoctorId: str = Field(foreign_key="doctors.id", index=True)
    toDoctorId: str = Field(foreign_key="doctors.id", index=True)
    consentLogId: str = Field(foreign_key="consent_logs.id")
    revoked: bool = Field(default=False)
    revokedAt: Optional[datetime] = None
    
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)
