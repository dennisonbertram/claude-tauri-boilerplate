import { useState, useMemo } from 'react';
import type { TrackerIssue, TrackerProjectWithDetails } from '@claude-tauri/shared';

const priorityLabels: Record<number, { label: string; color: string }> = {
  0: { label: '-', color: 'text-muted-foreground' },
  1: { label: 'Urgent', color: 'text-red-500' },
  2: { label: 'High', color: 'text-orange-400' },
  3: { label: 'Normal', color: 'text-blue-400' },
  4: { label: 'Low', color: 'text-muted-foreground' },
};

const categoryColors: Record<string, string> = {
  backlog: 'bg-muted text-muted-foreground',
  todo: 'bg-foreground/10 text-foreground',
  in_progress: 'bg-blue-400/15 text-blue-400',
  done: 'bg-green-400/15 text-green-400',
  cancelled: 'bg-muted text-muted-foreground/50',
};

type SortField = 'identifier' | 'title' | 'status' | 'priority' | 'assignee' | 'createdAt';
type SortDirection = 'asc' | 'desc';

interface IssueListViewProps {
  project: TrackerProjectWithDetails;
  issues: TrackerIssue[];
  onIssueClick: (issue: TrackerIssue) => void;
}

export function IssueListView({ project, issues, onIssueClick }: IssueListViewProps) {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const statusMap = useMemo(() => {
    const map = new Map<string, { name: string; category: string; sortOrder: number }>();
    for (const s of project.statuses) {
      map.set(s.id, { name: s.name, category: s.category, sortOrder: s.sortOrder });
    }
    return map;
  }, [project.statuses]);

  const sortedIssues = useMemo(() => {
    const sorted = [...issues].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'identifier':
          cmp = a.identifier.localeCompare(b.identifier);
          break;
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'status': {
          const sa = statusMap.get(a.statusId)?.sortOrder ?? 0;
          const sb = statusMap.get(b.statusId)?.sortOrder ?? 0;
          cmp = sa - sb;
          break;
        }
        case 'priority':
          cmp = a.priority - b.priority;
          break;
        case 'assignee':
          cmp = (a.assignee ?? '').localeCompare(b.assignee ?? '');
          break;
        case 'createdAt':
          cmp = a.createdAt.localeCompare(b.createdAt);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [issues, sortField, sortDir, statusMap]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none"
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortField === field && (
          <span className="text-foreground">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
        )}
      </span>
    </th>
  );

  if (issues.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-muted-foreground/50">No issues match the current filters</p>
      </div>
    );
  }

  return (
    <div data-testid="issue-list-view" className="flex-1 overflow-auto p-4">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border">
            <SortHeader field="identifier">ID</SortHeader>
            <SortHeader field="title">Title</SortHeader>
            <SortHeader field="status">Status</SortHeader>
            <SortHeader field="priority">Priority</SortHeader>
            <SortHeader field="assignee">Assignee</SortHeader>
            <SortHeader field="createdAt">Created</SortHeader>
          </tr>
        </thead>
        <tbody>
          {sortedIssues.map((issue) => {
            const status = statusMap.get(issue.statusId);
            const priority = priorityLabels[issue.priority] ?? priorityLabels[3];
            const badgeClass = categoryColors[status?.category ?? ''] ?? categoryColors.todo;

            return (
              <tr
                key={issue.id}
                data-testid={`issue-row-${issue.identifier}`}
                onClick={() => onIssueClick(issue)}
                className="border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <td className="px-3 py-2 text-xs text-muted-foreground font-mono whitespace-nowrap">
                  {issue.identifier}
                </td>
                <td className="px-3 py-2 text-xs text-foreground font-medium max-w-[300px] truncate">
                  {issue.title}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {status && (
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${badgeClass}`}>
                      {status.name}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`text-xs font-medium ${priority.color}`}>
                    {priority.label}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                  {issue.assignee ?? '-'}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(issue.createdAt).toLocaleDateString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
