import { apiFetch } from '@/lib/api-config';
import type {
  PlaidItem,
  PlaidAccount,
  PlaidTransaction,
  PlaidSyncStatus,
  PlaidTransactionFilters,
  CreateLinkSessionResponse,
  FinalizeLinkResponse,
  PaginatedResponse,
} from '@claude-tauri/shared';

// --- Link Flow ---

export async function startLinkSession(institutionId?: string): Promise<CreateLinkSessionResponse> {
  const res = await apiFetch('/api/plaid/link/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(institutionId ? { institutionId } : {}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to start link session: ${res.status}`);
  }
  return res.json();
}

export async function finalizeLinkSession(state: string, publicToken: string): Promise<FinalizeLinkResponse> {
  const res = await apiFetch('/api/plaid/link/finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, publicToken }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to finalize link: ${res.status}`);
  }
  return res.json();
}

export async function getLinkSessionStatus(sessionId: string): Promise<{ status: string }> {
  const res = await apiFetch(`/api/plaid/link/session/${sessionId}/status`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to get session status: ${res.status}`);
  }
  return res.json();
}

// --- Items ---

export async function fetchPlaidItems(): Promise<PlaidItem[]> {
  const res = await apiFetch('/api/plaid/items');
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to fetch items: ${res.status}`);
  }
  return res.json();
}

export async function deletePlaidItem(itemId: string): Promise<void> {
  const res = await apiFetch(`/api/plaid/items/${itemId}`, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to disconnect: ${res.status}`);
  }
}

export async function reauthPlaidItem(itemId: string): Promise<CreateLinkSessionResponse> {
  const res = await apiFetch(`/api/plaid/items/${itemId}/reauth`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to start reauth: ${res.status}`);
  }
  return res.json();
}

// --- Accounts ---

export async function fetchPlaidAccounts(filters?: {
  itemId?: string;
  type?: string;
}): Promise<PlaidAccount[]> {
  const params = new URLSearchParams();
  if (filters?.itemId) params.set('itemId', filters.itemId);
  if (filters?.type) params.set('type', filters.type);
  const qs = params.toString();
  const res = await apiFetch(`/api/plaid/accounts${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to fetch accounts: ${res.status}`);
  }
  return res.json();
}

export async function refreshBalances(): Promise<void> {
  const res = await apiFetch('/api/plaid/accounts/refresh-balances', { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to refresh balances: ${res.status}`);
  }
}

// --- Transactions ---

export async function fetchPlaidTransactions(
  filters?: PlaidTransactionFilters,
): Promise<PaginatedResponse<PlaidTransaction>> {
  const params = new URLSearchParams();
  if (filters?.startDate) params.set('startDate', filters.startDate);
  if (filters?.endDate) params.set('endDate', filters.endDate);
  if (filters?.accountIds?.length) params.set('accountIds', filters.accountIds.join(','));
  if (filters?.pending !== undefined) params.set('pending', String(filters.pending));
  if (filters?.search) params.set('search', filters.search);
  if (filters?.category) params.set('category', filters.category);
  if (filters?.minAmount !== undefined) params.set('minAmount', String(filters.minAmount));
  if (filters?.maxAmount !== undefined) params.set('maxAmount', String(filters.maxAmount));
  if (filters?.sort) params.set('sort', filters.sort);
  if (filters?.limit !== undefined) params.set('limit', String(filters.limit));
  if (filters?.offset !== undefined) params.set('offset', String(filters.offset));
  const qs = params.toString();
  const res = await apiFetch(`/api/plaid/transactions${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to fetch transactions: ${res.status}`);
  }
  return res.json();
}

// --- Sync ---

export async function triggerSync(): Promise<{ status: string }> {
  const res = await apiFetch('/api/plaid/sync', { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to trigger sync: ${res.status}`);
  }
  return res.json();
}

export async function fetchSyncStatus(): Promise<PlaidSyncStatus[]> {
  const res = await apiFetch('/api/plaid/sync/status');
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Failed to fetch sync status: ${res.status}`);
  }
  return res.json();
}
