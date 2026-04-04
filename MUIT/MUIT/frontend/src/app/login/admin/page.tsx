'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../Login.module.css';

export default function AdminLogin() {
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();

        // Mock Auth specific to Admin
        if (userId === 'lorn4' && password === 'Dom341@#') {
            localStorage.setItem('userRole', 'Admin');
            localStorage.setItem('userName', 'Super Admin');
            router.push('/dashboard');
        } else {
            setError('Invalid credentials for Super Admin Portal. (Hint: lorn4)');
        }
    };

    return (
        <div className={styles.darkLoginPage}>
            <div className={styles.darkLoginShell}>
                <div className={styles.darkLoginCard}>
                    <div className={styles.darkBrand}>
                        <div className={styles.darkBrandText}>MediScribe <span style={{ color: 'var(--color-accent-green)' }}>AI</span></div>
                        <h2 className={styles.darkPortalTitle}>Super Admin Portal</h2>
                    </div>

                    <form onSubmit={handleLogin} className={styles.darkForm}>
                        {error && (
                            <div className={styles.darkError}>
                                {error}
                            </div>
                        )}

                        <div className={styles.darkField}>
                            <label className={styles.darkLabel}>Admin User ID</label>
                            <input
                                autoFocus
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                                className={styles.darkInput}
                                placeholder="Enter Admin ID"
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
                            Access Dashboard
                        </button>
                    </form>

                    <div className={styles.darkCredentials}>
                        Testing Credentials: ID: <b>lorn4</b> | Pass: <b>Dom341@#</b>
                    </div>
                </div>
            </div>
        </div>
    );
}
