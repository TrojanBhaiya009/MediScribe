'use client';
import React from 'react';
import styles from '../../Dashboard.module.css';
import { useGlobalState } from '../../GlobalStateContext';

export default function ManageClinicPage() {
    const { clinicDetails, setClinicDetails } = useGlobalState();

    return (
        <div className={styles.dashboardContent} style={{ padding: '24px 32px' }}>
            <div className={styles.topHeader} style={{ marginBottom: '24px' }}>
                <h1 className={styles.pageTitle} style={{ fontSize: '28px' }}>Manage Clinic Setup</h1>
            </div>

            <div style={{ maxWidth: '600px' }}>
                <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={(e) => { e.preventDefault(); alert("Clinic details applied globally to all prescription printing headers!"); }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: '500' }}>Clinic Logo Upload</label>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            {clinicDetails.logo && (
                                <img src={clinicDetails.logo} alt="Logo Preview" style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '4px', background: '#fff' }} />
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                            setClinicDetails({ ...clinicDetails, logo: reader.result as string });
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                                style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--color-text-primary)', fontSize: '13px' }}
                            />
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: '500' }}>Clinic / Hospital Name</label>
                        <input
                            value={clinicDetails?.name || ''}
                            onChange={(e) => setClinicDetails({ ...clinicDetails, name: e.target.value })}
                            style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--color-text-primary)' }}
                        />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: '500' }}>Primary Doctor / Header</label>
                            <input
                                value={clinicDetails?.doctor || ''}
                                onChange={(e) => setClinicDetails({ ...clinicDetails, doctor: e.target.value })}
                                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--color-text-primary)' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: '500' }}>Registration / License No.</label>
                            <input
                                value={clinicDetails?.registration || ''}
                                onChange={(e) => setClinicDetails({ ...clinicDetails, registration: e.target.value })}
                                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--color-text-primary)' }}
                            />
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: '500' }}>Full Address</label>
                        <textarea
                            value={clinicDetails?.address || ''}
                            onChange={(e) => setClinicDetails({ ...clinicDetails, address: e.target.value })}
                            rows={2}
                            style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--color-text-primary)', resize: 'none' }}
                        />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: '500' }}>Contact Number</label>
                            <input
                                value={clinicDetails?.mobile || ''}
                                onChange={(e) => setClinicDetails({ ...clinicDetails, mobile: e.target.value })}
                                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--color-text-primary)' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: '500' }}>Operating Timings</label>
                            <input
                                value={clinicDetails?.timings || ''}
                                onChange={(e) => setClinicDetails({ ...clinicDetails, timings: e.target.value })}
                                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--color-text-primary)' }}
                            />
                        </div>
                    </div>
                    <button type="submit" style={{ marginTop: '12px', background: 'var(--color-accent-green)', color: '#fff', padding: '14px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                        Save Clinic Profile
                    </button>
                </form>
            </div>
        </div>
    );
}
