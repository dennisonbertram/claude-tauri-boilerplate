import { useState, useCallback } from 'react';
import type { TeamConfig, TeammateStatus, TeamMessage, TeamTask } from '@claude-tauri/shared';
import { TeammateCard } from './TeammateCard';
import { MessageFlow } from './MessageFlow';
import { TaskBoard } from './TaskBoard';

interface TeamWorkspaceProps {
  team: {
    id: string;
    name: string;
    agents: TeamConfig['agents'];
    displayMode: TeamConfig['displayMode'];
    createdAt: string;
    agentStatuses: TeammateStatus[];
  };
  messages: TeamMessage[];
  tasks: TeamTask[];
  onShutdown: (teamId: string) => void;
  onBack: () => void;
}

export function TeamWorkspace({
  team,
  messages,
  tasks,
  onShutdown,
  onBack,
}: TeamWorkspaceProps) {
  const [confirmShutdown, setConfirmShutdown] = useState(false);

  const handleShutdownAll = useCallback(() => {
    if (!confirmShutdown) {
      setConfirmShutdown(true);
      return;
    }
    onShutdown(team.id);
    setConfirmShutdown(false);
  }, [confirmShutdown, team.id, onShutdown]);

  const handleCancelShutdown = useCallback(() => {
    setConfirmShutdown(false);
  }, []);

  return (
    <div
      data-testid="team-workspace"
      className="flex flex-1 flex-col min-w-0 h-full"
    >
      {/* Header */}
      <div
        data-testid="team-workspace-header"
        className="flex items-center gap-3 border-b border-border px-4 py-2"
      >
        <button
          data-testid="team-back-button"
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back
        </button>
        <h2 className="text-sm font-semibold flex-1 truncate">
          Team: {team.name}
        </h2>
        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted">
          {team.displayMode}
        </span>

        {/* Shutdown controls */}
        {confirmShutdown ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-destructive">Confirm?</span>
            <button
              data-testid="confirm-shutdown-button"
              onClick={handleShutdownAll}
              className="text-xs px-2 py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              Yes, Shutdown
            </button>
            <button
              data-testid="cancel-shutdown-button"
              onClick={handleCancelShutdown}
              className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            data-testid="shutdown-all-button"
            onClick={handleShutdownAll}
            className="text-xs px-2 py-1 rounded border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors"
          >
            Shutdown All
          </button>
        )}
      </div>

      {/* Main content: agents sidebar + message flow */}
      <div className="flex flex-1 min-h-0">
        {/* Agent sidebar */}
        <div
          data-testid="agents-sidebar"
          className="w-[200px] shrink-0 border-r border-border overflow-y-auto p-2 space-y-1"
        >
          <h3 className="text-xs font-medium text-muted-foreground px-1 mb-1">
            Agents ({team.agentStatuses.length})
          </h3>
          {team.agentStatuses.map((agent) => (
            <TeammateCard key={agent.name} agent={agent} />
          ))}
          {team.agentStatuses.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">
              No agents
            </p>
          )}
        </div>

        {/* Message flow */}
        <div className="flex-1 min-w-0">
          <MessageFlow messages={messages} />
        </div>
      </div>

      {/* Task board at bottom */}
      <TaskBoard tasks={tasks} />
    </div>
  );
}
