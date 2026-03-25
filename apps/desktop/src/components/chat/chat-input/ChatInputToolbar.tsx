import { useState, useRef, useEffect } from 'react';
import { Plus, CurrencyDollar, Paperclip } from '@phosphor-icons/react';
import { ConnectorList } from '../McpStatusPill';
import { useSessionMcpServers } from '../../../hooks/useSessionMcpServers';

interface ChatInputToolbarProps {
  inputHasContent: boolean;
  isLoading: boolean;
  onPickFiles: () => void;
  onOpenPalette: () => void;
  modelDisplay?: string;
  /** Total session cost in USD — shown as a clickable pill next to model name */
  sessionTotalCost?: number;
  /** Called when the cost indicator is clicked (opens cost breakdown dialog) */
  onCostClick?: () => void;
  /** Whether the user is on subscription mode (no API key) */
  isSubscription?: boolean;
  /** Session ID for per-session MCP server activation */
  sessionId?: string;
}

export function ChatInputToolbar({
  inputHasContent,
  isLoading,
  onPickFiles,
  onOpenPalette,
  modelDisplay,
  sessionTotalCost,
  onCostClick,
  isSubscription,
  sessionId,
}: ChatInputToolbarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { activeCount } = useSessionMcpServers(sessionId);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="flex items-center justify-between px-3 pb-3 pt-1">
      {/* Left: unified plus menu */}
      <div className="flex items-center gap-1">
        <div ref={ref} className="relative">
          <button
            type="button"
            data-testid="plus-menu-trigger"
            onClick={() => setOpen((prev) => !prev)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0 relative"
            title="Attach, commands, connectors"
          >
            <Plus className="h-4 w-4" />
            {activeCount > 0 && (
              <span
                className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500"
                aria-hidden="true"
              />
            )}
          </button>

          {open && (
            <div
              data-testid="plus-menu-dropdown"
              className="absolute bottom-full left-0 z-20 mb-1.5 min-w-[240px] rounded-lg border border-border bg-popover py-1 shadow-lg"
            >
              {/* File picker item */}
              <button
                type="button"
                data-testid="plus-menu-files"
                onClick={() => {
                  setOpen(false);
                  onPickFiles();
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
              >
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <span>Add files or photos</span>
              </button>

              {/* Slash commands item */}
              <button
                type="button"
                data-testid="plus-menu-commands"
                onClick={() => {
                  setOpen(false);
                  onOpenPalette();
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
              >
                <span className="flex h-4 w-4 items-center justify-center font-mono text-xs text-muted-foreground">/</span>
                <span>Slash commands</span>
              </button>

              {/* Connectors section (renders nothing if no servers) */}
              <ConnectorList sessionId={sessionId} />
            </div>
          )}
        </div>
      </div>

      {/* Right: cost + model display + submit */}
      <div className="flex items-center gap-2">
        {sessionTotalCost != null && sessionTotalCost > 0 && (
          <button
            type="button"
            data-testid="cost-indicator"
            onClick={onCostClick}
            className={`inline-flex items-center gap-1 text-xs text-muted-foreground font-mono px-2 py-1 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer${isSubscription ? ' opacity-50' : ''}`}
            title={isSubscription ? "Subscription mode — costs shown for comparison only" : "View session cost breakdown"}
          >
            <CurrencyDollar className="h-3 w-3" />
            <span>${sessionTotalCost.toFixed(4)}</span>
          </button>
        )}
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
