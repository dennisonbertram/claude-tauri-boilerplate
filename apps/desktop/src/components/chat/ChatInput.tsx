import { useState, useRef, useCallback, type FormEvent, type KeyboardEvent, type ClipboardEvent, type DragEvent } from 'react';
import { Button } from '@/components/ui/button';
import { CommandPalette } from './CommandPalette';
import { ShortcutBadge } from '@/components/ShortcutBadge';
import { X } from 'lucide-react';
import type { Command } from '@/hooks/useCommands';

export interface AttachedImage {
  id: string;
  dataUrl: string;
  name: string;
}

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
  /** Attached images for sending with the message */
  images?: AttachedImage[];
  /** Called when attached images change (add/remove) */
  onImagesChange?: (images: AttachedImage[]) => void;
  /** Ghost text suggestion shown when input is empty */
  ghostText?: string | null;
  /** Called when the user accepts the ghost text suggestion */
  onAcceptSuggestion?: () => void;
}

let imageIdCounter = 0;

function generateImageId(): string {
  return `img-${Date.now()}-${++imageIdCounter}`;
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
  images = [],
  onImagesChange,
  ghostText,
  onAcceptSuggestion,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const showGhost = !input && !!ghostText;

  const addImageFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const newImage: AttachedImage = {
          id: generateImageId(),
          dataUrl,
          name: file.name || 'pasted-image',
        };
        onImagesChange?.([...images, newImage]);
      };
      reader.readAsDataURL(file);
    },
    [images, onImagesChange]
  );

  const removeImage = useCallback(
    (id: string) => {
      onImagesChange?.(images.filter((img) => img.id !== id));
    },
    [images, onImagesChange]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            addImageFile(file);
          }
        }
      }
    },
    [addImageFile]
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLFormElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    },
    []
  );

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLFormElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
    },
    []
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLFormElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer?.files;
      if (!files) return;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          addImageFile(file);
        }
      }
    },
    [addImageFile]
  );

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

      // Ghost text acceptance: Tab, Enter (accept+submit), ArrowRight
      if (showGhost && onAcceptSuggestion) {
        if (e.key === 'Tab') {
          e.preventDefault();
          onAcceptSuggestion();
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          onAcceptSuggestion();
          return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onAcceptSuggestion();
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
    [input, isLoading, onSubmit, showPalette, showGhost, onAcceptSuggestion]
  );

  return (
    <form onSubmit={onSubmit} data-testid="chat-input-form" className="border-t border-border p-4" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
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
        <div className="relative flex-1">
          {images.length > 0 && (
            <div data-testid="image-thumbnails" className="flex flex-wrap gap-2 mb-2">
              {images.map((img) => (
                <div key={img.id} data-testid="image-thumbnail" className="relative group">
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    className="h-16 w-16 rounded-md object-cover border border-border"
                  />
                  <button
                    type="button"
                    aria-label="Remove image"
                    onClick={() => removeImage(img.id)}
                    className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={showGhost ? '' : 'Type a message... (/ for commands)'}
            disabled={isLoading}
            rows={1}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            style={{ maxHeight: '120px', minHeight: '40px' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
          />
          {showGhost && (
            <div
              data-testid="ghost-text"
              className="pointer-events-none absolute left-0 top-0 px-3 py-2 text-sm text-muted-foreground/50"
              aria-hidden="true"
            >
              {ghostText}
            </div>
          )}
        </div>
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
