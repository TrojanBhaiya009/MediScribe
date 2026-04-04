/**
 * MediScribe API Service Layer
 * ─────────────────────────────
 * Centralizes all backend API calls. All requests go through
 * Next.js rewrites → FastAPI backend at localhost:8000.
 */

const API_BASE = '/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `API Error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// ─── Health ──────────────────────────────────────────────────────────────────

export const healthApi = {
  check: () => request<{ status: string }>('/health'),
};

// ─── Doctors ─────────────────────────────────────────────────────────────────

export const doctorsApi = {
  getByClerkId: (clerkId: string) =>
    request<any>(`/doctors/by-clerk-id/${clerkId}`),

  create: (data: {
    id?: string;
    clerkId: string;
    name: string;
    phone?: string;
    clinicName?: string;
    city?: string;
  }) => request<any>('/doctors/', { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Patients ────────────────────────────────────────────────────────────────

export const patientsApi = {
  list: (doctorId: string, skip = 0, limit = 100) =>
    request<any[]>(`/patients/?doctor_id=${doctorId}&skip=${skip}&limit=${limit}`),

  get: (patientId: string) =>
    request<any>(`/patients/${patientId}`),

  create: (data: {
    id?: string;
    doctorId: string;
    name: string;
    phone?: string;
    age?: number;
    gender?: string;
    abhaId?: string;
    bloodGroup?: string;
    address?: string;
    notes?: string;
  }) => request<any>('/patients/', { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Visits ──────────────────────────────────────────────────────────────────

export const visitsApi = {
  list: (patientId: string) =>
    request<any[]>(`/visits/?patient_id=${patientId}`),

  get: (visitId: string) =>
    request<any>(`/visits/${visitId}`),

  create: (data: {
    patientId: string;
    transcript: string;
    audioUrl?: string;
    emrData: Record<string, any>;
    diseaseRisk: {
      fluProbability: number;
      migraineProbability: number;
      fatigueProbability: number;
      notes?: string;
    };
    hallucinationWarning?: boolean;
    hallucinationDetails?: string;
  }) => request<any>('/visits/', { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Transcription ───────────────────────────────────────────────────────────

export const transcribeApi = {
  /** Upload an audio file for Whisper transcription */
  upload: async (file: File, language?: string): Promise<{ text: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    if (language) formData.append('language', language);

    const res = await fetch(`${API_BASE}/transcribe/`, {
      method: 'POST',
      body: formData,
      // No Content-Type header — browser sets multipart boundary automatically
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Transcription failed');
    }
    return res.json();
  },
};

// ─── EMR Generation ──────────────────────────────────────────────────────────

export interface EMRData {
  chiefComplaint: string | null;
  hpi: string | null;
  pastHistory: string | null;
  medications: string[];
  allergies: string | null;
  examFindings: string | null;
  diagnosis: string | null;
  plan: string | null;
  followUpDays: number | null;
  diseaseRisk: {
    fluProbability: number;
    migraineProbability: number;
    fatigueProbability: number;
    notes: string | null;
  };
  hallucinationCheck: {
    isHallucinated: boolean;
    details: string | null;
  };
}

export const emrApi = {
  /** Generate structured EMR from a transcript using Claude */
  generate: (transcript: string) =>
    request<EMRData>('/generate-emr/', {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    }),
};

// ─── Analytics ───────────────────────────────────────────────────────────────

export const analyticsApi = {
  getTimeline: (patientId: string) =>
    request<any>(`/analytics/patients/${patientId}/timeline`),

  getSymptoms: (patientId: string) =>
    request<any>(`/analytics/patients/${patientId}/symptoms`),

  getRiskTrend: (patientId: string) =>
    request<any>(`/analytics/patients/${patientId}/risk-trend`),

  getClinicSummary: (doctorId: string) =>
    request<any>(`/analytics/doctors/${doctorId}/summary`),

  getBenchmark: () =>
    request<any>('/analytics/benchmark'),
};

// ─── Export ──────────────────────────────────────────────────────────────────

export const exportApi = {
  /** Download visit PDF — returns a blob URL */
  getVisitPdf: async (visitId: string): Promise<string> => {
    const res = await fetch(`${API_BASE}/export/visits/${visitId}/pdf`);
    if (!res.ok) throw new Error('Failed to export PDF');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
};

// ─── QR Code ─────────────────────────────────────────────────────────────────

export const qrApi = {
  getQr: (doctorId: string) =>
    request<any>(`/qr/doctors/${doctorId}`),

  getUrl: (doctorId: string) =>
    request<any>(`/qr/doctors/${doctorId}/url`),

  scan: (data: any) =>
    request<any>('/qr/scan', { method: 'POST', body: JSON.stringify(data) }),

  getScans: (doctorId: string) =>
    request<any>(`/qr/doctors/${doctorId}/scans`),
};

// ─── Consent ─────────────────────────────────────────────────────────────────

export const consentApi = {
  logRecording: (data: any) =>
    request<any>('/consent/recording', { method: 'POST', body: JSON.stringify(data) }),

  logSharing: (data: any) =>
    request<any>('/consent/sharing', { method: 'POST', body: JSON.stringify(data) }),

  revoke: (logId: string) =>
    request<any>(`/consent/${logId}`, { method: 'DELETE' }),

  getPatientConsents: (patientId: string) =>
    request<any>(`/consent/patient/${patientId}`),
};

// ─── Sharing ─────────────────────────────────────────────────────────────────

export const sharingApi = {
  createShareRequest: (data: any) =>
    request<any>('/sharing/request', { method: 'POST', body: JSON.stringify(data) }),

  getSharedRecords: (shareToken: string) =>
    request<any>(`/sharing/records/${shareToken}`),

  getIncomingShares: (doctorId: string) =>
    request<any>(`/sharing/incoming/${doctorId}`),

  revokeShare: (shareToken: string) =>
    request<any>(`/sharing/${shareToken}`, { method: 'DELETE' }),
};

// ─── NVIDIA ASR (Parakeet) ───────────────────────────────────────────────────

export const nvidiaAsrApi = {
  /** Check if NVIDIA ASR service is available */
  checkStatus: () =>
    request<{ available: boolean; api_key_configured: boolean }>('/nvidia-asr/status'),

  /** Get WebSocket URL for streaming transcription */
  getStreamUrl: () => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use direct backend URL for WebSocket (not through Next.js proxy)
    return `${wsProtocol}//localhost:8000/nvidia-asr/stream`;
  },
};

// ─── Authentication ──────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    role: 'DOCTOR' | 'PHARMACIST' | 'RECEPTIONIST' | 'ADMIN' | 'doctor' | 'pharmacist' | 'receptionist' | 'admin';
    doctorId?: string;
  };
}

const normalizeRole = (role: LoginResponse['user']['role']): 'DOCTOR' | 'PHARMACIST' | 'RECEPTIONIST' | 'ADMIN' => {
  return String(role).toUpperCase() as 'DOCTOR' | 'PHARMACIST' | 'RECEPTIONIST' | 'ADMIN';
};

const toUiRole = (role: LoginResponse['user']['role']): 'Doctor' | 'Pharmacist' | 'Receptionist' | 'Admin' => {
  const normalized = normalizeRole(role);
  if (normalized === 'DOCTOR') return 'Doctor';
  if (normalized === 'PHARMACIST') return 'Pharmacist';
  if (normalized === 'RECEPTIONIST') return 'Receptionist';
  return 'Admin';
};

export const authApi = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Login failed');
    }
    return res.json();
  },

  getCurrentUser: async (): Promise<LoginResponse['user'] | null> => {
    const token = localStorage.getItem('authToken');
    if (!token) return null;

    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        localStorage.removeItem('authToken');
        return null;
      }
      return res.json();
    } catch {
      return null;
    }
  },

  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('doctorId');
  },

  storeAuth: (response: LoginResponse) => {
    localStorage.setItem('authToken', response.access_token);
    localStorage.setItem('userRole', toUiRole(response.user.role));
    localStorage.setItem('userName', response.user.displayName);
    if (response.user.doctorId) {
      localStorage.setItem('doctorId', response.user.doctorId);
    }
  },

  getToken: (): string | null => localStorage.getItem('authToken'),
};

// ─── Pharmacy Inventory ──────────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  drugName: string;
  genericName?: string;
  manufacturer?: string;
  stockCapacity: number;
  currentQuantity: number;
  lowStockThreshold: number;
  unitType: string;
  pricePerUnit: number;
  batchNumber?: string;
  expiryDate?: string;
}

export interface InventoryStatus {
  total_items: number;
  low_stock_count: number;
  out_of_stock_count: number;
  alerts: Array<{
    drug_name: string;
    current_quantity: number;
    threshold: number;
    status: 'low_stock' | 'out_of_stock';
  }>;
  inventory: InventoryItem[];
}

export const inventoryApi = {
  getStatus: () => {
    const token = authApi.getToken();
    return request<InventoryStatus>('/inventory/status', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },

  dispense: (items: Array<{ drug_name: string; quantity: number }>, visit_id?: string) => {
    const token = authApi.getToken();
    return request<{ success: boolean; dispensed: any[]; errors: string[] }>('/inventory/dispense', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify({ items, visit_id }),
    });
  },

  addStock: (drug_id: string, quantity: number) => {
    const token = authApi.getToken();
    return request<InventoryItem>('/inventory/add', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify({ drug_id, quantity }),
    });
  },
};
