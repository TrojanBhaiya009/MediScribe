'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import RoleLoginLayout from '../RoleLoginLayout';
import styles from '../Login.module.css';

export default function ReceptionistLogin() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (userId === 'lorn1' && password === 'Dom341@#') {
      localStorage.setItem('userRole', 'Receptionist');
      localStorage.setItem('userName', 'Front Desk (Lorn1)');
      router.push('/dashboard/patients');
    } else {
      setError('Invalid credentials for Receptionist Portal. (Hint: lorn1)');
    }
  };

  return (
    <RoleLoginLayout
      section="Front desk"
      portalName="Reception & intake"
      statement="Every visit starts with a clear welcome."
      detail="Register patients, confirm the details that matter, and keep the care queue moving with confidence."
      credentials={<>ID: <strong>lorn1</strong> · Password: <strong>Dom341@#</strong></>}
    >
      <form onSubmit={handleLogin} className={styles.darkForm} noValidate>
            {error && (
              <div className={styles.darkError} role="alert">
                {error}
              </div>
            )}

            <div className={styles.darkField}>
              <label htmlFor="receptionist-id" className={styles.darkLabel}>
                Staff ID / Username
              </label>
              <input
                id="receptionist-id"
                autoFocus
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className={styles.darkInput}
                placeholder="Enter Receptionist ID"
                autoComplete="username"
              />
            </div>

            <div className={styles.darkField}>
              <label htmlFor="receptionist-password" className={styles.darkLabel}>
                Password
              </label>
              <input
                id="receptionist-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.darkInput}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className={styles.darkSubmit}>
              Open Patient Queue
            </button>
      </form>
    </RoleLoginLayout>
  );
}
