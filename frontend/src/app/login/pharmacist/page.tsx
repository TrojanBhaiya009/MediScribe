'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import RoleLoginLayout from '../RoleLoginLayout';
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
    <RoleLoginLayout
      section="Pharmacy"
      portalName="Pharmacy dispatch"
      statement="From prescription to safe handover."
      detail="Review medication orders, prepare dispensing details, and complete the patient handover with a clear record."
      credentials={(
        <>
          <div>ID: <strong>pharma1</strong> · Password: <strong>Pharma123!</strong></div>
          <div>ID: <strong>pharma2</strong> · Password: <strong>Pharma456!</strong></div>
        </>
      )}
    >
      <form onSubmit={handleLogin} className={styles.darkForm} noValidate>
            {error && (
              <div className={styles.darkError} role="alert">
                {error}
              </div>
            )}

            <div className={styles.darkField}>
              <label htmlFor="pharmacist-id" className={styles.darkLabel}>
                Pharmacist ID
              </label>
              <input
                id="pharmacist-id"
                autoFocus
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className={styles.darkInput}
                placeholder="Enter Pharmacist ID"
                autoComplete="username"
                disabled={loading}
              />
            </div>

            <div className={styles.darkField}>
              <label htmlFor="pharmacist-password" className={styles.darkLabel}>
                Password
              </label>
              <input
                id="pharmacist-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.darkInput}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <button type="submit" disabled={loading} className={styles.darkSubmit}>
              {loading ? 'Signing in...' : 'Open Dispensary'}
            </button>
      </form>
    </RoleLoginLayout>
  );
}
