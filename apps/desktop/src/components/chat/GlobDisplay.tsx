import { useState, useCallback } from 'react';
import {
  FolderOpen,
  Copy,
  CheckCircle,
  SpinnerGap,
  XCircle,
  FileText,
  FileCode,
  FileJs,
  FileDoc,
  Image,
  File,
} from '@phosphor-icons/react';
import type { ToolCallState } from '@/hooks/useStreamEvents';
import {
  parseToolInput,
  sanitizeDisplayText,
  sanitizeToolResult,
} from './gen-ui/toolData';

interface GlobDisplayProps {
  toolCall: ToolCallState;
}

interface GlobInput {
  pattern: string;
  path?: string;
}

/**
 * Get a Phosphor icon component based on file extension.
 */
function getFileIcon(filePath: string): React.ElementType {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const codeExtensions = new Set([
    'ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'rb', 'java', 'kt',
    'swift', 'c', 'cpp', 'h', 'hpp', 'cs', 'vue', 'svelte', 'ex',
    'exs', 'hs', 'ml', 'dart', 'zig', 'sol', 'lua', 'sh', 'bash',
  ]);
  const markupExtensions = new Set(['html', 'xml', 'svg', 'css', 'scss', 'less']);
  const dataExtensions = new Set(['json', 'yaml', 'yml', 'toml', 'csv']);
  const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp']);
  const docExtensions = new Set(['md', 'mdx', 'txt', 'rst', 'doc', 'pdf']);

  if (codeExtensions.has(ext)) return FileCode;
  if (markupExtensions.has(ext)) return FileCode;
  if (dataExtensions.has(ext)) return FileJs;
  if (imageExtensions.has(ext)) return Image;
  if (docExtensions.has(ext)) return FileDoc;

  return File;
}

/**
 * Parse glob result text into file paths.
 */
function parseGlobResult(result: unknown): string[] {
  if (typeof result !== 'string' || !result.trim()) return [];
  return result
    .split('\n')
    .map((line) => sanitizeDisplayText(line.trim()))
    .filter((line) => line.length > 0);
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
      data-testid="glob-copy-path"
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

export function GlobDisplay({ toolCall }: GlobDisplayProps) {
  const parsedInput = parseToolInput<GlobInput>(toolCall.input);
  const input = parsedInput.value ?? {};
  const pattern = sanitizeDisplayText(input.pattern);
  const searchPath = sanitizeDisplayText(input.path);
  const files = parseGlobResult(sanitizeToolResult(toolCall.result));

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/30 text-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <FolderOpen className="h-4 w-4 text-yellow-400 shrink-0" />
        <span className="font-medium text-foreground">Glob</span>
        <code
          data-testid="glob-pattern"
          className="text-xs font-mono bg-muted rounded px-1.5 py-0.5 text-foreground/80"
        >
          {pattern}
        </code>

        {searchPath && (
          <span
            data-testid="glob-search-path"
            className="text-xs text-muted-foreground font-mono truncate"
          >
            in {searchPath}
          </span>
        )}

        {files.length > 0 && (
          <span
            data-testid="glob-summary"
            className="ml-auto text-xs text-muted-foreground"
          >
            {files.length} file{files.length !== 1 ? 's' : ''}
          </span>
        )}

        <span className="shrink-0">
          <StatusIndicator status={toolCall.status} />
        </span>
      </div>

      {/* Results */}
      {toolCall.status !== 'running' && files.length === 0 && (
        <div
          data-testid="glob-empty"
          className="px-3 py-3 text-sm text-muted-foreground italic border-t border-border"
        >
          No files found
        </div>
      )}

      {files.length > 0 && (
        <div className="border-t border-border max-h-80 overflow-y-auto">
          {files.map((filePath) => {
            const Icon = getFileIcon(filePath);
            return (
              <div
                key={filePath}
                data-testid="glob-file-item"
                className="flex items-center gap-2 px-3 py-1 hover:bg-muted/30 transition-colors border-b border-border/20 last:border-b-0"
              >
                <span data-testid="glob-file-icon" className="shrink-0">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
                <span className="font-mono text-xs text-foreground/90 truncate">
                  {filePath}
                </span>
                <span className="ml-auto">
                  <CopyPathButton path={filePath} />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
