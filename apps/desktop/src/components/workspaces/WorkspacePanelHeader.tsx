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
}

export function WorkspacePanelHeader({
  workspace,
  branchCopied,
  onBranchCopy,
  canMerge,
  canDiscard,
  onMerge,
  onDiscard,
}: WorkspacePanelHeaderProps) {
  const { settings } = useSettings();

  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2">
      <div className="flex items-center gap-3 min-w-0">
        <h2 className="text-sm font-semibold text-foreground truncate">{workspace.name}</h2>
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
          <Button variant="outline" size="sm" onClick={onMerge}>
            Merge
          </Button>
        )}
        {canDiscard && (
          <Button variant="destructive" size="sm" onClick={onDiscard}>
            Discard
          </Button>
        )}
      </div>
    </div>
  );
}
