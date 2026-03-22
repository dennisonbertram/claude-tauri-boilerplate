import { formatCost } from '@/lib/pricing';

export function CostSegment({ cost }: { cost: number }) {
  return (
    <div data-testid="cost-segment" className="flex items-center gap-1 px-1.5 py-0.5 tabular-nums">
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
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
      <span>{formatCost(cost)}</span>
    </div>
  );
}
