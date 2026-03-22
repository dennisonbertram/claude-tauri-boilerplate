export function AgentCountBadge({ count }: { count: number }) {
  return (
    <span
      data-testid="agent-count-badge"
      className="inline-flex items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-semibold leading-4 min-w-[18px]"
    >
      {count}
    </span>
  );
}
