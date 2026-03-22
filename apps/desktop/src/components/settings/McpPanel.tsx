import { useState, useEffect, useCallback } from 'react';
import type { McpServerConfig } from '@claude-tauri/shared';
import { API_BASE, EMPTY_FORM, parseKeyValuePairs } from './mcp/types';
import type { AddServerForm, McpPreset } from './mcp/types';
import { ServerCard } from './mcp/ServerCard';
import { ServerFormFields } from './mcp/ServerFormFields';
import { PresetList } from './mcp/PresetList';
import { AddServerForm as AddServerFormComponent } from './mcp/AddServerForm';

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
    if (!form.name.trim()) { setError('Server name is required'); return; }
    if (form.type === 'stdio' && !form.command.trim()) { setError('Command is required for stdio servers'); return; }
    if ((form.type === 'http' || form.type === 'sse') && !form.url.trim()) { setError('URL is required for http/sse servers'); return; }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = { name: form.name.trim(), type: form.type };
      if (form.type === 'stdio') {
        payload.command = form.command.trim();
        if (form.args.trim()) payload.args = form.args.split(',').map((a) => a.trim()).filter(Boolean);
        if (form.env.trim()) payload.env = parseKeyValuePairs(form.env);
      } else {
        payload.url = form.url.trim();
        if (form.headers.trim()) payload.headers = parseKeyValuePairs(form.headers);
      }
      const res = await fetch(`${API_BASE}/api/mcp/servers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { const body = (await res.json()) as { error?: string }; throw new Error(body.error || 'Failed to add server'); }
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
      const res = await fetch(`${API_BASE}/api/mcp/servers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...preset.config, enabled: preset.config.enabled !== false }) });
      if (!res.ok) { const body = (await res.json()) as { error?: string }; throw new Error(body.error || 'Failed to install preset'); }
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
      const res = await fetch(`${API_BASE}/api/mcp/servers/${encodeURIComponent(name)}/toggle`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) });
      if (!res.ok) { const body = (await res.json()) as { error?: string }; throw new Error(body.error || 'Toggle failed'); }
      await fetchServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Toggle failed');
    }
  };

  const handleDelete = async (name: string) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mcp/servers/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (!res.ok) { const body = (await res.json()) as { error?: string }; throw new Error(body.error || 'Delete failed'); }
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
      headers: server.headers ? Object.entries(server.headers).map(([k, v]) => `${k}=${v}`).join(', ') : '',
    });
  };

  const handleEditSave = async () => {
    if (!editingServer) return;
    setError(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (editForm.type === 'stdio') {
        payload.command = editForm.command.trim();
        payload.args = editForm.args.trim() ? editForm.args.split(',').map((a) => a.trim()).filter(Boolean) : [];
        payload.env = editForm.env.trim() ? parseKeyValuePairs(editForm.env) : {};
      } else {
        payload.url = editForm.url.trim();
        payload.headers = editForm.headers.trim() ? parseKeyValuePairs(editForm.headers) : {};
      }
      const res = await fetch(`${API_BASE}/api/mcp/servers/${encodeURIComponent(editingServer)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { const body = (await res.json()) as { error?: string }; throw new Error(body.error || 'Update failed'); }
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
        <div data-testid="mcp-error" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">MCP Servers</h3>
        {!adding && (
          <button data-testid="mcp-add-btn" onClick={() => setAdding(true)} className="rounded-lg border border-input px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            + Add Server
          </button>
        )}
      </div>

      <PresetList servers={servers} installingPresetId={installingPresetId} onInstallPreset={handleInstallPreset} />

      {/* Server List */}
      <div className="space-y-2">
        {servers.length === 0 && !adding ? (
          <div className="text-xs text-muted-foreground py-4 text-center">No MCP servers configured.</div>
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

              {editingServer === server.name && (
                <div data-testid={`mcp-edit-form-${server.name}`} className="mt-2 space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                  <ServerFormFields form={editForm} setForm={setEditForm} isEdit />
                  <div className="flex gap-2 justify-end">
                    <button data-testid="mcp-edit-cancel-btn" onClick={() => setEditingServer(null)} className="rounded-lg border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">Cancel</button>
                    <button data-testid="mcp-edit-save-btn" onClick={handleEditSave} disabled={saving} className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {adding && (
        <AddServerFormComponent
          form={form}
          setForm={setForm}
          saving={saving}
          onSave={handleAdd}
          onCancel={() => { setAdding(false); setForm({ ...EMPTY_FORM }); setError(null); }}
        />
      )}
    </div>
  );
}
