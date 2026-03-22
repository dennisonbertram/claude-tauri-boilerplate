import { useState, useEffect } from 'react';
import {
  MemoryFileRow,
  MemoryEditor,
  MemoryPreview,
  MemoryCreateForm,
  MemorySearchResults,
  MemorySettings,
  useMemoryApi,
} from './memory-panel';
import type { MemoryFile } from '@claude-tauri/shared';

export function MemoryPanel() {
  const {
    files, memoryDir, loading, saving, error, setError,
    searchResults, isSearching,
    handleSave, handleCreate, handleDelete, handleSearch,
    consumeDraft,
  } = useMemoryApi();

  const [selectedFile, setSelectedFile] = useState<MemoryFile | null>(null);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createContent, setCreateContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoMemory, setAutoMemory] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Apply draft from memory update prompt
  useEffect(() => {
    const draft = consumeDraft();
    if (!draft) return;
    const existingFile = files.find((f) => f.name === draft.fileName);
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
  }, [files, consumeDraft]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => { handleSearch(searchQuery); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const onSave = async () => {
    if (!editingFile) return;
    const ok = await handleSave(editingFile, editContent);
    if (ok) setEditingFile(null);
  };

  const onCreate = async () => {
    if (!createName.trim()) { setError('Filename is required'); return; }
    const ok = await handleCreate(createName, createContent);
    if (ok) { setCreating(false); setCreateName(''); setCreateContent(''); }
  };

  const onDelete = async (filename: string) => {
    const ok = await handleDelete(filename);
    if (ok) {
      setDeleteConfirm(null);
      if (selectedFile?.name === filename) setSelectedFile(null);
    }
  };

  if (loading) {
    return (
      <div data-testid="memory-loading" className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="ml-2 text-sm text-muted-foreground">Loading memory files...</span>
      </div>
    );
  }

  return (
    <div data-testid="memory-panel" className="space-y-6">
      {error && (
        <div data-testid="memory-error" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Search header */}
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
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>
      </div>

      <MemorySearchResults query={searchQuery} results={searchResults} isSearching={isSearching} />

      {/* File List */}
      {!searchQuery.trim() && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Memory Files</h3>
          <div className="space-y-1.5">
            {files.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">No memory files found.</div>
            ) : (
              files.map((file) => (
                <MemoryFileRow
                  key={file.name}
                  file={file}
                  isSelected={selectedFile?.name === file.name}
                  isEditing={editingFile === file.name}
                  isDeleteConfirm={deleteConfirm === file.name}
                  onSelect={() => setSelectedFile(selectedFile?.name === file.name ? null : file)}
                  onEdit={() => { setEditingFile(file.name); setEditContent(file.content); setSelectedFile(file); }}
                  onCancelEdit={() => setEditingFile(null)}
                  onDeleteRequest={() => setDeleteConfirm(file.name)}
                  onDeleteConfirm={() => onDelete(file.name)}
                  onDeleteCancel={() => setDeleteConfirm(null)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {editingFile && (
        <MemoryEditor filename={editingFile} content={editContent} onContentChange={setEditContent} onSave={onSave} onCancel={() => setEditingFile(null)} saving={saving} />
      )}

      {selectedFile && !editingFile && <MemoryPreview file={selectedFile} />}

      {!creating ? (
        <button
          data-testid="memory-create-btn"
          onClick={() => setCreating(true)}
          className="w-full rounded-lg border border-dashed border-input py-2.5 text-sm text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
        >
          + Add Memory File
        </button>
      ) : (
        <MemoryCreateForm
          name={createName}
          content={createContent}
          onNameChange={setCreateName}
          onContentChange={setCreateContent}
          onSubmit={onCreate}
          onCancel={() => { setCreating(false); setCreateName(''); setCreateContent(''); }}
          saving={saving}
        />
      )}

      <MemorySettings autoMemory={autoMemory} onToggleAutoMemory={() => setAutoMemory(!autoMemory)} memoryDir={memoryDir} />
    </div>
  );
}
