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
  useTheme: vi.fn(),
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
}));

vi.mock('@/components/sessions/SessionSidebar', () => ({
  SessionSidebar: ({ sessions, onNewChat, onSelectSession, activeSessionId }: {
    sessions: Session[];
    onNewChat: () => void;
    onSelectSession: (id: string) => void;
    activeSessionId: string | null;
  }) => (
    <div>
      <button onClick={onNewChat}>New Chat</button>
      {sessions.map((session) => (
        <button key={session.id} onClick={() => onSelectSession(session.id)}>
          Select {session.id}
        </button>
      ))}
      <div data-testid="active-session-id">{activeSessionId ?? 'null'}</div>
    </div>
  ),
}));

vi.mock('@/components/chat/ChatPage', () => ({
  ChatPage: () => <div data-testid="chat-page-placeholder" />,
}));

vi.mock('@/components/chat/WelcomeScreen', () => ({
  WelcomeScreen: () => <div data-testid="welcome-screen-placeholder" />,
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
    }),
    createSession,
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

  it('keeps New Chat as a no-op after selecting an empty session', async () => {
    mockSessions.setSessions([
      {
        id: 'existing-with-messages',
        title: 'Existing Chat',
        claudeSessionId: undefined,
        messageCount: 3,
        createdAt: '2026-03-16T10:00:00.000Z',
        updatedAt: '2026-03-16T10:00:00.000Z',
      },
      {
        id: 'empty-session',
        title: 'Empty Chat',
        claudeSessionId: undefined,
        messageCount: 0,
        createdAt: '2026-03-16T10:00:00.000Z',
        updatedAt: '2026-03-16T10:00:00.000Z',
      },
    ]);
    mockSessions.setActiveSessionIdValue('existing-with-messages');
    useSessionsMock.mockReturnValue(mockSessions.getSessionHookValue());

    const { rerender } = render(<App />);
    expect(screen.getByTestId('active-session-id')).toHaveTextContent('existing-with-messages');

    fireEvent.click(screen.getByText('Select empty-session'));
    mockSessions.setActiveSessionIdValue('empty-session');
    useSessionsMock.mockReturnValue(mockSessions.getSessionHookValue());
    rerender(<App />);

    fireEvent.click(screen.getByText('New Chat'));
    expect(mockSessions.createSession).not.toHaveBeenCalled();
  });

  it('creates a new session when selecting a session with messages', async () => {
    mockSessions.setSessions([
      {
        id: 'session-with-messages',
        title: 'Has Messages',
        claudeSessionId: undefined,
        messageCount: 1,
        createdAt: '2026-03-16T10:00:00.000Z',
        updatedAt: '2026-03-16T10:00:00.000Z',
      },
      {
        id: 'empty-session',
        title: 'Empty Chat',
        claudeSessionId: undefined,
        messageCount: 0,
        createdAt: '2026-03-16T10:00:00.000Z',
        updatedAt: '2026-03-16T10:00:00.000Z',
      },
    ]);
    mockSessions.setActiveSessionIdValue('empty-session');
    useSessionsMock.mockReturnValue(mockSessions.getSessionHookValue());

    const { rerender } = render(<App />);
    expect(screen.getByTestId('active-session-id')).toHaveTextContent('empty-session');

    fireEvent.click(screen.getByText('Select session-with-messages'));
    mockSessions.setActiveSessionIdValue('session-with-messages');
    useSessionsMock.mockReturnValue(mockSessions.getSessionHookValue());
    rerender(<App />);

    fireEvent.click(screen.getByText('New Chat'));
    expect(mockSessions.createSession).toHaveBeenCalledTimes(1);
  });
});
