import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Command } from './useCommands';
import { rankCommandsByRelevance } from './commandSearch';

export interface UseCommandPaletteOptions {
  commands: Command[];
  filterCommands: (query: string) => Command[];
}

export interface UseCommandPaletteReturn {
  isOpen: boolean;
  searchQuery: string;
  selectedIndex: number;
  filteredCommands: Command[];
  open: (initialQuery?: string) => void;
  close: () => void;
  setSearchQuery: (query: string) => void;
  setSelectedIndex: (index: number) => void;
  execute: (command: Command) => void;
  handleInputChange: (value: string) => boolean;
  handleCommandSelect: (command: Command) => void;
}

/**
 * Manages command palette state: open/close, search filtering,
 * keyboard navigation, Cmd+K shortcut, and "/" trigger detection.
 *
 * Accepts either an array of commands (filtering is done internally)
 * or an options object with { commands, filterCommands }.
 */
export function useCommandPalette(
  input: Command[] | UseCommandPaletteOptions
): UseCommandPaletteReturn {
  const isArray = Array.isArray(input);
  const commands = isArray ? input : input.commands;
  const externalFilter = isArray ? undefined : input.filterCommands;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQueryInternal] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter commands when palette is open
  const filteredCommands = useMemo(() => {
    if (!isOpen) return commands;
    if (!searchQuery) return commands;

    // Use external filter if provided, otherwise filter internally
    if (externalFilter) {
      return externalFilter(searchQuery);
    }

    return rankCommandsByRelevance(commands, searchQuery);
  }, [commands, isOpen, searchQuery, externalFilter]);

  // Reset selectedIndex when search query changes
  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryInternal(query);
    setSelectedIndex(0);
  }, []);

  const open = useCallback((initialQuery?: string) => {
    setIsOpen(true);
    setSearchQueryInternal(initialQuery ?? '');
    setSelectedIndex(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setSearchQueryInternal('');
    setSelectedIndex(0);
  }, []);

  /**
   * Executes a command and closes the palette.
   */
  const execute = useCallback(
    (command: Command) => {
      command.execute();
      close();
    },
    [close]
  );

  // Alias for execute (used by ChatPage integration)
  const handleCommandSelect = execute;

  /**
   * Processes input value changes and determines whether to open/close the palette.
   * Returns true if the input starts with "/" (palette should handle it),
   * false otherwise.
   */
  const handleInputChange = useCallback(
    (value: string): boolean => {
      if (value.startsWith('/')) {
        const filter = value.slice(1);
        setIsOpen(true);
        setSearchQueryInternal(filter);
        setSelectedIndex(0);
        return true;
      }

      // Input no longer starts with "/" -- close palette if open
      if (isOpen) {
        setIsOpen(false);
        setSearchQueryInternal('');
        setSelectedIndex(0);
      }

      return false;
    },
    [isOpen]
  );

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          close();
        } else {
          open();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, open, close]);

  return {
    isOpen,
    searchQuery,
    selectedIndex,
    filteredCommands,
    open,
    close,
    setSearchQuery,
    setSelectedIndex,
    execute,
    handleInputChange,
    handleCommandSelect,
  };
}
