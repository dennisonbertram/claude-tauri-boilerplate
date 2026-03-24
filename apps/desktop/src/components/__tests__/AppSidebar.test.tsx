import { useState } from 'react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Project, Session, Workspace } from '@claude-tauri/shared';
import { AppSidebar } from '../AppSidebar';

vi.mock('@phosphor-icons/react', () => {
  const Icon = (props: Record<string, unknown>) => <svg data-testid="icon" {...props} />;
  return {
    ChatCircle: Icon,
    FileText: Icon,
    FolderOpen: Icon,
    UsersThree: Icon,
    Robot: Icon,
    Plus: Icon,
    Gear: Icon,
    SidebarSimple: Icon,
    CaretLeft: Icon,
    CaretRight: Icon,
    MagnifyingGlass: Icon,
  };
});

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    title: 'Daily standup',
    createdAt: '2026-03-22T12:00:00.000Z',
    updatedAt: '2026-03-22T12:00:00.000Z',
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    name: 'Agent Wallet',
    repoPath: '/tmp/agent-wallet',
    repoPathCanonical: '/tmp/agent-wallet',
    defaultBranch: 'main',
    isDeleted: false,
    createdAt: '2026-03-22T12:00:00.000Z',
    updatedAt: '2026-03-22T12:00:00.000Z',
    ...overrides,
  };
}

function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'workspace-1',
    projectId: 'project-1',
    name: 'feature-auth',
    branch: 'workspace/feature-auth',
    worktreePath: '/tmp/workspace-1',
    worktreePathCanonical: '/tmp/workspace-1',
    baseBranch: 'main',
    status: 'ready',
    additionalDirectories: [],
    createdAt: '2026-03-22T12:00:00.000Z',
    updatedAt: '2026-03-22T12:00:00.000Z',
    ...overrides,
  };
}

function renderSidebar(overrides: Partial<ComponentProps<typeof AppSidebar>> = {}) {
  const props: ComponentProps<typeof AppSidebar> = {
    activeView: 'chat',
    onSelectView: vi.fn(),
    sessions: [],
    activeSessionId: null,
    searchQuery: '',
    onSearchQueryChange: vi.fn(),
    onSelectSession: vi.fn(),
    onNewChat: vi.fn(),
    projects: [],
    workspacesByProject: {},
    selectedWorkspaceId: null,
    onSelectWorkspace: vi.fn(),
    onAddProject: vi.fn(),
    sidebarOpen: true,
    onToggleSidebar: vi.fn(),
    email: 'qa@example.com',
    plan: 'pro',
    onOpenSettings: vi.fn(),
    ...overrides,
  };

  return { ...render(<AppSidebar {...props} />), props };
}

function renderSidebarWithControlledView() {
  function ControlledSidebar() {
    const [activeView, setActiveView] = useState<'chat' | 'workspaces' | 'teams' | 'agents' | 'documents' | 'tracker'>('workspaces');
    return (
      <AppSidebar
        activeView={activeView}
        onSelectView={setActiveView}
        sessions={[]}
        activeSessionId={null}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        onSelectSession={vi.fn()}
        onNewChat={vi.fn()}
        projects={[]}
        workspacesByProject={{}}
        selectedWorkspaceId={null}
        onSelectWorkspace={vi.fn()}
        onAddProject={vi.fn()}
        sidebarOpen
        onToggleSidebar={vi.fn()}
        email="qa@example.com"
        plan="pro"
        onOpenSettings={vi.fn()}
      />
    );
  }

  return render(<ControlledSidebar />);
}

describe('AppSidebar', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.setSystemTime(new Date('2026-03-22T12:00:00.000Z'));
  });

  it('groups recent sessions by date bucket', async () => {
    const sessions = [
      makeSession({ id: 'today', title: 'Today note', createdAt: '2026-03-22T10:00:00.000Z' }),
      makeSession({ id: 'yesterday', title: 'Yesterday note', createdAt: '2026-03-21T10:00:00.000Z' }),
      makeSession({ id: 'week', title: 'Week note', createdAt: '2026-03-18T10:00:00.000Z' }),
      makeSession({ id: 'lastWeek', title: 'Last week note', createdAt: '2026-03-12T10:00:00.000Z' }),
      makeSession({ id: 'older', title: 'Archive note', createdAt: '2026-02-10T10:00:00.000Z' }),
    ];

    renderSidebar({ sessions });

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Today note')).toBeInTheDocument();
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
  });

  it('does not do client-side title-only filtering for search queries', () => {
    const sessions = [
      makeSession({ id: 'backendFiltered', title: 'Server matched session', createdAt: '2026-03-22T10:00:00.000Z' }),
      makeSession({ id: 'other', title: 'Database notes', createdAt: '2026-03-21T10:00:00.000Z' }),
    ];

    renderSidebar({ sessions, searchQuery: 'react' });

    expect(screen.getByText('Server matched session')).toBeInTheDocument();
    expect(screen.getByText('Database notes')).toBeInTheDocument();
  });

  it('shows empty state when backend returns no matches', () => {
    renderSidebar({ sessions: [], searchQuery: 'missing' });

    expect(screen.getByText('No sessions match “missing”')).toBeInTheDocument();
  });

  it('groups sessions into Last Week and month buckets', () => {
    const sessions = [
      makeSession({ id: 'marchThisMonth', title: 'March summary', createdAt: '2026-03-01T09:00:00.000Z' }),
      makeSession({ id: 'dec2025', title: 'December summary', createdAt: '2025-12-10T09:00:00.000Z' }),
      makeSession({ id: 'nov2025', title: 'November summary', createdAt: '2025-11-20T09:00:00.000Z' }),
      makeSession({ id: 'jan2026', title: 'January summary', createdAt: '2026-01-20T09:00:00.000Z' }),
      makeSession({ id: 'lastWeek', title: 'Last week summary', createdAt: '2026-03-12T09:00:00.000Z' }),
    ];

    renderSidebar({ sessions });

    expect(screen.getByText('Last Week')).toBeInTheDocument();
    expect(screen.getByText('This Month')).toBeInTheDocument();
    expect(screen.getByText('November 2025')).toBeInTheDocument();
    expect(screen.getByText('December 2025')).toBeInTheDocument();
    expect(screen.getByText('March summary')).toBeInTheDocument();
  });

  it('switches to chat search', () => {
    const onSelectView = vi.fn();
    renderSidebar({ onSelectView, activeView: 'workspaces' });

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(onSelectView).toHaveBeenCalledWith('chat');
  });

  it('renders the collapsed strip and forwards actions', () => {
    const onNewChat = vi.fn();
    const onToggleSidebar = vi.fn();
    const onOpenSettings = vi.fn();
    const onSelectView = vi.fn();

    renderSidebar({
      sidebarOpen: false,
      onNewChat,
      onToggleSidebar,
      onOpenSettings,
      onSelectView,
      activeView: 'agents',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    fireEvent.click(screen.getByRole('button', { name: 'New Chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));

    expect(onToggleSidebar).toHaveBeenCalled();
    expect(onNewChat).toHaveBeenCalled();
    expect(onOpenSettings).toHaveBeenCalled();
    expect(onSelectView).toHaveBeenCalledWith('workspaces');
  });

  it('renders workspace projects, toggles expansion, and selects a workspace', () => {
    const project = makeProject();
    const workspace = makeWorkspace();
    const onAddProject = vi.fn();
    const onSelectWorkspace = vi.fn();

    renderSidebar({
      activeView: 'workspaces',
      projects: [project],
      workspacesByProject: { [project.id]: [workspace] },
      selectedWorkspaceId: workspace.id,
      onAddProject,
      onSelectWorkspace,
    });

    expect(screen.getAllByText('Projects').length).toBeGreaterThan(0);
    expect(screen.getByText('feature-auth')).toBeInTheDocument();
    expect(screen.getByText('workspace/feature-auth')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add project' }));
    expect(onAddProject).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Agent Wallet'));
    expect(screen.queryByText('feature-auth')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Agent Wallet'));
    fireEvent.click(screen.getByRole('button', { name: /feature-auth/i }));
    expect(onSelectWorkspace).toHaveBeenCalledWith(workspace);
  });

  it('renders the empty project state and settings footer', () => {
    const onAddProject = vi.fn();
    const onOpenSettings = vi.fn();

    renderSidebar({
      activeView: 'workspaces',
      projects: [],
      onAddProject,
      onOpenSettings,
      email: 'owner@example.com',
    });

    expect(screen.getByText('No projects yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Project' }));
    expect(onAddProject).toHaveBeenCalled();

    fireEvent.click(screen.getByText('owner@example.com'));
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('focuses session search with Cmd+K shortcut', async () => {
    renderSidebarWithControlledView();

    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Filter conversations...')).toHaveFocus();
    });
  });

  it('prevents window-level shortcuts from handling Cmd+K', async () => {
    const interceptedWindowShortcut = vi.fn();
    const intercept = (event: KeyboardEvent) => {
      interceptedWindowShortcut();
      event.preventDefault();
    };
    window.addEventListener('keydown', intercept);

    try {
      renderSidebarWithControlledView();

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Filter conversations...')).toHaveFocus();
      });

      expect(interceptedWindowShortcut).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', intercept);
    }
  });
});
