import { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Terminal,
  FileText,
  Pencil,
  Search,
  FolderOpen,
  Globe,
  CheckCircle2,
  XCircle,
  Loader2,
  Wrench,
} from 'lucide-react';
import type { ToolCallState } from '@/hooks/useStreamEvents';

interface ToolCallBlockProps {
  toolCall: ToolCallState;
}

/** Maps tool names to Lucide icon components */
function getToolIcon(name: string) {
  const iconMap: Record<string, React.ElementType> = {
    Bash: Terminal,
    Read: FileText,
    Edit: Pencil,
    Write: Pencil,
    Grep: Search,
    Glob: FolderOpen,
    WebFetch: Globe,
    WebSearch: Globe,
  };
  return iconMap[name] || Wrench;
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

function formatInput(input: string): string {
  try {
    const parsed = JSON.parse(input);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return input;
  }
}

function formatResult(result: unknown): string {
  if (typeof result === 'string') return result;
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

export function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [isExpanded, setIsExpanded] = useState(toolCall.status === 'running');
  const Icon = getToolIcon(toolCall.name);
  const isBash = toolCall.name === 'Bash';

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/30 text-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
        aria-label={toolCall.name}
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium text-foreground">{toolCall.name}</span>

        {/* Summary or elapsed */}
        {toolCall.summary && !isExpanded && (
          <span className="text-xs text-muted-foreground truncate ml-1">
            {toolCall.summary}
          </span>
        )}
        {toolCall.status === 'running' && toolCall.elapsedSeconds != null && (
          <span className="text-xs text-muted-foreground ml-auto">
            {toolCall.elapsedSeconds}s
          </span>
        )}

        <span className="ml-auto shrink-0">
          <StatusIndicator status={toolCall.status} />
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border">
          {/* Input section */}
          {toolCall.input && (
            <div className="px-3 py-2 border-b border-border/50">
              <div className="text-xs text-muted-foreground mb-1 font-medium">
                Input
              </div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all text-foreground/80 max-h-48 overflow-y-auto">
                {formatInput(toolCall.input)}
              </pre>
            </div>
          )}

          {/* Result section */}
          {toolCall.result !== undefined && (
            <div className="px-3 py-2">
              <div className="text-xs text-muted-foreground mb-1 font-medium">
                Output
              </div>
              {isBash ? (
                <div
                  data-testid="terminal-output"
                  className="bg-zinc-900 text-green-300 rounded p-2 text-xs font-mono whitespace-pre-wrap break-all max-h-64 overflow-y-auto"
                >
                  {formatResult(toolCall.result)}
                </div>
              ) : (
                <pre className="text-xs font-mono whitespace-pre-wrap break-all text-foreground/80 max-h-64 overflow-y-auto">
                  {formatResult(toolCall.result)}
                </pre>
              )}
            </div>
          )}

          {/* Summary when expanded */}
          {toolCall.summary && (
            <div className="px-3 py-1.5 border-t border-border/50">
              <span className="text-xs text-muted-foreground italic">
                {toolCall.summary}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
