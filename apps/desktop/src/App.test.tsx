import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import App from './App';
import { useSessions } from './hooks/useSessions';
import type { Session } from '@claude-tauri/shared';

vi.mock('./lib/platform', () => ({
  isTauri: vi.fn(() => false),
}));

vi.mock('./hooks/useTheme', () => ({
  useTheme: vi.fn(() => ({ effectiveTheme: 'light' })),
}));

vi.mock('./hooks/useSessions', () => ({
  useSessions: vi.fn(),
}));

vi.mock('./hooks/useProjects', () => ({
  useProjects: vi.fn(() => ({
    projects: [],
    addProject: vi.fn(),
    removeProject: vi.fn(),
  })),
}));

vi.mock('./hooks/useWorkspaces', () => ({
  useWorkspaces: vi.fn(() => ({
    workspaces: [],
    addWorkspace: vi.fn(),
    refresh: vi.fn(),
  })),
}));

vi.mock('@/components/auth/AuthGate', () => ({
  AuthGate: ({ children }: { children: (auth: { email: string; plan: string }) => React.JSX.Element }) =>
    children({ email: 'qa@example.com', plan: 'pro' }),
}));

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/contexts/SettingsContext', () => ({
  SettingsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSettingsContext: vi.fn(() => ({
    settings: {
      workspaceBranchPrefix: 'codex/',
    },
  })),
}));

vi.mock('@/components/AppSidebar', () => ({
  AppSidebar: ({
    sessions,
    activeSessionId,
    onNewChat,
    onSelectSession,
    onOpenSettings,
  }: {
    sessions: Session[];
    activeSessionId: string | null;
    onNewChat: () => void;
    onSelectSession: (id: string) => void;
    onOpenSettings: () => void;
  }) => (
    <div>
      <button onClick={onNewChat}>New Chat</button>
      {sessions.map((session) => (
        <button key={session.id} onClick={() => onSelectSession(session.id)}>
          Select {session.id}
        </button>
      ))}
      <button onClick={onOpenSettings}>Open Settings</button>
      <div data-testid="active-session-id">{activeSessionId ?? 'null'}</div>
    </div>
  ),
}));

let latestChatPageProps: Record<string, unknown> | null = null;
vi.mock('@/components/chat/ChatPage', () => ({
  ChatPage: (props: Record<string, unknown>) => {
    latestChatPageProps = props;
    return (
      <div>
        <div data-testid="chat-page-placeholder" />
        <button
          type="button"
          onClick={() => (props.onSessionInitialized as ((id: string) => void) | undefined)?.('session-from-stream')}
        >
          session init
        </button>
        <button
          type="button"
          onClick={() => (props.onInitialMessageConsumed as (() => void) | undefined)?.()}
        >
          initial consumed
        </button>
      </div>
    );
  },
}));

let latestWelcomeSubmit: ((message: string) => void) | null = null;
vi.mock('@/components/chat/WelcomeScreen', () => ({
  WelcomeScreen: ({ onSubmit, onNewChat }: { onSubmit?: (message: string) => void; onNewChat: () => void }) => {
    latestWelcomeSubmit = onSubmit ?? null;
    return (
      <div>
        <button type="button" onClick={onNewChat}>new chat</button>
        <button type="button" data-testid="welcome-submit" onClick={() => onSubmit?.('Build an app')}>Submit</button>
      </div>
    );
  },
}));

vi.mock('@/components/settings/SettingsPanel', () => ({
  SettingsPanel: () => <div data-testid="settings-panel-placeholder" />,
}));

vi.mock('@/components/teams/TeamsView', () => ({
  TeamsView: () => <div data-testid="teams-view-placeholder" />,
}));

vi.mock('@/components/workspaces/ProjectSidebar', () => ({
  ProjectSidebar: () => <div data-testid="project-sidebar-placeholder" />,
}));

vi.mock('@/components/workspaces/WorkspacePanel', () => ({
  WorkspacePanel: () => <div data-testid="workspace-panel-placeholder" />,
}));

vi.mock('@/components/workspaces/AddProjectDialog', () => ({
  AddProjectDialog: () => null,
}));

vi.mock('@/components/workspaces/CreateWorkspaceDialog', () => ({
  CreateWorkspaceDialog: () => null,
}));

vi.mock('@/components/StatusBar', () => ({
  StatusBar: () => <div data-testid="status-bar-placeholder" />,
}));

vi.mock('sonner', () => ({
  Toaster: () => <div data-testid="app-toaster" />,
  toast: {
    info: vi.fn(),
  },
}));

const makeUseSessionsMock = () => {
  let sessions: Session[] = [];
  let activeSessionId: string | null = null;
  const setActiveSessionId = vi.fn((nextId: string | null) => {
    activeSessionId = nextId;
  });
  const fetchSessions = vi.fn().mockResolvedValue(undefined);
  const createSession = vi.fn().mockResolvedValue({
    id: 'new-session',
    title: 'New Chat',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Session);
  return {
    getState: () => ({ sessions, activeSessionId }),
    setActiveSessionId,
    setSessions: (next: Session[]) => {
      sessions = next;
    },
    setActiveSessionIdValue: (next: string | null) => {
      activeSessionId = next;
    },
    getSessionHookValue: () => ({
      sessions,
      activeSessionId,
      setActiveSessionId,
      createSession,
      deleteSession: vi.fn(),
      renameSession: vi.fn(),
      forkSession: vi.fn(),
      exportSession: vi.fn(),
      autoNameSession: vi.fn(),
      fetchMessages: vi.fn(),
      fetchSessions,
    } as unknown as ReturnType<typeof useSessions>),
    createSession,
    fetchSessions,
  };
};

describe('App', () => {
  let mockSessions: ReturnType<typeof makeUseSessionsMock>;
  const useSessionsMock = vi.mocked(useSessions);

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessions = makeUseSessionsMock();
    useSessionsMock.mockReturnValue(mockSessions.getSessionHookValue());
  });

  it('does not create a new session when submitting from the welcome screen', async () => {
    latestChatPageProps = null;
    latestWelcomeSubmit = null;
    mockSessions.setSessions([
      {
        id: 'starter',
        title: 'Starter Chat',
        claudeSessionId: undefined,
        messageCount: 0,
        createdAt: '2026-03-16T10:00:00.000Z',
        updatedAt: '2026-03-16T10:00:00.000Z',
      },
    ]);
    mockSessions.setActiveSessionIdValue(null);
    useSessionsMock.mockReturnValue(mockSessions.getSessionHookValue());

    render(<App />);
    expect(latestWelcomeSubmit).toBeInstanceOf(Function);
    fireEvent.click(screen.getByTestId('welcome-submit'));

    expect(mockSessions.createSession).not.toHaveBeenCalled();
    expect(screen.getByTestId('chat-page-placeholder')).toBeInTheDocument();
    expect(latestChatPageProps?.['initialMessage']).toBe('Build an app');
  });

  it('keeps ChatPage mounted with stable key after session:init (no premature remount)', () => {
    mockSessions.setSessions([]);
    mockSessions.setActiveSessionIdValue(null);
    useSessionsMock.mockReturnValue(mockSessions.getSessionHookValue());

    render(<App />);
    fireEvent.click(screen.getByTestId('welcome-submit'));
    // Simulate the server responding with session:init (containing appSessionId).
    // The key should stay 'new-chat' — we do NOT set activeSessionId during
    // the welcome flow to avoid remounting ChatPage and losing streamed messages.
    fireEvent.click(screen.getByText('session init'));

    expect(mockSessions.createSession).not.toHaveBeenCalled();
    // activeSessionId is NOT set — ChatPage stays mounted with key='new-chat'
    expect(mockSessions.setActiveSessionId).not.toHaveBeenCalled();
    // But sessions are refreshed so the new session appears in sidebar
    expect(mockSessions.fetchSessions).toHaveBeenCalledTimes(1);
    // ChatPage should still be mounted
    expect(screen.getByTestId('chat-page-placeholder')).toBeInTheDocument();
  });

  // --- Regression tests for welcome-screen submit race condition ---
  // See: docs/investigations/welcome-screen-submit-bug.md
  // Bug: pendingMessage was cleared before the server responded with a session ID,
  // causing ChatPage to unmount and the user to bounce back to the welcome screen.

  it('regression: ChatPage stays mounted while waiting for session:init', () => {
    mockSessions.setSessions([]);
    mockSessions.setActiveSessionIdValue(null);
    useSessionsMock.mockReturnValue(mockSessions.getSessionHookValue());

    render(<App />);
    fireEvent.click(screen.getByTestId('welcome-submit'));

    // ChatPage should be mounted because pendingMessage is set
    expect(screen.getByTestId('chat-page-placeholder')).toBeInTheDocument();

    // activeSessionId should still be null (server hasn't responded yet)
    expect(mockSessions.setActiveSessionId).not.toHaveBeenCalled();

    // ChatPage should still have the initialMessage prop
    expect(latestChatPageProps?.['initialMessage']).toBe('Build an app');
  });

  it('regression: onInitialMessageConsumed does not prematurely clear pendingMessage', () => {
    mockSessions.setSessions([]);
    mockSessions.setActiveSessionIdValue(null);
    useSessionsMock.mockReturnValue(mockSessions.getSessionHookValue());

    render(<App />);
    fireEvent.click(screen.getByTestId('welcome-submit'));

    // Even if onInitialMessageConsumed is called before session:init,
    // it should be a no-op — ChatPage should remain mounted
    fireEvent.click(screen.getByText('initial consumed'));

    // ChatPage should still be visible (pendingMessage not prematurely cleared
    // causing unmount; or activeSessionId already set)
    // The key test: setActiveSessionId should NOT have been called yet
    // since no session:init has fired
    expect(mockSessions.setActiveSessionId).not.toHaveBeenCalled();
  });

  it('regression: second session:init does not override the first', () => {
    mockSessions.setSessions([]);
    mockSessions.setActiveSessionIdValue(null);
    useSessionsMock.mockReturnValue(mockSessions.getSessionHookValue());

    render(<App />);
    fireEvent.click(screen.getByTestId('welcome-submit'));
    fireEvent.click(screen.getByText('session init'));

    // fetchSessions called once for the first session init
    expect(mockSessions.fetchSessions).toHaveBeenCalledTimes(1);
    mockSessions.fetchSessions.mockClear();

    // Second session:init should be ignored (pendingWelcomeSessionId already set)
    fireEvent.click(screen.getByText('session init'));
    // fetchSessions should not be called again — the session was already registered
    expect(mockSessions.fetchSessions).not.toHaveBeenCalled();
  });
});
