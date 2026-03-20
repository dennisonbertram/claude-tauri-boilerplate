import { useState, useRef, useEffect } from 'react';
import type { Session } from '@claude-tauri/shared';
import { MessageSquare, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { UserBadge } from '@/components/auth/UserBadge';
import { ProfileBadge } from '@/components/agent-builder/shared/ProfileBadge';

const DATE_BUCKETS = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'] as const;
type DateBucket = (typeof DATE_BUCKETS)[number];

function getDateBucket(date: Date): DateBucket {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (d >= today) return 'Today';
  if (d >= yesterday) return 'Yesterday';
  if (d >= weekAgo) return 'This Week';
  if (d >= monthStart) return 'This Month';
  return 'Older';
}

function groupSessionsByDate(sessions: Session[]): { bucket: DateBucket; sessions: Session[] }[] {
  const groups = new Map<DateBucket, Session[]>();
  for (const session of sessions) {
    const bucket = getDateBucket(new Date(session.createdAt));
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket)!.push(session);
  }
  return DATE_BUCKETS
    .filter((b) => groups.has(b))
    .map((b) => ({ bucket: b, sessions: groups.get(b)! }));
}

interface SessionSidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  email?: string;
  plan?: string;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onForkSession: (id: string) => void;
  onExportSession: (id: string, format: 'json' | 'md') => void;
  onOpenSettings?: (tab?: string) => void;
}

export function SessionSidebar({
  sessions,
  activeSessionId,
  email,
  plan,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  onForkSession,
  onExportSession,
  searchQuery = '',
  onSearchQueryChange,
}: SessionSidebarProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col min-h-0 overflow-hidden border-r border-border bg-sidebar">
      {/* Section header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Conversations
        </span>
        <button
          onClick={() => onNewChat?.()}
          className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="New chat"
          title="New chat"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3">
        <Input
          ref={searchRef}
          data-testid="session-search-input"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange?.(event.target.value)}
          placeholder="Search sessions"
          className="mt-2"
        />
      </div>
      <Separator />
      <ScrollArea className="flex-1 min-h-0 overflow-hidden">
        <div className="p-2 space-y-1">
          {sessions.length > 0 ? (
            groupSessionsByDate(sessions).map(({ bucket, sessions: groupSessions }) => (
              <div key={bucket}>
                <div className="px-2 pt-3 pb-1 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide">
                  {bucket}
                </div>
                {groupSessions.map(session => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    isActive={session.id === activeSessionId}
                    onSelect={() => onSelectSession(session.id)}
                    onDelete={() => onDeleteSession(session.id)}
                    onRename={(title) => onRenameSession(session.id, title)}
                    onFork={() => onForkSession(session.id)}
                    onExport={(format) => onExportSession(session.id, format)}
                  />
                ))}
              </div>
            ))
          ) : searchQuery ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No sessions match &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-3 opacity-40" />
              <p className="text-sm font-medium mb-1">No conversations yet</p>
              <p className="text-xs opacity-70">Start a conversation with Claude</p>
            </div>
          )}
        </div>
      </ScrollArea>
      {/* Footer: UserBadge */}
      <div className="border-t border-border p-2 flex items-center">
        <UserBadge email={email} plan={plan} />
      </div>
    </div>
  );
}

function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
  onRename,
  onFork,
  onExport,
}: {
  session: Session;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
  onFork: () => void;
  onExport: (format: 'json' | 'md') => void;
}) {
  const [hovering, setHovering] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(session.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const date = new Date(session.createdAt);
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  // Focus input when entering rename mode
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== session.title) {
      onRename(trimmed);
    }
    setIsRenaming(false);
    setRenameValue(session.title);
  };

  const handleRenameCancel = () => {
    setIsRenaming(false);
    setRenameValue(session.title);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleRenameCancel();
    }
  };

  const handleMenuAction = (action: string) => {
    switch (action) {
      case 'rename':
        setMenuOpen(false);
        setRenameValue(session.title);
        setIsRenaming(true);
        break;
      case 'fork':
        setMenuOpen(false);
        onFork();
        break;
      case 'export-json':
        setMenuOpen(false);
        onExport('json');
        break;
      case 'export-md':
        setMenuOpen(false);
        onExport('md');
        break;
      case 'delete':
        // Close the dropdown and show inline confirmation within the row
        setMenuOpen(false);
        setConfirmDelete(true);
        break;
      case 'confirm-delete':
        setConfirmDelete(false);
        onDelete();
        break;
      case 'cancel-delete':
        setConfirmDelete(false);
        break;
    }
  };

  return (
    <button
      onClick={confirmDelete ? undefined : onSelect}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirmDelete) setMenuOpen(true);
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => {
        setHovering(false);
      }}
      className={`w-full rounded-md px-3 py-2 text-left transition-colors relative group ${
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'hover:bg-sidebar-accent/50 text-sidebar-foreground'
      }`}
    >
      {confirmDelete ? (
        /* Inline delete confirmation — contained within the session row */
        <div
          data-testid="inline-delete-confirmation"
          className="flex items-center justify-between w-full gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-xs text-muted-foreground truncate">
            Delete &ldquo;{session.title}&rdquo;?
          </span>
          <div className="flex gap-1 shrink-0">
            <button
              data-testid="confirm-delete-button"
              onClick={(e) => {
                e.stopPropagation();
                handleMenuAction('confirm-delete');
              }}
              className="text-xs px-2 py-0.5 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </button>
            <button
              data-testid="cancel-delete-button"
              onClick={(e) => {
                e.stopPropagation();
                handleMenuAction('cancel-delete');
              }}
              className="text-xs px-2 py-0.5 rounded hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            {isRenaming ? (
              <input
                ref={inputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={handleRenameSubmit}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-medium flex-1 bg-background border border-border rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-ring"
              />
            ) : (
              <span className="text-sm font-medium truncate flex-1">
                {session.title || 'New Chat'}
              </span>
            )}
            {hovering && !isRenaming && (
              <div
                data-testid="session-menu-trigger"
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    setMenuOpen(!menuOpen);
                  }
                }}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{dateStr}</span>
            {session.profile && <ProfileBadge profile={session.profile} />}
          </div>

          {/* Context menu dropdown */}
          {menuOpen && (
            <div
              ref={menuRef}
              className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleMenuAction('rename')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleMenuAction('rename');
                }}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
              >
                Rename
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleMenuAction('fork')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleMenuAction('fork');
                }}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
              >
                Fork
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleMenuAction('export-json')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleMenuAction('export-json');
                }}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
              >
                Export JSON
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleMenuAction('export-md')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleMenuAction('export-md');
                }}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
              >
                Export Markdown
              </div>
              <Separator className="my-1" />
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleMenuAction('delete')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleMenuAction('delete');
                }}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 cursor-pointer"
              >
                Delete
              </div>
            </div>
          )}
        </>
      )}
    </button>
  );
}
