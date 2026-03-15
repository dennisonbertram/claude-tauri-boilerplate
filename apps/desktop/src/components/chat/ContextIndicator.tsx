import { useState, useMemo } from 'react';

export interface ContextUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  maxTokens: number;
}

interface ContextIndicatorProps {
  usage: ContextUsage;
  isCompacting?: boolean;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function ContextIndicator({ usage, isCompacting = false }: ContextIndicatorProps) {
  const [isHovered, setIsHovered] = useState(false);

  const { percentage, color, colorClass } = useMemo(() => {
    const totalUsed = usage.inputTokens + usage.outputTokens;
    const pct = usage.maxTokens > 0
      ? Math.min(100, Math.round((totalUsed / usage.maxTokens) * 100))
      : 0;

    let c: 'green' | 'yellow' | 'red';
    let cls: string;
    if (pct < 50) {
      c = 'green';
      cls = 'bg-green-500';
    } else if (pct < 80) {
      c = 'yellow';
      cls = 'bg-yellow-500';
    } else {
      c = 'red';
      cls = 'bg-red-500';
    }

    return { percentage: pct, color: c, colorClass: cls };
  }, [usage.inputTokens, usage.outputTokens, usage.maxTokens]);

  const shouldPulse = percentage >= 80;

  return (
    <div
      data-testid="context-indicator"
      className={`relative flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground ${shouldPulse ? 'animate-pulse' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Compaction indicator */}
      {isCompacting && (
        <span className="text-yellow-500 font-medium">Compacting...</span>
      )}

      {/* Meter bar */}
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
          <div
            data-testid="context-meter-fill"
            className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="tabular-nums">{percentage}%</span>
      </div>

      {/* Tooltip */}
      {isHovered && (
        <div className="absolute bottom-full left-0 mb-2 z-50 rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md whitespace-nowrap">
          <div className="space-y-0.5">
            <div>Input: {formatNumber(usage.inputTokens)}</div>
            <div>Output: {formatNumber(usage.outputTokens)}</div>
            <div>Cache Read: {formatNumber(usage.cacheReadTokens)}</div>
            <div>Cache Write: {formatNumber(usage.cacheCreationTokens)}</div>
            <div className="border-t border-border pt-1 mt-1 font-medium">
              Total: {formatNumber(usage.inputTokens + usage.outputTokens)} / {formatNumber(usage.maxTokens)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
