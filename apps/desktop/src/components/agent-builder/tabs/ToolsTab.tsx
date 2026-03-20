import { useState } from 'react';
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

const AVAILABLE_TOOLS = [
  { name: 'Read', desc: 'Read file contents' },
  { name: 'Write', desc: 'Create or overwrite files' },
  { name: 'Edit', desc: 'Make targeted file edits' },
  { name: 'MultiEdit', desc: 'Make multiple edits at once' },
  { name: 'Bash', desc: 'Run shell commands' },
  { name: 'Glob', desc: 'Find files by pattern' },
  { name: 'Grep', desc: 'Search file contents' },
  { name: 'LS', desc: 'List directory contents' },
  { name: 'Task', desc: 'Spawn subagents' },
  { name: 'WebFetch', desc: 'Fetch web pages' },
  { name: 'WebSearch', desc: 'Search the web' },
  { name: 'TodoRead', desc: 'Read todo list' },
  { name: 'TodoWrite', desc: 'Update todo list' },
  { name: 'NotebookRead', desc: 'Read Jupyter notebooks' },
  { name: 'NotebookEdit', desc: 'Edit Jupyter notebooks' },
  { name: 'ExitPlanMode', desc: 'Exit plan mode' },
  { name: 'AskUserQuestion', desc: 'Ask the user a question' },
];

type ToolState = 'allow' | 'block' | 'default';

function getToolState(name: string, allowed: string[], disallowed: string[]): ToolState {
  if (allowed.includes(name)) return 'allow';
  if (disallowed.includes(name)) return 'block';
  return 'default';
}

function setToolState(
  name: string,
  state: ToolState,
  allowed: string[],
  disallowed: string[]
): { allowedTools: string[]; disallowedTools: string[] } {
  const newAllowed = allowed.filter((t) => t !== name);
  const newDisallowed = disallowed.filter((t) => t !== name);
  if (state === 'allow') newAllowed.push(name);
  if (state === 'block') newDisallowed.push(name);
  return { allowedTools: newAllowed, disallowedTools: newDisallowed };
}

export function ToolsTab({ draft, onChange }: ToolsTabProps) {
  const [showRaw, setShowRaw] = useState(false);

  const allowedTools = draft.allowedTools ?? [];
  const disallowedTools = draft.disallowedTools ?? [];
  const allowedText = allowedTools.join('\n');
  const disallowedText = disallowedTools.join('\n');

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

      {/* Tools Configuration */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-foreground">Tools</label>
          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showRaw ? 'Show visual' : 'Show raw'}
          </button>
        </div>

        <p className="text-xs text-muted-foreground mb-3 p-2 bg-muted/30 rounded">
          <strong>Allowed Tools:</strong> If empty, all tools are available. Specify tools to restrict the agent to only those.{' '}
          <strong>Blocked Tools:</strong> These are always denied, overriding allowed tools.
        </p>

        {showRaw ? (
          <div className="space-y-4">
            {/* Allowed Tools Textarea */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Allowed Tools
              </label>
              <textarea
                value={allowedText}
                onChange={(e) => handleAllowedChange(e.target.value)}
                placeholder="Read&#10;Glob&#10;Grep&#10;(one tool per line)"
                rows={5}
                className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30"
              />
            </div>

            {/* Disallowed Tools Textarea */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Blocked Tools
              </label>
              <textarea
                value={disallowedText}
                onChange={(e) => handleDisallowedChange(e.target.value)}
                placeholder="Bash&#10;Write&#10;(one tool per line)"
                rows={5}
                className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30"
              />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-input dark:bg-input/30">
            {AVAILABLE_TOOLS.map((tool) => {
              const state = getToolState(tool.name, allowedTools, disallowedTools);
              return (
                <div
                  key={tool.name}
                  className="flex items-center gap-2 px-3 py-1.5 border-b border-border/30 last:border-0"
                >
                  <span className="w-32 text-sm font-medium">{tool.name}</span>
                  <span className="flex-1 text-xs text-muted-foreground">{tool.desc}</span>
                  <div className="flex gap-1">
                    {(['default', 'allow', 'block'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          onChange(setToolState(tool.name, s, allowedTools, disallowedTools))
                        }
                        className={`px-2 py-0.5 text-xs rounded ${
                          state === s
                            ? s === 'allow'
                              ? 'bg-green-700 text-white'
                              : s === 'block'
                                ? 'bg-red-700 text-white'
                                : 'bg-neutral-600 text-white'
                            : 'text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {s === 'default' ? 'Default' : s === 'allow' ? 'Allow' : 'Block'}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
