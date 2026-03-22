import { SpinnerGap } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import type { GithubIssue } from '@/lib/workspace-api';

interface GithubIssueModeFormProps {
  issueQuery: string;
  onIssueQueryChange: (value: string) => void;
  issues: GithubIssue[];
  issueLoading: boolean;
  issueError: string | null;
  selectedIssue: GithubIssue | null;
  onSelectIssue: (issue: GithubIssue) => void;
  workspaceName: string;
  onWorkspaceNameChange: (value: string) => void;
  issueBranch: string;
  onIssueBranchChange: (value: string) => void;
}

export function GithubIssueModeForm({
  issueQuery,
  onIssueQueryChange,
  issues,
  issueLoading,
  issueError,
  selectedIssue,
  onSelectIssue,
  workspaceName,
  onWorkspaceNameChange,
  issueBranch,
  onIssueBranchChange,
}: GithubIssueModeFormProps) {
  return (
    <>
      <div>
        <label className="text-sm font-medium text-foreground">Search Issues</label>
        <Input
          type="text"
          placeholder="Search by title or number..."
          value={issueQuery}
          onChange={(e) => onIssueQueryChange(e.target.value)}
          className="mt-1"
          autoFocus
        />
      </div>
      <div className="max-h-48 overflow-auto rounded-md border border-border">
        {issueLoading ? (
          <div className="p-3 flex items-center gap-2 text-sm text-muted-foreground">
            <SpinnerGap className="h-4 w-4 animate-spin" />
            Loading issues...
          </div>
        ) : issueError ? (
          <p className="p-3 text-sm text-destructive">{issueError}</p>
        ) : issues.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No issues found. Try a different search.</p>
        ) : (
          issues.map((issue) => {
            const isActive = selectedIssue?.number === issue.number;
            return (
              <button
                key={issue.number}
                type="button"
                className={`w-full px-3 py-2 text-left border-b border-border last:border-b-0 transition-colors ${
                  isActive ? 'bg-primary/10' : 'hover:bg-accent'
                }`}
                onClick={() => onSelectIssue(issue)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">#{issue.number}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    issue.state === 'OPEN' ? 'bg-green-500/20 text-green-600' : 'bg-gray-500/20 text-gray-500'
                  }`}>{issue.state}</span>
                </div>
                <div className="mt-0.5 text-sm font-medium truncate">{issue.title}</div>
              </button>
            );
          })
        )}
      </div>
      {selectedIssue && (
        <>
          <div>
            <label className="text-sm font-medium text-foreground">Workspace Name</label>
            <Input
              type="text"
              value={workspaceName}
              onChange={(e) => onWorkspaceNameChange(e.target.value)}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">Auto-filled from issue title. You can edit this.</p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Branch Name</label>
            <Input
              type="text"
              value={issueBranch}
              onChange={(e) => onIssueBranchChange(e.target.value)}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">Branch will be created as <code className="text-xs bg-muted px-1 rounded">issue/{issueBranch}</code></p>
          </div>
        </>
      )}
    </>
  );
}
