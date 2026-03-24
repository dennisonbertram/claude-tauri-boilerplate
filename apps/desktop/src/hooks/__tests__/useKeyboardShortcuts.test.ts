import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useKeyboardShortcuts,
  formatShortcut,
  type ShortcutDefinition,
} from '../useKeyboardShortcuts';

// Helper to dispatch keyboard events on the window
function pressKey(key: string, opts: Partial<KeyboardEvent> = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  window.dispatchEvent(event);
  return event;
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -- Registration and Firing --

  describe('Registration and firing', () => {
    it('fires the handler when the registered shortcut is pressed', () => {
      const handler = vi.fn();
      const shortcuts: ShortcutDefinition[] = [
        {
          id: 'test-shortcut',
          key: 'k',
          meta: true,
          label: 'Test Shortcut',
          category: 'general',
          handler,
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      act(() => {
        pressKey('k', { metaKey: true });
      });

      expect(handler).toHaveBeenCalledOnce();
    });

    it('does not fire handler when wrong key is pressed', () => {
      const handler = vi.fn();
      const shortcuts: ShortcutDefinition[] = [
        {
          id: 'test-shortcut',
          key: 'k',
          meta: true,
          label: 'Test Shortcut',
          category: 'general',
          handler,
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      act(() => {
        pressKey('j', { metaKey: true });
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('does not fire handler when modifier does not match', () => {
      const handler = vi.fn();
      const shortcuts: ShortcutDefinition[] = [
        {
          id: 'test-shortcut',
          key: 'k',
          meta: true,
          label: 'Test Shortcut',
          category: 'general',
          handler,
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      act(() => {
        // Press k without meta
        pressKey('k');
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('registers multiple shortcuts independently', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const shortcuts: ShortcutDefinition[] = [
        {
          id: 'shortcut-1',
          key: 'k',
          meta: true,
          label: 'Open Palette',
          category: 'general',
          handler: handler1,
        },
        {
          id: 'shortcut-2',
          key: 'n',
          meta: true,
          label: 'New Session',
          category: 'chat',
          handler: handler2,
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      act(() => {
        pressKey('k', { metaKey: true });
      });
      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).not.toHaveBeenCalled();

      act(() => {
        pressKey('n', { metaKey: true });
      });
      expect(handler2).toHaveBeenCalledOnce();
    });

    it('handles shift modifier correctly', () => {
      const handler = vi.fn();
      const shortcuts: ShortcutDefinition[] = [
        {
          id: 'help',
          key: '?',
          meta: true,
          shift: true,
          label: 'Show Help',
          category: 'general',
          handler,
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      // Without shift - should not fire
      act(() => {
        pressKey('?', { metaKey: true });
      });
      expect(handler).not.toHaveBeenCalled();

      // With shift - should fire
      act(() => {
        pressKey('?', { metaKey: true, shiftKey: true });
      });
      expect(handler).toHaveBeenCalledOnce();
    });

    it('handles Escape key without modifiers', () => {
      const handler = vi.fn();
      const shortcuts: ShortcutDefinition[] = [
        {
          id: 'cancel',
          key: 'Escape',
          label: 'Cancel',
          category: 'general',
          handler,
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      act(() => {
        pressKey('Escape');
      });

      expect(handler).toHaveBeenCalledOnce();
    });

    it('prevents default on matched shortcuts', () => {
      const handler = vi.fn();
      const shortcuts: ShortcutDefinition[] = [
        {
          id: 'test',
          key: 'k',
          meta: true,
          label: 'Test',
          category: 'general',
          handler,
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      let prevented = false;
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'k',
          metaKey: true,
          bubbles: true,
          cancelable: true,
        });
        // Override preventDefault to check it's called
        event.preventDefault = () => {
          prevented = true;
        };
        window.dispatchEvent(event);
      });

      expect(prevented).toBe(true);
    });
  });

  // -- Disabled Shortcuts --

  describe('Disabled shortcuts', () => {
    it('does not fire handler when shortcut is disabled', () => {
      const handler = vi.fn();
      const shortcuts: ShortcutDefinition[] = [
        {
          id: 'test',
          key: 'k',
          meta: true,
          label: 'Test',
          category: 'general',
          handler,
          enabled: false,
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      act(() => {
        pressKey('k', { metaKey: true });
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('fires handler when enabled is explicitly true', () => {
      const handler = vi.fn();
      const shortcuts: ShortcutDefinition[] = [
        {
          id: 'test',
          key: 'k',
          meta: true,
          label: 'Test',
          category: 'general',
          handler,
          enabled: true,
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      act(() => {
        pressKey('k', { metaKey: true });
      });

      expect(handler).toHaveBeenCalledOnce();
    });
  });

  // -- Cleanup --

  describe('Cleanup on unmount', () => {
    it('removes event listeners on unmount', () => {
      const handler = vi.fn();
      const shortcuts: ShortcutDefinition[] = [
        {
          id: 'test',
          key: 'k',
          meta: true,
          label: 'Test',
          category: 'general',
          handler,
        },
      ];

      const { unmount } = renderHook(() => useKeyboardShortcuts(shortcuts));

      unmount();

      act(() => {
        pressKey('k', { metaKey: true });
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // -- Return value --

  describe('Return value', () => {
    it('returns the list of registered shortcuts', () => {
      const shortcuts: ShortcutDefinition[] = [
        {
          id: 'palette',
          key: 'k',
          meta: true,
          label: 'Command Palette',
          category: 'general',
          handler: vi.fn(),
        },
        {
          id: 'new-session',
          key: 'n',
          meta: true,
          label: 'New Session',
          category: 'chat',
          handler: vi.fn(),
        },
      ];

      const { result } = renderHook(() => useKeyboardShortcuts(shortcuts));

      expect(result.current.shortcuts).toHaveLength(2);
      expect(result.current.shortcuts[0].id).toBe('palette');
      expect(result.current.shortcuts[1].id).toBe('new-session');
    });
  });
});

// -- Platform-aware formatting --

describe('formatShortcut', () => {
  it('uses Cmd symbol on Mac', () => {
    const shortcut: ShortcutDefinition = {
      id: 'test',
      key: 'K',
      meta: true,
      label: 'Test',
      category: 'general',
      handler: vi.fn(),
    };

    const result = formatShortcut(shortcut, true);
    expect(result).toContain('\u2318'); // Cmd symbol
    expect(result).toContain('K');
  });

  it('uses Ctrl on non-Mac platforms', () => {
    const shortcut: ShortcutDefinition = {
      id: 'test',
      key: 'K',
      meta: true,
      label: 'Test',
      category: 'general',
      handler: vi.fn(),
    };

    const result = formatShortcut(shortcut, false);
    expect(result).toContain('Ctrl');
    expect(result).toContain('K');
  });

  it('includes Shift when shift modifier is present', () => {
    const shortcut: ShortcutDefinition = {
      id: 'test',
      key: '?',
      meta: true,
      shift: true,
      label: 'Test',
      category: 'general',
      handler: vi.fn(),
    };

    const result = formatShortcut(shortcut, true);
    expect(result).toContain('\u21E7'); // Shift symbol
    expect(result).toContain('?');
  });

  it('returns just the key when no modifiers', () => {
    const shortcut: ShortcutDefinition = {
      id: 'test',
      key: 'Escape',
      label: 'Cancel',
      category: 'general',
      handler: vi.fn(),
    };

    const result = formatShortcut(shortcut, true);
    expect(result).toBe('Esc');
  });

  it('formats Enter key nicely', () => {
    const shortcut: ShortcutDefinition = {
      id: 'test',
      key: 'Enter',
      meta: true,
      label: 'Submit',
      category: 'chat',
      handler: vi.fn(),
    };

    const result = formatShortcut(shortcut, true);
    expect(result).toContain('\u2318');
    expect(result).toContain('\u23CE'); // Enter/Return symbol
  });
});

// -- Conflict detection --

describe('Shortcut conflict detection', () => {
  it('logs a warning when duplicate shortcut ids are registered', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const shortcuts: ShortcutDefinition[] = [
      {
        id: 'duplicate',
        key: 'k',
        meta: true,
        label: 'First',
        category: 'general',
        handler: vi.fn(),
      },
      {
        id: 'duplicate',
        key: 'n',
        meta: true,
        label: 'Second',
        category: 'general',
        handler: vi.fn(),
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('duplicate')
    );

    consoleSpy.mockRestore();
  });

  it('logs a warning when two shortcuts share the same key combination', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const shortcuts: ShortcutDefinition[] = [
      {
        id: 'first',
        key: 'k',
        meta: true,
        label: 'First',
        category: 'general',
        handler: vi.fn(),
      },
      {
        id: 'second',
        key: 'k',
        meta: true,
        label: 'Second',
        category: 'general',
        handler: vi.fn(),
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('conflict')
    );

    consoleSpy.mockRestore();
  });
});
