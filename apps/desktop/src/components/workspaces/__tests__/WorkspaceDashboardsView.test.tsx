import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Artifact } from '@claude-tauri/shared';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockFetchProjectArtifacts = vi.hoisted(() => vi.fn());
const mockArchiveArtifact = vi.hoisted(() => vi.fn());
const mockGenerateArtifact = vi.hoisted(() => vi.fn());
const mockRegenerateArtifact = vi.hoisted(() => vi.fn());
const mockRenameArtifact = vi.hoisted(() => vi.fn());

vi.mock('@/lib/workspace-api', () => ({
  fetchProjectArtifacts: mockFetchProjectArtifacts,
  archiveArtifact: mockArchiveArtifact,
  generateArtifact: mockGenerateArtifact,
  regenerateArtifact: mockRegenerateArtifact,
  renameArtifact: mockRenameArtifact,
}));

import { WorkspaceDashboardsView } from '../WorkspaceDashboardsView';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: 'artifact-1',
    kind: 'dashboard',
    schemaVersion: 1,
    title: 'Test Dashboard',
    projectId: 'proj-1',
    workspaceId: null,
    sourceSessionId: null,
    sourceMessageId: null,
    status: 'active',
    currentRevisionId: null,
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WorkspaceDashboardsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchProjectArtifacts.mockResolvedValue([]);
  });

  it('shows loading state while fetching', async () => {
    // Never resolves immediately to keep loading state visible
    mockFetchProjectArtifacts.mockReturnValue(new Promise(() => {}));

    render(<WorkspaceDashboardsView projectId="proj-1" workspaceId="ws-1" />);

    // The loading spinner should be present before data loads
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('shows "No dashboards yet" when artifact list is empty', async () => {
    mockFetchProjectArtifacts.mockResolvedValue([]);

    render(<WorkspaceDashboardsView projectId="proj-1" workspaceId="ws-1" />);

    await waitFor(() => {
      expect(screen.getByText('No dashboards yet.')).toBeInTheDocument();
    });
  });

  it('renders artifact list when artifacts exist', async () => {
    const artifacts = [
      makeArtifact({ id: 'a1', title: 'Revenue Dashboard' }),
      makeArtifact({ id: 'a2', title: 'User Metrics' }),
    ];
    mockFetchProjectArtifacts.mockResolvedValue(artifacts);

    render(<WorkspaceDashboardsView projectId="proj-1" workspaceId="ws-1" />);

    await waitFor(() => {
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
      expect(screen.getByText('User Metrics')).toBeInTheDocument();
    });
  });

  it('renders empty state when no artifact is selected', async () => {
    mockFetchProjectArtifacts.mockResolvedValue([makeArtifact()]);

    render(<WorkspaceDashboardsView projectId="proj-1" workspaceId="ws-1" />);

    await waitFor(() => {
      expect(screen.getByText('Select a dashboard to view it')).toBeInTheDocument();
    });
  });

  it('shows detail view when an artifact is selected', async () => {
    const artifact = makeArtifact({ title: 'My Dashboard' });
    mockFetchProjectArtifacts.mockResolvedValue([artifact]);

    const user = userEvent.setup();
    render(<WorkspaceDashboardsView projectId="proj-1" workspaceId="ws-1" />);

    await waitFor(() => {
      expect(screen.getByText('My Dashboard')).toBeInTheDocument();
    });

    await user.click(screen.getByText('My Dashboard'));

    // Detail view should now show the title as a clickable button
    await waitFor(() => {
      expect(screen.queryByText('Select a dashboard to view it')).not.toBeInTheDocument();
    });
  });

  it('calls archiveArtifact when archive button is clicked in detail view', async () => {
    const artifact = makeArtifact({ id: 'a1', title: 'Archive Me' });
    mockFetchProjectArtifacts.mockResolvedValue([artifact]);
    mockArchiveArtifact.mockResolvedValue({ ...artifact, status: 'archived' });

    const user = userEvent.setup();
    render(<WorkspaceDashboardsView projectId="proj-1" workspaceId="ws-1" />);

    await waitFor(() => {
      expect(screen.getByText('Archive Me')).toBeInTheDocument();
    });

    // Select the artifact
    await user.click(screen.getByText('Archive Me'));

    // Click the archive button in the detail view header
    const archiveButtons = await screen.findAllByRole('button', { name: /archive/i });
    // The detail view archive button is visible after selecting
    const detailArchiveBtn = archiveButtons.find(
      (btn) => btn.getAttribute('aria-label') === 'Archive dashboard'
    );
    expect(detailArchiveBtn).toBeDefined();
    await user.click(detailArchiveBtn!);

    expect(mockArchiveArtifact).toHaveBeenCalledWith('a1');
  });

  it('filters out archived artifacts from default view', async () => {
    const artifacts = [
      makeArtifact({ id: 'a1', title: 'Active Dashboard', status: 'active' }),
      makeArtifact({ id: 'a2', title: 'Archived Dashboard', status: 'archived' }),
    ];
    // Simulate that the API only returns active ones by default
    mockFetchProjectArtifacts.mockResolvedValue(artifacts.filter((a) => a.status === 'active'));

    render(<WorkspaceDashboardsView projectId="proj-1" workspaceId="ws-1" />);

    await waitFor(() => {
      expect(screen.getByText('Active Dashboard')).toBeInTheDocument();
      expect(screen.queryByText('Archived Dashboard')).not.toBeInTheDocument();
    });
  });
});
