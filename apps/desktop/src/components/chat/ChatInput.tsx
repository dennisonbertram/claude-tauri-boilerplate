import { useState, useRef, useCallback, useMemo, type FormEvent, type KeyboardEvent, type ClipboardEvent, type DragEvent, type ChangeEvent } from 'react';
import { CommandPalette } from './CommandPalette';
import { X, FileText, Paperclip } from '@phosphor-icons/react';
import type { Command } from '@/hooks/useCommands';
import { isImageFile } from './file-utils';
import { useSettings } from '@/hooks/useSettings';
import { McpStatusPill } from './McpStatusPill';

export interface AttachedImage {
  id: string;
  dataUrl?: string;
  name: string;
  fileType?: string;
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
  /** Attached files for sending with the message */
  images?: AttachedImage[];
  /** Called when attached files change (add/remove) */
  onImagesChange?: (images: AttachedImage[]) => void;
  /** Files available for @-mention suggestions */
  availableFiles?: string[];
  /** Ghost text suggestion shown when input is empty */
  ghostText?: string | null;
  /** Called when the user accepts the ghost text suggestion */
  onAcceptSuggestion?: () => void;
  /** Haiku-generated one-line summary of what the conversation is about */
  contextSummary?: string | null;
  /** Names of enabled non-internal MCP servers to show in the toolbar */
  mcpServerNames?: string[];
}

let imageIdCounter = 0;

function generateImageId(): string {
  return `img-${Date.now()}-${++imageIdCounter}`;
}

function makeAttachmentName(file: File): string {
  return file.webkitRelativePath || file.name || 'attached-file';
}

function isLikelyImage(file: File): boolean {
  return file.type.startsWith('image/') || isImageFile(file.name);
}

function isImageMatchVisible(file: AttachedImage): boolean {
  return typeof file.dataUrl === 'string' && file.dataUrl.length > 0;
}


function fuzzyMatchScore(candidate: string, query: string): number {
  if (!query) return 0;
  const source = candidate.toLowerCase();
  const needle = query.toLowerCase();

  const direct = source.indexOf(needle);
  if (direct >= 0) return direct;

  let i = 0;
  for (const ch of source) {
    if (ch === needle[i]) {
      i += 1;
      if (i === needle.length) break;
    }
  }

  return i === needle.length ? 10_000 + source.length : Number.POSITIVE_INFINITY;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(String(reader.result ?? ''));
    };
    reader.onerror = () => {
      resolve('');
    };
    reader.readAsDataURL(file);
  });
}

async function extractFilesFromEntry(entry: any): Promise<File[]> {
  if (!entry) return [];
  if (entry.isFile) {
    return new Promise((resolve) => {
      try {
        entry.file((file: File) => resolve([file]), () => resolve([]));
      } catch {
        resolve([]);
      }
    });
  }

  if (!entry.isDirectory || !entry.createReader) return [];
  const reader = entry.createReader();
  const files: File[] = [];

  while (true) {
    const batch = await new Promise<any[]>((resolve) => {
      reader.readEntries((items: any[]) => resolve(items || []), () => resolve([]));
    });
    if (!batch.length) break;
    for (const child of batch) {
      const childFiles = await extractFilesFromEntry(child);
      files.push(...childFiles);
    }
  }

  return files;
}

async function collectFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const collected: File[] = [];
  const items = Array.from(dataTransfer?.items ?? []);
  for (const item of items) {
    if (item.kind !== 'file') continue;
    const entry = (item as any).webkitGetAsEntry ? (item as any).webkitGetAsEntry() : null;
    if (entry && typeof entry === 'object') {
      const childFiles = await extractFilesFromEntry(entry);
      collected.push(...childFiles);
      continue;
    }
    const file = item.getAsFile?.();
    if (file) collected.push(file);
  }

  if (collected.length > 0) return collected;

  const fallback = Array.from(dataTransfer?.files ?? []);
  return fallback;
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
  availableFiles = [],
  ghostText,
  onAcceptSuggestion,
  contextSummary,
  mcpServerNames,
}: ChatInputProps) {
  const { settings } = useSettings();
  const paletteRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionCursor, setMentionCursor] = useState(0);
  const showGhost = !input && !!ghostText;
  const mentionAvailable = useMemo(() => {
    const values = new Set<string>(availableFiles.length ? availableFiles : []);
    for (const file of images) values.add(file.name);
    return Array.from(values).filter(Boolean);
  }, [availableFiles, images]);

  const mentionCandidates = useMemo(() => {
    const filtered = mentionAvailable
      .map((file) => ({ file, score: fuzzyMatchScore(file, mentionFilter) }))
      .filter((row) => Number.isFinite(row.score))
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        return a.file.localeCompare(b.file);
      })
      .map((row) => row.file);

    return filtered.slice(0, 8);
  }, [mentionAvailable, mentionFilter]);

  const closeMentionPalette = useCallback(() => {
    setIsMentionOpen(false);
    setMentionFilter('');
    setSelectedMentionIndex(0);
    setMentionStart(null);
    setMentionCursor(0);
  }, []);

  const updateMentionState = useCallback(
    (value: string, cursor: number) => {
      if (showPalette) {
        closeMentionPalette();
        return;
      }

      const beforeCursor = value.slice(0, cursor);
      const atIndex = beforeCursor.lastIndexOf('@');
      if (atIndex === -1) {
        closeMentionPalette();
        return;
      }

      const prefix = beforeCursor.slice(0, atIndex);
      const query = beforeCursor.slice(atIndex + 1);

      if (prefix.length > 0 && !/\s/.test(prefix[prefix.length - 1])) {
        closeMentionPalette();
        return;
      }

      if (query.includes(' ') || query.includes('\n')) {
        closeMentionPalette();
        return;
      }

      setMentionStart(atIndex);
      setMentionFilter(query);
      setMentionCursor(cursor);
      setSelectedMentionIndex(0);
      setIsMentionOpen(true);
    },
    [showPalette, closeMentionPalette]
  );

  const updateInputValue = useCallback(
    (value: string, cursor: number) => {
      onInputChange(value);
      updateMentionState(value, cursor);
    },
    [onInputChange, updateMentionState]
  );

  const addFiles = useCallback(
    async (fileList: File[]) => {
      if (!fileList.length || !onImagesChange) return;
      const parsed = await Promise.all(
        fileList.map(async (file) => {
          const name = makeAttachmentName(file);
          const isImage = isLikelyImage(file);
          if (!isImage) {
            return {
              id: generateImageId(),
              name,
              fileType: file.type || undefined,
            };
          }

          const dataUrl = await readFileAsDataUrl(file);
          return {
            id: generateImageId(),
            name,
            fileType: file.type || 'image',
            dataUrl,
          };
        })
      );

      onImagesChange?.([...images, ...parsed]);
    },
    [images, onImagesChange]
  );

  const removeImage = useCallback(
    (id: string) => {
      onImagesChange?.(images.filter((img) => img.id !== id));
    },
    [images, onImagesChange]
  );

  const handlePickFilesClick = useCallback(() => {
    pickerRef.current?.click();
  }, []);

  const handlePickFilesChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.currentTarget.value = '';
      if (!files.length) return;
      await addFiles(files);
    },
    [addFiles]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (item.kind !== 'file') continue;
        const file = item.getAsFile();
        if (file) files.push(file);
      }

      if (!files.length) return;
      e.preventDefault();
      void addFiles(files);
    },
    [addFiles]
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
    async (e: DragEvent<HTMLFormElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (!e.dataTransfer) return;
      const files = await collectFilesFromDataTransfer(e.dataTransfer);
      await addFiles(files);
    },
    [addFiles]
  );

  const handleMentionSelect = useCallback(
    (path: string) => {
      if (mentionStart === null) return;
      const before = input.slice(0, mentionStart);
      const after = input.slice(mentionCursor);
      const next = `${before}@${path} ${after}`;
      onInputChange(next);
      closeMentionPalette();
    },
    [input, mentionCursor, mentionStart, onInputChange, closeMentionPalette]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (showPalette) {
        const shouldForwardToPalette =
          e.key === 'ArrowDown' ||
          e.key === 'ArrowUp' ||
          e.key === 'Escape' ||
          (e.key === 'Enter' && paletteCommands.length > 0);
        if (shouldForwardToPalette) {
          e.preventDefault();
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

      if (isMentionOpen && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'Escape') {
          closeMentionPalette();
          return;
        }

        if (e.key === 'ArrowDown') {
          setSelectedMentionIndex((prev) =>
            mentionCandidates.length
              ? (prev + 1) % mentionCandidates.length
              : 0
          );
          return;
        }

        if (e.key === 'ArrowUp') {
          setSelectedMentionIndex((prev) =>
            mentionCandidates.length
              ? (prev - 1 + mentionCandidates.length) % mentionCandidates.length
              : 0
          );
          return;
        }

        if (e.key === 'Enter' || e.key === 'Tab') {
          const selected = mentionCandidates[selectedMentionIndex];
          if (selected) {
            handleMentionSelect(selected);
          }
        }
        return;
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
    [input, isLoading, onSubmit, showPalette, showGhost, onAcceptSuggestion, isMentionOpen, mentionCandidates, selectedMentionIndex, handleMentionSelect, closeMentionPalette, paletteCommands]
  );

  const chatFontClass = settings.chatFont === 'mono' ? 'font-mono' : '';
  const chatFontStyle =
    settings.chatFont === 'mono'
      ? { fontFamily: 'var(--chat-mono-font)' }
      : undefined;

  return (
    <>
    <form
      onSubmit={onSubmit}
      data-testid="chat-input-form"
      className={`${isDragOver ? 'bg-accent/20' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="relative mx-auto w-full max-w-4xl"
        data-testid="chat-input-shell"
      >
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

        {isMentionOpen && (
          <div
            className="absolute bottom-full left-0 right-0 z-10 mb-1 rounded-lg border border-border bg-popover shadow-lg"
            data-testid="file-mention-palette"
          >
            {mentionCandidates.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No matching files
              </div>
            )}
            {mentionCandidates.length > 0 && (
              <ul>
                {mentionCandidates.map((filePath, index) => (
                  <li
                    key={filePath}
                    data-testid="file-mention-item"
                    data-selected={selectedMentionIndex === index ? 'true' : 'false'}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleMentionSelect(filePath)}
                    onMouseEnter={() => setSelectedMentionIndex(index)}
                    className={`cursor-pointer px-3 py-2 text-sm ${
                      selectedMentionIndex === index
                        ? 'bg-accent text-accent-foreground'
                        : 'text-popover-foreground'
                    }`}
                  >
                    {filePath}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Attachment thumbnails above the pill */}
        {images.length > 0 && (
          <div data-testid="image-thumbnails" className="mb-2 flex flex-wrap gap-2 px-2">
            {images.map((img) => {
              const isImage = isImageMatchVisible(img);
              return (
                <div
                  key={img.id}
                  data-testid={isImage ? 'image-thumbnail' : 'file-attachment-item'}
                  className="group relative border rounded-md border-border bg-muted/40"
                >
                  {isImage ? (
                    <img
                      src={img.dataUrl}
                      alt={img.name}
                      className="h-16 w-16 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-40 items-center gap-2 px-2 py-1.5 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate max-w-28">{img.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label="Remove attachment"
                    onClick={() => removeImage(img.id)}
                    className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Pill-shaped input container */}
        <div className="w-full bg-card rounded-full shadow-soft border border-border p-1.5 flex items-center gap-1">
          {/* Attach button (left) */}
          <button
            type="button"
            onClick={handlePickFilesClick}
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
            title="Attach files"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          {/* Command palette trigger */}
          <button
            type="button"
            onClick={() => onInputChange('/')}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
            title="Open command palette (/)"
          >
            <span className="text-sm font-mono leading-none">/</span>
          </button>

          {/* Text input */}
          <div className="relative flex-1 min-w-0">
            <textarea
              value={input}
              onChange={(e) => {
                const target = e.currentTarget;
                const cursor = target.selectionStart ?? target.value.length;
                updateInputValue(e.target.value, cursor);
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Message Claude..."
              disabled={isLoading}
              rows={1}
              className={`flex-1 w-full bg-transparent border-none focus:ring-0 px-3 text-[15px] text-foreground placeholder:text-muted-foreground outline-none resize-none ${chatFontClass}`}
              style={{
                maxHeight: '120px',
                minHeight: '36px',
                ...chatFontStyle,
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
            {showGhost && (
              <div
                data-testid="ghost-text"
                className="pointer-events-none absolute left-0 top-0 px-3 py-2 text-[15px] text-muted-foreground/50"
                aria-hidden="true"
              >
                {ghostText}
              </div>
            )}
          </div>

          {/* Send button (right) */}
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
            className="px-5 py-2 rounded-full bg-foreground text-background hover:bg-[var(--app-cta)] transition-colors text-sm font-medium flex items-center gap-2 shrink-0 disabled:opacity-50"
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
            Send
          </button>
        </div>

        <input
          ref={pickerRef}
          type="file"
          data-testid="file-input"
          multiple
          className="sr-only"
          onChange={handlePickFilesChange}
        />
      </div>
    </form>
    {contextSummary && (
      <p
        data-testid="context-summary"
        className="text-xs italic text-center mt-1 px-2"
        style={{ opacity: 0.4, color: 'inherit' }}
      >
        {contextSummary}
      </p>
    )}
    </>
  );
}
