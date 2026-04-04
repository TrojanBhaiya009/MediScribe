'use client';
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type Confidence = 'green' | 'yellow' | 'blank';

export interface ConfidenceField {
    value: string | null;
    confidence: Confidence;
}

export interface MedicationField {
    name: string;
    dosage: string | null;
    frequency: string | null;
    confidence: Confidence;
}

export interface InvestigationField {
    name: string;
    confidence: Confidence;
}

export interface SafetyFlag {
    severity: 'critical' | 'warning' | 'info';
    type: 'drug_interaction' | 'allergy_conflict' | 'contraindication' | 'dosage_concern';
    message: string;
    affectedMedications: string[];
    recommendation: string;
}

export interface SafetyCheck {
    safetyFlags: SafetyFlag[];
    overallSafetyStatus: 'safe' | 'warnings_present' | 'critical_flags' | 'unchecked';
    checkedAt: string | null;
}

export interface DiseaseRisk {
    fluProbability: number;
    migraineProbability: number;
    fatigueProbability: number;
    notes: string | null;
}

export interface HallucinationCheck {
    isHallucinated: boolean;
    details: string | null;
}

export interface HindiMedicationInstruction {
    name: string;
    hindiInstruction: string;
    warning: string | null;
}

export interface HindiSummary {
    patientSummary: {
        diagnosisSimple: string;
        medicationInstructions: HindiMedicationInstruction[];
        followUpNote: string;
        generalAdvice: string;
    };
}

/** Full EMR data from 3-agent pipeline */
export interface PipelineEMR {
    chiefComplaint: ConfidenceField;
    hpi: ConfidenceField;
    pastHistory: ConfidenceField;
    medications: MedicationField[];
    allergies: ConfidenceField;
    examFindings: ConfidenceField;
    diagnosis: ConfidenceField;
    plan: ConfidenceField;
    followUpDays: ConfidenceField;
    investigations: InvestigationField[];
    diseaseRisk: DiseaseRisk;
    hallucinationCheck: HallucinationCheck;
    safetyCheck: SafetyCheck;
    inferenceNotes: string[];
    pipelineVersion: string;
    agentsCompleted: string[];
}

/** Consultation cache — data lives here until doctor approves */
export interface ConsultationCache {
    patientId: string;
    transcript: string;
    emr: PipelineEMR | null;
    hindiSummary: HindiSummary | null;
    status: 'recording' | 'emr_generated' | 'approved' | 'committed';
    confirmedYellowFields: string[];   // list of field keys doctor has confirmed
    startedAt: string;
    approvedAt: string | null;
}

export interface PatientRecord {
    id: string;
    name: string;
    age?: string;
    time?: string;
    status?: string;
    statusColor?: string;
    diagnosis?: string;
    abhaId?: string;
    hpi?: string;
    safetyFlag?: string | null;
    assessment?: string[];
    isLinked?: boolean;
    assignedDoctor?: string;
    mobile?: string;
    gender?: string;
    contact?: string;
    condition?: string;
    stat?: string;
    vitals?: string;
}

export interface TranscriptEntry {
    speaker: string;
    text: string;
    time: string;
}

export interface ClinicDetails {
    name: string;
    doctor: string;
    registration: string;
    address: string;
    mobile: string;
    timings: string;
    logo: string;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const INITIAL_PATIENTS: PatientRecord[] = [
    {
        id: '#40112', name: 'Priya Sharma', age: '34F', time: '10:15 AM',
        status: 'Waiting', statusColor: 'warning',
        diagnosis: '', abhaId: '91-1234-5678-9012',
        hpi: '', safetyFlag: null,
        assessment: [], isLinked: true, assignedDoctor: 'Dr. Rajesh Sharma',
        mobile: '+91 98765 43210', gender: 'F'
    },
    {
        id: '#40113', name: 'Raj Kumar', age: '52M', time: '11:00 AM',
        status: 'Waiting', statusColor: 'info',
        diagnosis: '', abhaId: '91-9876-5432-1098',
        hpi: '', safetyFlag: null,
        assessment: [], isLinked: true, assignedDoctor: 'Dr. Rajesh Sharma',
        mobile: '+91 87654 32109', gender: 'M'
    },
    {
        id: '#40114', name: 'Sneha Gupta', age: '28F', time: '11:45 AM',
        status: 'Waiting', statusColor: 'success',
        diagnosis: '', abhaId: '91-5555-7777-3333',
        hpi: '', safetyFlag: null,
        assessment: [], isLinked: true, assignedDoctor: 'Dr. Anjali Desai',
        mobile: '+91 76543 21098', gender: 'F'
    }
];

const INITIAL_TRANSCRIPTS: Record<string, TranscriptEntry[]> = {
    '#40112': [], '#40113': [], '#40114': []
};

// ─── Context Type ──────────────────────────────────────────────────────────────

type GlobalStateContextType = {
    patients: PatientRecord[];
    setPatients: React.Dispatch<React.SetStateAction<PatientRecord[]>>;
    transcripts: Record<string, TranscriptEntry[]>;
    setTranscripts: React.Dispatch<React.SetStateAction<Record<string, TranscriptEntry[]>>>;
    activePatientId: string;
    setActivePatientId: React.Dispatch<React.SetStateAction<string>>;
    clinicDetails: ClinicDetails;
    setClinicDetails: React.Dispatch<React.SetStateAction<ClinicDetails>>;
    pharmacyAlerts: string[];
    setPharmacyAlerts: React.Dispatch<React.SetStateAction<string[]>>;
    addPatient: (patient: PatientRecord) => void;
    addTranscriptRecord: (patientId: string, entry: TranscriptEntry) => void;
    // 3-agent pipeline
    consultationCache: ConsultationCache | null;
    setConsultationCache: React.Dispatch<React.SetStateAction<ConsultationCache | null>>;
    emrLoading: boolean;
    emrError: string | null;
    generateEMR: (transcript: string) => Promise<PipelineEMR | null>;
    approveAndCommit: () => Promise<void>;
    resetConsultation: (patientId: string) => void;
    confirmYellowField: (fieldKey: string) => void;
    hindiSummaryLoading: boolean;
    backendConnected: boolean;
};

const GlobalStateContext = createContext<GlobalStateContextType | undefined>(undefined);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function GlobalStateProvider({ children }: { children: ReactNode }) {
    const [patients, setPatients] = useState<PatientRecord[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('mockPatients');
            if (saved) return JSON.parse(saved);
        }
        return INITIAL_PATIENTS;
    });
    const [transcripts, setTranscripts] = useState<Record<string, TranscriptEntry[]>>(INITIAL_TRANSCRIPTS);
    const [activePatientId, setActivePatientId] = useState(INITIAL_PATIENTS[0].id);

    // Consultation cache (commit-on-approval)
    const [consultationCache, setConsultationCache] = useState<ConsultationCache | null>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('mockConsultationCache');
            if (saved) return JSON.parse(saved);
        }
        return null;
    });
    const [emrLoading, setEmrLoading] = useState(false);
    const [emrError, setEmrError] = useState<string | null>(null);
    const [hindiSummaryLoading, setHindiSummaryLoading] = useState(false);
    const [backendConnected, setBackendConnected] = useState(false);

    // Clinic Details
    const [clinicDetails, setClinicDetails] = useState<ClinicDetails>({
        name: 'MediScribe Clinic',
        doctor: 'Dr. Rajesh Sharma, MD (Internal Medicine)',
        registration: 'Reg No: KMC-89213',
        address: '123 Health Ave, Medical District, Mumbai 400001',
        mobile: '+91 98765 43210',
        timings: 'Mon-Sat: 09:00 AM - 08:00 PM',
        logo: '',
    });

    const [pharmacyAlerts, setPharmacyAlerts] = useState<string[]>([
        'Out of Stock: Paracetamol 500mg (Use 650mg if needed)',
        'Low Stock: Amoxicillin syrup for pediatrics'
    ]);

    // Health check on mount
    React.useEffect(() => {
        fetch('/api/health')
            .then(res => { if (res.ok) setBackendConnected(true); })
            .catch(() => setBackendConnected(false));
    }, []);

    // Sync mock state to localStorage
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('mockPatients', JSON.stringify(patients));
        }
    }, [patients]);

    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            if (consultationCache) {
                localStorage.setItem('mockConsultationCache', JSON.stringify(consultationCache));
            } else {
                localStorage.removeItem('mockConsultationCache');
            }
        }
    }, [consultationCache]);

    const addPatient = (patient: PatientRecord) => {
        setPatients(prev => [patient, ...prev]);
        setTranscripts(prev => ({ ...prev, [patient.id]: [] }));
    };

    const addTranscriptRecord = (patientId: string, entry: TranscriptEntry) => {
        setTranscripts(prev => ({
            ...prev,
            [patientId]: [...(prev[patientId] || []), entry]
        }));
    };

    /** Agent 1 + Agent 2 pipeline — generates EMR in consultation cache */
    const generateEMR = useCallback(async (transcript: string): Promise<PipelineEMR | null> => {
        setEmrLoading(true);
        setEmrError(null);
        try {
            const res = await fetch('/api/generate-emr/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: 'EMR generation failed' }));
                throw new Error(err.detail || `HTTP ${res.status}`);
            }
            const data: PipelineEMR = await res.json();

            // Store in consultation cache — NOT persisted until approval
            setConsultationCache(prev => ({
                patientId: prev?.patientId || activePatientId,
                transcript,
                emr: data,
                hindiSummary: null,
                status: 'emr_generated',
                confirmedYellowFields: prev?.confirmedYellowFields || [],
                startedAt: prev?.startedAt || new Date().toISOString(),
                approvedAt: null,
            }));

            return data;
        } catch (err: any) {
            setEmrError(err.message || 'EMR generation failed');
            return null;
        } finally {
            setEmrLoading(false);
        }
    }, [activePatientId]);

    /** Doctor confirms a yellow-tagged (inferred) field */
    const confirmYellowField = useCallback((fieldKey: string) => {
        setConsultationCache(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                confirmedYellowFields: [...prev.confirmedYellowFields, fieldKey],
            };
        });
    }, []);

    /** Commit-on-approval: flush cache to backend + trigger Agent 3 Hindi summary */
    const approveAndCommit = useCallback(async () => {
        if (!consultationCache?.emr) return;

        const cache = consultationCache;

        // 1. Mark as approved
        setConsultationCache(prev => prev ? { ...prev, status: 'approved', approvedAt: new Date().toISOString() } : prev);

        // 2. Update patient status to Pharmacy
        setPatients(prev => prev.map(p =>
            p.id === cache.patientId
                ? { ...p, status: 'Pharmacy', diagnosis: cache.emr?.diagnosis?.value || '' }
                : p
        ));

        // 3. Trigger Agent 3 — Hindi Summary (non-blocking)
        setHindiSummaryLoading(true);
        try {
            const res = await fetch('/api/hindi-summary/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ approved_emr: cache.emr }),
            });
            if (res.ok) {
                const hindiData: HindiSummary = await res.json();
                setConsultationCache(prev => prev ? { ...prev, hindiSummary: hindiData, status: 'committed' } : prev);
            }
        } catch (err) {
            console.error('Hindi summary generation failed:', err);
        } finally {
            setHindiSummaryLoading(false);
        }

        // 4. Mark as committed
        setConsultationCache(prev => prev ? { ...prev, status: 'committed' } : prev);

    }, [consultationCache]);

    /** Reset consultation if accidently approved */
    const resetConsultation = useCallback((patientId: string) => {
        // Revert patient status to waiting
        setPatients(prev => prev.map(p => 
            p.id === patientId 
                ? { ...p, status: 'Waiting', diagnosis: '' } 
                : p
        ));
        
        // Clear consultation cache if it belongs to this patient
        setConsultationCache(prev => prev?.patientId === patientId ? null : prev);
        
        // Clear transcripts
        setTranscripts(prev => ({ ...prev, [patientId]: [] }));
    }, []);

    return (
        <GlobalStateContext.Provider value={{
            patients, setPatients,
            transcripts, setTranscripts,
            activePatientId, setActivePatientId,
            clinicDetails, setClinicDetails,
            pharmacyAlerts, setPharmacyAlerts,
            addPatient, addTranscriptRecord,
            consultationCache, setConsultationCache,
            emrLoading, emrError,
            generateEMR, approveAndCommit, resetConsultation, confirmYellowField,
            hindiSummaryLoading, backendConnected,
        }}>
            {children}
        </GlobalStateContext.Provider>
    );
}

export function useGlobalState() {
    const context = useContext(GlobalStateContext);
    if (context === undefined) {
        throw new Error('useGlobalState must be used within a GlobalStateProvider');
    }
    return context;
}
