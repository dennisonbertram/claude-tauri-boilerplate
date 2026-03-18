import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { render, screen, act, fireEvent, within } from '@testing-library/react';
expect.extend(matchers);
import type { ReactNode } from 'react';
import { StatusBar } from '../StatusBar';
import type { StatusBarProps } from '../StatusBar';
import { SettingsPanel } from '../settings/SettingsPanel';
import { SettingsProvider } from '@/contexts/SettingsContext';

function wrapper({ children }: { children: ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>;
}

function renderWithSettings(ui: React.ReactElement) {
  return render(ui, { wrapper });
}

// Mock fetch for GitBranchSegment
const mockFetch = vi.fn();

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', mockFetch);
  vi.useFakeTimers();
  mockFetch.mockImplementation(async (input: string | URL) => {
    const url = String(input);

    if (url.includes('/api/system/diagnostics')) {
      return {
        ok: true,
        json: () =>
          Promise.resolve({
            cpuUsagePercent: 12.5,
            memoryUsageMb: 350,
            memoryUsagePercent: 1.5,
          }),
      };
    }

    if (url.includes('/api/git/status')) {
      return {
        ok: true,
        json: () =>
          Promise.resolve({
            branch: 'main',
            isClean: true,
            modifiedFiles: [],
            stagedFiles: [],
          }),
      };
    }

    if (url.includes('/api/health')) {
      return { ok: true, json: () => Promise.resolve({ status: 'ok' }) };
    }

    return { ok: false, json: () => Promise.resolve({ error: 'Unknown endpoint' }) };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function makeProps(overrides: Partial<StatusBarProps> = {}): StatusBarProps {
  return {
    model: null,
    isStreaming: false,
    toolCalls: new Map(),
    cumulativeUsage: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    },
    sessionTotalCost: 0,
    subagentActiveCount: 0,
    ...overrides,
  };
}

describe('StatusBar', () => {
  it('renders the status bar container with three sections', () => {
    renderWithSettings(<StatusBar {...makeProps()} />);
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar-left')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar-center')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar-right')).toBeInTheDocument();
  });

  describe('ModelSegment', () => {
    it('defaults to Sonnet 4.6 when no settings are persisted', () => {
      renderWithSettings(<StatusBar {...makeProps({ model: 'claude-opus-4-6' })} />);
      expect(screen.getByTestId('model-segment')).toHaveTextContent('Sonnet 4.6');
    });

    it('shows friendly model display name from settings', () => {
      // Default settings model is 'claude-sonnet-4-6' which displays as 'Sonnet 4.6'
      renderWithSettings(<StatusBar {...makeProps({ model: 'claude-sonnet-4-6' })} />);
      expect(screen.getByTestId('model-segment')).toHaveTextContent('Sonnet 4.6');
    });

    it('always renders model segment (allows model switching)', () => {
      // Model segment renders regardless of active session model — uses settings.model
      renderWithSettings(<StatusBar {...makeProps({ model: null })} />);
      expect(screen.getByTestId('model-segment')).toBeInTheDocument();
    });

    it('switches model with number keys while picker is open', () => {
      renderWithSettings(<StatusBar {...makeProps()} />);

      fireEvent.click(within(screen.getByTestId('model-segment')).getByRole('button'));
      fireEvent.keyDown(document, { key: '2' });

      expect(screen.getByTestId('model-segment')).toHaveTextContent('Opus 4.6');
      const savedSettings = JSON.parse(localStorage.getItem('claude-tauri-settings') || '{}');
      expect(savedSettings.model).toBe('claude-opus-4-6');
    });

    it('persists model changes across provider remount', () => {
      const { unmount } = renderWithSettings(<StatusBar {...makeProps()} />);

      fireEvent.click(within(screen.getByTestId('model-segment')).getByRole('button'));
      fireEvent.click(screen.getByRole('button', { name: /haiku 4.5/i }));

      const savedSettings = JSON.parse(localStorage.getItem('claude-tauri-settings') || '{}');
      expect(savedSettings.model).toBe('claude-haiku-4-5-20251001');

      unmount();
      renderWithSettings(<StatusBar {...makeProps()} />);
      expect(screen.getByTestId('model-segment')).toHaveTextContent('Haiku 4.5');
    });
  });

  describe('PermissionModeSegment', () => {
    it('shows "Normal" when permission mode is default', () => {
      renderWithSettings(<StatusBar {...makeProps()} />);
      expect(screen.getByTestId('permission-mode-segment')).toHaveTextContent('Normal');
    });

    it('updates displayed label when permission mode changes in settings', () => {
      renderWithSettings(
        <>
          <StatusBar {...makeProps()} />
          <SettingsPanel isOpen={true} onClose={() => {}} initialTab="advanced" />
        </>,
      );

      const permissionSelect = screen.getByTestId('permission-mode-select');
      const permissionSegment = screen.getByTestId('permission-mode-segment');

      fireEvent.change(permissionSelect, { target: { value: 'plan' } });
      expect(permissionSegment).toHaveTextContent('Plan');

      fireEvent.change(permissionSelect, { target: { value: 'acceptEdits' } });
      expect(permissionSegment).toHaveTextContent('Accept Edits');

      fireEvent.change(permissionSelect, { target: { value: 'bypassPermissions' } });
      expect(permissionSegment).toHaveTextContent('Bypass');
    });

    it('calls onShowSettings with "advanced" tab when clicked', () => {
      const onShowSettings = vi.fn();
      renderWithSettings(<StatusBar {...makeProps({ onShowSettings })} />);
      fireEvent.click(screen.getByTestId('permission-mode-segment'));
      expect(onShowSettings).toHaveBeenCalledWith('advanced');
    });
  });

  describe('ConnectionIndicator', () => {
    it('shows green dot when connected', async () => {
      renderWithSettings(<StatusBar {...makeProps()} />);

      // Wait for the fetch to resolve
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const dot = screen.getByTestId('connection-dot');
      expect(dot).toHaveClass('bg-green-500');
    });

    it('shows red dot when disconnected (fetch fails)', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      renderWithSettings(<StatusBar {...makeProps()} />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const dot = screen.getByTestId('connection-dot');
      expect(dot).toHaveClass('bg-red-500');
    });
  });

  describe('ResourceUsageSegment', () => {
    it('is hidden when showResourceUsage is disabled', () => {
      renderWithSettings(<StatusBar {...makeProps()} />);
      expect(screen.queryByTestId('resource-usage-segment')).not.toBeInTheDocument();
    });

    it('shows resource usage after enabling it in status settings', async () => {
      renderWithSettings(
        <>
          <StatusBar {...makeProps()} />
          <SettingsPanel isOpen={true} onClose={() => {}} initialTab="status" />
        </>,
      );

      const toggle = screen.getByTestId('show-resource-usage-toggle');
      await fireEvent.click(toggle);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByTestId('resource-usage-segment')).toBeInTheDocument();
      expect(screen.getByTestId('resource-usage-cpu')).toHaveTextContent('12.5%');
      expect(screen.getByTestId('resource-usage-memory')).toHaveTextContent('350 MB');
    });

    it('hides when diagnostics endpoint fails', async () => {
      mockFetch.mockImplementation(async (input: string | URL) => {
        const url = String(input);

        if (url.includes('/api/system/diagnostics')) {
          throw new Error('Diagnostic fetch failed');
        }

        if (url.includes('/api/health')) {
          return { ok: true, json: () => Promise.resolve({ status: 'ok' }) };
        }

        return {
          ok: true,
          json: () =>
            Promise.resolve({
              branch: 'main',
              isClean: true,
              modifiedFiles: [],
              stagedFiles: [],
            }),
        };
      });

      renderWithSettings(
        <>
          <StatusBar {...makeProps()} />
          <SettingsPanel isOpen={true} onClose={() => {}} initialTab="status" />
        </>,
      );

      const toggle = screen.getByTestId('show-resource-usage-toggle');
      await fireEvent.click(toggle);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.queryByTestId('resource-usage-segment')).not.toBeInTheDocument();
    });
  });

  describe('ContextUsageSegment', () => {
    it('shows green color when usage is under 50%', () => {
      const props = makeProps({
        cumulativeUsage: {
          inputTokens: 30_000,
          outputTokens: 10_000,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
        },
      });
      renderWithSettings(<StatusBar {...props} />);

      const segment = screen.getByTestId('context-usage-segment');
      expect(segment).toBeInTheDocument();
      const fill = screen.getByTestId('context-usage-fill');
      expect(fill.className).toMatch(/green/);
    });

    it('shows yellow color when usage is between 50% and 80%', () => {
      const props = makeProps({
        cumulativeUsage: {
          inputTokens: 100_000,
          outputTokens: 20_000,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
        },
      });
      renderWithSettings(<StatusBar {...props} />);

      const fill = screen.getByTestId('context-usage-fill');
      expect(fill.className).toMatch(/yellow/);
    });

    it('shows red color when usage is above 80%', () => {
      const props = makeProps({
        cumulativeUsage: {
          inputTokens: 150_000,
          outputTokens: 20_000,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
        },
      });
      renderWithSettings(<StatusBar {...props} />);

      const fill = screen.getByTestId('context-usage-fill');
      expect(fill.className).toMatch(/red/);
    });

    it('shows percentage text', () => {
      const props = makeProps({
        cumulativeUsage: {
          inputTokens: 50_000,
          outputTokens: 50_000,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
        },
      });
      renderWithSettings(<StatusBar {...props} />);

      expect(screen.getByTestId('context-usage-segment')).toHaveTextContent('50%');
    });

    it('does not render when usage is zero', () => {
      renderWithSettings(<StatusBar {...makeProps()} />);
      expect(screen.queryByTestId('context-usage-segment')).not.toBeInTheDocument();
    });
  });

  describe('CostSegment', () => {
    it('formats cost correctly', () => {
      renderWithSettings(<StatusBar {...makeProps({ sessionTotalCost: 1.24 })} />);
      expect(screen.getByTestId('cost-segment')).toHaveTextContent('$1.24');
    });

    it('formats sub-cent costs with precision', () => {
      renderWithSettings(<StatusBar {...makeProps({ sessionTotalCost: 0.001 })} />);
      expect(screen.getByTestId('cost-segment')).toHaveTextContent('$0.0010');
    });

    it('does not render when cost is zero', () => {
      renderWithSettings(<StatusBar {...makeProps({ sessionTotalCost: 0 })} />);
      expect(screen.queryByTestId('cost-segment')).not.toBeInTheDocument();
    });
  });

  describe('TurnTimer', () => {
    it('is hidden when not streaming', () => {
      renderWithSettings(<StatusBar {...makeProps({ isStreaming: false })} />);
      expect(screen.queryByTestId('turn-timer')).not.toBeInTheDocument();
    });

    it('shows timer when streaming', () => {
      renderWithSettings(<StatusBar {...makeProps({ isStreaming: true })} />);
      expect(screen.getByTestId('turn-timer')).toBeInTheDocument();
      expect(screen.getByTestId('turn-timer')).toHaveTextContent('0:00');
    });

    it('counts up while streaming', () => {
      renderWithSettings(<StatusBar {...makeProps({ isStreaming: true })} />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByTestId('turn-timer')).toHaveTextContent('0:05');
    });

    it('resets when streaming stops and restarts', () => {
      const { rerender } = renderWithSettings(<StatusBar {...makeProps({ isStreaming: true })} />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByTestId('turn-timer')).toHaveTextContent('0:05');

      // Stop streaming
      rerender(<StatusBar {...makeProps({ isStreaming: false })} />);
      expect(screen.queryByTestId('turn-timer')).not.toBeInTheDocument();

      // Restart streaming
      rerender(<StatusBar {...makeProps({ isStreaming: true })} />);
      expect(screen.getByTestId('turn-timer')).toHaveTextContent('0:00');
    });
  });

  describe('ActiveToolDisplay', () => {
    it('is hidden when no tools are running', () => {
      renderWithSettings(<StatusBar {...makeProps({ toolCalls: new Map() })} />);
      expect(screen.queryByTestId('active-tool-display')).not.toBeInTheDocument();
    });

    it('shows tool name when a tool is running', () => {
      const toolCalls = new Map([
        [
          'tool-1',
          {
            toolUseId: 'tool-1',
            name: 'Read',
            status: 'running' as const,
            input: '{}',
          },
        ],
      ]);
      renderWithSettings(<StatusBar {...makeProps({ toolCalls })} />);

      const display = screen.getByTestId('active-tool-display');
      expect(display).toBeInTheDocument();
      expect(display).toHaveTextContent('Read');
    });

    it('does not show completed tools', () => {
      const toolCalls = new Map([
        [
          'tool-1',
          {
            toolUseId: 'tool-1',
            name: 'Read',
            status: 'complete' as const,
            input: '{}',
          },
        ],
      ]);
      renderWithSettings(<StatusBar {...makeProps({ toolCalls })} />);

      expect(screen.queryByTestId('active-tool-display')).not.toBeInTheDocument();
    });
  });

  describe('AgentCountBadge', () => {
    it('is hidden when subagent count is 0', () => {
      renderWithSettings(<StatusBar {...makeProps({ subagentActiveCount: 0 })} />);
      expect(screen.queryByTestId('agent-count-badge')).not.toBeInTheDocument();
    });

    it('shows badge with count when subagents are active', () => {
      renderWithSettings(<StatusBar {...makeProps({ subagentActiveCount: 3 })} />);
      const badge = screen.getByTestId('agent-count-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('3');
    });
  });

  describe('GitBranchSegment', () => {
    it('shows branch name from git status', async () => {
      renderWithSettings(<StatusBar {...makeProps()} />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByTestId('git-branch-segment')).toHaveTextContent('main');
    });
  });
});
