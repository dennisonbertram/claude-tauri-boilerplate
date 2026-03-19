import { useMemo, useCallback } from 'react';
import type { UpdateAgentProfileRequest } from '@claude-tauri/shared';
import { Button } from '@/components/ui/button';

interface HooksTabProps {
  draft: UpdateAgentProfileRequest;
  onChange: (updates: Partial<UpdateAgentProfileRequest>) => void;
}

export function HooksTab({ draft, onChange }: HooksTabProps) {
  const hooksJson = draft.hooksJson ?? '';

  const jsonValid = useMemo(() => {
    if (!hooksJson.trim()) return null; // empty is neutral
    try {
      JSON.parse(hooksJson);
      return true;
    } catch {
      return false;
    }
  }, [hooksJson]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        // Validate
        JSON.parse(text);
        onChange({ hooksJson: text });
      } catch {
        // Invalid JSON file - silently ignore
      }
    };
    input.click();
  }, [onChange]);

  const handleExport = useCallback(() => {
    if (!hooksJson.trim()) return;
    const blob = new Blob([hooksJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hooks.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [hooksJson]);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-foreground">
            Hooks JSON
          </label>
          <div className="flex items-center gap-2">
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
        </div>
        <textarea
          value={hooksJson}
          onChange={(e) => onChange({ hooksJson: e.target.value })}
          placeholder={`{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'checking...'"
          }
        ]
      }
    ]
  }
}`}
          rows={14}
          className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Define hooks that run before/after tool use, at session start/end, or
          on notifications. Uses the Claude Code hooks format.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleImport}>
          Import JSON
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={!hooksJson.trim()}
        >
          Export JSON
        </Button>
      </div>
    </div>
  );
}
