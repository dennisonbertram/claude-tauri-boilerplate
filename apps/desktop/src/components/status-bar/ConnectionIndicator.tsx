import { useState, useEffect } from 'react';
import { API_BASE } from './constants';

export function ConnectionIndicator({ isStreaming }: { isStreaming: boolean }) {
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const res = await fetch(`${API_BASE}/api/health`);
        if (!cancelled) setConnected(res.ok);
      } catch {
        if (!cancelled) setConnected(false);
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 15_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  let dotClass: string;
  let label: string | null;
  let tooltip: string;

  if (!connected) {
    dotClass = 'bg-red-500';
    label = 'Disconnected';
    tooltip = 'Cannot reach server — check that the app server is running';
  } else if (isStreaming) {
    dotClass = 'bg-green-500 animate-pulse';
    label = 'Connected';
    tooltip = 'Agent is running';
  } else {
    dotClass = 'bg-muted-foreground/40';
    label = null;
    tooltip = 'Server connected and ready';
  }

  return (
    <div className="flex items-center gap-1 px-1.5 py-0.5" title={tooltip}>
      <span
        data-testid="connection-dot"
        className={`inline-block h-2 w-2 rounded-full ${dotClass}`}
      />
      {label && <span>{label}</span>}
    </div>
  );
}
