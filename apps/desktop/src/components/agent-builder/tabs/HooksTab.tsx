import { useMemo, useCallback, useState, useEffect } from 'react';
import type { UpdateAgentProfileRequest } from '@claude-tauri/shared';
import { Button } from '@/components/ui/button';
import { HookCanvas } from '../HookCanvas';

interface HooksTabProps {
  draft: UpdateAgentProfileRequest;
  onChange: (updates: Partial<UpdateAgentProfileRequest>) => void;
  profileId?: string;
}

export function HooksTab({ draft, onChange, profileId }: HooksTabProps) {
  const [view, setView] = useState<'json' | 'canvas'>('json');
  const [unsupportedConfirmed, setUnsupportedConfirmed] = useState(false);
  const hooksJson = draft.hooksJson ?? '';

  // Reset unsupported confirmation when profile changes
  useEffect(() => {
    setUnsupportedConfirmed(false);
  }, [profileId]);

  const hasDangerousHooks = useMemo(() => {
    if (!draft.hooksJson) return false;
    try {
      const parsed = JSON.parse(draft.hooksJson);
      const hooksObj = parsed?.hooks;
      if (!hooksObj || typeof hooksObj !== 'object') return false;
      for (const groups of Object.values(hooksObj)) {
        if (!Array.isArray(groups)) continue;
        for (const group of groups as any[]) {
          if (!group || typeof group !== 'object') continue;
          const hookList = Array.isArray(group.hooks) ? group.hooks : [];
          for (const hook of hookList) {
            if (hook?.type === 'command' || hook?.type === 'http') return true;
          }
        }
      }
      return false;
    } catch {
      return false;
    }
  }, [draft.hooksJson]);

  const hasUnsupportedHooks = useMemo(() => {
    if (!draft.hooksJson) return false;
    try {
      const parsed = JSON.parse(draft.hooksJson);
      const hooksObj = parsed?.hooks;
      if (!hooksObj || typeof hooksObj !== 'object') return false;
      const SUPPORTED_TYPES = new Set(['command', 'http', 'prompt', 'agent']);
      for (const groups of Object.values(hooksObj)) {
        if (!Array.isArray(groups)) continue;
        for (const group of groups as any[]) {
          if (!group?.hooks) continue;
          for (const hook of group.hooks) {
            if (hook?.type && !SUPPORTED_TYPES.has(hook.type)) return true;
          }
        }
      }
      return false;
    } catch { return false; }
  }, [draft.hooksJson]);

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

      const MAX_IMPORT_SIZE = 500_000; // 500KB
      if (file.size > MAX_IMPORT_SIZE) {
        alert(`File too large. Maximum import size is ${MAX_IMPORT_SIZE / 1000}KB.`);
        return;
      }

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        // Detect execution hooks and warn
        const stringified = JSON.stringify(parsed);
        const hasCommandHooks = stringified.includes('"type":"command"');
        const hasHttpHooks = stringified.includes('"type":"http"');
        if (hasCommandHooks || hasHttpHooks) {
          const types = [hasCommandHooks && 'command', hasHttpHooks && 'HTTP'].filter(Boolean).join(' and ');
          const confirmed = window.confirm(
            `This hooks file contains ${types} hooks that can execute local commands or make HTTP requests. Import anyway?`
          );
          if (!confirmed) return;
        }

        onChange({ hooksJson: text, hooksCanvasJson: null });
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

  const handleCanvasChange = useCallback(
    (newHooksJson: string, newCanvasJson: string) => {
      onChange({ hooksJson: newHooksJson, hooksCanvasJson: newCanvasJson });
    },
    [onChange],
  );

  return (
    <div className="space-y-4">
      {/* Dangerous hooks warning */}
      {hasDangerousHooks && (
        <div className="px-4 py-2 bg-yellow-900/30 border border-yellow-700/50 rounded-lg text-xs text-yellow-300 flex items-center gap-2">
          <span>Warning:</span>
          <span>This profile contains <strong>command or HTTP hooks</strong> that can execute local commands or make HTTP requests when the agent runs.</span>
        </div>
      )}

      {/* Unsupported hooks warning */}
      {hasUnsupportedHooks && (
        <div className="px-4 py-2 bg-orange-900/30 border border-orange-700/50 rounded-lg text-xs text-orange-300 flex items-center gap-2">
          <span>Warning:</span>
          <span>This profile contains <strong>unsupported hook types</strong>. Editing in Canvas view will drop unsupported hooks. Use JSON view to preserve them.</span>
        </div>
      )}

      {/* View toggle */}
      <div className="flex items-center gap-1 p-0.5 rounded-lg bg-neutral-800 w-fit">
        <button
          onClick={() => setView('json')}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            view === 'json'
              ? 'bg-neutral-700 text-white'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          JSON
        </button>
        <button
          onClick={() => setView('canvas')}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            view === 'canvas'
              ? 'bg-neutral-700 text-white'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Canvas
        </button>
      </div>

      {view === 'json' && (
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
              onChange={(e) => onChange({ hooksJson: e.target.value, hooksCanvasJson: null })}
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
      )}

      {view === 'canvas' && (
        <div>
          {hasUnsupportedHooks && !unsupportedConfirmed && (
            <div className="p-4 bg-orange-900/30 border border-orange-700/50 rounded-lg">
              <p className="text-sm text-orange-300 mb-3">
                This profile contains <strong>unsupported hook types</strong> that cannot be represented in the canvas. Editing in canvas mode will <strong>permanently remove</strong> these hooks.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setView('json')}
                  className="px-3 py-1.5 text-xs rounded border border-border text-foreground hover:bg-neutral-800"
                >
                  Keep JSON view
                </button>
                <button
                  onClick={() => setUnsupportedConfirmed(true)}
                  className="px-3 py-1.5 text-xs rounded bg-orange-700 hover:bg-orange-600 text-white"
                >
                  Edit in canvas anyway (will drop unsupported hooks)
                </button>
              </div>
            </div>
          )}
          {(!hasUnsupportedHooks || unsupportedConfirmed) && (
            <div className="h-[500px] rounded-lg border border-neutral-700 overflow-hidden">
              <HookCanvas
                key={profileId}
                hooksJson={draft.hooksJson ?? null}
                hooksCanvasJson={draft.hooksCanvasJson ?? null}
                onChange={handleCanvasChange}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
