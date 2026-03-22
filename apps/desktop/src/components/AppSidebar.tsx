import { useState, useRef, useEffect, useCallback } from 'react';
import type { Session, Project, Workspace } from '@claude-tauri/shared';
import {
  ChatCircle,
  FolderOpen,
  UsersThree,
  Robot,
  Plus,
  Gear,
  SidebarSimple,
  CaretLeft,
  CaretRight,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ProfileBadge } from '@/components/agent-builder/shared/ProfileBadge';
import { WorkspaceStatusBadge } from '@/components/workspaces/WorkspaceStatusBadge';
import { getProjectDisplayName } from '@/lib/project-display';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ActiveView = 'chat' | 'workspaces' | 'teams' | 'agents';

export interface AppSidebarProps {
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  // Sessions (for chat view recents)
  sessions: Session[];
  activeSessionId: string | null;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession?: (id: string) => void;
  onRenameSession?: (id: string, name: string) => void;
  onForkSession?: (id: string) => void;
  onExportSession?: (id: string, format: string) => void;
  // Workspaces (for projects view)
  projects: Project[];
  workspacesByProject: Record<string, Workspace[]>;
  selectedWorkspaceId: string | null;
  onSelectWorkspace: (ws: Workspace) => void;
  onAddProject: () => void;
  // Sidebar collapse
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  // User
  email?: string;
  plan?: string;
  onOpenSettings: () => void;
}

/* ------------------------------------------------------------------ */
/*  Date bucketing (ported from SessionSidebar)                        */
/* ------------------------------------------------------------------ */

const DATE_BUCKETS = ['Today', 'Yesterday', 'This Week', 'Last Week', 'This Month'] as const;
type DateBucket = (typeof DATE_BUCKETS)[number] | string;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function getDateBucket(date: Date): DateBucket {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const lastWeekAgo = new Date(today);
  lastWeekAgo.setDate(lastWeekAgo.getDate() - 14);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (d >= today) return 'Today';
  if (d >= yesterday) return 'Yesterday';
  if (d >= weekAgo) return 'This Week';
  if (d >= lastWeekAgo) return 'Last Week';
  if (d >= monthStart) return 'This Month';
  if (d >= lastMonthStart) return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function groupSessionsByDate(sessions: Session[]): { bucket: DateBucket; sessions: Session[] }[] {
  const groups = new Map<DateBucket, Session[]>();
  for (const session of sessions) {
    const bucket = getDateBucket(new Date(session.createdAt));
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket)!.push(session);
  }
  const fixedBuckets: { bucket: DateBucket; sessions: Session[] }[] = DATE_BUCKETS
    .filter((b) => groups.has(b))
    .map((b) => ({ bucket: b, sessions: groups.get(b)! }));

  const monthBuckets = Array.from(groups.keys())
    .filter((bucket): bucket is string =>
      !DATE_BUCKETS.includes(bucket as (typeof DATE_BUCKETS)[number])
    )
    .map((bucket) => {
      const [monthLabel, yearLabel] = bucket.split(' ');
      return {
        bucket,
        sessions: groups.get(bucket)!,
        sortValue: (Number(yearLabel) * 12) + MONTH_NAMES.indexOf(monthLabel as any),
      };
    })
    .sort((a, b) => b.sortValue - a.sortValue);

  return [
    ...fixedBuckets,
    ...monthBuckets.map(({ bucket, sessions }) => ({ bucket, sessions })),
  ];
}

/* ------------------------------------------------------------------ */
/*  Nav configuration                                                  */
/* ------------------------------------------------------------------ */

const navItems: { view: ActiveView; icon: typeof ChatCircle; label: string }[] = [
  { view: 'workspaces', icon: FolderOpen, label: 'Projects' },
  { view: 'agents', icon: Robot, label: 'Agent Profiles' },
  { view: 'teams', icon: UsersThree, label: 'Teams' },
];

const navItemClass = (active: boolean) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full text-left transition-colors ${
    active
      ? 'bg-card shadow-sm border border-border font-medium text-foreground'
      : 'text-muted-foreground hover:bg-sidebar-accent/50'
  }`;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AppSidebar({
  activeView,
  onSelectView,
  sessions,
  activeSessionId,
  searchQuery,
  onSearchQueryChange,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  onForkSession,
  onExportSession,
  projects,
  workspacesByProject,
  selectedWorkspaceId,
  onSelectWorkspace,
  onAddProject,
  sidebarOpen = true,
  onToggleSidebar,
  email,
  plan,
  onOpenSettings,
}: AppSidebarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  const focusSessionSearch = useCallback(() => {
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const handleSearch = useCallback(() => {
    onSelectView('chat');
    focusSessionSearch();
  }, [onSelectView, focusSessionSearch]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        return;
      }

      if (event.defaultPrevented) return;

      event.preventDefault();
      handleSearch();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSearch]);
  const initial = email ? email.charAt(0).toUpperCase() : '?';
  const displayName = email ?? 'User';

  // Session results are already filtered by the backend query (`/api/sessions?q=...`),
  // so we render them directly here to preserve content-based matches from messages.
  const filteredSessions = sessions;

  // Collapsed strip — icon-only nav
  if (!sidebarOpen) {
    return (
      <aside className="w-14 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-full items-center py-3 gap-2">
        <button
          title="Expand sidebar"
          onClick={onToggleSidebar}
          className="rounded-md p-2 hover:bg-sidebar-accent/50 transition-colors text-muted-foreground"
        >
          <SidebarSimple className="h-[18px] w-[18px]" />
        </button>
        <button
          title="New Chat"
          onClick={onNewChat}
          className="rounded-md p-2 bg-card shadow-sm border border-border text-foreground transition-colors"
        >
          <Plus className="h-[18px] w-[18px]" />
        </button>
        <button
          title="Search"
          onClick={handleSearch}
          className="rounded-md p-2 hover:bg-sidebar-accent/50 transition-colors text-muted-foreground"
        >
          <MagnifyingGlass className="h-[18px] w-[18px]" />
        </button>
        {navItems.map((item) => (
          <button
            key={item.view}
            title={item.label}
            onClick={() => onSelectView(item.view)}
            className={`rounded-md p-2 transition-colors ${
              activeView === item.view
                ? 'bg-card shadow-sm border border-border text-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/50'
            }`}
          >
            <item.icon className="h-[18px] w-[18px]" />
          </button>
        ))}
        <div className="flex-1" />
        <button
          title="Settings"
          onClick={onOpenSettings}
          className="rounded-md p-2 hover:bg-sidebar-accent/50 transition-colors text-muted-foreground"
        >
          <Gear className="h-[18px] w-[18px]" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[260px] flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      {/* Header */}
      <div className="h-14 flex items-center px-4 gap-4 text-muted-foreground">
        <button
          title="Toggle sidebar"
          onClick={onToggleSidebar}
          className="rounded-md p-1 hover:bg-sidebar-accent/50 transition-colors"
        >
          <SidebarSimple className="h-[18px] w-[18px]" />
        </button>
        <div className="flex items-center gap-2">
          <button className="opacity-50 rounded-md p-1 hover:bg-sidebar-accent/50 transition-colors">
            <CaretLeft className="h-4 w-4" />
          </button>
          <button className="opacity-50 rounded-md p-1 hover:bg-sidebar-accent/50 transition-colors">
            <CaretRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1 min-h-0 overflow-hidden">
        <div className="py-2 flex flex-col gap-6 px-3">
          {/* Primary nav links */}
          <nav className="flex flex-col gap-0.5">
            {/* New Chat — always styled as primary action */}
            <button
              onClick={onNewChat}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card shadow-sm border border-border font-medium text-foreground w-full text-left transition-colors hover:shadow"
            >
              <Plus className="h-[18px] w-[18px]" /> New Chat
            </button>
            {/* Search */}
            <button onClick={handleSearch} className={navItemClass(false)}>
              <MagnifyingGlass className="h-[18px] w-[18px]" /> Search
            </button>
            {/* View nav items */}
            {navItems.map((item) => (
              <button
                key={item.view}
                onClick={() => onSelectView(item.view)}
                className={navItemClass(activeView === item.view)}
              >
                <item.icon className="h-[18px] w-[18px]" /> {item.label}
              </button>
            ))}
          </nav>

          {/* Recents — shown when in chat view */}
          {activeView === 'chat' && (
            <div className="flex flex-col gap-1">
              <div className="px-3 py-1 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                  Recents
                </span>
              </div>
              {/* Inline search */}
              <div className="px-2">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  placeholder="Filter conversations..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              {filteredSessions.length > 0 ? (
                groupSessionsByDate(filteredSessions).map(({ bucket, sessions: groupSessions }) => (
                  <div key={bucket}>
                    <div className="px-3 pt-3 pb-1 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wide">
                      {bucket}
                    </div>
                    {groupSessions.map((session) => (
                      <SessionItem
                        key={session.id}
                        session={session}
                        isActive={session.id === activeSessionId}
                        onSelect={() => onSelectSession(session.id)}
                        onDelete={onDeleteSession ? () => onDeleteSession(session.id) : undefined}
                        onRename={onRenameSession ? (title) => onRenameSession(session.id, title) : undefined}
                        onFork={onForkSession ? () => onForkSession(session.id) : undefined}
                        onExport={onExportSession ? (format) => onExportSession(session.id, format) : undefined}
                      />
                    ))}
                  </div>
                ))
              ) : searchQuery ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No sessions match &ldquo;{searchQuery}&rdquo;
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 px-4 text-center text-muted-foreground">
                  <ChatCircle className="h-6 w-6 mb-2 opacity-40" />
                  <p className="text-sm font-medium mb-0.5">No conversations yet</p>
                  <p className="text-xs opacity-70">Start a conversation with Claude</p>
                </div>
              )}
            </div>
          )}

          {/* Projects — shown when in workspaces view */}
          {activeView === 'workspaces' && (
            <ProjectsSection
              projects={projects}
              workspacesByProject={workspacesByProject}
              selectedWorkspaceId={selectedWorkspaceId}
              onSelectWorkspace={onSelectWorkspace}
              onAddProject={onAddProject}
            />
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border">
        <div
          className="flex items-center gap-3 px-2 py-1 rounded-xl hover:bg-sidebar-accent/50 transition-colors cursor-pointer"
          onClick={onOpenSettings}
        >
          <div className="relative">
            <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center font-medium text-xs">
              {initial}
            </div>
            <div className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 border-2 border-sidebar rounded-full" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{displayName}</p>
          </div>
          <button onClick={onOpenSettings} className="rounded-md p-1 hover:bg-sidebar-accent/50 transition-colors">
            <Gear className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  SessionItem — per-session row with context menu                    */
/* ------------------------------------------------------------------ */

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
  onDelete?: () => void;
  onRename?: (title: string) => void;
  onFork?: () => void;
  onExport?: (format: string) => void;
}) {
  const [hovering, setHovering] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(session.title || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
    if (trimmed && trimmed !== session.title && onRename) {
      onRename(trimmed);
    }
    setIsRenaming(false);
    setRenameValue(session.title || '');
  };

  const handleRenameCancel = () => {
    setIsRenaming(false);
    setRenameValue(session.title || '');
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
        setRenameValue(session.title || '');
        setIsRenaming(true);
        break;
      case 'fork':
        setMenuOpen(false);
        onFork?.();
        break;
      case 'export-json':
        setMenuOpen(false);
        onExport?.('json');
        break;
      case 'export-md':
        setMenuOpen(false);
        onExport?.('md');
        break;
      case 'delete':
        setMenuOpen(false);
        setConfirmDelete(true);
        break;
      case 'confirm-delete':
        setConfirmDelete(false);
        onDelete?.();
        break;
      case 'cancel-delete':
        setConfirmDelete(false);
        break;
    }
  };

  return (
    <div
      data-testid={`session-item-${session.id}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={`px-3 py-1.5 rounded-lg text-sm w-full text-left transition-colors relative ${
        isActive
          ? 'bg-white shadow-sm border border-black/5 font-medium text-foreground'
          : 'text-muted-foreground hover:bg-sidebar-accent/50'
      }`}
    >
      {confirmDelete ? (
        <div
          data-testid="inline-delete-confirmation"
          className="flex items-center justify-between w-full gap-2"
        >
          <span className="text-xs text-muted-foreground truncate">
            Delete &ldquo;{session.title || 'New Chat'}&rdquo;?
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
                data-testid="rename-input"
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
                onClick={onSelect}
                className="truncate block flex-1 text-left"
              >
                {session.title || 'New Chat'}
              </button>
            )}
            {(hovering || menuOpen) && !isRenaming && (
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
          {session.profile && (
            <div className="mt-0.5">
              <ProfileBadge profile={session.profile} />
            </div>
          )}

          {/* Context menu dropdown */}
          {menuOpen && (
            <div
              ref={menuRef}
              data-testid="session-context-menu"
              className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                role="button"
                tabIndex={0}
                data-testid="menu-rename"
                onClick={() => handleMenuAction('rename')}
                onKeyDown={(e) => { if (e.key === 'Enter') handleMenuAction('rename'); }}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
              >
                Rename
              </div>
              <div
                role="button"
                tabIndex={0}
                data-testid="menu-fork"
                onClick={() => handleMenuAction('fork')}
                onKeyDown={(e) => { if (e.key === 'Enter') handleMenuAction('fork'); }}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
              >
                Fork
              </div>
              <div
                role="button"
                tabIndex={0}
                data-testid="menu-export-json"
                onClick={() => handleMenuAction('export-json')}
                onKeyDown={(e) => { if (e.key === 'Enter') handleMenuAction('export-json'); }}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
              >
                Export JSON
              </div>
              <div
                role="button"
                tabIndex={0}
                data-testid="menu-export-md"
                onClick={() => handleMenuAction('export-md')}
                onKeyDown={(e) => { if (e.key === 'Enter') handleMenuAction('export-md'); }}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
              >
                Export Markdown
              </div>
              <hr className="my-1 border-border" />
              <div
                role="button"
                tabIndex={0}
                data-testid="menu-delete"
                onClick={() => handleMenuAction('delete')}
                onKeyDown={(e) => { if (e.key === 'Enter') handleMenuAction('delete'); }}
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

/* ------------------------------------------------------------------ */
/*  Projects Section (inline simplified version of ProjectSidebar)     */
/* ------------------------------------------------------------------ */

function ProjectsSection({
  projects,
  workspacesByProject,
  selectedWorkspaceId,
  onSelectWorkspace,
  onAddProject,
}: {
  projects: Project[];
  workspacesByProject: Record<string, Workspace[]>;
  selectedWorkspaceId: string | null;
  onSelectWorkspace: (ws: Workspace) => void;
  onAddProject: () => void;
}) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    () => new Set(projects.map((p) => p.id)),
  );

  const toggleProject = (id: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="px-3 py-1 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
          Projects
        </span>
        <button
          onClick={onAddProject}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
          title="Add project"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center px-3 py-6 text-center">
          <FolderOpen className="h-6 w-6 text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-foreground mb-0.5">No projects yet</p>
          <p className="text-xs text-muted-foreground mb-3">
            Add a project to start working with git worktrees
          </p>
          <button
            onClick={onAddProject}
            className="rounded px-3 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            Add Project
          </button>
        </div>
      ) : (
        projects.map((project) => {
          const expanded = expandedProjects.has(project.id);
          const workspaces = workspacesByProject[project.id] || [];

          return (
            <div key={project.id}>
              {/* Project header */}
              <button
                onClick={() => toggleProject(project.id)}
                className="flex items-center gap-1.5 w-full px-3 py-1.5 rounded-lg text-left hover:bg-sidebar-accent/50 transition-colors"
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
                  className={`shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className="min-w-0 text-sm font-medium text-foreground truncate">
                  {getProjectDisplayName(project)}
                </span>
              </button>

              {/* Workspace list */}
              {expanded && (
                <div className="ml-5 space-y-0.5 mt-0.5">
                  {workspaces.length === 0 && (
                    <p className="px-3 py-1 text-xs text-muted-foreground">No workspaces</p>
                  )}
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => onSelectWorkspace(ws)}
                      className={`w-full rounded-lg px-3 py-1.5 text-left transition-colors ${
                        ws.id === selectedWorkspaceId
                          ? 'bg-card shadow-sm border border-border font-medium text-foreground'
                          : 'text-muted-foreground hover:bg-sidebar-accent/50'
                      }`}
                    >
                      <span className="text-sm truncate block">{ws.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground truncate block mt-0.5">
                        {ws.branch}
                      </span>
                      <div className="mt-0.5">
                        <WorkspaceStatusBadge status={ws.status} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
