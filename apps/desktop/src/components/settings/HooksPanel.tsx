import { useState, useEffect, useCallback } from 'react';
import type { HookConfig, HookEventMeta, HookHandler } from '@claude-tauri/shared';
import { apiFetch } from '@/lib/api-config';

const HANDLER_TYPE_STYLES: Record<HookHandler['type'], { label: string; className: string }> = {
  command: { label: 'command', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  http: { label: 'http', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  prompt: { label: 'prompt', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
};

type HandlerType = 'command' | 'http' | 'prompt';

interface AddHookForm {
  event: string;
  matcher: string;
  handlerType: HandlerType;
  command: string;
  timeout: string;
  url: string;
  method: string;
  headers: string;
  prompt: string;
}

const EMPTY_FORM: AddHookForm = {
  event: '',
  matcher: '',
  handlerType: 'command',
  command: '',
  timeout: '30',
  url: '',
  method: 'POST',
  headers: '',
  prompt: '',
};

export interface HookExecutionLog {
  timestamp: string;
  event: string;
  hookName: string;
  result: 'success' | 'failure';
}

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
  const [executionLogs] = useState<HookExecutionLog[]>([]);

  const fetchHooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [hooksRes, eventsRes] = await Promise.all([
        apiFetch(`/api/hooks`),
        apiFetch(`/api/hooks/events`),
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

  useEffect(() => {
    fetchHooks();
  }, [fetchHooks]);

  const handleAdd = async () => {
    setError(null);

    if (!form.event) {
      setError('Event type is required');
      return;
    }

    // Validate handler-specific fields
    if (form.handlerType === 'command' && !form.command.trim()) {
      setError('Command is required');
      return;
    }
    if (form.handlerType === 'http' && !form.url.trim()) {
      setError('URL is required for http handler');
      return;
    }
    if (form.handlerType === 'prompt' && !form.prompt.trim()) {
      setError('Prompt is required for prompt handler');
      return;
    }

    setSaving(true);
    try {
      const handler: Record<string, unknown> = { type: form.handlerType };

      if (form.handlerType === 'command') {
        handler.command = form.command.trim();
        const timeout = parseInt(form.timeout, 10);
        if (!isNaN(timeout) && timeout > 0) handler.timeout = timeout;
      } else if (form.handlerType === 'http') {
        handler.url = form.url.trim();
        handler.method = form.method || 'POST';
        if (form.headers.trim()) {
          handler.headers = parseKeyValuePairs(form.headers);
        }
      } else if (form.handlerType === 'prompt') {
        handler.prompt = form.prompt.trim();
      }

      const payload: Record<string, unknown> = {
        event: form.event,
        handler,
      };

      if (form.matcher.trim()) {
        payload.matcher = form.matcher.trim();
      }

      const res = await apiFetch(`/api/hooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || 'Failed to add hook');
      }

      setAdding(false);
      setForm({ ...EMPTY_FORM });
      await fetchHooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add hook');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    setError(null);
    try {
      const res = await apiFetch(`/api/hooks/${encodeURIComponent(id)}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || 'Toggle failed');
      }

      await fetchHooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Toggle failed');
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      const res = await apiFetch(`/api/hooks/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || 'Delete failed');
      }

      setDeleteConfirm(null);
      await fetchHooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleEditStart = (hook: HookConfig) => {
    setEditingHook(hook.id);
    setEditForm({
      event: hook.event,
      matcher: hook.matcher || '',
      handlerType: hook.handler.type,
      command: hook.handler.command || '',
      timeout: String(hook.handler.timeout || 30),
      url: hook.handler.url || '',
      method: hook.handler.method || 'POST',
      headers: hook.handler.headers
        ? Object.entries(hook.handler.headers)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ')
        : '',
      prompt: hook.handler.prompt || '',
    });
  };

  const handleEditSave = async () => {
    if (!editingHook) return;
    setError(null);
    setSaving(true);

    try {
      const handler: Record<string, unknown> = { type: editForm.handlerType };

      if (editForm.handlerType === 'command') {
        handler.command = editForm.command.trim();
        const timeout = parseInt(editForm.timeout, 10);
        if (!isNaN(timeout) && timeout > 0) handler.timeout = timeout;
      } else if (editForm.handlerType === 'http') {
        handler.url = editForm.url.trim();
        handler.method = editForm.method || 'POST';
        if (editForm.headers.trim()) {
          handler.headers = parseKeyValuePairs(editForm.headers);
        }
      } else if (editForm.handlerType === 'prompt') {
        handler.prompt = editForm.prompt.trim();
      }

      const payload: Record<string, unknown> = {
        event: editForm.event,
        handler,
      };

      if (editForm.matcher.trim()) {
        payload.matcher = editForm.matcher.trim();
      }

      const res = await fetch(
        `${API_BASE}/api/hooks/${encodeURIComponent(editingHook)}`,
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

      setEditingHook(null);
      await fetchHooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  // Group hooks by event
  const hooksByEvent = hooks.reduce<Record<string, HookConfig[]>>((acc, hook) => {
    if (!acc[hook.event]) acc[hook.event] = [];
    acc[hook.event].push(hook);
    return acc;
  }, {});

  // Get event metadata lookup
  const eventMetaMap = events.reduce<Record<string, HookEventMeta>>((acc, e) => {
    acc[e.event] = e;
    return acc;
  }, {});

  if (loading) {
    return (
      <div data-testid="hooks-loading" className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="ml-2 text-sm text-muted-foreground">Loading hooks...</span>
      </div>
    );
  }

  return (
    <div data-testid="hooks-panel" className="space-y-6">
      {error && (
        <div
          data-testid="hooks-error"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
        >
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Hooks</h3>
        {!adding && (
          <button
            data-testid="hooks-add-btn"
            onClick={() => {
              setAdding(true);
              setForm({ ...EMPTY_FORM, event: events[0]?.event || '' });
            }}
            className="rounded-lg border border-input px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            + Add Hook
          </button>
        )}
      </div>

      {/* Hook List grouped by event */}
      <div data-testid="hooks-list" className="space-y-4">
        {Object.keys(hooksByEvent).length === 0 && !adding ? (
          <div className="text-xs text-muted-foreground py-4 text-center">
            No hooks configured.
          </div>
        ) : (
          Object.entries(hooksByEvent).map(([event, eventHooks]) => (
            <div key={event} data-testid={`hooks-group-${event}`}>
              {/* Event group header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-foreground">{event}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {eventHooks.length} {eventHooks.length === 1 ? 'hook' : 'hooks'}
                </span>
                {eventMetaMap[event]?.canBlock && (
                  <span
                    data-testid={`hooks-can-block-${event}`}
                    className="rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 text-xs"
                  >
                    Can Block
                  </span>
                )}
              </div>

              {/* Hook cards */}
              <div className="space-y-2 pl-2">
                {eventHooks.map((hook) => (
                  <div key={hook.id}>
                    <HookCard
                      hook={hook}
                      isDeleteConfirm={deleteConfirm === hook.id}
                      isEditing={editingHook === hook.id}
                      onToggle={(enabled) => handleToggle(hook.id, enabled)}
                      onDeleteRequest={() => setDeleteConfirm(hook.id)}
                      onDeleteConfirm={() => handleDelete(hook.id)}
                      onDeleteCancel={() => setDeleteConfirm(null)}
                      onEditStart={() => handleEditStart(hook)}
                      onEditCancel={() => setEditingHook(null)}
                    />

                    {/* Edit Form */}
                    {editingHook === hook.id && (
                      <div
                        data-testid={`hooks-edit-form-${hook.id}`}
                        className="mt-2 space-y-3 rounded-lg border border-border bg-muted/20 p-3"
                      >
                        <HookFormFields
                          form={editForm}
                          setForm={setEditForm}
                          events={events}
                          eventMetaMap={eventMetaMap}
                          isEdit
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            data-testid="hooks-edit-cancel-btn"
                            onClick={() => setEditingHook(null)}
                            className="rounded-lg border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            data-testid="hooks-edit-save-btn"
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
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Hook Form */}
      {adding && (
        <div data-testid="hooks-add-form" className="space-y-3 rounded-lg border border-border p-3">
          <h3 className="text-sm font-medium text-foreground">Add Hook</h3>

          <HookFormFields
            form={form}
            setForm={setForm}
            events={events}
            eventMetaMap={eventMetaMap}
          />

          <div className="flex gap-2 justify-end">
            <button
              data-testid="hooks-add-cancel-btn"
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
              data-testid="hooks-add-save-btn"
              onClick={handleAdd}
              disabled={saving}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Event Reference */}
      <div data-testid="hooks-event-reference" className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Event Reference</h3>
        <div className="flex flex-wrap gap-1.5">
          {events.map((evt) => (
            <span
              key={evt.event}
              data-testid={`hooks-event-chip-${evt.event}`}
              title={evt.description}
              className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground cursor-help transition-colors"
            >
              {evt.event}
            </span>
          ))}
        </div>
      </div>

      {/* Execution Log */}
      <div data-testid="hooks-execution-log" className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Execution Log</h3>
        <div className="rounded-lg border border-border bg-muted/20 p-3 max-h-40 overflow-y-auto font-mono text-xs">
          {executionLogs.length === 0 ? (
            <div data-testid="hooks-log-empty" className="text-muted-foreground text-center py-2">
              No hook executions yet
            </div>
          ) : (
            executionLogs.map((log, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <span className="text-muted-foreground">[{log.timestamp}]</span>
                <span>{log.event}</span>
                <span className="text-muted-foreground">&rarr;</span>
                <span>{log.hookName}</span>
                <span className={log.result === 'success' ? 'text-green-400' : 'text-red-400'}>
                  {log.result === 'success' ? 'OK' : 'FAIL'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Sub-components ----

function HookCard({
  hook,
  isDeleteConfirm,
  isEditing,
  onToggle,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  onEditStart,
  onEditCancel,
}: {
  hook: HookConfig;
  isDeleteConfirm: boolean;
  isEditing: boolean;
  onToggle: (enabled: boolean) => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onEditStart: () => void;
  onEditCancel: () => void;
}) {
  const typeStyle = HANDLER_TYPE_STYLES[hook.handler.type];

  return (
    <div
      data-testid={`hooks-card-${hook.id}`}
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
            data-testid={`hooks-status-${hook.id}`}
            className={`h-2 w-2 shrink-0 rounded-full ${
              hook.enabled ? 'bg-green-500' : 'bg-gray-500'
            }`}
          />

          {/* Matcher or wildcard */}
          <span className="text-sm font-medium text-foreground truncate">
            {hook.matcher || '*'}
          </span>

          {/* Handler type badge */}
          <span
            data-testid={`hooks-type-badge-${hook.id}`}
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
                data-testid={`hooks-delete-confirm-${hook.id}`}
                onClick={onDeleteConfirm}
                className="rounded-md px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Yes
              </button>
              <button
                data-testid={`hooks-delete-cancel-${hook.id}`}
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
                data-testid={`hooks-toggle-${hook.id}`}
                role="switch"
                aria-checked={hook.enabled}
                onClick={() => onToggle(!hook.enabled)}
                className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  hook.enabled ? 'bg-primary' : 'bg-input'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-background shadow-sm transition-transform ${
                    hook.enabled ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </button>

              {/* Delete */}
              <button
                data-testid={`hooks-delete-btn-${hook.id}`}
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
        {hook.handler.type === 'command' && (
          <span>command: {hook.handler.command}</span>
        )}
        {hook.handler.type === 'http' && (
          <span>url: {hook.handler.url}</span>
        )}
        {hook.handler.type === 'prompt' && (
          <span>prompt: {hook.handler.prompt && hook.handler.prompt.length > 50
            ? hook.handler.prompt.slice(0, 50) + '...'
            : hook.handler.prompt}</span>
        )}
      </div>
    </div>
  );
}

function HookFormFields({
  form,
  setForm,
  events,
  eventMetaMap,
  isEdit,
}: {
  form: AddHookForm;
  setForm: (f: AddHookForm) => void;
  events: HookEventMeta[];
  eventMetaMap: Record<string, HookEventMeta>;
  isEdit?: boolean;
}) {
  const selectedEvent = eventMetaMap[form.event];
  const showMatcher = selectedEvent?.supportsMatcher ?? false;

  return (
    <>
      {/* Event Type */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Event Type</label>
        <select
          data-testid={isEdit ? 'hooks-edit-event-select' : 'hooks-add-event-select'}
          value={form.event}
          onChange={(e) => setForm({ ...form, event: e.target.value })}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {events.map((evt) => (
            <option key={evt.event} value={evt.event}>
              {evt.event} - {evt.description}
            </option>
          ))}
        </select>
      </div>

      {/* Matcher (conditional) */}
      {showMatcher && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Matcher (regex pattern, e.g. tool name)
          </label>
          <input
            data-testid={isEdit ? 'hooks-edit-matcher-input' : 'hooks-add-matcher-input'}
            type="text"
            placeholder="Bash"
            value={form.matcher}
            onChange={(e) => setForm({ ...form, matcher: e.target.value })}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      )}

      {/* Handler Type */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Handler Type</label>
        <select
          data-testid={isEdit ? 'hooks-edit-handler-type-select' : 'hooks-add-handler-type-select'}
          value={form.handlerType}
          onChange={(e) => setForm({ ...form, handlerType: e.target.value as HandlerType })}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="command">Command</option>
          <option value="http">HTTP</option>
          <option value="prompt">Prompt</option>
        </select>
      </div>

      {/* Handler-specific fields */}
      <HandlerFields form={form} setForm={setForm} isEdit={isEdit} />
    </>
  );
}

function HandlerFields({
  form,
  setForm,
  isEdit,
}: {
  form: AddHookForm;
  setForm: (f: AddHookForm) => void;
  isEdit?: boolean;
}) {
  if (form.handlerType === 'command') {
    return (
      <>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Command</label>
          <input
            data-testid={isEdit ? 'hooks-edit-command-input' : 'hooks-add-command-input'}
            type="text"
            placeholder="bash ./hooks/scan-secrets.sh"
            value={form.command}
            onChange={(e) => setForm({ ...form, command: e.target.value })}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Timeout (seconds)</label>
          <input
            data-testid={isEdit ? 'hooks-edit-timeout-input' : 'hooks-add-timeout-input'}
            type="number"
            min="1"
            max="600"
            value={form.timeout}
            onChange={(e) => setForm({ ...form, timeout: e.target.value })}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </>
    );
  }

  if (form.handlerType === 'http') {
    return (
      <>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">URL</label>
          <input
            data-testid={isEdit ? 'hooks-edit-url-input' : 'hooks-add-url-input'}
            type="text"
            placeholder="https://hooks.example.com/notify"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Method</label>
          <select
            data-testid={isEdit ? 'hooks-edit-method-select' : 'hooks-add-method-select'}
            value={form.method}
            onChange={(e) => setForm({ ...form, method: e.target.value })}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Headers (KEY=VALUE, ...)</label>
          <input
            data-testid={isEdit ? 'hooks-edit-headers-input' : 'hooks-add-headers-input'}
            type="text"
            placeholder="Authorization=Bearer token"
            value={form.headers}
            onChange={(e) => setForm({ ...form, headers: e.target.value })}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </>
    );
  }

  // prompt
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">Prompt</label>
      <textarea
        data-testid={isEdit ? 'hooks-edit-prompt-input' : 'hooks-add-prompt-input'}
        placeholder="Check the output for correctness..."
        value={form.prompt}
        onChange={(e) => setForm({ ...form, prompt: e.target.value })}
        rows={3}
        className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </div>
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
