import type { AddHookForm } from './types';

export function HandlerFields({
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
