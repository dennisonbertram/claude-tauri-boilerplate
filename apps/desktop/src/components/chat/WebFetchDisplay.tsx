import { useState, useCallback } from 'react';
import {
  Globe,
  Copy,
  CheckCircle2,
  Loader2,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ToolCallState } from '@/hooks/useStreamEvents';
import { parseToolInput } from './file-utils';

interface WebFetchDisplayProps {
  toolCall: ToolCallState;
}

interface WebFetchInput {
  url: string;
  prompt: string;
}

/** Maximum characters to show before truncating */
const CONTENT_TRUNCATE_LENGTH = 500;

function StatusIndicator({ status }: { status: ToolCallState['status'] }) {
  switch (status) {
    case 'running':
      return (
        <Loader2
          className="h-4 w-4 animate-spin text-blue-400"
          data-testid="status-running"
        />
      );
    case 'complete':
      return (
        <CheckCircle2
          className="h-4 w-4 text-green-400"
          data-testid="status-complete"
        />
      );
    case 'error':
      return (
        <XCircle
          className="h-4 w-4 text-red-400"
          data-testid="status-error"
        />
      );
  }
}

function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard not available
      }
    },
    [url]
  );

  return (
    <button
      data-testid="webfetch-copy-url"
      onClick={handleCopy}
      className="p-0.5 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground shrink-0"
      aria-label="Copy URL"
    >
      {copied ? (
        <CheckCircle2 className="h-3 w-3 text-green-400" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

export function WebFetchDisplay({ toolCall }: WebFetchDisplayProps) {
  const [isContentExpanded, setIsContentExpanded] = useState(false);
  const input = parseToolInput<WebFetchInput>(toolCall.input);
  const url = input.url || '';
  const prompt = input.prompt || '';
  const resultText =
    typeof toolCall.result === 'string' ? toolCall.result : '';
  const hasContent = resultText.length > 0;
  const needsTruncation = resultText.length > CONTENT_TRUNCATE_LENGTH;
  const displayContent =
    isContentExpanded || !needsTruncation
      ? resultText
      : resultText.slice(0, CONTENT_TRUNCATE_LENGTH) + '...';

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/30 text-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Globe className="h-4 w-4 text-green-400 shrink-0" />
        <span className="font-medium text-foreground">Web Fetch</span>
        <a
          data-testid="webfetch-url"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono text-blue-400 hover:text-blue-300 hover:underline truncate transition-colors"
        >
          {url}
        </a>
        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
        <CopyUrlButton url={url} />

        <span className="ml-auto shrink-0">
          <StatusIndicator status={toolCall.status} />
        </span>
      </div>

      {/* Prompt */}
      {prompt && (
        <div className="px-3 py-1.5 border-t border-border/50">
          <div className="text-xs text-muted-foreground mb-0.5 font-medium">
            Prompt
          </div>
          <div
            data-testid="webfetch-prompt"
            className="text-xs text-foreground/80 italic"
          >
            {prompt}
          </div>
        </div>
      )}

      {/* Content preview */}
      {hasContent && (
        <div className="border-t border-border">
          <div className="px-3 py-2">
            <pre
              data-testid="webfetch-content"
              className="text-xs font-mono whitespace-pre-wrap break-all text-foreground/80 max-h-64 overflow-y-auto"
            >
              {displayContent}
            </pre>
          </div>

          {/* Expand/collapse button */}
          {needsTruncation && (
            <button
              data-testid="webfetch-expand-btn"
              onClick={() => setIsContentExpanded(!isContentExpanded)}
              className="flex w-full items-center justify-center gap-1 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-t border-border/30"
            >
              {isContentExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show full content
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
