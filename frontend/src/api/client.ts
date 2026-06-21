import type {
  Account,
  Category,
  DashboardData,
  Person,
  PersonLedger,
  Transaction,
  TransactionCreate,
} from '../types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
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
};
