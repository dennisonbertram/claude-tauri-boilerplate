import { useState, useEffect, useCallback } from 'react';
import type { MemoryFile, MemorySearchResult } from '@claude-tauri/shared';
import { consumeMemoryUpdateDraft } from '@/lib/memoryUpdatePrompt';
import { apiFetch } from '@/lib/api-config';

export function MemoryPanel() {
  const [files, setFiles] = useState<MemoryFile[]>([]);
  const [memoryDir, setMemoryDir] = useState('');
  const [selectedFile, setSelectedFile] = useState<MemoryFile | null>(null);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createContent, setCreateContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemorySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [autoMemory, setAutoMemory] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchMemoryFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/memory`);
      if (!res.ok) throw new Error('Failed to fetch memory files');

      const data = (await res.json()) as {
        files: MemoryFile[];
        memoryDir: string;
      };
      setFiles(data.files);
      setMemoryDir(data.memoryDir);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load memory files'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemoryFiles();
  }, [fetchMemoryFiles]);

  useEffect(() => {
    if (loading) return;

    const draft = consumeMemoryUpdateDraft();
    if (!draft) return;

    const existingFile = files.find((file) => file.name === draft.fileName);
    if (existingFile) {
      const nextContent = existingFile.content.includes(draft.content)
        ? existingFile.content
        : `${existingFile.content.trim()}\n\n${draft.content.trim()}`;
      setSelectedFile(existingFile);
      setEditingFile(existingFile.name);
      setEditContent(nextContent);
      setCreating(false);
      return;
    }

    setCreating(true);
    setCreateName(draft.fileName);
    setCreateContent(draft.content);
  }, [files, loading]);

  const handleSave = async (filename: string, content: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/memory/${filename}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || 'Save failed');
      }

      setEditingFile(null);
      await fetchMemoryFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!createName.trim()) {
      setError('Filename is required');
      return;
    }

    const name = createName.endsWith('.md') ? createName : `${createName}.md`;

    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, content: createContent }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || 'Create failed');
      }

      setCreating(false);
      setCreateName('');
      setCreateContent('');
      await fetchMemoryFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (filename: string) => {
    setError(null);
    try {
      const res = await apiFetch(`/api/memory/${filename}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || 'Delete failed');
      }

      setDeleteConfirm(null);
      if (selectedFile?.name === filename) {
        setSelectedFile(null);
      }
      await fetchMemoryFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const res = await fetch(
          `${API_BASE}/api/memory/search?q=${encodeURIComponent(query)}`
        );
        if (!res.ok) throw new Error('Search failed');

        const data = (await res.json()) as { results: MemorySearchResult[] };
        setSearchResults(data.results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    []
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (loading) {
    return (
      <div
        data-testid="memory-loading"
        className="flex items-center justify-center py-12"
      >
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading memory files...
        </span>
      </div>
    );
  }

  return (
    <div data-testid="memory-panel" className="space-y-6">
      {error && (
        <div
          data-testid="memory-error"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
        >
          {error}
        </div>
      )}

      {/* Search */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">Memory</h3>
          <div className="flex-1" />
          <div className="relative">
            <input
              data-testid="memory-search-input"
              type="text"
              placeholder="Search memory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-48 rounded-lg border border-input bg-transparent pl-7 pr-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <svg
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>
      </div>

      {/* Search Results */}
      {searchQuery.trim() && (
        <div data-testid="memory-search-results" className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">
            Search Results{' '}
            <span className="text-xs text-muted-foreground">
              ({searchResults.length} match{searchResults.length !== 1 ? 'es' : ''})
            </span>
          </h3>
          {isSearching ? (
            <div className="text-xs text-muted-foreground">Searching...</div>
          ) : searchResults.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No results found.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {searchResults.map((result, i) => (
                <div
                  key={`${result.file}-${result.line}-${i}`}
                  data-testid="memory-search-result-item"
                  className="rounded-lg border border-border px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground">
                      {result.file}
                    </span>
                    <span className="text-muted-foreground">
                      line {result.line}
                    </span>
                  </div>
                  <div className="font-mono text-foreground/80 whitespace-pre-wrap">
                    {highlightMatch(result.text, searchQuery)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* File List */}
      {!searchQuery.trim() && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Memory Files</h3>
          <div className="space-y-1.5">
            {files.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">
                No memory files found.
              </div>
            ) : (
              files.map((file) => (
                <MemoryFileRow
                  key={file.name}
                  file={file}
                  isSelected={selectedFile?.name === file.name}
                  isEditing={editingFile === file.name}
                  isDeleteConfirm={deleteConfirm === file.name}
                  onSelect={() => {
                    if (selectedFile?.name === file.name) {
                      setSelectedFile(null);
                    } else {
                      setSelectedFile(file);
                    }
                  }}
                  onEdit={() => {
                    setEditingFile(file.name);
                    setEditContent(file.content);
                    setSelectedFile(file);
                  }}
                  onCancelEdit={() => setEditingFile(null)}
                  onDeleteRequest={() => setDeleteConfirm(file.name)}
                  onDeleteConfirm={() => handleDelete(file.name)}
                  onDeleteCancel={() => setDeleteConfirm(null)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Editor */}
      {editingFile && (
        <div data-testid="memory-editor" className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Editing</h3>
            <span className="text-xs text-muted-foreground truncate max-w-[240px]">
              {editingFile}
            </span>
          </div>
          <textarea
            data-testid="memory-editor-textarea"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={12}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="flex gap-2 justify-end">
            <button
              data-testid="memory-cancel-btn"
              onClick={() => setEditingFile(null)}
              className="rounded-lg border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="memory-save-btn"
              onClick={() => handleSave(editingFile, editContent)}
              disabled={saving}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Preview */}
      {selectedFile && !editingFile && (
        <div data-testid="memory-preview" className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Preview</h3>
            <span className="text-xs text-muted-foreground truncate max-w-[240px]">
              {selectedFile.name}
            </span>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 max-h-64 overflow-y-auto">
            <pre className="text-sm font-mono whitespace-pre-wrap text-foreground/80">
              {selectedFile.content}
            </pre>
          </div>
        </div>
      )}

      {/* Create Form */}
      {!creating ? (
        <button
          data-testid="memory-create-btn"
          onClick={() => setCreating(true)}
          className="w-full rounded-lg border border-dashed border-input py-2.5 text-sm text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
        >
          + Add Memory File
        </button>
      ) : (
        <div data-testid="memory-create-form" className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">
            New Memory File
          </h3>
          <input
            data-testid="memory-create-name-input"
            type="text"
            placeholder="filename.md"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <textarea
            data-testid="memory-create-textarea"
            value={createContent}
            onChange={(e) => setCreateContent(e.target.value)}
            placeholder="# Topic Name&#10;&#10;Notes about this topic..."
            rows={6}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="flex gap-2 justify-end">
            <button
              data-testid="memory-create-cancel-btn"
              onClick={() => {
                setCreating(false);
                setCreateName('');
                setCreateContent('');
              }}
              className="rounded-lg border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="memory-create-save-btn"
              onClick={handleCreate}
              disabled={saving}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Settings */}
      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="text-sm font-medium text-foreground">Settings</h3>

        {/* Auto-memory toggle */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm text-foreground">Auto-memory</label>
            <p className="text-xs text-muted-foreground">
              Automatically save important context
            </p>
          </div>
          <button
            data-testid="memory-auto-toggle"
            role="switch"
            aria-checked={autoMemory}
            onClick={() => setAutoMemory(!autoMemory)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              autoMemory ? 'bg-primary' : 'bg-input'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${
                autoMemory ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Memory directory */}
        <div>
          <label className="text-sm text-foreground">Memory directory</label>
          <p
            data-testid="memory-dir-display"
            className="text-xs text-muted-foreground font-mono mt-0.5 break-all"
          >
            {memoryDir}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---- Sub-components ----

function MemoryFileRow({
  file,
  isSelected,
  isEditing,
  isDeleteConfirm,
  onSelect,
  onEdit,
  onCancelEdit,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  file: MemoryFile;
  isSelected: boolean;
  isEditing: boolean;
  isDeleteConfirm: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  return (
    <div
      data-testid={`memory-file-${file.name}`}
      className={`flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
        isSelected
          ? 'border-primary/50 bg-primary/5'
          : 'border-border hover:border-border/80 hover:bg-muted/30'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm shrink-0">
          {file.isEntrypoint ? '\u2B50' : '\uD83D\uDCC4'}
        </span>
        <span className="text-sm text-foreground truncate">{file.name}</span>
        {file.isEntrypoint && (
          <span
            data-testid="memory-entrypoint-badge"
            className="shrink-0 rounded-full border px-1.5 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 border-amber-500/30"
          >
            entrypoint
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {formatBytesInline(file.sizeBytes)}
        </span>
      </div>

      <div
        className="flex items-center gap-1 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {isDeleteConfirm ? (
          <>
            <span className="text-xs text-red-400 mr-1">Delete?</span>
            <button
              data-testid={`memory-delete-confirm-${file.name}`}
              onClick={onDeleteConfirm}
              className="rounded-md px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Yes
            </button>
            <button
              data-testid={`memory-delete-cancel-${file.name}`}
              onClick={onDeleteCancel}
              className="rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
            >
              No
            </button>
          </>
        ) : (
          <>
            <button
              data-testid={`memory-edit-btn-${file.name}`}
              onClick={() => {
                if (isEditing) {
                  onCancelEdit();
                } else {
                  onEdit();
                }
              }}
              className="rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
            {!file.isEntrypoint && (
              <button
                data-testid={`memory-delete-btn-${file.name}`}
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
            )}
          </>
        )}
      </div>
    </div>
  );
}

function formatBytesInline(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);

  if (idx === -1) return text;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);

  return (
    <>
      {before}
      <mark className="bg-yellow-500/30 text-foreground rounded px-0.5">
        {match}
      </mark>
      {after}
    </>
  );
}
