import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Workspace } from '@claude-tauri/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WorkspaceStatusBadge } from './WorkspaceStatusBadge';
import { WorkspaceDiffView } from './WorkspaceDiffView';
import { WorkspaceMergeDialog } from './WorkspaceMergeDialog';
import { ChatPage } from '@/components/chat/ChatPage';
import type { ChatPageStatusData } from '@/components/chat/ChatPage';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import { copyTextToClipboard } from '@/lib/clipboard';
import { promptMemoryUpdate } from '@/lib/memoryUpdatePrompt';
import { useSettings } from '@/hooks/useSettings';
import { getWorkflowPrompt, buildMergeMemoryDraft } from '@/lib/workflowPrompts';
import * as api from '@/lib/workspace-api';
import { openInIde, IDE_CONFIGS } from '@/lib/ide-opener';

type Tab = 'chat' | 'diff' | 'paths' | 'notes';

interface WorkspacePanelProps {
  workspace: Workspace;
  onStatusChange?: (data: ChatPageStatusData) => void;
  onWorkspaceUpdate?: () => void;
  onOpenSettings?: (tab?: string) => void;
  onTaskComplete?: (params: {
    status: 'completed' | 'failed' | 'stopped';
    summary: string;
    branch: string;
    workspaceName: string;
  }) => void;
}

function getDirectoryLabel(path: string): string {
  const normalized = path.replace(/\/+$/, '');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || normalized;
}

export function WorkspacePanel({ workspace, onStatusChange, onWorkspaceUpdate, onOpenSettings, onTaskComplete }: WorkspacePanelProps) {
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [mergeDialog, setMergeDialog] = useState<'merge' | 'discard' | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [additionalDirectories, setAdditionalDirectories] = useState<string[]>(workspace.additionalDirectories ?? []);
  const [newDirectory, setNewDirectory] = useState('');
  const [directoryFilter, setDirectoryFilter] = useState('');
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  // Notes state
  const [notes, setNotes] = useState('');
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [notesSavedMessage, setNotesSavedMessage] = useState(false);
  const [notesPreviewMode, setNotesPreviewMode] = useState(false);
  const notesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAdditionalDirectories(workspace.additionalDirectories ?? []);
  }, [workspace.additionalDirectories, workspace.id]);

  // Load notes when workspace changes or notes tab is opened
  useEffect(() => {
    if (activeTab !== 'notes') return;
    setNotesLoaded(false);
    api.fetchWorkspaceNotes(workspace.id).then((content) => {
      setNotes(content);
      setNotesLoaded(true);
    }).catch(() => {
      setNotes('');
      setNotesLoaded(true);
    });
  }, [workspace.id, activeTab]);

  // Load the existing session for this workspace on mount.
  useEffect(() => {
    setSessionLoaded(false);
    api.getWorkspaceSession(workspace.id).then((session) => {
      setSessionId(session?.id ?? null);
      setSessionLoaded(true);
    }).catch(() => {
      setSessionId(null);
      setSessionLoaded(true);
    });
  }, [workspace.id]);

  const handleNotesChange = useCallback((value: string) => {
    setNotes(value);
    if (notesSaveTimerRef.current) {
      clearTimeout(notesSaveTimerRef.current);
    }
    notesSaveTimerRef.current = setTimeout(() => {
      api.saveWorkspaceNotes(workspace.id, value).then(() => {
        setNotesSavedMessage(true);
        setTimeout(() => setNotesSavedMessage(false), 2000);
      }).catch(() => {
        // Silently ignore save errors (transient)
      });
    }, 500);
  }, [workspace.id]);

  const handleNotesBlur = useCallback(() => {
    if (notesSaveTimerRef.current) {
      clearTimeout(notesSaveTimerRef.current);
      notesSaveTimerRef.current = null;
    }
    api.saveWorkspaceNotes(workspace.id, notes).then(() => {
      setNotesSavedMessage(true);
      setTimeout(() => setNotesSavedMessage(false), 2000);
    }).catch(() => {
      // Silently ignore save errors
    });
  }, [workspace.id, notes]);

  const canMerge = workspace.status === 'ready' || workspace.status === 'active';
  const canDiscard = workspace.status === 'ready' || workspace.status === 'active';

  const handleMerge = useCallback(async () => {
    await api.mergeWorkspace(workspace.id);
    onWorkspaceUpdate?.();
    const prompt = getWorkflowPrompt(settings.workflowPrompts, 'mergeMemory');
    promptMemoryUpdate({
      trigger: 'workspace-merge',
      draft: {
        fileName: 'MEMORY.md',
        content: buildMergeMemoryDraft({
          prompt,
          workspaceName: workspace.name,
          branch: workspace.branch,
          baseBranch: workspace.baseBranch,
        }),
      },
      onOpenMemory: () => onOpenSettings?.('memory'),
    });
  }, [
    workspace.id,
    workspace.name,
    workspace.branch,
    workspace.baseBranch,
    onWorkspaceUpdate,
    onOpenSettings,
    settings.workflowPrompts,
  ]);

  const handleDiscard = useCallback(async () => {
    await api.discardWorkspace(workspace.id);
    onWorkspaceUpdate?.();
  }, [workspace.id, onWorkspaceUpdate]);

  const filteredDirectories = useMemo(() => {
    const filter = directoryFilter.trim().toLowerCase();
    if (!filter) return additionalDirectories;
    return additionalDirectories.filter((dir) => {
      const label = getDirectoryLabel(dir).toLowerCase();
      return label.includes(filter) || dir.toLowerCase().includes(filter);
    });
  }, [additionalDirectories, directoryFilter]);

  const persistDirectories = useCallback(
    async (nextDirectories: string[]) => {
      const updated = await api.renameWorkspace(workspace.id, {
        additionalDirectories: nextDirectories,
      });
      setAdditionalDirectories(updated.additionalDirectories ?? nextDirectories);
      setDirectoryError(null);
      onWorkspaceUpdate?.();
      return updated;
    },
    [workspace.id, onWorkspaceUpdate]
  );

  const addDirectoryValue = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    const nextDirectories = [...new Set([...additionalDirectories, trimmed])];
    try {
      await persistDirectories(nextDirectories);
      setNewDirectory('');
    } catch (err) {
      setDirectoryError(err instanceof Error ? err.message : 'Failed to add directory');
    }
  }, [additionalDirectories, persistDirectories]);

  const handleAddDirectory = useCallback(async () => {
    await addDirectoryValue(newDirectory);
  }, [addDirectoryValue, newDirectory]);

  const handleOpenWorkspacePaths = useCallback((path?: string) => {
    setActiveTab('paths');
    setDirectoryError(null);

    const trimmed = path?.trim();
    if (!trimmed) return;

    setNewDirectory(trimmed);
    void addDirectoryValue(trimmed);
  }, [addDirectoryValue]);

  const handleRemoveDirectory = useCallback(async (directory: string) => {
    try {
      await persistDirectories(additionalDirectories.filter((item) => item !== directory));
    } catch (err) {
      setDirectoryError(err instanceof Error ? err.message : 'Failed to update directories');
    }
  }, [additionalDirectories, persistDirectories]);

  return (
    <div className="flex flex-1 flex-col min-w-0 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-sm font-semibold text-foreground truncate">{workspace.name}</h2>
          <span className="text-xs font-mono text-muted-foreground shrink-0">{workspace.branch}</span>
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label={`Copy branch name for ${workspace.name}`}
            onClick={() => {
              void copyTextToClipboard(workspace.branch);
            }}
          >
            Copy
          </button>
          <WorkspaceStatusBadge status={workspace.status} />
          {workspace.githubIssueNumber && workspace.githubIssueTitle && (
            workspace.githubIssueUrl ? (
              <a
                href={workspace.githubIssueUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-accent text-foreground hover:bg-accent/80 transition-colors shrink-0"
                title={workspace.githubIssueTitle}
              >
                <span className="text-muted-foreground">#</span>
                <span>{workspace.githubIssueNumber}</span>
                <span className="max-w-24 truncate hidden sm:inline">{workspace.githubIssueTitle}</span>
              </a>
            ) : (
              <span
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-accent text-foreground shrink-0"
                title={workspace.githubIssueTitle}
              >
                <span className="text-muted-foreground">#</span>
                <span>{workspace.githubIssueNumber}</span>
                <span className="max-w-24 truncate hidden sm:inline">{workspace.githubIssueTitle}</span>
              </span>
            )
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="open-in-ide-button"
            title={`Open in ${IDE_CONFIGS[settings.preferredIde].label}`}
            aria-label={`Open workspace in ${IDE_CONFIGS[settings.preferredIde].label}`}
            onClick={() =>
              openInIde(
                settings.preferredIde,
                workspace.worktreePath,
                settings.customIdeUrl || undefined
              )
            }
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Open In
          </button>
          {canMerge && (
            <Button variant="outline" size="sm" onClick={() => setMergeDialog('merge')}>
              Merge
            </Button>
          )}
          {canDiscard && (
            <Button variant="destructive" size="sm" onClick={() => setMergeDialog('discard')}>
              Discard
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'chat'
              ? 'border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setActiveTab('diff')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'diff'
              ? 'border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Diff
        </button>
        <button
          onClick={() => setActiveTab('paths')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'paths'
              ? 'border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Paths
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'notes'
              ? 'border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Notes
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === 'chat' ? (
          sessionLoaded ? (
            <ChatPage
              key={workspace.id}
              sessionId={sessionId}
              onStatusChange={onStatusChange}
              workspaceId={workspace.id}
              additionalDirectories={additionalDirectories}
              onOpenWorkspacePaths={handleOpenWorkspacePaths}
              onTaskComplete={onTaskComplete ? (params) => onTaskComplete({
                ...params,
                branch: workspace.branch,
                workspaceName: workspace.name,
              }) : undefined}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )
        ) : activeTab === 'diff' ? (
          <WorkspaceDiffView workspaceId={workspace.id} />
        ) : activeTab === 'notes' ? (
          <div className="flex flex-1 min-h-0 flex-col p-4 gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Workspace notes</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Notes are shared with Claude as context when chatting in this workspace.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {notesSavedMessage && (
                  <span className="text-xs text-muted-foreground">Saved</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setNotesPreviewMode((prev) => !prev)}
                >
                  {notesPreviewMode ? 'Edit' : 'Preview'}
                </Button>
              </div>
            </div>
            {!notesLoaded ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : notesPreviewMode ? (
              <div className="flex-1 min-h-0 overflow-y-auto rounded-md border border-border bg-muted/20 p-3">
                {notes.trim() ? (
                  <MarkdownRenderer content={notes} />
                ) : (
                  <p className="text-sm text-muted-foreground italic">No notes yet. Switch to Edit mode to add some.</p>
                )}
              </div>
            ) : (
              <textarea
                className="flex-1 min-h-0 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Add notes, plans, or context for this workspace..."
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                onBlur={handleNotesBlur}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 flex-col overflow-y-auto p-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Workspace settings</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Manage which additional repositories and directories Claude can use alongside this workspace.
                </p>
              </div>

              <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Additional writable directories
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Repo names are derived from the attached directory path so you can search and review multi-repo attachments quickly.
                </p>
              </div>

              <div className="flex gap-2">
                <Input
                  value={newDirectory}
                  onChange={(e) => setNewDirectory(e.target.value)}
                  placeholder="/path/to/another-repo"
                  aria-label="Additional writable directory"
                />
                <Button type="button" onClick={() => void handleAddDirectory()} disabled={!newDirectory.trim()}>
                  Add directory
                </Button>
              </div>

              <Input
                value={directoryFilter}
                onChange={(e) => setDirectoryFilter(e.target.value)}
                placeholder="Filter repos or paths"
                aria-label="Filter directories"
              />

              <div className="space-y-2">
                {filteredDirectories.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                    No additional directories configured.
                  </p>
                ) : (
                  filteredDirectories.map((directory) => (
                    <div
                      key={directory}
                      className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">
                          {getDirectoryLabel(directory)}
                        </div>
                        <div className="text-[11px] font-medium text-muted-foreground">
                          Repo: {getDirectoryLabel(directory)}
                        </div>
                        <div className="break-all text-xs text-muted-foreground">
                          {directory}
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => void handleRemoveDirectory(directory)}>
                        Remove
                      </Button>
                    </div>
                  ))
                )}
              </div>

              {directoryError && (
                <p className="text-sm text-destructive">{directoryError}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Merge/Discard dialog */}
      {mergeDialog && (
        <WorkspaceMergeDialog
          isOpen={true}
          mode={mergeDialog}
          workspaceName={workspace.name}
          branch={workspace.branch}
          baseBranch={workspace.baseBranch}
          onClose={() => setMergeDialog(null)}
          onConfirm={mergeDialog === 'merge' ? handleMerge : handleDiscard}
        />
      )}
    </div>
  );
}
