import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { McpPanel } from '../settings/McpPanel';
import type { McpServerConfig } from '@claude-tauri/shared';

const mockServers: McpServerConfig[] = [
  {
    name: 'my-server',
    type: 'stdio',
    enabled: true,
    command: 'node',
    args: ['./server.js'],
    env: { API_KEY: 'test' },
  },
  {
    name: 'weather-api',
    type: 'http',
    enabled: false,
    url: 'https://api.weather.com/mcp',
  },
  {
    name: 'events-stream',
    type: 'sse',
    enabled: true,
    url: 'https://events.example.com/mcp',
  },
];

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);

  // Default: return server list
  mockFetch.mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('/api/mcp/servers')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ servers: mockServers }),
      });
    }
    return Promise.resolve({ ok: false });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('McpPanel', () => {
  it('shows loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    render(<McpPanel />);
    expect(screen.getByTestId('mcp-loading')).toBeInTheDocument();
  });

  it('renders server list after loading', async () => {
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
    });

    expect(screen.getByTestId('mcp-server-my-server')).toBeInTheDocument();
    expect(screen.getByTestId('mcp-server-weather-api')).toBeInTheDocument();
    expect(screen.getByTestId('mcp-server-events-stream')).toBeInTheDocument();
  });

  it('shows type badges with correct labels', async () => {
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
    });

    expect(screen.getByTestId('mcp-type-badge-my-server')).toHaveTextContent('stdio');
    expect(screen.getByTestId('mcp-type-badge-weather-api')).toHaveTextContent('http');
    expect(screen.getByTestId('mcp-type-badge-events-stream')).toHaveTextContent('sse');
  });

  it('shows green status dot for enabled, gray for disabled', async () => {
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
    });

    const enabledDot = screen.getByTestId('mcp-status-my-server');
    const disabledDot = screen.getByTestId('mcp-status-weather-api');

    expect(enabledDot.className).toContain('bg-green-500');
    expect(disabledDot.className).toContain('bg-gray-500');
  });

  it('toggle calls PATCH endpoint', async () => {
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
    });

    // Mock PATCH response
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, server: { ...mockServers[0], enabled: false } }),
        });
      }
      if (typeof url === 'string' && url.includes('/api/mcp/servers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ servers: mockServers }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    const toggle = screen.getByTestId('mcp-toggle-my-server');
    fireEvent.click(toggle);

    await waitFor(() => {
      const patchCall = mockFetch.mock.calls.find(
        (call: unknown[]) => (call[1] as RequestInit)?.method === 'PATCH'
      );
      expect(patchCall).toBeDefined();
      expect(patchCall![0]).toContain('my-server/toggle');
      const body = JSON.parse((patchCall![1] as RequestInit).body as string);
      expect(body.enabled).toBe(false);
    });
  });

  it('delete shows confirmation', async () => {
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('mcp-delete-btn-my-server'));

    expect(screen.getByTestId('mcp-delete-confirm-my-server')).toBeInTheDocument();
  });

  it('delete confirmation triggers DELETE request', async () => {
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
    });

    // Mock DELETE
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      if (typeof url === 'string' && url.includes('/api/mcp/servers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ servers: mockServers }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    fireEvent.click(screen.getByTestId('mcp-delete-btn-my-server'));
    fireEvent.click(screen.getByTestId('mcp-delete-confirm-my-server'));

    await waitFor(() => {
      const deleteCall = mockFetch.mock.calls.find(
        (call: unknown[]) => (call[1] as RequestInit)?.method === 'DELETE'
      );
      expect(deleteCall).toBeDefined();
      expect(deleteCall![0]).toContain('my-server');
    });
  });

  it('delete cancel hides confirmation', async () => {
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('mcp-delete-btn-my-server'));
    expect(screen.getByTestId('mcp-delete-confirm-my-server')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mcp-delete-cancel-my-server'));
    expect(screen.queryByTestId('mcp-delete-confirm-my-server')).not.toBeInTheDocument();
  });

  it('add server button opens form', async () => {
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('mcp-add-btn'));
    expect(screen.getByTestId('mcp-add-form')).toBeInTheDocument();
    expect(screen.getByTestId('mcp-add-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('mcp-add-type-select')).toBeInTheDocument();
  });

  it('add form shows correct fields for stdio type', async () => {
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('mcp-add-btn'));

    // stdio is default type
    expect(screen.getByTestId('mcp-add-command-input')).toBeInTheDocument();
    expect(screen.getByTestId('mcp-add-args-input')).toBeInTheDocument();
    expect(screen.getByTestId('mcp-add-env-input')).toBeInTheDocument();

    // Should NOT show http fields
    expect(screen.queryByTestId('mcp-add-url-input')).not.toBeInTheDocument();
  });

  it('add form shows correct fields for http type', async () => {
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('mcp-add-btn'));

    // Change type to http
    fireEvent.change(screen.getByTestId('mcp-add-type-select'), {
      target: { value: 'http' },
    });

    expect(screen.getByTestId('mcp-add-url-input')).toBeInTheDocument();
    expect(screen.getByTestId('mcp-add-headers-input')).toBeInTheDocument();

    // Should NOT show stdio fields
    expect(screen.queryByTestId('mcp-add-command-input')).not.toBeInTheDocument();
  });

  it('save triggers POST request', async () => {
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('mcp-add-btn'));

    // Fill form
    fireEvent.change(screen.getByTestId('mcp-add-name-input'), {
      target: { value: 'new-server' },
    });
    fireEvent.change(screen.getByTestId('mcp-add-command-input'), {
      target: { value: 'bun' },
    });
    fireEvent.change(screen.getByTestId('mcp-add-args-input'), {
      target: { value: 'run, server.ts' },
    });

    // Mock POST
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, server: { name: 'new-server' } }),
        });
      }
      if (typeof url === 'string' && url.includes('/api/mcp/servers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ servers: mockServers }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    fireEvent.click(screen.getByTestId('mcp-add-save-btn'));

    await waitFor(() => {
      const postCall = mockFetch.mock.calls.find(
        (call: unknown[]) => (call[1] as RequestInit)?.method === 'POST'
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse((postCall![1] as RequestInit).body as string);
      expect(body.name).toBe('new-server');
      expect(body.type).toBe('stdio');
      expect(body.command).toBe('bun');
      expect(body.args).toEqual(['run', 'server.ts']);
    });
  });

  it('validates required name field', async () => {
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('mcp-add-btn'));

    // Try to save without a name
    fireEvent.click(screen.getByTestId('mcp-add-save-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('mcp-error')).toBeInTheDocument();
      expect(screen.getByTestId('mcp-error')).toHaveTextContent('Server name is required');
    });
  });

  it('validates required command for stdio', async () => {
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('mcp-add-btn'));

    // Set name but no command
    fireEvent.change(screen.getByTestId('mcp-add-name-input'), {
      target: { value: 'test' },
    });

    fireEvent.click(screen.getByTestId('mcp-add-save-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('mcp-error')).toBeInTheDocument();
      expect(screen.getByTestId('mcp-error')).toHaveTextContent('Command is required');
    });
  });

  it('validates required url for http', async () => {
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('mcp-add-btn'));

    // Set name and change to http type, but no url
    fireEvent.change(screen.getByTestId('mcp-add-name-input'), {
      target: { value: 'test-http' },
    });
    fireEvent.change(screen.getByTestId('mcp-add-type-select'), {
      target: { value: 'http' },
    });

    fireEvent.click(screen.getByTestId('mcp-add-save-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('mcp-error')).toBeInTheDocument();
      expect(screen.getByTestId('mcp-error')).toHaveTextContent('URL is required');
    });
  });

  it('edit expands server card with edit form', async () => {
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
    });

    // Click on a server card to edit
    fireEvent.click(screen.getByTestId('mcp-server-my-server'));

    await waitFor(() => {
      expect(screen.getByTestId('mcp-edit-form-my-server')).toBeInTheDocument();
    });

    expect(screen.getByTestId('mcp-edit-command-input')).toBeInTheDocument();
    expect(screen.getByTestId('mcp-edit-save-btn')).toBeInTheDocument();
    expect(screen.getByTestId('mcp-edit-cancel-btn')).toBeInTheDocument();
  });

  it('edit cancel closes form', async () => {
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('mcp-server-my-server'));
    expect(screen.getByTestId('mcp-edit-form-my-server')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mcp-edit-cancel-btn'));
    expect(screen.queryByTestId('mcp-edit-form-my-server')).not.toBeInTheDocument();
  });

  it('cancel add form closes it', async () => {
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('mcp-add-btn'));
    expect(screen.getByTestId('mcp-add-form')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mcp-add-cancel-btn'));
    expect(screen.queryByTestId('mcp-add-form')).not.toBeInTheDocument();
  });

  it('shows server details: command for stdio, url for http', async () => {
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
    });

    const stdioCard = screen.getByTestId('mcp-server-my-server');
    expect(stdioCard.textContent).toContain('command: node');

    const httpCard = screen.getByTestId('mcp-server-weather-api');
    expect(httpCard.textContent).toContain('url: https://api.weather.com/mcp');
  });

  it('shows error when fetch fails', async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({ ok: false })
    );

    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('mcp-error')).toBeInTheDocument();
    });
  });

  it('shows empty state when no servers configured', async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ servers: [] }),
      })
    );

    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
    });

    expect(screen.getByText('No MCP servers configured.')).toBeInTheDocument();
  });

  it('shows browser testing presets for common automation workflows', async () => {
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
    });

    expect(screen.getByTestId('mcp-preset-agentation')).toHaveTextContent(
      'Agentation Visual Feedback'
    );
    expect(screen.getByText(/agent-browser cli/i)).toBeInTheDocument();
  });

  it('installs the agentation preset as a separate visual feedback tool', async () => {
    render(<McpPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
    });

    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              server: { name: 'playwright', type: 'stdio', enabled: true },
            }),
        });
      }
      if (typeof url === 'string' && url.includes('/api/mcp/servers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ servers: mockServers }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    fireEvent.click(screen.getByTestId('mcp-install-preset-agentation'));

    await waitFor(() => {
      const postCall = mockFetch.mock.calls.find(
        (call: unknown[]) => (call[1] as RequestInit)?.method === 'POST'
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse((postCall![1] as RequestInit).body as string);
      expect(body).toMatchObject({
        name: 'agentation',
        type: 'stdio',
        command: 'npx',
      });
      expect(body.args).toEqual(['-y', 'agentation-mcp', 'server']);
    });
  });
});
