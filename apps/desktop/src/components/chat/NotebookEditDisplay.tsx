import {
  BookOpen,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { ToolCallState } from '@/hooks/useStreamEvents';
import { parseToolInput, sanitizeDisplayText } from './gen-ui/toolData';

interface NotebookEditDisplayProps {
  toolCall: ToolCallState;
}

interface NotebookEditInput {
  notebook_path: string;
  cell_number: number;
  new_source: string;
  edit_mode?: 'replace' | 'insert' | 'delete';
  cell_type?: 'code' | 'markdown';
  cell_id?: string;
}

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

function getEditModeColor(mode: string): string {
  switch (mode) {
    case 'insert':
      return 'bg-green-500/20 text-green-400';
    case 'delete':
      return 'bg-red-500/20 text-red-400';
    default:
      return 'bg-blue-500/20 text-blue-400';
  }
}

export function NotebookEditDisplay({ toolCall }: NotebookEditDisplayProps) {
  const parsedInput = parseToolInput<NotebookEditInput>(toolCall.input);
  const input = parsedInput.value ?? {};
  const notebookPath = sanitizeDisplayText(input.notebook_path);
  const cellNumber = input.cell_number ?? 0;
  const newSource = sanitizeDisplayText(input.new_source);
  const editMode = input.edit_mode || 'replace';
  const cellType = input.cell_type;

  const lines = newSource.split('\n');

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/30 text-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <BookOpen className="h-4 w-4 text-orange-400 shrink-0" />
        <span className="font-medium text-foreground">NotebookEdit</span>
        <span className="font-mono text-xs text-muted-foreground truncate">
          {notebookPath}
        </span>

        <span className="ml-auto shrink-0">
          <StatusIndicator status={toolCall.status} />
        </span>
      </div>

      {/* Details */}
      <div className="border-t border-border px-3 py-2">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Cell number */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Cell</span>
            <span
              data-testid="cell-number"
              className="text-xs font-mono bg-muted rounded px-1.5 py-0.5 text-foreground"
            >
              {cellNumber}
            </span>
          </div>

          {/* Edit mode */}
          <span
            data-testid="edit-mode"
            className={`text-xs font-medium rounded px-1.5 py-0.5 ${getEditModeColor(editMode)}`}
          >
            {editMode}
          </span>

          {/* Cell type */}
          {cellType && (
            <span
              data-testid="cell-type"
              className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5 font-mono"
            >
              {cellType}
            </span>
          )}
        </div>
      </div>

      {/* New source */}
      {newSource && editMode !== 'delete' && (
        <div className="border-t border-border">
          <pre
            data-testid="new-source"
            className="text-xs font-mono text-zinc-200 bg-zinc-900 px-3 py-2 pl-12 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre relative"
          >
            {lines.map((line, i) => (
              <span key={i} className="block relative">
                <span className="absolute -left-9 w-7 text-right select-none text-zinc-600 text-xs">
                  {i + 1}
                </span>
                {line}
              </span>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}
