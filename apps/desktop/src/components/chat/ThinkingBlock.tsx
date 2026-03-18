import { useState } from 'react';
import { ChevronRight, ChevronDown, Brain } from 'lucide-react';

interface ThinkingBlockProps {
  text: string;
  durationMs?: number;
  defaultExpanded?: boolean;
}

export function ThinkingBlock({ text, durationMs, defaultExpanded = false }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Don't render anything if there's no thinking text
  if (!text) return null;

  return (
    <div className="my-2 rounded-lg border border-border/50 bg-muted/20 text-sm overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
        aria-label="Thinking..."
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <Brain className="h-4 w-4 text-purple-400/70 shrink-0" />
        <span className="text-muted-foreground font-medium">Thinking...</span>
        {durationMs != null && (
          <span className="text-xs text-muted-foreground/70 ml-auto">
            {(durationMs / 1000).toFixed(1)}s
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-border/50 px-3 py-2">
          <div
            data-testid="thinking-text"
            className="text-sm text-muted-foreground italic whitespace-pre-wrap break-words max-h-96 overflow-y-auto leading-relaxed"
          >
            {text}
          </div>
        </div>
      )}
    </div>
  );
}
