import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Workspace } from '@claude-tauri/shared';

const mockRenameWorkspace = vi.hoisted(() => vi.fn());
const mockGetWorkspaceSession = vi.hoisted(() => vi.fn());
const mockMergeWorkspace = vi.hoisted(() => vi.fn());
const mockDiscardWorkspace = vi.hoisted(() => vi.fn());
const mockChatPage = vi.hoisted(() => vi.fn());
const mockPromptMemoryUpdate = vi.hoisted(() => vi.fn());

vi.mock('@/lib/workspace-api', () => ({
  renameWorkspace: mockRenameWorkspace,
  getWorkspaceSession: mockGetWorkspaceSession,
  mergeWorkspace: mockMergeWorkspace,
  discardWorkspace: mockDiscardWorkspace,
  fetchWorkspaceDiff: vi.fn(),
  fetchWorkspaceRevisions: vi.fn(),
  fetchChangedFiles: vi.fn(),
  fetchWorkspaceStatus: vi.fn(),
}));

vi.mock('@/lib/memoryUpdatePrompt', () => ({
  promptMemoryUpdate: mockPromptMemoryUpdate,
}));

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({
    settings: {
      workflowPrompts: {
        review: 'Review prompt',
        pr: 'PR prompt',
        branch: 'Branch prompt',
        reviewMemory: 'Review memory prompt',
        mergeMemory: 'Merge memory prompt',
      },
    },
  }),
}));

vi.mock('@/components/chat/ChatPage', () => ({
  ChatPage: mockChatPage.mockImplementation(() => <div data-testid="chat-page-placeholder" />),
}));

vi.mock('@/components/workspaces/WorkspaceDiffView', () => ({
  WorkspaceDiffView: () => <div data-testid="workspace-diff-view" />,
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
    mockMergeWorkspace.mockResolvedValue({ success: true });
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

  it('shows repo-aware labels and filters paths by repo name', async () => {
    const user = userEvent.setup();

    render(
      <WorkspacePanel
        workspace={makeWorkspace({
          additionalDirectories: ['/Users/me/services/repo-a', '/Users/me/services/repo-b'],
        })}
      />
    );

    await user.click(screen.getByRole('button', { name: /paths/i }));

    expect(screen.getByText('Repo: repo-a')).toBeInTheDocument();
    expect(screen.getByText('Repo: repo-b')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/filter repos or paths/i), 'repo-b');

    expect(screen.queryByText('Repo: repo-a')).not.toBeInTheDocument();
    expect(screen.getByText('Repo: repo-b')).toBeInTheDocument();
  });

  it('prompts to update memory after a successful merge', async () => {
    const workspace = makeWorkspace();
    const onWorkspaceUpdate = vi.fn();
    const onOpenSettings = vi.fn();

    render(
      <WorkspacePanel
        workspace={workspace}
        onWorkspaceUpdate={onWorkspaceUpdate}
        onOpenSettings={onOpenSettings}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('chat-page-placeholder')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    const dialog = await screen.findByText('Merge Workspace');
    expect(dialog).toBeInTheDocument();

    const mergeButtons = screen.getAllByRole('button', { name: 'Merge' });
    fireEvent.click(mergeButtons.at(-1)!);

    await waitFor(() => {
      expect(mockMergeWorkspace).toHaveBeenCalledWith(workspace.id);
      expect(onWorkspaceUpdate).toHaveBeenCalledOnce();
      expect(mockPromptMemoryUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: 'workspace-merge',
          onOpenMemory: expect.any(Function),
        })
      );
    });

    const args = mockPromptMemoryUpdate.mock.calls.at(-1)?.[0] as {
      onOpenMemory?: () => void;
    };
    args.onOpenMemory?.();

    expect(onOpenSettings).toHaveBeenCalledWith('memory');
  });
});
