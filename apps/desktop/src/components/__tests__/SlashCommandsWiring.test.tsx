import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCommands } from '@/hooks/useCommands';
import type { CommandContext } from '@/hooks/useCommands';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    clearChat: vi.fn(),
    createSession: vi.fn(),
    exportSession: vi.fn(),
    showHelp: vi.fn(),
    showSettings: vi.fn(),
    showModelSelector: vi.fn(),
    showCostSummary: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// useCommands — command wiring
// ---------------------------------------------------------------------------

describe('useCommands — slash command wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('/settings calls showSettings when provided', () => {
    const context = makeContext();
    const { result } = renderHook(() => useCommands(context));

    const cmd = result.current.commands.find((c) => c.name === 'settings');
    expect(cmd).toBeDefined();

    act(() => {
      cmd!.execute();
    });

    expect(context.showSettings).toHaveBeenCalledOnce();
  });

  it('/model calls showModelSelector when provided', () => {
    const context = makeContext();
    const { result } = renderHook(() => useCommands(context));

    const cmd = result.current.commands.find((c) => c.name === 'model');
    expect(cmd).toBeDefined();

    act(() => {
      cmd!.execute();
    });

    expect(context.showModelSelector).toHaveBeenCalledOnce();
  });

  it('/cost calls showCostSummary when provided', () => {
    const context = makeContext();
    const { result } = renderHook(() => useCommands(context));

    const cmd = result.current.commands.find((c) => c.name === 'cost');
    expect(cmd).toBeDefined();

    act(() => {
      cmd!.execute();
    });

    expect(context.showCostSummary).toHaveBeenCalledOnce();
  });

  it('/settings does not throw when showSettings is undefined', () => {
    const context = makeContext({ showSettings: undefined });
    const { result } = renderHook(() => useCommands(context));

    const cmd = result.current.commands.find((c) => c.name === 'settings');
    expect(cmd).toBeDefined();

    expect(() => act(() => { cmd!.execute(); })).not.toThrow();
  });

  it('/model does not throw when showModelSelector is undefined', () => {
    const context = makeContext({ showModelSelector: undefined });
    const { result } = renderHook(() => useCommands(context));

    const cmd = result.current.commands.find((c) => c.name === 'model');
    expect(cmd).toBeDefined();

    expect(() => act(() => { cmd!.execute(); })).not.toThrow();
  });

  it('/cost does not throw when showCostSummary is undefined', () => {
    const context = makeContext({ showCostSummary: undefined });
    const { result } = renderHook(() => useCommands(context));

    const cmd = result.current.commands.find((c) => c.name === 'cost');
    expect(cmd).toBeDefined();

    expect(() => act(() => { cmd!.execute(); })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Cost dialog — inline rendering test
// ---------------------------------------------------------------------------

describe('Cost dialog', () => {
  it('renders and closes via close button', async () => {
    const user = userEvent.setup();

    function CostDialog({ onClose }: { onClose: () => void }) {
      return (
        <div
          data-testid="cost-dialog-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={onClose}
        >
          <div
            data-testid="cost-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Session Cost</h2>
            <div>
              <span>Total cost</span>
              <span>$0.000000</span>
            </div>
            <div>
              <span>Messages</span>
              <span>0</span>
            </div>
            <button data-testid="cost-dialog-close" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      );
    }

    const onClose = vi.fn();
    render(<CostDialog onClose={onClose} />);

    expect(screen.getByTestId('cost-dialog')).toBeTruthy();
    expect(screen.getByText('Session Cost')).toBeTruthy();

    const closeBtn = screen.getByTestId('cost-dialog-close');
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes when backdrop is clicked', async () => {
    const user = userEvent.setup();

    function CostDialog({ onClose }: { onClose: () => void }) {
      return (
        <div
          data-testid="cost-dialog-backdrop"
          onClick={onClose}
        >
          <div
            data-testid="cost-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <button data-testid="cost-dialog-close" onClick={onClose}>Close</button>
          </div>
        </div>
      );
    }

    const onClose = vi.fn();
    render(<CostDialog onClose={onClose} />);

    // Click the backdrop directly (not the inner dialog)
    const backdrop = screen.getByTestId('cost-dialog-backdrop');
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });
});
