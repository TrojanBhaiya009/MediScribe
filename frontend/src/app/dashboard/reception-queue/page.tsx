'use client';
import React, { useState } from 'react';
import styles from '../Dashboard.module.css';
import { useGlobalState } from '../GlobalStateContext';

const STATUS_FLOW = ['Waiting', 'In Consultation', 'Pharmacy', 'Completed'];
const STATUS_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
    'Waiting':          { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b', icon: '⏳' },
    'In Consultation':  { bg: 'rgba(56, 189, 248, 0.1)', text: '#38bdf8', icon: '🩺' },
    'Pharmacy':         { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6', icon: '💊' },
    'Completed':        { bg: 'rgba(16, 185, 129, 0.1)', text: 'var(--color-accent-green)', icon: '✅' },
};

export default function ReceptionistQueuePage() {
    const { patients, setPatients } = useGlobalState();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('All');

    const filtered = patients.filter((p: any) => {
        const matchesSearch = !searchTerm || p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || p.id?.toLowerCase().includes(searchTerm.toLowerCase()) || p.mobile?.includes(searchTerm);
        const matchesFilter = filterStatus === 'All' || p.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    const counts = {
        all: patients.length,
        waiting: patients.filter((p: any) => p.status === 'Waiting').length,
        consultation: patients.filter((p: any) => p.status === 'In Consultation').length,
        pharmacy: patients.filter((p: any) => p.status === 'Pharmacy').length,
        completed: patients.filter((p: any) => p.status === 'Completed').length,
    };

    const handleStatusChange = (patientId: string, newStatus: string) => {
        setPatients((prev: any[]) => prev.map((p: any) => p.id === patientId ? { ...p, status: newStatus } : p));
    };

    return (
        <div className={styles.dashboardContent} style={{ padding: '24px 32px' }}>
            <div style={{ marginBottom: '24px' }}>
                <h1 className={styles.pageTitle} style={{ fontSize: '28px' }}>Today&apos;s Queue</h1>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '4px' }}>Reception → Doctor → Pharmacy → Complete</p>
            </div>

            {/* Status Tab Bar */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {[{ label: 'All', count: counts.all }, { label: 'Waiting', count: counts.waiting }, { label: 'In Consultation', count: counts.consultation }, { label: 'Pharmacy', count: counts.pharmacy }, { label: 'Completed', count: counts.completed }].map(tab => (
                    <button
                        key={tab.label}
                        onClick={() => setFilterStatus(tab.label)}
                        style={{
                            padding: '8px 16px', borderRadius: '8px', border: filterStatus === tab.label ? '1px solid var(--color-accent-green)' : '1px solid rgba(255,255,255,0.1)',
                            background: filterStatus === tab.label ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                            color: filterStatus === tab.label ? 'var(--color-accent-green)' : 'var(--color-text-secondary)',
                            fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                    >
                        {tab.label} <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '10px', fontSize: '11px' }}>{tab.count}</span>
                    </button>
                ))}
            </div>

            {/* Search */}
            <div style={{ marginBottom: '16px', maxWidth: '400px' }}>
                <input
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search by name, ABHA ID, or phone..."
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--color-text-primary)', fontSize: '14px' }}
                />
            </div>

            {/* Queue Table */}
            <div className={styles.workflowCard} style={{ padding: 0, overflow: 'hidden', maxWidth: '1100px' }}>
                <div className={styles.tableContainer} style={{ border: 'none' }}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Patient Name</th>
                                <th>ABHA Status</th>
                                <th>Assigned Doctor</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No patients match the current filter.</td></tr>
                            ) : (
                                filtered.map((row: any, i: number) => {
                                    const statusInfo = STATUS_COLORS[row.status] || STATUS_COLORS['Waiting'];
                                    const currentIndex = STATUS_FLOW.indexOf(row.status);
                                    const nextStatus = currentIndex < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIndex + 1] : null;
                                    return (
                                        <tr key={i} className={styles.tableRow}>
                                            <td><span className={styles.textMuted}>{row.time || 'Today'}</span></td>
                                            <td>
                                                <span className={styles.fw600}>{row.name}</span>
                                                {row.age && <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: '6px' }}>({row.age})</span>}
                                            </td>
                                            <td>
                                                {row.isLinked ? (
                                                    <span style={{ fontFamily: 'monospace', color: 'var(--color-accent-green)', fontWeight: 'bold', fontSize: '12px' }}>✓ {row.abhaId || 'Linked'}</span>
                                                ) : (
                                                    <button style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-primary)', border: '1px solid rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Discover ABHA</button>
                                                )}
                                            </td>
                                            <td><span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{row.assignedDoctor || 'Unassigned'}</span></td>
                                            <td>
                                                <span style={{
                                                    padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold',
                                                    background: statusInfo.bg, color: statusInfo.text,
                                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                }}>
                                                    {statusInfo.icon} {row.status}
                                                </span>
                                            </td>
                                            <td>
                                                {nextStatus && (
                                                    <button
                                                        onClick={() => handleStatusChange(row.id, nextStatus)}
                                                        style={{
                                                            padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                                                            background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-accent-green)',
                                                            border: '1px solid rgba(16, 185, 129, 0.3)', cursor: 'pointer',
                                                        }}
                                                    >
                                                        → {nextStatus}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Status Flow Legend */}
            <div style={{ display: 'flex', gap: '16px', marginTop: '20px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 'bold' }}>FLOW:</span>
                {STATUS_FLOW.map((status, idx) => (
                    <React.Fragment key={status}>
                        <span style={{
                            fontSize: '12px', padding: '3px 10px', borderRadius: '6px',
                            background: STATUS_COLORS[status].bg, color: STATUS_COLORS[status].text, fontWeight: 600,
                        }}>
                            {STATUS_COLORS[status].icon} {status}
                        </span>
                        {idx < STATUS_FLOW.length - 1 && <span style={{ color: 'var(--color-text-secondary)' }}>→</span>}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}
