import type { UpdateAgentProfileRequest, PermissionMode } from '@claude-tauri/shared';

interface ToolsTabProps {
  draft: UpdateAgentProfileRequest;
  onChange: (updates: Partial<UpdateAgentProfileRequest>) => void;
}

const PERMISSION_MODES: Array<{ value: PermissionMode; label: string; description: string }> = [
  {
    value: 'default',
    label: 'Default',
    description: 'Ask for permission on risky operations',
  },
  {
    value: 'plan',
    label: 'Plan',
    description: 'Create a plan first, then ask for approval',
  },
  {
    value: 'acceptEdits',
    label: 'Accept Edits',
    description: 'Auto-accept file edits, ask for other operations',
  },
  {
    value: 'bypassPermissions',
    label: 'Bypass Permissions',
    description: 'Skip all permission prompts (use with caution)',
  },
];

export function ToolsTab({ draft, onChange }: ToolsTabProps) {
  const allowedText = (draft.allowedTools ?? []).join('\n');
  const disallowedText = (draft.disallowedTools ?? []).join('\n');

  const handleAllowedChange = (text: string) => {
    const tools = text
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);
    onChange({ allowedTools: tools });
  };

  const handleDisallowedChange = (text: string) => {
    const tools = text
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);
    onChange({ disallowedTools: tools });
  };

  return (
    <div className="space-y-5">
      {/* Permission Mode */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Permission Mode
        </label>
        <select
          value={draft.permissionMode ?? 'default'}
          onChange={(e) =>
            onChange({ permissionMode: e.target.value as PermissionMode })
          }
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30"
        >
          {PERMISSION_MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          {PERMISSION_MODES.find((m) => m.value === (draft.permissionMode ?? 'default'))
            ?.description ?? ''}
        </p>
      </div>

      {/* Allowed Tools */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Allowed Tools
        </label>
        <textarea
          value={allowedText}
          onChange={(e) => handleAllowedChange(e.target.value)}
          placeholder="Read&#10;Glob&#10;Grep&#10;(one tool per line)"
          rows={5}
          className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Restrict the agent to only these tools. One tool name per line. Leave
          empty to allow all tools.
        </p>
      </div>

      {/* Disallowed Tools */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Disallowed Tools
        </label>
        <textarea
          value={disallowedText}
          onChange={(e) => handleDisallowedChange(e.target.value)}
          placeholder="Bash&#10;Write&#10;(one tool per line)"
          rows={5}
          className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Explicitly deny these tools. One tool name per line.
        </p>
      </div>
    </div>
  );
}
