import type { Command } from '@/hooks/useCommands';

export interface AttachedImage {
  id: string;
  dataUrl?: string;
  name: string;
  fileType?: string;
}

export interface ChatInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
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
  /** Model display name shown in the toolbar (e.g., "Sonnet 4.6") */
  modelDisplay?: string;
  /** Total session cost in USD — shown as a clickable pill in the toolbar */
  sessionTotalCost?: number;
  /** Called when the cost indicator is clicked (opens cost breakdown dialog) */
  onCostClick?: () => void;
  /** Whether the user is on subscription mode (no API key) */
  isSubscription?: boolean;
  /** Whether to show the command tip inside the input */
  showCommandTip?: boolean;
  /** Called when the user dismisses the command tip */
  onDismissCommandTip?: () => void;
  /** Context usage data for token estimate display */
  contextUsage?: {
    inputTokens: number;
    outputTokens: number;
    maxTokens: number;
  };
}
