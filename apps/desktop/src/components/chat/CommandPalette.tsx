import { useState, useEffect, useCallback, useRef } from 'react';
import type { Command } from '@/hooks/useCommands';

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
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter commands by name or description
  const filtered = filter
    ? commands.filter(
        (cmd) =>
          cmd.name.toLowerCase().includes(filter.toLowerCase()) ||
          cmd.description.toLowerCase().includes(filter.toLowerCase())
      )
    : commands;

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            filtered.length === 0 ? 0 : (prev + 1) % filtered.length
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            filtered.length === 0
              ? 0
              : (prev - 1 + filtered.length) % filtered.length
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filtered[selectedIndex]) {
            onSelect(filtered[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filtered, selectedIndex, onSelect, onClose]
  );

  const handleMouseEnter = useCallback((index: number) => {
    setSelectedIndex(index);
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

  return (
    <div
      data-testid="command-palette"
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="absolute bottom-full left-0 right-0 mb-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg"
    >
      <ul className="py-1" role="listbox">
        {filtered.map((cmd, index) => (
          <li
            key={cmd.name}
            data-testid="command-item"
            data-selected={index === selectedIndex ? 'true' : 'false'}
            role="option"
            aria-selected={index === selectedIndex}
            onClick={() => onSelect(cmd)}
            onMouseEnter={() => handleMouseEnter(index)}
            className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${
              index === selectedIndex
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
        ))}
      </ul>
    </div>
  );
}
