import { useState, useCallback, useEffect, useRef } from 'react';
import { Wrench, GitBranch, GithubLogo, SpinnerGap, FolderOpen } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isTauri } from '@/lib/platform';
import type { GithubIssue, GithubBranch } from '@/lib/workspace-api';
import { fetchGithubIssues, fetchProjectBranches, fetchGitBranchesFromPath } from '@/lib/workspace-api';

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
  repoPath,
  onClose,
  onSubmit,
}: CreateWorkspaceDialogProps) {
  const [mode, setMode] = useState<Mode>('manual');

  // Manual mode state
  const [name, setName] = useState('');
  const [baseBranch, setBaseBranch] = useState('');
  const [sourceBranch, setSourceBranch] = useState('');
  const [nameError, setNameError] = useState('');

  // Manual mode folder/branch state
  const [folderPath, setFolderPath] = useState('');
  const [localBranches, setLocalBranches] = useState<{ name: string }[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

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
    setFolderPath('');
    setLocalBranches([]);
    setBranchesLoading(false);
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

  // Pre-load branches from project repoPath when dialog opens
  useEffect(() => {
    if (!isOpen || !repoPath) return;
    let cancelled = false;
    setBranchesLoading(true);
    fetchGitBranchesFromPath(repoPath)
      .then((list) => { if (!cancelled) setLocalBranches(list); })
      .catch(() => { if (!cancelled) setLocalBranches([]); })
      .finally(() => { if (!cancelled) setBranchesLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, repoPath]);

  // Load branches when folderPath changes
  useEffect(() => {
    if (!folderPath) return;
    let cancelled = false;
    setBranchesLoading(true);
    fetchGitBranchesFromPath(folderPath)
      .then((list) => { if (!cancelled) setLocalBranches(list); })
      .catch(() => { if (!cancelled) setLocalBranches([]); })
      .finally(() => { if (!cancelled) setBranchesLoading(false); });
    return () => { cancelled = true; };
  }, [folderPath]);

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

  const handleBrowseFolder = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false, title: 'Select a Git Repository' });
      if (selected) setFolderPath(selected as string);
    } catch (err) {
      console.warn('[CreateWorkspaceDialog] Browse failed:', err);
    }
  };

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

  const tabs: { id: Mode; label: string; icon: React.ReactNode }[] = [
    { id: 'manual', label: 'Manual', icon: <Wrench className="h-3.5 w-3.5" /> },
    { id: 'branch', label: 'Branch', icon: <GitBranch className="h-3.5 w-3.5" /> },
    { id: 'github-issue', label: 'GitHub Issue', icon: <GithubLogo className="h-3.5 w-3.5" /> },
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
              className={`mr-4 pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                mode === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mode === 'manual' && (
            <>
              <div>
                <label className="text-sm font-medium text-foreground">Repository Path</label>
                <div className="mt-1 flex gap-2">
                  <Input
                    type="text"
                    placeholder="/path/to/repo or leave blank to use project default"
                    value={folderPath}
                    onChange={(e) => setFolderPath(e.target.value)}
                    className="flex-1 text-xs"
                  />
                  {isTauri() && (
                    <Button type="button" variant="outline" size="sm" onClick={handleBrowseFolder}>
                      <FolderOpen className="h-3.5 w-3.5 mr-1" />
                      Browse
                    </Button>
                  )}
                </div>
                {branchesLoading && (
                  <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                    <SpinnerGap className="h-3 w-3 animate-spin" /> Detecting branches...
                  </p>
                )}
                {!branchesLoading && localBranches.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">{localBranches.length} branches detected</p>
                )}
              </div>
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
                {localBranches.length > 0 ? (
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                    value={baseBranch}
                    onChange={(e) => setBaseBranch(e.target.value)}
                  >
                    <option value="">{defaultBranch} (default)</option>
                    {localBranches.map((b) => (
                      <option key={b.name} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type="text"
                    placeholder={defaultBranch}
                    value={baseBranch}
                    onChange={(e) => setBaseBranch(e.target.value)}
                    className="mt-1"
                  />
                )}
                <p className="mt-1 text-xs text-muted-foreground">Defaults to {defaultBranch}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Source Branch (optional)</label>
                {localBranches.length > 0 ? (
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                    value={sourceBranch}
                    onChange={(e) => setSourceBranch(e.target.value)}
                  >
                    <option value="">{defaultBranch} (default)</option>
                    {localBranches.map((b) => (
                      <option key={b.name} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type="text"
                    placeholder="feature/auth"
                    value={sourceBranch}
                    onChange={(e) => setSourceBranch(e.target.value)}
                    className="mt-1"
                  />
                )}
                <p className="mt-1 text-xs text-muted-foreground">Optional custom branch to base this workspace on.</p>
              </div>
            </>
          )}

          {mode === 'branch' && (
            <>
              <div>
                <label className="text-sm font-medium text-foreground">Select Branch</label>
                {branchLoading ? (
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <SpinnerGap className="h-4 w-4 animate-spin" />
                    Loading branches...
                  </div>
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
