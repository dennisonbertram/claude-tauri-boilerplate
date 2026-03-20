import { useState } from 'react';
import { Users } from 'lucide-react';
import { useTeams } from '@/hooks/useTeams';
import { TeamCreationDialog } from './TeamCreationDialog';
import { TeamWorkspace } from './TeamWorkspace';

export function TeamsView() {
  const {
    teams,
    activeTeamId,
    setActiveTeamId,
    activeTeam,
    messages,
    tasks,
    createTeam,
    deleteTeam,
    shutdownTeam,
  } = useTeams();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // If we have an active team with detail, show the workspace
  if (activeTeam && activeTeamId) {
    return (
      <TeamWorkspace
        team={activeTeam}
        messages={messages}
        tasks={tasks}
        onShutdown={shutdownTeam}
        onBack={() => setActiveTeamId(null)}
      />
    );
  }

  // Otherwise show the team list
  return (
    <div
      data-testid="teams-list-view"
      className="flex flex-1 flex-col min-w-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 overflow-hidden">
        <h2 className="text-lg font-semibold truncate mr-2">Agent Teams</h2>
        <button
          data-testid="create-team-button"
          onClick={() => setShowCreateDialog(true)}
          className="h-8 rounded-lg bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          New Team
        </button>
      </div>

      {/* Team list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {teams.length === 0 ? (
          <div className="flex flex-col items-center py-12 space-y-3">
            <Users className="h-8 w-8 text-muted-foreground" />
            <div className="space-y-1 text-center">
              <p className="text-sm font-medium text-foreground">No teams yet</p>
              <p className="text-xs text-muted-foreground">
                Create a team to coordinate multiple agents working together.
              </p>
            </div>
          </div>
        ) : (
          teams.map((team) => (
            <div
              key={team.id}
              data-testid={`team-list-item-${team.id}`}
              className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => setActiveTeamId(team.id)}
            >
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium truncate">{team.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {team.agents.length} agent{team.agents.length !== 1 ? 's' : ''}{' '}
                  &middot; {team.displayMode} &middot;{' '}
                  {new Date(team.createdAt).toLocaleDateString()}
                </p>
              </div>
              {confirmDeleteId === team.id ? (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    data-testid={`confirm-delete-team-${team.id}`}
                    onClick={() => {
                      setConfirmDeleteId(null);
                      deleteTeam(team.id);
                    }}
                    className="rounded px-1.5 py-0.5 text-xs text-destructive border border-destructive/40 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="rounded px-1.5 py-0.5 text-xs text-muted-foreground border border-border hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  data-testid={`delete-team-${team.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteId(team.id);
                  }}
                  className="text-xs text-destructive hover:text-destructive/80 transition-colors px-2 py-1"
                >
                  Delete
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <TeamCreationDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={createTeam}
      />
    </div>
  );
}
