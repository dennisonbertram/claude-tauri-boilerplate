import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  PlaidItem,
  PlaidAccount,
  PlaidTransaction,
  PlaidSyncStatus,
  PlaidTransactionFilters,
  PaginatedResponse,
  CreateLinkSessionResponse,
} from '@claude-tauri/shared';
import {
  fetchPlaidItems,
  fetchPlaidAccounts,
  fetchPlaidTransactions,
  startLinkSession,
  finalizeLinkSession,
  getLinkSessionStatus,
  reauthPlaidItem,
  deletePlaidItem,
  fetchSyncStatus,
  triggerSync,
  refreshBalances,
} from '@/lib/api/plaid-api';
import { isTauri } from '@/lib/platform';
import { getBrowserPlaidCompletionRedirectUri } from '@/lib/plaid-link';

// ---------------------------------------------------------------------------
// usePlaidItems — fetch connected institutions
// ---------------------------------------------------------------------------

export function usePlaidItems() {
  const [items, setItems] = useState<PlaidItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchPlaidItems();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch institutions');
      console.error('Failed to fetch plaid items:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { items, isLoading, error, refresh };
}

// ---------------------------------------------------------------------------
// usePlaidAccounts — fetch all accounts (optionally filtered)
// ---------------------------------------------------------------------------

export function usePlaidAccounts(filters?: { itemId?: string; type?: string }) {
  const [accounts, setAccounts] = useState<PlaidAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchPlaidAccounts(filters);
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch accounts');
      console.error('Failed to fetch plaid accounts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filters?.itemId, filters?.type]);

  useEffect(() => { refresh(); }, [refresh]);

  return { accounts, isLoading, error, refresh };
}

// ---------------------------------------------------------------------------
// usePlaidTransactions — fetch transactions with pagination
// ---------------------------------------------------------------------------

export function usePlaidTransactions(filters?: PlaidTransactionFilters) {
  const [data, setData] = useState<PaginatedResponse<PlaidTransaction>>({
    items: [],
    total: 0,
    limit: filters?.limit ?? 50,
    offset: filters?.offset ?? 0,
    hasMore: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await fetchPlaidTransactions(filters);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
      console.error('Failed to fetch plaid transactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [
    filters?.startDate,
    filters?.endDate,
    filters?.accountIds?.join(','),
    filters?.pending,
    filters?.search,
    filters?.category,
    filters?.minAmount,
    filters?.maxAmount,
    filters?.sort,
    filters?.limit,
    filters?.offset,
  ]);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    transactions: data.items,
    total: data.total,
    hasMore: data.hasMore,
    isLoading,
    error,
    refresh,
  };
}

// ---------------------------------------------------------------------------
// useConnectBank — initiate Plaid Hosted Link flow
// ---------------------------------------------------------------------------

export function useConnectBank() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<CreateLinkSessionResponse | null>(null);

  const connect = useCallback(async (institutionId?: string) => {
    try {
      setIsConnecting(true);
      setError(null);
      const completionRedirectUri = isTauri()
        ? undefined
        : getBrowserPlaidCompletionRedirectUri(window.location.origin);
      const linkSession = await startLinkSession(institutionId, completionRedirectUri);
      setSession(linkSession);

      // Open the hosted link URL in the system browser via Tauri shell
      try {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(linkSession.hostedLinkUrl);
      } catch {
        // Fallback for browser dev mode
        window.open(linkSession.hostedLinkUrl, '_blank');
      }

      return linkSession;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect bank';
      setError(message);
      console.error('Failed to start bank connection:', err);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const finalize = useCallback(async (state: string, publicToken: string) => {
    try {
      setError(null);
      const result = await finalizeLinkSession(state, publicToken);
      setSession(null);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to finalize connection';
      setError(message);
      console.error('Failed to finalize bank connection:', err);
      return null;
    }
  }, []);

  const checkSessionStatus = useCallback(async (sessionId: string) => {
    try {
      return await getLinkSessionStatus(sessionId);
    } catch (err) {
      console.error('Failed to check session status:', err);
      return null;
    }
  }, []);

  return { connect, finalize, checkSessionStatus, isConnecting, error, session };
}

// ---------------------------------------------------------------------------
// useReauthBank — initiate update-mode reauth for broken connections
// ---------------------------------------------------------------------------

export function useReauthBank() {
  const [isReauthing, setIsReauthing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reauth = useCallback(async (itemId: string) => {
    try {
      setIsReauthing(true);
      setError(null);
      const completionRedirectUri = isTauri()
        ? undefined
        : getBrowserPlaidCompletionRedirectUri(window.location.origin);
      const linkSession = await reauthPlaidItem(itemId, completionRedirectUri);

      try {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(linkSession.hostedLinkUrl);
      } catch {
        window.open(linkSession.hostedLinkUrl, '_blank');
      }

      return linkSession;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start re-authentication';
      setError(message);
      console.error('Failed to start reauth:', err);
      return null;
    } finally {
      setIsReauthing(false);
    }
  }, []);

  return { reauth, isReauthing, error };
}

// ---------------------------------------------------------------------------
// useDisconnectBank — remove an institution
// ---------------------------------------------------------------------------

export function useDisconnectBank() {
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disconnect = useCallback(async (itemId: string) => {
    try {
      setIsDisconnecting(true);
      setError(null);
      await deletePlaidItem(itemId);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect';
      setError(message);
      console.error('Failed to disconnect bank:', err);
      return false;
    } finally {
      setIsDisconnecting(false);
    }
  }, []);

  return { disconnect, isDisconnecting, error };
}

// ---------------------------------------------------------------------------
// useSyncStatus — poll sync job status
// ---------------------------------------------------------------------------

export function useSyncStatus(pollInterval = 5000) {
  const [statuses, setStatuses] = useState<PlaidSyncStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchSyncStatus();
      setStatuses(data);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sync status');
      setIsLoading(false);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(refresh, pollInterval);
  }, [refresh, pollInterval]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    refresh();
    return stopPolling;
  }, [refresh, stopPolling]);

  // Auto-poll when any status is pending or running
  useEffect(() => {
    const hasActive = statuses.some(s => s.status === 'pending' || s.status === 'running');
    if (hasActive) {
      startPolling();
    } else {
      stopPolling();
    }
  }, [statuses, startPolling, stopPolling]);

  return { statuses, isLoading, error, refresh, startPolling, stopPolling };
}

// ---------------------------------------------------------------------------
// useRefreshBalances — trigger balance refresh
// ---------------------------------------------------------------------------

export function useRefreshBalances() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      await refreshBalances();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh balances';
      setError(message);
      console.error('Failed to refresh balances:', err);
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return { refresh, isRefreshing, error };
}

// ---------------------------------------------------------------------------
// useTriggerSync — trigger a transaction sync
// ---------------------------------------------------------------------------

export function useTriggerSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    try {
      setIsSyncing(true);
      setError(null);
      const result = await triggerSync();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to trigger sync';
      setError(message);
      console.error('Failed to trigger sync:', err);
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return { sync, isSyncing, error };
}
