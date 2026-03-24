import { useState, useRef, useEffect, useCallback } from 'react';
import type { Workspace } from '@claude-tauri/shared';
import { Button } from '@/components/ui/button';
import { WorkspaceStatusBadge } from './WorkspaceStatusBadge';
import { copyTextToClipboard } from '@/lib/clipboard';
import { useSettings } from '@/hooks/useSettings';
import { openInIde, IDE_CONFIGS } from '@/lib/ide-opener';

interface WorkspacePanelHeaderProps {
  workspace: Workspace;
  branchCopied: boolean;
  onBranchCopy: () => void;
  canMerge: boolean;
  canDiscard: boolean;
  onMerge: () => void;
  onDiscard: () => void;
  onRename?: (id: string, updates: { name?: string }) => Promise<void> | void;
}

export function WorkspacePanelHeader({
  workspace,
  branchCopied,
  onBranchCopy,
  canMerge,
  canDiscard,
  onMerge,
  onDiscard,
  onRename,
}: WorkspacePanelHeaderProps) {
  const { settings } = useSettings();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(workspace.name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Sync editValue when workspace name changes externally
  useEffect(() => {
    if (!editing) setEditValue(workspace.name);
  }, [workspace.name, editing]);

  const handleSave = useCallback(async () => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === workspace.name) {
      setEditValue(workspace.name);
      setEditing(false);
      return;
    }
    if (onRename) {
      setSaving(true);
      try {
        await onRename(workspace.id, { name: trimmed });
      } finally {
        setSaving(false);
      }
    }
    setEditing(false);
  }, [editValue, workspace.name, workspace.id, onRename]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(workspace.name);
      setEditing(false);
    }
  }, [handleSave, workspace.name]);

  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2">
      <div className="flex items-center gap-3 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            className="text-sm font-semibold text-foreground bg-transparent border border-border rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-ring min-w-0"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => void handleSave()}
            onKeyDown={handleKeyDown}
            disabled={saving}
            aria-label="Rename workspace"
          />
        ) : (
          <div className="group flex items-center gap-1 min-w-0">
            <h2
              className={`text-sm font-semibold text-foreground truncate ${onRename ? 'cursor-pointer hover:underline' : ''}`}
              onClick={onRename ? () => setEditing(true) : undefined}
              title={onRename ? 'Click to rename' : undefined}
            >
              {workspace.name}
            </h2>
            {onRename && (
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-0.5"
                onClick={() => setEditing(true)}
                aria-label="Rename workspace"
                title="Rename workspace"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
          </div>
        )}
        <span className="text-xs font-mono text-muted-foreground shrink-0">{workspace.branch}</span>
        <button
          type="button"
          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label={`Copy branch name for ${workspace.name}`}
          title="Copy git branch name to clipboard"
          onClick={() => {
            void copyTextToClipboard(workspace.branch);
            onBranchCopy();
          }}
        >
          {branchCopied ? 'Copied!' : 'Copy branch'}
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
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onMerge(); }}>
            Merge
          </Button>
        )}
        {canDiscard && (
          <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); onDiscard(); }}>
            Discard
          </Button>
        )}
      </div>
    </div>
  );
}
