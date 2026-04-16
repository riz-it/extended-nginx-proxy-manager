// ── API Client ──────────────────────────────────────────────

import type { LoadBalancer, CreateLbPayload, UpdateLbPayload } from './types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit & { responseType?: 'json' | 'text' }): Promise<T> {
  const token = localStorage.getItem('npm_auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    headers: { ...headers, ...(options?.headers as any) },
    ...options,
  });
  if (res.status === 401) {
    localStorage.removeItem('npm_auth_token');
    window.dispatchEvent(new Event('unauthorized'));
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || err.error || res.statusText);
  }

  if (options?.responseType === 'text') {
    return (await res.text()) as any;
  }
  return res.json();
}

export const api = {
  // Auth
  login: (identity: string, secret: string) =>
    request<{ token: string, expires: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identity, secret }),
    }),
  // Load Balancers
  listLb: () => request<LoadBalancer[]>('/lb'),
  getLb: (id: number) => request<LoadBalancer>(`/lb/${id}`),
  createLb: (data: CreateLbPayload) =>
    request<LoadBalancer>('/lb', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateLb: (id: number, data: UpdateLbPayload) =>
    request<LoadBalancer>(`/lb/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteLb: (id: number) =>
    request<{ message: string }>(`/lb/${id}`, { method: 'DELETE' }),
  toggleLb: (id: number) =>
    request<LoadBalancer>(`/lb/${id}/toggle`, { method: 'PATCH' }),
  previewLb: (id: number) => request<string>(`/lb/${id}/preview`, { responseType: 'text' }),

  // Health
  health: () => request<{ status: string }>('/health'),

  // Traffic
  getTraffic: (days?: number, lbId?: number) => {
    const params = new URLSearchParams();
    if (days) params.append('days', String(days));
    if (lbId) params.append('lbId', String(lbId));
    return request<any>(`/traffic?${params.toString()}`);
  }
};
