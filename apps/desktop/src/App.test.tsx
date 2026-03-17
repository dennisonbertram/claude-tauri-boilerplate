import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import App from './App';

vi.mock('./lib/platform', () => ({
  isTauri: vi.fn(() => false),
}));

vi.mock('./hooks/useTheme', () => ({
  useTheme: vi.fn(),
}));

vi.mock('./hooks/useSessions', () => ({
  useSessions: vi.fn(() => ({
    sessions: [],
    activeSessionId: null,
    setActiveSessionId: vi.fn(),
    createSession: vi.fn(),
    deleteSession: vi.fn(),
    renameSession: vi.fn(),
    forkSession: vi.fn(),
    exportSession: vi.fn(),
    autoNameSession: vi.fn(),
  })),
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
  SessionSidebar: () => <div data-testid="session-sidebar-placeholder" />,
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

describe('App', () => {
  it('mounts a global toaster for command feedback', () => {
    render(<App />);
    expect(screen.getByTestId('app-toaster')).toBeInTheDocument();
  });
});
