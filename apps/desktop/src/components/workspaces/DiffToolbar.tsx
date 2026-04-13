import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { DiffMode } from './diff-parser';
import type * as api from '@/lib/workspace-api';

interface DiffToolbarProps {
  viewMode: DiffMode;
  setViewMode: (mode: DiffMode) => void;
  hasRangeDiff: boolean;
  changedFilesCount: number;
  draftFromRef: string;
  setDraftFromRef: (ref: string) => void;
  draftToRef: string;
  setDraftToRef: (ref: string) => void;
  revisions: api.WorkspaceRevision[];
  rangeError: string | null;
  filterMode: 'all' | 'unreviewed' | 'reviewed';
  setFilterMode: (mode: 'all' | 'unreviewed' | 'reviewed') => void;
  isAllReviewed: boolean;
  reviewLoading: boolean;
  onRefresh: () => void;
  onApplyRange: () => void;
  onToggleAllReviewed: () => void;
  onReviewClick: () => void;
  onReviewContextMenu: (e: React.MouseEvent) => void;
  rawDiff: string;
}

export function DiffToolbar({
  viewMode,
  setViewMode,
  hasRangeDiff,
  changedFilesCount,
  draftFromRef,
  setDraftFromRef,
  draftToRef,
  setDraftToRef,
  revisions,
  rangeError,
  filterMode,
  setFilterMode,
  isAllReviewed,
  reviewLoading,
  onRefresh,
  onApplyRange,
  onToggleAllReviewed,
  onReviewClick,
  onReviewContextMenu,
  rawDiff,
}: DiffToolbarProps) {
  const [copied, setCopied] = useState(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current !== null) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawDiff);
      setCopied(true);
      if (resetTimeoutRef.current !== null) {
        clearTimeout(resetTimeoutRef.current);
      }
      resetTimeoutRef.current = setTimeout(() => {
        setCopied(false);
        resetTimeoutRef.current = null;
      }, 2000);
    } catch {
      // clipboard write failed silently
    }
  };

  const handleDownload = () => {
    const blob = new Blob([rawDiff], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workspace.patch';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-2 border-b border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {hasRangeDiff ? 'Historical diff review' : 'Current workspace diff'}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'unified' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('unified')}
          >
            Unified
          </Button>
          <Button
            variant={viewMode === 'side-by-side' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('side-by-side')}
          >
            Side-by-side
          </Button>
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownload}>
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={reviewLoading}
            onClick={onReviewClick}
            onContextMenu={onReviewContextMenu}
            title="Left-click: start AI review. Right-click: customize prompt."
          >
            {reviewLoading ? 'Reviewing...' : 'Review'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground">Compare:</label>
        <select
          value={draftFromRef}
          onChange={(event) => setDraftFromRef(event.target.value)}
          className="rounded border border-border bg-background px-2 py-1 text-xs"
        >
          <option value="">Workspace base</option>
          {revisions.map((revision) => (
            <option key={`${revision.id}-from`} value={revision.id}>
              {revision.shortId} — {revision.message}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">to</span>
        <select
          value={draftToRef}
          onChange={(event) => setDraftToRef(event.target.value)}
          className="rounded border border-border bg-background px-2 py-1 text-xs"
        >
          <option value="">Current</option>
          {revisions.map((revision) => (
            <option key={`${revision.id}-to`} value={revision.id}>
              {revision.shortId} — {revision.message}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={onApplyRange}>
          Apply
        </Button>
        <span className="text-xs text-muted-foreground">
          {changedFilesCount} changed file{changedFilesCount !== 1 ? 's' : ''}
        </span>
        {rangeError && <span className="text-xs text-destructive">{rangeError}</span>}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Filter:</span>
        <select
          value={filterMode}
          onChange={(event) =>
            setFilterMode(event.target.value as 'all' | 'unreviewed' | 'reviewed')
          }
          className="rounded border border-border bg-background px-2 py-1 text-xs"
        >
          <option value="all">All files</option>
          <option value="unreviewed">Unreviewed</option>
          <option value="reviewed">Reviewed</option>
        </select>
        <Button size="sm" variant="outline" onClick={onToggleAllReviewed}>
          {isAllReviewed ? 'Mark all unreviewed' : 'Mark all reviewed'}
        </Button>
      </div>
    </div>
  );
}
