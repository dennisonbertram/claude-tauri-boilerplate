import { useSessionMcpServers } from '../../hooks/useSessionMcpServers';

interface ConnectorListProps {
  sessionId: string | undefined;
}

/**
 * Embeddable connector list with toggle switches.
 * Designed to be placed inside a parent dropdown/popover menu.
 */
export function ConnectorList({ sessionId }: ConnectorListProps) {
  const { servers, loading, toggleServer } = useSessionMcpServers(sessionId);

  if (loading || servers.length === 0) return null;

  return (
    <>
      <div className="border-t border-border/50 mt-1" />
      <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
        Connectors
      </p>
      <ul className="py-0.5">
        {servers.map((server) => (
          <li
            key={server.name}
            className="flex items-center justify-between gap-3 px-3 py-1.5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  server.enabled ? 'bg-green-500' : 'bg-muted-foreground/30'
                }`}
                aria-hidden="true"
              />
              <span className="text-xs text-foreground truncate">
                {server.name}
              </span>
              {server.hasSessionOverride && (
                <span className="text-[10px] text-muted-foreground/60">*</span>
              )}
            </div>
            <button
              type="button"
              data-testid={`connector-toggle-${server.name}`}
              onClick={() => toggleServer(server.name, !server.enabled)}
              className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                server.enabled
                  ? 'bg-green-500'
                  : 'bg-muted-foreground/30'
              }`}
              role="switch"
              aria-checked={server.enabled}
              aria-label={`Toggle ${server.name}`}
            >
              <span
                className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm ring-0 transition-transform ${
                  server.enabled ? 'translate-x-3' : 'translate-x-0'
                }`}
              />
            </button>
          </li>
        ))}
      </ul>
      <div className="border-t border-border/50 px-3 py-1.5">
        <span className="text-[10px] text-muted-foreground">
          Changes apply on next message
        </span>
      </div>
    </>
  );
}

/**
 * Returns the active connector count for showing an indicator dot.
 */
export { useSessionMcpServers } from '../../hooks/useSessionMcpServers';

/**
 * Standalone ConnectorPanel kept for backwards compatibility.
 * Wraps ConnectorList in its own popover.
 */
export { ConnectorList as ConnectorPanel };
