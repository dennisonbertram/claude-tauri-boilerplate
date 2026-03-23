import { Plus } from '@phosphor-icons/react';

interface ChatInputToolbarProps {
  inputHasContent: boolean;
  isLoading: boolean;
  onPickFiles: () => void;
  onOpenPalette: () => void;
  modelDisplay?: string;
}

export function ChatInputToolbar({
  inputHasContent,
  isLoading,
  onPickFiles,
  onOpenPalette,
  modelDisplay,
}: ChatInputToolbarProps) {
  return (
    <div className="flex items-center justify-between px-3 pb-3 pt-1">
      {/* Left: attach + command */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPickFiles}
          className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
          title="Attach files"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onOpenPalette}
          className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
          title="Open command palette (/)"
        >
          <span className="text-sm font-mono leading-none">/</span>
        </button>
      </div>

      {/* Right: model display + submit */}
      <div className="flex items-center gap-2">
        {modelDisplay && (
          <span className="text-xs text-muted-foreground font-medium px-2 py-1 rounded-lg">
            {modelDisplay}
          </span>
        )}
        <button
          type="submit"
          disabled={!inputHasContent || isLoading}
          aria-label="Send message"
          className="w-8 h-8 rounded-lg bg-foreground text-background hover:bg-[var(--app-cta)] transition-colors flex items-center justify-center shrink-0 disabled:opacity-50 shadow-sm"
        >
        <svg
          width="14"
          height="14"
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
      </button>
      </div>
    </div>
  );
}
