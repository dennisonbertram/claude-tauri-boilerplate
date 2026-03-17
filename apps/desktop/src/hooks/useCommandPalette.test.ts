import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCommandPalette } from './useCommandPalette';
import type { Command } from './useCommands';

const mockCommands: Command[] = [
  {
    name: 'clear',
    description: 'Clear current chat',
    category: 'chat',
    shortcut: 'Cmd+L',
    execute: vi.fn(),
  },
  {
    name: 'compact',
    description: 'Compact conversation context',
    category: 'chat',
    execute: vi.fn(),
  },
  {
    name: 'help',
    description: 'Show help and keyboard shortcuts',
    category: 'chat',
    execute: vi.fn(),
  },
  {
    name: 'model',
    description: 'Switch model',
    category: 'tools',
    execute: vi.fn(),
  },
  {
    name: 'export',
    description: 'Export current session',
    category: 'tools',
    execute: vi.fn(),
  },
];

describe('useCommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -- Initial state --

  describe('Initial state', () => {
    it('starts closed', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      expect(result.current.isOpen).toBe(false);
    });

    it('starts with empty search query', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      expect(result.current.searchQuery).toBe('');
    });

    it('starts with selectedIndex 0', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      expect(result.current.selectedIndex).toBe(0);
    });

    it('returns all commands as filteredCommands initially', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      expect(result.current.filteredCommands).toEqual(mockCommands);
    });
  });

  // -- Open / Close --

  describe('Open and close', () => {
    it('opens the palette', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      act(() => result.current.open());
      expect(result.current.isOpen).toBe(true);
    });

    it('closes the palette', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      act(() => result.current.open());
      act(() => result.current.close());
      expect(result.current.isOpen).toBe(false);
    });

    it('resets search query on close', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      act(() => result.current.open());
      act(() => result.current.setSearchQuery('hel'));
      act(() => result.current.close());
      expect(result.current.searchQuery).toBe('');
    });

    it('resets selectedIndex on close', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      act(() => result.current.open());
      act(() => result.current.setSelectedIndex(3));
      act(() => result.current.close());
      expect(result.current.selectedIndex).toBe(0);
    });

    it('opens with an initial query', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      act(() => result.current.open('cl'));
      expect(result.current.isOpen).toBe(true);
      expect(result.current.searchQuery).toBe('cl');
    });

    it('resets search query on open without initial query', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      act(() => {
        result.current.handleInputChange('/hel');
      });
      act(() => result.current.close());
      act(() => result.current.open());
      expect(result.current.searchQuery).toBe('');
    });
  });

  // -- Filtering --

  describe('Filtering', () => {
    it('filters commands by name', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      act(() => result.current.open());
      act(() => result.current.setSearchQuery('cle'));
      expect(result.current.filteredCommands).toHaveLength(1);
      expect(result.current.filteredCommands[0].name).toBe('clear');
    });

    it('filters commands by description', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      act(() => result.current.open());
      act(() => result.current.setSearchQuery('session'));
      expect(result.current.filteredCommands).toHaveLength(1);
      expect(result.current.filteredCommands[0].name).toBe('export');
    });

    it('fuzzy-filters commands by subsequence', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      act(() => result.current.open());
      act(() => result.current.setSearchQuery('cmpt'));
      expect(result.current.filteredCommands).toHaveLength(1);
      expect(result.current.filteredCommands[0].name).toBe('compact');
    });

    it('filters case-insensitively', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      act(() => result.current.open());
      act(() => result.current.setSearchQuery('HELP'));
      expect(result.current.filteredCommands).toHaveLength(1);
      expect(result.current.filteredCommands[0].name).toBe('help');
    });

    it('returns all commands when query is empty', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      act(() => result.current.open());
      act(() => result.current.setSearchQuery(''));
      expect(result.current.filteredCommands).toHaveLength(mockCommands.length);
    });

    it('returns empty array when nothing matches', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      act(() => result.current.open());
      act(() => result.current.setSearchQuery('zzzzz'));
      expect(result.current.filteredCommands).toHaveLength(0);
    });

    it('resets selectedIndex when search query changes', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      act(() => result.current.open());
      act(() => result.current.setSelectedIndex(3));
      act(() => result.current.setSearchQuery('cl'));
      expect(result.current.selectedIndex).toBe(0);
    });
  });

  // -- Execute --

  describe('Execute', () => {
    it('calls execute on the command and closes', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      act(() => result.current.open());
      act(() => result.current.execute(mockCommands[0]));
      expect(mockCommands[0].execute).toHaveBeenCalledOnce();
      expect(result.current.isOpen).toBe(false);
    });

    it('resets state after executing', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      act(() => result.current.open());
      act(() => result.current.setSearchQuery('clear'));
      act(() => result.current.setSelectedIndex(2));
      act(() => result.current.execute(mockCommands[0]));
      expect(result.current.searchQuery).toBe('');
      expect(result.current.selectedIndex).toBe(0);
    });
  });

  // -- handleInputChange (slash detection) --

  describe('handleInputChange', () => {
    it('opens palette when "/" is typed at start of input', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      let handled: boolean;
      act(() => {
        handled = result.current.handleInputChange('/');
      });
      expect(handled!).toBe(true);
      expect(result.current.isOpen).toBe(true);
      expect(result.current.filteredCommands).toHaveLength(mockCommands.length);
    });

    it('updates search query as user types after "/"', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      act(() => {
        result.current.handleInputChange('/cl');
      });
      expect(result.current.searchQuery).toBe('cl');
    });

    it('opens palette when "/" appears after text', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      let handled: boolean;
      act(() => {
        handled = result.current.handleInputChange('hello /cmd');
      });
      expect(handled!).toBe(true);
      expect(result.current.isOpen).toBe(true);
      expect(result.current.searchQuery).toBe('cmd');
    });

    it('opens palette when "/" appears after punctuation', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      act(() => {
        result.current.handleInputChange('hello world, /clo');
      });
      expect(result.current.isOpen).toBe(true);
      expect(result.current.searchQuery).toBe('clo');
    });

    it('closes palette when input no longer starts with "/"', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      act(() => {
        result.current.handleInputChange('/');
      });
      expect(result.current.isOpen).toBe(true);
      act(() => {
        result.current.handleInputChange('hello');
      });
      expect(result.current.isOpen).toBe(false);
    });

    it('closes palette when input is cleared', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      act(() => {
        result.current.handleInputChange('/');
      });
      expect(result.current.isOpen).toBe(true);
      act(() => {
        result.current.handleInputChange('');
      });
      expect(result.current.isOpen).toBe(false);
    });

    it('strips the leading "/" from the search query', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      act(() => {
        result.current.handleInputChange('/compact');
      });
      expect(result.current.searchQuery).toBe('compact');
    });

    it('supports fuzzy search via slash autocomplete input', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));
      act(() => {
        result.current.handleInputChange('/cmpt');
      });
      expect(result.current.filteredCommands).toHaveLength(1);
      expect(result.current.filteredCommands[0].name).toBe('compact');
    });
  });

  // -- Cmd+K shortcut --

  describe('Cmd+K shortcut', () => {
    it('opens palette on Cmd+K', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'k', metaKey: true })
        );
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('closes palette on Cmd+K when already open', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));

      act(() => result.current.open());
      expect(result.current.isOpen).toBe(true);

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'k', metaKey: true })
        );
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('opens palette on Ctrl+K', () => {
      const { result } = renderHook(() => useCommandPalette(mockCommands));

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })
        );
      });

      expect(result.current.isOpen).toBe(true);
    });
  });
});
