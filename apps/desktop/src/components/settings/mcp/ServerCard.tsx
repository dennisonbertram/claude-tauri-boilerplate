import type { McpServerConfig } from '@claude-tauri/shared';
import { TYPE_STYLES } from './types';

interface ServerCardProps {
  server: McpServerConfig;
  isDeleteConfirm: boolean;
  isEditing: boolean;
  onToggle: (enabled: boolean) => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onEditStart: () => void;
  onEditCancel: () => void;
}

export function ServerCard({
  server,
  isDeleteConfirm,
  isEditing,
  onToggle,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  onEditStart,
  onEditCancel,
}: ServerCardProps) {
  const typeStyle = TYPE_STYLES[server.type];

  return (
    <div
      data-testid={`mcp-server-${server.name}`}
      className={`rounded-lg border px-3 py-2.5 transition-colors cursor-pointer ${
        isEditing
          ? 'border-primary/50 bg-primary/5'
          : 'border-border hover:border-border/80 hover:bg-muted/30'
      }`}
      onClick={() => {
        if (!isEditing) onEditStart();
        else onEditCancel();
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {/* Status dot */}
          <span
            data-testid={`mcp-status-${server.name}`}
            className={`h-2 w-2 shrink-0 rounded-full ${
              server.enabled ? 'bg-green-500' : 'bg-gray-500'
            }`}
          />

          {/* Name */}
          <span className="text-sm font-medium text-foreground truncate">{server.name}</span>

          {/* Type badge */}
          <span
            data-testid={`mcp-type-badge-${server.name}`}
            className={`shrink-0 rounded-full border px-1.5 py-0.5 text-xs font-medium ${typeStyle.className}`}
          >
            {typeStyle.label}
          </span>
        </div>

        {/* Actions */}
        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {isDeleteConfirm ? (
            <>
              <span className="text-xs text-red-400 mr-1">Delete?</span>
              <button
                data-testid={`mcp-delete-confirm-${server.name}`}
                onClick={onDeleteConfirm}
                className="rounded-md px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Yes
              </button>
              <button
                data-testid={`mcp-delete-cancel-${server.name}`}
                onClick={onDeleteCancel}
                className="rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
              >
                No
              </button>
            </>
          ) : (
            <>
              {/* Toggle */}
              <button
                data-testid={`mcp-toggle-${server.name}`}
                role="switch"
                aria-checked={server.enabled}
                onClick={() => onToggle(!server.enabled)}
                className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  server.enabled ? 'bg-primary' : 'bg-input'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-background shadow-sm transition-transform ${
                    server.enabled ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </button>

              {/* Delete */}
              <button
                data-testid={`mcp-delete-btn-${server.name}`}
                onClick={onDeleteRequest}
                className="rounded-md px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Details line */}
      <div className="mt-1 text-xs text-muted-foreground truncate pl-4">
        {server.type === 'stdio' ? (
          <span>command: {server.command} {server.args?.join(' ') || ''}</span>
        ) : (
          <span>url: {server.url}</span>
        )}
      </div>

      {/* Tools placeholder */}
      <div className="mt-0.5 text-xs text-muted-foreground/60 pl-4">
        Tools available (connect to discover)
      </div>
    </div>
  );
}
