'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import RoleLoginLayout from '../RoleLoginLayout';
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
    <RoleLoginLayout
      section="Doctor"
      portalName="Doctor portal"
      statement="Listen closely. Document precisely."
      detail="Capture the encounter, review the clinical record, and finish documentation without losing the thread of care."
      credentials={(
        <>
          <div>ID: <strong>lorn2</strong> · Password: <strong>Dom341@#</strong></div>
          <div>ID: <strong>doc2</strong> · Password: <strong>DocPass2!</strong></div>
          <div>ID: <strong>doc3</strong> · Password: <strong>DocPass3!</strong></div>
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
              <label htmlFor="doctor-id" className={styles.darkLabel}>
                MCI ID / Username
              </label>
              <input
                id="doctor-id"
                autoFocus
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className={styles.darkInput}
                placeholder="Enter Doctor ID"
                autoComplete="username"
                disabled={loading}
              />
            </div>

            <div className={styles.darkField}>
              <label htmlFor="doctor-password" className={styles.darkLabel}>
                Password
              </label>
              <input
                id="doctor-password"
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
              {loading ? 'Signing in...' : 'Access Workspace'}
            </button>
      </form>
    </RoleLoginLayout>
  );
}
