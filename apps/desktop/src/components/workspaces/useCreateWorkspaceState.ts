import { useState, useCallback, useEffect, useRef } from 'react';
import type { GithubIssue, GithubBranch } from '@/lib/workspace-api';
import { fetchGithubIssues, fetchProjectBranches, fetchGitBranchesFromPath } from '@/lib/workspace-api';
import { useSearchHistory } from '@/hooks/useSearchHistory';

type Mode = 'manual' | 'branch' | 'github-issue';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export function useCreateWorkspaceState(
  isOpen: boolean,
  projectId: string | undefined,
  repoPath: string | undefined,
  onClose: () => void,
  onSubmit: (name: string, baseBranch?: string, sourceBranch?: string, githubIssue?: GithubIssue) => Promise<void>,
) {
  const [mode, setMode] = useState<Mode>('manual');

  // Manual mode state
  const [name, setName] = useState('');
  const [baseBranch, setBaseBranch] = useState('');
  const [sourceBranch, setSourceBranch] = useState('');
  const [nameError, setNameError] = useState('');
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

  // Search history
  const githubSearchHistory = useSearchHistory('github');

  // Shared
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetAll = useCallback(() => {
    setMode('manual');
    setName(''); setBaseBranch(''); setSourceBranch(''); setNameError('');
    setFolderPath(''); setLocalBranches([]); setBranchesLoading(false);
    setBranches([]); setBranchLoading(false); setBranchError(null);
    setSelectedBranch(''); setBranchWorkspaceName('');
    setIssueQuery(''); setIssues([]); setIssueLoading(false); setIssueError(null);
    setSelectedIssue(null); setIssueWorkspaceName(''); setIssueBranch('');
    setError(null); setSubmitting(false);
  }, []);

  useEffect(() => { if (isOpen) resetAll(); }, [isOpen, resetAll]);

  // Pre-load branches from project repoPath
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
    setBranchLoading(true); setBranchError(null);
    fetchProjectBranches(projectId)
      .then((list) => { if (!cancelled) setBranches(list); })
      .catch((err) => { if (!cancelled) setBranchError(err instanceof Error ? err.message : 'Failed to load branches'); })
      .finally(() => { if (!cancelled) setBranchLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, mode, projectId]);

  // Debounced issue search
  useEffect(() => {
    if (!isOpen || mode !== 'github-issue' || !projectId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      let cancelled = false;
      setIssueLoading(true); setIssueError(null);
      fetchGithubIssues(projectId, issueQuery)
        .then((list) => {
          if (!cancelled) {
            setIssues(list);
            if (issueQuery.trim()) githubSearchHistory.addSearch(issueQuery.trim());
          }
        })
        .catch((err) => { if (!cancelled) setIssueError(err instanceof Error ? err.message : 'Failed to load issues'); })
        .finally(() => { if (!cancelled) setIssueLoading(false); });
      return () => { cancelled = true; };
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
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

  const handleClose = useCallback(() => { resetAll(); onClose(); }, [resetAll, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'manual') {
      if (!name.trim()) { setNameError('Workspace name is required'); return; }
      setNameError('');
      try { setSubmitting(true); await onSubmit(name.trim(), baseBranch.trim() || undefined, sourceBranch.trim() || undefined); handleClose(); }
      catch (err) { setError(err instanceof Error ? err.message : 'Failed to create workspace'); }
      finally { setSubmitting(false); }
    } else if (mode === 'branch') {
      if (!selectedBranch) { setError('Please select a branch'); return; }
      if (!branchWorkspaceName.trim()) { setError('Workspace name is required'); return; }
      try { setSubmitting(true); await onSubmit(branchWorkspaceName.trim(), undefined, selectedBranch); handleClose(); }
      catch (err) { setError(err instanceof Error ? err.message : 'Failed to create workspace'); }
      finally { setSubmitting(false); }
    } else if (mode === 'github-issue') {
      if (!selectedIssue) { setError('Please select a GitHub issue'); return; }
      if (!issueWorkspaceName.trim()) { setError('Workspace name is required'); return; }
      try { setSubmitting(true); await onSubmit(issueWorkspaceName.trim(), undefined, undefined, selectedIssue); handleClose(); }
      catch (err) { setError(err instanceof Error ? err.message : 'Failed to create workspace'); }
      finally { setSubmitting(false); }
    }
  }, [mode, name, baseBranch, sourceBranch, selectedBranch, branchWorkspaceName, selectedIssue, issueWorkspaceName, onSubmit, handleClose]);

  return {
    mode, setMode,
    // Manual
    name, setName, baseBranch, setBaseBranch, sourceBranch, setSourceBranch,
    nameError, setNameError, folderPath, setFolderPath,
    localBranches, branchesLoading, handleBrowseFolder,
    // Branch
    branches, branchLoading, branchError,
    selectedBranch, setSelectedBranch,
    branchWorkspaceName, setBranchWorkspaceName,
    // GitHub Issue
    issueQuery, setIssueQuery, issues, issueLoading, issueError,
    selectedIssue, setSelectedIssue,
    issueWorkspaceName, setIssueWorkspaceName,
    issueBranch, setIssueBranch,
    // Search history
    githubSearchHistory: githubSearchHistory.history,
    removeGithubSearch: githubSearchHistory.removeSearch,
    clearGithubSearchHistory: githubSearchHistory.clearAll,
    // Shared
    error, setError, submitting,
    handleClose, handleSubmit,
  };
}
