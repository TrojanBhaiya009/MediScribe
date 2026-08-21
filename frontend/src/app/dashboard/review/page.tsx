'use client';
import React, { useState, useEffect, useRef } from 'react';
import styles from '../Dashboard.module.css';
import { useGlobalState } from '../GlobalStateContext';
import { useRouter } from 'next/navigation';

export default function ReviewPage() {
    const { patients, transcripts, activePatientId, setActivePatientId, setPatients, pharmacyAlerts, clinicDetails, consultationCache } = useGlobalState();
    const router = useRouter();
    const [showPatientList, setShowPatientList] = useState(false);

    const activePatient = patients.find((p: any) => p.id === activePatientId) || patients[0];
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowPatientList(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Editable Form State — will be auto-populated from Scribe transcription data
    const [complaint, setComplaint] = useState('');
    const [vitals, setVitals] = useState('');
    const [diagnosis, setDiagnosis] = useState('');
    const [investigations, setInvestigations] = useState('');
    const [medications, setMedications] = useState('');
    const [hasAutoFilled, setHasAutoFilled] = useState(false);

    // Auto-populate ONLY from structured demo transcripts (not raw live-mic noise)
    useEffect(() => {
        if (hasAutoFilled) return;

        const patientTranscripts = transcripts[activePatientId];

        // Only use transcripts that come from the demo (speaker is 'Doctor' or 'Patient', not 'Doctor/Patient (Live)')
        const structuredTranscripts = (patientTranscripts || []).filter(
            (t: any) => t.speaker === 'Doctor' || t.speaker === 'Patient'
        );

        if (structuredTranscripts.length === 0) {
            // No structured demo data — leave all fields blank for the doctor to fill manually
            setHasAutoFilled(true);
            return;
        }

        // Build HPI from structured demo conversation
        const hpiText = structuredTranscripts
            .map((t: any) => `[${t.speaker}]: ${t.text}`)
            .join('\n');
        setComplaint(hpiText);

        // Extract diagnosis from patient record
        if (activePatient?.diagnosis) {
            setDiagnosis(activePatient.diagnosis + (activePatient.diagnosis.includes('ICD') ? '' : ' (ICD-10 Pending)'));
        }

        // Extract medications from structured transcript lines
        const medLines = structuredTranscripts
            .filter((t: any) => {
                const lower = t.text.toLowerCase();
                return lower.includes('prescribe') ||
                    lower.includes('mg') ||
                    lower.includes('tablet') ||
                    lower.includes('capsule') ||
                    lower.includes('medicine') ||
                    lower.includes('dose');
            })
            .map((t: any) => t.text);
        if (medLines.length > 0) {
            setMedications(medLines.join('\n'));
        }

        setHasAutoFilled(true);
    }, [activePatientId, transcripts, activePatient, hasAutoFilled]);

    // Checklist State
    const [checks, setChecks] = useState({
        vitals: false,
        hpi: false,
        diagnosis: false,
        meds: false
    });

    const isAllChecked = Object.values(checks).every(Boolean);

    const handleSignOff = () => {
        if (!isAllChecked) {
            alert('Please complete the verification checklist before signing off.');
            return;
        }

        // Update patient status globally
        setPatients(prev => prev.map(p => p.id === activePatientId ? { ...p, status: 'Pharmacy' } : p));

        // Proceed to Handover step
        router.push('/dashboard/handover');
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank', 'width=800,height=900');
        if (!printWindow) return;
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
        printWindow.document.write(`
            <html><head><title>Prescription - ${activePatient?.name}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a1a; max-width: 700px; margin: 0 auto; }
                .header { border-bottom: 3px solid #10b981; padding-bottom: 16px; margin-bottom: 24px; }
                .clinic-name { font-size: 22px; font-weight: bold; color: #0d4f3c; }
                .clinic-info { font-size: 12px; color: #666; margin-top: 4px; }
                .patient-row { display: flex; justify-content: space-between; background: #f0fdf4; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; }
                .patient-row strong { color: #0d4f3c; }
                .section { margin-bottom: 20px; }
                .section-title { font-size: 14px; font-weight: bold; color: #10b981; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
                .section-content { font-size: 15px; line-height: 1.6; white-space: pre-line; }
                .rx-symbol { font-size: 28px; font-weight: bold; color: #10b981; margin-bottom: 8px; }
                .footer { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 16px; display: flex; justify-content: space-between; font-size: 12px; color: #888; }
                .signature { text-align: right; margin-top: 48px; }
                .signature-line { border-top: 1px solid #333; width: 200px; margin-left: auto; padding-top: 4px; font-size: 13px; }
                @media print { body { padding: 20px; } }
            </style></head><body>
            <div class="header">
                <div class="clinic-name">☤ ${clinicDetails.name}</div>
                <div class="clinic-info">${clinicDetails.doctor} | ${clinicDetails.registration}</div>
                <div class="clinic-info">${clinicDetails.address} | ${clinicDetails.mobile}</div>
            </div>
            <div class="patient-row">
                <div><strong>Patient:</strong> ${activePatient?.name} (${activePatient?.age})</div>
                <div><strong>ABHA ID:</strong> ${activePatient?.abhaId || 'N/A'}</div>
                <div><strong>Date:</strong> ${dateStr}</div>
            </div>
            <div class="section">
                <div class="section-title">Vitals</div>
                <div class="section-content">${vitals}</div>
            </div>
            <div class="section">
                <div class="section-title">History of Presenting Illness</div>
                <div class="section-content">${complaint}</div>
            </div>
            <div class="section">
                <div class="section-title">Clinical Diagnosis</div>
                <div class="section-content">${diagnosis}</div>
            </div>
            <div class="section">
                <div class="section-title">Investigations</div>
                <div class="section-content">${investigations}</div>
            </div>
            <div class="section">
                <div class="rx-symbol">℞</div>
                <div class="section-title">Prescription</div>
                <div class="section-content">${medications}</div>
            </div>
            <div class="signature">
                <div class="signature-line">${clinicDetails.doctor}</div>
            </div>
            <div class="footer">
                <div>Generated via MediScribe | ABDM Compliant</div>
                <div>${clinicDetails.timings}</div>
            </div>
            </body></html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    };

    return (
        <div className={styles.dashboardContent} style={{ padding: '24px 32px' }}>
            <div style={{ marginBottom: '16px' }}>
                <h1 className={styles.pageTitle} style={{ fontSize: '24px' }}>Welcome back, Doctor</h1>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '4px' }}>Pending Sign-Off & EMR Review</p>
            </div>

            {/* Top Action Bar with Safety Flag */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', gap: '24px' }}>
                <div className={styles.workflowCard} style={{ flex: 1, overflow: 'visible' }}>
                    <div className={styles.cardHeader}>
                        <h2 className={styles.cardTitle}>Doctor Review & Finalize</h2>
                    </div>
                    {(consultationCache?.emr?.safetyCheck?.safetyFlags?.length ?? 0) > 0 ? (
                        <div style={{ background: 'rgba(245, 158, 11, 0.1)', borderLeft: '4px solid var(--color-alert-amber)', padding: '16px 20px', borderRadius: '8px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                            <div style={{ fontSize: '24px' }}>⚠️</div>
                            <div>
                                <h4 style={{ margin: 0, color: 'var(--color-alert-amber)', fontSize: '15px', fontWeight: 'bold' }}>Clinical Safety Flag: {consultationCache?.emr?.safetyCheck?.overallSafetyStatus === 'critical_flags' ? 'Critical' : 'Warning'}</h4>
                                <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-primary)', fontSize: '14px' }}>{consultationCache?.emr?.safetyCheck?.safetyFlags?.[0]?.message}</p>
                            </div>
                        </div>
                    ) : (
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', borderLeft: '4px solid var(--color-accent-green)', padding: '16px 20px', borderRadius: '8px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                            <div style={{ fontSize: '24px' }}>✅</div>
                            <div>
                                <h4 style={{ margin: 0, color: 'var(--color-accent-green)', fontSize: '15px', fontWeight: 'bold' }}>No Safety Flags</h4>
                                <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-primary)', fontSize: '14px' }}>No drug interactions or contraindications detected.</p>
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', height: '100%', paddingTop: '12px' }}>
                    <button onClick={handlePrint} style={{ padding: '12px 24px', background: 'transparent', border: '1px solid var(--color-accent-green)', color: 'var(--color-accent-green)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🖨️ Print Prescription
                    </button>
                    <button style={{ padding: '12px 24px', background: 'transparent', border: '1px solid var(--color-text-secondary)', color: 'var(--color-text-primary)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                        Discard Draft
                    </button>
                    <button
                        onClick={handleSignOff}
                        style={{ padding: '12px 24px', background: isAllChecked ? 'var(--color-accent-green)' : 'rgba(255,255,255,0.1)', color: isAllChecked ? '#fff' : 'var(--color-text-secondary)', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isAllChecked ? 'pointer' : 'not-allowed', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        Verify & Sign-Off (ABDM Sync) {isAllChecked && '✓'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: '24px', flex: 1, alignItems: 'start' }}>

                {/* Left Sidebar: Verification Checklist */}
                <div className={styles.workflowCard} style={{ padding: '24px', position: 'sticky', top: '24px' }}>
                    <h3 className={styles.sectionHeader} style={{ margin: '0 0 20px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>Clinical Verification</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={checks.vitals} onChange={e => setChecks({ ...checks, vitals: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: 'var(--color-accent-green)', cursor: 'pointer' }} />
                            <span style={{ fontSize: '15px', color: checks.vitals ? 'var(--color-text-secondary)' : 'var(--color-text-primary)', textDecoration: checks.vitals ? 'line-through' : 'none' }}>Verify Vitals</span>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={checks.hpi} onChange={e => setChecks({ ...checks, hpi: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: 'var(--color-accent-green)', cursor: 'pointer' }} />
                            <span style={{ fontSize: '15px', color: checks.hpi ? 'var(--color-text-secondary)' : 'var(--color-text-primary)', textDecoration: checks.hpi ? 'line-through' : 'none' }}>Confirm HPI & Symptoms</span>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={checks.diagnosis} onChange={e => setChecks({ ...checks, diagnosis: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: 'var(--color-accent-green)', cursor: 'pointer' }} />
                            <span style={{ fontSize: '15px', color: checks.diagnosis ? 'var(--color-text-secondary)' : 'var(--color-text-primary)', textDecoration: checks.diagnosis ? 'line-through' : 'none' }}>Verify ICD-10 Coding</span>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', background: checks.meds ? 'transparent' : 'rgba(245, 158, 11, 0.1)', padding: '8px -8px', borderRadius: '4px', borderLeft: checks.meds ? 'none' : '2px solid var(--color-alert-amber)' }}>
                            <input type="checkbox" checked={checks.meds} onChange={e => setChecks({ ...checks, meds: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: 'var(--color-accent-green)', cursor: 'pointer', marginLeft: checks.meds ? '0' : '10px' }} />
                            <span style={{ fontSize: '15px', color: checks.meds ? 'var(--color-text-secondary)' : 'var(--color-text-primary)', textDecoration: checks.meds ? 'line-through' : 'none' }}>Review Medication Dosage</span>
                        </label>
                    </div>

                    <div style={{ marginTop: '32px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }} ref={dropdownRef}>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Active Reviewing</div>
                        <button onClick={() => setShowPatientList(!showPatientList)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-primary)', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
                            {activePatient ? `${activePatient.name}` : 'Select Patient...'}
                            <span style={{ fontSize: '12px' }}>▼</span>
                        </button>
                        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{activePatient?.age || ''} | {activePatient?.id || ''}</div>
                        {activePatient?.abhaId && (
                            <div style={{ marginTop: '8px', padding: '8px 10px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>ABHA ID</span>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-accent-green)', marginTop: '2px' }}>{activePatient.abhaId}</div>
                            </div>
                        )}

                        {showPatientList && (
                            <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: '8px', background: 'var(--color-sidebar-bg)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: '100%', zIndex: 100, boxShadow: '0 -10px 25px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                                <div style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Pending Review</div>
                                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                    {patients.filter((p: any) => p.status === 'Reviewing' || p.status === 'Transcribing' || p.status === 'Waiting').map((p: any) => (
                                        <div key={p.id} onClick={() => { setActivePatientId(p.id); setShowPatientList(false); }} style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: activePatientId === p.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent' }}>
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{p.name}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--color-accent-green)' }}>{p.status}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Signed Off (History)</div>
                                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                    {patients.filter((p: any) => !['Waiting', 'Transcribing', 'Reviewing'].includes(p.status) && p.condition !== 'Pending Intake').map((p: any) => (
                                        <div key={p.id} onClick={() => { setActivePatientId(p.id); setShowPatientList(false); }} style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: activePatientId === p.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent' }}>
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{p.name}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Done</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Area: Interactive EMR Editor */}
                <div className={styles.workflowCard} style={{ padding: '0', overflow: 'hidden' }}>
                    <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                        <h3 className={styles.sectionHeader} style={{ margin: 0 }}>Editable Clinical Note</h3>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Click any field to edit AI-generated text</span>
                    </div>

                    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        {/* Vitals Grid */}
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Vitals & Measurements</label>
                            <input
                                value={vitals}
                                onChange={e => setVitals(e.target.value)}
                                style={{ width: '100%', padding: '12px 16px', background: 'var(--color-workspace-bg)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--color-text-primary)', fontSize: '15px', outline: 'none', transition: 'border 0.2s' }}
                            />
                        </div>

                        {/* Chief Complaint */}
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>History of Presenting Illness (HPI)</label>
                            <textarea
                                value={complaint}
                                onChange={e => setComplaint(e.target.value)}
                                rows={3}
                                style={{ width: '100%', padding: '12px 16px', background: 'var(--color-workspace-bg)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--color-text-primary)', fontSize: '15px', resize: 'vertical', outline: 'none', lineHeight: '1.5' }}
                            />
                        </div>

                        {/* Investigations & Diagnosis */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Clinical Diagnosis (ICD-10)</label>
                                <textarea
                                    value={diagnosis}
                                    onChange={e => setDiagnosis(e.target.value)}
                                    rows={2}
                                    style={{ width: '100%', padding: '12px 16px', background: 'var(--color-workspace-bg)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--color-text-primary)', fontSize: '15px', outline: 'none', resize: 'none' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Investigations Ordered</label>
                                <textarea
                                    value={investigations}
                                    onChange={e => setInvestigations(e.target.value)}
                                    rows={2}
                                    style={{ width: '100%', padding: '12px 16px', background: 'var(--color-workspace-bg)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--color-text-primary)', fontSize: '15px', outline: 'none', resize: 'none' }}
                                />
                            </div>
                        </div>

                        {/* Rx */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: 'var(--color-text-secondary)' }}>Final Prescription (Rx)</label>
                                {!checks.meds && <span style={{ fontSize: '12px', color: 'var(--color-alert-amber)', fontWeight: 'bold' }}>Review required due to Safety Flag</span>}
                            </div>
                            <textarea
                                value={medications}
                                onChange={e => setMedications(e.target.value)}
                                rows={4}
                                style={{ width: '100%', padding: '12px 16px', background: 'var(--color-workspace-bg)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--color-text-primary)', fontSize: '15px', resize: 'vertical', outline: 'none', lineHeight: '1.5', borderLeft: !checks.meds ? '3px solid var(--color-alert-amber)' : '1px solid rgba(255,255,255,0.1)' }}
                            />
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
