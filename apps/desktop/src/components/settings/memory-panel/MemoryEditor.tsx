interface MemoryEditorProps {
  filename: string;
  content: string;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

export function MemoryEditor({ filename, content, onContentChange, onSave, onCancel, saving }: MemoryEditorProps) {
  return (
    <div data-testid="memory-editor" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Editing</h3>
        <span className="text-xs text-muted-foreground truncate max-w-[240px]">
          {filename}
        </span>
      </div>
      <textarea
        data-testid="memory-editor-textarea"
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        rows={12}
        className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <div className="flex gap-2 justify-end">
        <button
          data-testid="memory-cancel-btn"
          onClick={onCancel}
          className="rounded-lg border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          data-testid="memory-save-btn"
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
