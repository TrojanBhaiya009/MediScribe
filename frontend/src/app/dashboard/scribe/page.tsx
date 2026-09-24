'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from '../Dashboard.module.css';
import { useGlobalState, type Confidence, type PipelineEMR } from '../GlobalStateContext';
import { useRouter } from 'next/navigation';
import useNvidiaASR, { type ASRProvider } from '../../../lib/useNvidiaASR';

// ─── Helpers ────────────────────────────────────────────────────────────────────

const CONFIDENCE_COLORS: Record<Confidence, { border: string; bg: string; text: string; label: string; icon: string }> = {
    green:  { border: 'rgba(16, 185, 129, 0.5)',  bg: 'rgba(16, 185, 129, 0.08)', text: 'var(--color-accent-green)', label: 'Explicit', icon: '🟢' },
    yellow: { border: 'rgba(245, 158, 11, 0.5)',  bg: 'rgba(245, 158, 11, 0.08)', text: '#f59e0b',                   label: 'Inferred — Doctor confirm', icon: '🟡' },
    blank:  { border: 'rgba(255, 255, 255, 0.1)', bg: 'rgba(255, 255, 255, 0.02)', text: 'var(--color-text-secondary)', label: 'Not mentioned', icon: '⬜' },
};

function normalizeForCompare(text: string): string {
    return text.toLocaleLowerCase().replace(/[^\p{L}\p{M}\p{N}\s']/gu, ' ').replace(/\s+/g, ' ').trim();
}

function shouldDropDuplicateTranscript(existing: Array<{ text?: string }>, incomingText: string): boolean {
    const normalizedIncoming = normalizeForCompare(incomingText);
    if (!normalizedIncoming) return true;

    const recent = existing.slice(-5);
    return recent.some(item => {
        const normalizedExisting = normalizeForCompare(item.text || '');
        if (!normalizedExisting) return false;

        if (normalizedExisting === normalizedIncoming) return true;
        if (normalizedIncoming.length <= 28 && normalizedExisting.includes(normalizedIncoming)) return true;
        return false;
    });
}

function isEmptyValue(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value !== 'string') return false;

    const normalized = value.trim().toLowerCase();
    if (!/[\p{L}\p{N}]/u.test(normalized)) return true;
    if (/^(?:u+h+|u+m+|h+m+|m+h+)$/.test(normalized)) return true;
    return (
        normalized === '' ||
        normalized === 'n/a' ||
        normalized === 'na' ||
        normalized === 'none' ||
        normalized === 'null' ||
        normalized === 'not mentioned' ||
        normalized === 'not mentioned in transcript' ||
        normalized === 'unknown' ||
        normalized === 'not sure' ||
        normalized === 'unsure' ||
        normalized === 'hmm' ||
        normalized === 'uh' ||
        normalized === 'um' ||
        normalized === 'audio unclear' ||
        normalized === 'inaudible' ||
        normalized === 'unintelligible'
    );
}

function renderFieldValue(value: unknown, fallback = 'N/A'): string {
    if (typeof value !== 'string') return fallback;
    return isEmptyValue(value) ? fallback : value;
}

function safeConfidence(confidence: Confidence | undefined, value: unknown): Confidence {
    if (isEmptyValue(value)) return 'blank';
    if (confidence === 'green' || confidence === 'yellow' || confidence === 'blank') return confidence;
    return 'green';
}

function combinedConfidence(...fields: Array<{ value: unknown; confidence?: Confidence } | null | undefined>): Confidence {
    const populated = fields.filter(field => field && !isEmptyValue(field.value));
    if (!populated.length) return 'blank';
    if (populated.some(field => safeConfidence(field?.confidence, field?.value) === 'yellow')) return 'yellow';
    return 'green';
}

function ConfidenceBadge({ confidence, fieldKey, onConfirm, confirmed }: {
    confidence: Confidence; fieldKey: string; onConfirm: (key: string) => void; confirmed: boolean;
}) {
    const c = CONFIDENCE_COLORS[confidence];
    if (confidence === 'yellow' && !confirmed) {
        return (
            <button onClick={() => onConfirm(fieldKey)} style={{
                background: c.bg, border: `1px solid ${c.border}`, borderRadius: '6px', padding: '3px 10px',
                fontSize: '11px', fontWeight: 'bold', color: c.text, cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: '4px'
            }}>
                {c.icon} CONFIRM
            </button>
        );
    }
    return (
        <span style={{
            background: confirmed ? CONFIDENCE_COLORS.green.bg : c.bg,
            border: `1px solid ${confirmed ? CONFIDENCE_COLORS.green.border : c.border}`,
            borderRadius: '6px', padding: '3px 10px', fontSize: '11px', fontWeight: 'bold',
            color: confirmed ? CONFIDENCE_COLORS.green.text : c.text, display: 'flex', alignItems: 'center', gap: '4px',
        }}>
            {confirmed ? '🟢' : c.icon} {confirmed ? 'Confirmed' : c.label}
        </span>
    );
}

function ConfidenceCard({ title, confidence, fieldKey, value, children, onConfirm, confirmed, onEdit }: {
    title: string; confidence: Confidence; fieldKey: string; value?: string | null;
    children?: React.ReactNode; onConfirm: (key: string) => void; confirmed: boolean;
    onEdit?: (key: string, newValue: string) => void;
}) {
    const c = CONFIDENCE_COLORS[confidence];
    const [isEditing, setIsEditing] = React.useState(false);
    const [editValue, setEditValue] = React.useState(value || '');

    React.useEffect(() => { setEditValue(value || ''); }, [value]);

    const handleSave = () => {
        setIsEditing(false);
        if (onEdit && editValue !== value) {
            onEdit(fieldKey, editValue);
        }
    };

    return (
        <div className={styles.workflowCard} style={{
            padding: '20px', transition: 'all 0.3s ease',
            borderLeft: `4px solid ${confirmed ? CONFIDENCE_COLORS.green.border : c.border}`,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '15px' }}>{title}</h4>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                     {!children && onEdit && (
                         <button onClick={() => isEditing ? handleSave() : setIsEditing(true)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--color-text-secondary)', cursor: 'pointer', borderRadius: '4px', fontSize: '11px', padding: '2px 6px' }}>
                             {isEditing ? '💾 Save' : '✏️ Edit'}
                         </button>
                     )}
                     <ConfidenceBadge confidence={confidence} fieldKey={fieldKey} onConfirm={onConfirm} confirmed={confirmed} />
                </div>
            </div>
            {children || (
                isEditing ? (
                    <textarea 
                        autoFocus
                        value={editValue} 
                        onChange={e => setEditValue(e.target.value)} 
                        onBlur={handleSave}
                        style={{ width: '100%', minHeight: '60px', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '8px', fontSize: '14px', outline: 'none', resize: 'vertical' }}
                    />
                ) : (
                    <p style={{ color: value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontSize: '14px', lineHeight: 1.5, margin: 0, fontStyle: value ? 'normal' : 'italic', cursor: onEdit ? 'text' : 'default' }} onDoubleClick={() => onEdit && setIsEditing(true)} title={onEdit ? "Double click to edit" : undefined}>
                        {value || 'Not mentioned in transcript'}
                    </p>
                )
            )}
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────────

export default function ScribePage() {
    return <ScribeComponent />;
}

function ScribeComponent(props: { isDemo?: boolean, onDemoComplete?: () => void, onDemoStart?: () => void }) {
    const { isDemo = false, onDemoComplete, onDemoStart } = props;
    const {
        patients, transcripts, setTranscripts, activePatientId, setActivePatientId,
        addTranscriptRecord, setPatients, consultationCache, setConsultationCache,
        emrLoading, emrError, generateEMR, approveAndCommit, resetConsultation, confirmYellowField,
        hindiSummaryLoading, backendConnected
    } = useGlobalState();
    const router = useRouter();
    const [isRecording, setIsRecording] = useState(false);
    const [interimTranscript, setInterimTranscript] = useState('');
    const [showPatientList, setShowPatientList] = useState(false);
    const [asrProvider, setAsrProvider] = useState<ASRProvider>('nvidia-riva-whisper');
    const [showAsrDropdown, setShowAsrDropdown] = useState(false);
    const recognitionRef = useRef<any>(null);
    const activePatientIdRef = useRef(activePatientId);
    const transcriptContainerRef = useRef<HTMLDivElement>(null);
    const emrContainerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const asrDropdownRef = useRef<HTMLDivElement>(null);

    const activePatient = patients.find((p: any) => p.id === activePatientId);
    // Only show cache if it belongs to the currently selected patient
    const currentCache = consultationCache?.patientId === activePatientId ? consultationCache : null;
    const emr = currentCache?.emr || null;
    const confirmedFields = currentCache?.confirmedYellowFields || [];

    // NVIDIA ASR Hook - handles WebSocket streaming transcription
    const handleNvidiaTranscript = useCallback((text: string, isFinal: boolean) => {
        const now = new Date();
        const timeStr = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
        const id = activePatientIdRef.current;
        
        if (isFinal && id) {
            setTranscripts((prev: any) => ({
                ...prev,
                [id]: shouldDropDuplicateTranscript(prev[id] || [], text)
                    ? (prev[id] || [])
                    : [...(prev[id] || []), { speaker: 'Doctor/Patient (Whisper)', text: text.trim(), time: timeStr }]
            }));
            setInterimTranscript('');
        } else {
            setInterimTranscript(text);
        }
    }, [setTranscripts]);

    const nvidiaASR = useNvidiaASR({
        language: 'auto',
        sampleRate: 16000,
        onTranscript: handleNvidiaTranscript,
        onError: (error) => alert(`Server ASR Error: ${error}`),
        onStatusChange: (status) => {
            if (status === 'recording') setIsRecording(true);
            else if (status === 'idle') setIsRecording(false);
        },
    });

    // Click outside dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setShowPatientList(false);
            if (asrDropdownRef.current && !asrDropdownRef.current.contains(event.target as Node)) setShowAsrDropdown(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => { activePatientIdRef.current = activePatientId; }, [activePatientId]);

    const wantRecordingRef = useRef(false);

    // Detect Brave browser
    const isBraveBrowser = useRef(false);
    useEffect(() => {
        (async () => {
            try {
                isBraveBrowser.current = !!(navigator as any).brave && await (navigator as any).brave.isBrave();
            } catch { isBraveBrowser.current = false; }
        })();
    }, []);

    // Speech recognition setup
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRec) return;

        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN';

        recognition.onresult = (event: any) => {
            let finalStr = '', interimStr = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) finalStr += event.results[i][0].transcript;
                else interimStr += event.results[i][0].transcript;
            }
            if (finalStr) {
                const now = new Date();
                const timeStr = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
                setTranscripts((prev: any) => {
                    const id = activePatientIdRef.current;
                    if (!id) return prev;
                    return { ...prev, [id]: [...(prev[id] || []), { speaker: 'Doctor/Patient (Live)', text: finalStr.trim(), time: timeStr }] };
                });
                setInterimTranscript('');
            } else {
                setInterimTranscript(interimStr);
            }
        };

        recognition.onerror = (event: any) => {
            console.error('[Web Speech] Error:', event.error);
            if (event.error === 'not-allowed') {
                alert("Microphone access denied. Allow mic in browser settings (HTTPS required).");
                wantRecordingRef.current = false; setIsRecording(false);
            } else if (event.error === 'network') {
                if (isBraveBrowser.current) {
                    alert("Web Speech API is blocked by Brave's privacy settings.\n\nFix options:\n1. Use Server ASR (NVIDIA Riva Whisper) instead (select from dropdown)\n2. Or open brave://settings/privacy and enable 'Use Google services for push messaging'\n3. Or use Chrome browser for Web Speech");
                } else {
                    alert("Network error. Web Speech API requires internet connection.\nIf using Brave browser, it blocks Google speech servers by default.\n\nTry using Server ASR (NVIDIA Riva Whisper) instead.");
                }
                wantRecordingRef.current = false; setIsRecording(false);
            } else if (event.error === 'audio-capture') {
                alert("No microphone detected. Please connect a microphone and try again.");
                wantRecordingRef.current = false; setIsRecording(false);
            } else if (event.error === 'aborted') {
                // Silently handle aborted — usually from user stopping
                wantRecordingRef.current = false; setIsRecording(false);
            } else if (event.error === 'service-not-available') {
                alert("Speech recognition service not available.\nTry using Server ASR (NVIDIA Riva Whisper) instead (select from dropdown).");
                wantRecordingRef.current = false; setIsRecording(false);
            }
        };

        recognition.onend = () => {
            if (wantRecordingRef.current) {
                try { recognition.start(); } catch { wantRecordingRef.current = false; setIsRecording(false); }
            } else { setIsRecording(false); }
        };

        recognitionRef.current = recognition;
        return () => { wantRecordingRef.current = false; recognitionRef.current?.abort(); };
    }, []);

    const listLength = transcripts[activePatientId]?.length || 0;
    const demoTranscripts = (transcripts[activePatientId] || []).filter((t: any) => t.speaker === 'Doctor' || t.speaker === 'Patient');
    const demoLength = demoTranscripts.length;
    const hasLiveMicData = !isDemo && listLength > 0;

    // Auto scroll
    useEffect(() => {
        transcriptContainerRef.current?.scrollTo({ top: transcriptContainerRef.current.scrollHeight, behavior: 'smooth' });
    }, [transcripts, activePatientId, listLength]);

    const toggleRecording = async () => {
        if (!activePatientId && patients.length > 0) setActivePatientId(patients[0].id);

        if (isDemo) {
            if (isRecording) return;
            setIsRecording(true);
            if (onDemoStart) onDemoStart();

            const demoLines = [
                { speaker: 'Doctor', text: 'Good morning, Priya. Kya takleef hai aapko?' },
                { speaker: 'Patient', text: 'Doctor, kal raat se sir mein bohot severe pain ho raha hai.' },
                { speaker: 'Doctor', text: 'I see. Vision mein kuch changes lag rahe hain? Any flashing lights?' },
                { speaker: 'Patient', text: 'Haan sir, zigzag lines dikhayi deti hain pain shuru hone se pehle.' },
                { speaker: 'Doctor', text: 'Theek hai. Aapka BP check karte hain... 120/80, which is normal. HR is 72.' },
                { speaker: 'Doctor', text: 'Priya, kya aapko koi acidity ya gastritis ki problem rahi hai pehle?' },
                { speaker: 'Patient', text: 'Haan sir, pain-killers lene se pet mein bohot jalan hoti hai.' },
                { speaker: 'Doctor', text: "I'll prescribe Sumatriptan 50mg for acute attacks. Take it zaroorat padne par." },
                { speaker: 'Doctor', text: 'Iska summary aapke ABHA app pe mil jayega. Pharmacist ko dikha dena.' }
            ];

            let lineIndex = 0;
            const interval = setInterval(() => {
                if (lineIndex < demoLines.length) {
                    const now = new Date();
                    const timeStr = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
                    const targetId = activePatientIdRef.current || patients[0]?.id;
                    if (targetId) addTranscriptRecord(targetId, { ...demoLines[lineIndex], time: timeStr });
                    lineIndex++;
                } else {
                    clearInterval(interval);
                    setIsRecording(false);
                    if (onDemoComplete) onDemoComplete();
                }
            }, 1600);
            return;
        }

        // Handle Server ASR (NVIDIA Riva Whisper)
        if (asrProvider === 'nvidia-riva-whisper') {
            if (isRecording) {
                nvidiaASR.stopRecording();
            } else {
                if (nvidiaASR.isAvailable) {
                    nvidiaASR.startRecording();
                } else {
                    alert("Server ASR not available. Check backend connection and NVIDIA_API_KEY.");
                }
            }
            return;
        }

        // Handle Web Speech API (default)
        if (isRecording) {
            wantRecordingRef.current = false;
            recognitionRef.current?.stop();
            setIsRecording(false);
        } else {
            // Pre-check: warn Brave users
            if (isBraveBrowser.current) {
                const useBrave = confirm(
                    "⚠️ Brave browser blocks Web Speech API by default.\n\n" +
                    "Options:\n" +
                    "• Click 'Cancel' and switch to Server ASR / NVIDIA Riva Whisper (recommended)\n" +
                    "• Click 'OK' to try anyway (may fail with network error)\n\n" +
                    "To fix permanently: brave://settings/privacy → enable Google services"
                );
                if (!useBrave) return;
            }

            if (recognitionRef.current) {
                // Request mic permission first to get a clear error
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    stream.getTracks().forEach(t => t.stop()); // Release immediately
                } catch (err: any) {
                    if (err.name === 'NotAllowedError') {
                        alert("Microphone access denied. Please allow microphone in browser settings.");
                    } else if (err.name === 'NotFoundError') {
                        alert("No microphone found. Please connect a microphone.");
                    } else {
                        alert(`Microphone error: ${err.message}`);
                    }
                    return;
                }

                try { wantRecordingRef.current = true; recognitionRef.current.start(); setIsRecording(true); }
                catch { wantRecordingRef.current = false; }
            } else {
                alert("Speech recognition not supported in this browser.\n\nOptions:\n• Use Server ASR / NVIDIA Riva Whisper (select from dropdown)\n• Use Chrome or Edge browser for Web Speech API");
            }
        }
    };

    const handleConfirmField = (fieldKey: string) => {
        confirmYellowField(fieldKey);
    };
    
    const handleEditField = (fieldKey: string, newValue: string) => {
        if (!currentCache || !emr) return;
        
        if (fieldKey.startsWith('med_')) {
            const idx = parseInt(fieldKey.split('_')[1]);
            const newMeds = [...(emr.medications || [])];
            
            // Simple string parse: "Name - Frequency"
            const parts = newValue.split('-');
            const nameAndDosage = (parts[0] || '').trim();
            const frequency = (parts[1] || '').trim();
            
            newMeds[idx] = { 
                ...newMeds[idx], 
                name: nameAndDosage, 
                frequency: frequency || newMeds[idx].frequency, 
                confidence: 'green' 
            };
            
            setConsultationCache({ ...currentCache, emr: { ...emr, medications: newMeds } });
            confirmYellowField(fieldKey);
            return;
        }

        if (fieldKey.startsWith('inv_')) {
            const idx = parseInt(fieldKey.split('_')[1]);
            const newInvs = [...(emr.investigations || [])];
            newInvs[idx] = { ...newInvs[idx], name: newValue, confidence: 'green' };
            setConsultationCache({ ...currentCache, emr: { ...emr, investigations: newInvs } });
            confirmYellowField(fieldKey);
            return;
        }

        setConsultationCache({
            ...currentCache,
            emr: {
                ...emr,
                [fieldKey]: {
                    ...(emr[fieldKey as keyof PipelineEMR] as any),
                    value: newValue,
                    confidence: 'green' // Auto-confirm when manually edited
                }
            }
        });
        confirmYellowField(fieldKey);
    };

    const isConfirmed = (fieldKey: string) => confirmedFields.includes(fieldKey);

    const reviewRequiredKeys: string[] = emr ? [
        combinedConfidence(emr.chiefComplaint, emr.hpi) === 'yellow' ? 'chiefComplaint' : null,
        safeConfidence(emr.diagnosis?.confidence, emr.diagnosis?.value) === 'yellow' ? 'diagnosis' : null,
        safeConfidence(emr.plan?.confidence, emr.plan?.value) === 'yellow' ? 'plan' : null,
        ...(emr.medications || []).map((med, idx) => safeConfidence(med.confidence, med.name) === 'yellow' ? `med_${idx}` : null),
        ...(emr.investigations || []).map((inv, idx) => safeConfidence(inv.confidence, inv.name) === 'yellow' ? `inv_${idx}` : null),
    ].filter((key): key is string => Boolean(key)) : [];
    const unresolvedReviewKeys = reviewRequiredKeys.filter((key) => !isConfirmed(key));

    const handleApproval = () => {
        if (unresolvedReviewKeys.length > 0) {
            alert(`Please confirm or edit ${unresolvedReviewKeys.length} yellow-tagged item(s) before approval.`);
            return;
        }
        if (emr?.hallucinationCheck?.isHallucinated) {
            const proceed = confirm(
                `Grounding check changed unsupported model output. Review the warning before signing.\n\n${emr.hallucinationCheck.details || ''}\n\nApprove the reviewed record?`
            );
            if (!proceed) return;
        }
        approveAndCommit();
    };

    return (
        <div className={styles.dashboardContent} style={{ padding: '24px 32px' }}>
            {/* Header */}
            <div style={{ marginBottom: '16px' }}>
                <h1 className={styles.pageTitle} style={{ fontSize: '24px' }}>Welcome back, Doctor</h1>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '4px' }}>Live AI Scribe &amp; Consultation Workspace</p>
            </div>

            {/* Top Banner: Patient Context & Controls */}
            <div className={styles.workflowCard} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: '10px', padding: '16px 24px', marginBottom: '8px', borderLeft: isRecording ? '4px solid #ef4444' : currentCache?.status === 'approved' ? '4px solid #806744' : '4px solid var(--color-accent-green)', overflow: 'visible', flex: '0 0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: '1 1 580px', minWidth: 0 }}>
                    <div>
                        <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Consultation</span>
                        <div style={{ position: 'relative' }} ref={dropdownRef}>
                            <button onClick={() => setShowPatientList(!showPatientList)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-primary)', fontSize: '20px', fontWeight: 'bold', cursor: isDemo ? 'default' : 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: isDemo ? 'none' as const : 'auto' as const }}>
                                {activePatient ? `${activePatient.name} ${activePatient.age ? `(${activePatient.age})` : ''}` : 'Select a patient...'}
                                <span style={{ fontSize: '12px' }}>▼</span>
                            </button>
                            {showPatientList && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', background: 'var(--color-sidebar-bg)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: '320px', zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Waiting</div>
                                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                        {patients.filter((p: any) => p.status === 'Waiting').map((p: any) => (
                                            <div key={p.id} onClick={() => { setActivePatientId(p.id); setShowPatientList(false); }} style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: activePatientId === p.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent' }}>
                                                <div>
                                                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{p.name} <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{p.age}</span></div>
                                                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{p.abhaId || 'No ABHA'}</div>
                                                </div>
                                                <span style={{ fontSize: '11px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>WAIT</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ paddingLeft: '24px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ display: 'flex', gap: '32px' }}>
                            <div>
                                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>ABHA ID</span>
                                <div style={{ fontSize: '14px', fontWeight: 600, color: activePatient?.abhaId ? 'var(--color-accent-green)' : '#ef4444' }}>{activePatient?.abhaId || 'Not Linked'}</div>
                            </div>
                            <div>
                                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Status</span>
                                <div style={{ fontSize: '14px', fontWeight: 600, color: currentCache?.status === 'emr_generated' ? '#f59e0b' : currentCache?.status === 'approved' ? '#806744' : 'var(--color-accent-green)' }}>
                                    {currentCache?.status === 'emr_generated' ? '⏳ Pending Approval' : currentCache?.status === 'approved' || currentCache?.status === 'committed' ? '✅ Approved' : '🎙️ Recording'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto', flexWrap: 'wrap' }}>
                    {isRecording && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 'bold', fontSize: '13px', animation: `${styles.pulse} 2s infinite` }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)' }}></div>
                            REC {asrProvider === 'nvidia-riva-whisper' ? '· Hinglish auto' : '· Web'}
                        </div>
                    )}
                    
                    {/* ASR Provider Toggle */}
                    {!isDemo && !isRecording && (
                        <div style={{ position: 'relative' }} ref={asrDropdownRef}>
                            <button
                                onClick={() => setShowAsrDropdown(!showAsrDropdown)}
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    fontWeight: 500,
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    background: 'rgba(255,255,255,0.05)',
                                    color: 'var(--color-text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {asrProvider === 'nvidia-riva-whisper' ? 'Whisper · Hinglish auto' : 'Web Speech · English'}
                                <span style={{ fontSize: '10px', opacity: 0.6 }}>▼</span>
                            </button>
                            {showAsrDropdown && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    marginTop: '4px',
                                    background: 'var(--color-sidebar-bg)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '10px',
                                    width: '220px',
                                    zIndex: 100,
                                    boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Speech Engine
                                    </div>
                                    <div
                                        onClick={() => { setAsrProvider('nvidia-riva-whisper'); setShowAsrDropdown(false); }}
                                        style={{
                                            padding: '12px',
                                            cursor: nvidiaASR.isAvailable ? 'pointer' : 'not-allowed',
                                            background: asrProvider === 'nvidia-riva-whisper' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                            opacity: nvidiaASR.isAvailable ? 1 : 0.5,
                                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                                            transition: 'background 0.15s',
                                        }}
                                    >
<div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            NVIDIA Riva Whisper · Hinglish auto-detect
                                            {asrProvider === 'nvidia-riva-whisper' && <span style={{ color: 'var(--color-accent-green)', fontSize: '14px' }}>✓</span>}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '3px' }}>
                                            {nvidiaASR.isAvailable ? 'Recommended · Multilingual · HIPAA-ready' : 'Unavailable — check backend'}
                                        </div>
                                    </div>
                                    <div
                                        onClick={() => { setAsrProvider('web-speech'); setShowAsrDropdown(false); }}
                                        style={{
                                            padding: '12px',
                                            cursor: 'pointer',
                                            background: asrProvider === 'web-speech' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                            transition: 'background 0.15s',
                                        }}
                                    >
                                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            Web Speech · English (India)
                                            {asrProvider === 'web-speech' && <span style={{ color: 'var(--color-accent-green)', fontSize: '14px' }}>✓</span>}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '3px' }}>Chrome/Edge only · No Brave</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Mic Control Buttons */}
                    {!isRecording ? (
                        <button
                            onClick={toggleRecording}
                            className={isDemo && !isRecording ? styles.demoMicPulse : ''}
                            style={{
                                padding: '10px 22px', borderRadius: '10px', border: 'none', fontWeight: 'bold',
                                fontSize: '13px', cursor: 'pointer', background: 'var(--color-accent-green)',
                                color: '#fff', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px',
                                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)',
                            }}
                        >
                            🎙️ START MIC
                        </button>
                    ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={toggleRecording}
                                style={{
                                    padding: '10px 18px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.4)',
                                    fontWeight: 'bold', fontSize: '13px', cursor: 'pointer',
                                    background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b',
                                    transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px',
                                }}
                            >
                                ⏸️ PAUSE
                            </button>
                            <button
                                onClick={() => {
                                    if (asrProvider === 'nvidia-riva-whisper') {
                                        nvidiaASR.stopRecording();
                                    } else {
                                        wantRecordingRef.current = false;
                                        recognitionRef.current?.stop();
                                    }
                                    setIsRecording(false);
                                    setInterimTranscript('');
                                }}
                                style={{
                                    padding: '10px 18px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.4)',
                                    fontWeight: 'bold', fontSize: '13px', cursor: 'pointer',
                                    background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                                    transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px',
                                }}
                            >
                                ⏹️ STOP
                            </button>
                        </div>
                    )}

                    {/* Generate EMR — Agent 1 + Agent 2 */}
                    {!isDemo && !isRecording && hasLiveMicData && !emr && (
                        <button
                            onClick={() => {
                                const fullTranscript = (transcripts[activePatientId] || []).map((t: any) => t.text).join('\n');
                                setConsultationCache({ patientId: activePatientId, transcript: fullTranscript, emr: null, hindiSummary: null, status: 'recording', confirmedYellowFields: [], startedAt: new Date().toISOString(), approvedAt: null });
                                generateEMR(fullTranscript);
                            }}
                            disabled={emrLoading}
                            style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid #806744', fontWeight: 'bold', fontSize: '14px', cursor: emrLoading ? 'wait' : 'pointer', background: emrLoading ? 'rgba(128, 103, 68, 0.05)' : 'rgba(128, 103, 68, 0.1)', color: '#806744', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {emrLoading ? '⏳ Running 3-Agent Pipeline...' : '🧠 Generate EMR'}
                        </button>
                    )}

                    {/* Approve & Commit — commit-on-approval */}
                    {emr && currentCache?.status === 'emr_generated' && (
                        <button
                            onClick={handleApproval}
                            disabled={unresolvedReviewKeys.length > 0}
                            style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '14px', cursor: unresolvedReviewKeys.length ? 'not-allowed' : 'pointer', background: unresolvedReviewKeys.length ? 'var(--color-text-secondary)' : 'var(--color-accent-green)', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)', opacity: unresolvedReviewKeys.length ? 0.65 : 1 }}
                        >
                            {unresolvedReviewKeys.length ? `Review ${unresolvedReviewKeys.length} item(s)` : 'Approve & Commit'}
                        </button>
                    )}

                    {/* Reset Consultation */}
                    {emr && (currentCache?.status === 'approved' || currentCache?.status === 'committed') && (
                        <button
                            onClick={() => {
                                if (confirm("Are you sure you want to reset this consultation? This will discard the generated EMR and move the patient back to the waiting queue.")) {
                                    resetConsultation(activePatientId);
                                }
                            }}
                            style={{ padding: '12px 20px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.4)', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
                        >
                            🔄 Reset Consultation
                        </button>
                    )}
                </div>
            </div>

            {/* Main 2-Column Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 400px) 1fr', gap: '24px', flex: 1, height: 'calc(100vh - 180px)' }}>
                {/* Left: Live Transcript */}
                <div className={styles.workflowCard} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: 0 }}>
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: 'var(--color-text-primary)' }}>Live Audio Capture</h3>
                        <span style={{ fontSize: '12px', color: 'var(--color-accent-green)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-accent-green)' }}></span>
                            Hinglish Supported
                        </span>
                    </div>

                    <div ref={transcriptContainerRef} style={{ flex: 1, padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {(!activePatientId || !transcripts[activePatientId] || transcripts[activePatientId].length === 0) ? (
                            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                                <div style={{ fontSize: '40px', marginBottom: '16px', opacity: 0.4 }}>🎙️</div>
                                <p style={{ fontSize: '14px', fontWeight: 500, margin: '0 0 6px 0' }}>No audio captured yet</p>
                                <p style={{ fontSize: '12px', opacity: 0.6, margin: 0 }}>Click <strong>START MIC</strong> to begin transcription</p>
                            </div>
                        ) : (
                            transcripts[activePatientId].map((msg: any, idx: number) => (
                                <div key={idx} style={{
                                    display: 'flex', gap: '12px', padding: '12px 14px', borderRadius: '10px',
                                    background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.04)',
                                    transition: 'background 0.2s',
                                }}>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                                        background: msg.speaker?.includes('Doctor') ? 'rgba(16, 185, 129, 0.15)' : msg.speaker?.includes('Patient') ? 'rgba(111, 120, 83, 0.15)' : 'rgba(128, 103, 68, 0.15)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
                                    }}>
                                        {msg.speaker?.includes('Doctor') ? '🩺' : msg.speaker?.includes('Patient') ? '🧑' : '🎙️'}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: 600, color: msg.speaker?.includes('Doctor') ? 'var(--color-accent-green)' : msg.speaker?.includes('Patient') ? '#6f7853' : 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                                {msg.speaker || 'Transcript'}
                                            </span>
                                            <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', opacity: 0.6 }}>{msg.time}</span>
                                        </div>
                                        <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--color-text-primary)' }}>{msg.text}</div>
                                    </div>
                                </div>
                            ))
                        )}
                        {isRecording && (interimTranscript || nvidiaASR.interimTranscript) && (
                            <div style={{
                                background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.15)',
                                padding: '12px 14px', borderRadius: '10px', display: 'flex', gap: '12px',
                            }}>
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
                                    animation: `${styles.pulse} 1.5s infinite`,
                                }}>
                                    🎙️
                                </div>
                                <div style={{ flex: 1 }}>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-accent-green)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                        Listening...
                                    </span>
                                    <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--color-text-primary)', fontStyle: 'italic', marginTop: '4px' }}>
                                        {asrProvider === 'nvidia-riva-whisper' ? nvidiaASR.interimTranscript : interimTranscript}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {isRecording && (
                        <div style={{ height: '60px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            {[...Array(15)].map((_, i) => (
                                <div key={i} style={{ width: '4px', height: `${Math.random() * 24 + 8}px`, background: 'var(--color-accent-green)', borderRadius: '2px', animation: `${styles.pulse} ${Math.random() * 0.5 + 0.5}s infinite ease-in-out alternate` }} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: Agentic EMR Pipeline Output */}
                <div ref={emrContainerRef} style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto', paddingRight: '8px' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--color-text-primary)', margin: 0 }}>3-Agent EMR Pipeline</h2>
                            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Extractor → Safety Checker → Hindi Summarizer</span>
                        </div>
                        <span style={{ fontSize: '12px', color: backendConnected ? 'var(--color-accent-green)' : '#ef4444', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: backendConnected ? 'var(--color-accent-green)' : '#ef4444' }}></span>
                            {backendConnected ? 'Pipeline Ready' : 'Backend Offline'}
                        </span>
                    </div>

                    {/* Error banner */}
                    {emrError && (
                        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#ef4444', fontSize: '13px' }}>
                            ⚠️ Pipeline Error: {emrError}
                        </div>
                    )}

                    {/* Loading indicator */}
                    {emrLoading && (
                        <div style={{ padding: '16px', background: 'rgba(128, 103, 68, 0.05)', border: '1px solid rgba(128, 103, 68, 0.2)', borderRadius: '8px', textAlign: 'center' }}>
                            <div style={{ fontSize: '13px', color: '#806744', fontWeight: 'bold' }}>⏳ Agent 1 (Extractor) + Agent 2 (Safety Checker) running...</div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Extracting structured EMR with confidence tags, then cross-referencing for drug interactions</div>
                        </div>
                    )}

                    {/* ─── EMR Data — Confidence-Colored Cards ─── */}
                    {emr ? (
                        <>
                            {(() => {
                                const safetyStatus = emr.safetyCheck?.overallSafetyStatus || 'unchecked';
                                const safetyBorderColor = safetyStatus === 'critical_flags'
                                    ? '#ef4444'
                                    : safetyStatus === 'warnings_present'
                                        ? '#f59e0b'
                                        : safetyStatus === 'safe'
                                            ? 'var(--color-accent-green)'
                                            : 'rgba(255, 255, 255, 0.2)';
                                const safetyBadgeBg = safetyStatus === 'safe'
                                    ? 'rgba(16, 185, 129, 0.1)'
                                    : safetyStatus === 'critical_flags'
                                        ? 'rgba(239, 68, 68, 0.1)'
                                        : safetyStatus === 'warnings_present'
                                            ? 'rgba(245, 158, 11, 0.1)'
                                            : 'rgba(255, 255, 255, 0.08)';
                                const safetyBadgeColor = safetyStatus === 'safe'
                                    ? 'var(--color-accent-green)'
                                    : safetyStatus === 'critical_flags'
                                        ? '#ef4444'
                                        : safetyStatus === 'warnings_present'
                                            ? '#f59e0b'
                                            : 'var(--color-text-secondary)';
                                const safetyLabel = safetyStatus === 'safe'
                                    ? '✅ SAFE'
                                    : safetyStatus === 'critical_flags'
                                        ? '🚨 CRITICAL'
                                        : safetyStatus === 'warnings_present'
                                            ? '⚠️ WARNINGS'
                                            : '⏸ UNCHECKED';

                                return (
                                    <>
                            {/* Agent completion indicator */}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {(emr.agentsCompleted || []).map((agent: string) => (
                                    <span key={agent} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-accent-green)', fontWeight: 'bold', textTransform: 'capitalize' }}>
                                        ✓ {agent.replace('_', ' ')}
                                    </span>
                                ))}
                                {currentCache?.status === 'committed' && (
                                    <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '12px', background: 'rgba(128, 103, 68, 0.1)', color: '#806744', fontWeight: 'bold' }}>
                                        ✓ Hindi Summarizer
                                    </span>
                                )}
                            </div>

                            {emr.hallucinationCheck?.isHallucinated && (
                                <div role="alert" style={{ padding: '14px 16px', background: 'rgba(157, 59, 42, 0.08)', borderLeft: '3px solid #9d3b2a', color: 'var(--color-text-primary)', fontSize: '12px', lineHeight: 1.55 }}>
                                    <strong style={{ display: 'block', color: '#9d3b2a', marginBottom: '4px' }}>Transcript grounding changed the draft</strong>
                                    {emr.hallucinationCheck.details || 'Unsupported generated content was removed. Review the transcript before approval.'}
                                </div>
                            )}

                            {/* Chief Complaint & HPI */}
                            <ConfidenceCard title="Chief Complaint & HPI" confidence={combinedConfidence(emr.chiefComplaint, emr.hpi)} fieldKey="chiefComplaint" onConfirm={handleConfirmField} confirmed={isConfirmed('chiefComplaint')} onEdit={handleEditField}>
                                <div>
                                    <strong style={{ color: 'var(--color-text-primary)' }}>CC:</strong>{' '}
                                    <span style={{ color: 'var(--color-text-primary)', cursor: 'text' }} onDoubleClick={() => handleEditField('chiefComplaint', prompt('Edit Chief Complaint:', renderFieldValue(emr.chiefComplaint?.value, '')) || renderFieldValue(emr.chiefComplaint?.value, ''))}>{renderFieldValue(emr.chiefComplaint?.value)}</span>
                                    <br />
                                    <strong style={{ color: 'var(--color-text-primary)', marginTop: '4px', display: 'inline-block' }}>HPI:</strong>{' '}
                                    <span style={{ color: 'var(--color-text-primary)', cursor: 'text' }} onDoubleClick={() => handleEditField('hpi', prompt('Edit HPI:', renderFieldValue(emr.hpi?.value, '')) || renderFieldValue(emr.hpi?.value, ''))}>{renderFieldValue(emr.hpi?.value)}</span>
                                </div>
                            </ConfidenceCard>

                            {/* Diagnosis */}
                            <ConfidenceCard title="Provisional Diagnosis" confidence={safeConfidence(emr.diagnosis?.confidence, emr.diagnosis?.value)} fieldKey="diagnosis" value={emr.diagnosis?.value} onConfirm={handleConfirmField} confirmed={isConfirmed('diagnosis')} onEdit={handleEditField} />

                            {/* Safety Check — Agent 2 Output */}
                            <div className={styles.workflowCard} style={{
                                padding: '20px',
                                borderLeft: `4px solid ${safetyBorderColor}`,
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <h4 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '15px' }}>Agent 2 — Safety Check</h4>
                                    <span style={{
                                        padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold',
                                        background: safetyBadgeBg,
                                        color: safetyBadgeColor,
                                    }}>
                                        {safetyLabel}
                                    </span>
                                </div>
                                {emr.safetyCheck?.safetyFlags?.length ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {emr.safetyCheck.safetyFlags.map((flag, idx) => (
                                            <div key={idx} style={{
                                                padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
                                                background: flag.severity === 'critical' ? 'rgba(239, 68, 68, 0.08)' : flag.severity === 'warning' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(111, 120, 83, 0.08)',
                                                border: `1px solid ${flag.severity === 'critical' ? 'rgba(239, 68, 68, 0.3)' : flag.severity === 'warning' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(111, 120, 83, 0.3)'}`,
                                            }}>
                                                <div style={{ fontWeight: 'bold', color: flag.severity === 'critical' ? '#ef4444' : flag.severity === 'warning' ? '#f59e0b' : '#6f7853', marginBottom: '4px' }}>
                                                    {flag.severity === 'critical' ? '🚨' : flag.severity === 'warning' ? '⚠️' : 'ℹ️'} {flag.message}
                                                </div>
                                                <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                                                    💊 {flag.affectedMedications?.join(', ')} — {flag.recommendation}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : safetyStatus === 'unchecked' ? (
                                    <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '12px', borderRadius: '8px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                                        ⏸ Safety checker did not run for this result. Please review medications manually.
                                    </div>
                                ) : (
                                    <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: '8px', color: 'var(--color-accent-green)', fontSize: '13px' }}>
                                        ✅ No drug interactions, allergy conflicts, or contraindications detected.
                                    </div>
                                )}
                            </div>

                            {/* Medications + Investigations */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                {/* Medications */}
                                <div className={styles.workflowCard} style={{ padding: '20px', borderLeft: '4px solid rgba(16, 185, 129, 0.5)' }}>
                                    <h4 style={{ margin: '0 0 12px 0', color: 'var(--color-text-primary)', fontSize: '15px' }}>Medications (Rx)</h4>
                                    {emr.medications?.length ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {emr.medications.map((med, idx) => (
                                                <div key={idx} style={{
                                                    padding: '10px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    background: CONFIDENCE_COLORS[safeConfidence(med.confidence, med.name)].bg,
                                                    borderLeft: `3px solid ${CONFIDENCE_COLORS[safeConfidence(med.confidence, med.name)].border}`,
                                                }}>
                                                    <div style={{ cursor: 'text' }} onDoubleClick={() => handleEditField(`med_${idx}`, prompt(`Edit Medication ${idx + 1} (Name Dosage - Frequency):`, `${med.name} ${med.dosage || ''} ${med.frequency ? '- ' + med.frequency : ''}`) || `${med.name} ${med.dosage || ''} ${med.frequency ? '- ' + med.frequency : ''}`)} title="Double click to edit">
                                                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '14px' }}>{med.name}</span>
                                                        {med.dosage && <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginLeft: '8px' }}>{med.dosage}</span>}
                                                        {med.frequency && <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginLeft: '8px' }}>({med.frequency})</span>}
                                                    </div>
                                                    <ConfidenceBadge confidence={safeConfidence(med.confidence, med.name)} fieldKey={`med_${idx}`} onConfirm={handleConfirmField} confirmed={isConfirmed(`med_${idx}`)} />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', fontSize: '13px', margin: 0 }}>No medications prescribed</p>
                                    )}
                                </div>

                                {/* Investigations */}
                                <div className={styles.workflowCard} style={{ padding: '20px', borderLeft: '4px solid rgba(111, 120, 83, 0.5)' }}>
                                    <h4 style={{ margin: '0 0 12px 0', color: 'var(--color-text-primary)', fontSize: '15px' }}>Investigations Ordered</h4>
                                    {emr.investigations?.length ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {emr.investigations.map((inv, idx) => (
                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: '6px', background: CONFIDENCE_COLORS[safeConfidence(inv.confidence, inv.name)].bg }}>
                                                    <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', cursor: 'text' }} onDoubleClick={() => handleEditField(`inv_${idx}`, prompt(`Edit Investigation ${idx + 1}:`, inv.name) || inv.name)} title="Double click to edit">{inv.name}</span>
                                                    <ConfidenceBadge confidence={safeConfidence(inv.confidence, inv.name)} fieldKey={`inv_${idx}`} onConfirm={handleConfirmField} confirmed={isConfirmed(`inv_${idx}`)} />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', fontSize: '13px', margin: 0 }}>No investigations ordered</p>
                                    )}
                                </div>
                            </div>

                            {/* Plan + Disease Risk */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <ConfidenceCard title="Treatment Plan" confidence={safeConfidence(emr.plan?.confidence, emr.plan?.value)} fieldKey="plan" value={emr.plan?.value} onConfirm={handleConfirmField} confirmed={isConfirmed('plan')} onEdit={handleEditField}>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: 'var(--color-text-primary)', cursor: 'text' }} onDoubleClick={() => handleEditField('plan', prompt('Edit Plan:', emr.plan?.value || '') || emr.plan?.value || '')}>{emr.plan?.value || 'No plan specified.'}</p>
                                        {emr.followUpDays?.value && (
                                            <div style={{ marginTop: '8px', padding: '6px 10px', background: 'rgba(111, 120, 83, 0.1)', borderRadius: '6px', fontSize: '12px', color: '#6f7853', fontWeight: 600 }}>
                                                📅 Follow-up in {emr.followUpDays.value} days
                                            </div>
                                        )}
                                    </div>
                                </ConfidenceCard>

                                <div className={styles.workflowCard} style={{ padding: '20px', borderLeft: '4px solid rgba(245, 158, 11, 0.5)' }}>
                                    <h4 style={{ margin: '0 0 12px 0', color: 'var(--color-text-primary)', fontSize: '15px' }}>Disease Risk Assessment</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {(['fluProbability', 'migraineProbability', 'fatigueProbability'] as const).map(key => {
                                            const value = emr.diseaseRisk?.[key] || 0;
                                            const label = key.replace('Probability', '');
                                            const color = value > 0.7 ? '#ef4444' : value > 0.4 ? '#f59e0b' : 'var(--color-accent-green)';
                                            return (
                                                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', width: '70px', textTransform: 'capitalize' }}>{label}</span>
                                                    <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${value * 100}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
                                                    </div>
                                                    <span style={{ fontSize: '12px', fontWeight: 600, color, width: '35px', textAlign: 'right' }}>{Math.round(value * 100)}%</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                                    </>
                                );
                            })()}

                            {/* Inference Notes */}
                            {emr.inferenceNotes?.length > 0 && (
                                <div style={{ padding: '12px 16px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '8px' }}>
                                    <h5 style={{ margin: '0 0 8px 0', color: '#f59e0b', fontSize: '13px' }}>🟡 Inference Notes (Yellow-tagged items)</h5>
                                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                        {emr.inferenceNotes.map((note, idx) => (
                                            <li key={idx} style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.4, marginBottom: '2px' }}>{note}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Hindi Summary (Agent 3 output — appears after approval) */}
                            {hindiSummaryLoading && (
                                <div style={{ padding: '16px', background: 'rgba(128, 103, 68, 0.05)', border: '1px solid rgba(128, 103, 68, 0.2)', borderRadius: '8px', textAlign: 'center' }}>
                                    <span style={{ fontSize: '13px', color: '#806744', fontWeight: 'bold' }}>⏳ Agent 3 — Generating Hindi patient summary...</span>
                                </div>
                            )}

                            {consultationCache?.hindiSummary && (
                                <div className={styles.workflowCard} style={{ padding: '20px', borderLeft: '4px solid #806744' }}>
                                    <h4 style={{ margin: '0 0 12px 0', color: '#806744', fontSize: '15px' }}>🇮🇳 Patient Summary (Hindi)</h4>
                                    <div style={{ background: 'rgba(128, 103, 68, 0.05)', padding: '16px', borderRadius: '8px' }}>
                                        <p style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', margin: '0 0 8px 0' }}>
                                            {consultationCache.hindiSummary.patientSummary?.diagnosisSimple}
                                        </p>
                                        {consultationCache.hindiSummary.patientSummary?.medicationInstructions?.map((med, idx) => (
                                            <div key={idx} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', marginBottom: '6px', borderLeft: '3px solid #806744' }}>
                                                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{med.name}</span>
                                                <br />
                                                <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{med.hindiInstruction}</span>
                                                {med.warning && <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '4px' }}>⚠️ {med.warning}</div>}
                                            </div>
                                        ))}
                                        {consultationCache.hindiSummary.patientSummary?.followUpNote && (
                                            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '8px 0 0 0' }}>📅 {consultationCache.hindiSummary.patientSummary.followUpNote}</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : !emrLoading && (
                        /* Demo mode fallback cards */
                        <>
                            <div className={styles.workflowCard} style={{ padding: '20px', borderLeft: demoLength > 1 ? '4px solid rgba(16, 185, 129, 0.5)' : '4px solid rgba(255,255,255,0.1)', transition: 'all 0.5s' }}>
                                <h4 style={{ margin: '0 0 12px 0', color: 'var(--color-text-primary)', fontSize: '15px' }}>Chief Complaint & HPI</h4>
                                <p style={{ color: demoLength > 1 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontSize: '14px', margin: 0 }}>
                                    {demoLength > 1 ? 'Patient reports severe headache, confirmed with visual auras (zigzag lines).' : 'AI is listening for symptoms and history...'}
                                </p>
                            </div>
                            <div className={styles.workflowCard} style={{ padding: '20px', borderLeft: demoLength > 3 ? '4px solid rgba(16, 185, 129, 0.5)' : '4px solid rgba(255,255,255,0.1)', transition: 'all 0.5s' }}>
                                <h4 style={{ margin: '0 0 12px 0', color: 'var(--color-text-primary)', fontSize: '15px' }}>Provisional Diagnosis</h4>
                                <p style={{ color: demoLength > 3 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontSize: '14px', margin: 0 }}>
                                    {demoLength > 3 ? '🟢 Migraine with Aura (ICD-10: G43.109)' : 'Drafting diagnosis codes...'}
                                </p>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className={styles.workflowCard} style={{ padding: '20px', borderLeft: demoLength > 6 ? '4px solid rgba(239, 68, 68, 0.5)' : '4px solid rgba(255,255,255,0.1)' }}>
                                    <h4 style={{ margin: '0 0 12px 0', color: 'var(--color-text-primary)', fontSize: '15px' }}>Safety Check</h4>
                                    {demoLength > 6 ? (
                                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold' }}>⚠️ FLAG: NSAID-induced Gastritis History</div>
                                    ) : <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: 0, fontStyle: 'italic' }}>Scanning patient history...</p>}
                                </div>
                                <div className={styles.workflowCard} style={{ padding: '20px', borderLeft: demoLength >= 8 ? '4px solid rgba(16, 185, 129, 0.5)' : '4px solid rgba(255,255,255,0.1)' }}>
                                    <h4 style={{ margin: '0 0 12px 0', color: 'var(--color-text-primary)', fontSize: '15px' }}>Medications (Rx)</h4>
                                    {demoLength > 7 ? (
                                        <p style={{ color: 'var(--color-text-primary)', fontSize: '14px', margin: 0 }}>🟢 Sumatriptan 50mg (PRN / Zaroorat padne par)</p>
                                    ) : <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: 0, fontStyle: 'italic' }}>Listening for Rx...</p>}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
