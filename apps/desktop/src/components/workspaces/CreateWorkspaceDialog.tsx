import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { GithubIssue, GithubBranch } from '@/lib/workspace-api';
import { fetchGithubIssues, fetchProjectBranches } from '@/lib/workspace-api';

type Mode = 'manual' | 'branch' | 'github-issue';

interface CreateWorkspaceDialogProps {
  isOpen: boolean;
  projectId?: string;
  projectName: string;
  defaultBranch: string;
  onClose: () => void;
  onSubmit: (
    name: string,
    baseBranch?: string,
    sourceBranch?: string,
    githubIssue?: GithubIssue
  ) => Promise<void>;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export function CreateWorkspaceDialog({
  isOpen,
  projectId,
  projectName,
  defaultBranch,
  onClose,
  onSubmit,
}: CreateWorkspaceDialogProps) {
  const [mode, setMode] = useState<Mode>('manual');

  // Manual mode state
  const [name, setName] = useState('');
  const [baseBranch, setBaseBranch] = useState('');
  const [sourceBranch, setSourceBranch] = useState('');
  const [nameError, setNameError] = useState('');

  // Branch mode state
  const [branches, setBranches] = useState<GithubBranch[]>([]);
  const [branchLoading, setBranchLoading] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [branchWorkspaceName, setBranchWorkspaceName] = useState('');

  // GitHub Issue mode state
  const [issueQuery, setIssueQuery] = useState('');
  const [issues, setIssues] = useState<GithubIssue[]>([]);
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<GithubIssue | null>(null);
  const [issueWorkspaceName, setIssueWorkspaceName] = useState('');
  const [issueBranch, setIssueBranch] = useState('');

  // Shared
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetAll = useCallback(() => {
    setMode('manual');
    setName('');
    setBaseBranch('');
    setSourceBranch('');
    setNameError('');
    setBranches([]);
    setBranchLoading(false);
    setBranchError(null);
    setSelectedBranch('');
    setBranchWorkspaceName('');
    setIssueQuery('');
    setIssues([]);
    setIssueLoading(false);
    setIssueError(null);
    setSelectedIssue(null);
    setIssueWorkspaceName('');
    setIssueBranch('');
    setError(null);
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (isOpen) resetAll();
  }, [isOpen, resetAll]);

  // Load branches when branch mode is selected
  useEffect(() => {
    if (!isOpen || mode !== 'branch' || !projectId) return;
    let cancelled = false;
    setBranchLoading(true);
    setBranchError(null);
    fetchProjectBranches(projectId)
      .then((list) => {
        if (cancelled) return;
        setBranches(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setBranchError(err instanceof Error ? err.message : 'Failed to load branches');
      })
      .finally(() => {
        if (!cancelled) setBranchLoading(false);
      });
    return () => { cancelled = true; };
  }, [isOpen, mode, projectId]);

  // Debounced issue search
  useEffect(() => {
    if (!isOpen || mode !== 'github-issue' || !projectId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      let cancelled = false;
      setIssueLoading(true);
      setIssueError(null);
      fetchGithubIssues(projectId, issueQuery)
        .then((list) => {
          if (cancelled) return;
          setIssues(list);
        })
        .catch((err) => {
          if (cancelled) return;
          setIssueError(err instanceof Error ? err.message : 'Failed to load issues');
        })
        .finally(() => {
          if (!cancelled) setIssueLoading(false);
        });
      return () => { cancelled = true; };
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [isOpen, mode, issueQuery, projectId]);

  // Auto-fill workspace name when issue is selected
  useEffect(() => {
    if (!selectedIssue) return;
    setIssueWorkspaceName(`issue-${selectedIssue.number}-${slugify(selectedIssue.title)}`);
    setIssueBranch(`issue-${selectedIssue.number}-${slugify(selectedIssue.title)}`);
  }, [selectedIssue]);

  // Auto-fill workspace name from branch
  useEffect(() => {
    if (!selectedBranch) return;
    setBranchWorkspaceName(selectedBranch.replace(/\//g, '-').replace(/[^a-z0-9-_]/gi, '-').slice(0, 60));
  }, [selectedBranch]);

  const handleClose = useCallback(() => {
    resetAll();
    onClose();
  }, [resetAll, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'manual') {
      if (!name.trim()) {
        setNameError('Workspace name is required');
        return;
      }
      setNameError('');
      try {
        setSubmitting(true);
        await onSubmit(name.trim(), baseBranch.trim() || undefined, sourceBranch.trim() || undefined);
        handleClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create workspace');
      } finally {
        setSubmitting(false);
      }
    } else if (mode === 'branch') {
      if (!selectedBranch) {
        setError('Please select a branch');
        return;
      }
      if (!branchWorkspaceName.trim()) {
        setError('Workspace name is required');
        return;
      }
      try {
        setSubmitting(true);
        // Use selectedBranch as sourceBranch so workspace starts from it
        await onSubmit(branchWorkspaceName.trim(), undefined, selectedBranch);
        handleClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create workspace');
      } finally {
        setSubmitting(false);
      }
    } else if (mode === 'github-issue') {
      if (!selectedIssue) {
        setError('Please select a GitHub issue');
        return;
      }
      if (!issueWorkspaceName.trim()) {
        setError('Workspace name is required');
        return;
      }
      try {
        setSubmitting(true);
        await onSubmit(
          issueWorkspaceName.trim(),
          undefined,
          undefined,
          selectedIssue
        );
        handleClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create workspace');
      } finally {
        setSubmitting(false);
      }
    }
  }, [mode, name, baseBranch, sourceBranch, selectedBranch, branchWorkspaceName, selectedIssue, issueWorkspaceName, onSubmit, handleClose]);

  if (!isOpen) return null;

  const tabs: { id: Mode; label: string }[] = [
    { id: 'manual', label: 'Manual' },
    { id: 'branch', label: 'Branch' },
    { id: 'github-issue', label: 'GitHub Issue' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-popover shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-3">
          <h2 className="text-lg font-semibold text-foreground">Create Workspace</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            New workspace in <span className="font-medium text-foreground">{projectName}</span>
          </p>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-border px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setMode(tab.id); setError(null); }}
              className={`mr-4 pb-2 text-sm font-medium border-b-2 transition-colors ${
                mode === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mode === 'manual' && (
            <>
              <div>
                <label className="text-sm font-medium text-foreground">Name</label>
                <Input
                  type="text"
                  placeholder="my-feature"
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (nameError) setNameError(''); }}
                  className="mt-1"
                  autoFocus
                />
                {nameError && <p className="text-sm text-destructive mt-1">{nameError}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Base Branch</label>
                <Input
                  type="text"
                  placeholder={defaultBranch}
                  value={baseBranch}
                  onChange={(e) => setBaseBranch(e.target.value)}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-muted-foreground">Defaults to {defaultBranch}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Source Branch (optional)</label>
                <Input
                  type="text"
                  placeholder="feature/auth"
                  value={sourceBranch}
                  onChange={(e) => setSourceBranch(e.target.value)}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-muted-foreground">Optional custom branch to base this workspace on.</p>
              </div>
            </>
          )}

          {mode === 'branch' && (
            <>
              <div>
                <label className="text-sm font-medium text-foreground">Select Branch</label>
                {branchLoading ? (
                  <p className="mt-2 text-sm text-muted-foreground">Loading branches...</p>
                ) : branchError ? (
                  <p className="mt-2 text-sm text-destructive">{branchError}</p>
                ) : (
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                  >
                    <option value="" disabled>Select a branch...</option>
                    {branches.map((b) => (
                      <option key={b.name} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Workspace Name</label>
                <Input
                  type="text"
                  placeholder="my-workspace"
                  value={branchWorkspaceName}
                  onChange={(e) => setBranchWorkspaceName(e.target.value)}
                  className="mt-1"
                />
              </div>
            </>
          )}

          {mode === 'github-issue' && (
            <>
              <div>
                <label className="text-sm font-medium text-foreground">Search Issues</label>
                <Input
                  type="text"
                  placeholder="Search by title or number..."
                  value={issueQuery}
                  onChange={(e) => setIssueQuery(e.target.value)}
                  className="mt-1"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-auto rounded-md border border-border">
                {issueLoading ? (
                  <p className="p-3 text-sm text-muted-foreground">Loading issues...</p>
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
                        onClick={() => setSelectedIssue(issue)}
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
                      value={issueWorkspaceName}
                      onChange={(e) => setIssueWorkspaceName(e.target.value)}
                      className="mt-1"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Auto-filled from issue title. You can edit this.</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Branch Name</label>
                    <Input
                      type="text"
                      value={issueBranch}
                      onChange={(e) => setIssueBranch(e.target.value)}
                      className="mt-1"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Branch will be created as <code className="text-xs bg-muted px-1 rounded">issue/{issueBranch}</code></p>
                  </div>
                </>
              )}
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
