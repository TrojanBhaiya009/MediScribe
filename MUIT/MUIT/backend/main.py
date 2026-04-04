from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import create_db_and_tables
from routers import patients, doctors, visits, transcribe, emr, export, analytics, qr, sharing, consent, hindi_summary, nvidia_asr, auth, inventory, trae

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield

app = FastAPI(
    title="MediScribe API",
    description="AI-powered clinical CRM backend — 3-agent EMR pipeline, ABHA sync, pharmacy dispatch.",
    version="2.0.0",
    lifespan=lifespan
)

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "MediScribe Clinical CRM Backend", "version": "2.0.0", "pipeline": "3-agent"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# Authentication & authorization
app.include_router(auth.router)

# Core clinical routers
app.include_router(patients.router)
app.include_router(doctors.router)
app.include_router(visits.router)
app.include_router(transcribe.router)
app.include_router(emr.router)
app.include_router(hindi_summary.router)
app.include_router(export.router)

# Pharmacy inventory
app.include_router(inventory.router)

# Intelligence & compliance routers
app.include_router(analytics.router)
app.include_router(qr.router)
app.include_router(sharing.router)
app.include_router(consent.router)

# NVIDIA ASR (Parakeet) router
app.include_router(nvidia_asr.router)
app.include_router(trae.router)
