'use client';
import React from 'react';
import styles from '../Dashboard.module.css';
import { useGlobalState } from '../GlobalStateContext';

export default function SchedulePage() {
    const { patients } = useGlobalState();
    return (
        <div className={styles.dashboardContent}>
            <div className={styles.topHeader}>
                <h1 className={styles.pageTitle}>Clinical Schedule</h1>
                <div className={styles.headerActions}>
                    <div className={styles.searchBar}>
                        <span className={styles.searchIcon}>🔍</span>
                        <input type="text" placeholder="Search appointments..." className={styles.searchInput} />
                    </div>
                    <button className={styles.iconBtn}>
                        📅
                    </button>
                </div>
            </div>

            <div className={styles.workflowCard} style={{ flex: 1, padding: '32px' }}>
                <div style={{ padding: '0 0 24px 0', borderBottom: '1px solid #f1f5f9', marginBottom: '24px' }}>
                    <h2 className={styles.sectionHeader} style={{ border: 'none', margin: 0, padding: 0 }}>Today - March 15, 2026</h2>
                    <p className={styles.vitalsSub}>28 Appointments | 1.4h Estimated Time Saved</p>
                </div>

                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}></th>
                                <th>Time</th>
                                <th>Patient</th>
                                <th>Clinical Urgency</th>
                                <th>Notes</th>
                                <th>ABDM Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {patients.map((row: any, i: number) => {
                                const isUrgent = (row.stat || row.status) === 'Acute';
                                const type = isUrgent ? 'Urgent' : 'Routine';
                                const typeColor = isUrgent ? '#fee2e2' : '#fef3c7';
                                const typeText = isUrgent ? '#991b1b' : '#92400e';

                                let abdm = '⏳ Pending';
                                if (row.isLinked) abdm = '✅ Synced';
                                if (row.id === 'Not Linked') abdm = '❌ Unlinked';

                                return (
                                    <tr key={i} className={styles.tableRow} style={{ cursor: 'grab' }}>
                                        <td style={{ cursor: 'grab', color: '#cbd5e1' }}>☰</td>
                                        <td><span className={styles.fw600}>{row.time || '12:00 PM'}</span></td>
                                        <td><span className={styles.fw600}>{row.name} {row.age && `(${row.age})`}</span></td>
                                        <td>
                                            <span style={{ backgroundColor: typeColor, color: typeText, padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
                                                {type}
                                            </span>
                                        </td>
                                        <td><span className={styles.textMuted}>{row.condition || row.diagnosis || 'General Checkup'}</span></td>
                                        <td>
                                            <span style={{ fontSize: '13px', fontWeight: '500', color: abdm.includes('✅') ? '#059669' : abdm.includes('⏳') ? '#d97706' : '#64748b' }}>
                                                {abdm}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
