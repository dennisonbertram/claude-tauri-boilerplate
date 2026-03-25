import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../lib/api-config';
import type { SessionMcpServer, McpServerConfig } from '@claude-tauri/shared';

export function useSessionMcpServers(sessionId: string | undefined) {
  const [servers, setServers] = useState<SessionMcpServer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // When no sessionId, fetch global connectors list instead
    const url = sessionId
      ? `/api/sessions/${sessionId}/mcp-servers`
      : '/api/mcp/servers';

    apiFetch(url)
      .then((r) => r.json())
      .then((data: { servers?: SessionMcpServer[] | McpServerConfig[] }) => {
        if (!cancelled) {
          if (sessionId) {
            // Session-specific response already has the right shape
            setServers((data.servers as SessionMcpServer[]) ?? []);
          } else {
            // Global endpoint returns McpServerConfig — adapt to SessionMcpServer shape
            const adapted: SessionMcpServer[] = ((data.servers ?? []) as McpServerConfig[]).map((s) => ({
              name: s.name,
              type: s.type,
              enabled: s.enabled,
              globalEnabled: s.enabled,
              hasSessionOverride: false,
            }));
            setServers(adapted);
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const toggleServer = useCallback(
    async (serverName: string, enabled: boolean) => {
      if (!sessionId) return;

      // Optimistic update
      setServers((prev) =>
        prev.map((s) =>
          s.name === serverName ? { ...s, enabled, hasSessionOverride: true } : s
        )
      );

      try {
        await apiFetch(`/api/sessions/${sessionId}/mcp-servers/${serverName}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        });
      } catch {
        // Revert on failure
        setServers((prev) =>
          prev.map((s) =>
            s.name === serverName ? { ...s, enabled: !enabled } : s
          )
        );
      }
    },
    [sessionId]
  );

  const resetOverride = useCallback(
    async (serverName: string) => {
      if (!sessionId) return;

      try {
        await apiFetch(`/api/sessions/${sessionId}/mcp-servers/${serverName}`, {
          method: 'DELETE',
        });

        // Revert to global default
        setServers((prev) =>
          prev.map((s) =>
            s.name === serverName
              ? { ...s, enabled: s.globalEnabled, hasSessionOverride: false }
              : s
          )
        );
      } catch {
        // ignore
      }
    },
    [sessionId]
  );

  const activeCount = servers.filter((s) => s.enabled).length;

  return { servers, activeCount, loading, toggleServer, resetOverride };
}
