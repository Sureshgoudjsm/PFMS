import type {
  Account,
  Category,
  DashboardData,
  ForecastDay,
  Person,
  PersonLedger,
  Transaction,
  TransactionCreate,
  ChatResponse,
  SummaryResponse,
  PreviewResponse,
  ConfirmResponse,
  UndoResponse,
} from '../types';

const BASE = ((import.meta as any).env.VITE_API_URL || '').replace(/\/+$/, '') + '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('pfms_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as any),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    request<{ access_token: string; token_type: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getMe: () => request<any>('/auth/me'),

  updateMe: (data: { full_name?: string; avatar_url?: string; salary_day?: number | null; forecast_alert_threshold?: number }) =>
    request<any>('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),

  getTelegramLinkCode: () => request<{ code: string; expires_in_seconds: number }>('/auth/telegram-code'),

  getEmis: () => request<any[]>('/emi'),

  seedSampleData: () => request<{ status: string }>('/seed/sample', { method: 'POST' }),

  clearSampleData: () => request<{ status: string; deleted_rows_count: number }>('/seed/sample', { method: 'DELETE' }),

  getDashboard: () => request<DashboardData>('/dashboard'),

  getPeople: (activeOnly = false) =>
    request<Person[]>(`/people${activeOnly ? '?active_only=true' : ''}`),

  getPersonLedger: (id: number) => request<PersonLedger>(`/people/${id}/ledger`),

  createPerson: (data: Omit<Person, 'id'>) =>
    request<Person>('/people', { method: 'POST', body: JSON.stringify(data) }),

  getAccounts: () => request<Account[]>('/accounts'),

  createAccount: (data: Omit<Account, 'id' | 'computed_balance'>) =>
    request<Account>('/accounts', { method: 'POST', body: JSON.stringify(data) }),

  getCategories: (parentType?: string) =>
    request<Category[]>(`/categories${parentType ? `?parent_type=${parentType}` : ''}`),

  getTransactions: (params?: { limit?: number; person_id?: number }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.person_id) qs.set('person_id', String(params.person_id));
    const q = qs.toString();
    return request<Transaction[]>(`/transactions${q ? `?${q}` : ''}`);
  },

  createTransaction: (data: TransactionCreate) =>
    request<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(data) }),

  aiChat: (message: string) =>
    request<ChatResponse>('/ai/chat', { method: 'POST', body: JSON.stringify({ message }) }),

  aiSummary: (generateNarrative = true) =>
    request<SummaryResponse>(`/ai/summary?generate_narrative=${generateNarrative}`),

  aiPreview: (message: string) =>
    request<PreviewResponse>('/ai/chat/preview', { method: 'POST', body: JSON.stringify({ message }) }),

  aiConfirm: (previewId: string, intent: string, intentData: any, execute: boolean) =>
    request<ConfirmResponse>('/ai/chat/confirm', { method: 'POST', body: JSON.stringify({ preview_id: previewId, intent, intent_data: intentData, execute }) }),

  aiUndo: (transactionId: number) =>
    request<UndoResponse>('/ai/chat/undo', { method: 'POST', body: JSON.stringify({ transaction_id: transactionId }) }),

  // ── Phase 2: Notifications ──────────────────────────────────────────────
  getNotifications: () =>
    request<any[]>('/notifications'),

  markNotificationRead: (id: number) =>
    request<any>(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllNotificationsRead: () =>
    request<{ status: string }>('/notifications/read-all', { method: 'PATCH' }),

  // ── Phase 2: Health Score ───────────────────────────────────────────────
  getHealthScore: () =>
    request<any>('/insights/health-score'),

  getHealthNarrative: () =>
    request<{ narrative: string }>('/insights/health-narrative', { method: 'POST' }),

  // ── Phase 2: Conversational Query ───────────────────────────────────────
  sendQuery: (question: string) =>
    request<any>('/query', { method: 'POST', body: JSON.stringify({ question }) }),

  // ── Phase 3: Forecast ──────────────────────────────────────────────────
  getForecast: (whatIf = 0) =>
    request<{ projection: ForecastDay[] }>(`/forecast?what_if=${whatIf}`),

  // ── Phase 3: Search ────────────────────────────────────────────────────
  search: (q: string) =>
    request<any>(`/search?q=${encodeURIComponent(q)}`),

  // ── Phase 3: Export ────────────────────────────────────────────────────
  exportData: (format: 'json' | 'csv' = 'json', startDate?: string, endDate?: string) => {
    const params = new URLSearchParams({ format });
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    return request<any>(`/export?${params.toString()}`);
  },

  // ── Phase 3: Audit ─────────────────────────────────────────────────────
  getAudit: () =>
    request<any>('/audit'),

  // ── Phase 3: Milestones ────────────────────────────────────────────────
  getMilestones: () =>
    request<any[]>('/milestones'),

  // ── Phase 3: Audit running balances ────────────────────────────────────
  getRunningBalances: () =>
    request<any>('/audit/running-balances'),

  // ── Phase 3: Trigger backup ────────────────────────────────────────────
  triggerBackup: () =>
    request<{ status: string; backup_path: string }>('/backup', { method: 'POST' }),

  // ── Seeding & Resetting ───────────────────────────────────────────────
  resetAllData: () =>
    request<{ status: string; deleted_rows_count: number }>('/seed/reset', { method: 'DELETE' }),
};
