import { useRef, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { CommandPalette } from './CommandPalette';
import { ShortcutBadge } from '@/components/ShortcutBadge';
import type { Command } from '@/hooks/useCommands';

interface ChatInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  isLoading: boolean;
  showPalette: boolean;
  paletteFilter: string;
  paletteCommands: Command[];
  onCommandSelect: (cmd: Command) => void;
  onPaletteClose: () => void;
}

export function ChatInput({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  showPalette,
  paletteFilter,
  paletteCommands,
  onCommandSelect,
  onPaletteClose,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // When palette is open, delegate navigation keys to it
      if (showPalette) {
        if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
          e.preventDefault();
          // Forward the event to the palette
          const paletteEl = paletteRef.current?.querySelector(
            '[data-testid="command-palette"]'
          );
          if (paletteEl) {
            paletteEl.dispatchEvent(
              new KeyboardEvent('keydown', {
                key: e.key,
                bubbles: true,
              })
            );
          }
          return;
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (input.trim() && !isLoading) {
          onSubmit(e as unknown as FormEvent);
        }
      }
    },
    [input, isLoading, onSubmit, showPalette]
  );

  return (
    <form onSubmit={onSubmit} className="border-t border-border p-4">
      <div className="relative mx-auto flex max-w-3xl items-end gap-2">
        {showPalette && (
          <div ref={paletteRef} className="absolute bottom-full left-0 right-0 z-10 mb-1">
            <CommandPalette
              commands={paletteCommands}
              filter={paletteFilter}
              onSelect={onCommandSelect}
              onClose={onPaletteClose}
            />
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (/ for commands)"
          disabled={isLoading}
          rows={1}
          className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          style={{ maxHeight: '120px', minHeight: '40px' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = Math.min(target.scrollHeight, 120) + 'px';
          }}
        />
        <div className="flex items-center gap-1.5">
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || isLoading}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </Button>
          <ShortcutBadge shortcut={{ key: 'Enter' }} />
        </div>
      </div>
    </form>
  );
}
