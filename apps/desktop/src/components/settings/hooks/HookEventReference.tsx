import type { HookEventMeta } from '@claude-tauri/shared';

export function HookEventReference({ events }: { events: HookEventMeta[] }) {
  return (
    <div data-testid="hooks-event-reference" className="space-y-2">
      <h3 className="text-sm font-medium text-foreground">Event Reference</h3>
      <div className="flex flex-wrap gap-1.5">
        {events.map((evt) => (
          <span key={evt.event} data-testid={`hooks-event-chip-${evt.event}`} title={evt.description} className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground cursor-help transition-colors">
            {evt.event}
          </span>
        ))}
      </div>
    </div>
  );
}
