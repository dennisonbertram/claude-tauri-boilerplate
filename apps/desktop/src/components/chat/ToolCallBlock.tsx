import { useState } from 'react';
import {
  CaretRight,
  CaretDown,
  TerminalWindow,
  FileText,
  PencilSimple,
  MagnifyingGlass,
  FolderOpen,
  Globe,
  CheckCircle,
  XCircle,
  SpinnerGap,
  Wrench,
} from '@phosphor-icons/react';
import type { ToolCallState } from '@/hooks/useStreamEvents';
import { getToolRenderer } from './gen-ui/registry';
import {
  formatToolInputForDisplay,
  formatToolResultForDisplay,
  sanitizeDisplayText,
} from './gen-ui/toolData';
import './gen-ui/defaultRenderers';
import { BrowserAutomationDisplay, isBrowserAutomationTool } from './BrowserAutomationDisplay';

/**
 * MCP tools use the naming convention `mcp__<server>__<tool>`.
 * Returns parsed parts when it matches, otherwise null.
 */
function parseMcpTool(toolName: string): { serverName: string; toolName: string } | null {
  const match = toolName.match(/^mcp__([^_]+(?:_[^_]+)*)__(.+)$/);
  if (!match) return null;
  return {
    serverName: match[1].replace(/_/g, '-'),
    toolName: match[2],
  };
}

export interface ToolCallBlockProps {
  toolCall: ToolCallState;
  onFixErrors?: (toolCall: ToolCallState) => void;
}

function getToolIcon(name: string) {
  const iconMap: Record<string, React.ElementType> = {
    Bash: TerminalWindow,
    Read: FileText,
    Edit: PencilSimple,
    Write: PencilSimple,
    Grep: MagnifyingGlass,
    Glob: FolderOpen,
    WebFetch: Globe,
    WebMagnifyingGlass: Globe,
  };
  if (name.toLowerCase().includes('browser') || name.toLowerCase().includes('chrome')) {
    return Globe;
  }
  return iconMap[name] || Wrench;
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

function GenericToolFallback({ toolCall }: ToolCallBlockProps) {
  const [isExpanded, setIsExpanded] = useState(toolCall.status === 'running');
  const mcpParts = parseMcpTool(toolCall.name);
  const Icon = getToolIcon(toolCall.name);
  const displayName = mcpParts ? mcpParts.toolName : toolCall.name;

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/30 text-sm overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50"
        aria-label={toolCall.name}
      >
        {isExpanded ? (
          <CaretDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <CaretRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        {mcpParts && (
          <span
            data-testid="mcp-server-badge"
            className="rounded bg-blue-500/15 px-1 py-0.5 text-xs font-medium text-blue-400"
          >
            {mcpParts.serverName}
          </span>
        )}
        <span className="font-medium text-foreground">{sanitizeDisplayText(displayName)}</span>

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
  if (isBrowserAutomationTool(props.toolCall.name)) {
    return <BrowserAutomationDisplay toolCall={props.toolCall} />;
  }

  const renderer = getToolRenderer(props.toolCall.name);

  if (renderer) {
    return <>{renderer(props)}</>;
  }

  return <GenericToolFallback {...props} />;
}
