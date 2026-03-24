import { useState, useCallback } from 'react';
import {
  PencilSimple,
  Copy,
  CheckCircle,
  SpinnerGap,
  XCircle,
} from '@phosphor-icons/react';
import type { ToolCallState } from '@/hooks/useStreamEvents';
import { DiffViewer } from './DiffViewer';
import { parseToolInput, sanitizeDisplayText } from './gen-ui/toolData';

interface FileEditDisplayProps {
  toolCall: ToolCallState;
}

interface EditInput {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
  [key: string]: unknown;
}

function StatusIndicator({ status }: { status: ToolCallState['status'] }) {
  switch (status) {
    case 'running':
      return (
        <SpinnerGap
          className="h-4 w-4 animate-spin text-blue-400"
          data-testid="status-running"
        />
      );
    case 'complete':
      return (
        <CheckCircle
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

export function FileEditDisplay({ toolCall }: FileEditDisplayProps) {
  const [copied, setCopied] = useState(false);

  const parsedInput = parseToolInput<EditInput>(toolCall.input);
  const input = parsedInput.value ?? {};
  const filePath = sanitizeDisplayText(input.file_path);
  const oldString = sanitizeDisplayText(input.old_string);
  const newString = sanitizeDisplayText(input.new_string);
  const replaceAll = Boolean(input.replace_all);

  const removedLines = oldString ? oldString.split('\n') : [];
  const addedLines = newString ? newString.split('\n') : [];

  const handleCopyPath = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(filePath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  }, [filePath]);

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/30 text-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <PencilSimple className="h-4 w-4 text-amber-400 shrink-0" />
        <span className="font-medium text-foreground">Edit</span>
        <span className="font-mono text-xs text-muted-foreground truncate">
          {filePath}
        </span>

        {replaceAll && (
          <span
            data-testid="replace-all-badge"
            className="text-xs bg-amber-500/20 text-amber-300 rounded px-1.5 py-0.5 font-medium"
          >
            Replace All
          </span>
        )}

        <span
          data-testid="change-summary"
          className="ml-auto text-xs text-muted-foreground font-mono"
        >
          <span className="text-red-400">-{removedLines.length}</span>
          {' '}
          <span className="text-green-400">+{addedLines.length}</span>
        </span>

        <button
          onClick={handleCopyPath}
          aria-label="Copy file path"
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          {copied ? (
            <CheckCircle className="h-3.5 w-3.5 text-green-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>

        <span className="shrink-0">
          <StatusIndicator status={toolCall.status} />
        </span>
      </div>

      {/* Diff view - uses the reusable DiffViewer component */}
      {(oldString || newString) && (
        <div className="border-t border-border">
          <DiffViewer oldString={oldString} newString={newString} />
        </div>
      )}
    </div>
  );
}
