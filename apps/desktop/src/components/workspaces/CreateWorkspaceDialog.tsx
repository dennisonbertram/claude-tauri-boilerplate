import { Wrench, GitBranch, GithubLogo } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import type { GithubIssue } from '@/lib/workspace-api';
import { ManualModeForm } from './ManualModeForm';
import { BranchModeForm } from './BranchModeForm';
import { GithubIssueModeForm } from './GithubIssueModeForm';
import { useCreateWorkspaceState } from './useCreateWorkspaceState';

type Mode = 'manual' | 'branch' | 'github-issue';

interface CreateWorkspaceDialogProps {
  isOpen: boolean;
  projectId?: string;
  projectName: string;
  defaultBranch: string;
  repoPath?: string;
  onClose: () => void;
  onSubmit: (
    name: string,
    baseBranch?: string,
    sourceBranch?: string,
    githubIssue?: GithubIssue
  ) => Promise<void>;
}

export function CreateWorkspaceDialog({
  isOpen,
  projectId,
  projectName,
  defaultBranch,
  repoPath,
  onClose,
  onSubmit,
}: CreateWorkspaceDialogProps) {
  const state = useCreateWorkspaceState(isOpen, projectId, repoPath, onClose, onSubmit);

  if (!isOpen) return null;

  const tabs: { id: Mode; label: string; icon: React.ReactNode }[] = [
    { id: 'manual', label: 'Manual', icon: <Wrench className="h-3.5 w-3.5" /> },
    { id: 'branch', label: 'Branch', icon: <GitBranch className="h-3.5 w-3.5" /> },
    { id: 'github-issue', label: 'GitHub Issue', icon: <GithubLogo className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={state.handleClose}>
      <div className="w-full max-w-lg rounded-lg border border-border bg-popover shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-3">
          <h2 className="text-lg font-semibold text-foreground">Create Workspace</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            New workspace in <span className="font-medium text-foreground">{projectName}</span>
          </p>
        </div>

        <div className="flex border-b border-border px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { state.setMode(tab.id); state.setError(null); }}
              className={`mr-4 pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                state.mode === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={state.handleSubmit} className="p-6 space-y-4">
          {state.mode === 'manual' && (
            <ManualModeForm
              name={state.name}
              onNameChange={(v) => { state.setName(v); if (state.nameError) state.setNameError(''); }}
              nameError={state.nameError}
              baseBranch={state.baseBranch}
              onBaseBranchChange={state.setBaseBranch}
              sourceBranch={state.sourceBranch}
              onSourceBranchChange={state.setSourceBranch}
              defaultBranch={defaultBranch}
              folderPath={state.folderPath}
              onFolderPathChange={state.setFolderPath}
              localBranches={state.localBranches}
              branchesLoading={state.branchesLoading}
              onBrowseFolder={state.handleBrowseFolder}
            />
          )}
          {state.mode === 'branch' && (
            <BranchModeForm
              branches={state.branches}
              branchLoading={state.branchLoading}
              branchError={state.branchError}
              selectedBranch={state.selectedBranch}
              onSelectedBranchChange={state.setSelectedBranch}
              workspaceName={state.branchWorkspaceName}
              onWorkspaceNameChange={state.setBranchWorkspaceName}
            />
          )}
          {state.mode === 'github-issue' && (
            <GithubIssueModeForm
              issueQuery={state.issueQuery}
              onIssueQueryChange={state.setIssueQuery}
              issues={state.issues}
              issueLoading={state.issueLoading}
              issueError={state.issueError}
              selectedIssue={state.selectedIssue}
              onSelectIssue={state.setSelectedIssue}
              workspaceName={state.issueWorkspaceName}
              onWorkspaceNameChange={state.setIssueWorkspaceName}
              issueBranch={state.issueBranch}
              onIssueBranchChange={state.setIssueBranch}
            />
          )}

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={state.handleClose} disabled={state.submitting}>Cancel</Button>
            <Button type="submit" disabled={state.submitting}>{state.submitting ? 'Creating...' : 'Create'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
