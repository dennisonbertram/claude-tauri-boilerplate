import { X } from '@phosphor-icons/react';

interface CommandTipBannerProps {
  onDismiss: () => void;
}

export function CommandTipBanner({ onDismiss }: CommandTipBannerProps) {
  return (
    <div className="border-t border-border bg-muted/50 text-sm px-4 py-2 flex items-center justify-between">
      <span className="text-muted-foreground">
        Pro tip: Type{' '}
        <kbd className="mx-0.5 rounded border border-border bg-background px-1 py-0.5 font-mono text-xs">
          /
        </kbd>{' '}
        to access commands like /review, /compact, and /pr
      </span>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-2 rounded-md p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent"
        aria-label="Dismiss tip"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
