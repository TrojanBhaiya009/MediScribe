# MediScribe — System Design Document

**Version:** 2.0  
**Date:** 2026-09-21  
**Status:** Active Development

---

## 1. System Overview

MediScribe is an AI-powered clinical CRM backend designed for Indian outpatient clinics. It transforms doctor-patient consultations into structured Electronic Medical Records (EMRs) through a 3-stage pipeline: **Transcription → 3-Agent EMR Generation → Workflow Integration**.

### 1.1 Core Value Proposition

- **Hinglish-first**: Native understanding of Hindi-English code-switched medical consultations
- **Confidence-tagged extraction**: Every EMR field annotated with green (explicit), yellow (ambiguous), or blank (not mentioned) confidence
- **Safety-by-design**: Automated drug interaction, allergy conflict, and contraindication checking
- **Commit-on-approval**: Patient-facing Hindi summaries generate only after doctor signs off
- **ABDM-native**: ABHA ID integration, QR registration, consent logging, pharmacy dispatch

### 1.2 Target Users

| Role | Primary Use Case |
|------|------------------|
| **Doctor** | Live scribe during consultation, EMR review/approval, patient handover |
| **Pharmacist** | Prescription dispensing, inventory alerts, patient handover cards |
| **Receptionist** | Patient queue management, QR registration, ABHA linking |
| **Admin** | Clinic analytics, doctor summaries, compliance audit trails |

---

## 2. Functional Requirements

### 2.1 Stage 1: Transcription (ASR)

| Requirement | Specification |
|-------------|---------------|
| **Engine** | NVIDIA Riva ASR (Whisper Large v3) via gRPC |
| **Model** | `whisper-large-v3` hosted on NVIDIA NIM (Inference Microservices) |
| **Audio Format** | 16kHz, 16-bit, mono PCM (WebSocket streaming) |
| **Languages** | Auto-detect (multi), English (en-US), Hindi (hi-IN), Hinglish |
| **Medical Prompting** | Custom prompt preserving medicine names, dosages, investigations |
| **Hallucination Filtering** | Silence detection, repetition filter, foreign script rejection |
| **Latency Target** | < 2s chunk processing, < 500ms WebSocket overhead |

### 2.2 Stage 2: 3-Agent EMR Pipeline

#### Agent 1 — Extractor
- **Input**: Raw transcript (Hinglish/English)
- **Output**: Structured EMR JSON with per-field confidence tags
- **Fields**: chiefComplaint, HPI, pastHistory, medications[], allergies, examFindings, diagnosis, plan, followUpDays, investigations[], diseaseRisk, hallucinationCheck, inferenceNotes
- **Confidence Tags**: `green` (explicit), `yellow` (ambiguous intent), `blank` (not mentioned)
- **Transcript Grounding**: Deterministic regex pass verifies every LLM claim against spoken words

#### Agent 2 — Safety Checker
- **Input**: Agent 1 structured EMR + patient allergies/pastHistory
- **Output**: Safety flags with severity (critical/warning/info)
- **Checks**: Allergy conflicts (class-level), drug-drug interactions, contraindications from history, dosage concerns
- **Trigger**: Runs automatically after Agent 1; skipped in fast fallback mode

#### Agent 3 — Hindi Summarizer
- **Input**: Doctor-approved EMR (post-commit)
- **Output**: Patient-facing Hinglish summary
- **Components**: diagnosisSimple, medicationInstructions[] (name, hindiInstruction, warning), followUpNote, generalAdvice
- **Trigger**: Separate API call `/hindi-summary/` after doctor approval

### 2.3 Stage 3: Clinical Workflow

| Feature | Endpoint | Description |
|---------|----------|-------------|
| **Patient Management** | `/patients`, `/doctors` | CRUD with ABHA ID, queue status |
| **Visit Lifecycle** | `/visits` | DRAFT → CONFIRMED → EXPORTED |
| **EMR Generation** | `/generate-emr` | 3-agent pipeline trigger |
| **Hindi Summary** | `/hindi-summary/` | Agent 3 on approved EMR |
| **Export** | `/export/pdf` | ABDM-compliant PDF generation |
| **Pharmacy** | `/inventory`, `/dispense` | Stock tracking, dispensing logs |
| **ABHA/QR** | `/qr/`, `/sharing/`, `/consent/` | QR registration, record sharing, consent logs |
| **Analytics** | `/analytics/` | Timeline, symptom patterns, risk trends, doctor summary |

---

## 3. Non-Functional Requirements

### 3.1 Performance

| Metric | Target |
|--------|--------|
| Transcription latency (chunk) | < 2s |
| Agent 1 (Extractor) latency | < 3s (Ollama local) |
| Agent 2 (Safety) latency | < 1.5s |
| Agent 3 (Hindi) latency | < 2s |
| End-to-end (mic → approved EMR) | < 10s |
| Concurrent WebSocket connections | 50+ per backend instance |

### 3.2 Reliability

- **Provider fallback chain**: Ollama → OpenAI → Blackbox → Anthropic → Fast regex
- **Graceful degradation**: Fast regex fallback when all LLM providers unavailable
- **Transcript grounding**: Deterministic verification prevents hallucination propagation
- **Retry logic**: Exponential backoff (max 3 retries) for transient LLM failures

### 3.3 Security & Compliance

- **Authentication**: JWT-based with role-based access (Doctor/Pharmacist/Receptionist/Admin)
- **Data encryption**: TLS 1.3 in transit, AES-256 at rest (PostgreSQL)
- **ABDM compliance**: ABHA ID fields, consent logging, audit trails
- **HIPAA-aligned**: No PHI in logs, minimal data retention, access controls
- **Input validation**: Pydantic schemas on all endpoints, SQL injection prevention via SQLModel

### 3.4 Scalability

- **Horizontal scaling**: Stateless FastAPI workers behind load balancer
- **Database**: PostgreSQL with connection pooling (asyncpg)
- **Caching**: Redis for session state, Ollama availability cache (30s TTL)
- **Queue**: Celery + Redis for async tasks (PDF generation, exports)

---

## 4. Data Models

### 4.1 Core Entities

```python
# User & Access
UserAccount          # JWT auth, roles (doctor/pharmacist/receptionist/admin)
Doctor               # Clinic info, clerkId for SSO
Patient              # Demographics, ABHA ID, doctorId FK

# Clinical
Visit                # patientId, status, language, audioUrl, transcript
EMR                  # visitId (1:1), structured fields + confidence tags
DiseaseRisk          # visitId (1:1), 5 disease probabilities
DispenseLog          # inventoryId, patientId, visitId, quantity, dispensedBy

# Compliance
QRCode               # doctorId, scanUrl, scanCount
ConsentLog           # patientId, doctorId, consentType, ipAddress, revokedAt
PatientShareConsent  # fromDoctorId, toDoctorId, consentLogId, revoked

# Pharmacy
PharmacyInventory    # drugName, stock, reorderLevel, expiry, batch, price
```

### 4.2 EMR Confidence Schema

```json
{
  "chiefComplaint": {"value": "string|null", "confidence": "green|yellow|blank"},
  "hpi": {"value": "string|null", "confidence": "green|yellow|blank"},
  "pastHistory": {"value": "string|null", "confidence": "green|yellow|blank"},
  "medications": [{"name": "string", "dosage": "string|null", "frequency": "string|null", "confidence": "green|yellow|blank"}],
  "allergies": {"value": "string|null", "confidence": "green|yellow|blank"},
  "examFindings": {"value": "string|null", "confidence": "green|yellow|blank"},
  "diagnosis": {"value": "string|null", "confidence": "green|yellow|blank"},
  "plan": {"value": "string|null", "confidence": "green|yellow|blank"},
  "followUpDays": {"value": "number|null", "confidence": "green|yellow|blank"},
  "investigations": [{"name": "string", "confidence": "green|yellow|blank"}],
  "diseaseRisk": {"fluProbability": 0.0, "migraineProbability": 0.0, "fatigueProbability": 0.0, "notes": "string|null"},
  "hallucinationCheck": {"isHallucinated": false, "details": "string|null"},
  "inferenceNotes": ["string"]
}
```

---

## 5. API Contract

### 5.1 Transcription

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/nvidia-asr/status` | Check ASR availability |
| `WS` | `/nvidia-asr/stream` | Streaming transcription (config → audio* → stop) |
| `POST` | `/nvidia-asr/transcribe` | File upload transcription |
| `GET` | `/nvidia-asr/test` | Health check with silent audio |

### 5.2 EMR Pipeline

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/generate-emr/` | Agent 1 + Agent 2 (Extractor + Safety) |
| `POST` | `/hindi-summary/` | Agent 3 (Hindi summarizer) on approved EMR |

### 5.3 Clinical Workflow

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/POST` | `/patients/` | Patient CRUD |
| `GET/POST` | `/visits/` | Visit lifecycle |
| `GET/PUT` | `/emr/{visitId}` | EMR read/update (doctor edits) |
| `POST` | `/export/pdf/{visitId}` | Generate visit PDF |
| `GET` | `/analytics/patients/{id}/timeline` | Longitudinal timeline |
| `GET` | `/analytics/patients/{id}/risk-trend` | Disease risk trends |

---

## 6. Integration Points

### 6.1 External Services

| Service | Purpose | Integration |
|---------|---------|-------------|
| **NVIDIA NIM (Riva ASR)** | Speech-to-text | gRPC via `riva.client` SDK, API key auth |
| **Ollama** | Local LLM (Mistral) | HTTP `/api/generate`, JSON format mode |
| **OpenAI** | Cloud fallback (gpt-4o-mini) | REST API, JSON response format |
| **Anthropic** | Cloud fallback (Claude 3.5 Sonnet) | REST API, messages endpoint |
| **Blackbox AI** | Cloud fallback (GPT-4 compatible) | REST API, chat completions |
| **HuggingFace** | Fine-tuned Mistral (alt path) | Inference API, `negi3961/mediscribe-mistral` |
| **Google Translate** | Hindi translation (Agent 3 alt) | `deep_translator` library, free tier |

### 6.2 Internal Services

| Service | Responsibility |
|---------|----------------|
| `transcription.py` | Unified ASR interface (NVIDIA Riva) |
| `emr_engine.py` | 3-agent pipeline orchestration |
| `emr_router.py` | Fine-tuned Mistral routing (alternative path) |
| `hindi_emr.py` | Google Translate-based Hindi output |
| `nvidia_transcription.py` | Riva gRPC client, audio buffering |
| `drug_interactions.py` | Interaction knowledge base (supplements Agent 2) |
| `abha_client.py` | ABDM API integration (stub) |

---

## 7. Deployment Architecture

### 7.1 Development

```yaml
# docker-compose.yml (target)
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: mediscribe
      POSTGRES_USER: mediscribe
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama_data:/root/.ollama
    ports: ["11434:11434"]
    # Pre-pull: ollama pull mistral

  backend:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql+asyncpg://mediscribe:${DB_PASSWORD}@postgres:5432/mediscribe
      - REDIS_URL=redis://redis:6379
      - OLLAMA_BASE_URL=http://ollama:11434
      - NVIDIA_API_KEY=${NVIDIA_API_KEY}
      - NVIDIA_FUNCTION_ID=${NVIDIA_FUNCTION_ID}
    ports: ["8000:8000"]
    depends_on: [postgres, redis, ollama]

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on: [backend]
```

### 7.2 Production Considerations

- **Backend**: 3+ FastAPI workers (uvicorn + gunicorn), health checks at `/health`
- **Database**: Managed PostgreSQL (RDS/Cloud SQL), read replicas for analytics
- **ASR**: NVIDIA NIM managed endpoint, auto-scaling worker pool
- **LLM**: Ollama cluster for local inference; cloud APIs as overflow
- **Monitoring**: Prometheus + Grafana (latency, error rates, provider fallback metrics)
- **Logging**: Structured JSON logs (structlog), correlation IDs per request

---

## 8. Testing Strategy

| Layer | Tool | Coverage Target |
|-------|------|-----------------|
| Unit | pytest | > 80% services/routers |
| Integration | pytest + testcontainers | All API endpoints |
| E2E | Playwright | Critical user flows (scribe → approve → handover) |
| Benchmark | Custom (ROUGE vs Eka) | ROUGE-1 > 0.65 on 20 samples |
| Load | Locust | 50 concurrent WS, 200 req/s REST |

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| NVIDIA API key expiry/rate limits | Medium | High | Monitor usage, cache transcripts, fallback to local Whisper.cpp |
| Ollama model quality variance | High | Medium | Pin model version, regression tests on benchmark dataset |
| Hinglish transcription accuracy | Medium | High | Medical prompt engineering, custom vocabulary via Riva customization |
| Doctor adoption (workflow change) | High | High | UX polish: confidence badges, one-click confirm, keyboard shortcuts |
| ABDM API changes | Low | Medium | Abstract behind `abha_client.py`, versioned integration |

---

## 10. Future Enhancements (Post-MVP)

1. **Speaker diarization** — Separate doctor/patient voices in transcript
2. **Real-time safety streaming** — Show Agent 2 flags during generation (not after)
3. **Voice commands** — "Add Sumatriptan 50mg PRN" → EMR field update
4. **Multi-language summaries** — Marathi, Tamil, Telugu patient handouts
5. **Offline mode** — Local Whisper.cpp + Ollama for air-gapped clinics
6. **FHIR export** — Standards-compliant interoperability
7. **Clinical decision support** — Guideline-based alerts (e.g., diabetes follow-up)
8. **Mobile app** — React Native for doctor/patient handheld use

---

## Appendix A: Environment Variables

```bash
# Backend/.env
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/mediscribe

# NVIDIA Riva ASR (required)
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxxxxxx
NVIDIA_FUNCTION_ID=b702f636-f60c-4a3d-a6f4-f3568c13bd7d
NVIDIA_SERVER_URI=grpc.nvcf.nvidia.com:443

# Ollama (local LLM)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral
OLLAMA_PROMPT_PROFILE=compact
EMR_MAX_RETRIES=0

# Cloud fallbacks (optional)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
ENABLE_OPENAI_FALLBACK=true
OPENAI_EMR_MODEL=gpt-4o-mini

ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx
ENABLE_ANTHROPIC_FALLBACK=false

BLACKBOX_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
ENABLE_BLACKBOX_FALLBACK=false

# HF fine-tuned alt (optional)
HF_API_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxx
HF_MISTRAL_MODEL=negi3961/mediscribe-mistral

# JWT
JWT_SECRET_KEY=your-secret-key-here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

---

*End of System Design Document*