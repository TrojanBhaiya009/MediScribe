'use client';
import React from 'react';
import styles from '../Dashboard.module.css';

export default function AnalyticsPage() {
    return (
        <div className={styles.dashboardContent}>
            <div className={styles.topHeader}>
                <h1 className={styles.pageTitle}>Clinic Analytics</h1>
                <div className={styles.headerActions}>
                    <button className={styles.btnSecondary}>
                        Export Report
                    </button>
                </div>
            </div>

            <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiHeader}>
                        <span className={styles.kpiLabel}>TOTAL PATIENTS SEEN</span>
                        <span className={styles.iconBtn} style={{ boxShadow: 'none', border: 'none', background: '#f8fafc', width: '36px', height: '36px' }}>👥</span>
                    </div>
                    <div className={styles.kpiValue}>
                        1,248
                    </div>
                    <span className={styles.kpiTrend}>
                        <span className={styles.trendUp}>↗ +12%</span> vs last month
                    </span>
                </div>

                <div className={styles.kpiCard}>
                    <div className={styles.kpiHeader}>
                        <span className={styles.kpiLabel}>ABDM HEALTH RECORDS GENERATED</span>
                        <span className={styles.iconBtn} style={{ boxShadow: 'none', border: 'none', background: '#f8fafc', width: '36px', height: '36px' }}>📄</span>
                    </div>
                    <div className={styles.kpiValue}>
                        1,104 <span className={styles.kpiSub}>Successfully Synced</span>
                    </div>
                    <span className={styles.kpiTrend}>
                        <span className={styles.trendUp}>↗ 88%</span> compliance rate this week
                    </span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flex: 1 }}>
                <div className={styles.workflowCard} style={{ padding: '32px', display: 'flex', flexDirection: 'column' }}>
                    <h3 className={styles.sectionHeader} style={{ margin: '0 0 24px 0', borderBottom: 'none' }}>Top 5 Primary Diagnoses (ICD-10) This Month</h3>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '120px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Viral Fever (B34.9)</div>
                            <div style={{ flex: 1, background: '#f1f5f9', height: '20px', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: '85%', background: '#3b82f6', height: '100%' }}></div>
                            </div>
                            <div style={{ width: '40px', fontSize: '13px', color: '#64748b', textAlign: 'right' }}>412</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '120px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Hypertension (I10)</div>
                            <div style={{ flex: 1, background: '#f1f5f9', height: '20px', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: '65%', background: '#3b82f6', height: '100%' }}></div>
                            </div>
                            <div style={{ width: '40px', fontSize: '13px', color: '#64748b', textAlign: 'right' }}>308</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '120px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Diabetes T2 (E11)</div>
                            <div style={{ flex: 1, background: '#f1f5f9', height: '20px', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: '50%', background: '#3b82f6', height: '100%' }}></div>
                            </div>
                            <div style={{ width: '40px', fontSize: '13px', color: '#64748b', textAlign: 'right' }}>245</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '120px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Migraine (G43)</div>
                            <div style={{ flex: 1, background: '#f1f5f9', height: '20px', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: '30%', background: '#3b82f6', height: '100%' }}></div>
                            </div>
                            <div style={{ width: '40px', fontSize: '13px', color: '#64748b', textAlign: 'right' }}>150</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '120px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Osteoarthritis (M19)</div>
                            <div style={{ flex: 1, background: '#f1f5f9', height: '20px', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: '25%', background: '#3b82f6', height: '100%' }}></div>
                            </div>
                            <div style={{ width: '40px', fontSize: '13px', color: '#64748b', textAlign: 'right' }}>133</div>
                        </div>
                    </div>
                </div>

                <div className={styles.workflowCard} style={{ padding: '32px', display: 'flex', flexDirection: 'column' }}>
                    <h3 className={styles.sectionHeader} style={{ margin: '0 0 24px 0', borderBottom: 'none' }}>Analytics Audit Trail</h3>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '3rem', margin: '0 0 16px 0' }}>🛡️</div>
                            <div style={{ fontSize: '24px', fontWeight: '700', color: '#b45309' }}>142</div>
                            <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>Safety Flags Identified via Engine</div>

                            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '24px', display: 'flex', gap: '40px', justifyContent: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#059669' }}>138 (97%)</div>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>Flags Acted Upon</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#ef4444' }}>4 (3%)</div>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>Overridden / Dismissed</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
