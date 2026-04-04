'use client';
import React, { useState } from 'react';
import styles from '../Dashboard.module.css';
import { useGlobalState } from '../GlobalStateContext';

export default function PharmacyAlertsPage() {
    const { pharmacyAlerts, setPharmacyAlerts } = useGlobalState();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredAlerts = pharmacyAlerts.filter((alert: string) => alert.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className={styles.dashboardContent} style={{ padding: '24px 32px' }}>
            <div style={{ marginBottom: '24px' }}>
                <h1 className={styles.pageTitle} style={{ fontSize: '28px' }}>Inventory Alerts</h1>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '4px' }}>Manage critical out-of-stock notices broadcasted to the clinical team.</p>
            </div>

            <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                <div className={styles.workflowCard} style={{ padding: '24px', borderTop: '4px solid #ef4444', flex: 'none', overflow: 'visible' }}>
                    <h3 className={styles.sectionHeader} style={{ fontSize: '16px', margin: '0 0 16px 0', border: 'none', padding: 0 }}>Broadcast New Alert</h3>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const input = (e.target as any).alertInput;
                        if (input.value.trim()) {
                            setPharmacyAlerts([...pharmacyAlerts, input.value.trim()]);
                            input.value = '';
                        }
                    }} style={{ display: 'flex', gap: '12px' }}>
                        <input
                            name="alertInput"
                            placeholder="e.g. Out of stock: Amoxicillin 500mg"
                            style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--color-text-primary)' }}
                            required
                        />
                        <button type="submit" className={styles.btnPrimaryHeavy} style={{ padding: '12px 24px', background: '#ef4444', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)' }}>
                            Broadcast
                        </button>
                    </form>
                </div>

                <div className={styles.workflowCard} style={{ padding: '24px', flex: 'none', overflow: 'visible' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 className={styles.sectionHeader} style={{ fontSize: '16px', margin: 0 }}>Active Notices</h3>
                        <input
                            placeholder="Search notices..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '13px', width: '200px' }}
                        />
                    </div>

                    {pharmacyAlerts.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                            ✅ All standard inventory is currently in stock. No active alerts.
                        </div>
                    ) : filteredAlerts.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                            No notices match your search.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto', paddingRight: '8px' }}>
                            {filteredAlerts.map((alert: string, index: number) => (
                                <div key={index} style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--color-text-primary)', fontSize: '14px' }}>{alert}</span>
                                    <button
                                        onClick={() => setPharmacyAlerts(pharmacyAlerts.filter((a: string) => a !== alert))}
                                        style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                    >
                                        Resolve
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
