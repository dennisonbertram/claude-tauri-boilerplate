import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { MemoryPanel } from '../settings/MemoryPanel';
import type { MemoryFile, MemorySearchResult } from '@claude-tauri/shared';

const mockFiles: MemoryFile[] = [
  {
    name: 'MEMORY.md',
    path: '/home/user/.claude/projects/test/memory/MEMORY.md',
    content: '# Project Memory\n\nKey facts about this project.',
    isEntrypoint: true,
    sizeBytes: 48,
    modifiedAt: '2026-03-15T10:00:00.000Z',
  },
  {
    name: 'debugging.md',
    path: '/home/user/.claude/projects/test/memory/debugging.md',
    content: '# Debugging Notes\n\nPort 3131 already in use.',
    isEntrypoint: false,
    sizeBytes: 1230,
    modifiedAt: '2026-03-14T08:00:00.000Z',
  },
  {
    name: 'patterns.md',
    path: '/home/user/.claude/projects/test/memory/patterns.md',
    content: '# Code Patterns\n\nUse Hono for routing.',
    isEntrypoint: false,
    sizeBytes: 820,
    modifiedAt: '2026-03-13T12:00:00.000Z',
  },
];

const mockSearchResults: MemorySearchResult[] = [
  {
    file: 'debugging.md',
    line: 3,
    text: 'Port 3131 already in use.',
    context: 'Common issues:\nPort 3131 already in use.\nMissing env vars',
  },
];

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);

  // Default: return memory files
  mockFetch.mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('/api/memory/search')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ results: mockSearchResults }),
      });
    }
    if (typeof url === 'string' && url.includes('/api/memory')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            files: mockFiles,
            memoryDir: '/home/user/.claude/projects/test/memory',
          }),
      });
    }
    return Promise.resolve({ ok: false });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MemoryPanel', () => {
  it('shows loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    render(<MemoryPanel />);
    expect(screen.getByTestId('memory-loading')).toBeInTheDocument();
  });

  it('renders file list after loading', async () => {
    render(<MemoryPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-panel')).toBeInTheDocument();
    });

    expect(screen.getByTestId('memory-file-MEMORY.md')).toBeInTheDocument();
    expect(screen.getByTestId('memory-file-debugging.md')).toBeInTheDocument();
    expect(screen.getByTestId('memory-file-patterns.md')).toBeInTheDocument();
  });

  it('MEMORY.md is shown as entrypoint with star badge', async () => {
    render(<MemoryPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-panel')).toBeInTheDocument();
    });

    expect(screen.getByTestId('memory-entrypoint-badge')).toBeInTheDocument();
    expect(screen.getByTestId('memory-entrypoint-badge')).toHaveTextContent(
      'entrypoint'
    );
  });

  it('shows file sizes', async () => {
    render(<MemoryPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-panel')).toBeInTheDocument();
    });

    // 48 B for MEMORY.md
    expect(screen.getByText('48 B')).toBeInTheDocument();
    // 1.2 KB for debugging.md
    expect(screen.getByText('1.2 KB')).toBeInTheDocument();
  });

  it('click file shows preview', async () => {
    render(<MemoryPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('memory-file-MEMORY.md'));

    const preview = screen.getByTestId('memory-preview');
    expect(preview).toBeInTheDocument();
    expect(preview.textContent).toContain('# Project Memory');
  });

  it('edit opens editor', async () => {
    render(<MemoryPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('memory-edit-btn-MEMORY.md'));

    expect(screen.getByTestId('memory-editor')).toBeInTheDocument();
    expect(screen.getByTestId('memory-editor-textarea')).toBeInTheDocument();
    expect(screen.getByTestId('memory-save-btn')).toBeInTheDocument();
    expect(screen.getByTestId('memory-cancel-btn')).toBeInTheDocument();
  });

  it('cancel closes editor', async () => {
    render(<MemoryPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('memory-edit-btn-MEMORY.md'));
    expect(screen.getByTestId('memory-editor')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('memory-cancel-btn'));
    expect(screen.queryByTestId('memory-editor')).not.toBeInTheDocument();
  });

  it('save triggers PUT request', async () => {
    render(<MemoryPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('memory-edit-btn-MEMORY.md'));

    const textarea = screen.getByTestId('memory-editor-textarea');
    fireEvent.change(textarea, { target: { value: '# Updated Memory' } });

    // Mock the PUT response
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      if (typeof url === 'string' && url.includes('/api/memory')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              files: mockFiles,
              memoryDir: '/home/user/.claude/projects/test/memory',
            }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    fireEvent.click(screen.getByTestId('memory-save-btn'));

    await waitFor(() => {
      const putCall = mockFetch.mock.calls.find(
        (call: unknown[]) => (call[1] as RequestInit)?.method === 'PUT'
      );
      expect(putCall).toBeDefined();
      const body = JSON.parse((putCall![1] as RequestInit).body as string);
      expect(body.content).toBe('# Updated Memory');
    });
  });

  it('delete shows confirmation', async () => {
    render(<MemoryPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-panel')).toBeInTheDocument();
    });

    // Click delete on debugging.md (non-entrypoint)
    fireEvent.click(screen.getByTestId('memory-delete-btn-debugging.md'));

    // Confirmation UI should appear
    expect(
      screen.getByTestId('memory-delete-confirm-debugging.md')
    ).toBeInTheDocument();
  });

  it('delete confirmation triggers DELETE request', async () => {
    render(<MemoryPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-panel')).toBeInTheDocument();
    });

    // Mock DELETE
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      if (typeof url === 'string' && url.includes('/api/memory')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              files: mockFiles,
              memoryDir: '/home/user/.claude/projects/test/memory',
            }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    fireEvent.click(screen.getByTestId('memory-delete-btn-debugging.md'));
    fireEvent.click(screen.getByTestId('memory-delete-confirm-debugging.md'));

    await waitFor(() => {
      const deleteCall = mockFetch.mock.calls.find(
        (call: unknown[]) => (call[1] as RequestInit)?.method === 'DELETE'
      );
      expect(deleteCall).toBeDefined();
      expect(deleteCall![0]).toContain('debugging.md');
    });
  });

  it('delete not available for MEMORY.md', async () => {
    render(<MemoryPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-panel')).toBeInTheDocument();
    });

    // MEMORY.md should not have a delete button
    expect(
      screen.queryByTestId('memory-delete-btn-MEMORY.md')
    ).not.toBeInTheDocument();
  });

  it('add memory opens create form', async () => {
    render(<MemoryPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('memory-create-btn'));

    expect(screen.getByTestId('memory-create-form')).toBeInTheDocument();
    expect(
      screen.getByTestId('memory-create-name-input')
    ).toBeInTheDocument();
    expect(screen.getByTestId('memory-create-textarea')).toBeInTheDocument();
  });

  it('create triggers POST request', async () => {
    render(<MemoryPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('memory-create-btn'));

    const nameInput = screen.getByTestId('memory-create-name-input');
    const textarea = screen.getByTestId('memory-create-textarea');

    fireEvent.change(nameInput, { target: { value: 'new-topic.md' } });
    fireEvent.change(textarea, { target: { value: '# New Topic' } });

    // Mock POST
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      if (typeof url === 'string' && url.includes('/api/memory')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              files: mockFiles,
              memoryDir: '/home/user/.claude/projects/test/memory',
            }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    fireEvent.click(screen.getByTestId('memory-create-save-btn'));

    await waitFor(() => {
      const postCall = mockFetch.mock.calls.find(
        (call: unknown[]) => (call[1] as RequestInit)?.method === 'POST'
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse((postCall![1] as RequestInit).body as string);
      expect(body.name).toBe('new-topic.md');
      expect(body.content).toBe('# New Topic');
    });
  });

  it('search filters results', async () => {
    render(<MemoryPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-panel')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('memory-search-input');
    fireEvent.change(searchInput, { target: { value: 'Port' } });

    await waitFor(() => {
      expect(screen.getByTestId('memory-search-results')).toBeInTheDocument();
    });

    await waitFor(() => {
      const items = screen.getAllByTestId('memory-search-result-item');
      expect(items.length).toBeGreaterThan(0);
    });
  });

  it('auto-memory toggle works', async () => {
    render(<MemoryPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-panel')).toBeInTheDocument();
    });

    const toggle = screen.getByTestId('memory-auto-toggle');
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('displays memory directory path', async () => {
    render(<MemoryPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-panel')).toBeInTheDocument();
    });

    expect(screen.getByTestId('memory-dir-display')).toHaveTextContent(
      '/home/user/.claude/projects/test/memory'
    );
  });

  it('shows error when fetch fails', async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({ ok: false })
    );

    render(<MemoryPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('memory-error')).toBeInTheDocument();
    });
  });
});
