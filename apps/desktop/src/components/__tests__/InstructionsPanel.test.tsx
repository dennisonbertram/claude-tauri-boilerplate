import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { InstructionsPanel } from '../settings/InstructionsPanel';
import type { InstructionFile, RuleFile } from '@claude-tauri/shared';

const mockFiles: InstructionFile[] = [
  {
    path: '/project/CLAUDE.md',
    level: 'project',
    content: '# Project Instructions\n\nDo good work.',
    exists: true,
  },
  {
    path: '/project/.claude/CLAUDE.md',
    level: 'project',
    content: '',
    exists: false,
  },
  {
    path: '/Users/test/.claude/CLAUDE.md',
    level: 'user',
    content: '# User Instructions\n\nPersonal settings.',
    exists: true,
  },
  {
    path: '/Library/Application Support/ClaudeCode/CLAUDE.md',
    level: 'global',
    content: '',
    exists: false,
  },
];

const mockRules: RuleFile[] = [
  {
    path: '/project/.claude/rules/security.md',
    name: 'security.md',
    content: '---\npaths: src/**\n---\n# Security rules',
    pathScope: ['src/**'],
  },
  {
    path: '/project/.claude/rules/testing.md',
    name: 'testing.md',
    content: '---\npaths: *.test.*\n---\n# Testing rules',
    pathScope: ['*.test.*'],
  },
];

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);

  // Default: return files and rules
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/api/instructions/rules')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ rules: mockRules }),
      });
    }
    if (url.includes('/api/instructions')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ files: mockFiles }),
      });
    }
    return Promise.resolve({ ok: false });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('InstructionsPanel', () => {
  it('shows loading state initially', () => {
    // Make fetch never resolve to keep loading state
    mockFetch.mockImplementation(() => new Promise(() => {}));
    render(<InstructionsPanel />);
    expect(screen.getByTestId('instructions-loading')).toBeInTheDocument();
  });

  it('renders instruction file list after loading', async () => {
    render(<InstructionsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('instructions-panel')).toBeInTheDocument();
    });

    // Should show all four file rows
    expect(screen.getAllByTestId(/^instruction-file-/).length).toBeGreaterThanOrEqual(2);
  });

  it('shows level badges correctly', async () => {
    render(<InstructionsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('instructions-panel')).toBeInTheDocument();
    });

    // Check project-level badge
    const projectBadges = screen.getAllByTestId('level-badge-project');
    expect(projectBadges.length).toBeGreaterThanOrEqual(1);
    expect(projectBadges[0]).toHaveTextContent('Project');

    // Check user-level badge
    expect(screen.getByTestId('level-badge-user')).toHaveTextContent('User');

    // Check global-level badge
    expect(screen.getByTestId('level-badge-global')).toHaveTextContent('Global');
  });

  it('shows "(not found)" for non-existent files', async () => {
    render(<InstructionsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('instructions-panel')).toBeInTheDocument();
    });

    expect(screen.getAllByText('(not found)').length).toBeGreaterThanOrEqual(1);
  });

  it('shows edit button only for existing files', async () => {
    render(<InstructionsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('instructions-panel')).toBeInTheDocument();
    });

    // Existing files should have edit buttons
    expect(screen.getByTestId('edit-btn-project')).toBeInTheDocument();
    expect(screen.getByTestId('edit-btn-user')).toBeInTheDocument();

    // Global doesn't exist, no edit button
    expect(screen.queryByTestId('edit-btn-global')).not.toBeInTheDocument();
  });

  it('shows preview when clicking an existing file', async () => {
    render(<InstructionsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('instructions-panel')).toBeInTheDocument();
    });

    // Click the first project-level file row
    const projectRows = screen.getAllByTestId('instruction-file-project');
    fireEvent.click(projectRows[0]);

    const preview = screen.getByTestId('instructions-preview');
    expect(preview).toBeInTheDocument();
    expect(preview.textContent).toContain('# Project Instructions');
  });

  it('toggles editor when clicking Edit button', async () => {
    render(<InstructionsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('instructions-panel')).toBeInTheDocument();
    });

    // Click edit on project file
    fireEvent.click(screen.getByTestId('edit-btn-project'));

    // Editor should appear
    expect(screen.getByTestId('instructions-editor')).toBeInTheDocument();
    expect(screen.getByTestId('instructions-editor-textarea')).toBeInTheDocument();
    expect(screen.getByTestId('instructions-save-btn')).toBeInTheDocument();
    expect(screen.getByTestId('instructions-cancel-btn')).toBeInTheDocument();
  });

  it('cancel button closes editor', async () => {
    render(<InstructionsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('instructions-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('edit-btn-project'));
    expect(screen.getByTestId('instructions-editor')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('instructions-cancel-btn'));
    expect(screen.queryByTestId('instructions-editor')).not.toBeInTheDocument();
  });

  it('save triggers PUT request with correct params', async () => {
    render(<InstructionsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('instructions-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('edit-btn-project'));

    const textarea = screen.getByTestId('instructions-editor-textarea');
    fireEvent.change(textarea, { target: { value: '# Updated content' } });

    // Mock the PUT response
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      // Re-fetch after save
      if (url.includes('/api/instructions/rules')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rules: mockRules }),
        });
      }
      if (url.includes('/api/instructions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ files: mockFiles }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    fireEvent.click(screen.getByTestId('instructions-save-btn'));

    await waitFor(() => {
      // Find the PUT call
      const putCall = mockFetch.mock.calls.find(
        (call: unknown[]) => (call[1] as RequestInit)?.method === 'PUT'
      );
      expect(putCall).toBeDefined();
      const body = JSON.parse((putCall![1] as RequestInit).body as string);
      expect(body.content).toBe('# Updated content');
    });
  });

  it('lists rules files with path scopes', async () => {
    render(<InstructionsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('instructions-panel')).toBeInTheDocument();
    });

    expect(screen.getByTestId('rule-file-security.md')).toBeInTheDocument();
    expect(screen.getByTestId('rule-file-testing.md')).toBeInTheDocument();

    // Path scope tags
    expect(screen.getByTestId('path-scope-src/**')).toHaveTextContent('src/**');
    expect(screen.getByTestId('path-scope-*.test.*')).toHaveTextContent('*.test.*');
  });

  it('does not show create button when project CLAUDE.md exists', async () => {
    render(<InstructionsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('instructions-panel')).toBeInTheDocument();
    });

    // The mock data has a project-level file that exists
    expect(screen.queryByTestId('instructions-create-btn')).not.toBeInTheDocument();
  });

  it('shows create button when no project CLAUDE.md exists', async () => {
    const filesWithoutProject = mockFiles.map((f) => ({
      ...f,
      exists: f.level !== 'project' ? f.exists : false,
    }));

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/instructions/rules')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rules: [] }),
        });
      }
      if (url.includes('/api/instructions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ files: filesWithoutProject }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<InstructionsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('instructions-panel')).toBeInTheDocument();
    });

    expect(screen.getByTestId('instructions-create-btn')).toBeInTheDocument();
  });

  it('shows create form when create button clicked', async () => {
    const filesWithoutProject = mockFiles.map((f) => ({
      ...f,
      exists: f.level !== 'project' ? f.exists : false,
    }));

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/instructions/rules')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rules: [] }),
        });
      }
      if (url.includes('/api/instructions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ files: filesWithoutProject }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<InstructionsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('instructions-create-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('instructions-create-btn'));

    expect(screen.getByTestId('instructions-create-form')).toBeInTheDocument();
    expect(screen.getByTestId('instructions-create-textarea')).toBeInTheDocument();
  });

  it('shows error when fetch fails', async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({ ok: false })
    );

    render(<InstructionsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('instructions-error')).toBeInTheDocument();
    });
  });
});
