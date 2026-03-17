import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Command, CommandCategory } from '@/hooks/useCommands';

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  chat: 'Chat',
  navigation: 'Navigation',
  tools: 'Tools',
};

const CATEGORY_ORDER: CommandCategory[] = ['chat', 'navigation', 'tools'];

interface CommandPaletteProps {
  commands: Command[];
  filter: string;
  onSelect: (command: Command) => void;
  onClose: () => void;
}

export function CommandPalette({
  commands,
  filter,
  onSelect,
  onClose,
}: CommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateScrollHint = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setShowScrollHint(
      el.scrollHeight > el.clientHeight &&
        el.scrollTop + el.clientHeight < el.scrollHeight - 4
    );
  }, []);

  // Filter commands by name or description
  const filtered = filter
    ? commands.filter(
        (cmd) =>
          cmd.name.toLowerCase().includes(filter.toLowerCase()) ||
          cmd.description.toLowerCase().includes(filter.toLowerCase())
      )
    : commands;

  // Group filtered commands by category
  const grouped = useMemo(() => {
    const groups: { category: CommandCategory; label: string; commands: Command[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const cmds = filtered.filter((c) => c.category === cat);
      if (cmds.length > 0) {
        groups.push({ category: cat, label: CATEGORY_LABELS[cat], commands: cmds });
      }
    }
    // Handle commands without a recognized category
    const uncategorized = filtered.filter(
      (c) => !CATEGORY_ORDER.includes(c.category)
    );
    if (uncategorized.length > 0) {
      groups.push({ category: 'chat' as CommandCategory, label: 'Other', commands: uncategorized });
    }
    return groups;
  }, [filtered]);

  // Build a flat list for keyboard navigation
  const flatFiltered = useMemo(() => {
    return grouped.flatMap((g) => g.commands);
  }, [grouped]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  // Check scroll overflow after filtered commands change
  useEffect(() => {
    const raf = requestAnimationFrame(updateScrollHint);
    return () => cancelAnimationFrame(raf);
  }, [filtered, updateScrollHint]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            flatFiltered.length === 0 ? 0 : (prev + 1) % flatFiltered.length
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            flatFiltered.length === 0
              ? 0
              : (prev - 1 + flatFiltered.length) % flatFiltered.length
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (flatFiltered[selectedIndex]) {
            onSelect(flatFiltered[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatFiltered, selectedIndex, onSelect, onClose]
  );

  const handleMouseEnter = useCallback((flatIndex: number) => {
    setSelectedIndex(flatIndex);
  }, []);

  if (filtered.length === 0) {
    return (
      <div
        data-testid="command-palette"
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-border bg-popover shadow-lg"
      >
        <div className="px-3 py-2 text-sm text-muted-foreground">
          No commands found
        </div>
      </div>
    );
  }

  // Build items with a running flat index for keyboard navigation
  let flatIndex = 0;

  return (
    <div
      data-testid="command-palette"
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onScroll={updateScrollHint}
      className="absolute bottom-full left-0 right-0 mb-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg"
    >
      {grouped.map((group) => (
        <div key={group.category}>
          <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </div>
          <ul className="pb-1" role="listbox">
            {group.commands.map((cmd) => {
              const currentIndex = flatIndex++;
              return (
                <li
                  key={cmd.name}
                  data-testid="command-item"
                  data-selected={currentIndex === selectedIndex ? 'true' : 'false'}
                  role="option"
                  aria-selected={currentIndex === selectedIndex}
                  onClick={() => onSelect(cmd)}
                  onMouseEnter={() => handleMouseEnter(currentIndex)}
                  className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${
                    currentIndex === selectedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'text-popover-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-medium text-primary">
                      /{cmd.name}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {cmd.description}
                    </span>
                  </div>
                  {cmd.shortcut && (
                    <kbd className="ml-2 shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {showScrollHint && (
        <div
          aria-hidden="true"
          className="sticky bottom-0 h-8 bg-gradient-to-t from-popover to-transparent pointer-events-none"
        />
      )}
    </div>
  );
}
