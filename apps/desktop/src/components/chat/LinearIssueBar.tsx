import type { LinearIssueContext } from './chatPageTypes';

interface LinearIssueBarProps {
  linearIssue: LinearIssueContext;
  onOpenPicker: () => void;
  onClear: () => void;
}

export function LinearIssueBar({ linearIssue, onOpenPicker, onClear }: LinearIssueBarProps) {
  return (
    <div className="border-t border-border px-4 py-2 flex items-center gap-2">
      <div className="text-xs text-muted-foreground shrink-0">Issue:</div>
      <button
        className="text-xs font-mono text-primary hover:underline underline-offset-2 truncate"
        onClick={onOpenPicker}
        title={linearIssue.title}
      >
        {linearIssue.id}
      </button>
      <div className="text-xs text-muted-foreground truncate">{linearIssue.title}</div>
      <button
        className="ml-auto rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={onClear}
      >
        Clear
      </button>
    </div>
  );
}
