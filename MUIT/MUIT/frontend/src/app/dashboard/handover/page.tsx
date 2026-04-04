'use client';
import React, { useEffect, useState } from 'react';
import styles from '../Dashboard.module.css';
import { useGlobalState } from '../GlobalStateContext';
import { inventoryApi, InventoryStatus } from '@/lib/api';

export default function HandoverPage() {
    const { patients, activePatientId, setActivePatientId, setPatients, clinicDetails, consultationCache } = useGlobalState();
    const [inventoryStatus, setInventoryStatus] = useState<InventoryStatus | null>(null);
    const [dispensing, setDispensing] = useState(false);
    const [dispenseError, setDispenseError] = useState<string | null>(null);

    const activePatient = patients.find((p: any) => p.id === activePatientId) || patients.find((p: any) => p.status === 'Pharmacy');

    // Get medications from consultation cache if available
    const emr = consultationCache?.emr;
    const hindiSummary = consultationCache?.hindiSummary;

    useEffect(() => {
        const fetchInventory = async () => {
            try {
                const status = await inventoryApi.getStatus();
                setInventoryStatus(status);
            } catch {
                // Non-blocking for UI; queue can still render.
            }
        };
        fetchInventory();
    }, []);

    const getMedicationAlert = (medName: string) => {
        if (!inventoryStatus?.alerts) return null;
        return inventoryStatus.alerts.find(a =>
            a.drug_name.toLowerCase().includes(medName.toLowerCase()) ||
            medName.toLowerCase().includes(a.drug_name.split(' ')[0].toLowerCase())
        );
    };

    const handleDispense = async (patientId: string) => {
        setDispensing(true);
        setDispenseError(null);

        try {
            const medications = emr?.medications || [];
            if (medications.length > 0) {
                const items = medications.map((med: any) => ({
                    drug_name: med.name || med,
                    quantity: 1,
                }));

                const result = await inventoryApi.dispense(items);
                if (result.errors && result.errors.length > 0) {
                    setDispenseError(`Some items unavailable: ${result.errors.join(', ')}`);
                }

                const status = await inventoryApi.getStatus();
                setInventoryStatus(status);
            }

            setPatients((prev: any[]) => prev.map((p: any) => p.id === patientId ? { ...p, status: 'Completed' } : p));

            const next = patients.find((p: any) => p.status === 'Pharmacy' && p.id !== patientId);
            if (next) setActivePatientId(next.id);
        } catch (err: any) {
            setDispenseError(err.message || 'Failed to dispense');
        } finally {
            setDispensing(false);
        }

    };

    const pharmacyPatients = patients.filter((p: any) => p.status === 'Pharmacy');
    const completedPatients = patients.filter((p: any) => p.status === 'Completed');

    return (
        <div className={styles.dashboardContent} style={{ padding: '24px 32px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '24px' }}>
                <h1 className={styles.pageTitle} style={{ fontSize: '28px' }}>Pharmacy Dispatch</h1>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '4px' }}>Dispense approved prescriptions &amp; generate patient handover</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(350px, 1fr) minmax(300px, 400px)', gap: '24px', flex: 1, alignItems: 'stretch', minHeight: 0 }}>

                {/* Column 1: Pharmacy Queue */}
                <div className={styles.workflowCard} style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>Pharmacy Queue</h3>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        <div style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 'bold', color: '#f59e0b', textTransform: 'uppercase', background: 'rgba(245, 158, 11, 0.05)' }}>
                            💊 Pending Dispense ({pharmacyPatients.length})
                        </div>
                        {pharmacyPatients.length === 0 ? (
                            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px', fontStyle: 'italic' }}>No pending prescriptions.</div>
                        ) : pharmacyPatients.map((p: any) => (
                            <div key={p.id} onClick={() => setActivePatientId(p.id)} style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', background: activePatientId === p.id ? 'rgba(139, 92, 246, 0.1)' : 'transparent', borderLeft: activePatientId === p.id ? '3px solid #8b5cf6' : '3px solid transparent' }}>
                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{p.name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{p.diagnosis || 'Pending'}</div>
                            </div>
                        ))}

                        <div style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 'bold', color: 'var(--color-accent-green)', textTransform: 'uppercase', background: 'rgba(16, 185, 129, 0.05)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            ✅ Dispensed ({completedPatients.length})
                        </div>
                        {completedPatients.map((p: any) => (
                            <div key={p.id} onClick={() => setActivePatientId(p.id)} style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', background: activePatientId === p.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent', borderLeft: activePatientId === p.id ? '3px solid var(--color-accent-green)' : '3px solid transparent' }}>
                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{p.name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--color-accent-green)', marginTop: '4px' }}>Done</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Column 2: Clinical Summary (PDF Preview) */}
                <div style={{ background: '#ffffff', borderRadius: '4px', padding: '40px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', display: 'flex', flexDirection: 'column', color: '#0f172a', borderTop: '8px solid var(--color-navy-blue)', height: '100%', minHeight: '600px', overflowY: 'auto' }}>
                    <div style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: 'bold', color: 'var(--color-navy-blue)' }}>{clinicDetails.name}</h2>
                            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{clinicDetails.doctor}<br />{clinicDetails.registration}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold' }}>Date: {new Date().toLocaleDateString()}</p>
                            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Time: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '6px', marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Patient Name</span>
                            <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{activePatient?.name || '—'}</div>
                        </div>
                        <div>
                            <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Age/Sex</span>
                            <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{activePatient?.age || '—'}</div>
                        </div>
                        <div>
                            <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>ABHA ID</span>
                            <div style={{ fontSize: '14px' }}>{activePatient?.abhaId || '—'}</div>
                        </div>
                        <div>
                            <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Status</span>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: activePatient?.status === 'Pharmacy' ? '#8b5cf6' : '#16a34a' }}>{activePatient?.status || '—'}</div>
                        </div>
                    </div>

                    {/* EMR Data if available */}
                    {emr && (
                        <>
                            <div style={{ marginBottom: '24px' }}>
                                <h4 style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '12px' }}>Chief Complaint & HPI</h4>
                                <p style={{ fontSize: '14px', lineHeight: '1.6', margin: 0 }}>{emr.chiefComplaint?.value || 'N/A'} — {emr.hpi?.value || 'N/A'}</p>
                            </div>
                            <div style={{ marginBottom: '24px' }}>
                                <h4 style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '12px' }}>Clinical Diagnosis</h4>
                                <p style={{ fontSize: '15px', fontWeight: 'bold', margin: 0 }}>{emr.diagnosis?.value || 'Pending'}</p>
                            </div>
                        </>
                    )}

                    {/* Prescription */}
                    <div style={{ background: '#f0fdf4', border: '2px solid #bbf7d0', padding: '20px', borderRadius: '8px', marginTop: 'auto' }}>
                        <h3 style={{ fontSize: '18px', color: '#166534', margin: '0 0 16px 0', borderBottom: '1px solid #bbf7d0', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '24px' }}>℞</span> Prescription
                        </h3>
                        {emr?.medications?.length ? (
                            <ol style={{ fontSize: '16px', lineHeight: '1.8', margin: 0, paddingLeft: '24px', fontWeight: '600', color: '#0f172a' }}>
                                {emr.medications.map((med: any, idx: number) => {
                                    const medName = typeof med === 'string' ? med : med.name;
                                    const alert = getMedicationAlert(medName);
                                    return (
                                        <li key={idx} style={{ marginBottom: '8px' }}>
                                            {medName} {med.dosage && `(${med.dosage})`} {med.frequency && `— ${med.frequency}`}
                                            {alert && (
                                                <span style={{ display: 'block', fontSize: '13px', color: alert.status === 'out_of_stock' ? '#ef4444' : '#f59e0b', fontWeight: 'normal' }}>
                                                    {alert.status === 'out_of_stock' ? '⚠️ Out of stock — check substitutes' : `⚠️ Low stock (${alert.current_quantity} remaining)`}
                                                </span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ol>
                        ) : (
                            <p style={{ fontSize: '14px', color: '#64748b', fontStyle: 'italic', margin: 0 }}>No medications prescribed yet. Generate EMR from the Scribe page first.</p>
                        )}
                    </div>
                </div>

                {/* Column 3: Patient Handover Card + Hindi Summary */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Hindi Summary from Agent 3 */}
                    {hindiSummary ? (
                        <div className={styles.workflowCard} style={{ padding: '24px', borderTop: '6px solid #8b5cf6', display: 'flex', flexDirection: 'column', flex: 1 }}>
                            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                                <span style={{ fontSize: '36px' }}>🇮🇳</span>
                                <h2 style={{ fontSize: '20px', color: 'var(--color-text-primary)', margin: '8px 0 4px 0' }}>Patient Summary (Hindi)</h2>
                                <p style={{ fontSize: '13px', color: '#8b5cf6', margin: 0 }}>Generated by Agent 3 — Hindi Summarizer</p>
                            </div>

                            <div style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.2)', padding: '16px', borderRadius: '12px', marginBottom: '16px', textAlign: 'center' }}>
                                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>आपकी बीमारी</span>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                                    {hindiSummary.patientSummary?.diagnosisSimple || 'N/A'}
                                </div>
                            </div>

                            <div style={{ flex: 1 }}>
                                <h4 style={{ fontSize: '15px', color: 'var(--color-text-primary)', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>दवाइयाँ कैसे लेनी हैं:</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {hindiSummary.patientSummary?.medicationInstructions?.map((med, idx) => (
                                        <div key={idx} style={{ background: 'rgba(139, 92, 246, 0.05)', borderLeft: '4px solid #8b5cf6', padding: '14px', borderRadius: '6px' }}>
                                            <h5 style={{ fontSize: '15px', margin: '0 0 6px 0', color: 'var(--color-text-primary)' }}>{idx + 1}. {med.name}</h5>
                                            <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 'bold' }}>{med.hindiInstruction}</p>
                                            {med.warning && <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#f59e0b' }}>⚠️ {med.warning}</p>}
                                        </div>
                                    ))}
                                </div>

                                {hindiSummary.patientSummary?.followUpNote && (
                                    <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '8px', fontSize: '13px', color: '#38bdf8' }}>
                                        📅 {hindiSummary.patientSummary.followUpNote}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Fallback — static patient discharge card */
                        <div className={styles.workflowCard} style={{ padding: '32px', borderTop: '6px solid var(--color-accent-green)', display: 'flex', flexDirection: 'column', flex: 1 }}>
                            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                <span style={{ fontSize: '48px' }}>🩺</span>
                                <h2 style={{ fontSize: '22px', color: 'var(--color-text-primary)', margin: '12px 0 4px 0' }}>Patient Discharge Summary</h2>
                                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>Simplified Instructions for You</p>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '20px', borderRadius: '12px', marginBottom: '24px', textAlign: 'center' }}>
                                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Your Diagnosis</span>
                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{activePatient?.diagnosis || 'Pending'}</div>
                            </div>

                            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px', fontStyle: 'italic' }}>
                                Hindi summary will appear here after doctor approves the consultation via the Scribe page.
                            </p>
                        </div>
                    )}

                    {inventoryStatus && inventoryStatus.alerts.length > 0 && (
                        <div className={styles.workflowCard} style={{ padding: '16px', borderTop: '4px solid #f59e0b' }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                ⚠️ Inventory Alerts ({inventoryStatus.alerts.length})
                            </h4>
                            <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
                                {inventoryStatus.alerts.slice(0, 5).map((alert, idx) => (
                                    <div key={idx} style={{
                                        padding: '8px 10px',
                                        background: alert.status === 'out_of_stock' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                        borderRadius: '6px',
                                        marginBottom: '6px',
                                        fontSize: '13px'
                                    }}>
                                        <span style={{ fontWeight: 'bold', color: alert.status === 'out_of_stock' ? '#ef4444' : '#f59e0b' }}>
                                            {alert.drug_name}
                                        </span>
                                        <span style={{ color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                                            {alert.status === 'out_of_stock' ? 'OUT OF STOCK' : `${alert.current_quantity} left`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Dispense Button */}
                    {activePatient?.status === 'Pharmacy' && typeof window !== 'undefined' && localStorage.getItem('userRole') === 'Pharmacist' && (
                        <>
                            {dispenseError && (
                                <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', fontSize: '13px' }}>
                                    {dispenseError}
                                </div>
                            )}
                            <button
                                onClick={() => handleDispense(activePatient.id)}
                                disabled={dispensing}
                                style={{
                                    width: '100%',
                                    padding: '16px',
                                    background: dispensing ? 'var(--color-text-secondary)' : 'var(--color-accent-green)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontSize: '16px',
                                    fontWeight: 'bold',
                                    cursor: dispensing ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    gap: '8px',
                                    boxShadow: dispensing ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.3)'
                                }}
                            >
                                {dispensing ? '⏳ Processing...' : '✅ Mark Dispensed & Close Case'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
