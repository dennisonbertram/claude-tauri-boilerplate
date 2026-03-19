import type { UpdateAgentProfileRequest } from '@claude-tauri/shared';

interface PromptTabProps {
  draft: UpdateAgentProfileRequest;
  onChange: (updates: Partial<UpdateAgentProfileRequest>) => void;
}

export function PromptTab({ draft, onChange }: PromptTabProps) {
  const settingSources = draft.settingSources ?? [];

  const handleSettingSourceToggle = (source: string) => {
    const current = new Set(settingSources);
    if (current.has(source)) {
      current.delete(source);
    } else {
      current.add(source);
    }
    onChange({ settingSources: [...current] });
  };

  return (
    <div className="space-y-5">
      {/* System Prompt */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          System Prompt
        </label>
        <textarea
          value={draft.systemPrompt ?? ''}
          onChange={(e) => onChange({ systemPrompt: e.target.value })}
          placeholder="You are a helpful assistant..."
          className="w-full min-h-[200px] resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30"
        />
        <p className="text-xs text-muted-foreground mt-1">
          The system prompt sent at the beginning of every conversation with this
          agent profile.
        </p>
      </div>

      {/* Use Claude Code Prompt */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="agent-use-claude-code-prompt"
          checked={draft.useClaudeCodePrompt ?? true}
          onChange={(e) =>
            onChange({ useClaudeCodePrompt: e.target.checked })
          }
          className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
        />
        <div>
          <label
            htmlFor="agent-use-claude-code-prompt"
            className="text-sm font-medium text-foreground cursor-pointer"
          >
            Include Claude Code system prompt
          </label>
          <p className="text-xs text-muted-foreground">
            When enabled, the built-in Claude Code system prompt is prepended to
            your custom system prompt.
          </p>
        </div>
      </div>

      {/* Setting Sources */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Setting Sources
        </label>
        <p className="text-xs text-muted-foreground mb-2">
          Select which configuration sources to include when using this profile.
        </p>
        <div className="space-y-2">
          {[
            { id: 'project', label: 'Project settings (.claude/)' },
            { id: 'user', label: 'User settings (~/.claude/)' },
            { id: 'global', label: 'Global settings' },
            { id: 'managed', label: 'Managed settings' },
          ].map((source) => (
            <div key={source.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`setting-source-${source.id}`}
                checked={settingSources.includes(source.id)}
                onChange={() => handleSettingSourceToggle(source.id)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
              />
              <label
                htmlFor={`setting-source-${source.id}`}
                className="text-sm text-foreground cursor-pointer"
              >
                {source.label}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
