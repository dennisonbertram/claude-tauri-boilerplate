import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { GitStatusBar } from '../GitStatusBar';
import type { GitStatus } from '@claude-tauri/shared';

// Mock fetch globally
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockGitStatus(status: GitStatus) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(status),
  });
}

describe('GitStatusBar', () => {
  it('renders the current branch name', async () => {
    mockGitStatus({
      branch: 'main',
      isClean: true,
      modifiedFiles: [],
      stagedFiles: [],
      pullRebase: false,
    });

    render(<GitStatusBar />);

    await waitFor(() => {
      expect(screen.getByText('main')).toBeInTheDocument();
    });
  });

  it('shows a green indicator when repo is clean', async () => {
    mockGitStatus({
      branch: 'develop',
      isClean: true,
      modifiedFiles: [],
      stagedFiles: [],
      pullRebase: true,
    });

    render(<GitStatusBar />);

    await waitFor(() => {
      const indicator = screen.getByTestId('git-status-indicator');
      expect(indicator).toHaveClass('bg-green-500');
    });
  });

  it('shows the configured pull preference when available', async () => {
    mockGitStatus({
      branch: 'feature/test',
      isClean: true,
      modifiedFiles: [],
      stagedFiles: [],
      pullRebase: true,
    });

    render(<GitStatusBar />);

    await waitFor(() => {
      expect(screen.getByTestId('git-pull-preference')).toHaveTextContent('Rebase');
    });
  });

  it('shows a yellow indicator when repo is dirty', async () => {
    mockGitStatus({
      branch: 'feature/test',
      isClean: false,
      modifiedFiles: [{ path: 'src/app.ts', status: 'modified' }],
      stagedFiles: [],
    });

    render(<GitStatusBar />);

    await waitFor(() => {
      const indicator = screen.getByTestId('git-status-indicator');
      expect(indicator).toHaveClass('bg-yellow-500');
    });
  });

  it('displays modified file count badge when dirty', async () => {
    mockGitStatus({
      branch: 'main',
      isClean: false,
      modifiedFiles: [
        { path: 'src/a.ts', status: 'modified' },
        { path: 'src/b.ts', status: 'added' },
      ],
      stagedFiles: [{ path: 'src/c.ts', status: 'modified' }],
    });

    render(<GitStatusBar />);

    await waitFor(() => {
      // Total changed = 2 modified + 1 staged = 3
      expect(screen.getByTestId('git-file-count')).toHaveTextContent('3');
    });
  });

  it('does not display file count badge when repo is clean', async () => {
    mockGitStatus({
      branch: 'main',
      isClean: true,
      modifiedFiles: [],
      stagedFiles: [],
    });

    render(<GitStatusBar />);

    await waitFor(() => {
      expect(screen.getByText('main')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('git-file-count')).not.toBeInTheDocument();
  });

  it('shows error state when git is not available', async () => {
    mockGitStatus({
      branch: '',
      isClean: true,
      modifiedFiles: [],
      stagedFiles: [],
      error: 'Not a git repository',
    });

    render(<GitStatusBar />);

    await waitFor(() => {
      expect(screen.getByText('No git')).toBeInTheDocument();
    });
  });

  it('handles fetch failure gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<GitStatusBar />);

    await waitFor(() => {
      expect(screen.getByText('No git')).toBeInTheDocument();
    });
  });

  it('displays a git branch icon', async () => {
    mockGitStatus({
      branch: 'main',
      isClean: true,
      modifiedFiles: [],
      stagedFiles: [],
    });

    render(<GitStatusBar />);

    await waitFor(() => {
      expect(screen.getByTestId('git-branch-icon')).toBeInTheDocument();
    });
  });
});
