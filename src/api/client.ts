import { PublicClientApplication, AccountInfo, SilentRequest } from '@azure/msal-browser';
import { Ticket, TicketStatus, OnboardingData, OffboardingData, UserProfile } from '../types';
import { apiTokenRequest, loginRequest } from '../auth/authConfig';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
export const USE_API = Boolean(import.meta.env.VITE_API_BASE_URL);

export interface AuditLogEntry {
  id: string;
  action: string;
  targetRequestId?: string | null;
  performedBy?: string | null;
  timestamp: string;
  details?: Record<string, unknown>;
}

type TokenProvider = () => Promise<string | null>;

let tokenProvider: TokenProvider = async () => null;
let msalInstanceRef: PublicClientApplication | null = null;

export function setMsalInstance(instance: PublicClientApplication) {
  msalInstanceRef = instance;
}

export function setAccessTokenProvider(provider: TokenProvider) {
  tokenProvider = provider;
}

/** Obtém access_token silencioso para a API. Nunca abre popup (evita janela fantasma). */
export async function acquireApiAccessToken(account?: AccountInfo | null): Promise<string | null> {
  if (!msalInstanceRef) return null;
  try {
    await msalInstanceRef.initialize();
  } catch {
    // ignore
  }

  const accounts = msalInstanceRef.getAllAccounts();
  const active = account || accounts[0];
  if (!active) return null;

  const attempts: SilentRequest[] = [
    { ...apiTokenRequest, account: active },
    { ...loginRequest, account: active },
  ];

  for (const request of attempts) {
    try {
      const result = await msalInstanceRef.acquireTokenSilent(request);
      if (result?.accessToken) return result.accessToken;
    } catch {
      // tenta próximo conjunto de scopes
    }
  }

  console.warn(
    'Falha ao obter access_token silencioso. Faça logout/login Microsoft de novo (sem popup automático).'
  );
  return null;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await tokenProvider();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail =
      data && typeof data === 'object' && 'detail' in data
        ? typeof (data as { detail: unknown }).detail === 'string'
          ? (data as { detail: string }).detail
          : JSON.stringify((data as { detail: unknown }).detail)
        : data
          ? JSON.stringify(data)
          : `HTTP ${res.status}`;
    throw new Error(detail || `HTTP ${res.status}`);
  }
  if (data === null) {
    throw new Error(`Resposta inválida da API (${res.status}). O proxy /api pode estar apontando para o frontend.`);
  }
  return data as T;
}

function normalizeTicketDates<T extends Ticket>(ticket: T): T {
  const base = {
    ...ticket,
    createdAt: typeof ticket.createdAt === 'string' ? ticket.createdAt : String(ticket.createdAt),
    updatedAt: typeof ticket.updatedAt === 'string' ? ticket.updatedAt : String(ticket.updatedAt),
  };
  if (ticket.type === 'onboarding') {
    return {
      ...base,
      dataInicio: String((ticket as OnboardingData).dataInicio).slice(0, 10),
    } as T;
  }
  return base as T;
}

export type TicketUpdatePayload = {
  status: TicketStatus;
  itNotes?: string;
  itChecklist?: Record<string, boolean>;
  workflow?: Record<string, unknown>;
  requesterEmail?: string;
  assignedQueue?: string;
};

export const api = {
  getMe: () => apiFetch<UserProfile & { role?: string; id?: string }>('/users/me'),

  listOnboarding: (params?: { status?: string; departamento?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.departamento) q.set('departamento', params.departamento);
    const qs = q.toString() ? `?${q}` : '';
    return apiFetch<OnboardingData[]>(`/onboarding${qs}`);
  },

  createOnboarding: (
    payload: Omit<
      OnboardingData,
      'id' | 'type' | 'status' | 'createdAt' | 'updatedAt' | 'createdBy' | 'itChecklist' | 'itNotes'
    >
  ) =>
    apiFetch<OnboardingData>('/onboarding', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then(normalizeTicketDates),

  listOffboarding: (params?: { status?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    const qs = q.toString() ? `?${q}` : '';
    return apiFetch<OffboardingData[]>(`/offboarding${qs}`);
  },

  createOffboarding: (
    payload: Omit<
      OffboardingData,
      'id' | 'type' | 'status' | 'createdAt' | 'updatedAt' | 'createdBy' | 'itChecklist' | 'itNotes'
    >
  ) =>
    apiFetch<OffboardingData>('/offboarding', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then(normalizeTicketDates),

  updateStatus: (id: string, status: TicketStatus, extra?: Omit<TicketUpdatePayload, 'status'>) =>
    apiFetch<{
      id: string;
      status: TicketStatus;
      updatedAt: string;
      itNotes?: string;
      itChecklist?: Record<string, boolean>;
      workflow?: Record<string, unknown>;
      requesterEmail?: string;
      assignedQueue?: string;
    }>(`/requests/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...extra }),
    }),

  deleteOnboarding: (id: string) => apiFetch<void>(`/onboarding/${id}`, { method: 'DELETE' }),

  deleteOffboarding: (id: string) => apiFetch<void>(`/offboarding/${id}`, { method: 'DELETE' }),

  listAllTickets: async (): Promise<Ticket[]> => {
    const [onb, off] = await Promise.all([api.listOnboarding(), api.listOffboarding()]);
    const onbList = Array.isArray(onb) ? onb : [];
    const offList = Array.isArray(off) ? off : [];
    if (!Array.isArray(onb) || !Array.isArray(off)) {
      throw new Error(
        'API não retornou lista de chamados. Verifique o proxy /api → access-api (NPM ou nginx do container web).'
      );
    }
    return [...onbList, ...offList]
      .map((t) => normalizeTicketDates(t as Ticket))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  listAudit: (params?: { limit?: number; targetRequestId?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.targetRequestId) q.set('targetRequestId', params.targetRequestId);
    const qs = q.toString() ? `?${q}` : '';
    return apiFetch<AuditLogEntry[]>(`/audit${qs}`);
  },

  getSetting: <T extends Record<string, unknown> = Record<string, unknown>>(key: 'catalog' | 'smtp') =>
    apiFetch<{ key: string; value: T; updatedAt?: string | null }>(`/settings/${key}`),

  putSetting: <T extends Record<string, unknown>>(key: 'catalog' | 'smtp', value: T) =>
    apiFetch<{ key: string; value: T; updatedAt?: string | null }>(`/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }),
};
