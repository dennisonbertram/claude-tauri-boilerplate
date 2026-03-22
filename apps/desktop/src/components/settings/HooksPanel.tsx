import { useState, useEffect, useCallback } from 'react';
import type { HookConfig, HookEventMeta } from '@claude-tauri/shared';
import { HookCard } from './hooks/HookCard';
import { HookFormFields } from './hooks/HookFormFields';
import { HookExecutionLog } from './hooks/HookExecutionLog';
import { HookEventReference } from './hooks/HookEventReference';
import { parseKeyValuePairs } from './hooks/utils';
import { EMPTY_FORM } from './hooks/types';
import type { AddHookForm, HookExecutionLog as HookExecutionLogEntry } from './hooks/types';

export type { HookExecutionLog as HookExecutionLogType } from './hooks/types';

const API_BASE = 'http://localhost:3131';

export function HooksPanel() {
  const [hooks, setHooks] = useState<HookConfig[]>([]);
  const [events, setEvents] = useState<HookEventMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<AddHookForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingHook, setEditingHook] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AddHookForm>({ ...EMPTY_FORM });
  const [executionLogs] = useState<HookExecutionLogEntry[]>([]);

  const fetchHooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [hooksRes, eventsRes] = await Promise.all([
        fetch(`${API_BASE}/api/hooks`),
        fetch(`${API_BASE}/api/hooks/events`),
      ]);
      if (!hooksRes.ok) throw new Error('Failed to fetch hooks');
      if (!eventsRes.ok) throw new Error('Failed to fetch hook events');
      const hooksData = (await hooksRes.json()) as { hooks: HookConfig[] };
      const eventsData = (await eventsRes.json()) as { events: HookEventMeta[] };
      setHooks(hooksData.hooks);
      setEvents(eventsData.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHooks(); }, [fetchHooks]);

  const buildHandler = (f: AddHookForm): Record<string, unknown> => {
    const handler: Record<string, unknown> = { type: f.handlerType };
    if (f.handlerType === 'command') {
      handler.command = f.command.trim();
      const timeout = parseInt(f.timeout, 10);
      if (!isNaN(timeout) && timeout > 0) handler.timeout = timeout;
    } else if (f.handlerType === 'http') {
      handler.url = f.url.trim();
      handler.method = f.method || 'POST';
      if (f.headers.trim()) handler.headers = parseKeyValuePairs(f.headers);
    } else if (f.handlerType === 'prompt') {
      handler.prompt = f.prompt.trim();
    }
    return handler;
  };

  const buildPayload = (f: AddHookForm): Record<string, unknown> => {
    const payload: Record<string, unknown> = { event: f.event, handler: buildHandler(f) };
    if (f.matcher.trim()) payload.matcher = f.matcher.trim();
    return payload;
  };

  const handleAdd = async () => {
    setError(null);
    if (!form.event) { setError('Event type is required'); return; }
    if (form.handlerType === 'command' && !form.command.trim()) { setError('Command is required'); return; }
    if (form.handlerType === 'http' && !form.url.trim()) { setError('URL is required for http handler'); return; }
    if (form.handlerType === 'prompt' && !form.prompt.trim()) { setError('Prompt is required for prompt handler'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/hooks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildPayload(form)) });
      if (!res.ok) { const body = (await res.json()) as { error?: string }; throw new Error(body.error || 'Failed to add hook'); }
      setAdding(false);
      setForm({ ...EMPTY_FORM });
      await fetchHooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add hook');
    } finally { setSaving(false); }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/hooks/${encodeURIComponent(id)}/toggle`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) });
      if (!res.ok) { const body = (await res.json()) as { error?: string }; throw new Error(body.error || 'Toggle failed'); }
      await fetchHooks();
    } catch (err) { setError(err instanceof Error ? err.message : 'Toggle failed'); }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/hooks/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) { const body = (await res.json()) as { error?: string }; throw new Error(body.error || 'Delete failed'); }
      setDeleteConfirm(null);
      await fetchHooks();
    } catch (err) { setError(err instanceof Error ? err.message : 'Delete failed'); }
  };

  const handleEditStart = (hook: HookConfig) => {
    setEditingHook(hook.id);
    setEditForm({
      event: hook.event, matcher: hook.matcher || '', handlerType: hook.handler.type,
      command: hook.handler.command || '', timeout: String(hook.handler.timeout || 30),
      url: hook.handler.url || '', method: hook.handler.method || 'POST',
      headers: hook.handler.headers ? Object.entries(hook.handler.headers).map(([k, v]) => `${k}=${v}`).join(', ') : '',
      prompt: hook.handler.prompt || '',
    });
  };

  const handleEditSave = async () => {
    if (!editingHook) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/hooks/${encodeURIComponent(editingHook)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildPayload(editForm)) });
      if (!res.ok) { const body = (await res.json()) as { error?: string }; throw new Error(body.error || 'Update failed'); }
      setEditingHook(null);
      await fetchHooks();
    } catch (err) { setError(err instanceof Error ? err.message : 'Update failed'); }
    finally { setSaving(false); }
  };

  const hooksByEvent = hooks.reduce<Record<string, HookConfig[]>>((acc, hook) => { if (!acc[hook.event]) acc[hook.event] = []; acc[hook.event].push(hook); return acc; }, {});
  const eventMetaMap = events.reduce<Record<string, HookEventMeta>>((acc, e) => { acc[e.event] = e; return acc; }, {});

  if (loading) {
    return (<div data-testid="hooks-loading" className="flex items-center justify-center py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /><span className="ml-2 text-sm text-muted-foreground">Loading hooks...</span></div>);
  }

  return (
    <div data-testid="hooks-panel" className="space-y-6">
      {error && (<div data-testid="hooks-error" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>)}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Hooks</h3>
        {!adding && (<button data-testid="hooks-add-btn" onClick={() => { setAdding(true); setForm({ ...EMPTY_FORM, event: events[0]?.event || '' }); }} className="rounded-lg border border-input px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">+ Add Hook</button>)}
      </div>
      <div data-testid="hooks-list" className="space-y-4">
        {Object.keys(hooksByEvent).length === 0 && !adding ? (
          <div className="text-xs text-muted-foreground py-4 text-center">No hooks configured.</div>
        ) : (
          Object.entries(hooksByEvent).map(([event, eventHooks]) => (
            <div key={event} data-testid={`hooks-group-${event}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-foreground">{event}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{eventHooks.length} {eventHooks.length === 1 ? 'hook' : 'hooks'}</span>
                {eventMetaMap[event]?.canBlock && (<span data-testid={`hooks-can-block-${event}`} className="rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 text-xs">Can Block</span>)}
              </div>
              <div className="space-y-2 pl-2">
                {eventHooks.map((hook) => (
                  <div key={hook.id}>
                    <HookCard hook={hook} isDeleteConfirm={deleteConfirm === hook.id} isEditing={editingHook === hook.id} onToggle={(enabled) => handleToggle(hook.id, enabled)} onDeleteRequest={() => setDeleteConfirm(hook.id)} onDeleteConfirm={() => handleDelete(hook.id)} onDeleteCancel={() => setDeleteConfirm(null)} onEditStart={() => handleEditStart(hook)} onEditCancel={() => setEditingHook(null)} />
                    {editingHook === hook.id && (
                      <div data-testid={`hooks-edit-form-${hook.id}`} className="mt-2 space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                        <HookFormFields form={editForm} setForm={setEditForm} events={events} eventMetaMap={eventMetaMap} isEdit />
                        <div className="flex gap-2 justify-end">
                          <button data-testid="hooks-edit-cancel-btn" onClick={() => setEditingHook(null)} className="rounded-lg border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">Cancel</button>
                          <button data-testid="hooks-edit-save-btn" onClick={handleEditSave} disabled={saving} className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      {adding && (
        <div data-testid="hooks-add-form" className="space-y-3 rounded-lg border border-border p-3">
          <h3 className="text-sm font-medium text-foreground">Add Hook</h3>
          <HookFormFields form={form} setForm={setForm} events={events} eventMetaMap={eventMetaMap} />
          <div className="flex gap-2 justify-end">
            <button data-testid="hooks-add-cancel-btn" onClick={() => { setAdding(false); setForm({ ...EMPTY_FORM }); setError(null); }} className="rounded-lg border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">Cancel</button>
            <button data-testid="hooks-add-save-btn" onClick={handleAdd} disabled={saving} className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      )}
      <HookEventReference events={events} />
      <HookExecutionLog logs={executionLogs} />
    </div>
  );
}
