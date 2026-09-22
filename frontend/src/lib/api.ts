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
  isNetworkError: boolean;
  isServerError: boolean;
  isRateLimit: boolean;

  constructor(message: string, status: number, data?: any, isNetworkError: boolean = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.isNetworkError = isNetworkError || status === 0;
    this.isServerError = status >= 500;
    this.isRateLimit = status === 429;
  }
}

export function getFriendlyErrorMessage(err: unknown, defaultMessage = 'An unexpected error occurred'): string {
  if (err instanceof ApiError) {
    if (err.isNetworkError) {
      return 'Network connection lost. Please check your Wi-Fi or data connection and try again.';
    }
    if (err.isRateLimit) {
      return 'Too many requests. Please wait a moment before trying again.';
    }
    if (err.isServerError) {
      return 'The server encountered a temporary error. Please try again in a few moments.';
    }
    return err.message || defaultMessage;
  }
  if (err instanceof Error) {
    if (err.name === 'TypeError' || err.message.toLowerCase().includes('fetch')) {
      return 'Unable to reach the server. Please check your internet connection.';
    }
    return err.message || defaultMessage;
  }
  return defaultMessage;
}

function extractErrorMessage(data: any, status: number): string {
  if (!data) return `Request failed with status ${status}`;
  if (typeof data === 'string') return data;
  if (data.error && typeof data.error === 'string') return data.error;
  if (data.message && typeof data.message === 'string') return data.message;
  if (data.detail && typeof data.detail === 'string') return data.detail;
  if (data.slot) {
    return Array.isArray(data.slot) ? data.slot[0] : String(data.slot);
  }
  if (data.phone_number) {
    return Array.isArray(data.phone_number) ? data.phone_number[0] : String(data.phone_number);
  }
  if (data.phone) {
    return Array.isArray(data.phone) ? data.phone[0] : String(data.phone);
  }
  if (data.otp) {
    return Array.isArray(data.otp) ? data.otp[0] : String(data.otp);
  }
  if (data.non_field_errors) {
    return Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : String(data.non_field_errors);
  }
  if (typeof data === 'object') {
    for (const key of Object.keys(data)) {
      const val = data[key];
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
        return `${key.replace('_', ' ')}: ${val[0]}`;
      }
      if (typeof val === 'string') {
        return `${key.replace('_', ' ')}: ${val}`;
      }
    }
  }
  return `API request failed (${status})`;
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
      const msg = extractErrorMessage(data, response.status);
      throw new ApiError(
        msg,
        response.status,
        data,
        false
      );
    }

    return data as T;
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    const isOffline = typeof window !== 'undefined' && !window.navigator.onLine;
    const isFetchErr =
      error instanceof TypeError ||
      (error?.message && error.message.toLowerCase().includes('fetch')) ||
      (error?.message && error.message.toLowerCase().includes('network'));

    const networkMsg = isOffline
      ? 'No internet connection detected. Please verify your connection.'
      : 'Unable to reach the server. Please check your network connection or try again shortly.';

    throw new ApiError(
      isFetchErr || isOffline ? networkMsg : (error?.message || 'Failed to connect to backend service'),
      0,
      null,
      true
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
    getAnalytics: (id: number, date?: string) => {
      const q = date ? `?date=${encodeURIComponent(date)}` : '';
      return request<any>(`/api/centres/${id}/analytics/${q}`);
    },
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
