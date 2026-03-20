import { useMemo, useState, useCallback, useEffect } from 'react';
import type { UpdateAgentProfileRequest } from '@claude-tauri/shared';

interface EnvVar {
  key: string;
  value: string;
}

interface McpServerEntry {
  name: string;
  command: string;
  args: string;
  envVars: EnvVar[];
}

interface McpServersJson {
  mcpServers?: Record<
    string,
    { command?: string; args?: string[]; env?: Record<string, string> }
  >;
}

function parseServersFromJson(json: string): McpServerEntry[] {
  if (!json.trim()) return [];
  try {
    const parsed: McpServersJson = JSON.parse(json);
    if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') return [];
    return Object.entries(parsed.mcpServers).map(([name, cfg]) => ({
      name,
      command: cfg.command ?? '',
      args: (cfg.args ?? []).join(', '),
      envVars: Object.entries(cfg.env ?? {}).map(([key, value]) => ({ key, value })),
    }));
  } catch {
    return [];
  }
}

function buildJsonFromServers(servers: McpServerEntry[]): string {
  if (servers.length === 0) return '';
  const mcpServers: McpServersJson['mcpServers'] = {};
  for (const s of servers) {
    const args = s.args
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    const env: Record<string, string> = {};
    for (const ev of s.envVars) {
      if (ev.key.trim()) env[ev.key.trim()] = ev.value;
    }
    mcpServers[s.name] = {
      command: s.command,
      ...(args.length > 0 ? { args } : {}),
      ...(Object.keys(env).length > 0 ? { env } : {}),
    };
  }
  return JSON.stringify({ mcpServers }, null, 2);
}

const emptyForm = (): McpServerEntry => ({
  name: '',
  command: '',
  args: '',
  envVars: [{ key: '', value: '' }],
});

interface McpTabProps {
  draft: UpdateAgentProfileRequest;
  onChange: (updates: Partial<UpdateAgentProfileRequest>) => void;
}

export function McpTab({ draft, onChange }: McpTabProps) {
  const mcpJson = draft.mcpServersJson ?? '';

  const [form, setForm] = useState<McpServerEntry>(emptyForm);
  const [formError, setFormError] = useState('');

  // Server list derived from raw JSON
  const servers = useMemo(() => parseServersFromJson(mcpJson), [mcpJson]);

  const jsonValid = useMemo(() => {
    if (!mcpJson.trim()) return null;
    try {
      JSON.parse(mcpJson);
      return true;
    } catch {
      return false;
    }
  }, [mcpJson]);

  // When raw JSON changes externally, keep form in sync only if it's currently empty
  useEffect(() => {
    // no-op: form state is independent; servers list is always derived from JSON
  }, [mcpJson]);

  const updateJson = useCallback(
    (nextServers: McpServerEntry[]) => {
      onChange({ mcpServersJson: buildJsonFromServers(nextServers) });
    },
    [onChange]
  );

  const handleRemoveServer = useCallback(
    (name: string) => {
      updateJson(servers.filter((s) => s.name !== name));
    },
    [servers, updateJson]
  );

  const handleAddServer = useCallback(() => {
    setFormError('');
    if (!form.name.trim()) {
      setFormError('Server name is required.');
      return;
    }
    if (!form.command.trim()) {
      setFormError('Command is required.');
      return;
    }
    if (servers.some((s) => s.name === form.name.trim())) {
      setFormError(`A server named "${form.name.trim()}" already exists.`);
      return;
    }
    const next = [...servers, { ...form, name: form.name.trim(), command: form.command.trim() }];
    updateJson(next);
    setForm(emptyForm());
  }, [form, servers, updateJson]);

  const setEnvVar = (idx: number, field: 'key' | 'value', val: string) => {
    const updated = form.envVars.map((ev, i) => (i === idx ? { ...ev, [field]: val } : ev));
    setForm((f) => ({ ...f, envVars: updated }));
  };

  const addEnvRow = () =>
    setForm((f) => ({ ...f, envVars: [...f.envVars, { key: '', value: '' }] }));

  const removeEnvRow = (idx: number) =>
    setForm((f) => ({ ...f, envVars: f.envVars.filter((_, i) => i !== idx) }));

  return (
    <div className="space-y-6">
      {/* ── Existing servers list ── */}
      {servers.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Configured Servers</h3>
          <ul className="space-y-2">
            {servers.map((s) => (
              <li
                key={s.name}
                className="flex items-center justify-between rounded-lg border border-input bg-muted/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.command}
                    {s.args ? ` ${s.args}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveServer(s.name)}
                  className="ml-3 shrink-0 text-xs text-destructive hover:text-destructive/80 focus:outline-none"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Add Server form ── */}
      <div className="rounded-lg border border-input bg-muted/20 p-4 space-y-3">
        <h3 className="text-sm font-medium text-foreground">Add Server</h3>

        {/* Server name */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Server name
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="my-server"
            className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
          />
        </div>

        {/* Command */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Command</label>
          <input
            type="text"
            value={form.command}
            onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))}
            placeholder="npx"
            className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
          />
        </div>

        {/* Args */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Args{' '}
            <span className="font-normal text-muted-foreground/70">(comma-separated)</span>
          </label>
          <input
            type="text"
            value={form.args}
            onChange={(e) => setForm((f) => ({ ...f, args: e.target.value }))}
            placeholder="-y, @my/mcp-server"
            className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
          />
        </div>

        {/* Env vars */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Environment variables
          </label>
          <div className="space-y-1.5">
            {form.envVars.map((ev, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={ev.key}
                  onChange={(e) => setEnvVar(idx, 'key', e.target.value)}
                  placeholder="KEY"
                  className="flex-1 min-w-0 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                />
                <input
                  type="text"
                  value={ev.value}
                  onChange={(e) => setEnvVar(idx, 'value', e.target.value)}
                  placeholder="value"
                  className="flex-1 min-w-0 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                />
                {form.envVars.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEnvRow(idx)}
                    className="shrink-0 text-xs text-muted-foreground hover:text-destructive focus:outline-none"
                    aria-label="Remove row"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addEnvRow}
            className="mt-1.5 text-xs text-muted-foreground hover:text-foreground focus:outline-none"
          >
            + Add row
          </button>
        </div>

        {formError && <p className="text-xs text-destructive">{formError}</p>}

        <button
          type="button"
          onClick={handleAddServer}
          className="mt-1 w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none"
        >
          Add Server
        </button>
      </div>

      {/* ── Advanced: raw JSON ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-foreground">
            Advanced: Edit JSON directly
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
          value={mcpJson}
          onChange={(e) => onChange({ mcpServersJson: e.target.value })}
          placeholder={`{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "@my/mcp-server"],
      "env": {
        "API_KEY": "..."
      }
    }
  }
}`}
          rows={14}
          className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Configure MCP (Model Context Protocol) servers that this agent profile can connect to.
          Each server provides additional tools and context.
        </p>
      </div>
    </div>
  );
}
