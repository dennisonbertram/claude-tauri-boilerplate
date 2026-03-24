import { MarkdownRenderer } from '../chat/MarkdownRenderer';

interface DashboardWidget {
  type: 'stat' | 'code' | 'markdown' | 'table';
  title?: string;
  content: string;
  // stat-specific
  value?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}

interface DashboardWidgetRendererProps {
  specJson: string;
}

export function DashboardWidgetRenderer({ specJson }: DashboardWidgetRendererProps) {
  // Parse spec - expect { widgets: DashboardWidget[] } or just render raw JSON nicely
  let widgets: DashboardWidget[] = [];
  try {
    const spec = JSON.parse(specJson);
    if (spec.widgets && Array.isArray(spec.widgets)) {
      widgets = spec.widgets;
    } else {
      // Fallback: render the JSON as a code block
      return (
        <div className="rounded border border-border bg-zinc-900/30 p-4">
          <pre className="text-xs font-mono text-zinc-300 overflow-auto whitespace-pre-wrap">{JSON.stringify(spec, null, 2)}</pre>
        </div>
      );
    }
  } catch {
    return (
      <div className="rounded border border-border bg-zinc-900/30 p-4">
        <pre className="text-xs font-mono text-zinc-300 overflow-auto whitespace-pre-wrap">{specJson}</pre>
      </div>
    );
  }

  if (widgets.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No widgets in spec.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {widgets.map((widget, i) => (
        <WidgetCard key={i} widget={widget} />
      ))}
    </div>
  );
}

function WidgetCard({ widget }: { widget: DashboardWidget }) {
  switch (widget.type) {
    case 'stat':
      return (
        <div className="rounded-lg border border-border bg-zinc-900/40 p-4">
          {widget.title && <div className="text-xs text-muted-foreground mb-1">{widget.title}</div>}
          <div className="text-2xl font-bold text-foreground">{widget.value ?? widget.content}</div>
          {widget.change && (
            <div className={`text-xs mt-1 ${widget.changeType === 'positive' ? 'text-emerald-400' : widget.changeType === 'negative' ? 'text-red-400' : 'text-muted-foreground'}`}>
              {widget.change}
            </div>
          )}
        </div>
      );
    case 'code':
      return (
        <div className="rounded-lg border border-border bg-zinc-900/40 p-4 col-span-full">
          {widget.title && <div className="text-xs text-muted-foreground mb-2">{widget.title}</div>}
          <pre className="text-xs font-mono text-zinc-300 overflow-auto whitespace-pre-wrap bg-zinc-950/50 rounded p-3">{widget.content}</pre>
        </div>
      );
    case 'markdown':
      return (
        <div className="rounded-lg border border-border bg-zinc-900/40 p-4 col-span-full">
          {widget.title && <div className="text-xs font-semibold text-foreground mb-2">{widget.title}</div>}
          <div className="text-sm text-zinc-300">
            <MarkdownRenderer content={widget.content} />
          </div>
        </div>
      );
    case 'table':
      return (
        <div className="rounded-lg border border-border bg-zinc-900/40 p-4 col-span-full">
          {widget.title && <div className="text-xs font-semibold text-foreground mb-2">{widget.title}</div>}
          <div className="text-sm text-zinc-300">
            <MarkdownRenderer content={widget.content} />
          </div>
        </div>
      );
    default:
      return (
        <div className="rounded-lg border border-border bg-zinc-900/40 p-4">
          {widget.title && <div className="text-xs text-muted-foreground mb-1">{widget.title}</div>}
          <div className="text-sm text-zinc-300">{widget.content}</div>
        </div>
      );
  }
}
