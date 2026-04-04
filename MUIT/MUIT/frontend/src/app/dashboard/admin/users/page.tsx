'use client';
import React, { useState } from 'react';
import styles from '../../Dashboard.module.css';

export default function ManageUsersPage() {
    const [activeTab, setActiveTab] = useState('addDoctor');

    return (
        <div className={styles.dashboardContent} style={{ padding: '24px 32px' }}>
            <div className={styles.topHeader} style={{ marginBottom: '24px' }}>
                <h1 className={styles.pageTitle} style={{ fontSize: '28px' }}>System Access</h1>
            </div>

            <div style={{ maxWidth: '600px' }}>
                <div style={{ padding: '16px', background: 'rgba(56, 189, 248, 0.1)', borderLeft: '4px solid #38bdf8', borderRadius: '8px', marginBottom: '24px' }}>
                    <h4 style={{ margin: 0, color: '#38bdf8', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🛡️</span> Strict KYC Enforcement
                    </h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                        All staff members must be linked to a verified Government ID and mobile number before accessing patient data.
                    </p>
                </div>

                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '4px', marginBottom: '24px' }}>
                    <button
                        onClick={() => setActiveTab('addDoctor')}
                        style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', background: activeTab === 'addDoctor' ? 'var(--color-workspace-bg)' : 'transparent', color: activeTab === 'addDoctor' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: activeTab === 'addDoctor' ? 'bold' : 'normal', cursor: 'pointer', transition: 'all 0.2s' }}>
                        Add Doctor
                    </button>
                    <button
                        onClick={() => setActiveTab('addReceptionist')}
                        style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', background: activeTab === 'addReceptionist' ? 'var(--color-workspace-bg)' : 'transparent', color: activeTab === 'addReceptionist' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: activeTab === 'addReceptionist' ? 'bold' : 'normal', cursor: 'pointer', transition: 'all 0.2s' }}>
                        Add Receptionist
                    </button>
                    <button
                        onClick={() => setActiveTab('addPharmacist')}
                        style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', background: activeTab === 'addPharmacist' ? 'var(--color-workspace-bg)' : 'transparent', color: activeTab === 'addPharmacist' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: activeTab === 'addPharmacist' ? 'bold' : 'normal', cursor: 'pointer', transition: 'all 0.2s' }}>
                        Add Pharmacist
                    </button>
                </div>

                <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={(e) => { e.preventDefault(); alert("Invite sent!"); }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: '500' }}>Full Name *</label>
                            <input
                                placeholder={activeTab === 'addDoctor' ? "e.g. Dr. Anil Kumar" : "e.g. Sunita Verma"}
                                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--color-text-primary)' }}
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: '500' }}>Gov ID (Aadhaar / PAN) *</label>
                            <input
                                placeholder="Enter verified ID number"
                                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--color-text-primary)' }}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: '500' }}>Gov. Registered Mobile Number *</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                placeholder="+91 Mobile number linked to Gov ID"
                                style={{ flex: 1, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--color-text-primary)' }}
                                required
                            />
                            <button type="button" style={{ background: 'var(--color-workspace-bg)', color: 'var(--color-text-primary)', border: '1px solid rgba(255,255,255,0.2)', padding: '0 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                                Verify SMS
                            </button>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: '500' }}>Personal Email Address *</label>
                        <input
                            type="email"
                            placeholder="name@clinic.com"
                            style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--color-text-primary)' }}
                            required
                        />
                    </div>

                    {activeTab === 'addDoctor' && (
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: '500' }}>MCI Registration Number *</label>
                            <input
                                placeholder="e.g. MCI-123456"
                                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--color-text-primary)' }}
                                required
                            />
                        </div>
                    )}

                    <button type="submit" style={{ marginTop: '12px', background: 'var(--color-text-primary)', color: 'var(--color-sidebar-bg)', padding: '14px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                        {activeTab === 'addDoctor' ? 'Send Verified Doctor Invite' : `Create Verified ${activeTab === 'addReceptionist' ? 'Receptionist' : 'Pharmacist'}`}
                    </button>
                </form>
            </div>
        </div>
    );
}
