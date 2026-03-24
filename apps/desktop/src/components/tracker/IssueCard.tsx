import type { TrackerIssue } from '@claude-tauri/shared';

const priorityConfig = {
  0: { label: '', color: '' },
  1: { label: 'Urgent', color: 'text-red-500' },
  2: { label: 'High', color: 'text-orange-400' },
  3: { label: 'Normal', color: 'text-blue-400' },
  4: { label: 'Low', color: 'text-muted-foreground' },
};

interface IssueCardProps {
  issue: TrackerIssue;
  onClick: (issue: TrackerIssue) => void;
  onDragStart?: (e: React.DragEvent, issue: TrackerIssue) => void;
}

export function IssueCard({ issue, onClick, onDragStart }: IssueCardProps) {
  const priority = priorityConfig[issue.priority as keyof typeof priorityConfig] ?? priorityConfig[3];

  return (
    <div
      data-testid={`issue-card-${issue.identifier}`}
      draggable
      onDragStart={(e) => onDragStart?.(e, issue)}
      onClick={() => onClick(issue)}
      className="rounded-lg border border-border bg-card p-3 cursor-pointer hover:border-foreground/20 hover:shadow-sm transition-all space-y-2 group"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-mono">{issue.identifier}</span>
        {priority.label && (
          <span className={`text-xs font-medium ${priority.color}`}>{priority.label}</span>
        )}
      </div>
      <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">{issue.title}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {issue.labels?.map((label) => (
          <span
            key={label.id}
            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground"
            style={label.color ? { backgroundColor: label.color + '20', color: label.color } : undefined}
          >
            {label.name}
          </span>
        ))}
        {issue.assignee && (
          <span className="ml-auto text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
            {issue.assignee}
          </span>
        )}
      </div>
    </div>
  );
}
