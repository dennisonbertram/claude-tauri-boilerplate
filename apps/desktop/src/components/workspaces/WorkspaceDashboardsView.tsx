import { useState, useEffect, useCallback } from 'react';
import type { Artifact } from '@claude-tauri/shared';
import * as api from '@/lib/workspace-api';
import { DashboardPromptModal } from './DashboardPromptModal';

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function ArchiveIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface WorkspaceDashboardsViewProps {
  projectId: string;
  workspaceId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WorkspaceDashboardsView({ projectId, workspaceId: _workspaceId }: WorkspaceDashboardsViewProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selected, setSelected] = useState<Artifact | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('New Dashboard');
  const [modalDefaultValue, setModalDefaultValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'new' | 'regenerate' | null>(null);

  // Load artifacts
  const loadArtifacts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await api.fetchProjectArtifacts(projectId);
      const filtered = includeArchived ? list : list.filter((a) => a.status === 'active');
      setArtifacts(filtered);
      // If selected artifact is gone from the new list, clear selection
      if (selected && !filtered.find((a) => a.id === selected.id)) {
        setSelected(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboards');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, includeArchived, selected]);

  useEffect(() => {
    void loadArtifacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, includeArchived]);

  const handleNewDashboard = useCallback(() => {
    setModalTitle('New Dashboard');
    setModalDefaultValue('');
    setModalError(null);
    setPendingAction('new');
    setModalOpen(true);
  }, []);

  const handleArchive = useCallback(async (artifact: Artifact) => {
    setError(null);
    try {
      await api.archiveArtifact(artifact.id);
      setArtifacts((prev) => prev.filter((a) => a.id !== artifact.id));
      if (selected?.id === artifact.id) {
        setSelected(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive dashboard');
    }
  }, [selected]);

  const handleRegenerate = useCallback(() => {
    if (!selected) return;
    setModalTitle('Regenerate Dashboard');
    setModalDefaultValue('');
    setModalError(null);
    setPendingAction('regenerate');
    setModalOpen(true);
  }, [selected]);

  const handleModalConfirm = useCallback(async (prompt: string) => {
    setIsGenerating(true);
    setModalError(null);
    try {
      if (pendingAction === 'new') {
        const { artifact } = await api.generateArtifact(projectId, { prompt });
        setArtifacts((prev) => [artifact, ...prev]);
        setSelected(artifact);
      } else if (pendingAction === 'regenerate' && selected) {
        setIsRegenerating(true);
        const { artifact } = await api.regenerateArtifact(selected.id, { prompt });
        setArtifacts((prev) => prev.map((a) => (a.id === artifact.id ? artifact : a)));
        setSelected(artifact);
      }
      setModalOpen(false);
      setPendingAction(null);
      setModalDefaultValue('');
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to generate dashboard');
    } finally {
      setIsGenerating(false);
      setIsRegenerating(false);
    }
  }, [pendingAction, projectId, selected]);

  const handleModalCancel = useCallback(() => {
    if (isGenerating) return;
    setModalOpen(false);
    setPendingAction(null);
    setModalError(null);
  }, [isGenerating]);

  const handleTitleClick = useCallback(() => {
    if (!selected) return;
    setEditTitleValue(selected.title);
    setEditingTitle(true);
  }, [selected]);

  const handleTitleSave = useCallback(async () => {
    if (!selected || !editTitleValue.trim()) {
      setEditingTitle(false);
      return;
    }
    if (editTitleValue.trim() === selected.title) {
      setEditingTitle(false);
      return;
    }
    setError(null);
    try {
      const updated = await api.renameArtifact(selected.id, editTitleValue.trim());
      setArtifacts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setSelected(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename dashboard');
    } finally {
      setEditingTitle(false);
    }
  }, [selected, editTitleValue]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        void handleTitleSave();
      } else if (e.key === 'Escape') {
        setEditingTitle(false);
      }
    },
    [handleTitleSave]
  );

  // Parse spec for display
  const parsedSpec = selected ? (() => {
    try {
      return JSON.parse(selected.currentRevisionId ? '{}' : '{}');
    } catch {
      return null;
    }
  })() : null;
  void parsedSpec;

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left panel: artifact list */}
      <div className="flex flex-col w-70 shrink-0 border-r border-border min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Dashboards</span>
          <button
            type="button"
            onClick={handleNewDashboard}
            title="New dashboard"
            aria-label="New dashboard"
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <PlusIcon />
            New
          </button>
        </div>

        {/* Archive toggle */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="rounded"
            />
            Show archived
          </label>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : artifacts.length === 0 ? (
            <p className="px-3 py-6 text-xs text-muted-foreground text-center">No dashboards yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {artifacts.map((artifact) => (
                <li key={artifact.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(artifact)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelected(artifact);
                      }
                    }}
                    className={`group w-full text-left px-3 py-2.5 transition-colors hover:bg-accent/50 cursor-pointer ${
                      selected?.id === artifact.id ? 'bg-accent' : ''
                    } ${artifact.status === 'archived' ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{artifact.title}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{formatDate(artifact.createdAt)}</div>
                        {artifact.status === 'archived' && (
                          <div className="mt-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                            Archived
                          </div>
                        )}
                      </div>
                      {artifact.status === 'active' && (
                        <button
                          type="button"
                          aria-label={`Archive ${artifact.title}`}
                          title="Archive"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleArchive(artifact);
                          }}
                          className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                        >
                          <ArchiveIcon />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right panel: detail view */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        {error && (
          <div className="px-4 py-2 text-sm text-destructive border-b border-border bg-destructive/5">
            {error}
          </div>
        )}

        {!selected ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">Select a dashboard to view it</p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
            {/* Detail header */}
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border">
              <div className="min-w-0 flex-1">
                {editingTitle ? (
                  <input
                    autoFocus
                    type="text"
                    value={editTitleValue}
                    onChange={(e) => setEditTitleValue(e.target.value)}
                    onBlur={() => void handleTitleSave()}
                    onKeyDown={handleTitleKeyDown}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    aria-label="Edit dashboard title"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={handleTitleClick}
                    title="Click to rename"
                    className="text-left text-sm font-semibold text-foreground hover:underline truncate max-w-full block"
                  >
                    {selected.title}
                  </button>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>Created {formatDate(selected.createdAt)}</span>
                  {selected.currentRevisionId && <span>Has revisions</span>}
                  {selected.status === 'archived' && (
                    <span className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">
                      Archived
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {selected.status === 'active' && (
                  <>
                    <button
                      type="button"
                      aria-label="Archive dashboard"
                      title="Archive"
                      onClick={() => void handleArchive(selected)}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      <ArchiveIcon />
                      Archive
                    </button>
                    <button
                      type="button"
                      aria-label="Regenerate dashboard"
                      title="Regenerate"
                      onClick={handleRegenerate}
                      disabled={isRegenerating}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      <RefreshIcon />
                      {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Canvas area */}
            <div className="flex-1 p-4">
              <div className="rounded-md border border-border bg-muted/10">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Dashboard Spec
                    {selected.currentRevisionId && ' (latest revision)'}
                  </span>
                </div>
                <div className="p-3">
                  {selected.currentRevisionId ? (
                    <p className="text-sm text-muted-foreground italic">
                      Spec stored in revision{' '}
                      <span className="font-mono">{selected.currentRevisionId.slice(0, 8)}</span>.
                      Dashboard canvas is in early preview. Spec is saved — interactive widget rendering is coming soon.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No spec generated yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <DashboardPromptModal
        isOpen={modalOpen}
        title={modalTitle}
        defaultValue={modalDefaultValue}
        isLoading={isGenerating}
        error={modalError}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
      />
    </div>
  );
}
