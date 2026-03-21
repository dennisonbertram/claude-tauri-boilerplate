import { useEffect, useState } from 'react';

const API_BASE = 'http://localhost:3131';

export interface McpServerInfo {
  name: string;
  type: 'stdio' | 'http' | 'sse';
  enabled: boolean;
  isInternal?: boolean;
}

export function useMcpServers() {
  const [servers, setServers] = useState<McpServerInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE}/api/mcp/servers`)
      .then((r) => r.json())
      .then((data: { servers?: McpServerInfo[] }) => {
        if (!cancelled) {
          setServers(data.servers ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /** MCP servers that are enabled and not internal infrastructure servers. */
  const visibleEnabledServers = servers.filter((s) => s.enabled && !s.isInternal);

  return { servers, visibleEnabledServers, loading };
}
