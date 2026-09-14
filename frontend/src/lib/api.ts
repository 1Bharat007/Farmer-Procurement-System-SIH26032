/**
 * KisanSlot / FarmQueue Typed API Client Wrapper
 * Smart India Hackathon 2026 - Problem Statement 26032
 */

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

export interface HealthCheckResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  database: string;
  platform: string;
}

export interface TokenResponse {
  access: string;
  refresh: string;
}

export interface FarmerUser {
  id: number;
  phone: string;
  full_name: string;
  village: string;
  district: string;
  state: string;
  preferred_language: string;
  crop_type: string;
  role: 'farmer';
}

export interface StaffUser {
  id: number;
  username: string;
  full_name: string;
  email?: string;
  role: 'operator' | 'centre_operator' | 'officer' | 'admin';
  is_staff: boolean;
  centre_id?: number;
  centre_name?: string;
}

export interface SendOTPResponse {
  status: string;
  message: string;
  phone: string;
  is_registered: boolean;
  dev_otp?: string;
}

export interface AuthResponse<U = FarmerUser | StaffUser> {
  status: string;
  message: string;
  tokens: TokenResponse;
  user: U;
}

export interface RegisterFarmerData {
  phone: string;
  full_name: string;
  village?: string;
  district?: string;
  state?: string;
  preferred_language?: string;
  crop_type?: string;
}

export interface ApiRootModuleResponse {
  message: string;
  module: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' ? 'http://localhost:8000' : 'http://backend:8000');

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Token helper utilities for client side
// Note on Security Tradeoff:
// In this cross-origin Next.js client + Django ASGI backend architecture, JWT tokens are stored
// in browser localStorage to permit dynamic Bearer token authorization headers.
// In a unified production reverse-proxy environment, setting httpOnly and SameSite=Strict cookies
// via a Next.js Route Handler or backend Set-Cookie header is strongly recommended to protect against
// potential Cross-Site Scripting (XSS) risks.
//
// Middleware cookie note:
// We also write lightweight ks_session + ks_role cookies (non-httpOnly, SameSite=Lax, 8h)
// so the Next.js Edge Middleware can gate /farmer and /dashboard routes without reading
// localStorage (which is unavailable at the edge).
export const authStorage = {
  saveTokens: (tokens: TokenResponse | any, user?: any) => {
    if (typeof window !== 'undefined') {
      const access = tokens?.access || tokens?.tokens?.access;
      const refresh = tokens?.refresh || tokens?.tokens?.refresh;
      if (access) localStorage.setItem('kisanslot_access_token', access);
      if (refresh) localStorage.setItem('kisanslot_refresh_token', refresh);
      if (user) {
        localStorage.setItem('kisanslot_user', JSON.stringify(user));
      }
      // Set session cookies for Edge Middleware route guard
      const role: string = user?.role || 'farmer';
      const expires = new Date(Date.now() + 8 * 60 * 60 * 1000).toUTCString();
      document.cookie = `ks_session=1; path=/; SameSite=Lax; expires=${expires}`;
      document.cookie = `ks_role=${role}; path=/; SameSite=Lax; expires=${expires}`;
    }
  },
  getAccessToken: (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kisanslot_access_token');
    }
    return null;
  },
  getUser: (): any | null => {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem('kisanslot_user');
      return data ? JSON.parse(data) : null;
    }
    return null;
  },
  clear: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kisanslot_access_token');
      localStorage.removeItem('kisanslot_refresh_token');
      localStorage.removeItem('kisanslot_user');
      // Clear middleware cookies
      document.cookie = 'ks_session=; path=/; max-age=0';
      document.cookie = 'ks_role=; path=/; max-age=0';
    }
  },
};

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;

  const token = authStorage.getAccessToken();
  const authHeaders: Record<string, string> = {};
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...authHeaders,
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const isJson = response.headers
      .get('content-type')
      ?.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const msg =
        typeof data === 'object' && data !== null
          ? data.message ||
            data.detail ||
            (data.phone ? data.phone[0] : null) ||
            (data.phone_number ? data.phone_number[0] : null) ||
            (data.otp ? data.otp[0] : null) ||
            (data.non_field_errors ? data.non_field_errors[0] : null) ||
            JSON.stringify(data)
          : String(data);
      throw new ApiError(
        msg || `API request failed with status ${response.status}`,
        response.status,
        data
      );
    }

    return data as T;
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error.message || 'Failed to connect to backend service',
      0,
      null
    );
  }
}

export const apiClient = {
  // System Health
  getHealth: () => request<HealthCheckResponse>('/api/health/'),

  // Authentication & Accounts
  auth: {
    sendFarmerOTP: (phone: string) =>
      request<SendOTPResponse>('/api/auth/farmer/send-otp/', {
        method: 'POST',
        body: JSON.stringify({ phone_number: phone, phone }),
      }),

    verifyFarmerOTP: (
      phone: string,
      otp: string,
      registrationData?: Partial<RegisterFarmerData>
    ) =>
      request<AuthResponse<FarmerUser>>('/api/auth/farmer/verify-otp/', {
        method: 'POST',
        body: JSON.stringify({
          phone_number: phone,
          phone,
          otp,
          ...(registrationData || {}),
        }),
      }),

    registerFarmer: (data: RegisterFarmerData) =>
      request<AuthResponse<FarmerUser>>('/api/accounts/farmer/register/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    loginStaff: (credentials: { username: string; password: string }) =>
      request<AuthResponse<StaffUser>>('/api/auth/token/', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),

    getCurrentUser: () => request<any>('/api/auth/me/'),

    refreshToken: (refreshToken: string) =>
      request<{ access: string }>('/api/auth/token/refresh/', {
        method: 'POST',
        body: JSON.stringify({ refresh: refreshToken }),
      }),
  },

  // Procurement Centres
  centres: {
    list: (params?: { district?: string; is_active?: boolean }) => {
      const qs = new URLSearchParams();
      if (params?.district) qs.set('district', params.district);
      if (params?.is_active !== undefined) qs.set('is_active', String(params.is_active));
      const q = qs.toString();
      return request<any>(`/api/centres/${q ? '?' + q : ''}`);
    },
    retrieve: (id: number) => request<any>(`/api/centres/${id}/`),
  },

  // Slots
  slots: {
    list: (params?: { centre?: number; date?: string; from_date?: string; to_date?: string }) => {
      const qs = new URLSearchParams();
      if (params?.centre) qs.set('centre', String(params.centre));
      if (params?.date) qs.set('date', params.date);
      if (params?.from_date) qs.set('from_date', params.from_date);
      if (params?.to_date) qs.set('to_date', params.to_date);
      const q = qs.toString();
      return request<any>(`/api/bookings/slots/${q ? '?' + q : ''}`);
    },
  },

  // Bookings
  bookings: {
    list: () => request<any>('/api/bookings/'),
    create: (data: { slot: number; quantity_kg?: number; notes?: string }) =>
      request<any>('/api/bookings/', { method: 'POST', body: JSON.stringify(data) }),
    retrieve: (id: number) => request<any>(`/api/bookings/${id}/`),
    cancel: (id: number) =>
      request<any>(`/api/bookings/${id}/cancel/`, { method: 'POST' }),
    checkIn: (id: number) =>
      request<any>(`/api/bookings/${id}/check-in/`, { method: 'POST' }),
    checkInByQr: (qr_code_token: string) =>
      request<any>('/api/bookings/check-in-qr/', {
        method: 'POST',
        body: JSON.stringify({ qr_code_token }),
      }),
  },

  // Queue
  queue: {
    list: (params?: { centre?: number; date?: string }) => {
      const qs = new URLSearchParams();
      if (params?.centre) qs.set('centre', String(params.centre));
      if (params?.date) qs.set('date', params.date);
      const q = qs.toString();
      return request<any>(`/api/queue/${q ? '?' + q : ''}`);
    },
  },

  // Notifications
  notifications: {
    getRoot: () => request<ApiRootModuleResponse>('/api/notifications/'),
  },
};

export default apiClient;
