import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectSidebar } from '../ProjectSidebar';
import type { Project, Workspace, GitStatus } from '@claude-tauri/shared';
import * as workspaceApi from '@/lib/workspace-api';
import * as clipboard from '@/lib/clipboard';

vi.mock('@/lib/workspace-api', () => ({
  fetchWorkspaceStatus: vi.fn(),
}));

vi.mock('@/lib/clipboard', () => ({
  copyTextToClipboard: vi.fn().mockResolvedValue(undefined),
}));

const mockFetchWorkspaceStatus = vi.mocked(workspaceApi.fetchWorkspaceStatus);
const mockCopyTextToClipboard = vi.mocked(clipboard.copyTextToClipboard);

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

const makeStatus = (overrides: Partial<GitStatus> = {}): GitStatus => ({
  branch: 'workspace/feature-workspace',
  isClean: false,
  modifiedFiles: [],
  stagedFiles: [],
  ...overrides,
});

describe('ProjectSidebar', () => {
  const baseProps = {
    onSelectWorkspace: vi.fn(),
    onAddProject: vi.fn(),
    onCreateWorkspace: vi.fn(),
    onRenameWorkspace: vi.fn(),
    onDeleteProject: vi.fn(),
  };
  const project: Project = {
    id: 'project-1',
    name: 'Test Project',
    repoPath: '/tmp/repo',
    repoPathCanonical: '/tmp/repo',
    defaultBranch: 'main',
    setupCommand: '',
    isDeleted: false,
    createdAt: '2026-03-16T10:00:00.000Z',
    updatedAt: '2026-03-16T10:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays git status summary for each workspace', async () => {
    mockFetchWorkspaceStatus.mockResolvedValueOnce(
      makeStatus({ isClean: true, modifiedFiles: [], stagedFiles: [] })
    );

    render(
      <ProjectSidebar
        {...baseProps}
        projects={[project]}
        workspacesByProject={{ [project.id]: [makeWorkspace()] }}
        selectedWorkspaceId={null}
      />
    );

    await waitFor(() => {
      expect(mockFetchWorkspaceStatus).toHaveBeenCalledWith('/tmp/workspace-1');
    });
    expect(await screen.findByText('Clean')).toBeInTheDocument();
  });

  it('shows committed and uncommitted sections for dirty workspaces', async () => {
    mockFetchWorkspaceStatus.mockResolvedValueOnce(
      makeStatus({
        isClean: false,
        modifiedFiles: [{ path: 'src/app.ts', status: 'modified' }],
        stagedFiles: [{ path: 'src/ready.ts', status: 'added' }],
      })
    );

    render(
      <ProjectSidebar
        {...baseProps}
        projects={[project]}
        workspacesByProject={{ [project.id]: [makeWorkspace()] }}
        selectedWorkspaceId={null}
      />
    );

    expect(await screen.findByText('Committed 1')).toBeInTheDocument();
    expect(screen.getByText('Uncommitted 1')).toBeInTheDocument();
  });

  it('supports inline branch rename on Enter key', async () => {
    const onRenameWorkspace = vi.fn().mockResolvedValue(makeWorkspace({ branch: 'workspace/new-name' }));
    mockFetchWorkspaceStatus.mockResolvedValue(
      makeStatus({ isClean: true, modifiedFiles: [], stagedFiles: [] })
    );

    render(
      <ProjectSidebar
        {...baseProps}
        onRenameWorkspace={onRenameWorkspace}
        projects={[project]}
        workspacesByProject={{ [project.id]: [makeWorkspace()] }}
        selectedWorkspaceId={null}
      />
    );

    await screen.findByText('Rename');
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'workspace/new-name');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(onRenameWorkspace).toHaveBeenCalledWith('ws-1', 'workspace/new-name');
    });
  });

  it('copies the branch name with one click', async () => {
    const user = userEvent.setup();
    mockFetchWorkspaceStatus.mockResolvedValue(
      makeStatus({ isClean: true, modifiedFiles: [], stagedFiles: [] })
    );

    render(
      <ProjectSidebar
        {...baseProps}
        projects={[project]}
        workspacesByProject={{ [project.id]: [makeWorkspace()] }}
        selectedWorkspaceId={null}
      />
    );

    await user.click(screen.getByRole('button', { name: /copy branch name/i }));

    await waitFor(() => {
      expect(mockCopyTextToClipboard).toHaveBeenCalledWith('workspace/feature-workspace');
    });
  });

  it('cancels rename when cancel is clicked', async () => {
    const onRenameWorkspace = vi.fn();
    mockFetchWorkspaceStatus.mockResolvedValue(
      makeStatus({ isClean: true, modifiedFiles: [], stagedFiles: [] })
    );

    render(
      <ProjectSidebar
        {...baseProps}
        onRenameWorkspace={onRenameWorkspace}
        projects={[project]}
        workspacesByProject={{ [project.id]: [makeWorkspace()] }}
        selectedWorkspaceId={null}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Rename' }));
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'workspace/edited');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onRenameWorkspace).not.toHaveBeenCalled();
    expect(screen.getByText('workspace/feature-workspace')).toBeInTheDocument();
  });
});
