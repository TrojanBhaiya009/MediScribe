'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './DashboardLayout.module.css';
import { GlobalStateProvider } from './GlobalStateContext';

type DashboardLayoutProps = {
    children: React.ReactNode;
    isPreview?: boolean;
    previewRole?: string;
};

type NavigationItem = {
    href: string;
    label: string;
    code: string;
};

const ROLE_NAVIGATION: Record<string, NavigationItem[]> = {
    admin: [
        { href: '/dashboard', label: 'Overview & Reports', code: '01' },
        { href: '/dashboard/admin/clinic', label: 'Manage Clinic', code: '02' },
        { href: '/dashboard/admin/users', label: 'Manage Users', code: '03' },
        { href: '/dashboard/admin/employees', label: 'Employee List', code: '04' },
    ],
    receptionist: [
        { href: '/dashboard/patients', label: 'Reception Intake', code: '01' },
        { href: '/dashboard/reception-queue', label: "Today's Queue", code: '02' },
    ],
    doctor: [
        { href: '/dashboard/scribe', label: 'Live Scribe', code: '01' },
        { href: '/dashboard/review', label: 'Doctor Review', code: '02' },
        { href: '/dashboard/alerts', label: 'Inventory Notices', code: '03' },
    ],
    pharmacist: [
        { href: '/dashboard/handover', label: 'Pharmacy Queue', code: '01' },
        { href: '/dashboard/alerts', label: 'Inventory Notices', code: '02' },
    ],
};

export default function DashboardLayout({ children, isPreview = false, previewRole }: DashboardLayoutProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const role = previewRole || localStorage.getItem('userRole') || 'doctor';
        const name = localStorage.getItem('userName') || 'Dr. Rajesh Sharma';
        setUserRole(role.toLowerCase());
        setUserName(name);
    }, [previewRole]);

    const handleLogout = () => {
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        router.push('/login');
    };

    if (!isMounted) return <div className={styles.loadingShell} />;

    const role = userRole || 'doctor';
    const links = ROLE_NAVIGATION[role] || ROLE_NAVIGATION.doctor;
    const initials = (userName || 'Staff Member')
        .replace('Dr. ', '')
        .split(' ')
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join('')
        .toUpperCase();

    const isActive = (href: string) => (
        pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
    );

    return (
        <div className={styles.dashboardContainer} style={isPreview ? { width: '100%', height: '100%' } : undefined}>
            <aside className={styles.sidebar} style={isPreview ? { pointerEvents: 'none' } : undefined}>
                <div className={styles.logoArea}>
                    <Link href="/" className={styles.logoText} aria-label="MediScribe home">
                        MediScribe<sup>AI</sup>
                    </Link>
                    <p className={styles.portalLabel}>{role} workspace</p>
                </div>

                <nav className={styles.sidebarNav} aria-label={`${role} workspace`}>
                    <p className={styles.navSectionLabel}>Workspace</p>
                    {links.map((link) => (
                        <Link
                            href={link.href}
                            key={link.href}
                            className={`${styles.navItem} ${isActive(link.href) ? styles.active : ''}`}
                        >
                            <span className={styles.navCode} aria-hidden="true">{link.code}</span>
                            <span className={styles.navLabel}>{link.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className={styles.sidebarFooter}>
                    <button type="button" className={styles.utilityButton}>
                        <span aria-hidden="true">?</span> Help &amp; Support
                    </button>
                    <button type="button" className={`${styles.utilityButton} ${styles.logoutButton}`} onClick={handleLogout}>
                        <span aria-hidden="true">←</span> Log out
                    </button>

                    <div className={styles.userProfile}>
                        <div className={styles.avatar} aria-hidden="true">{initials}</div>
                        <div className={styles.userInfo}>
                            <span className={styles.userName}>{userName || 'Staff Member'}</span>
                            <span className={styles.userRole}>{role}</span>
                        </div>
                    </div>
                </div>
            </aside>

            <main className={styles.mainContent}>
                <GlobalStateProvider>{children}</GlobalStateProvider>
            </main>
        </div>
    );
}
