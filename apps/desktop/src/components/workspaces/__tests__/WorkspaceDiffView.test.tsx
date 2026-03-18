import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseWorkspaceDiff } from '../WorkspaceDiffView';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkspaceDiffView } from '../WorkspaceDiffView';
import * as workspaceApi from '@/lib/workspace-api';
import * as workspaceDiffHook from '@/hooks/useWorkspaceDiff';

vi.mock('@/lib/workspace-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/workspace-api')>('@/lib/workspace-api');
  return {
    ...actual,
    fetchWorkspaceRevisions: vi.fn(),
  };
});

vi.mock('@/hooks/useWorkspaceDiff', () => ({
  useWorkspaceDiff: vi.fn(),
}));

vi.mock('@/hooks/useSettings', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useSettings')>('@/hooks/useSettings');
  return {
    ...actual,
    useSettings: () => ({
      settings: actual.DEFAULT_SETTINGS,
      updateSettings: vi.fn(),
      resetSettings: vi.fn(),
    }),
  };
});

const mockFetchWorkspaceRevisions = vi.mocked(workspaceApi.fetchWorkspaceRevisions);
const mockUseWorkspaceDiff = vi.mocked(workspaceDiffHook.useWorkspaceDiff);

describe('WorkspaceDiffView', () => {
  it('parses unified diff into side-by-side-ready file rows', () => {
    const diff = [
      'diff --git a/src/app.js b/src/app.js',
      'index 1111111..2222222 100644',
      '--- a/src/app.js',
      '+++ b/src/app.js',
      '@@ -1,2 +1,3 @@',
      ' line-1',
      '-line-2',
      '+line-2 changed',
      '+line-3',
      ' line-4',
    ].join('\n');

    const parsed = parseWorkspaceDiff(diff);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].path).toBe('src/app.js');
    expect(parsed[0].lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'context', oldLine: 1, newLine: 1, content: 'line-1' }),
        expect.objectContaining({ type: 'removed', oldLine: 2, content: 'line-2' }),
        expect.objectContaining({ type: 'added', newLine: 2, content: 'line-2 changed' }),
        expect.objectContaining({ type: 'added', newLine: 3, content: 'line-3' }),
        expect.objectContaining({ type: 'context', oldLine: 3, newLine: 4, content: 'line-4' }),
      ])
    );
  });

  beforeEach(() => {
    mockFetchWorkspaceRevisions.mockReset();
    mockUseWorkspaceDiff.mockReset();

    mockFetchWorkspaceRevisions.mockResolvedValue({
      workspaceId: 'ws-1',
      revisions: [
        {
          id: 'r-1',
          shortId: 'r1',
          message: 'Current',
          parent: null,
          committedAt: new Date().toISOString(),
        },
      ],
    });

    mockUseWorkspaceDiff.mockReturnValue({
      diff: 'diff --git a/src/app.js b/src/app.js\nindex 1111111..2222222 100644\n--- a/src/app.js\n+++ b/src/app.js\n@@ -1,2 +1,2 @@\n line-1\n-line-2\n+line-2 changed\n',
      changedFiles: [{ path: 'src/app.js', status: 'modified' }],
      loading: false,
      error: null,
      fetchDiff: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens inline comment composer from diff line', async () => {
    render(<WorkspaceDiffView workspaceId="ws-1" />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Comment' }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Comment' })[0]);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByText('Save comment')).toBeInTheDocument();
  });

  it('saves an inline comment and renders markdown preview', async () => {
    render(<WorkspaceDiffView workspaceId="ws-1" />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Comment' }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Comment' })[0]);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '**Looks good**' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save comment' }));

    expect(await screen.findByText('Looks good')).toBeInTheDocument();
  });
});
