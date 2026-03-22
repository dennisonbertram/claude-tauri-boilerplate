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
  AuthGate: ({ children }: { children: (auth: { email: string; plan: string }) => JSX.Element }) =>
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
          onClick={() => props.onSessionInitialized?.('session-from-stream')}
        >
          session init
        </button>
        <button
          type="button"
          onClick={() => props.onInitialMessageConsumed?.()}
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
      fetchSessions,
    }),
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
    expect(latestChatPageProps?.initialMessage).toBe('Build an app');
  });

  it('activates the first session id received from session:init after welcome submit', () => {
    mockSessions.setSessions([]);
    mockSessions.setActiveSessionIdValue(null);
    useSessionsMock.mockReturnValue(mockSessions.getSessionHookValue());

    render(<App />);
    fireEvent.click(screen.getByTestId('welcome-submit'));
    fireEvent.click(screen.getByText('session init'));
    fireEvent.click(screen.getByText('initial consumed'));

    expect(mockSessions.createSession).not.toHaveBeenCalled();
    expect(mockSessions.setActiveSessionId).toHaveBeenCalledWith('session-from-stream');
    expect(mockSessions.fetchSessions).toHaveBeenCalledTimes(1);
  });
});
