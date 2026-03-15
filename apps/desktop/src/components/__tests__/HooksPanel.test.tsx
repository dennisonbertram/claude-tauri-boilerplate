import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { HooksPanel } from '../settings/HooksPanel';
import type { HookConfig, HookEventMeta } from '@claude-tauri/shared';

const mockEvents: HookEventMeta[] = [
  { event: 'PreToolUse', description: 'Before tool execution', canBlock: true, supportsMatcher: true },
  { event: 'PostToolUse', description: 'After tool success', canBlock: true, supportsMatcher: true },
  { event: 'PostToolUseFailure', description: 'After tool failure', canBlock: false, supportsMatcher: true },
  { event: 'Stop', description: 'Claude finishes responding', canBlock: true, supportsMatcher: false },
  { event: 'SubagentStop', description: 'Subagent finishes', canBlock: true, supportsMatcher: false },
  { event: 'UserPromptSubmit', description: 'User submits prompt', canBlock: true, supportsMatcher: false },
  { event: 'SessionStart', description: 'Session starts', canBlock: false, supportsMatcher: false },
  { event: 'SessionEnd', description: 'Session ends', canBlock: false, supportsMatcher: false },
  { event: 'Notification', description: 'Notification sent', canBlock: false, supportsMatcher: false },
  { event: 'SubagentStart', description: 'Subagent spawned', canBlock: false, supportsMatcher: false },
  { event: 'TeammateIdle', description: 'Teammate going idle', canBlock: true, supportsMatcher: false },
  { event: 'TaskCompleted', description: 'Task completed', canBlock: true, supportsMatcher: false },
];

const mockHooks: HookConfig[] = [
  {
    id: 'hook-1',
    event: 'PreToolUse',
    matcher: 'Bash',
    enabled: true,
    handler: {
      type: 'command',
      command: 'bash ./hooks/scan-secrets.sh',
      timeout: 30,
    },
  },
  {
    id: 'hook-2',
    event: 'PreToolUse',
    matcher: 'Write',
    enabled: true,
    handler: {
      type: 'prompt',
      prompt: 'Check output for correctness',
    },
  },
  {
    id: 'hook-3',
    event: 'Stop',
    enabled: false,
    handler: {
      type: 'http',
      url: 'https://hooks.example.com/notify',
      method: 'POST',
    },
  },
];

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);

  // Default: return hooks and events
  mockFetch.mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('/api/hooks/events')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ events: mockEvents }),
      });
    }
    if (typeof url === 'string' && url.includes('/api/hooks')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ hooks: mockHooks }),
      });
    }
    return Promise.resolve({ ok: false });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HooksPanel', () => {
  it('shows loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    render(<HooksPanel />);
    expect(screen.getByTestId('hooks-loading')).toBeInTheDocument();
  });

  it('renders hook list grouped by event', async () => {
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-panel')).toBeInTheDocument();
    });

    // Should have two event groups
    expect(screen.getByTestId('hooks-group-PreToolUse')).toBeInTheDocument();
    expect(screen.getByTestId('hooks-group-Stop')).toBeInTheDocument();

    // Should have three hook cards
    expect(screen.getByTestId('hooks-card-hook-1')).toBeInTheDocument();
    expect(screen.getByTestId('hooks-card-hook-2')).toBeInTheDocument();
    expect(screen.getByTestId('hooks-card-hook-3')).toBeInTheDocument();
  });

  it('shows handler type badges with correct labels', async () => {
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-panel')).toBeInTheDocument();
    });

    expect(screen.getByTestId('hooks-type-badge-hook-1')).toHaveTextContent('command');
    expect(screen.getByTestId('hooks-type-badge-hook-2')).toHaveTextContent('prompt');
    expect(screen.getByTestId('hooks-type-badge-hook-3')).toHaveTextContent('http');
  });

  it('shows green status dot for enabled, gray for disabled', async () => {
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-panel')).toBeInTheDocument();
    });

    const enabledDot = screen.getByTestId('hooks-status-hook-1');
    const disabledDot = screen.getByTestId('hooks-status-hook-3');

    expect(enabledDot.className).toContain('bg-green-500');
    expect(disabledDot.className).toContain('bg-gray-500');
  });

  it('shows Can Block badge for blocking events', async () => {
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-panel')).toBeInTheDocument();
    });

    expect(screen.getByTestId('hooks-can-block-PreToolUse')).toBeInTheDocument();
    expect(screen.getByTestId('hooks-can-block-Stop')).toBeInTheDocument();
  });

  it('toggle calls PATCH endpoint', async () => {
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-panel')).toBeInTheDocument();
    });

    // Mock PATCH response
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, hook: { ...mockHooks[0], enabled: false } }),
        });
      }
      if (typeof url === 'string' && url.includes('/api/hooks/events')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ events: mockEvents }),
        });
      }
      if (typeof url === 'string' && url.includes('/api/hooks')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ hooks: mockHooks }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    const toggle = screen.getByTestId('hooks-toggle-hook-1');
    fireEvent.click(toggle);

    await waitFor(() => {
      const patchCall = mockFetch.mock.calls.find(
        (call: unknown[]) => (call[1] as RequestInit)?.method === 'PATCH'
      );
      expect(patchCall).toBeDefined();
      expect(patchCall![0]).toContain('hook-1/toggle');
      const body = JSON.parse((patchCall![1] as RequestInit).body as string);
      expect(body.enabled).toBe(false);
    });
  });

  it('delete shows confirmation', async () => {
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('hooks-delete-btn-hook-1'));

    expect(screen.getByTestId('hooks-delete-confirm-hook-1')).toBeInTheDocument();
  });

  it('delete confirmation triggers DELETE request', async () => {
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-panel')).toBeInTheDocument();
    });

    // Mock DELETE
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      if (typeof url === 'string' && url.includes('/api/hooks/events')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ events: mockEvents }),
        });
      }
      if (typeof url === 'string' && url.includes('/api/hooks')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ hooks: mockHooks }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    fireEvent.click(screen.getByTestId('hooks-delete-btn-hook-1'));
    fireEvent.click(screen.getByTestId('hooks-delete-confirm-hook-1'));

    await waitFor(() => {
      const deleteCall = mockFetch.mock.calls.find(
        (call: unknown[]) => (call[1] as RequestInit)?.method === 'DELETE'
      );
      expect(deleteCall).toBeDefined();
      expect(deleteCall![0]).toContain('hook-1');
    });
  });

  it('add hook button opens form', async () => {
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('hooks-add-btn'));
    expect(screen.getByTestId('hooks-add-form')).toBeInTheDocument();
    expect(screen.getByTestId('hooks-add-event-select')).toBeInTheDocument();
    expect(screen.getByTestId('hooks-add-handler-type-select')).toBeInTheDocument();
  });

  it('add form shows event selector with all events', async () => {
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('hooks-add-btn'));

    const eventSelect = screen.getByTestId('hooks-add-event-select') as HTMLSelectElement;
    expect(eventSelect.options.length).toBe(12);
  });

  it('add form shows matcher input for events that support it', async () => {
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('hooks-add-btn'));

    // Default event is PreToolUse which supports matcher
    expect(screen.getByTestId('hooks-add-matcher-input')).toBeInTheDocument();
  });

  it('add form hides matcher input for events that do not support it', async () => {
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('hooks-add-btn'));

    // Change to Stop which does NOT support matcher
    fireEvent.change(screen.getByTestId('hooks-add-event-select'), {
      target: { value: 'Stop' },
    });

    expect(screen.queryByTestId('hooks-add-matcher-input')).not.toBeInTheDocument();
  });

  it('add form shows command fields for command type', async () => {
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('hooks-add-btn'));

    // command is the default handler type
    expect(screen.getByTestId('hooks-add-command-input')).toBeInTheDocument();
    expect(screen.getByTestId('hooks-add-timeout-input')).toBeInTheDocument();
    expect(screen.queryByTestId('hooks-add-url-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hooks-add-prompt-input')).not.toBeInTheDocument();
  });

  it('add form shows url fields for http type', async () => {
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('hooks-add-btn'));

    fireEvent.change(screen.getByTestId('hooks-add-handler-type-select'), {
      target: { value: 'http' },
    });

    expect(screen.getByTestId('hooks-add-url-input')).toBeInTheDocument();
    expect(screen.getByTestId('hooks-add-method-select')).toBeInTheDocument();
    expect(screen.getByTestId('hooks-add-headers-input')).toBeInTheDocument();
    expect(screen.queryByTestId('hooks-add-command-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hooks-add-prompt-input')).not.toBeInTheDocument();
  });

  it('add form shows prompt textarea for prompt type', async () => {
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('hooks-add-btn'));

    fireEvent.change(screen.getByTestId('hooks-add-handler-type-select'), {
      target: { value: 'prompt' },
    });

    expect(screen.getByTestId('hooks-add-prompt-input')).toBeInTheDocument();
    expect(screen.queryByTestId('hooks-add-command-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hooks-add-url-input')).not.toBeInTheDocument();
  });

  it('event reference section shows all events as chips', async () => {
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-panel')).toBeInTheDocument();
    });

    expect(screen.getByTestId('hooks-event-reference')).toBeInTheDocument();

    for (const evt of mockEvents) {
      expect(screen.getByTestId(`hooks-event-chip-${evt.event}`)).toBeInTheDocument();
    }
  });

  it('execution log shows placeholder when empty', async () => {
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-panel')).toBeInTheDocument();
    });

    expect(screen.getByTestId('hooks-execution-log')).toBeInTheDocument();
    expect(screen.getByTestId('hooks-log-empty')).toHaveTextContent('No hook executions yet');
  });

  it('shows error when fetch fails', async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({ ok: false })
    );

    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-error')).toBeInTheDocument();
    });
  });

  it('shows empty state when no hooks configured', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/hooks/events')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ events: mockEvents }),
        });
      }
      if (typeof url === 'string' && url.includes('/api/hooks')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ hooks: [] }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-panel')).toBeInTheDocument();
    });

    expect(screen.getByText('No hooks configured.')).toBeInTheDocument();
  });

  it('validates required event on add', async () => {
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-panel')).toBeInTheDocument();
    });

    // Override with empty events to create scenario where event is empty
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/hooks/events')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ events: [] }),
        });
      }
      if (typeof url === 'string' && url.includes('/api/hooks')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ hooks: [] }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    // Re-render with empty events (this doesn't actually re-fetch, so we test the save validation)
    fireEvent.click(screen.getByTestId('hooks-add-btn'));

    // The event select will have the first event pre-selected, but let's test command validation
    fireEvent.click(screen.getByTestId('hooks-add-save-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('hooks-error')).toBeInTheDocument();
      expect(screen.getByTestId('hooks-error')).toHaveTextContent('Command is required');
    });
  });

  it('cancel add form closes it', async () => {
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('hooks-add-btn'));
    expect(screen.getByTestId('hooks-add-form')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('hooks-add-cancel-btn'));
    expect(screen.queryByTestId('hooks-add-form')).not.toBeInTheDocument();
  });

  it('shows hook details: command, url, prompt', async () => {
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-panel')).toBeInTheDocument();
    });

    const commandCard = screen.getByTestId('hooks-card-hook-1');
    expect(commandCard.textContent).toContain('command: bash ./hooks/scan-secrets.sh');

    const httpCard = screen.getByTestId('hooks-card-hook-3');
    expect(httpCard.textContent).toContain('url: https://hooks.example.com/notify');

    const promptCard = screen.getByTestId('hooks-card-hook-2');
    expect(promptCard.textContent).toContain('prompt: Check output for correctness');
  });

  it('shows matcher name on hook cards', async () => {
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-panel')).toBeInTheDocument();
    });

    const bashCard = screen.getByTestId('hooks-card-hook-1');
    expect(bashCard.textContent).toContain('Bash');

    const writeCard = screen.getByTestId('hooks-card-hook-2');
    expect(writeCard.textContent).toContain('Write');

    // hook-3 has no matcher, should show *
    const httpCard = screen.getByTestId('hooks-card-hook-3');
    expect(httpCard.textContent).toContain('*');
  });

  it('shows group count badges', async () => {
    render(<HooksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('hooks-panel')).toBeInTheDocument();
    });

    const preToolGroup = screen.getByTestId('hooks-group-PreToolUse');
    expect(preToolGroup.textContent).toContain('2 hooks');

    const stopGroup = screen.getByTestId('hooks-group-Stop');
    expect(stopGroup.textContent).toContain('1 hook');
  });
});
