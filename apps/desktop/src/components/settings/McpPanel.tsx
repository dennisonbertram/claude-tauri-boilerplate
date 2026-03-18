import { useState, useEffect, useCallback } from 'react';
import type { McpServerConfig } from '@claude-tauri/shared';

const API_BASE = 'http://localhost:3131';

const TYPE_STYLES: Record<McpServerConfig['type'], { label: string; className: string }> = {
  stdio: { label: 'stdio', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  http: { label: 'http', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  sse: { label: 'sse', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
};

type ServerType = 'stdio' | 'http' | 'sse';

interface AddServerForm {
  name: string;
  type: ServerType;
  command: string;
  args: string;
  env: string;
  url: string;
  headers: string;
}

const EMPTY_FORM: AddServerForm = {
  name: '',
  type: 'stdio',
  command: '',
  args: '',
  env: '',
  url: '',
  headers: '',
};

interface McpPreset {
  id: string;
  title: string;
  description: string;
  config: Omit<McpServerConfig, 'enabled'> & { enabled?: boolean };
}

const MCP_PRESETS: McpPreset[] = [
  {
    id: 'playwright',
    title: 'Playwright Browser',
    description:
      'Launch headed Chrome for testing, screenshots, console inspection, and saved recordings.',
    config: {
      name: 'playwright',
      type: 'stdio',
      command: 'npx',
      args: [
        '-y',
        '@playwright/mcp@latest',
        '--browser',
        'chrome',
        '--output-dir',
        '.claude/browser-artifacts',
        '--save-session',
        '--save-video=1280x720',
      ],
    },
  },
  {
    id: 'agentation',
    title: 'Agentation Visual Feedback',
    description:
      'Supplement browser runs with visual annotations and interaction feedback tooling.',
    config: {
      name: 'agentation',
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'agentation-mcp', 'server'],
    },
  },
];

export function McpPanel() {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<AddServerForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingServer, setEditingServer] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AddServerForm>({ ...EMPTY_FORM });
  const [installingPresetId, setInstallingPresetId] = useState<string | null>(null);

  const fetchServers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mcp/servers`);
      if (!res.ok) throw new Error('Failed to fetch MCP servers');

      const data = (await res.json()) as { servers: McpServerConfig[] };
      setServers(data.servers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MCP servers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const handleAdd = async () => {
    setError(null);

    // Client-side validation
    if (!form.name.trim()) {
      setError('Server name is required');
      return;
    }
    if (form.type === 'stdio' && !form.command.trim()) {
      setError('Command is required for stdio servers');
      return;
    }
    if ((form.type === 'http' || form.type === 'sse') && !form.url.trim()) {
      setError('URL is required for http/sse servers');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        type: form.type,
      };

      if (form.type === 'stdio') {
        payload.command = form.command.trim();
        if (form.args.trim()) {
          payload.args = form.args.split(',').map((a) => a.trim()).filter(Boolean);
        }
        if (form.env.trim()) {
          payload.env = parseKeyValuePairs(form.env);
        }
      } else {
        payload.url = form.url.trim();
        if (form.headers.trim()) {
          payload.headers = parseKeyValuePairs(form.headers);
        }
      }

      const res = await fetch(`${API_BASE}/api/mcp/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || 'Failed to add server');
      }

      setAdding(false);
      setForm({ ...EMPTY_FORM });
      await fetchServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add server');
    } finally {
      setSaving(false);
    }
  };

  const handleInstallPreset = async (preset: McpPreset) => {
    setError(null);
    setInstallingPresetId(preset.id);

    try {
      const res = await fetch(`${API_BASE}/api/mcp/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...preset.config,
          enabled: preset.config.enabled !== false,
        }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || 'Failed to install preset');
      }

      await fetchServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to install preset');
    } finally {
      setInstallingPresetId(null);
    }
  };

  const handleToggle = async (name: string, enabled: boolean) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mcp/servers/${encodeURIComponent(name)}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || 'Toggle failed');
      }

      await fetchServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Toggle failed');
    }
  };

  const handleDelete = async (name: string) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mcp/servers/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || 'Delete failed');
      }

      setDeleteConfirm(null);
      await fetchServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleEditStart = (server: McpServerConfig) => {
    setEditingServer(server.name);
    setEditForm({
      name: server.name,
      type: server.type,
      command: server.command || '',
      args: server.args?.join(', ') || '',
      env: server.env ? Object.entries(server.env).map(([k, v]) => `${k}=${v}`).join(', ') : '',
      url: server.url || '',
      headers: server.headers
        ? Object.entries(server.headers).map(([k, v]) => `${k}=${v}`).join(', ')
        : '',
    });
  };

  const handleEditSave = async () => {
    if (!editingServer) return;
    setError(null);
    setSaving(true);

    try {
      const payload: Record<string, unknown> = {};
      const currentType = editForm.type;

      if (currentType === 'stdio') {
        payload.command = editForm.command.trim();
        payload.args = editForm.args.trim()
          ? editForm.args.split(',').map((a) => a.trim()).filter(Boolean)
          : [];
        payload.env = editForm.env.trim() ? parseKeyValuePairs(editForm.env) : {};
      } else {
        payload.url = editForm.url.trim();
        payload.headers = editForm.headers.trim() ? parseKeyValuePairs(editForm.headers) : {};
      }

      const res = await fetch(
        `${API_BASE}/api/mcp/servers/${encodeURIComponent(editingServer)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || 'Update failed');
      }

      setEditingServer(null);
      await fetchServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div data-testid="mcp-loading" className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="ml-2 text-sm text-muted-foreground">Loading MCP servers...</span>
      </div>
    );
  }

  return (
    <div data-testid="mcp-panel" className="space-y-6">
      {error && (
        <div
          data-testid="mcp-error"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
        >
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">MCP Servers</h3>
        {!adding && (
          <button
            data-testid="mcp-add-btn"
            onClick={() => setAdding(true)}
            className="rounded-lg border border-input px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            + Add Server
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium text-foreground">Recommended presets</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Install browser automation servers with the tested defaults used by the app workflow prompts.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {MCP_PRESETS.map((preset) => {
            const alreadyInstalled = servers.some((server) => server.name === preset.config.name);
            const isInstalling = installingPresetId === preset.id;

            return (
              <div
                key={preset.id}
                data-testid={`mcp-preset-${preset.id}`}
                className="rounded-lg border border-border bg-muted/20 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">{preset.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{preset.description}</div>
                  </div>

                  <button
                    data-testid={`mcp-install-preset-${preset.id}`}
                    onClick={() => handleInstallPreset(preset)}
                    disabled={alreadyInstalled || isInstalling}
                    className="shrink-0 rounded-lg border border-input px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {alreadyInstalled ? 'Installed' : isInstalling ? 'Installing...' : 'Install'}
                  </button>
                </div>

                <div className="mt-3 rounded-md border border-border/60 bg-background/60 px-2 py-2 font-mono text-[11px] text-muted-foreground">
                  {preset.config.type === 'stdio'
                    ? `${preset.config.command} ${preset.config.args?.join(' ') || ''}`
                    : preset.config.url}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Server List */}
      <div className="space-y-2">
        {servers.length === 0 && !adding ? (
          <div className="text-xs text-muted-foreground py-4 text-center">
            No MCP servers configured.
          </div>
        ) : (
          servers.map((server) => (
            <div key={server.name}>
              <ServerCard
                server={server}
                isDeleteConfirm={deleteConfirm === server.name}
                isEditing={editingServer === server.name}
                onToggle={(enabled) => handleToggle(server.name, enabled)}
                onDeleteRequest={() => setDeleteConfirm(server.name)}
                onDeleteConfirm={() => handleDelete(server.name)}
                onDeleteCancel={() => setDeleteConfirm(null)}
                onEditStart={() => handleEditStart(server)}
                onEditCancel={() => setEditingServer(null)}
              />

              {/* Edit Form (inline, below the card) */}
              {editingServer === server.name && (
                <div data-testid={`mcp-edit-form-${server.name}`} className="mt-2 space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                  <ServerFormFields
                    form={editForm}
                    setForm={setEditForm}
                    isEdit
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      data-testid="mcp-edit-cancel-btn"
                      onClick={() => setEditingServer(null)}
                      className="rounded-lg border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      data-testid="mcp-edit-save-btn"
                      onClick={handleEditSave}
                      disabled={saving}
                      className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Server Form */}
      {adding && (
        <div data-testid="mcp-add-form" className="space-y-3 rounded-lg border border-border p-3">
          <h3 className="text-sm font-medium text-foreground">Add Server</h3>

          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Name</label>
            <input
              data-testid="mcp-add-name-input"
              type="text"
              placeholder="my-server"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          {/* Type */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Type</label>
            <select
              data-testid="mcp-add-type-select"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as ServerType })}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="stdio">stdio</option>
              <option value="http">http</option>
              <option value="sse">sse</option>
            </select>
          </div>

          {/* Dynamic fields */}
          <ServerFormFields form={form} setForm={setForm} />

          <div className="flex gap-2 justify-end">
            <button
              data-testid="mcp-add-cancel-btn"
              onClick={() => {
                setAdding(false);
                setForm({ ...EMPTY_FORM });
                setError(null);
              }}
              className="rounded-lg border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="mcp-add-save-btn"
              onClick={handleAdd}
              disabled={saving}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Sub-components ----

function ServerCard({
  server,
  isDeleteConfirm,
  isEditing,
  onToggle,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  onEditStart,
  onEditCancel,
}: {
  server: McpServerConfig;
  isDeleteConfirm: boolean;
  isEditing: boolean;
  onToggle: (enabled: boolean) => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onEditStart: () => void;
  onEditCancel: () => void;
}) {
  const typeStyle = TYPE_STYLES[server.type];

  return (
    <div
      data-testid={`mcp-server-${server.name}`}
      className={`rounded-lg border px-3 py-2.5 transition-colors cursor-pointer ${
        isEditing
          ? 'border-primary/50 bg-primary/5'
          : 'border-border hover:border-border/80 hover:bg-muted/30'
      }`}
      onClick={() => {
        if (!isEditing) onEditStart();
        else onEditCancel();
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {/* Status dot */}
          <span
            data-testid={`mcp-status-${server.name}`}
            className={`h-2 w-2 shrink-0 rounded-full ${
              server.enabled ? 'bg-green-500' : 'bg-gray-500'
            }`}
          />

          {/* Name */}
          <span className="text-sm font-medium text-foreground truncate">{server.name}</span>

          {/* Type badge */}
          <span
            data-testid={`mcp-type-badge-${server.name}`}
            className={`shrink-0 rounded-full border px-1.5 py-0.5 text-xs font-medium ${typeStyle.className}`}
          >
            {typeStyle.label}
          </span>
        </div>

        {/* Actions */}
        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {isDeleteConfirm ? (
            <>
              <span className="text-xs text-red-400 mr-1">Delete?</span>
              <button
                data-testid={`mcp-delete-confirm-${server.name}`}
                onClick={onDeleteConfirm}
                className="rounded-md px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Yes
              </button>
              <button
                data-testid={`mcp-delete-cancel-${server.name}`}
                onClick={onDeleteCancel}
                className="rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
              >
                No
              </button>
            </>
          ) : (
            <>
              {/* Toggle */}
              <button
                data-testid={`mcp-toggle-${server.name}`}
                role="switch"
                aria-checked={server.enabled}
                onClick={() => onToggle(!server.enabled)}
                className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  server.enabled ? 'bg-primary' : 'bg-input'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-background shadow-sm transition-transform ${
                    server.enabled ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </button>

              {/* Delete */}
              <button
                data-testid={`mcp-delete-btn-${server.name}`}
                onClick={onDeleteRequest}
                className="rounded-md px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Details line */}
      <div className="mt-1 text-xs text-muted-foreground truncate pl-4">
        {server.type === 'stdio' ? (
          <span>command: {server.command} {server.args?.join(' ') || ''}</span>
        ) : (
          <span>url: {server.url}</span>
        )}
      </div>

      {/* Tools placeholder */}
      <div className="mt-0.5 text-xs text-muted-foreground/60 pl-4">
        Tools available (connect to discover)
      </div>
    </div>
  );
}

function ServerFormFields({
  form,
  setForm,
  isEdit,
}: {
  form: AddServerForm;
  setForm: (f: AddServerForm) => void;
  isEdit?: boolean;
}) {
  if (form.type === 'stdio') {
    return (
      <>
        {/* Command */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Command</label>
          <input
            data-testid={isEdit ? 'mcp-edit-command-input' : 'mcp-add-command-input'}
            type="text"
            placeholder="node"
            value={form.command}
            onChange={(e) => setForm({ ...form, command: e.target.value })}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        {/* Args */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Args (comma-separated)</label>
          <input
            data-testid={isEdit ? 'mcp-edit-args-input' : 'mcp-add-args-input'}
            type="text"
            placeholder="./server.js, --port, 8080"
            value={form.args}
            onChange={(e) => setForm({ ...form, args: e.target.value })}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        {/* Env */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Environment Variables (KEY=VALUE, ...)</label>
          <input
            data-testid={isEdit ? 'mcp-edit-env-input' : 'mcp-add-env-input'}
            type="text"
            placeholder="API_KEY=secret, PORT=8080"
            value={form.env}
            onChange={(e) => setForm({ ...form, env: e.target.value })}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </>
    );
  }

  // http or sse
  return (
    <>
      {/* URL */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">URL</label>
        <input
          data-testid={isEdit ? 'mcp-edit-url-input' : 'mcp-add-url-input'}
          type="text"
          placeholder="https://api.example.com/mcp"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      {/* Headers */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Headers (KEY=VALUE, ...)</label>
        <input
          data-testid={isEdit ? 'mcp-edit-headers-input' : 'mcp-add-headers-input'}
          type="text"
          placeholder="Authorization=Bearer token, X-Api-Key=abc123"
          value={form.headers}
          onChange={(e) => setForm({ ...form, headers: e.target.value })}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
    </>
  );
}

// ---- Helpers ----

function parseKeyValuePairs(input: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pairs = input.split(',');
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx > 0) {
      const key = pair.slice(0, eqIdx).trim();
      const value = pair.slice(eqIdx + 1).trim();
      if (key) result[key] = value;
    }
  }
  return result;
}
