import { useState, useCallback, useMemo } from 'react';
import {
  FileText,
  ImageIcon,
  ChevronDown,
  ChevronRight,
  Copy,
  CheckCircle2,
  Loader2,
  XCircle,
} from 'lucide-react';
import type { ToolCallState } from '@/hooks/useStreamEvents';
import { detectLanguage, isImageFile, parseToolInput } from './file-utils';
import { ImageViewer } from './ImageViewer';
import { NotebookViewer } from './NotebookViewer';
import type { NotebookData } from './NotebookViewer';

interface FileReadDisplayProps {
  toolCall: ToolCallState;
}

interface ReadInput {
  file_path: string;
  offset?: number;
  limit?: number;
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

function isNotebookFile(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.ipynb');
}

function tryParseNotebook(result: string): NotebookData | null {
  try {
    const parsed = JSON.parse(result);
    if (parsed && Array.isArray(parsed.cells) && typeof parsed.nbformat === 'number') {
      return parsed as NotebookData;
    }
  } catch {
    // Not valid notebook JSON
  }
  return null;
}

export function FileReadDisplay({ toolCall }: FileReadDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const input = parseToolInput<ReadInput>(toolCall.input);
  const filePath = input.file_path || '';
  const isImage = isImageFile(filePath);
  const isNotebook = isNotebookFile(filePath);
  const language = isImage ? 'image' : isNotebook ? 'notebook' : detectLanguage(filePath);
  const result = typeof toolCall.result === 'string' ? toolCall.result : '';

  const notebookData = useMemo(
    () => (isNotebook && result ? tryParseNotebook(result) : null),
    [isNotebook, result],
  );

  const lines = result ? result.split('\n') : [];
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

  const HeaderIcon = isImage ? ImageIcon : FileText;

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/30 text-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <HeaderIcon className="h-4 w-4 text-blue-400 shrink-0" />
        <span className="font-medium text-foreground">Read</span>
        <span className="font-mono text-xs text-muted-foreground truncate">
          {filePath}
        </span>

        {input.offset != null && input.limit != null && (
          <span
            data-testid="line-range"
            className="text-xs text-muted-foreground ml-1"
          >
            Lines {input.offset}-{input.offset + input.limit - 1}
          </span>
        )}

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

      {/* Content */}
      {notebookData ? (
        /* Notebook preview */
        <NotebookViewer notebook={notebookData} />
      ) : isImage && result ? (
        /* Image preview */
        <div className="border-t border-border p-3" data-testid="image-preview">
          <ImageViewer src={filePath} alt={filePath} />
        </div>
      ) : (
        result && (
          <div className="border-t border-border">
            <pre
              data-testid="file-content"
              className="bg-zinc-900 text-zinc-300 text-xs font-mono p-3 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre"
            >
              {displayedLines.join('\n')}
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
        )
      )}
    </div>
  );
}
