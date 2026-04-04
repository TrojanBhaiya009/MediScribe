# MediScribe — AI-Powered Medical Scribe

> Unified full-stack application: **Next.js 16 frontend** + **FastAPI ML backend**

## Project Structure

```
MUIT/
├── backend/          # FastAPI + SQLModel + AI services
│   ├── main.py       # App entry point (all routers included)
│   ├── models.py     # SQLModel database models
│   ├── database.py   # Database connection config
│   ├── routers/      # API endpoints (patients, doctors, visits, transcribe, emr, export, analytics, qr, sharing, consent)
│   ├── services/     # Core ML services (Whisper transcription, Claude EMR generation, etc.)
│   └── .env          # Environment variables (API keys)
├── frontend/         # Next.js 16 application
│   ├── src/
│   │   ├── app/      # Pages and components
│   │   └── lib/
│   │       └── api.ts  # Centralized API service layer
│   └── next.config.ts  # Proxy rewrites to backend
└── README.md
```

## Quick Start

### 1. AI Setup (Free — Ollama)

```bash
# Install Ollama from https://ollama.com
# Then pull a model:
ollama pull mistral
```

### 2. Backend

```bash

python -m venv .venv


& ".\\.venv\\Scripts\\Activate.ps1"
pip install -r backend\\requirements.txt
cd backend
python -m uvicorn main:app --reload --port 8000
```

API docs available at http://localhost:8000/docs

> No API keys needed! Ollama runs locally for free.

### 3. Frontend

```bash
# In a second terminal, from project root:
cd frontend
npm install
npm run dev
```

App available at http://localhost:3000

### 4. Run Both Servers (Recommended Workflow)

Terminal 1 (Backend):

```bash
& ".\\.venv\\Scripts\\Activate.ps1"
cd backend
python -m uvicorn main:app --reload --port 8000
```

Terminal 2 (Frontend):

```bash
cd frontend
npm run dev
```

### Key Features

- **Live Scribe**: Real-time audio transcription (Web Speech API) with AI-powered EMR extraction
- **EMR Generation**: Claude-powered structured data extraction (Chief Complaint, HPI, Diagnosis, Medications, Plan)
- **Disease Risk Assessment**: Automated flu, migraine, and fatigue probability scoring
- **Hallucination Detection**: Built-in safety checks for AI-generated content
- **Patient Management**: Full CRUD with ABHA ID integration
- **Analytics**: Patient timelines, symptom tracking, risk trends
- **Export**: PDF visit reports with complete clinical data
- **Multi-role Dashboard**: Admin, Doctor, Receptionist, Pharmacist views
