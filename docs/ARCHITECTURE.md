# MediScribe — Architecture Document

**Version:** 2.0  
**Date:** 2026-09-21  
**Status:** Active Development

---

## 1. Architectural Style

**Pattern**: Modular Monolith with Plugin-Style Services  
**Backend**: FastAPI (Python 3.12+) — async, type-safe, OpenAPI-native  
**Frontend**: Next.js 16 (React 19, App Router, TypeScript)  
**Database**: PostgreSQL 16 + SQLModel (asyncpg)  
**Communication**: REST + WebSocket (real-time ASR)  
**Deployment**: Docker Compose (dev), Kubernetes-ready (prod)

---

## 2. High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Doctor     │  │ Pharmacist  │  │ Receptionist│  │   Admin     │        │
│  │  Dashboard  │  │  Dashboard  │  │  Dashboard  │  │  Dashboard  │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
└─────────┼────────────────┼────────────────┼────────────────┼────────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY (FastAPI)                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │   Auth       │ │  Clinical    │ │  Intelligence│ │  Pharmacy    │       │
│  │   Router     │ │  Routers     │ │  Routers     │ │  Routers     │       │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘       │
└─────────┼────────────────┼────────────────┼────────────────┼────────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SERVICE LAYER                                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │Transcription│ │  EMR Engine │ │ Hindi EMR   │ │  Analytics  │          │
│  │  Service    │ │ (3-Agent)   │ │  Service    │ │  Service    │          │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘          │
│         │               │               │               │                  │
│         ▼               ▼               ▼               ▼                  │
│  ┌─────────────────────────────────────────────────────────────────┐      │
│  │                    PROVIDER ABSTRACTION LAYER                    │      │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │      │
│  │  │ NVIDIA   │ │  Ollama  │ │ OpenAI   │ │Anthropic │           │      │
│  │  │ Riva ASR │ │ (Mistral)│ │ (gpt-4o) │ │(Claude)  │           │      │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │      │
│  └─────────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                         │
│  ┌─────────────┐                    ┌─────────────┐                        │
│  │ PostgreSQL  │                    │    Redis    │                        │
│  │  (Primary)  │                    │  (Cache/    │                        │
│  │             │                    │   Queue)    │                        │
│  └─────────────┘                    └─────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Backend Module Structure

```
backend/
├── main.py                    # FastAPI app, router registration, lifespan
├── models.py                  # SQLModel definitions (all entities)
├── database.py                # Engine, session, create_db_and_tables
├── requirements.txt           # Python dependencies
├── .env.example               # Environment template
├── routers/                   # API endpoints (1 per domain)
│   ├── __init__.py
│   ├── auth.py                # JWT login, register, me
│   ├── patients.py            # Patient CRUD, queue status
│   ├── doctors.py             # Doctor CRUD, clinic info
│   ├── visits.py              # Visit lifecycle, status transitions
│   ├── transcribe.py          # File upload transcription (legacy)
│   ├── nvidia_asr.py          # WebSocket streaming ASR
│   ├── emr.py                 # Agent 1 + 2: /generate-emr/
│   ├── hindi_summary.py       # Agent 3: /hindi-summary/
│   ├── export.py              # PDF generation, ABDM export
│   ├── analytics.py           # Timeline, symptoms, risk trends
│   ├── inventory.py           # Pharmacy stock CRUD
│   ├── qr.py                  # QR code generation, scan tracking
│   ├── sharing.py             # Inter-doctor record sharing
│   ├── consent.py             # Consent logging, revocation
│   └── trae.py                # Debug/test endpoints
├── services/                  # Business logic (stateless, testable)
│   ├── __init__.py
│   ├── transcription.py       # Unified ASR interface → NVIDIA Riva
│   ├── nvidia_transcription.py# Riva gRPC client, audio buffering
│   ├── emr_engine.py          # 3-agent pipeline orchestration
│   ├── emr_router.py          # Fine-tuned Mistral routing (alt path)
│   ├── hindi_emr.py           # Google Translate Hindi output
│   ├── drug_interactions.py   # Interaction knowledge base
│   ├── rouge_evaluator.py     # ROUGE metric computation
│   ├── abha_client.py         # ABDM API integration (stub)
│   ├── pdf_generator.py       # ReportLab PDF generation
│   ├── prescription_generator.py
│   ├── qr_generator.py        # QR code generation
│   ├── share_engine.py        # Record sharing logic
│   ├── consent_logger.py      # Consent audit trail
│   ├── audio_cleanup.py       # Temp file management
│   └── abnormal_alerts.py     # Clinical alert rules
└── evaluation/                # Benchmarking & fine-tuning
    ├── benchmark.py           # ROUGE vs Eka dataset
    ├── mediscribe_schema.py   # Normalization for evaluation
    ├── finetune_prep.py       # Training data preparation
    └── finetune_runner.py     # LoRA fine-tuning orchestration
```

---

## 4. Frontend Module Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout, providers
│   │   ├── page.tsx                   # Landing page
│   │   ├── login/
│   │   │   ├── page.tsx               # Role selection
│   │   │   ├── RoleLoginLayout.tsx    # Shared login chrome
│   │   │   ├── doctor/page.tsx
│   │   │   ├── pharmacist/page.tsx
│   │   │   ├── receptionist/page.tsx
│   │   │   └── admin/page.tsx
│   │   ├── dashboard/
│   │   │   ├── layout.tsx             # Sidebar, header, role guards
│   │   │   ├── page.tsx               # Overview
│   │   │   ├── DashboardLayout.tsx    # Layout wrapper
│   │   │   ├── GlobalStateContext.tsx # Zustand-like context (patients, cache)
│   │   │   ├── scribe/
│   │   │   │   ├── page.tsx           # Main scribe workspace (1100+ lines)
│   │   │   │   └── ScribeClient.tsx   # Legacy component
│   │   │   ├── review/page.tsx        # Doctor review & sign-off
│   │   │   ├── handover/page.tsx      # Pharmacy dispatch + Hindi card
│   │   │   ├── schedule/page.tsx      # Appointment calendar
│   │   │   ├── analytics/page.tsx     # Clinic analytics dashboard
│   │   │   ├── patients/page.tsx      # Patient list/management
│   │   │   ├── alerts/page.tsx        # Clinical safety alerts
│   │   │   ├── reception-queue/page.tsx
│   │   │   └── admin/
│   │   │       ├── users/page.tsx
│   │   │       ├── employees/page.tsx
│   │   │       └── clinic/page.tsx
│   │   └── components/                # Shared UI primitives
│   │       ├── Navbar.tsx
│   │       ├── SplitLayout.tsx
│   │       ├── Hero.tsx
│   │       ├── Features.tsx
│   │       ├── DashboardShowcase.tsx
│   │       ├── Footer.tsx
│   │       └── ChaosFeed.tsx
│   ├── lib/
│   │   ├── api.ts                     # Centralized API client (all endpoints)
│   │   └── useNvidiaASR.ts            # WebSocket ASR hook
│   └── styles/
│       ├── globals.css                # CSS variables, reset
│       └── Dashboard.module.css       # Dashboard-specific styles
├── next.config.ts                     # Rewrites → backend
├── package.json
├── tsconfig.json
└── tailwind.config.ts                 # Not used (custom CSS variables)
```

---

## 5. Data Flow: 3-Stage Pipeline

### 5.1 Stage 1: Transcription (ASR)

```
Browser Mic (MediaRecorder)
       │
       ▼
AudioContext (native rate: 44.1/48kHz)
       │
       ▼
ScriptProcessorNode → Resample to 16kHz → Int16 PCM
       │
       ▼
base64 encode
       │
       ▼
WebSocket (ws://localhost:8000/nvidia-asr/stream)
       │
       ▼
┌─────────────────────────────────────┐
│  Backend: nvidia_asr.py             │
│  • Audio buffer accumulation        │
│  • VAD (frame-level energy)         │
│  • Chunk flush logic (1.5s min)     │
│  • Deduplication & hallucination    │
│    filtering                        │
└─────────────────────────────────────┘
       │
       ▼
NVIDIA Riva ASR (gRPC)
       │
       ▼
Whisper Large v3 (NIM)
       │
       ▼
Transcript text → WebSocket → Frontend
```

**Key Parameters** (in `nvidia_asr.py`):
```python
MIN_CHUNK_SECONDS = 1.5          # Min audio before transcribe
MIN_FINAL_CHUNK_SECONDS = 0.6    # On stop, accept shorter
FORCE_FLUSH_SECONDS = 6.0        # Max buffer before force
TRAILING_SILENCE_SECONDS = 0.7   # Silence detection
SPEECH_THRESHOLD = 900           # PCM energy threshold
MAX_CONTEXT_WORDS = 80           # Prompt context window
```

### 5.2 Stage 2: 3-Agent EMR Pipeline

```
Full Transcript (from Stage 1)
       │
       ▼
┌─────────────────────────────────────────────────────┐
│ AGENT 1: EXTRACTOR (emr_engine.py)                  │
│ • System prompt: EXTRACTOR_PROMPT / _COMPACT        │
│ • User message: transcript                          │
│ • Output: Structured EMR + confidence tags          │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│ TRANSCRIPT GROUNDING (deterministic)                │
│ • _extract_simple_medications()  — regex + aliases  │
│ • _extract_simple_investigations() — pattern match  │
│ • _apply_transcript_grounding() — reconcile         │
│ • Removes unsupported LLM claims                    │
│ • Sets hallucinationCheck.isHallucinated = true     │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│ AGENT 2: SAFETY CHECKER (emr_engine.py)             │
│ • Input: Grounded EMR + patient allergies/history   │
│ • System prompt: SAFETY_CHECKER_PROMPT / _COMPACT   │
│ • Output: safetyFlags[], overallSafetyStatus        │
└─────────────────────────────────────────────────────┘
       │
       ▼
EMR + SafetyCheck → Frontend (confidence badges)
       │
       ▼ (Doctor confirms yellow fields → clicks Approve)
       ▼
┌─────────────────────────────────────────────────────┐
│ AGENT 3: HINDI SUMMARIZER (hindi_summary.py)        │
│ • Called separately via /hindi-summary/             │
│ • Input: Approved EMR                               │
│ • System prompt: HINDI_SUMMARIZER_PROMPT            │
│ • Output: Patient-facing Hinglish JSON              │
└─────────────────────────────────────────────────────┘
```

**Provider Fallback Chain** (in `emr_engine.py:_call_llm`):
```python
1. Ollama (local)          → model: mistral, format: json, temp: 0
2. OpenAI (cloud)          → gpt-4o-mini, response_format: json_object
3. Blackbox AI (cloud)     → blackboxai/openai/gpt-4
4. Anthropic (cloud)       → claude-3-5-sonnet-20241022
5. Fast Regex Fallback     → _build_fast_fallback_emr()
```

### 5.3 Stage 3: Clinical Workflow

```
Approved EMR
       │
       ├──────────────────┐
       ▼                  ▼
┌─────────────┐    ┌─────────────┐
│  Export     │    │  Pharmacy   │
│  (PDF/ABDM) │    │  Dispense   │
└─────────────┘    └─────────────┘
       │                  │
       ▼                  ▼
┌─────────────────────────────────────┐
│  Analytics / ABDM Sync              │
│  • Timeline                         │
│  • Risk trends                      │
│  • Consent logs                     │
│  • QR sharing                       │
└─────────────────────────────────────┘
```

---

## 6. Service Contracts

### 6.1 Transcription Service (`services/transcription.py`)

```python
async def transcribe_audio(file_path: str, language: str = None) -> str:
    """
    Single entry point for file-based transcription.
    Delegates to NVIDIA Riva service.
    """
```

### 6.2 EMR Engine (`services/emr_engine.py`)

```python
def generate_emr_from_transcript(transcript: str) -> dict:
    """
    Main pipeline entry point.
    Returns: {
        # Agent 1 output (grounded)
        "chiefComplaint": {"value", "confidence"},
        "medications": [{"name", "dosage", "frequency", "confidence"}],
        ...
        # Agent 2 output
        "safetyCheck": {
            "safetyFlags": [...],
            "overallSafetyStatus": "safe|warnings_present|critical_flags",
            "checkedAt": "ISO8601"
        },
        # Metadata
        "mode": "llm|fallback",
        "modelAttempted": "mistral",
        "providerChain": ["ollama", "openai", ...],
        "agentsCompleted": ["extractor", "safety"],
        "pipelineTimeSecs": 4.2
    }
```

### 6.3 Hindi EMR (`services/hindi_emr.py`)

```python
def emr_to_hindi(emr: dict) -> dict:
    """Translate clinical fields to Hindi via Google Translate."""
    # TRANSLATE_FIELDS: chiefComplaint, hpi, examFindings, diagnosis, plan, pastHistory, allergies
    # KEEP_ENGLISH_FIELDS: medications, followUpDays, diseaseRisk, hallucinationCheck
```

### 6.4 NVIDIA Transcription (`services/nvidia_transcription.py`)

```python
class NvidiaTranscriptionService:
    async def transcribe_audio_bytes(audio_bytes: bytes, language: str) -> str
    async def transcribe_file(file_path: str, language: str) -> str
    async def transcribe_buffer(language: str) -> str  # WebSocket buffer
    def build_prompt(recent_transcript: str) -> str    # Medical context prompt
    def is_available() -> bool
```

---

## 7. Database Schema (SQLModel)

### 7.1 ER Diagram (Text)

```
UserAccount ◄── Doctor (1:1 via doctorId)
Doctor ──► Patient (1:N)
Patient ──► Visit (1:N)
Visit ──► EMR (1:1)
Visit ──► DiseaseRisk (1:1)
Visit ──► QRCode (1:1 via Doctor)
Patient ──► ConsentLog (1:N)
Patient ──► PatientShareConsent (1:N)
Visit ──► DispenseLog (1:N via patientId)
PharmacyInventory ──► DispenseLog (1:N)
```

### 7.2 Key Indexes

```sql
-- High-traffic lookups
CREATE INDEX ix_visits_patient_id ON visits(patientId);
CREATE INDEX ix_visits_status ON visits(status);
CREATE INDEX ix_emrs_visit_id ON emrs(visitId);  -- UNIQUE
CREATE INDEX ix_patients_abha_id ON patients(abhaId);
CREATE INDEX ix_consent_logs_patient_doctor ON consent_logs(patientId, doctorId);
CREATE INDEX ix_dispense_logs_patient ON dispense_logs(patientId);
```

---

## 8. Security Architecture

### 8.1 Authentication Flow

```
Client          Backend
  │                │
  ├─ POST /auth/login (username, password)
  │                │
  │◄─ JWT Access Token (HS256, 24h expiry)
  │                │
  ├─ GET /patients (Authorization: Bearer <token>)
  │                │
  │◄─ 200 OK + data
```

### 8.2 Role-Based Access Control

| Endpoint | Doctor | Pharmacist | Receptionist | Admin |
|----------|--------|------------|--------------|-------|
| `/patients/*` | R/W (own) | R | R/W | R/W (all) |
| `/visits/*` | R/W | R | R (queue) | R |
| `/generate-emr/` | ✓ | ✗ | ✗ | ✓ |
| `/hindi-summary/` | ✓ | ✓ | ✗ | ✓ |
| `/inventory/*` | R | R/W | R | R/W |
| `/dispense` | ✗ | ✓ | ✗ | ✓ |
| `/analytics/*` | ✓ (own) | ✗ | ✗ | ✓ (all) |
| `/qr/*, /sharing/*, /consent/*` | ✓ | ✗ | ✗ | ✓ |

### 8.3 Data Protection

- **PHI minimization**: Only store clinically necessary fields
- **Audit trail**: All EMR edits log `editedByDoctor=true`, consent logs immutable
- **Encryption**: TLS 1.3 (ingress), PostgreSQL `pgcrypto` for sensitive columns (future)
- **Secrets**: `.env` only, never committed; Docker secrets in prod

---

## 9. Observability

### 9.1 Structured Logging (structlog)

```python
# In emr_engine.py
logger = logging.getLogger("mediscribe.pipeline")

logger.info("[Pipeline] Agent 1 — Extracting structured EMR...")
logger.info(f"[Pipeline] Agent 1 completed in {agent1_time:.1f}s")
logger.error(f"[Pipeline] Agent 1 FAILED: {e}")
```

**Log Fields**: `timestamp`, `level`, `logger`, `event`, `pipeline_stage`, `provider`, `latency_ms`, `request_id`

### 9.2 Key Metrics

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| `asr_latency_ms` | `nvidia_asr.py` | p99 > 3000 |
| `emr_agent1_latency_ms` | `emr_engine.py` | p99 > 5000 |
| `emr_agent2_latency_ms` | `emr_engine.py` | p99 > 3000 |
| `llm_provider_fallback` | `emr_engine.py` | > 10% non-Ollama |
| `hallucination_rate` | `emr_engine.py` | > 5% |
| `ws_connection_errors` | `nvidia_asr.py` | > 1% |
| `api_error_rate` | FastAPI middleware | > 2% |

### 9.3 Health Endpoints

| Endpoint | Checks |
|----------|--------|
| `GET /health` | Basic liveness |
| `GET /nvidia-asr/status` | Riva gRPC connectivity |
| `GET /nvidia-asr/test` | End-to-end silent audio test |
| `GET /analytics/benchmark` | ROUGE benchmark status |

---

## 10. Development Workflow

### 10.1 Local Setup

```bash
# 1. Start infrastructure
docker compose up -d postgres redis ollama

# 2. Pull Ollama model
docker exec -it mediscribe-ollama ollama pull mistral

# 3. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Add NVIDIA_API_KEY
python -m uvicorn main:app --reload --port 8000

# 4. Frontend
cd frontend
npm install
npm run dev  # http://localhost:3000
```

### 10.2 Running Benchmarks

```bash
cd backend
python -m evaluation.benchmark --samples 20 --output benchmark_results.json
```

### 10.3 Code Quality

```bash
# Backend
cd backend
ruff check .           # Lint
ruff format .          # Format
mypy .                 # Type check
pytest                 # Unit tests

# Frontend
cd frontend
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run test           # Vitest
```

---

## 11. Decision Log (ADR)

| ADR | Decision | Date | Rationale |
|-----|----------|------|-----------|
| ADR-001 | NVIDIA Riva ASR over Groq/OpenAI Whisper | 2026-09 | HIPAA-ready, multilingual, gRPC streaming, medical prompt support |
| ADR-002 | Ollama (Mistral) as primary LLM | 2026-09 | Zero cost, data privacy, offline-capable, tunable |
| ADR-003 | 3-Agent pipeline with confidence tags | 2026-09 | Clinical safety requires transparency; doctor-in-the-loop |
| ADR-004 | Commit-on-approval for Hindi summary | 2026-09 | Prevents premature patient communication; medico-legal safety |
| ADR-005 | Transcript grounding via deterministic regex | 2026-09 | LLM hallucination mitigation without second model call |
| ADR-006 | SQLModel over raw SQLAlchemy | 2026-09 | Type-safe ORM, Pydantic integration, migration-friendly |
| ADR-006 | Next.js App Router over Pages | 2026-09 | Server components, streaming, modern React patterns |

---

## 12. Scaling Strategy

| Component | Horizontal Scaling | State |
|-----------|-------------------|-------|
| FastAPI Workers | ✓ (stateless) | Redis session cache |
| NVIDIA Riva ASR | NIM auto-scaling | Stateless per request |
| Ollama | Multiple replicas + load balancer | Model in shared volume |
| PostgreSQL | Read replicas | Primary writer |
| Redis | Cluster mode | Sharded |

---

*End of Architecture Document*