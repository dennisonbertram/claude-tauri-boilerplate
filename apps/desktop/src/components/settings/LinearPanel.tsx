import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import * as linear from '@/lib/linear-api';

export function LinearPanel() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const status = await linear.getStatus();
      setConnected(status.connected);
    } catch (err) {
      setConnected(false);
      setError(err instanceof Error ? err.message : 'Failed to load Linear status');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleConnect = useCallback(async () => {
    setBusy(true);
    try {
      const url = await linear.getAuthorizeUrl();
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Linear auth');
    } finally {
      setBusy(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    setBusy(true);
    try {
      await linear.disconnect();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect Linear');
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Linear Integration</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Connect Linear to browse issues from chat and attach issue context.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="text-xs text-muted-foreground">
          Status:{' '}
          {connected === null ? 'Loading…' : connected ? 'Connected' : 'Not connected'}
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={busy}>
          Refresh
        </Button>
      </div>

      <div className="flex gap-2">
        {!connected ? (
          <Button
            data-testid="linear-connect-button"
            onClick={() => void handleConnect()}
            disabled={busy}
          >
            Connect Linear
          </Button>
        ) : (
          <Button variant="destructive" onClick={() => void handleDisconnect()} disabled={busy}>
            Disconnect
          </Button>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        After authorizing in your browser, return here and click <span className="font-medium">Refresh</span>.
      </div>
    </div>
  );
}

