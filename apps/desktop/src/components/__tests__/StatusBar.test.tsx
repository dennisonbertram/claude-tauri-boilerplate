import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { StatusBar } from '../StatusBar';
import type { StatusBarProps } from '../StatusBar';

// Mock fetch for GitBranchSegment
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  vi.useFakeTimers();
  // Default: git status returns a branch
  mockFetch.mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        branch: 'main',
        isClean: true,
        modifiedFiles: [],
        stagedFiles: [],
      }),
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
    render(<StatusBar {...makeProps()} />);
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar-left')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar-center')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar-right')).toBeInTheDocument();
  });

  describe('ModelSegment', () => {
    it('shows model name when provided', () => {
      render(<StatusBar {...makeProps({ model: 'claude-sonnet-4' })} />);
      expect(screen.getByTestId('model-segment')).toHaveTextContent('claude-sonnet-4');
    });

    it('does not render model segment when model is null', () => {
      render(<StatusBar {...makeProps({ model: null })} />);
      expect(screen.queryByTestId('model-segment')).not.toBeInTheDocument();
    });
  });

  describe('PermissionModeSegment', () => {
    it('shows "Normal" mode indicator', () => {
      render(<StatusBar {...makeProps()} />);
      expect(screen.getByTestId('permission-mode-segment')).toHaveTextContent('Normal');
    });
  });

  describe('ConnectionIndicator', () => {
    it('shows green dot when connected', async () => {
      render(<StatusBar {...makeProps()} />);

      // Wait for the fetch to resolve
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const dot = screen.getByTestId('connection-dot');
      expect(dot).toHaveClass('bg-green-500');
    });

    it('shows red dot when disconnected (fetch fails)', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<StatusBar {...makeProps()} />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const dot = screen.getByTestId('connection-dot');
      expect(dot).toHaveClass('bg-red-500');
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
      render(<StatusBar {...props} />);

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
      render(<StatusBar {...props} />);

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
      render(<StatusBar {...props} />);

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
      render(<StatusBar {...props} />);

      expect(screen.getByTestId('context-usage-segment')).toHaveTextContent('50%');
    });

    it('does not render when usage is zero', () => {
      render(<StatusBar {...makeProps()} />);
      expect(screen.queryByTestId('context-usage-segment')).not.toBeInTheDocument();
    });
  });

  describe('CostSegment', () => {
    it('formats cost correctly', () => {
      render(<StatusBar {...makeProps({ sessionTotalCost: 1.24 })} />);
      expect(screen.getByTestId('cost-segment')).toHaveTextContent('$1.24');
    });

    it('formats sub-cent costs with precision', () => {
      render(<StatusBar {...makeProps({ sessionTotalCost: 0.001 })} />);
      expect(screen.getByTestId('cost-segment')).toHaveTextContent('$0.0010');
    });

    it('does not render when cost is zero', () => {
      render(<StatusBar {...makeProps({ sessionTotalCost: 0 })} />);
      expect(screen.queryByTestId('cost-segment')).not.toBeInTheDocument();
    });
  });

  describe('TurnTimer', () => {
    it('is hidden when not streaming', () => {
      render(<StatusBar {...makeProps({ isStreaming: false })} />);
      expect(screen.queryByTestId('turn-timer')).not.toBeInTheDocument();
    });

    it('shows timer when streaming', () => {
      render(<StatusBar {...makeProps({ isStreaming: true })} />);
      expect(screen.getByTestId('turn-timer')).toBeInTheDocument();
      expect(screen.getByTestId('turn-timer')).toHaveTextContent('0:00');
    });

    it('counts up while streaming', () => {
      render(<StatusBar {...makeProps({ isStreaming: true })} />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByTestId('turn-timer')).toHaveTextContent('0:05');
    });

    it('resets when streaming stops and restarts', () => {
      const { rerender } = render(<StatusBar {...makeProps({ isStreaming: true })} />);

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
      render(<StatusBar {...makeProps({ toolCalls: new Map() })} />);
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
      render(<StatusBar {...makeProps({ toolCalls })} />);

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
      render(<StatusBar {...makeProps({ toolCalls })} />);

      expect(screen.queryByTestId('active-tool-display')).not.toBeInTheDocument();
    });
  });

  describe('AgentCountBadge', () => {
    it('is hidden when subagent count is 0', () => {
      render(<StatusBar {...makeProps({ subagentActiveCount: 0 })} />);
      expect(screen.queryByTestId('agent-count-badge')).not.toBeInTheDocument();
    });

    it('shows badge with count when subagents are active', () => {
      render(<StatusBar {...makeProps({ subagentActiveCount: 3 })} />);
      const badge = screen.getByTestId('agent-count-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('3');
    });
  });

  describe('GitBranchSegment', () => {
    it('shows branch name from git status', async () => {
      render(<StatusBar {...makeProps()} />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByTestId('git-branch-segment')).toHaveTextContent('main');
    });
  });
});
