import { useState, useCallback } from 'react';
import {
  MagnifyingGlass,
  Copy,
  CheckCircle,
  SpinnerGap,
  XCircle,
  CaretDown,
  CaretRight,
  FileText,
} from '@phosphor-icons/react';
import type { ToolCallState } from '@/hooks/useStreamEvents';
import {
  parseToolInput,
  sanitizeDisplayText,
  sanitizeToolResult,
} from './gen-ui/toolData';

interface GrepDisplayProps {
  toolCall: ToolCallState;
}

interface GrepInput {
  pattern: string;
  path?: string;
  output_mode?: string;
  glob?: string;
  type?: string;
  [key: string]: unknown;
}

interface GrepMatch {
  file: string;
  lineNumber: number | null;
  content: string;
}

interface FileGroup {
  file: string;
  matches: GrepMatch[];
}

/**
 * Parse grep result lines into structured matches.
 * Grep output format: "file:lineNumber:content" (content mode)
 * or just "file" (files_with_matches mode)
 */
function parseGrepResult(result: string): GrepMatch[] {
  if (!result || !result.trim()) return [];

  return result
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      // Try to match file:lineNumber:content pattern
      const match = line.match(/^(.+?):(\d+):(.*)$/);
      if (match) {
        return {
          file: sanitizeDisplayText(match[1]),
          lineNumber: parseInt(match[2], 10),
          content: sanitizeDisplayText(match[3]),
        };
      }
      // Fall back to file-only (files_with_matches mode)
      return {
        file: sanitizeDisplayText(line.trim()),
        lineNumber: null,
        content: '',
      };
    });
}

/**
 * Group matches by file path.
 */
function groupByFile(matches: GrepMatch[]): FileGroup[] {
  const groups = new Map<string, GrepMatch[]>();
  for (const match of matches) {
    const existing = groups.get(match.file) || [];
    existing.push(match);
    groups.set(match.file, existing);
  }
  return Array.from(groups.entries()).map(([file, matches]) => ({
    file,
    matches,
  }));
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

function CopyPathButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(path);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard not available
      }
    },
    [path]
  );

  return (
    <button
      data-testid="grep-copy-path"
      onClick={handleCopy}
      className="p-0.5 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground shrink-0"
      aria-label="Copy file path"
    >
      {copied ? (
        <CheckCircle className="h-3 w-3 text-green-400" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

export function GrepDisplay({ toolCall }: GrepDisplayProps) {
  const parsedInput = parseToolInput<GrepInput>(toolCall.input);
  const input = parsedInput.value ?? {};
  const pattern = sanitizeDisplayText(input.pattern);
  const sanitizedResult = sanitizeToolResult(toolCall.result);
  const result = typeof sanitizedResult === 'string' ? sanitizedResult : '';
  const matches = parseGrepResult(result);
  const fileGroups = groupByFile(matches);
  const hasContentMatches = matches.some((m) => m.lineNumber !== null);

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/30 text-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <MagnifyingGlass className="h-4 w-4 text-purple-400 shrink-0" />
        <span className="font-medium text-foreground">Grep</span>
        <code
          data-testid="grep-pattern"
          className="text-xs font-mono bg-muted rounded px-1.5 py-0.5 text-foreground/80"
        >
          {pattern}
        </code>

        {input.path && (
          <span className="text-xs text-muted-foreground font-mono truncate">
            in {input.path}
          </span>
        )}

        {matches.length > 0 && (
          <span
            data-testid="grep-summary"
            className="ml-auto text-xs text-muted-foreground"
          >
            {matches.length} match{matches.length !== 1 ? 'es' : ''} in{' '}
            {fileGroups.length} file{fileGroups.length !== 1 ? 's' : ''}
          </span>
        )}

        <span className="shrink-0">
          <StatusIndicator status={toolCall.status} />
        </span>
      </div>

      {/* Results */}
      {toolCall.status !== 'running' && matches.length === 0 && (
        <div
          data-testid="grep-empty"
          className="px-3 py-3 text-sm text-muted-foreground italic border-t border-border"
        >
          No matches found
        </div>
      )}

      {fileGroups.length > 0 && (
        <div className="border-t border-border">
          {hasContentMatches
            ? fileGroups.map((group) => (
                <FileGroupView
                  key={group.file}
                  group={group}
                />
              ))
            : /* files_with_matches mode — simple list */
              fileGroups.map((group) => (
                <div
                  key={group.file}
                  data-testid="grep-file-group"
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/30 transition-colors border-b border-border/30 last:border-b-0"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-mono text-xs text-foreground/90 truncate">
                    {group.file}
                  </span>
                  <CopyPathButton path={group.file} />
                </div>
              ))}
        </div>
      )}
    </div>
  );
}

function FileGroupView({ group }: { group: FileGroup }) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div
      data-testid="grep-file-group"
      className="border-b border-border/30 last:border-b-0"
    >
      {/* File header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted/30 transition-colors"
      >
        {isExpanded ? (
          <CaretDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <CaretRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        <FileText className="h-3.5 w-3.5 text-blue-400 shrink-0" />
        <span className="font-mono text-xs text-foreground/90 truncate">
          {group.file}
        </span>
        <span
          data-testid="grep-file-match-count"
          className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 font-mono"
        >
          {group.matches.length}
        </span>
        <span className="ml-auto">
          <CopyPathButton path={group.file} />
        </span>
      </button>

      {/* Match lines */}
      {isExpanded && (
        <div className="bg-zinc-900 text-xs font-mono overflow-x-auto">
          {group.matches.map((match, i) => (
            <div
              key={i}
              className="flex hover:bg-zinc-800/50 transition-colors"
            >
              {match.lineNumber !== null && (
                <span
                  data-testid="grep-line-number"
                  className="select-none text-zinc-500 px-2 py-0.5 text-right min-w-[3rem] border-r border-zinc-700/50 shrink-0"
                >
                  {match.lineNumber}
                </span>
              )}
              <span className="px-2 py-0.5 text-zinc-300 whitespace-pre-wrap break-all">
                {match.content}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
