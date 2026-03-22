interface MemoryCreateFormProps {
  name: string;
  content: string;
  onNameChange: (name: string) => void;
  onContentChange: (content: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
}

export function MemoryCreateForm({
  name, content, onNameChange, onContentChange, onSubmit, onCancel, saving,
}: MemoryCreateFormProps) {
  return (
    <div data-testid="memory-create-form" className="space-y-2">
      <h3 className="text-sm font-medium text-foreground">New Memory File</h3>
      <input
        data-testid="memory-create-name-input"
        type="text"
        placeholder="filename.md"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <textarea
        data-testid="memory-create-textarea"
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder="# Topic Name&#10;&#10;Notes about this topic..."
        rows={6}
        className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <div className="flex gap-2 justify-end">
        <button
          data-testid="memory-create-cancel-btn"
          onClick={onCancel}
          className="rounded-lg border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          data-testid="memory-create-save-btn"
          onClick={onSubmit}
          disabled={saving}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  );
}
