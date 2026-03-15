import { useEffect, useState } from 'react';
import type { GitStatus } from '@claude-tauri/shared';

const API_BASE = 'http://localhost:3131';
const POLL_INTERVAL_MS = 10_000; // Poll every 10 seconds

export function GitStatusBar() {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await fetch(`${API_BASE}/api/git/status`);
        if (!res.ok) throw new Error('Failed to fetch git status');
        const data: GitStatus = await res.json();
        if (!cancelled) {
          setStatus(data);
          setError(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setStatus(null);
        }
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Error or not a git repo
  if (error || status?.error) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1">
        <GitBranchIcon />
        <span>No git</span>
      </div>
    );
  }

  // Loading state
  if (!status) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1">
        <GitBranchIcon />
        <span className="animate-pulse">...</span>
      </div>
    );
  }

  const totalChanges = status.modifiedFiles.length + status.stagedFiles.length;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1">
      <GitBranchIcon />
      <span
        data-testid="git-status-indicator"
        className={`inline-block h-2 w-2 rounded-full ${
          status.isClean ? 'bg-green-500' : 'bg-yellow-500'
        }`}
      />
      <span className="font-medium">{status.branch}</span>
      {totalChanges > 0 && (
        <span
          data-testid="git-file-count"
          className="inline-flex items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-semibold leading-4 min-w-[18px]"
        >
          {totalChanges}
        </span>
      )}
    </div>
  );
}

function GitBranchIcon() {
  return (
    <svg
      data-testid="git-branch-icon"
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}
