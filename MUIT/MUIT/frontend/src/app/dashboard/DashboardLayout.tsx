'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './DashboardLayout.module.css';
import { GlobalStateProvider } from './GlobalStateContext';

export default function DashboardLayout({ children, isPreview = false, previewRole }: { children: React.ReactNode, isPreview?: boolean, previewRole?: string }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    const adminLinks = [
        { href: '/dashboard', label: 'Overview & Reports', icon: '📊' },
        { href: '/dashboard/admin/clinic', label: 'Manage Clinic', icon: '🏥' },
        { href: '/dashboard/admin/users', label: 'Manage Users', icon: '👥' },
        { href: '/dashboard/admin/employees', label: 'Employee List', icon: '🪪' }
    ];

    const pharmacistLinks = [
        { href: '/dashboard/handover', label: 'Pharmacy Queue', icon: '💊' },
        { href: '/dashboard/alerts', label: 'Inventory Notices', icon: '⚠️' }
    ];
    useEffect(() => {
        setIsMounted(true);
        const role = previewRole || localStorage.getItem('userRole') || 'doctor';
        const name = localStorage.getItem('userName') || 'Dr. Rajesh Sharma';
        setUserRole(role.toLowerCase());
        setUserName(name);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        router.push('/login');
    };

    if (!isMounted) return <div style={{ background: 'var(--color-sidebar-bg)', height: '100vh', width: '100vw' }} />; // prevent hydration mismatch flash

    return (
        <div className={styles.dashboardContainer} style={isPreview ? { width: '100%', height: '100%' } : {}}>
            <aside className={styles.sidebar} style={isPreview ? { pointerEvents: 'none' } : {}}>
                <div className={styles.logoArea}>
                    <span className={styles.logoIcon}>☤</span>
                    <span className={styles.logoText}>MediScribe</span>
                </div>

                <nav className={styles.sidebarNav}>
                    {/* Admin Links */}
                    {(userRole === 'admin') && (
                        <>
                            {adminLinks.map((link) => (
                                <Link href={link.href} key={link.href} style={{ textDecoration: 'none' }}>
                                    <div className={`${styles.navItem} ${pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href)) ? styles.active : ''}`}>
                                        <span className={styles.navIcon}>{link.icon}</span>
                                        <span className={styles.navLabel}>{link.label}</span>
                                    </div>
                                </Link>
                            ))}
                        </>
                    )}

                    {/* Receptionist Links */}
                    {userRole === 'receptionist' && (
                        <>
                            <Link href="/dashboard/patients" style={{ textDecoration: 'none' }}>
                                <div className={`${styles.navItem} ${pathname.includes('/patients') ? styles.active : ''}`}>
                                    <span className={styles.navIcon}>🗂️</span>
                                    <span className={styles.navLabel}>Reception Intake</span>
                                </div>
                            </Link>

                            <Link href="/dashboard/reception-queue" style={{ textDecoration: 'none' }}>
                                <div className={`${styles.navItem} ${pathname.includes('/reception-queue') ? styles.active : ''}`}>
                                    <span className={styles.navIcon}>👥</span>
                                    <span className={styles.navLabel}>Today's Queue</span>
                                </div>
                            </Link>
                        </>
                    )}

                    {/* Doctor Links */}
                    {userRole === 'doctor' && (
                        <>
                            <Link href="/dashboard/scribe" style={{ textDecoration: 'none' }}>
                                <div className={`${styles.navItem} ${pathname.includes('/scribe') ? styles.active : ''}`}>
                                    <span className={styles.navIcon}>🎙️</span>
                                    <span className={styles.navLabel}>Live Scribe</span>
                                </div>
                            </Link>

                            <Link href="/dashboard/review" style={{ textDecoration: 'none' }}>
                                <div className={`${styles.navItem} ${pathname.includes('/review') ? styles.active : ''}`}>
                                    <span className={styles.navIcon}>📝</span>
                                    <span className={styles.navLabel}>Doctor Review</span>
                                </div>
                            </Link>

                            <Link href="/dashboard/alerts" style={{ textDecoration: 'none' }}>
                                <div className={`${styles.navItem} ${pathname.includes('/alerts') ? styles.active : ''}`}>
                                    <span className={styles.navIcon}>⚠️</span>
                                    <span className={styles.navLabel}>Inventory Notices</span>
                                </div>
                            </Link>
                        </>
                    )}

                    {/* Pharmacist Links */}
                    {userRole === 'pharmacist' && pharmacistLinks.map((link) => (
                        <Link href={link.href} key={link.label} style={{ textDecoration: 'none' }}>
                            <div className={`${styles.navItem} ${pathname === link.href ? styles.activeNav : ''}`}>
                                <span className={styles.navIcon}>{link.icon}</span>
                                <span className={styles.navLabel}>{link.label}</span>
                            </div>
                        </Link>
                    ))}
                </nav>

                <div className={styles.sidebarFooter}>
                    <div className={styles.navItem} style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                        <span className={styles.navIcon}>⚙️</span>
                        <span className={styles.navLabel}>Help & Support</span>
                    </div>

                    <div className={styles.navItem} onClick={handleLogout} style={{ cursor: 'pointer', color: '#f87171' }}>
                        <span className={styles.navIcon}>🚪</span>
                        <span className={styles.navLabel}>Logout</span>
                    </div>

                    <div className={styles.userProfile} style={{ marginTop: '16px' }}>
                        <div className={styles.avatar}>
                            <img src={userRole === 'doctor' ? "https://i.pravatar.cc/150?u=a042581f4e39026704d" : "https://i.pravatar.cc/150?u=fake2"} alt={userName || 'Super Admin'} className={styles.avatarImg} />
                            <div className={styles.statusDot}></div>
                        </div>
                        <div className={styles.userInfo}>
                            <span className={styles.userName}>{userName || 'Super Admin'}</span>
                            <span className={styles.userRole} style={{ textTransform: 'capitalize' }}>{userRole}</span>
                        </div>
                    </div>
                </div>
            </aside >

            <main className={styles.mainContent}>
                <GlobalStateProvider>
                    {children}
                </GlobalStateProvider>
            </main>
        </div >
    );
}
