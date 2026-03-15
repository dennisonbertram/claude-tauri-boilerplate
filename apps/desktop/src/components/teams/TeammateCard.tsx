import { useState } from 'react';
import type { TeammateStatus } from '@claude-tauri/shared';

const statusColors: Record<TeammateStatus['status'], string> = {
  active: 'bg-green-400',
  idle: 'bg-yellow-400',
  stopped: 'bg-gray-400',
};

const statusLabels: Record<TeammateStatus['status'], string> = {
  active: 'Active',
  idle: 'Idle',
  stopped: 'Stopped',
};

interface TeammateCardProps {
  agent: TeammateStatus;
  onStop?: (name: string) => void;
}

export function TeammateCard({ agent, onStop }: TeammateCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      data-testid={`teammate-card-${agent.name}`}
      className="rounded-lg border border-border p-2 space-y-1 hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        <span
          data-testid={`status-dot-${agent.name}`}
          className={`w-2 h-2 rounded-full shrink-0 ${statusColors[agent.status]}${agent.status === 'active' ? ' animate-pulse' : ''}`}
        />
        <span className="text-sm font-medium truncate flex-1">
          {agent.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {statusLabels[agent.status]}
        </span>
        {onStop && agent.status !== 'stopped' && (
          <button
            data-testid={`stop-agent-${agent.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onStop(agent.name);
            }}
            className="text-xs px-1.5 py-0.5 rounded text-destructive hover:bg-destructive/10 transition-colors"
          >
            Stop
          </button>
        )}
      </div>

      {/* Current task */}
      {agent.currentTask && (
        <p
          data-testid={`current-task-${agent.name}`}
          className="text-xs text-muted-foreground truncate pl-4"
        >
          {agent.currentTask}
        </p>
      )}

      {/* Model chip */}
      {agent.model && (
        <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground ml-4">
          {agent.model}
        </span>
      )}

      {/* Expanded details */}
      {expanded && (
        <div
          data-testid={`teammate-details-${agent.name}`}
          className="pl-4 pt-1 space-y-1"
        >
          {agent.tools && agent.tools.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {agent.tools.map((tool) => (
                <span
                  key={tool}
                  className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400"
                >
                  {tool}
                </span>
              ))}
            </div>
          )}
          {!agent.tools?.length && (
            <p className="text-xs text-muted-foreground italic">No tools configured</p>
          )}
        </div>
      )}
    </div>
  );
}
