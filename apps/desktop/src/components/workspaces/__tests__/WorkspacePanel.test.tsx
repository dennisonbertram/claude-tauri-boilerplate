import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Workspace } from '@claude-tauri/shared';

const mockRenameWorkspace = vi.hoisted(() => vi.fn());
const mockGetWorkspaceSession = vi.hoisted(() => vi.fn());
const mockChatPage = vi.hoisted(() => vi.fn());

vi.mock('@/lib/workspace-api', () => ({
  renameWorkspace: mockRenameWorkspace,
  getWorkspaceSession: mockGetWorkspaceSession,
  mergeWorkspace: vi.fn(),
  discardWorkspace: vi.fn(),
  fetchWorkspaceDiff: vi.fn(),
  fetchWorkspaceRevisions: vi.fn(),
  fetchChangedFiles: vi.fn(),
  fetchWorkspaceStatus: vi.fn(),
}));

vi.mock('@/components/chat/ChatPage', () => ({
  ChatPage: mockChatPage,
}));

vi.mock('@/components/workspaces/WorkspaceDiffView', () => ({
  WorkspaceDiffView: () => <div data-testid="workspace-diff-view" />,
}));

vi.mock('@/components/workspaces/WorkspaceMergeDialog', () => ({
  WorkspaceMergeDialog: () => null,
}));

import { WorkspacePanel } from '../WorkspacePanel';

function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'ws-1',
    projectId: 'proj-1',
    name: 'feature-multi',
    branch: 'workspace/feature-multi',
    worktreePath: '/tmp/worktrees/ws-1',
    worktreePathCanonical: '/tmp/worktrees/ws-1',
    baseBranch: 'main',
    status: 'ready',
    additionalDirectories: ['/repo-a'],
    createdAt: '2026-03-17T00:00:00.000Z',
    updatedAt: '2026-03-17T00:00:00.000Z',
    ...overrides,
  };
}

describe('WorkspacePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorkspaceSession.mockResolvedValue(null);
    mockRenameWorkspace.mockImplementation(async (_id: string, updates: any) => ({
      ...makeWorkspace(),
      additionalDirectories: updates.additionalDirectories ?? ['/repo-a'],
    }));
  });

  it('passes additional directories to ChatPage', async () => {
    render(<WorkspacePanel workspace={makeWorkspace({ additionalDirectories: ['/repo-a', '/repo-b'] })} />);

    await waitFor(() => {
      expect(mockChatPage).toHaveBeenCalledWith(
        expect.objectContaining({
          additionalDirectories: ['/repo-a', '/repo-b'],
        }),
        undefined
      );
    });
  });

  it('shows a workspace Paths tab for managing additional directories', async () => {
    const user = userEvent.setup();
    const onWorkspaceUpdate = vi.fn();

    render(
      <WorkspacePanel
        workspace={makeWorkspace({ additionalDirectories: ['/repo-a'] })}
        onWorkspaceUpdate={onWorkspaceUpdate}
      />
    );

    await user.click(screen.getByRole('button', { name: /paths/i }));

    expect(screen.getByText('Additional writable directories')).toBeInTheDocument();
    expect(screen.getByText('/repo-a')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('/path/to/another-repo');
    await user.type(input, '/repo-b');
    await user.click(screen.getByRole('button', { name: /add directory/i }));

    expect(mockRenameWorkspace).toHaveBeenCalledWith('ws-1', {
      additionalDirectories: ['/repo-a', '/repo-b'],
    });
    expect(onWorkspaceUpdate).toHaveBeenCalled();
  });
});
