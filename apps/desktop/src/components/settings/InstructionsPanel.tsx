import { useState, useEffect, useCallback } from 'react';
import type { InstructionFile, RuleFile } from '@claude-tauri/shared';
import { apiFetch } from '@/lib/api-config';

const LEVEL_STYLES: Record<
  InstructionFile['level'],
  { label: string; className: string }
> = {
  project: { label: 'Project', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  user: { label: 'User', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  global: { label: 'Global', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  managed: { label: 'Managed', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
};

export function InstructionsPanel() {
  const [files, setFiles] = useState<InstructionFile[]>([]);
  const [rules, setRules] = useState<RuleFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<InstructionFile | null>(null);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [creating, setCreating] = useState(false);
  const [createContent, setCreateContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInstructions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [filesRes, rulesRes] = await Promise.all([
        apiFetch(`/api/instructions`),
        apiFetch(`/api/instructions/rules`),
      ]);

      if (!filesRes.ok) throw new Error('Failed to fetch instruction files');
      if (!rulesRes.ok) throw new Error('Failed to fetch rules');

      const filesData = await filesRes.json() as { files: InstructionFile[] };
      const rulesData = await rulesRes.json() as { rules: RuleFile[] };

      setFiles(filesData.files);
      setRules(rulesData.rules);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load instructions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstructions();
  }, [fetchInstructions]);

  const handleSave = async (filePath: string, content: string) => {
    setSaving(true);
    setError(null);
    try {
      const encoded = btoa(filePath);
      const res = await apiFetch(`/api/instructions/${encoded}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error || 'Save failed');
      }

      setEditingPath(null);
      await fetchInstructions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/instructions/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: createContent }),
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error || 'Create failed');
      }

      setCreating(false);
      setCreateContent('');
      await fetchInstructions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const hasProjectFile = files.some(
    (f) => f.level === 'project' && f.exists && !f.path.includes('.claude/')
  );

  if (loading) {
    return (
      <div data-testid="instructions-loading" className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="ml-2 text-sm text-muted-foreground">Loading instructions...</span>
      </div>
    );
  }

  return (
    <div data-testid="instructions-panel" className="space-y-6">
      {error && (
        <div data-testid="instructions-error" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Instruction Files */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">CLAUDE.md Files</h3>
        <div className="space-y-1.5">
          {files.map((file) => (
            <InstructionFileRow
              key={file.path}
              file={file}
              isSelected={selectedFile?.path === file.path}
              isEditing={editingPath === file.path}
              onSelect={() => {
                if (selectedFile?.path === file.path) {
                  setSelectedFile(null);
                } else {
                  setSelectedFile(file);
                }
              }}
              onEdit={() => {
                setEditingPath(file.path);
                setEditContent(file.content);
                setSelectedFile(file);
              }}
              onCancelEdit={() => setEditingPath(null)}
            />
          ))}
        </div>
      </div>

      {/* Editor */}
      {editingPath && (
        <div data-testid="instructions-editor" className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Editing</h3>
            <span className="text-xs text-muted-foreground truncate max-w-[240px]">
              {editingPath}
            </span>
          </div>
          <textarea
            data-testid="instructions-editor-textarea"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={12}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="flex gap-2 justify-end">
            <button
              data-testid="instructions-cancel-btn"
              onClick={() => setEditingPath(null)}
              className="rounded-lg border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="instructions-save-btn"
              onClick={() => handleSave(editingPath, editContent)}
              disabled={saving}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Preview */}
      {selectedFile && !editingPath && selectedFile.exists && (
        <div data-testid="instructions-preview" className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Preview</h3>
            <span className="text-xs text-muted-foreground truncate max-w-[240px]">
              {selectedFile.path}
            </span>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 max-h-64 overflow-y-auto">
            <pre className="text-sm font-mono whitespace-pre-wrap text-foreground/80">
              {selectedFile.content}
            </pre>
          </div>
        </div>
      )}

      {/* Rules Section */}
      {rules.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Rules Files</h3>
          <div className="space-y-1.5">
            {rules.map((rule) => (
              <RuleFileRow key={rule.path} rule={rule} />
            ))}
          </div>
        </div>
      )}

      {/* Create Button */}
      {!hasProjectFile && !creating && (
        <button
          data-testid="instructions-create-btn"
          onClick={() => setCreating(true)}
          className="w-full rounded-lg border border-dashed border-input py-2.5 text-sm text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
        >
          + Create CLAUDE.md
        </button>
      )}

      {/* Create Form */}
      {creating && (
        <div data-testid="instructions-create-form" className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Create CLAUDE.md</h3>
          <textarea
            data-testid="instructions-create-textarea"
            value={createContent}
            onChange={(e) => setCreateContent(e.target.value)}
            placeholder="# Project Instructions&#10;&#10;Add your project-specific instructions here..."
            rows={8}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="flex gap-2 justify-end">
            <button
              data-testid="instructions-create-cancel-btn"
              onClick={() => {
                setCreating(false);
                setCreateContent('');
              }}
              className="rounded-lg border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="instructions-create-save-btn"
              onClick={handleCreate}
              disabled={saving}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Sub-components ----

function InstructionFileRow({
  file,
  isSelected,
  isEditing,
  onSelect,
  onEdit,
  onCancelEdit,
}: {
  file: InstructionFile;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
}) {
  const levelStyle = LEVEL_STYLES[file.level];

  return (
    <div
      data-testid={`instruction-file-${file.level}`}
      className={`flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
        isSelected
          ? 'border-primary/50 bg-primary/5'
          : 'border-border hover:border-border/80 hover:bg-muted/30'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-muted-foreground shrink-0">
          {file.exists ? '\u{1F4C4}' : '\u{1F4AD}'}
        </span>
        <span
          data-testid={`level-badge-${file.level}`}
          className={`shrink-0 rounded-full border px-1.5 py-0.5 text-xs font-medium ${levelStyle.className}`}
        >
          {levelStyle.label}
        </span>
        <span className="text-sm text-foreground/80 truncate">
          {file.path}
        </span>
        {!file.exists && (
          <span className="text-xs text-muted-foreground italic">(not found)</span>
        )}
      </div>
      {file.exists && (
        <button
          data-testid={`edit-btn-${file.level}`}
          onClick={(e) => {
            e.stopPropagation();
            if (isEditing) {
              onCancelEdit();
            } else {
              onEdit();
            }
          }}
          className="shrink-0 rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          {isEditing ? 'Cancel' : 'Edit'}
        </button>
      )}
    </div>
  );
}

function RuleFileRow({ rule }: { rule: RuleFile }) {
  return (
    <div
      data-testid={`rule-file-${rule.name}`}
      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
    >
      <span className="text-sm text-muted-foreground shrink-0">{'\u{1F4CB}'}</span>
      <span className="text-sm font-medium text-foreground">{rule.name}</span>
      {rule.pathScope && rule.pathScope.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {rule.pathScope.map((scope) => (
            <span
              key={scope}
              data-testid={`path-scope-${scope}`}
              className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground font-mono"
            >
              {scope}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
