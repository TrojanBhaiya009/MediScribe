'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import styles from '../Login.module.css';

export default function DoctorLogin() {
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authApi.login(userId, password);
            const normalizedRole = String(response.user.role).toUpperCase();

            if (normalizedRole !== 'DOCTOR') {
                setError('This portal is for doctors only. Please use the appropriate login.');
                setLoading(false);
                return;
            }

            authApi.storeAuth(response);
            router.push('/dashboard/scribe');
        } catch (err: any) {
            setError(err.message || 'Invalid credentials');
            setLoading(false);
        }
    };

    return (
        <div className={styles.darkLoginPage}>
            <div className={styles.darkLoginShell}>
                <div className={styles.darkLoginCard}>
                    <div className={styles.darkBrand}>
                        <div className={styles.darkBrandText}>MediScribe <span style={{ color: 'var(--color-accent-green)' }}>AI</span></div>
                        <h2 className={styles.darkPortalTitle}>Doctor Portal</h2>
                    </div>

                    <form onSubmit={handleLogin} className={styles.darkForm}>
                        {error && (
                            <div className={styles.darkError}>
                                {error}
                            </div>
                        )}

                        <div className={styles.darkField}>
                            <label className={styles.darkLabel}>MCI ID / Username</label>
                            <input
                                autoFocus
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                                className={styles.darkInput}
                                placeholder="Enter Doctor ID"
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

                        <button type="submit" disabled={loading} className={styles.darkSubmit}>
                            {loading ? 'Signing in...' : 'Access Workspace'}
                        </button>
                    </form>

                    <div className={styles.darkCredentials}>
                        <div>Testing Credentials:</div>
                        <div>ID: <b>lorn2</b> | Pass: <b>Dom341@#</b></div>
                        <div>ID: <b>doc2</b> | Pass: <b>DocPass2!</b></div>
                        <div>ID: <b>doc3</b> | Pass: <b>DocPass3!</b></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
