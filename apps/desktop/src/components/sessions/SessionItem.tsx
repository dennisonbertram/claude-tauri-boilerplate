import { useState, useRef, useEffect } from 'react';
import type { Session } from '@claude-tauri/shared';
import { Separator } from '@/components/ui/separator';
import { ProfileBadge } from '@/components/agent-builder/shared/ProfileBadge';

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
  onFork: () => void;
  onExport: (format: 'json' | 'md') => void;
}

export function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
  onRename,
  onFork,
  onExport,
}: SessionItemProps) {
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
    <div
      data-testid={`session-item-${session.id}`}
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
              type="button"
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
              type="button"
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
              <button
                type="button"
                onClick={onSelect}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-medium">
                  {session.title || 'New Chat'}
                </span>
              </button>
            )}
            {hovering && !isRenaming && (
              <button
                type="button"
                data-testid="session-menu-trigger"
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
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{dateStr}</span>
            {session.profile && <ProfileBadge profile={session.profile} />}
          </div>

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
    </div>
  );
}
