import { useState, useCallback } from 'react';
import {
  FilePlus,
  ChevronDown,
  ChevronRight,
  Copy,
  CheckCircle2,
  Loader2,
  XCircle,
} from 'lucide-react';
import type { ToolCallState } from '@/hooks/useStreamEvents';
import { detectLanguage, getDirectory, parseToolInput } from './file-utils';

interface FileWriteDisplayProps {
  toolCall: ToolCallState;
}

interface WriteInput {
  file_path: string;
  content: string;
}

const COLLAPSE_THRESHOLD = 50;

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

export function FileWriteDisplay({ toolCall }: FileWriteDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const input = parseToolInput<WriteInput>(toolCall.input);
  const filePath = input.file_path || '';
  const content = input.content || '';
  const language = filePath ? detectLanguage(filePath) : 'text';
  const directory = filePath ? getDirectory(filePath) : '';

  const lines = content ? content.split('\n') : [];
  const isLongFile = lines.length > COLLAPSE_THRESHOLD;
  const displayedLines = isLongFile && !isExpanded
    ? lines.slice(0, COLLAPSE_THRESHOLD)
    : lines;

  const handleCopyPath = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(filePath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  }, [filePath]);

  // If input JSON is not fully parsed yet (streaming), show minimal UI
  if (!filePath) {
    return (
      <div className="my-2 rounded-lg border border-border bg-muted/30 text-sm overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2">
          <FilePlus className="h-4 w-4 text-green-400 shrink-0" />
          <span className="font-medium text-foreground">Write</span>
          <span className="ml-auto shrink-0">
            <StatusIndicator status={toolCall.status} />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/30 text-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <FilePlus className="h-4 w-4 text-green-400 shrink-0" />
        <span className="font-medium text-foreground">Write</span>
        <span className="font-mono text-xs text-muted-foreground truncate">
          {filePath}
        </span>

        <span
          data-testid="file-directory"
          className="text-xs text-muted-foreground"
        >
          {directory}
        </span>

        <span
          data-testid="language-label"
          className="ml-auto text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5 font-mono"
        >
          {language}
        </span>

        <button
          onClick={handleCopyPath}
          aria-label="Copy file path"
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          {copied ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>

        <span className="shrink-0">
          <StatusIndicator status={toolCall.status} />
        </span>
      </div>

      {/* Content preview */}
      {content && (
        <div className="border-t border-border">
          <pre
            data-testid="write-content"
            className="bg-zinc-900 text-zinc-300 text-xs font-mono p-3 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre"
          >
            {displayedLines.map((line, i) => (
              <div key={i} className="text-green-300/80">
                <span className="select-none text-zinc-600 mr-3 inline-block w-5 text-right">
                  {i + 1}
                </span>
                {line}
              </div>
            ))}
          </pre>

          {isLongFile && (
            <button
              data-testid="expand-toggle"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-t border-border"
            >
              {isExpanded ? (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronRight className="h-3 w-3" />
                  Show all {lines.length} lines
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
