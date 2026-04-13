import { useState, useCallback, useEffect, useRef, type MouseEvent } from 'react';
import { Check, Copy } from '@phosphor-icons/react';

interface CopyButtonProps {
  /** The text to copy to the clipboard */
  text: string;
  /** Optional data-testid for testing */
  testId?: string;
  /** Visual variant: 'icon' renders icon-only (default), 'text' renders a text label */
  variant?: 'icon' | 'text';
  /** Additional CSS class names */
  className?: string;
}

/**
 * A reusable copy-to-clipboard button.
 *
 * Supports two visual variants:
 * - `icon` (default): renders Copy/Check icons, styled for dark code block backgrounds.
 * - `text`: renders a "Copy" / "Copied!" text label, styled for inline use.
 */
export function CopyButton({
  text,
  testId,
  variant = 'icon',
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current !== null) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(
    async (e?: MouseEvent) => {
      e?.stopPropagation();
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        if (resetTimeoutRef.current !== null) {
          clearTimeout(resetTimeoutRef.current);
        }
        resetTimeoutRef.current = setTimeout(() => {
          setCopied(false);
          resetTimeoutRef.current = null;
        }, 2000);
      } catch {
        // Fallback for environments without clipboard API
      }
    },
    [text]
  );

  if (variant === 'text') {
    return (
      <button
        data-testid={testId}
        onClick={handleCopy}
        aria-label="Copy code"
        className={
          className ??
          'text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors text-muted-foreground'
        }
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    );
  }

  return (
    <button
      data-testid={testId}
      onClick={handleCopy}
      className={
        className ??
        'p-1 rounded hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-zinc-200'
      }
      aria-label="Copy"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
