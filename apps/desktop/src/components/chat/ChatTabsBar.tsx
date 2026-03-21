import { useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@claude-tauri/shared';
import { X } from '@phosphor-icons/react';

interface ChatTabsBarProps {
  sessions: Session[];
  openSessionIds: string[];
  activeSessionId: string | null;
  onActivate: (sessionId: string) => void;
  onClose: (sessionId: string) => void;
  onRename: (sessionId: string, title: string) => void;
  onNewTab: () => void;
}

function titleForSession(sessions: Session[], sessionId: string): string {
  const session = sessions.find((s) => s.id === sessionId);
  return session?.title?.trim() || 'New Chat';
}

export function ChatTabsBar({
  sessions,
  openSessionIds,
  activeSessionId,
  onActivate,
  onClose,
  onRename,
  onNewTab,
}: ChatTabsBarProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const orderedOpenIds = useMemo(
    () => openSessionIds.filter((id) => sessions.some((s) => s.id === id)),
    [openSessionIds, sessions]
  );

  useEffect(() => {
    if (!renamingId) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [renamingId]);

  const submitRename = (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      onRename(id, trimmed);
    }
    setRenamingId(null);
    setRenameValue('');
  };

  return (
    <div
      className="flex items-center gap-1 border-b border-border bg-sidebar px-2 py-1"
      data-testid="chat-tabs-bar"
    >
      <button
        type="button"
        onClick={onNewTab}
        className="mr-1 inline-flex h-7 items-center rounded-md border border-border bg-background px-2 text-xs font-medium text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
        data-testid="chat-tab-new"
        aria-label="New chat tab"
      >
        New Tab
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {orderedOpenIds.map((id) => {
          const title = titleForSession(sessions, id);
          const isActive = id === activeSessionId;

          return (
            <div
              key={id}
              className={`group inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs transition ${
                isActive
                  ? 'border-primary bg-background text-foreground'
                  : 'border-border bg-background/30 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              }`}
            >
              <button
                type="button"
                data-testid={`chat-tab-${id}`}
                onClick={() => onActivate(id)}
                onDoubleClick={() => {
                  setRenamingId(id);
                  setRenameValue(title);
                }}
                onMouseDown={(e) => {
                  // Middle click closes
                  if (e.button === 1) {
                    e.preventDefault();
                    onClose(id);
                  }
                }}
                className="min-w-0 max-w-[180px] truncate text-left"
                aria-current={isActive ? 'page' : undefined}
              >
                {renamingId === id ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        submitRename(id);
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setRenamingId(null);
                        setRenameValue('');
                      }
                    }}
                    onBlur={() => submitRename(id)}
                    data-testid={`chat-tab-rename-input-${id}`}
                    className="h-5 w-[140px] rounded border border-border bg-background px-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                  />
                ) : (
                  title
                )}
              </button>

              <button
                type="button"
                onClick={() => onClose(id)}
                data-testid={`chat-tab-close-${id}`}
                aria-label="Close tab"
                className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-60 transition hover:bg-muted/60 hover:text-foreground group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
