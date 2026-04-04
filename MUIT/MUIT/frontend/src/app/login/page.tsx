'use client';
import React, { type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import styles from './Login.module.css';

export default function LoginPage() {
    const router = useRouter();

    const portals = [
        { id: 'receptionist', title: 'Reception & Intake', icon: '📝', path: '/login/receptionist', desc: 'Patient registration and queue management.', color: '#3b82f6' },
        { id: 'doctor', title: 'Doctor Portal', icon: '🩺', path: '/login/doctor', desc: 'Live AI Scribe and EMR review workspace.', color: '#10b981' },
        { id: 'pharmacist', title: 'Pharmacy Dispatch', icon: '💊', path: '/login/pharmacist', desc: 'Secure prescription and patient handover.', color: '#f59e0b' },
        { id: 'admin', title: 'Super Admin', icon: '📊', path: '/login/admin', desc: 'Clinic oversight and system configuration.', color: '#8b5cf6' },
    ];

    return (
        <main className={styles.portalLanding}>
            <div className={styles.portalHeader}>
                <div className={styles.brandHeader} style={{ justifyContent: 'center', marginBottom: '16px' }}>
                    <span className={styles.logoIcon} style={{ fontSize: '32px' }}>☤</span>
                    <h1 className={styles.logoText} style={{ fontSize: '32px', color: 'var(--color-text-primary)' }}>
                        MediScribe <span style={{ color: 'var(--color-accent-green)' }}>AI</span>
                    </h1>
                </div>
                <h2 className={styles.portalSubTitle}>Select your designated access portal</h2>
            </div>

            <div className={styles.portalGrid}>
                {portals.map(portal => (
                    <button
                        key={portal.id}
                        onClick={() => router.push(portal.path)}
                        className={styles.portalCard}
                        style={{ '--portal-accent': portal.color } as CSSProperties}
                    >
                        <div className={styles.portalIconWrap}>
                            {portal.icon}
                        </div>
                        <h3 className={styles.portalTitle}>{portal.title}</h3>
                        <p className={styles.portalDesc}>{portal.desc}</p>
                    </button>
                ))}
            </div>

            <div className={styles.portalNotice}>
                <span className={styles.lockIcon}>🔒</span> Secure, ABDM Compliant System Access
            </div>
        </main>
    );
}
