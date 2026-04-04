'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import styles from '../Login.module.css';

export default function PharmacistLogin() {
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

            if (normalizedRole !== 'PHARMACIST') {
                setError('This portal is for pharmacists only. Please use the appropriate login.');
                setLoading(false);
                return;
            }

            authApi.storeAuth(response);
            router.push('/dashboard/handover');
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
                        <h2 className={styles.darkPortalTitle}>Pharmacy Dispatch</h2>
                    </div>

                    <form onSubmit={handleLogin} className={styles.darkForm}>
                        {error && (
                            <div className={styles.darkError}>
                                {error}
                            </div>
                        )}

                        <div className={styles.darkField}>
                            <label className={styles.darkLabel}>Pharmacist ID</label>
                            <input
                                autoFocus
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                                className={styles.darkInput}
                                placeholder="Enter Pharmacist ID"
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
                            {loading ? 'Signing in...' : 'Open Dispensary'}
                        </button>
                    </form>

                    <div className={styles.darkCredentials}>
                        <div>Testing Credentials:</div>
                        <div>ID: <b>pharma1</b> | Pass: <b>Pharma123!</b></div>
                        <div>ID: <b>pharma2</b> | Pass: <b>Pharma456!</b></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
