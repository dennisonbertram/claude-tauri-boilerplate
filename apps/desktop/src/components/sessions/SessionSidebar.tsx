import { useState, useRef, useEffect } from 'react';
import type { Session } from '@claude-tauri/shared';
import { MessageSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { UserBadge } from '@/components/auth/UserBadge';
import { ProfileBadge } from '@/components/agent-builder/shared/ProfileBadge';

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
        <Button onClick={onNewChat} className="w-full" variant="secondary">
          New Chat
        </Button>
        <Input
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
          {sessions.map(session => (
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
          {sessions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-3 opacity-40" />
              <p className="text-sm font-medium mb-1">No conversations yet</p>
              <p className="text-xs mb-3 opacity-70">Start a conversation with Claude</p>
              <button
                onClick={() => onNewChat?.()}
                className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                New Chat
              </button>
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
        setConfirmDelete(true);
        break;
      case 'confirm-delete':
        setMenuOpen(false);
        setConfirmDelete(false);
        onDelete();
        break;
    }
  };

  return (
    <button
      onClick={onSelect}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuOpen(true);
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => {
        setHovering(false);
        if (!menuOpen) {
          setConfirmDelete(false);
        }
      }}
      className={`w-full rounded-md px-3 py-2 text-left transition-colors relative group ${
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'hover:bg-sidebar-accent/50 text-sidebar-foreground'
      }`}
    >
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
          {confirmDelete ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleMenuAction('confirm-delete')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleMenuAction('confirm-delete');
              }}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 cursor-pointer"
            >
              Confirm Delete
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}
    </button>
  );
}
