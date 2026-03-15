import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCommands } from './useCommands';

describe('useCommands', () => {
  const mockContext = {
    clearChat: vi.fn(),
    createSession: vi.fn(),
    exportSession: vi.fn(),
    showModelSelector: vi.fn(),
    showCostSummary: vi.fn(),
    showSettings: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a list of built-in commands', () => {
    const { result } = renderHook(() => useCommands(mockContext));
    expect(result.current.commands.length).toBeGreaterThanOrEqual(8);
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

  it('includes /export command', () => {
    const { result } = renderHook(() => useCommands(mockContext));
    const cmd = result.current.commands.find((c) => c.name === 'export');
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
  });
});
