import { useState, useRef, useMemo, useCallback } from 'react';
import type { Document } from '@claude-tauri/shared';
import {
  Plus,
  MagnifyingGlass,
  SquaresFour,
  List,
  FileArrowUp,
} from '@phosphor-icons/react';
import { useDocuments } from '@/hooks/useDocuments';
import { getDocumentFileUrl } from '@/lib/api/documents-api';
import { DocumentUploadZone } from './DocumentUploadZone';
import { DocumentCard } from './DocumentCard';
import { DocumentTable } from './DocumentTable';
import { DocumentContextMenu, type DocumentContextMenuState } from './DocumentContextMenu';
import { DocumentPreviewModal } from './DocumentPreviewModal';

export function DocumentsView() {
  const { documents, isLoading, upload, remove } = useDocuments();
  const [viewMode, setViewMode] = useState<'gallery' | 'table'>('gallery');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<DocumentContextMenuState>({
    document: null,
    position: null,
  });

  const filtered = useMemo(() => {
    if (!searchQuery) return documents;
    const q = searchQuery.toLowerCase();
    return documents.filter(d => d.filename.toLowerCase().includes(q));
  }, [documents, searchQuery]);

  const handleUpload = (files: File[]) => {
    void upload(files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleUpload(Array.from(files));
      e.target.value = '';
    }
  };

  const handleOpen = (id: string) => {
    setPreviewDocId(id);
  };

  const previewDoc = useMemo(
    () => (previewDocId ? filtered.find(d => d.id === previewDocId) ?? documents.find(d => d.id === previewDocId) ?? null : null),
    [previewDocId, filtered, documents],
  );

  const handleDelete = async (id: string) => {
    try {
      await remove(id);
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, doc: Document) => {
    setContextMenu({
      document: doc,
      position: { x: e.clientX, y: e.clientY },
    });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ document: null, position: null });
  }, []);

  // Empty state — no documents at all
  if (!isLoading && documents.length === 0) {
    return (
      <DocumentUploadZone onUpload={handleUpload}>
        <div className="flex flex-1 flex-col min-h-0">
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-border/20 flex items-center justify-center">
                <FileArrowUp size={32} className="text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-medium text-foreground">No documents yet</p>
                <p className="text-sm text-muted-foreground">
                  Upload your first document or drag and drop files here
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-[var(--app-cta)] transition-colors shadow-sm"
              >
                <Plus size={16} />
                Upload Document
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInputChange}
              />
            </div>
          </div>
        </div>
      </DocumentUploadZone>
    );
  }

  return (
    <DocumentUploadZone onUpload={handleUpload}>
      <div className="flex flex-1 flex-col min-h-0">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-8 border-b border-border bg-background/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-medium text-foreground">Documents</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-border/40 text-muted-foreground font-medium">
              {documents.length} total
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlass
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-9 pr-3 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border w-56"
              />
            </div>

            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-border bg-card overflow-hidden">
              <button
                onClick={() => setViewMode('gallery')}
                className={`p-1.5 transition-colors ${viewMode === 'gallery' ? 'bg-border/40 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                title="Gallery view"
              >
                <SquaresFour size={16} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 transition-colors ${viewMode === 'table' ? 'bg-border/40 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                title="Table view"
              >
                <List size={16} />
              </button>
            </div>

            {/* Upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-[var(--app-cta)] transition-colors shadow-sm"
            >
              <Plus size={16} />
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-border border-t-foreground rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Loading documents...</p>
              </div>
            </div>
          ) : filtered.length === 0 && searchQuery ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-foreground">No documents match your search</p>
                <p className="text-sm text-muted-foreground">
                  Try a different search term
                </p>
              </div>
            </div>
          ) : viewMode === 'gallery' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filtered.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onDelete={handleDelete}
                  onOpen={handleOpen}
                  onContextMenu={handleContextMenu}
                />
              ))}
            </div>
          ) : (
            <DocumentTable
              documents={filtered}
              onDelete={handleDelete}
              onOpen={handleOpen}
              onContextMenu={handleContextMenu}
            />
          )}
        </div>
      </div>

      {/* Context menu */}
      <DocumentContextMenu
        state={contextMenu}
        onClose={handleCloseContextMenu}
        onOpen={handleOpen}
        onDelete={handleDelete}
      />

      {/* Preview modal */}
      <DocumentPreviewModal
        document={previewDoc}
        documents={filtered}
        onClose={() => setPreviewDocId(null)}
        onNavigate={(id) => setPreviewDocId(id)}
      />
    </DocumentUploadZone>
  );
}
