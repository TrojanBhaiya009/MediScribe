'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import RoleLoginLayout from '../RoleLoginLayout';
import styles from '../Login.module.css';

export default function AdminLogin() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (userId === 'lorn4' && password === 'Dom341@#') {
      localStorage.setItem('userRole', 'Admin');
      localStorage.setItem('userName', 'Super Admin');
      router.push('/dashboard');
    } else {
      setError('Invalid credentials for Super Admin Portal. (Hint: lorn4)');
    }
  };

  return (
    <RoleLoginLayout
      section="Administration"
      portalName="Super admin"
      statement="See the system. Shape the standard."
      detail="Manage staff access, clinic configuration, and operational oversight from one accountable workspace."
      credentials={<>ID: <strong>lorn4</strong> · Password: <strong>Dom341@#</strong></>}
    >
      <form onSubmit={handleLogin} className={styles.darkForm} noValidate>
            {error && (
              <div className={styles.darkError} role="alert">
                {error}
              </div>
            )}

            <div className={styles.darkField}>
              <label htmlFor="admin-id" className={styles.darkLabel}>
                Admin User ID
              </label>
              <input
                id="admin-id"
                autoFocus
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className={styles.darkInput}
                placeholder="Enter Admin ID"
                autoComplete="username"
              />
            </div>

            <div className={styles.darkField}>
              <label htmlFor="admin-password" className={styles.darkLabel}>
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.darkInput}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className={styles.darkSubmit}>
              Access Dashboard
            </button>
      </form>
    </RoleLoginLayout>
  );
}
