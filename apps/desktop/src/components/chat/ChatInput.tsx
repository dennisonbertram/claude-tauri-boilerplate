import { useState, useRef, useCallback, type KeyboardEvent, type ClipboardEvent, type DragEvent, type ChangeEvent } from 'react';
import { CommandPalette } from './CommandPalette';
import { useSettings } from '@/hooks/useSettings';
import {
  AttachmentThumbnails,
  FileMentionPalette,
  ChatInputToolbar,
  useMentions,
  generateImageId,
  makeAttachmentName,
  isLikelyImage,
  readFileAsDataUrl,
  collectFilesFromDataTransfer,
} from './chat-input';
import type { ChatInputProps } from './chat-input';

// Re-export types for existing consumers
export type { AttachedImage, ChatInputProps } from './chat-input';

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
  mcpServerNames: _mcpServerNames,
  modelDisplay,
  sessionTotalCost,
  onCostClick,
  contextUsage,
  showCommandTip,
  onDismissCommandTip,
}: ChatInputProps) {
  const { settings } = useSettings();
  const isSubscription = settings.provider === 'anthropic' && !settings.apiKey;
  // Input stretches to fill the footer — no max-width constraint so it
  // matches the full available width rather than being artificially narrow.
  const chatWidthClass = 'max-w-none';
  const paletteRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const showGhost = !input && !!ghostText;

  const {
    isMentionOpen,
    mentionCandidates,
    selectedMentionIndex,
    setSelectedMentionIndex,
    mentionStart,
    mentionCursor,
    closeMentionPalette,
    updateMentionState,
  } = useMentions(availableFiles, images, showPalette);

  const updateInputValue = useCallback(
    (value: string, cursor: number) => { onInputChange(value); updateMentionState(value, cursor); },
    [onInputChange, updateMentionState]
  );

  const addFiles = useCallback(
    async (fileList: File[]) => {
      if (!fileList.length || !onImagesChange) return;
      const parsed = await Promise.all(
        fileList.map(async (file) => {
          const name = makeAttachmentName(file);
          if (!isLikelyImage(file)) return { id: generateImageId(), name, fileType: file.type || undefined };
          const dataUrl = await readFileAsDataUrl(file);
          return { id: generateImageId(), name, fileType: file.type || 'image', dataUrl };
        })
      );
      onImagesChange?.([...images, ...parsed]);
    },
    [images, onImagesChange]
  );

  const removeImage = useCallback((id: string) => { onImagesChange?.(images.filter((img) => img.id !== id)); }, [images, onImagesChange]);
  const handlePickFilesClick = useCallback(() => { pickerRef.current?.click(); }, []);

  const handlePickFilesChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.currentTarget.value = '';
      if (files.length) await addFiles(files);
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

  const handleDragOver = useCallback((e: DragEvent<HTMLFormElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e: DragEvent<HTMLFormElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }, []);
  const handleDrop = useCallback(
    async (e: DragEvent<HTMLFormElement>) => {
      e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
      if (!e.dataTransfer) return;
      await addFiles(await collectFilesFromDataTransfer(e.dataTransfer));
    },
    [addFiles]
  );

  const handleMentionSelect = useCallback(
    (path: string) => {
      if (mentionStart === null) return;
      onInputChange(`${input.slice(0, mentionStart)}@${path} ${input.slice(mentionCursor)}`);
      closeMentionPalette();
    },
    [input, mentionCursor, mentionStart, onInputChange, closeMentionPalette]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (showPalette) {
        // Close palette on Escape directly instead of dispatching a DOM event
        // (React's onKeyDown doesn't respond to dispatchEvent)
        if (e.key === 'Escape') {
          e.preventDefault();
          onPaletteClose();
          return;
        }
        const shouldForward = ['ArrowDown', 'ArrowUp'].includes(e.key) || (e.key === 'Enter' && paletteCommands.length > 0);
        if (shouldForward) {
          e.preventDefault();
          const el = paletteRef.current?.querySelector('[data-testid="command-palette"]');
          if (el) el.dispatchEvent(new KeyboardEvent('keydown', { key: e.key, bubbles: true }));
          return;
        }
      }
      if (isMentionOpen && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'Escape') { closeMentionPalette(); return; }
        if (e.key === 'ArrowDown') { setSelectedMentionIndex((p) => mentionCandidates.length ? (p + 1) % mentionCandidates.length : 0); return; }
        if (e.key === 'ArrowUp') { setSelectedMentionIndex((p) => mentionCandidates.length ? (p - 1 + mentionCandidates.length) % mentionCandidates.length : 0); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { const sel = mentionCandidates[selectedMentionIndex]; if (sel) handleMentionSelect(sel); }
        return;
      }
      if (showGhost && onAcceptSuggestion) {
        if (e.key === 'Tab' || e.key === 'ArrowRight') { e.preventDefault(); onAcceptSuggestion(); return; }
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onAcceptSuggestion(); return; }
      }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (input.trim() && !isLoading) onSubmit(); }
    },
    [input, isLoading, onSubmit, showPalette, showGhost, onAcceptSuggestion, isMentionOpen, mentionCandidates, selectedMentionIndex, handleMentionSelect, closeMentionPalette, paletteCommands, onPaletteClose]
  );

  const chatFontClass = settings.chatFont === 'mono' ? 'font-mono' : '';
  const chatFontStyle = settings.chatFont === 'mono' ? { fontFamily: 'var(--chat-mono-font)' } : undefined;

  return (
    <>
    <form
      onSubmit={(e) => { e.preventDefault(); if (input.trim() && !isLoading) onSubmit(); }}
      data-testid="chat-input-form"
      className={`${isDragOver ? 'bg-accent/20' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={`relative mx-auto w-full ${chatWidthClass}`} data-testid="chat-input-shell">
        {showPalette && (
          <div ref={paletteRef} className="absolute bottom-full left-0 right-0 z-10 mb-1">
            <CommandPalette commands={paletteCommands} filter={paletteFilter} onSelect={onCommandSelect} onClose={onPaletteClose} />
          </div>
        )}

        {isMentionOpen && (
          <FileMentionPalette
            candidates={mentionCandidates}
            selectedIndex={selectedMentionIndex}
            onSelect={handleMentionSelect}
            onHover={setSelectedMentionIndex}
          />
        )}

        <AttachmentThumbnails images={images} onRemove={removeImage} />

        <div className="w-full bg-card rounded-[20px] shadow-soft border border-border flex flex-col">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => {
                const target = e.currentTarget;
                updateInputValue(e.target.value, target.selectionStart ?? target.value.length);
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Reply..."
              disabled={isLoading}
              rows={1}
              className={`flex-1 w-full bg-transparent border-none focus:ring-0 px-4 pt-4 pb-2 text-[15px] text-foreground placeholder:text-muted-foreground outline-none resize-none ${chatFontClass}`}
              style={{ maxHeight: '120px', minHeight: '36px', ...chatFontStyle }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 120) + 'px';
              }}
            />
            {showGhost && (
              <div data-testid="ghost-text" className="pointer-events-none absolute left-0 top-0 px-4 pt-4 text-[15px] text-muted-foreground/50" aria-hidden="true">
                {ghostText}
              </div>
            )}
          </div>
          {showCommandTip && onDismissCommandTip && (
            <div className="flex items-center justify-between px-4 py-1.5">
              <span className="text-xs text-muted-foreground/60">
                Type{' '}
                <kbd className="mx-0.5 rounded border border-border/50 bg-muted/30 px-1 py-0.5 font-mono text-[10px]">
                  /
                </kbd>{' '}
                for commands
              </span>
              <button
                type="button"
                onClick={onDismissCommandTip}
                className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                aria-label="Dismiss tip"
              >
                dismiss
              </button>
            </div>
          )}
          <ChatInputToolbar inputHasContent={!!input.trim()} isLoading={isLoading} onPickFiles={handlePickFilesClick} onOpenPalette={() => onInputChange('/')} modelDisplay={modelDisplay} sessionTotalCost={sessionTotalCost} onCostClick={onCostClick} isSubscription={isSubscription} />
        </div>

        <input ref={pickerRef} type="file" data-testid="file-input" multiple className="sr-only" onChange={handlePickFilesChange} />
      </div>
    </form>
    {/* Token estimate row: input estimate + context window usage */}
    {(input || contextUsage) && (
      <div data-testid="token-estimate-row" className="flex items-center justify-center gap-3 mt-1 px-2 text-[11px] text-muted-foreground" style={{ opacity: 0.5 }}>
        {input && (
          <span data-testid="input-token-estimate" className="font-mono">
            ~{formatTokenEstimate(Math.ceil(input.length / 4))} tokens in draft
          </span>
        )}
        {contextUsage && contextUsage.inputTokens + contextUsage.outputTokens > 0 && (
          <span data-testid="context-window-usage" className="font-mono">
            {formatTokenEstimate(contextUsage.inputTokens + contextUsage.outputTokens)} / {formatTokenEstimate(contextUsage.maxTokens)} context
          </span>
        )}
      </div>
    )}
    {contextSummary && (
      <p data-testid="context-summary" className="text-xs italic text-center mt-1 px-2" style={{ opacity: 0.4, color: 'inherit' }}>
        {contextSummary}
      </p>
    )}
    </>
  );
}

function formatTokenEstimate(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return String(tokens);
}
