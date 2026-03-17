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
import { getToolRenderer } from './gen-ui/registry';
import {
  formatToolInputForDisplay,
  formatToolResultForDisplay,
  sanitizeDisplayText,
} from './gen-ui/toolData';

export interface ToolCallBlockProps {
  toolCall: ToolCallState;
  onFixErrors?: (toolCall: ToolCallState) => void;
}

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

function GenericToolFallback({ toolCall }: ToolCallBlockProps) {
  const [isExpanded, setIsExpanded] = useState(toolCall.status === 'running');
  const Icon = getToolIcon(toolCall.name);

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/30 text-sm overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50"
        aria-label={toolCall.name}
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="font-medium text-foreground">{sanitizeDisplayText(toolCall.name)}</span>

        {toolCall.summary && !isExpanded ? (
          <span className="ml-1 truncate text-xs text-muted-foreground">
            {sanitizeDisplayText(toolCall.summary)}
          </span>
        ) : null}

        {toolCall.status === 'running' && toolCall.elapsedSeconds != null ? (
          <span className="ml-auto text-xs text-muted-foreground">
            {toolCall.elapsedSeconds}s
          </span>
        ) : null}

        <span className="ml-auto shrink-0">
          <StatusIndicator status={toolCall.status} />
        </span>
      </button>

      {isExpanded ? (
        <div className="border-t border-border">
          {toolCall.input ? (
            <div className="border-b border-border/50 px-3 py-2">
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                Input
              </div>
              <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-all text-xs font-mono text-foreground/80">
                {formatToolInputForDisplay(toolCall.input)}
              </pre>
            </div>
          ) : null}

          {toolCall.result !== undefined ? (
            <div className="px-3 py-2">
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                Output
              </div>
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-all text-xs font-mono text-foreground/80">
                {formatToolResultForDisplay(toolCall.result)}
              </pre>
            </div>
          ) : null}

          {toolCall.summary ? (
            <div className="border-t border-border/50 px-3 py-1.5">
              <span className="text-xs italic text-muted-foreground">
                {sanitizeDisplayText(toolCall.summary)}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ToolCallBlock(props: ToolCallBlockProps) {
  const renderer = getToolRenderer(props.toolCall.name);

  if (renderer) {
    return <>{renderer(props)}</>;
  }

  return <GenericToolFallback {...props} />;
}
