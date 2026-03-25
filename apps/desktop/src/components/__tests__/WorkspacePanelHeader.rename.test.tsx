import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkspacePanelHeader } from '../workspaces/WorkspacePanelHeader';
import type { Workspace } from '@claude-tauri/shared';

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ settings: { preferredIde: 'vscode' } }),
}));

vi.mock('@/lib/clipboard', () => ({
  copyTextToClipboard: vi.fn(),
}));

vi.mock('@/lib/ide-opener', () => ({
  openInIde: vi.fn(),
  IDE_CONFIGS: {
    vscode: { label: 'VS Code' },
  },
}));

const mockWorkspace: Workspace = {
  id: 'ws-1',
  projectId: 'proj-1',
  name: 'my-workspace',
  branch: 'feature/my-branch',
  baseBranch: 'main',
  worktreePath: '/path/to/worktree',
  worktreePathCanonical: '/path/to/worktree',
  status: 'ready',
  additionalDirectories: [],
  createdAt: '2026-03-20T00:00:00Z',
  updatedAt: '2026-03-20T00:00:00Z',
};

function renderHeader(overrides: Partial<Parameters<typeof WorkspacePanelHeader>[0]> = {}) {
  const defaultProps = {
    workspace: mockWorkspace,
    branchCopied: false,
    onBranchCopy: vi.fn(),
    canMerge: false,
    canDiscard: false,
    onMerge: vi.fn(),
    onDiscard: vi.fn(),
  };
  return render(<WorkspacePanelHeader {...defaultProps} {...overrides} />);
}

describe('WorkspacePanelHeader rename', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('workspace name is clickable when onRename is provided', () => {
    const onRename = vi.fn();
    renderHeader({ onRename });

    const heading = screen.getByText('my-workspace');
    expect(heading).toHaveClass('cursor-pointer');

    fireEvent.click(heading);
    // Edit mode activated: input should appear
    expect(screen.getByLabelText('Rename workspace')).toBeInTheDocument();
  });

  it('click name enters edit mode with input pre-filled', () => {
    const onRename = vi.fn();
    renderHeader({ onRename });

    fireEvent.click(screen.getByText('my-workspace'));

    const input = screen.getByLabelText('Rename workspace') as HTMLInputElement;
    expect(input.tagName).toBe('INPUT');
    expect(input.value).toBe('my-workspace');
  });

  it('pencil icon button also enters edit mode', () => {
    const onRename = vi.fn();
    renderHeader({ onRename });

    // There are two elements with "Rename workspace" aria-label: the button and (after click) the input.
    // Before clicking, the button is the only one.
    const pencilButton = screen.getByRole('button', { name: 'Rename workspace' });
    fireEvent.click(pencilButton);

    const input = screen.getByLabelText('Rename workspace') as HTMLInputElement;
    expect(input.tagName).toBe('INPUT');
    expect(input.value).toBe('my-workspace');
  });

  it('Enter key saves the new name', async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    renderHeader({ onRename });

    fireEvent.click(screen.getByText('my-workspace'));
    const input = screen.getByLabelText('Rename workspace') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'new-name' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(onRename).toHaveBeenCalledWith('ws-1', { name: 'new-name' });
    });
  });

  it('Escape cancels without saving', () => {
    const onRename = vi.fn();
    renderHeader({ onRename });

    fireEvent.click(screen.getByText('my-workspace'));
    const input = screen.getByLabelText('Rename workspace') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'changed-name' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onRename).not.toHaveBeenCalled();
    // Should exit edit mode and show original name (not an input)
    expect(screen.getByText('my-workspace')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Rename workspace' })).not.toBeInTheDocument();
  });

  it('blur saves the name', async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    renderHeader({ onRename });

    fireEvent.click(screen.getByText('my-workspace'));
    const input = screen.getByLabelText('Rename workspace') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'blur-name' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(onRename).toHaveBeenCalledWith('ws-1', { name: 'blur-name' });
    });
  });

  it('empty or unchanged name is discarded without API call', async () => {
    const onRename = vi.fn();
    renderHeader({ onRename });

    // Test unchanged name
    fireEvent.click(screen.getByText('my-workspace'));
    let input = screen.getByLabelText('Rename workspace') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('my-workspace')).toBeInTheDocument();
    });
    expect(onRename).not.toHaveBeenCalled();

    // Test empty name
    fireEvent.click(screen.getByText('my-workspace'));
    input = screen.getByLabelText('Rename workspace') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('my-workspace')).toBeInTheDocument();
    });
    expect(onRename).not.toHaveBeenCalled();
  });
});
