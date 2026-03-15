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
import { FileReadDisplay } from './FileReadDisplay';
import { FileEditDisplay } from './FileEditDisplay';
import { FileWriteDisplay } from './FileWriteDisplay';
import { BashDisplay } from './BashDisplay';
import { GrepDisplay } from './GrepDisplay';
import { GlobDisplay } from './GlobDisplay';
import { WebSearchDisplay } from './WebSearchDisplay';
import { WebFetchDisplay } from './WebFetchDisplay';
import { NotebookEditDisplay } from './NotebookEditDisplay';

interface ToolCallBlockProps {
  toolCall: ToolCallState;
}

/** Tool names that get specialized file operation displays */
const FILE_OPERATION_TOOLS = new Set(['Read', 'Edit', 'Write']);

/** Tool names that get specialized search displays */
const SEARCH_TOOLS = new Set(['Grep', 'Glob']);

/** Tool names that get specialized web displays */
const WEB_TOOLS = new Set(['WebSearch', 'WebFetch']);

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

/**
 * Parse the Bash tool input JSON to extract command, description, and flags.
 */
function parseBashInput(input: string): {
  command: string;
  description?: string;
  isBackground?: boolean;
  timeout?: number;
} {
  try {
    const parsed = JSON.parse(input);
    return {
      command: parsed.command || input,
      description: parsed.description,
      isBackground: parsed.run_in_background,
      timeout: parsed.timeout,
    };
  } catch {
    return { command: input };
  }
}

/**
 * Extract exit code from a Bash tool result.
 * The result may contain exit code info embedded in the output text.
 */
function extractExitCode(
  result: unknown,
  status: ToolCallState['status']
): number | undefined {
  if (status === 'running') return undefined;
  // If the tool completed successfully, assume exit 0
  // If it errored, assume exit 1
  // The SDK doesn't always provide an explicit exit code
  if (status === 'error') return 1;
  if (status === 'complete') return 0;
  return undefined;
}

export function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  // Route to specialized displays for file operations
  if (FILE_OPERATION_TOOLS.has(toolCall.name)) {
    switch (toolCall.name) {
      case 'Read':
        return <FileReadDisplay toolCall={toolCall} />;
      case 'Edit':
        return <FileEditDisplay toolCall={toolCall} />;
      case 'Write':
        return <FileWriteDisplay toolCall={toolCall} />;
    }
  }

  // Route to specialized search displays
  if (SEARCH_TOOLS.has(toolCall.name)) {
    switch (toolCall.name) {
      case 'Grep':
        return <GrepDisplay toolCall={toolCall} />;
      case 'Glob':
        return <GlobDisplay toolCall={toolCall} />;
    }
  }

  // Route to specialized web displays
  if (WEB_TOOLS.has(toolCall.name)) {
    switch (toolCall.name) {
      case 'WebSearch':
        return <WebSearchDisplay toolCall={toolCall} />;
      case 'WebFetch':
        return <WebFetchDisplay toolCall={toolCall} />;
    }
  }

  // Route to NotebookEdit display
  if (toolCall.name === 'NotebookEdit') {
    return <NotebookEditDisplay toolCall={toolCall} />;
  }

  const [isExpanded, setIsExpanded] = useState(toolCall.status === 'running');
  const Icon = getToolIcon(toolCall.name);

  // Delegate to BashDisplay for Bash tool calls
  if (toolCall.name === 'Bash') {
    const bashInput = parseBashInput(toolCall.input);
    const output = toolCall.result !== undefined ? formatResult(toolCall.result) : undefined;
    const exitCode = extractExitCode(toolCall.result, toolCall.status);
    const duration = toolCall.elapsedSeconds != null
      ? toolCall.elapsedSeconds * 1000
      : undefined;

    return (
      <BashDisplay
        command={bashInput.command}
        description={bashInput.description}
        output={output}
        exitCode={exitCode}
        isRunning={toolCall.status === 'running'}
        isBackground={bashInput.isBackground}
        duration={duration}
      />
    );
  }

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
              <pre className="text-xs font-mono whitespace-pre-wrap break-all text-foreground/80 max-h-64 overflow-y-auto">
                {formatResult(toolCall.result)}
              </pre>
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
