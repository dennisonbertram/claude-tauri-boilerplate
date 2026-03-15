import { useState } from 'react';
import type { TeamTask } from '@claude-tauri/shared';

const columnConfig: {
  status: TeamTask['status'];
  label: string;
  color: string;
}[] = [
  { status: 'pending', label: 'Pending', color: 'text-muted-foreground' },
  { status: 'in_progress', label: 'In Progress', color: 'text-blue-400' },
  { status: 'completed', label: 'Completed', color: 'text-green-400' },
];

interface TaskBoardProps {
  tasks: TeamTask[];
}

export function TaskBoard({ tasks }: TaskBoardProps) {
  const [collapsed, setCollapsed] = useState(false);

  const counts = {
    pending: tasks.filter((t) => t.status === 'pending').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  };

  return (
    <div data-testid="task-board" className="border-t border-border">
      {/* Toggle header */}
      <button
        data-testid="task-board-toggle"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <span className="text-xs">{collapsed ? '\u25B6' : '\u25BC'}</span>
        <span>Tasks</span>
        <span className="text-xs tabular-nums">
          Pending({counts.pending}) | In Progress({counts.in_progress}) | Done(
          {counts.completed})
        </span>
      </button>

      {/* Columns */}
      {!collapsed && (
        <div
          data-testid="task-board-columns"
          className="flex gap-2 p-2 min-h-0"
        >
          {columnConfig.map((col) => {
            const columnTasks = tasks.filter((t) => t.status === col.status);
            return (
              <div
                key={col.status}
                data-testid={`task-column-${col.status}`}
                className="flex-1 min-w-0 rounded-lg bg-muted/30 p-2 space-y-1"
              >
                <h4 className={`text-xs font-medium ${col.color} mb-1`}>
                  {col.label} ({columnTasks.length})
                </h4>
                {columnTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground/50 text-center py-2">
                    None
                  </p>
                ) : (
                  columnTasks.map((task) => (
                    <div
                      key={task.id}
                      data-testid={`task-card-${task.id}`}
                      className="rounded border border-border bg-background p-1.5 text-xs space-y-0.5"
                    >
                      <p className="font-medium text-foreground truncate">
                        {task.subject}
                      </p>
                      {task.assignee && (
                        <span
                          data-testid={`task-assignee-${task.id}`}
                          className="inline-block px-1 py-0.5 rounded bg-muted text-muted-foreground text-[10px]"
                        >
                          {task.assignee}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
