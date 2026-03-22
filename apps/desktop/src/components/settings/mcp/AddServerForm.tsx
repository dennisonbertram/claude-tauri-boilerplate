import type { AddServerForm as AddServerFormType, ServerType } from './types';
import { ServerFormFields } from './ServerFormFields';

interface AddServerFormProps {
  form: AddServerFormType;
  setForm: (f: AddServerFormType) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function AddServerForm({ form, setForm, saving, onSave, onCancel }: AddServerFormProps) {
  return (
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
          onClick={onCancel}
          className="rounded-lg border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          data-testid="mcp-add-save-btn"
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
