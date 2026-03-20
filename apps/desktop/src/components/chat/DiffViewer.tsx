import { useState, useCallback, useMemo } from 'react';
import { Copy, CheckCircle } from '@phosphor-icons/react';

export interface DiffViewerProps {
  oldString: string;
  newString: string;
  filePath?: string;
}

interface DiffLine {
  type: 'context' | 'removed' | 'added';
  content: string;
  oldLineNum: number | null;
  newLineNum: number | null;
}

/**
 * Computes a simple line-level diff between two strings.
 * Uses a longest-common-subsequence approach for accurate context detection.
 */
function computeDiff(oldStr: string, newStr: string): DiffLine[] {
  if (!oldStr && !newStr) return [];

  const oldLines = oldStr ? oldStr.split('\n') : [];
  const newLines = newStr ? newStr.split('\n') : [];

  // Build LCS table
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({
        type: 'context',
        content: oldLines[i - 1],
        oldLineNum: i,
        newLineNum: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({
        type: 'added',
        content: newLines[j - 1],
        oldLineNum: null,
        newLineNum: j,
      });
      j--;
    } else {
      result.push({
        type: 'removed',
        content: oldLines[i - 1],
        oldLineNum: i,
        newLineNum: null,
      });
      i--;
    }
  }

  return result.reverse();
}

/**
 * Generates a unified diff text representation for copying.
 */
function generateUnifiedDiff(lines: DiffLine[]): string {
  return lines
    .map((line) => {
      switch (line.type) {
        case 'removed':
          return `-${line.content}`;
        case 'added':
          return `+${line.content}`;
        case 'context':
          return ` ${line.content}`;
      }
    })
    .join('\n');
}

export function DiffViewer({ oldString, newString, filePath }: DiffViewerProps) {
  const [copied, setCopied] = useState(false);

  const diffLines = useMemo(
    () => computeDiff(oldString, newString),
    [oldString, newString]
  );

  const unifiedText = useMemo(
    () => generateUnifiedDiff(diffLines),
    [diffLines]
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(unifiedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  }, [unifiedText]);

  if (!oldString && !newString) {
    return <div data-testid="diff-empty" />;
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 text-sm overflow-hidden">
      {/* Header with file path and copy button */}
      {filePath && (
        <div
          data-testid="diff-file-path"
          className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/50"
        >
          <span className="font-mono text-xs text-muted-foreground truncate">
            {filePath}
          </span>
        </div>
      )}

      {/* Copy button row */}
      <div className="flex items-center justify-end px-3 py-1 border-b border-border bg-muted/20">
        <button
          onClick={handleCopy}
          aria-label="Copy diff"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? (
            <>
              <CheckCircle className="h-3 w-3 text-green-400" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Diff lines */}
      <pre className="bg-zinc-900 text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto whitespace-pre">
        {diffLines.map((line, i) => {
          const lineClass =
            line.type === 'removed'
              ? 'bg-red-900/30 text-red-300'
              : line.type === 'added'
                ? 'bg-green-900/30 text-green-300'
                : 'text-zinc-400';

          const prefixChar =
            line.type === 'removed' ? '-' : line.type === 'added' ? '+' : ' ';

          const prefixClass =
            line.type === 'removed'
              ? 'text-red-500/70'
              : line.type === 'added'
                ? 'text-green-500/70'
                : 'text-zinc-600';

          return (
            <div
              key={i}
              data-testid={`diff-${line.type}`}
              className={`flex ${lineClass}`}
            >
              <span
                data-testid="old-line-num"
                className="select-none w-10 text-right pr-1 text-zinc-600 shrink-0"
              >
                {line.oldLineNum ?? ''}
              </span>
              <span
                data-testid="new-line-num"
                className="select-none w-10 text-right pr-1 text-zinc-600 shrink-0"
              >
                {line.newLineNum ?? ''}
              </span>
              <span className={`select-none w-4 text-center shrink-0 ${prefixClass}`}>
                {prefixChar}
              </span>
              <span className="flex-1 pl-1">{line.content}</span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}
