export const PORTALS = [
  {
    id: 'receptionist',
    number: '01',
    title: 'Reception & Intake',
    desc: 'Patient registration and queue management.',
    cta: 'Open Patient Queue',
    href: '/login/receptionist',
  },
  {
    id: 'doctor',
    number: '02',
    title: 'Doctor Portal',
    desc: 'Live AI Scribe and EMR review workspace.',
    cta: 'Access Workspace',
    href: '/login/doctor',
  },
  {
    id: 'pharmacist',
    number: '03',
    title: 'Pharmacy Dispatch',
    desc: 'Secure prescription and patient handover.',
    cta: 'Open Dispensary',
    href: '/login/pharmacist',
  },
  {
    id: 'admin',
    number: '04',
    title: 'Super Admin',
    desc: 'Clinic oversight and system configuration.',
    cta: 'Access Dashboard',
    href: '/login/admin',
  },
] as const;

export type Portal = typeof PORTALS[number];
