import { useMemo } from 'react';
import type { UpdateAgentProfileRequest } from '@claude-tauri/shared';

interface SandboxTabProps {
  draft: UpdateAgentProfileRequest;
  onChange: (updates: Partial<UpdateAgentProfileRequest>) => void;
}

export function SandboxTab({ draft, onChange }: SandboxTabProps) {
  const sandboxJson = draft.sandboxJson ?? '';

  const jsonValid = useMemo(() => {
    if (!sandboxJson.trim()) return null;
    try {
      JSON.parse(sandboxJson);
      return true;
    } catch {
      return false;
    }
  }, [sandboxJson]);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-foreground">
            Sandbox JSON
          </label>
          {jsonValid !== null && (
            <span
              className={`text-xs font-medium ${
                jsonValid ? 'text-green-500' : 'text-destructive'
              }`}
            >
              {jsonValid ? 'Valid JSON' : 'Invalid JSON'}
            </span>
          )}
        </div>
        <textarea
          value={sandboxJson}
          onChange={(e) => onChange({ sandboxJson: e.target.value })}
          placeholder={`{
  "sandbox": {
    "type": "docker",
    "container": {
      "image": "node:20",
      "volumes": ["/workspace:/workspace"]
    }
  }
}`}
          rows={14}
          className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Configure the sandbox environment for this agent profile. Sandboxes
          provide isolated execution environments (e.g., Docker containers) for
          running tools safely.
        </p>
      </div>
    </div>
  );
}
