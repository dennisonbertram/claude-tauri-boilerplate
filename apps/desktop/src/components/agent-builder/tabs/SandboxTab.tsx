import { useMemo, useState } from 'react';
import type { UpdateAgentProfileRequest } from '@claude-tauri/shared';

interface SandboxTabProps {
  draft: UpdateAgentProfileRequest;
  onChange: (updates: Partial<UpdateAgentProfileRequest>) => void;
}

export function SandboxTab({ draft, onChange }: SandboxTabProps) {
  const sandboxJson = draft.sandboxJson ?? '';
  const [preset, setPreset] = useState<'none' | 'nodejs' | 'python' | 'custom'>('custom');

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
      <div className="rounded-lg bg-muted/40 border border-border p-3">
        <p className="text-sm font-medium text-foreground mb-1">Sandbox Environment</p>
        <p className="text-xs text-muted-foreground mb-3">
          A sandbox runs your agent's tools in an isolated environment, keeping your system safe from unintended changes.
        </p>
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'none', label: 'None' },
            { id: 'nodejs', label: 'Node.js' },
            { id: 'python', label: 'Python 3' },
            { id: 'custom', label: 'Custom JSON' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPreset(p.id as any);
                if (p.id === 'none') onChange({ sandboxJson: '' });
                else if (p.id === 'nodejs') onChange({ sandboxJson: JSON.stringify({ sandbox: { type: 'docker', container: { image: 'node:20-slim', volumes: ['/workspace:/workspace'] } } }, null, 2) });
                else if (p.id === 'python') onChange({ sandboxJson: JSON.stringify({ sandbox: { type: 'docker', container: { image: 'python:3.11-slim', volumes: ['/workspace:/workspace'] } } }, null, 2) });
              }}
              className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                preset === p.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {preset === 'none' && !sandboxJson.trim() && (
        <p className="text-sm text-muted-foreground py-2">No sandbox — tools run directly on your system.</p>
      )}

      {(preset === 'custom' || sandboxJson.trim()) && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-foreground">
              Environment Configuration
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
      )}
    </div>
  );
}
