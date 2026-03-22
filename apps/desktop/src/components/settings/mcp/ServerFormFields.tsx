import type { AddServerForm } from './types';

interface ServerFormFieldsProps {
  form: AddServerForm;
  setForm: (f: AddServerForm) => void;
  isEdit?: boolean;
}

export function ServerFormFields({ form, setForm, isEdit }: ServerFormFieldsProps) {
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
