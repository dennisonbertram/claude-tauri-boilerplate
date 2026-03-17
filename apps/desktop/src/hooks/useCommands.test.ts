import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { mockToastInfo } = vi.hoisted(() => ({
  mockToastInfo: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    info: mockToastInfo,
  },
}));

import { useCommands } from './useCommands';

describe('useCommands', () => {
  const mockContext = {
    clearChat: vi.fn(),
    createSession: vi.fn(),
    exportSession: vi.fn(),
    addDir: vi.fn(),
    showModelSelector: vi.fn(),
    showCostSummary: vi.fn(),
    showSettings: vi.fn(),
    showSessionList: vi.fn(),
    openPullRequests: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockToastInfo.mockReset();
  });

  it('returns a list of built-in commands', () => {
    const { result } = renderHook(() => useCommands(mockContext));
    expect(result.current.commands.length).toBeGreaterThanOrEqual(10);
  });

  it('includes /clear command', () => {
    const { result } = renderHook(() => useCommands(mockContext));
    const cmd = result.current.commands.find((c) => c.name === 'clear');
    expect(cmd).toBeDefined();
    expect(cmd!.description).toBeTruthy();
  });

  it('includes /new command', () => {
    const { result } = renderHook(() => useCommands(mockContext));
    const cmd = result.current.commands.find((c) => c.name === 'new');
    expect(cmd).toBeDefined();
  });

  it('includes /restart command', () => {
    const { result } = renderHook(() => useCommands(mockContext));
    const cmd = result.current.commands.find((c) => c.name === 'restart');
    expect(cmd).toBeDefined();
  });

  it('includes /export command', () => {
    const { result } = renderHook(() => useCommands(mockContext));
    const cmd = result.current.commands.find((c) => c.name === 'export');
    expect(cmd).toBeDefined();
  });

  it('includes /add-dir command', () => {
    const { result } = renderHook(() => useCommands(mockContext));
    const cmd = result.current.commands.find((c) => c.name === 'add-dir');
    expect(cmd).toBeDefined();
  });

  it('includes /help command', () => {
    const { result } = renderHook(() => useCommands(mockContext));
    const cmd = result.current.commands.find((c) => c.name === 'help');
    expect(cmd).toBeDefined();
  });

  it('includes /compact command', () => {
    const { result } = renderHook(() => useCommands(mockContext));
    const cmd = result.current.commands.find((c) => c.name === 'compact');
    expect(cmd).toBeDefined();
  });

  it('includes /model command', () => {
    const { result } = renderHook(() => useCommands(mockContext));
    const cmd = result.current.commands.find((c) => c.name === 'model');
    expect(cmd).toBeDefined();
    expect(cmd!.description).toBeTruthy();
  });

  it('includes /cost command', () => {
    const { result } = renderHook(() => useCommands(mockContext));
    const cmd = result.current.commands.find((c) => c.name === 'cost');
    expect(cmd).toBeDefined();
    expect(cmd!.description).toBeTruthy();
  });

  it('includes /settings command', () => {
    const { result } = renderHook(() => useCommands(mockContext));
    const cmd = result.current.commands.find((c) => c.name === 'settings');
    expect(cmd).toBeDefined();
    expect(cmd!.shortcut).toBe('Cmd+,');
  });

  it('includes /sessions command', () => {
    const { result } = renderHook(() => useCommands(mockContext));
    const cmd = result.current.commands.find((c) => c.name === 'sessions');
    expect(cmd).toBeDefined();
    expect(cmd!.category).toBe('navigation');
    expect(cmd!.shortcut).toBeUndefined();
  });

  it('includes /pr command', () => {
    const { result } = renderHook(() => useCommands(mockContext));
    const cmd = result.current.commands.find((c) => c.name === 'pr');
    expect(cmd).toBeDefined();
    expect(cmd!.category).toBe('navigation');
  });

  describe('command execution', () => {
    it('/clear calls clearChat', async () => {
      const { result } = renderHook(() => useCommands(mockContext));
      const cmd = result.current.commands.find((c) => c.name === 'clear')!;
      await act(async () => {
        await cmd.execute();
      });
      expect(mockContext.clearChat).toHaveBeenCalledOnce();
    });

    it('/new calls createSession', async () => {
      const { result } = renderHook(() => useCommands(mockContext));
      const cmd = result.current.commands.find((c) => c.name === 'new')!;
      await act(async () => {
        await cmd.execute();
      });
      expect(mockContext.createSession).toHaveBeenCalledOnce();
    });

    it('/restart calls createSession', async () => {
      const { result } = renderHook(() => useCommands(mockContext));
      const cmd = result.current.commands.find((c) => c.name === 'restart')!;
      await act(async () => {
        await cmd.execute();
      });
      expect(mockContext.createSession).toHaveBeenCalledOnce();
    });

    it('/export calls exportSession', async () => {
      const { result } = renderHook(() => useCommands(mockContext));
      const cmd = result.current.commands.find((c) => c.name === 'export')!;
      await act(async () => {
        await cmd.execute();
      });
      expect(mockContext.exportSession).toHaveBeenCalledOnce();
    });

    it('/model calls showModelSelector', async () => {
      const { result } = renderHook(() => useCommands(mockContext));
      const cmd = result.current.commands.find((c) => c.name === 'model')!;
      await act(async () => {
        await cmd.execute();
      });
      expect(mockContext.showModelSelector).toHaveBeenCalledOnce();
    });

    it('/cost calls showCostSummary', async () => {
      const { result } = renderHook(() => useCommands(mockContext));
      const cmd = result.current.commands.find((c) => c.name === 'cost')!;
      await act(async () => {
        await cmd.execute();
      });
      expect(mockContext.showCostSummary).toHaveBeenCalledOnce();
    });

    it('/settings calls showSettings', async () => {
      const { result } = renderHook(() => useCommands(mockContext));
      const cmd = result.current.commands.find((c) => c.name === 'settings')!;
      await act(async () => {
        await cmd.execute();
      });
      expect(mockContext.showSettings).toHaveBeenCalledOnce();
    });

    it('/compact shows feedback instead of silently doing nothing', async () => {
      const { result } = renderHook(() => useCommands(mockContext));
      const cmd = result.current.commands.find((c) => c.name === 'compact')!;

      await act(async () => {
        await cmd.execute();
      });

      expect(mockToastInfo).toHaveBeenCalledOnce();
      expect(mockToastInfo).toHaveBeenCalledWith(
        'Context compaction is automatic',
        expect.objectContaining({
          description: 'Configure Auto-Compact in Settings → Advanced',
          duration: 6000,
          action: expect.objectContaining({
            label: 'Open Settings',
          }),
        })
      );

      const options = mockToastInfo.mock.calls[0]?.[1] as
        | { action?: { onClick?: () => void } }
        | undefined;
      options?.action?.onClick?.();
      expect(mockContext.showSettings).toHaveBeenCalledOnce();
    });

    it('/sessions calls showSessionList', async () => {
      const { result } = renderHook(() => useCommands(mockContext));
      const cmd = result.current.commands.find((c) => c.name === 'sessions')!;
      await act(async () => {
        await cmd.execute();
      });
      expect(mockContext.showSessionList).toHaveBeenCalledOnce();
    });

    it('/pr calls openPullRequests', async () => {
      const { result } = renderHook(() => useCommands(mockContext));
      const cmd = result.current.commands.find((c) => c.name === 'pr')!;
      await act(async () => {
        await cmd.execute();
      });
      expect(mockContext.openPullRequests).toHaveBeenCalledOnce();
    });

    it('/add-dir calls addDir when available', async () => {
      const { result } = renderHook(() => useCommands(mockContext));
      const cmd = result.current.commands.find((c) => c.name === 'add-dir')!;
      await act(async () => {
        await cmd.execute();
      });
      expect(mockContext.addDir).toHaveBeenCalledOnce();
    });
  });

  describe('filterCommands', () => {
    it('returns all commands for empty query', () => {
      const { result } = renderHook(() => useCommands(mockContext));
      const filtered = result.current.filterCommands('');
      expect(filtered).toHaveLength(result.current.commands.length);
    });

    it('filters by command name', () => {
      const { result } = renderHook(() => useCommands(mockContext));
      const filtered = result.current.filterCommands('cl');
      expect(filtered.some((c) => c.name === 'clear')).toBe(true);
      expect(filtered.some((c) => c.name === 'new')).toBe(false);
    });

    it('filters by description', () => {
      const { result } = renderHook(() => useCommands(mockContext));
      const filtered = result.current.filterCommands('session');
      expect(filtered.some((c) => c.name === 'new')).toBe(true);
      expect(filtered.some((c) => c.name === 'export')).toBe(true);
    });

    it('is case-insensitive', () => {
      const { result } = renderHook(() => useCommands(mockContext));
      const filtered = result.current.filterCommands('CLEAR');
      expect(filtered.some((c) => c.name === 'clear')).toBe(true);
    });

    it('supports fuzzy matching and ordering', () => {
      const { result } = renderHook(() => useCommands(mockContext));
      const filtered = result.current.filterCommands('cp');
      expect(filtered.length).toBeGreaterThanOrEqual(1);
      expect(filtered[0].name).toBe('compact');
    });

    it('prioritizes prefix matches in ordering', () => {
      const { result } = renderHook(() => useCommands(mockContext));
      const filtered = result.current.filterCommands('co');
      expect(filtered[0].name).toBe('cost');
      expect(filtered[1].name).toBe('compact');
    });
  });
});
