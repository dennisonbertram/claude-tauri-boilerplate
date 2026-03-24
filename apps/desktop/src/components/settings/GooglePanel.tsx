import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import * as google from '@/lib/google-api';

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1_000; // 5 minutes

/** Map full Google scope URLs to short human-readable labels */
const SCOPE_LABELS: Record<string, string> = {
  'https://www.googleapis.com/auth/gmail.readonly': 'Gmail',
  'https://www.googleapis.com/auth/gmail.send': 'Gmail Send',
  'https://www.googleapis.com/auth/gmail.modify': 'Gmail',
  'https://www.googleapis.com/auth/calendar': 'Calendar',
  'https://www.googleapis.com/auth/calendar.readonly': 'Calendar',
  'https://www.googleapis.com/auth/calendar.events': 'Calendar',
  'https://www.googleapis.com/auth/drive': 'Drive',
  'https://www.googleapis.com/auth/drive.readonly': 'Drive',
  'https://www.googleapis.com/auth/drive.file': 'Drive',
  'https://www.googleapis.com/auth/documents': 'Docs',
  'https://www.googleapis.com/auth/documents.readonly': 'Docs',
  'https://www.googleapis.com/auth/spreadsheets': 'Sheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly': 'Sheets',
  'https://mail.google.com/': 'Gmail',
  'openid': 'OpenID',
  'profile': 'Profile',
  'email': 'Email',
  'https://www.googleapis.com/auth/userinfo.email': 'Email',
  'https://www.googleapis.com/auth/userinfo.profile': 'Profile',
};

function scopeToLabel(scope: string): string {
  return SCOPE_LABELS[scope] ?? scope.split('/').pop() ?? scope;
}

/** Deduplicate scope labels (e.g. multiple Gmail scopes -> one "Gmail" badge) */
function getUniqueScopeLabels(scopes: string[]): string[] {
  const labels = new Set<string>();
  for (const s of scopes) {
    const label = scopeToLabel(s);
    // Skip generic auth scopes from badge display
    if (label === 'OpenID' || label === 'Profile' || label === 'Email') continue;
    labels.add(label);
  }
  return Array.from(labels).sort();
}

type DotColor = 'green' | 'yellow' | 'red' | 'gray';

function StatusDot({ color }: { color: DotColor }) {
  const bg: Record<DotColor, string> = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    gray: 'bg-muted-foreground/50',
  };
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${bg[color]}`}
      aria-hidden="true"
    />
  );
}

function getTokenExpiryInfo(expiresAt?: string): { text: string; expiringSoon: boolean; expired: boolean } {
  if (!expiresAt) return { text: '', expiringSoon: false, expired: false };
  const expiresMs = new Date(expiresAt).getTime();
  const nowMs = Date.now();
  const diffMs = expiresMs - nowMs;

  if (diffMs <= 0) {
    return { text: 'Token expired', expiringSoon: false, expired: true };
  }

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 5) {
    return { text: `Token expires: ${diffMinutes}m`, expiringSoon: true, expired: false };
  }
  if (diffMinutes < 60) {
    return { text: `Token expires: ${diffMinutes}m`, expiringSoon: false, expired: false };
  }
  const diffHours = Math.floor(diffMinutes / 60);
  return { text: `Token expires: ${diffHours}h ${diffMinutes % 60}m`, expiringSoon: false, expired: false };
}

export function GooglePanel() {
  const [status, setStatus] = useState<google.GoogleStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptIdRef = useRef<string | null>(null);
  const pollStartRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    attemptIdRef.current = null;
    setPolling(false);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const s = await google.getStatus();
      setStatus(s);
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : 'Failed to load Google status');
    }
  }, []);

  const handleRefreshClick = useCallback(async () => {
    setRefreshing(true);
    try {
      // Force token refresh on the server, then re-fetch status
      await google.refreshToken();
    } catch {
      // Token refresh may fail if not connected — that's ok, we still fetch status
    }
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = useCallback(
    (attemptId: string) => {
      attemptIdRef.current = attemptId;
      pollStartRef.current = Date.now();
      setPolling(true);

      pollRef.current = setInterval(async () => {
        // Check timeout
        if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
          stopPolling();
          setError('Authorization timed out. Please try again.');
          return;
        }

        if (!attemptIdRef.current) return;

        try {
          const attemptStatus = await google.getAttemptStatus(attemptIdRef.current);

          switch (attemptStatus.status) {
            case 'success':
              stopPolling();
              await refresh();
              break;
            case 'denied':
              stopPolling();
              setError('Authorization was denied. Please try again and grant the requested permissions.');
              break;
            case 'expired':
              stopPolling();
              setError('Authorization expired. Please try again.');
              break;
            case 'error':
              stopPolling();
              setError(attemptStatus.error ?? 'Authorization failed. Please try again.');
              break;
            // 'pending' — keep polling
          }
        } catch {
          // Transient error, keep polling
        }
      }, POLL_INTERVAL_MS);
    },
    [refresh, stopPolling],
  );

  const handleConnect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { url, attemptId } = await google.getAuthorizeUrl();
      window.open(url, '_blank', 'noopener,noreferrer');
      startPolling(attemptId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Google auth');
    } finally {
      setBusy(false);
    }
  }, [startPolling]);

  const handleDisconnect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await google.disconnect();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect Google');
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const isConnected = status?.connected ?? false;
  const isConfigured = status?.configured ?? true; // assume configured unless told otherwise

  // Determine dot color and status label
  const tokenExpiry = getTokenExpiryInfo(status?.expiresAt);
  const dotColor: DotColor = (() => {
    if (!status || !isConnected) return 'gray';
    if (status.lastError) return 'red';
    if (status.needsReauth || tokenExpiry.expiringSoon || tokenExpiry.expired) return 'yellow';
    return 'green';
  })();

  const statusLabel = (() => {
    if (!status) return 'Loading\u2026';
    if (!isConfigured) return 'Not configured';
    if (!isConnected) return 'Not connected';
    return 'Connected';
  })();

  // Parse granted scopes (server sends as string[] but type says string; handle both)
  const grantedScopes: string[] = (() => {
    if (!status?.grantedScopes) return [];
    if (Array.isArray(status.grantedScopes)) return status.grantedScopes as string[];
    if (typeof status.grantedScopes === 'string') return (status.grantedScopes as string).split(' ').filter(Boolean);
    return [];
  })();

  const scopeLabels = getUniqueScopeLabels(grantedScopes);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Google Integration</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Connect your Google account to access Gmail, Calendar, Drive, and Docs.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Status display */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <StatusDot color={dotColor} />
            <span className="font-medium">{statusLabel}</span>
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => void handleRefreshClick()}
            disabled={refreshing}
            className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
            title="Refresh status"
          >
            <svg
              className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>

        {/* Account info when connected */}
        {isConnected && status?.account?.email && (
          <div className="pl-3.5 text-xs text-muted-foreground">
            {status.account.name ? (
              <span>{status.account.name} ({status.account.email})</span>
            ) : (
              <span>{status.account.email}</span>
            )}
          </div>
        )}

        {/* Token expiry */}
        {isConnected && tokenExpiry.text && (
          <div className={`pl-3.5 text-xs ${tokenExpiry.expired ? 'text-destructive' : tokenExpiry.expiringSoon ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'}`}>
            {tokenExpiry.text}
          </div>
        )}

        {/* Last error from server */}
        {isConnected && status?.lastError && (
          <div className="ml-3.5 rounded border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-700 dark:text-yellow-400">
            {status.lastError}
          </div>
        )}

        {/* Needs reauth warning */}
        {isConnected && status?.needsReauth && !status.lastError && (
          <div className="ml-3.5 rounded border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-700 dark:text-yellow-400">
            Re-authorization needed — some permissions may be missing.
          </div>
        )}

        {/* Not configured hint */}
        {!isConfigured && (
          <div className="pl-3.5 text-xs text-muted-foreground">
            Set <code className="rounded bg-muted px-1 py-0.5 text-[10px]">GOOGLE_CLIENT_ID</code> and{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">GOOGLE_CLIENT_SECRET</code> to enable.
          </div>
        )}

        {/* Scope badges */}
        {isConnected && scopeLabels.length > 0 && (
          <div className="flex flex-wrap gap-1 pl-3.5 pt-0.5">
            {scopeLabels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {polling && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <svg
            className="h-3.5 w-3.5 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Waiting for authorization&hellip;
        </div>
      )}

      <div className="flex gap-2">
        {!isConnected ? (
          <Button
            data-testid="google-connect-button"
            onClick={() => void handleConnect()}
            disabled={busy || polling || !isConfigured}
          >
            Connect Google
          </Button>
        ) : (
          <>
            <Button
              variant="destructive"
              onClick={() => void handleDisconnect()}
              disabled={busy}
            >
              Disconnect
            </Button>
            {status?.needsReauth && (
              <Button
                variant="outline"
                onClick={() => void handleConnect()}
                disabled={busy || polling}
              >
                Re-authorize
              </Button>
            )}
          </>
        )}
      </div>

      {!polling && !isConnected && isConfigured && (
        <div className="text-xs text-muted-foreground">
          After clicking Connect, authorize in your browser. This panel will update automatically.
        </div>
      )}
    </div>
  );
}
