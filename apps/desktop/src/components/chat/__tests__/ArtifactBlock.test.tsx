import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { ArtifactBlock } from '../ArtifactBlock';
import type { Artifact } from '@claude-tauri/shared';

const mockArtifact: Artifact = {
  id: 'art-1',
  kind: 'dashboard',
  schemaVersion: 1,
  title: 'Team Metrics',
  projectId: 'proj-1',
  workspaceId: null,
  sourceSessionId: null,
  sourceMessageId: null,
  status: 'active',
  currentRevisionId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('ArtifactBlock', () => {
  test('renders artifact title', () => {
    render(<ArtifactBlock artifact={mockArtifact} />);
    expect(screen.getByText('Team Metrics')).toBeInTheDocument();
    expect(screen.getByTestId('artifact-block')).toBeInTheDocument();
  });

  test('shows archived badge when archived', () => {
    render(<ArtifactBlock artifact={{ ...mockArtifact, status: 'archived' }} />);
    expect(screen.getByText('archived')).toBeInTheDocument();
  });

  test('shows archive button when onArchive provided and not archived', () => {
    const onArchive = vi.fn();
    render(<ArtifactBlock artifact={mockArtifact} onArchive={onArchive} />);
    const archiveBtn = screen.getByTitle('Archive artifact');
    expect(archiveBtn).toBeInTheDocument();
  });

  test('does not show archive button for archived artifacts', () => {
    const onArchive = vi.fn();
    render(<ArtifactBlock artifact={{ ...mockArtifact, status: 'archived' }} onArchive={onArchive} />);
    expect(screen.queryByTitle('Archive artifact')).not.toBeInTheDocument();
  });

  test('sets data-artifact-id attribute', () => {
    render(<ArtifactBlock artifact={mockArtifact} />);
    const block = screen.getByTestId('artifact-block');
    expect(block).toHaveAttribute('data-artifact-id', 'art-1');
  });

  test('renders Dashboard artifact label', () => {
    render(<ArtifactBlock artifact={mockArtifact} />);
    expect(screen.getByText('Dashboard artifact')).toBeInTheDocument();
  });

  test('does not show archived badge for active artifacts', () => {
    render(<ArtifactBlock artifact={mockArtifact} />);
    expect(screen.queryByText('archived')).not.toBeInTheDocument();
  });

  test('does not show archive button when onArchive is not provided', () => {
    render(<ArtifactBlock artifact={mockArtifact} />);
    expect(screen.queryByTitle('Archive artifact')).not.toBeInTheDocument();
  });
});
