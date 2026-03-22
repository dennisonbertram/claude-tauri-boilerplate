import { useMemo } from 'react';
import type { CumulativeUsage } from '@/hooks/useStreamEvents';
import { MAX_CONTEXT_TOKENS } from './constants';

export function ContextUsageSegment({ cumulativeUsage }: { cumulativeUsage: CumulativeUsage }) {
  const totalUsed = cumulativeUsage.inputTokens + cumulativeUsage.outputTokens;

  const { percentage, colorClass } = useMemo(() => {
    const pct = MAX_CONTEXT_TOKENS > 0
      ? Math.min(100, Math.round((totalUsed / MAX_CONTEXT_TOKENS) * 100))
      : 0;

    let cls: string;
    if (pct < 50) {
      cls = 'bg-green-500';
    } else if (pct < 80) {
      cls = 'bg-yellow-500';
    } else {
      cls = 'bg-red-500';
    }

    return { percentage: pct, colorClass: cls };
  }, [totalUsed]);

  if (totalUsed === 0) return null;

  return (
    <div data-testid="context-usage-segment" className="flex items-center gap-1 px-1.5 py-0.5">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <path d="M21 12a9 9 0 1 1-9-9" />
        <path d="M12 3v9l6 3" />
      </svg>
      <div className="h-2 w-10 rounded-full bg-muted overflow-hidden">
        <div
          data-testid="context-usage-fill"
          className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="tabular-nums text-[10px]">{percentage}%</span>
    </div>
  );
}
