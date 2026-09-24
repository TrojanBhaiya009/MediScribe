# MediScribe — Product Requirements Document (PRD)

**Version:** 2.0  
**Date:** 2026-09-21  
**Status:** Active Development  
**Product Owner:** Clinical AI Team  
**Engineering Lead:** Backend/Frontend Engineers

---

## 1. Executive Summary

### 1.1 Product Vision
MediScribe is an **AI-powered clinical CRM** purpose-built for Indian outpatient clinics. It eliminates documentation burden by converting live doctor-patient consultations (in Hinglish) into structured, safety-checked EMRs — with patient-facing Hindi summaries generated only after doctor approval.

### 1.2 Problem Statement
Indian clinicians face:
- **30-50% consult time lost to typing** — EMR entry during/after visits
- **Language mismatch** — Consultations in Hinglish; patients need Hindi summaries
- **Prescription errors** — No automated drug interaction/allergy checking
- **Compliance gaps** — ABHA integration, consent logging, audit trails missing
- **No longitudinal intelligence** — Each visit treated in isolation

### 1.3 Solution
A **3-stage pipeline** with clinical safety at its core:
1. **Transcription** — NVIDIA Riva Whisper Large v3 (Hinglish, medical vocabulary)
2. **3-Agent EMR** — Extractor (confidence tags) → Safety Checker → Hindi Summarizer (post-approval)
3. **Workflow** — ABDM-native queue, pharmacy dispatch, analytics, QR sharing

### 1.4 Success Metrics (North Star)

| Metric | Baseline | Target (3 mo) | Target (12 mo) |
|--------|----------|---------------|----------------|
| **Time-to-EMR** (mic → approved) | 15 min manual | < 2 min | < 90 sec |
| **Doctor adoption** (daily active) | 0% | 60% | 90% |
| **ROUGE-1 vs Eka benchmark** | 0.0 | > 0.65 | > 0.72 |
| **Safety flag detection rate** | N/A | > 95% known interactions | > 99% |
| **Hindi summary generation** | Manual | 100% auto post-approval | 100% |
| **ABHA-linked patients** | < 10% | > 50% | > 90% |

---

## 2. User Personas

### 2.1 Primary: Dr. Priya Sharma (General Physician)
- **Clinic**: 30-patient/day solo practice, Tier-2 city
- **Pain**: Types notes between patients; misses drug interactions; patients don't understand English prescriptions
- **Workflow**: Sees patient → Talks in Hinglish → Needs structured record → Prints Hindi summary for patient
- **Tech comfort**: Moderate; uses smartphone, WhatsApp, basic EMR

### 2.2 Secondary: Rajesh (Pharmacist)
- **Role**: Dispenses prescriptions, manages inventory
- **Pain**: Illegible handwriting; stockouts discovered at dispense time; no patient context
- **Workflow**: Receives approved Rx → Checks stock → Dispenses → Prints handover card
- **Need**: Real-time stock alerts, clear medication instructions in Hindi

### 2.3 Secondary: Anita (Receptionist)
- **Role**: Queue management, patient registration, ABHA linking
- **Pain**: Paper forms, duplicate entries, no QR check-in
- **Workflow**: Walk-in → Register/QR scan → Assign to doctor queue → Update status
- **Need**: One-click QR registration, ABHA auto-fill, status board

### 2.4 Tertiary: Dr. Arjun Mehta (Clinic Owner/Admin)
- **Role**: Multi-doctor clinic, compliance, analytics
- **Pain**: No visibility into clinic performance; ABDM audit risk; doctor burnout
- **Workflow**: Reviews daily summaries → Checks safety alerts → Reviews analytics → Ensures compliance
- **Need**: Doctor-wise dashboards, longitudinal patient trends, audit-ready logs

---

## 3. Feature Requirements

### 3.1 Epic 1: Live Scribe Workspace (Doctor Dashboard)

#### 3.1.1 Audio Capture & Transcription
| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| SC-01 | Start/Stop microphone with visual feedback | P0 | Mic button toggles; red REC indicator; interim transcript shows |
| SC-02 | ASR provider selection: NVIDIA Riva Whisper / Web Speech | P0 | Dropdown shows both; persists selection; shows availability |
| SC-03 | Hinglish auto-detection (no language selection needed) | P0 | Hindi+English mixed speech transcribed correctly |
| SC-04 | Medical vocabulary preservation (drug names, dosages, investigations) | P0 | "Sumatriptan 50mg SOS" → exact match in transcript |
| SC-05 | Hallucination filtering (silence, repetition, foreign scripts) | P1 | Empty/garbage audio returns empty transcript |
| SC-06 | WebSocket streaming with < 2s chunk latency | P1 | Transcript appears within 2s of speech pause |

#### 3.1.2 Transcript Display
| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| SC-07 | Speaker-labeled transcript (Doctor/Patient/ASR) | P0 | Color-coded badges; timestamps; auto-scroll |
| SC-08 | Duplicate transcript suppression | P1 | Repeated segments not duplicated in UI |
| SC-09 | Patient selection from waiting queue | P0 | Dropdown shows waiting patients; ABHA ID visible |

#### 3.1.3 EMR Generation (3-Agent Pipeline)
| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| SC-10 | One-click "Generate EMR" after recording | P0 | Button enabled only with transcript; shows pipeline progress |
| SC-11 | Agent 1: Structured EMR with confidence tags (green/yellow/blank) | P0 | All fields show confidence badge; yellow = needs confirmation |
| SC-12 | Agent 2: Safety check (allergies, interactions, contraindications) | P0 | Safety banner shows flags; critical = blocks approval |
| SC-13 | Transcript grounding — deterministic verification of LLM output | P0 | Unsupported claims removed; hallucinationCheck set |
| SC-14 | Yellow field confirmation workflow (one-click confirm/edit) | P0 | Click badge → confirm; double-click field → edit → auto-confirm |
| SC-15 | "Approve & Commit" only when all yellow fields resolved | P0 | Button disabled with count; confirmation dialog on safety flags |
| SC-16 | Reset consultation (discard EMR, return patient to queue) | P1 | Confirmation dialog; clears cache; patient status → Waiting |

#### 3.1.4 Hindi Summary (Agent 3)
| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| SC-17 | Generate only after doctor approval (commit-on-approval) | P0 | `/hindi-summary/` called post-approve; not before |
| SC-18 | Patient-facing Hinglish: diagnosisSimple, medicationInstructions[], followUpNote | P0 | Devanagari + English terms; "Sumatriptan 50mg — जब दर्द शुरू हो तब एक गोली लें" |
| SC-19 | Warning field per medication (contraindications in plain language) | P1 | "Ibuprofen मत लें — पेट ख़राब हो सकता है" |

---

### 3.2 Epic 2: Review & Sign-Off (Doctor)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| RV-01 | Safety flag banner (critical/warning/none) with details | P0 | Shows Agent 2 output; click to expand |
| RV-02 | Verification checklist (Vitals, HPI, ICD-10, Meds) | P0 | All 4 must be checked to enable Sign-Off |
| RV-03 | Editable clinical note (Vitals, HPI, Diagnosis, Investigations, Rx) | P0 | Click to edit; auto-populated from EMR |
| RV-04 | Print prescription (ABDM-compliant PDF with clinic header, Rx symbol) | P0 | Opens print dialog; formatted for A4 |
| RV-05 | Sign-Off → moves patient to Pharmacy queue | P0 | Status: Reviewing → Pharmacy; ABDM sync stub called |

---

### 3.3 Epic 3: Pharmacy Dispatch & Patient Handover

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| PH-01 | Pharmacy queue (Pending Dispense / Dispensed tabs) | P0 | Shows patients with status=Pharmacy; click to select |
| PH-02 | Clinical summary preview (PDF-style) with medications | P0 | Shows diagnosis, Rx with dosage/frequency |
| PH-03 | Real-time inventory alerts on medications (out of stock / low stock) | P0 | Red/amber badges on Rx items; "⚠️ Out of stock" |
| PH-04 | "Mark Dispensed & Close Case" → updates inventory, logs dispense | P0 | POST /dispense; patient status → Completed |
| PH-05 | Patient handover card (Hindi summary from Agent 3) | P0 | Shows diagnosisSimple, medicationInstructions, followUpNote |
| PH-06 | Fallback discharge card if Hindi summary not yet generated | P1 | Static card with "Generate via Scribe page" prompt |

---

### 3.4 Epic 4: Patient Management & ABDM Compliance

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| PM-01 | Patient CRUD with ABHA ID field (14-digit validation) | P0 | Create/read/update/delete; ABHA format check |
| PM-02 | Queue status workflow: Waiting → Transcribing → Reviewing → Pharmacy → Completed | P0 | Status transitions enforced; badge colors |
| PM-03 | QR code generation per doctor (registration + scan tracking) | P1 | `/qr/generate` returns scanUrl; scanCount increments |
| PM-04 | Consent logging (recording, sharing, QR registration) | P1 | Immutable logs; revocation support |
| PM-05 | Inter-doctor record sharing with patient consent | P2 | `/sharing/request` → consent → share → audit trail |

---

### 3.5 Epic 5: Analytics & Clinical Intelligence

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| AN-01 | Patient timeline (all visits, diagnoses, medications, risk scores) | P0 | `/analytics/patients/{id}/timeline` reverse chronological |
| AN-02 | Recurring symptom detection (>30% visits) | P1 | `/analytics/patients/{id}/symptoms` with flags |
| AN-03 | Disease risk trend over time (flu, migraine, diabetes, HTN, fatigue) | P1 | `/analytics/patients/{id}/risk-trend` with direction arrows |
| AN-04 | Doctor clinic summary (patients, visits, language distribution) | P1 | `/analytics/doctors/{id}/summary` |
| AN-05 | ROUGE benchmark vs Eka dataset (CI-integrated) | P2 | `python -m evaluation.benchmark` passes threshold |

---

### 3.6 Epic 6: Multi-Role Dashboards

| Role | Key Views | Permissions |
|------|-----------|-------------|
| **Doctor** | Scribe, Review, Schedule, Analytics, Patients, Alerts | Own patients only |
| **Pharmacist** | Handover, Inventory | Dispense, stock alerts |
| **Receptionist** | Reception Queue, Patient Registration, QR | All patients (read), queue management |
| **Admin** | All + User Management, Clinic Settings, Audit Logs | Full access |

---

## 4. User Experience Requirements

### 4.1 Design Principles (per AGENTS.md)
- **Deliberately clinical** — No SaaS gloss, glow effects, or decorative icons
- **Typography-first hierarchy** — Spacing, rules, strong editorial type over cards
- **Square geometry** — 0-4px radius; larger only when content demands
- **Warm paper/charcoal palette** — Not blue/purple "AI" gradients
- **Functional motion only** — Respects `prefers-reduced-motion`
- **Keyboard accessible** — Focus visible, labels, contrast AA+

### 4.2 Key UX Flows

#### Flow 1: New Consultation (Doctor)
```
1. Doctor logs in → Dashboard
2. Selects patient from Waiting queue (or creates new)
3. Clicks START MIC (NVIDIA Riva Whisper selected)
4. Consultation proceeds in Hinglish → Live transcript appears
5. Clicks STOP → Clicks GENERATE EMR
6. Reviews confidence badges → Confirms yellow fields
7. Clicks APPROVE & COMMIT → Hindi summary auto-generates
8. Patient moves to Review → Doctor verifies checklist → Signs off
9. Patient moves to Pharmacy
```

#### Flow 2: Pharmacy Dispense
```
1. Pharmacist logs in → Handover page
2. Sees pharmacy queue (Pending Dispense)
3. Clicks patient → Views clinical summary + Hindi card
4. Checks inventory alerts on medications
5. Clicks MARK DISPENSED → Inventory updated, dispense logged
6. Patient status → Completed
```

#### Flow 3: Receptionist Check-in
```
1. Receptionist logs in → Reception Queue
2. Walk-in patient → "Register Patient" or "Scan QR"
3. Fills demographics + ABHA ID → Patient added to Waiting queue
4. Doctor sees patient in Scribe dropdown
```

---

## 5. Technical Requirements

### 5.1 Backend (FastAPI)
| Requirement | Specification |
|-------------|---------------|
| **Python** | 3.12+ |
| **Framework** | FastAPI 0.115+ (async, lifespan, dependency injection) |
| **ORM** | SQLModel (SQLAlchemy 2.0 + Pydantic) |
| **Database** | PostgreSQL 16 (asyncpg driver) |
| **Auth** | JWT (HS256), 24h expiry, role claims |
| **ASR** | NVIDIA Riva gRPC client (`riva.client`) |
| **LLM** | Ollama (local) primary; OpenAI/Anthropic/Blackbox fallbacks |
| **Translation** | `deep_translator` (Google Translate free tier) |
| **PDF** | ReportLab |
| **QR** | `qrcode[pil]` |
| **Benchmark** | `datasets`, `rouge-score` |

### 5.2 Frontend (Next.js 16)
| Requirement | Specification |
|-------------|---------------|
| **React** | 19 (App Router, Server Components) |
| **Language** | TypeScript 5.5+ (strict mode) |
| **Styling** | CSS Modules + CSS Variables (no Tailwind) |
| **State** | React Context (`GlobalStateContext`) |
| **API Client** | Centralized `lib/api.ts` (fetch wrapper) |
| **ASR Hook** | `useNvidiaASR.ts` (WebSocket + MediaRecorder) |
| **Build** | Turbopack (dev), Static export ready |

### 5.3 Infrastructure
| Component | Dev | Production Target |
|-----------|-----|-------------------|
| **Container** | Docker Compose | Kubernetes (EKS/GKE) |
| **Database** | Local Postgres | Managed (RDS/Cloud SQL) |
| **Cache/Queue** | Local Redis | ElastiCache / Memorystore |
| **ASR** | NVIDIA NIM (cloud) | NIM dedicated endpoint |
| **LLM** | Ollama (local) | Ollama cluster / vLLM |
| **Monitoring** | Console logs | Prometheus + Grafana |
| **Logging** | stdout JSON | Loki / CloudWatch |

---

## 6. Non-Functional Requirements

### 6.1 Performance
| Scenario | Target |
|----------|--------|
| ASR chunk transcription | < 2s (p95) |
| Agent 1 (Extractor) | < 3s (Ollama local) |
| Agent 2 (Safety) | < 1.5s |
| Agent 3 (Hindi) | < 2s |
| End-to-end (mic → approved EMR) | < 10s |
| WebSocket concurrent connections | 50+ per backend pod |
| API response (non-streaming) | < 500ms (p95) |

### 6.2 Reliability
- **Provider fallback chain**: Ollama → OpenAI → Blackbox → Anthropic → Fast regex
- **Graceful degradation**: Fast regex fallback returns structured EMR (low confidence)
- **Transcript grounding**: Deterministic regex verifies every medication/investigation
- **Retry logic**: Exponential backoff (max 3) for transient LLM failures
- **Circuit breaker**: Provider marked unhealthy after 3 consecutive failures (30s cache)

### 6.3 Security
- **Authentication**: JWT with role claims, HttpOnly cookie option
- **Authorization**: Route-level RBAC middleware
- **Input validation**: Pydantic models on all endpoints
- **SQL injection**: SQLModel parameterized queries
- **PHI handling**: No PHI in logs; audit trail for EMR edits
- **ABDM compliance**: Consent logs, ABHA ID fields, audit-ready

### 6.4 Accessibility
- **WCAG 2.1 AA**: Contrast, focus indicators, semantic HTML
- **Keyboard navigation**: All interactive elements reachable
- **Screen readers**: ARIA labels, live regions for transcript updates
- **Reduced motion**: `prefers-reduced-motion` respected (no pulse animations)

---

## 7. Release Criteria

### 7.1 MVP (Current Sprint)
- [ ] NVIDIA Riva ASR streaming (WebSocket) working end-to-end
- [ ] 3-Agent pipeline: Extractor + Safety + Hindi (commit-on-approval)
- [ ] Confidence badges (green/yellow/blank) with confirm/edit
- [ ] Doctor Review page with safety banner + checklist + print
- [ ] Pharmacy Handover with inventory alerts + Hindi card
- [ ] Patient CRUD with ABHA ID + queue status workflow
- [ ] JWT auth with 4 roles
- [ ] Docker Compose one-command startup
- [ ] Benchmark script runs (ROUGE-1 > 0.65)

### 7.2 V1.1 (Post-MVP, 4 weeks)
- [ ] Speaker diarization in transcript
- [ ] Real-time safety streaming (show flags during generation)
- [ ] Voice commands for EMR editing
- [ ] Multi-language summaries (Marathi, Tamil)
- [ ] FHIR export endpoint
- [ ] Automated CI benchmark gate (ROUGE-1 > 0.65)

### 7.3 V1.2 (Quarter 2)
- [ ] Offline mode (Whisper.cpp + Ollama)
- [ ] Clinical decision support (guideline alerts)
- [ ] Mobile PWA for doctor/patient
- [ ] Advanced analytics (cohort analysis, prescribing patterns)
- [ ] ABDM production integration (not stub)

---

## 8. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| NVIDIA API key expiry / rate limits | Medium | High | Monitor usage dashboard; implement local Whisper.cpp fallback |
| Ollama model quality variance | High | Medium | Pin model version (`mistral:v0.3`); regression test on benchmark |
| Hinglish transcription accuracy | Medium | High | Medical prompt tuning; custom vocabulary via Riva customization |
| Doctor adoption resistance | High | High | UX polish: one-click confirm, keyboard shortcuts, demo mode |
| ABDM API changes | Low | Medium | Abstract behind `abha_client.py`; versioned integration |
| Fine-tuned Mistral drift | Medium | Medium | Monthly benchmark run; retrain on new clinical data |

---

## 9. Dependencies

### 9.1 External Services
| Service | Purpose | SLA Required |
|---------|---------|--------------|
| NVIDIA NIM (Riva ASR) | Speech-to-text | 99.9% uptime, < 500ms latency |
| OpenAI API | LLM fallback | 99.5% uptime |
| Anthropic API | LLM fallback | 99.5% uptime |
| Google Translate (free) | Hindi translation | Best effort |
| HuggingFace Inference | Fine-tuned Mistral alt | Best effort |

### 9.2 Internal Dependencies
- **Ollama** must be running with `mistral` model pulled
- **PostgreSQL** 16+ with `pgvector` extension (future)
- **Redis** 7+ for caching/queue

---

## 10. Go-to-Market Considerations

### 10.1 Target Segments (Priority Order)
1. **Solo practitioners** (Tier-2/3 cities) — Highest pain, fastest adoption
2. **Small multi-doctor clinics** (2-5 doctors) — Need queue/pharmacy/analytics
3. **Corporate health chains** — Need ABDM compliance, central analytics

### 10.2 Pricing Strategy (Future)
| Tier | Target | Model |
|------|--------|-------|
| **Free** | Solo doctors | Local Ollama only; 10 consults/day |
| **Pro** | Small clinics | Cloud LLM fallback; unlimited; pharmacy + analytics |
| **Enterprise** | Chains | ABDM integration; SSO; custom models; SLA |

### 10.3 Differentiators for Sales
1. **Only Hinglish-native scribe** with medical vocabulary preservation
2. **Confidence-tagged EMR** — Doctor sees exactly what AI is sure about
3. **Safety checker reads history** — Not just allergy list
4. **Commit-on-approval Hindi** — Medico-legally sound
5. **Local-first architecture** — Runs offline with Ollama + Whisper.cpp

---

## 11. Appendix

### 11.1 Glossary
| Term | Definition |
|------|------------|
| **ABDM** | Ayushman Bharat Digital Mission (India's health ID framework) |
| **ABHA** | Ayushman Bharat Health Account (14-digit health ID) |
| **Hinglish** | Hindi-English code-switching (dominant in Indian clinical speech) |
| **ROUGE** | Recall-Oriented Understudy for Gisting Evaluation (NLP metric) |
| **Eka Dataset** | HuggingFace `ekacare/clinical_note_generation_dataset` (benchmark) |
| **NIM** | NVIDIA Inference Microservices (containerized model serving) |
| **Riva** | NVIDIA's speech AI SDK (ASR/TTS/NLP) |
| **SOS / PRN** | "As needed" dosing (Latin: *pro re nata*) |

### 11.2 Key Files Reference
| File | Purpose |
|------|---------|
| `backend/services/emr_engine.py` | 3-agent pipeline (Extractor, Safety, Hindi) |
| `backend/services/nvidia_transcription.py` | Riva gRPC client |
| `backend/routers/nvidia_asr.py` | WebSocket streaming endpoint |
| `frontend/src/app/dashboard/scribe/page.tsx` | Main scribe workspace |
| `frontend/src/lib/useNvidiaASR.ts` | ASR WebSocket hook |
| `backend/evaluation/benchmark.py` | ROUGE benchmark runner |

### 11.3 Environment Variables (Production)
```bash
# Required
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxxxxxx
NVIDIA_FUNCTION_ID=b702f636-f60c-4a3d-a6f4-f3568c13bd7d
JWT_SECRET_KEY=your-256-bit-secret

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/mediscribe

# Optional (fallbacks)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx
HF_API_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxx

# Ollama (local)
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=mistral
```

---

*End of Product Requirements Document*