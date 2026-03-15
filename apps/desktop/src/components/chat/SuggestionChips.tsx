interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  onDismiss: (suggestion: string) => void;
}

export function SuggestionChips({
  suggestions,
  onSelect,
  onDismiss,
}: SuggestionChipsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-4 pb-2 pt-1 mx-auto max-w-3xl">
      {suggestions.map((suggestion) => (
        <div
          key={suggestion}
          data-testid="suggestion-chip"
          className="group inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
          onClick={() => onSelect(suggestion)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(suggestion);
            }
          }}
        >
          <span>{suggestion}</span>
          <button
            type="button"
            aria-label={`Dismiss suggestion: ${suggestion}`}
            className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full opacity-50 hover:opacity-100 hover:bg-foreground/10 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(suggestion);
            }}
          >
            <svg
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="1" y1="1" x2="7" y2="7" />
              <line x1="7" y1="1" x2="1" y2="7" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
