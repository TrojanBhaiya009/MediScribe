'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../Login.module.css';

export default function ReceptionistLogin() {
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();

        // Mock Auth specific to Receptionist
        if (userId === 'lorn1' && password === 'Dom341@#') {
            localStorage.setItem('userRole', 'Receptionist');
            localStorage.setItem('userName', 'Front Desk (Lorn1)');
            router.push('/dashboard/patients');
        } else {
            setError('Invalid credentials for Receptionist Portal. (Hint: lorn1)');
        }
    };

    return (
        <div className={styles.darkLoginPage}>
            <div className={styles.darkLoginShell}>
                <div className={styles.darkLoginCard}>
                    <div className={styles.darkBrand}>
                        <div className={styles.darkBrandText}>MediScribe <span style={{ color: 'var(--color-accent-green)' }}>AI</span></div>
                        <h2 className={styles.darkPortalTitle}>Reception & Intake</h2>
                    </div>

                    <form onSubmit={handleLogin} className={styles.darkForm}>
                        {error && (
                            <div className={styles.darkError}>
                                {error}
                            </div>
                        )}

                        <div className={styles.darkField}>
                            <label className={styles.darkLabel}>Staff ID / Username</label>
                            <input
                                autoFocus
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                                className={styles.darkInput}
                                placeholder="Enter Receptionist ID"
                            />
                        </div>

                        <div className={styles.darkField}>
                            <label className={styles.darkLabel}>Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={styles.darkInput}
                                placeholder="••••••••"
                            />
                        </div>

                        <button type="submit" className={styles.darkSubmit}>
                            Open Patient Queue
                        </button>
                    </form>

                    <div className={styles.darkCredentials}>
                        Testing Credentials: ID: <b>lorn1</b> | Pass: <b>Dom341@#</b>
                    </div>
                </div>
            </div>
        </div>
    );
}
