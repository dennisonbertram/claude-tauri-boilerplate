import { useState, useEffect } from 'react';
import { API_BASE } from './constants';

export function GitBranchSegment() {
  const [branch, setBranch] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchGitStatus() {
      try {
        const res = await fetch(`${API_BASE}/api/git/status`);
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        if (!cancelled && data.branch) {
          setBranch(data.branch);
        }
      } catch {
        if (!cancelled) {
          setBranch(null);
        }
      }
    }

    fetchGitStatus();
    const interval = setInterval(fetchGitStatus, 10_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!branch) return null;

  return (
    <div data-testid="git-branch-segment" className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors">
      <svg
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
      <span className="truncate max-w-[100px]">{branch}</span>
    </div>
  );
}
