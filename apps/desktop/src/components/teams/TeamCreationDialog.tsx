import { useState, useCallback, useEffect } from 'react';
import type { AgentDefinition, TeamConfig } from '@claude-tauri/shared';

interface TeamCreationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    name: string,
    agents: AgentDefinition[],
    displayMode: TeamConfig['displayMode']
  ) => Promise<TeamConfig | null>;
}

const MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
];
const PERMISSION_MODES: AgentDefinition['permissionMode'][] = [
  'normal',
  'acceptEdits',
  'dontAsk',
  'plan',
];

function emptyAgent(): AgentDefinition {
  return {
    name: '',
    description: '',
    model: undefined,
    tools: [],
    permissionMode: 'normal',
  };
}

export function TeamCreationDialog({
  isOpen,
  onClose,
  onCreate,
}: TeamCreationDialogProps) {
  const [teamName, setTeamName] = useState('');
  const [agents, setAgents] = useState<AgentDefinition[]>([emptyAgent()]);
  const [displayMode, setDisplayMode] = useState<TeamConfig['displayMode']>('auto');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const addAgent = useCallback(() => {
    setAgents((prev) => [...prev, emptyAgent()]);
  }, []);

  const removeAgent = useCallback((index: number) => {
    setAgents((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateAgent = useCallback(
    (index: number, updates: Partial<AgentDefinition>) => {
      setAgents((prev) =>
        prev.map((a, i) => (i === index ? { ...a, ...updates } : a))
      );
    },
    []
  );

  const validate = (): string | null => {
    if (!teamName.trim()) return 'Team name is required';
    if (agents.length === 0) return 'At least one agent is required';

    const names = new Set<string>();
    for (const agent of agents) {
      if (!agent.name.trim()) return 'All agents must have a name';
      if (!agent.description.trim()) return 'All agents must have a description';
      if (names.has(agent.name.trim())) return `Duplicate agent name: "${agent.name}"`;
      names.add(agent.name.trim());
    }
    return null;
  };

  const handleCreate = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setCreating(true);
    setError(null);

    const result = await onCreate(teamName.trim(), agents, displayMode);
    setCreating(false);

    if (result) {
      // Reset form and close
      setTeamName('');
      setAgents([emptyAgent()]);
      setDisplayMode('auto');
      setError(null);
      onClose();
    }
  };

  const handleClose = () => {
    setTeamName('');
    setAgents([emptyAgent()]);
    setDisplayMode('auto');
    setError(null);
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        data-testid="team-creation-overlay"
        className="fixed inset-0 z-40 bg-black/50"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div
        data-testid="team-creation-dialog"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-lg rounded-lg border border-border bg-background shadow-xl max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-lg font-semibold">Create Team</h2>
            <button
              data-testid="team-creation-close"
              onClick={handleClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Team Name */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Team Name</label>
              <input
                data-testid="team-name-input"
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="my-team"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            {/* Display Mode */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Display Mode</label>
              <select
                data-testid="display-mode-select"
                value={displayMode}
                onChange={(e) =>
                  setDisplayMode(e.target.value as TeamConfig['displayMode'])
                }
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="auto">Auto</option>
                <option value="in-process">In-Process</option>
                <option value="tmux">Tmux</option>
              </select>
            </div>

            {/* Agents */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Agents</label>
                <button
                  data-testid="add-agent-button"
                  onClick={addAgent}
                  className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  + Add Agent
                </button>
              </div>

              {agents.map((agent, index) => (
                <div
                  key={index}
                  data-testid={`agent-form-${index}`}
                  className="rounded-lg border border-border p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Agent {index + 1}
                    </span>
                    {agents.length > 1 && (
                      <button
                        data-testid={`remove-agent-${index}`}
                        onClick={() => removeAgent(index)}
                        className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      data-testid={`agent-name-${index}`}
                      type="text"
                      value={agent.name}
                      onChange={(e) =>
                        updateAgent(index, { name: e.target.value })
                      }
                      placeholder="Agent name"
                      className="h-7 rounded border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
                    />
                    <select
                      data-testid={`agent-model-${index}`}
                      value={agent.model ?? ''}
                      onChange={(e) =>
                        updateAgent(index, {
                          model: e.target.value || undefined,
                        })
                      }
                      className="h-7 rounded border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
                    >
                      <option value="">Default model</option>
                      {MODELS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    data-testid={`agent-description-${index}`}
                    type="text"
                    value={agent.description}
                    onChange={(e) =>
                      updateAgent(index, { description: e.target.value })
                    }
                    placeholder="What does this agent do?"
                    className="h-7 w-full rounded border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
                  />

                  <div className="flex gap-2 items-center">
                    <select
                      data-testid={`agent-permission-${index}`}
                      value={agent.permissionMode ?? 'normal'}
                      onChange={(e) =>
                        updateAgent(index, {
                          permissionMode: e.target
                            .value as AgentDefinition['permissionMode'],
                        })
                      }
                      className="h-7 flex-1 rounded border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
                    >
                      {PERMISSION_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            {/* Error */}
            {error && (
              <p data-testid="team-creation-error" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
            <button
              data-testid="team-creation-cancel"
              onClick={handleClose}
              className="h-8 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="team-creation-submit"
              onClick={handleCreate}
              disabled={creating}
              className="h-8 rounded-lg bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
