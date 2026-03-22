import type { HookConfig } from '@claude-tauri/shared';
import { HANDLER_TYPE_STYLES } from './types';

export function HookCard({
  hook,
  isDeleteConfirm,
  isEditing,
  onToggle,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  onEditStart,
  onEditCancel,
}: {
  hook: HookConfig;
  isDeleteConfirm: boolean;
  isEditing: boolean;
  onToggle: (enabled: boolean) => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onEditStart: () => void;
  onEditCancel: () => void;
}) {
  const typeStyle = HANDLER_TYPE_STYLES[hook.handler.type];

  return (
    <div
      data-testid={`hooks-card-${hook.id}`}
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
          <span
            data-testid={`hooks-status-${hook.id}`}
            className={`h-2 w-2 shrink-0 rounded-full ${
              hook.enabled ? 'bg-green-500' : 'bg-gray-500'
            }`}
          />
          <span className="text-sm font-medium text-foreground truncate">
            {hook.matcher || '*'}
          </span>
          <span
            data-testid={`hooks-type-badge-${hook.id}`}
            className={`shrink-0 rounded-full border px-1.5 py-0.5 text-xs font-medium ${typeStyle.className}`}
          >
            {typeStyle.label}
          </span>
        </div>

        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {isDeleteConfirm ? (
            <>
              <span className="text-xs text-red-400 mr-1">Delete?</span>
              <button
                data-testid={`hooks-delete-confirm-${hook.id}`}
                onClick={onDeleteConfirm}
                className="rounded-md px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Yes
              </button>
              <button
                data-testid={`hooks-delete-cancel-${hook.id}`}
                onClick={onDeleteCancel}
                className="rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
              >
                No
              </button>
            </>
          ) : (
            <>
              <button
                data-testid={`hooks-toggle-${hook.id}`}
                role="switch"
                aria-checked={hook.enabled}
                onClick={() => onToggle(!hook.enabled)}
                className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  hook.enabled ? 'bg-primary' : 'bg-input'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-background shadow-sm transition-transform ${
                    hook.enabled ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </button>
              <button
                data-testid={`hooks-delete-btn-${hook.id}`}
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

      <div className="mt-1 text-xs text-muted-foreground truncate pl-4">
        {hook.handler.type === 'command' && (
          <span>command: {hook.handler.command}</span>
        )}
        {hook.handler.type === 'http' && (
          <span>url: {hook.handler.url}</span>
        )}
        {hook.handler.type === 'prompt' && (
          <span>prompt: {hook.handler.prompt && hook.handler.prompt.length > 50
            ? hook.handler.prompt.slice(0, 50) + '...'
            : hook.handler.prompt}</span>
        )}
      </div>
    </div>
  );
}
