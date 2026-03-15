import { useState, type ReactNode } from 'react';
import {
  Terminal,
  ChevronDown,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import {
  parseAnsi,
  ANSI_CSS_COLORS,
  type AnsiSegment,
} from '@/lib/ansi-parser';

// ── Props ────────────────────────────────────────────────────────────

export interface BashDisplayProps {
  command: string;
  description?: string;
  output?: string;
  stderr?: string;
  exitCode?: number;
  isRunning: boolean;
  isBackground?: boolean;
  duration?: number;
}

// ── Constants ────────────────────────────────────────────────────────

const TRUNCATE_THRESHOLD = 20;

const DANGEROUS_PATTERNS = [
  /\brm\s+-r/,
  /\brm\s+-f/,
  /\brm\s+-rf\b/,
  /\bsudo\b/,
  /\bchmod\s+777\b/,
  /\bdd\s+if=/,
  /\bmkfs\b/,
  />\s*\/dev\/sd/,
];

// ── Helpers ──────────────────────────────────────────────────────────

function detectDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some(p => p.test(command));
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Sub-components ───────────────────────────────────────────────────

function CopyButton({
  text,
  testId,
}: {
  text: string;
  testId: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      data-testid={testId}
      onClick={handleCopy}
      className="p-1 rounded hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-zinc-200"
      aria-label="Copy"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function AnsiRenderer({ text }: { text: string }): ReactNode {
  const segments = parseAnsi(text);

  return (
    <>
      {segments.map((seg: AnsiSegment, i: number) => {
        const style: React.CSSProperties = {};
        const dataAttrs: Record<string, string> = {};

        if (seg.color) {
          style.color = ANSI_CSS_COLORS[seg.color] || undefined;
          // Map to base color name for test selectors
          const baseColor = seg.color.replace('bright-', '');
          dataAttrs['data-ansi-color'] = baseColor;
        }
        if (seg.bold) {
          style.fontWeight = 'bold';
          dataAttrs['data-ansi-style'] = 'bold';
        }
        if (seg.underline) {
          style.textDecoration = 'underline';
          dataAttrs['data-ansi-style'] = 'underline';
        }

        // Plain text segment — no wrapper needed
        if (!seg.color && !seg.bold && !seg.underline) {
          return <span key={i}>{seg.text}</span>;
        }

        return (
          <span key={i} style={style} {...dataAttrs}>
            {seg.text}
          </span>
        );
      })}
    </>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export function BashDisplay({
  command,
  description,
  output,
  stderr,
  exitCode,
  isRunning,
  isBackground,
  duration,
}: BashDisplayProps) {
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const isDangerous = detectDangerousCommand(command);
  const lines = output?.split('\n') ?? [];
  const truncated = lines.length > TRUNCATE_THRESHOLD;
  const displayLines = showAll ? lines : lines.slice(0, TRUNCATE_THRESHOLD);
  const hiddenCount = lines.length - TRUNCATE_THRESHOLD;

  const hasOutput = output && output.length > 0;
  const hasStderr = stderr && stderr.length > 0;

  return (
    <div className="my-2 rounded-lg border border-zinc-700 overflow-hidden bg-zinc-900 text-zinc-100 text-sm">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border-b border-zinc-700">
        <Terminal className="h-4 w-4 text-green-400 shrink-0" />
        <code
          data-testid="bash-command"
          className="text-sm font-mono flex-1 truncate text-zinc-100"
        >
          {command}
        </code>

        {isDangerous && (
          <span
            data-testid="danger-warning"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-red-900/50 text-red-300 border border-red-700/50"
          >
            <AlertTriangle className="h-3 w-3" />
            caution
          </span>
        )}

        {isRunning && (
          <Loader2
            data-testid="running-spinner"
            className="h-4 w-4 animate-spin text-blue-400 shrink-0"
          />
        )}

        {exitCode !== undefined && !isRunning && (
          <span
            data-testid="bash-exit-code"
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-medium ${
              exitCode === 0
                ? 'bg-green-900/50 text-green-300'
                : 'bg-red-900/50 text-red-300'
            }`}
          >
            exit {exitCode}
          </span>
        )}

        {duration !== undefined && (
          <span
            data-testid="bash-duration"
            className="text-xs text-zinc-400"
          >
            {formatDuration(duration)}
          </span>
        )}

        <CopyButton text={command} testId="copy-command" />

        <button
          data-testid="toggle-expand"
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-zinc-200"
          aria-label={expanded ? 'Collapse output' : 'Expand output'}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              expanded ? '' : '-rotate-90'
            }`}
          />
        </button>
      </div>

      {/* ── Description ──────────────────────────────────────── */}
      {description && (
        <div
          data-testid="bash-description"
          className="px-3 py-1.5 text-xs text-zinc-400 border-b border-zinc-700/50"
        >
          {description}
        </div>
      )}

      {/* ── Output Area ──────────────────────────────────────── */}
      {expanded && (
        <div className="relative">
          {/* Background command indicator */}
          {isBackground && isRunning && (
            <div className="flex items-center gap-2 px-3 py-2 text-zinc-400">
              <Loader2
                data-testid="background-spinner"
                className="h-3 w-3 animate-spin"
              />
              <span className="text-sm">Running in background...</span>
            </div>
          )}

          {/* stderr */}
          {hasStderr && (
            <pre
              data-testid="bash-stderr"
              className="px-3 py-2 text-sm font-mono whitespace-pre-wrap break-all text-red-400 border-b border-zinc-700/50"
            >
              {stderr}
            </pre>
          )}

          {/* stdout */}
          {hasOutput && (
            <pre
              data-testid="bash-output"
              className="px-3 py-2 text-sm font-mono whitespace-pre-wrap break-all text-zinc-300 overflow-auto max-h-96"
            >
              <AnsiRenderer text={displayLines.join('\n')} />
            </pre>
          )}

          {/* No output indicator */}
          {!hasOutput && !isRunning && (
            <div className="px-3 py-2 text-sm text-zinc-500 italic">
              No output
            </div>
          )}

          {/* Truncation expander */}
          {truncated && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border-t border-zinc-700 transition-colors"
              aria-label={`Show ${hiddenCount} more lines`}
            >
              Show {hiddenCount} more lines
            </button>
          )}

          {/* Copy output button */}
          {hasOutput && (
            <div className="absolute top-2 right-2">
              <CopyButton text={output!} testId="copy-output" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
