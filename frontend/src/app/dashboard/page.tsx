'use client';
import React, { useState } from 'react';
import styles from './Dashboard.module.css';
import { useGlobalState } from './GlobalStateContext';

export default function SuperAdminDashboard() {
    const { pharmacyAlerts } = useGlobalState();

    const doctorPerformance = [
        { id: 1, name: 'Dr. Rajesh Sharma', specialty: 'General Med', patients: 42, syncRate: '98%', timeSaved: '4.2 hrs' },
        { id: 2, name: 'Dr. Anjali Desai', specialty: 'Pediatrics', patients: 38, syncRate: '95%', timeSaved: '3.8 hrs' },
        { id: 3, name: 'Dr. विक्रम सिंह (Vikram)', specialty: 'Ortho', patients: 29, syncRate: '92%', timeSaved: '2.5 hrs' },
    ];

    return (
        <div className={styles.dashboardContent} style={{ padding: '24px 32px' }}>
            {/* Header */}
            <div className={styles.topHeader} style={{ marginBottom: '24px' }}>
                <h1 className={styles.pageTitle} style={{ fontSize: '28px' }}>Metrics & Reports</h1>
                <div style={{ display: 'flex', gap: '16px' }}>
                    <button style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--color-text-primary)' }}>
                        Download Reports
                    </button>
                </div>
            </div>

            {/* Top Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>

                <div className={styles.workflowCard} style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Active Doctors</span>
                    <div style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--color-text-primary)', marginTop: '8px' }}>12</div>
                    <span style={{ fontSize: '13px', color: 'var(--color-accent-green)', marginTop: '4px' }}>↗ 2 added this month</span>
                </div>

                <div className={styles.workflowCard} style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Receptionist Teams</span>
                    <div style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--color-text-primary)', marginTop: '8px' }}>4</div>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Across 3 shifts</span>
                </div>

                <div className={styles.workflowCard} style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>ABDM Records Synced</span>
                    <div style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--color-text-primary)', marginTop: '8px' }}>1,432</div>
                    <span style={{ fontSize: '13px', color: 'var(--color-accent-green)', marginTop: '4px' }}>↗ 18% increase this week</span>
                </div>

                <div className={styles.workflowCard} style={{ padding: '24px', display: 'flex', flexDirection: 'column', borderTop: '4px solid var(--color-accent-green)' }}>
                    <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>System Efficiency Score</span>
                    <div style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--color-text-primary)', marginTop: '8px' }}>94%</div>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Avg 3.5 hrs saved / doctor / day</span>
                </div>

                {/* Global Pharmacy Alerts Metric Card */}
                {pharmacyAlerts && pharmacyAlerts.length > 0 && (
                    <div className={styles.workflowCard} style={{ padding: '24px', display: 'flex', flexDirection: 'column', borderTop: '4px solid #ef4444', gridColumn: '1 / -1', background: 'rgba(239, 68, 68, 0.05)', overflow: 'visible' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <span style={{ fontSize: '18px' }}>⚠️</span>
                            <span style={{ fontSize: '14px', color: '#ef4444', fontWeight: 'bold', textTransform: 'uppercase' }}>Active Pharmacy Fleet Alerts</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                            {pharmacyAlerts.map((alert: string, idx: number) => (
                                <div key={idx} style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '13px', color: 'var(--color-text-primary)' }}>
                                    {alert}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(600px, 2fr) minmax(350px, 1fr)', gap: '24px', flex: 1, alignItems: 'start' }}>

                {/* Left: Doctor Performance Table */}
                <div className={styles.workflowCard} style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className={styles.sectionHeader} style={{ margin: 0 }}>Doctor Performance & Utilization (Today)</h3>
                    </div>
                    <div className={styles.tableContainer} style={{ border: 'none' }}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Doctor Name</th>
                                    <th>Specialty</th>
                                    <th>Patients Seen</th>
                                    <th>ABDM Sync %</th>
                                    <th>Time Saved</th>
                                </tr>
                            </thead>
                            <tbody>
                                {doctorPerformance.map((doc) => (
                                    <tr key={doc.id} className={styles.tableRow}>
                                        <td><span className={styles.fw600}>{doc.name}</span></td>
                                        <td><span className={styles.textMuted}>{doc.specialty}</span></td>
                                        <td>{doc.patients}</td>
                                        <td>
                                            <span style={{ color: 'var(--color-accent-green)', fontWeight: 'bold' }}>{doc.syncRate}</span>
                                        </td>
                                        <td><span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>{doc.timeSaved}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style={{ padding: '16px', background: 'rgba(56, 189, 248, 0.1)', borderLeft: '4px solid #38bdf8', borderRadius: '8px', marginBottom: '24px' }}>
                    <h4 style={{ margin: 0, color: '#38bdf8', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📊</span> Observability & Reporting Mode
                    </h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                        The Super Admin dashboard is designed strictly for clinic oversight, metrics, and personnel management. No direct clinical documentation can be performed from this view.
                    </p>
                </div>

            </div>
        </div>
    );
}
