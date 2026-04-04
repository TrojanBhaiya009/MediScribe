'use client';
import React, { useState } from 'react';
import styles from '../../Dashboard.module.css';

type EmployeeStatus = 'Active' | 'On Leave' | 'Inactive' | 'Deactivated';

type Employee = {
    id: string;
    name: string;
    role: string;
    department: string;
    status: EmployeeStatus;
    phone: string;
    email: string;
    joinDate: string;
    shift: string;
    salaryGrade: string;
    abhaId: string;
    avatar: string;
};

const INITIAL_EMPLOYEES: Employee[] = [
    { id: 'EMP-001', name: 'Dr. Rajesh Sharma', role: 'Doctor', department: 'General Medicine', status: 'Active', phone: '+91 98100 11223', email: 'rajesh.sharma@mediscribe.app', joinDate: '15 Jan 2022', shift: 'Morning (8AM – 2PM)', salaryGrade: 'G7', abhaId: '91-2001-7834-1234', avatar: 'https://i.pravatar.cc/150?u=doc1' },
    { id: 'EMP-002', name: 'Priya Verma', role: 'Receptionist', department: 'Front Desk', status: 'Active', phone: '+91 98765 43210', email: 'priya.verma@mediscribe.app', joinDate: '3 Mar 2023', shift: 'Morning (9AM – 5PM)', salaryGrade: 'G4', abhaId: '91-3045-9912-5678', avatar: 'https://i.pravatar.cc/150?u=rec1' },
    { id: 'EMP-003', name: 'Anil Kumar', role: 'Pharmacist', department: 'Pharmacy', status: 'Active', phone: '+91 91234 56789', email: 'anil.kumar@mediscribe.app', joinDate: '20 Jun 2021', shift: 'Evening (2PM – 8PM)', salaryGrade: 'G5', abhaId: '91-1122-3344-9900', avatar: 'https://i.pravatar.cc/150?u=pharm1' },
    { id: 'EMP-004', name: 'Dr. Sneha Patel', role: 'Doctor', department: 'Paediatrics', status: 'On Leave', phone: '+91 99887 76655', email: 'sneha.patel@mediscribe.app', joinDate: '1 Apr 2020', shift: 'Morning (8AM – 2PM)', salaryGrade: 'G7', abhaId: '91-5566-7788-0011', avatar: 'https://i.pravatar.cc/150?u=doc2' },
    { id: 'EMP-005', name: 'Ravi Shankar', role: 'Receptionist', department: 'Emergency', status: 'Active', phone: '+91 70123 45678', email: 'ravi.shankar@mediscribe.app', joinDate: '11 Nov 2023', shift: 'Night (8PM – 8AM)', salaryGrade: 'G4', abhaId: '91-8899-0011-2233', avatar: 'https://i.pravatar.cc/150?u=rec2' },
    { id: 'EMP-006', name: 'Meena Iyer', role: 'Pharmacist', department: 'Pharmacy', status: 'Inactive', phone: '+91 80011 22334', email: 'meena.iyer@mediscribe.app', joinDate: '7 Aug 2019', shift: 'Morning (9AM – 5PM)', salaryGrade: 'G5', abhaId: '91-2233-4455-6677', avatar: 'https://i.pravatar.cc/150?u=pharm2' },
];

const DEPT_COLORS: Record<string, string> = {
    'General Medicine': '#818cf8',
    'Paediatrics': '#c084fc',
    'Front Desk': '#38bdf8',
    'Pharmacy': '#34d399',
    'Emergency': '#f87171',
};

const STATUS_CONFIG: Record<EmployeeStatus, { bg: string; color: string; label: string }> = {
    'Active': { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: '🟢 Active' },
    'On Leave': { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: '🌙 On Leave' },
    'Inactive': { bg: 'rgba(156,163,175,0.15)', color: '#9ca3af', label: '⬜ Inactive' },
    'Deactivated': { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', label: '🔴 Deactivated' },
};

function ConfirmModal({ emp, action, onConfirm, onCancel }: { emp: Employee; action: string; onConfirm: () => void; onCancel: () => void }) {
    const actionColor = action === 'Deactivate' ? '#ef4444' : '#10b981';
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '32px', maxWidth: '420px', width: '90%' }}>
                <h3 style={{ margin: '0 0 8px', color: 'var(--color-text-primary)', fontSize: '18px' }}>Confirm {action}</h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>
                    Are you sure you want to <strong style={{ color: actionColor }}>{action.toLowerCase()}</strong> the account for <strong style={{ color: 'var(--color-text-primary)' }}>{emp.name}</strong> ({emp.id})?
                    {action === 'Deactivate' && ' They will lose access to the MediScribe platform immediately.'}
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button onClick={onCancel} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-text-secondary)', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
                        Cancel
                    </button>
                    <button onClick={onConfirm} style={{ background: actionColor, border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}>
                        Yes, {action}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function EmployeeListPage() {
    const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
    const [search, setSearch] = useState('');
    const [filterDept, setFilterDept] = useState('All');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [confirm, setConfirm] = useState<{ emp: Employee; action: string } | null>(null);

    const departments = ['All', ...Array.from(new Set(INITIAL_EMPLOYEES.map(e => e.department)))];

    const filtered = employees.filter(e => {
        const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.role.toLowerCase().includes(search.toLowerCase()) || e.id.toLowerCase().includes(search.toLowerCase());
        const matchDept = filterDept === 'All' || e.department === filterDept;
        return matchSearch && matchDept;
    });

    const stats = {
        total: employees.length,
        active: employees.filter(e => e.status === 'Active').length,
        onLeave: employees.filter(e => e.status === 'On Leave').length,
        inactive: employees.filter(e => e.status === 'Inactive' || e.status === 'Deactivated').length,
    };

    const handleStatusChange = (emp: Employee, newStatus: EmployeeStatus) => {
        setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, status: newStatus } : e));
        setConfirm(null);
    };

    const triggerConfirm = (emp: Employee, action: string) => {
        setConfirm({ emp, action });
    };

    return (
        <div className={styles.dashboardContent} style={{ padding: '28px 32px', gap: '20px' }}>

            {/* Confirm Modal */}
            {confirm && (
                <ConfirmModal
                    emp={confirm.emp}
                    action={confirm.action}
                    onConfirm={() => {
                        const newStatus: Record<string, EmployeeStatus> = {
                            'Deactivate': 'Deactivated',
                            'Activate': 'Active',
                            'Mark On Leave': 'On Leave',
                            'Mark Inactive': 'Inactive',
                        };
                        handleStatusChange(confirm.emp, newStatus[confirm.action] || 'Active');
                    }}
                    onCancel={() => setConfirm(null)}
                />
            )}

            {/* Header */}
            <div>
                <h1 className={styles.pageTitle} style={{ fontSize: '26px' }}>🪪 Employee Directory</h1>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                    Manage all staff accounts — activate, deactivate, or update leave status
                </p>
            </div>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                {[
                    { label: 'Total Staff', value: stats.total, icon: '👤', color: '#818cf8' },
                    { label: 'Active', value: stats.active, icon: '🟢', color: '#10b981' },
                    { label: 'On Leave', value: stats.onLeave, icon: '🌙', color: '#f59e0b' },
                    { label: 'Inactive / Deactivated', value: stats.inactive, icon: '🔴', color: '#ef4444' },
                ].map(s => (
                    <div key={s.label} className={styles.workflowCard} style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <span style={{ fontSize: '1.8rem' }}>{s.icon}</span>
                        <div>
                            <div style={{ fontSize: '28px', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search & Filter Bar */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <input
                    type="text"
                    placeholder="🔍  Search by name, role, or ID..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ flex: 1, minWidth: '220px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '10px 16px', color: 'var(--color-text-primary)', fontSize: '14px', outline: 'none' }}
                />
                <select
                    value={filterDept}
                    onChange={e => setFilterDept(e.target.value)}
                    style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '10px 16px', color: 'var(--color-text-primary)', fontSize: '14px', cursor: 'pointer', outline: 'none' }}
                >
                    {departments.map(d => <option key={d} value={d} style={{ background: '#1e293b' }}>{d}</option>)}
                </select>
            </div>

            {/* Employee Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>No employees match your search.</div>
                )}
                {filtered.map(emp => {
                    const isExpanded = expandedId === emp.id;
                    const statusCfg = STATUS_CONFIG[emp.status];
                    const deptColor = DEPT_COLORS[emp.department] || '#6b7280';
                    const isDeactivated = emp.status === 'Deactivated';

                    return (
                        <div
                            key={emp.id}
                            style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: isExpanded ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(255,255,255,0.07)',
                                borderRadius: '14px',
                                overflow: 'hidden',
                                transition: 'border 0.25s',
                                opacity: isDeactivated ? 0.6 : 1,
                            }}
                        >
                            {/* Row Header */}
                            <div
                                onClick={() => setExpandedId(isExpanded ? null : emp.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', cursor: 'pointer' }}
                            >
                                {/* Avatar */}
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                    <img src={emp.avatar} alt={emp.name} style={{ width: '46px', height: '46px', borderRadius: '50%', border: `2px solid ${deptColor}40` }} />
                                    <div style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', background: statusCfg.color, border: '2px solid #111827' }} />
                                </div>

                                {/* Name + role */}
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {emp.name}
                                        {isDeactivated && <span style={{ fontSize: '11px', background: 'rgba(239,68,68,0.15)', color: '#f87171', padding: '2px 8px', borderRadius: '6px' }}>ACCOUNT LOCKED</span>}
                                    </div>
                                    <div style={{ fontSize: '13px', marginTop: '2px' }}>
                                        <span style={{ color: deptColor, fontWeight: 600 }}>{emp.role}</span>
                                        <span style={{ color: 'var(--color-text-secondary)' }}> · {emp.department}</span>
                                    </div>
                                </div>

                                {/* ID */}
                                <code style={{ fontSize: '12px', color: 'var(--color-text-secondary)', background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: '6px' }}>{emp.id}</code>

                                {/* Status badge */}
                                <span style={{ background: statusCfg.bg, color: statusCfg.color, fontSize: '12px', fontWeight: 600, padding: '5px 14px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
                                    {statusCfg.label}
                                </span>

                                {/* Chevron */}
                                <span style={{ color: 'var(--color-text-secondary)', fontSize: '20px', lineHeight: 1, transition: 'transform 0.2s', display: 'block', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
                            </div>

                            {/* Expanded Detail Panel */}
                            {isExpanded && (
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)', padding: '24px 22px' }}>

                                    {/* Detail Grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                                        {[
                                            { icon: '📞', label: 'Phone', value: emp.phone },
                                            { icon: '📧', label: 'Email', value: emp.email },
                                            { icon: '📅', label: 'Joined', value: emp.joinDate },
                                            { icon: '🕐', label: 'Shift', value: emp.shift },
                                            { icon: '💰', label: 'Salary Grade', value: emp.salaryGrade },
                                            { icon: '🏥', label: 'ABHA ID', value: emp.abhaId },
                                        ].map(d => (
                                            <div key={d.label}>
                                                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '5px' }}>
                                                    {d.icon} {d.label}
                                                </div>
                                                <div style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 500 }}>{d.value}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>

                                        {/* Activate */}
                                        {emp.status !== 'Active' && (
                                            <button
                                                onClick={() => triggerConfirm(emp, 'Activate')}
                                                style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', color: '#10b981', padding: '9px 18px', borderRadius: '9px', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}
                                            >
                                                ✅ Activate Account
                                            </button>
                                        )}

                                        {/* Mark On Leave */}
                                        {emp.status === 'Active' && (
                                            <button
                                                onClick={() => triggerConfirm(emp, 'Mark On Leave')}
                                                style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', padding: '9px 18px', borderRadius: '9px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                                            >
                                                🌙 Mark On Leave
                                            </button>
                                        )}

                                        {/* Mark Inactive */}
                                        {(emp.status === 'Active' || emp.status === 'On Leave') && (
                                            <button
                                                onClick={() => triggerConfirm(emp, 'Mark Inactive')}
                                                style={{ background: 'rgba(156,163,175,0.1)', border: '1px solid rgba(156,163,175,0.25)', color: '#9ca3af', padding: '9px 18px', borderRadius: '9px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                                            >
                                                ⬜ Mark Inactive
                                            </button>
                                        )}

                                        {/* Deactivate (big red, always visible unless already deactivated) */}
                                        {emp.status !== 'Deactivated' && (
                                            <button
                                                onClick={() => triggerConfirm(emp, 'Deactivate')}
                                                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '9px 18px', borderRadius: '9px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', marginLeft: 'auto' }}
                                            >
                                                🔴 Deactivate Account
                                            </button>
                                        )}

                                        {/* Re-activate if deactivated */}
                                        {emp.status === 'Deactivated' && (
                                            <button
                                                onClick={() => triggerConfirm(emp, 'Activate')}
                                                style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#10b981', padding: '9px 18px', borderRadius: '9px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', marginLeft: 'auto' }}
                                            >
                                                🔓 Re-activate Account
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
