import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkspacePanel } from '../WorkspacePanel';
import type { Workspace } from '@claude-tauri/shared';
import * as workspaceApi from '@/lib/workspace-api';
import { promptMemoryUpdate } from '@/lib/memoryUpdatePrompt';

vi.mock('@/lib/workspace-api', () => ({
  getWorkspaceSession: vi.fn(),
  mergeWorkspace: vi.fn(),
  discardWorkspace: vi.fn(),
}));

vi.mock('@/lib/memoryUpdatePrompt', () => ({
  promptMemoryUpdate: vi.fn(),
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
  ChatPage: () => <div data-testid="chat-page-placeholder" />,
}));

vi.mock('../WorkspaceDiffView', () => ({
  WorkspaceDiffView: () => <div data-testid="workspace-diff-placeholder" />,
}));

const mockGetWorkspaceSession = workspaceApi.getWorkspaceSession as any;
const mockMergeWorkspace = workspaceApi.mergeWorkspace as any;
const mockPromptMemoryUpdate = promptMemoryUpdate as any;

const makeWorkspace = (overrides: Partial<Workspace> = {}): Workspace => ({
  id: 'ws-1',
  projectId: 'project-1',
  name: 'feature-workspace',
  branch: 'workspace/feature-workspace',
  worktreePath: '/tmp/workspace-1',
  worktreePathCanonical: '/tmp/workspace-1',
  baseBranch: 'main',
  status: 'ready',
  createdAt: '2026-03-16T10:00:00.000Z',
  updatedAt: '2026-03-16T10:00:00.000Z',
  ...overrides,
});

describe('WorkspacePanel memory prompt flow', () => {
  const workspace = makeWorkspace();
  const onWorkspaceUpdate = vi.fn();
  const onOpenSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorkspaceSession.mockResolvedValue(null);
    mockMergeWorkspace.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prompts to update memory after a successful merge', async () => {
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
