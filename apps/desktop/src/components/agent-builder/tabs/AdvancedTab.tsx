import { useMemo } from 'react';
import type { UpdateAgentProfileRequest } from '@claude-tauri/shared';
import { Input } from '@/components/ui/input';

interface AdvancedTabProps {
  draft: UpdateAgentProfileRequest;
  onChange: (updates: Partial<UpdateAgentProfileRequest>) => void;
}

export function AdvancedTab({ draft, onChange }: AdvancedTabProps) {
  const agentsJson = draft.agentsJson ?? '';
  const directoriesText = (draft.additionalDirectories ?? []).join('\n');

  const agentsJsonValid = useMemo(() => {
    if (!agentsJson.trim()) return null;
    try {
      JSON.parse(agentsJson);
      return true;
    } catch {
      return false;
    }
  }, [agentsJson]);

  const handleDirectoriesChange = (text: string) => {
    const dirs = text
      .split('\n')
      .map((d) => d.trim())
      .filter(Boolean);
    onChange({ additionalDirectories: dirs });
  };

  return (
    <div className="space-y-5">
      {/* Working Directory */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Working Directory (cwd)
        </label>
        <Input
          value={draft.cwd ?? ''}
          onChange={(e) => onChange({ cwd: e.target.value })}
          placeholder="/path/to/project"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground mt-1">
          The working directory for the agent. Leave empty to use the default
          project directory.
        </p>
      </div>

      {/* Additional Directories */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Additional Directories
        </label>
        <textarea
          value={directoriesText}
          onChange={(e) => handleDirectoriesChange(e.target.value)}
          placeholder="/path/to/other-repo&#10;/path/to/shared-lib&#10;(one path per line)"
          rows={4}
          className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Additional directories the agent can access. One path per line.
        </p>
      </div>

      {/* Max Turns and Max Budget side by side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Max Turns */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Max Turns
          </label>
          <Input
            type="number"
            min={0}
            value={draft.maxTurns ?? 0}
            onChange={(e) =>
              onChange({ maxTurns: parseInt(e.target.value, 10) || 0 })
            }
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Maximum conversation turns. 0 = unlimited.
          </p>
        </div>

        {/* Max Budget USD */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Max Budget (USD)
          </label>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={draft.maxBudgetUsd ?? 0}
              onChange={(e) =>
                onChange({
                  maxBudgetUsd: parseFloat(e.target.value) || 0,
                })
              }
              placeholder="0.00"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Maximum spend per session. 0 = unlimited.
          </p>
        </div>
      </div>

      {/* Agents JSON */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-foreground">
            Agents JSON
          </label>
          {agentsJsonValid !== null && (
            <span
              className={`text-xs font-medium ${
                agentsJsonValid ? 'text-green-500' : 'text-destructive'
              }`}
            >
              {agentsJsonValid ? 'Valid JSON' : 'Invalid JSON'}
            </span>
          )}
        </div>
        <textarea
          value={agentsJson}
          onChange={(e) => onChange({ agentsJson: e.target.value })}
          placeholder={`{
  "agents": [
    {
      "name": "researcher",
      "description": "Research agent",
      "model": "claude-sonnet-4-6",
      "tools": ["Read", "Glob", "Grep", "WebSearch"]
    }
  ]
}`}
          rows={10}
          className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Configure sub-agents available to this profile. Defines a team of
          specialized agents with their own models, tools, and permissions.
        </p>
      </div>
    </div>
  );
}
