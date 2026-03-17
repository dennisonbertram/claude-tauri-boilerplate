import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownRenderer } from '../chat/MarkdownRenderer';
import { useWorkspaceDiff } from '@/hooks/useWorkspaceDiff';
import * as api from '@/lib/workspace-api';

interface WorkspaceDiffViewProps {
  workspaceId: string;
}

const statusLabels: Record<string, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  untracked: '?',
};

const statusColors: Record<string, string> = {
  modified: 'text-yellow-400',
  added: 'text-green-400',
  deleted: 'text-red-400',
  renamed: 'text-blue-400',
  untracked: 'text-muted-foreground',
};

type DiffMode = 'unified' | 'side-by-side';
type DiffLineType = 'meta' | 'hunk' | 'context' | 'added' | 'removed';

export interface ParsedDiffLine {
  type: DiffLineType;
  content: string;
  oldLine?: number | null;
  newLine?: number | null;
}

export interface ParsedDiffFile {
  path: string;
  lines: ParsedDiffLine[];
}

export interface InlineComment {
  id: string;
  markdown: string;
}

export function parseWorkspaceDiff(rawDiff: string): ParsedDiffFile[] {
  const parsedFiles: ParsedDiffFile[] = [];
  let currentFile: ParsedDiffFile | null = null;

  let oldLine = 0;
  let newLine = 0;

  const lines = rawDiff.split('\n');

  const flushFile = () => {
    if (currentFile) {
      parsedFiles.push(currentFile);
    }
  };

  for (const rawLine of lines) {
    const fileHeaderMatch = rawLine.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (fileHeaderMatch) {
      flushFile();
      currentFile = {
        path: fileHeaderMatch[2],
        lines: [],
      };
      oldLine = 0;
      newLine = 0;
      currentFile.lines.push({ type: 'meta', content: rawLine });
      continue;
    }

    if (!currentFile) {
      continue;
    }

    const hunkMatch = rawLine.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      oldLine = Number(hunkMatch[1]);
      newLine = Number(hunkMatch[3]);
      currentFile.lines.push({ type: 'hunk', content: rawLine });
      continue;
    }

    if (rawLine.startsWith('index ') || rawLine.startsWith('---') || rawLine.startsWith('+++') || rawLine.startsWith('\\ No newline at end of file')) {
      currentFile.lines.push({ type: 'meta', content: rawLine });
      continue;
    }

    if (rawLine.startsWith('+')) {
      currentFile.lines.push({
        type: 'added',
        content: rawLine.slice(1),
        oldLine: null,
        newLine: newLine++,
      });
      continue;
    }

    if (rawLine.startsWith('-')) {
      currentFile.lines.push({
        type: 'removed',
        content: rawLine.slice(1),
        oldLine: oldLine++,
        newLine: null,
      });
      continue;
    }

    if (rawLine.startsWith(' ')) {
      currentFile.lines.push({
        type: 'context',
        content: rawLine.slice(1),
        oldLine: oldLine++,
        newLine: newLine++,
      });
      continue;
    }

    currentFile.lines.push({ type: 'meta', content: rawLine });
  }

  flushFile();
  return parsedFiles;
}

function lineClassName(type: DiffLineType): string {
  if (type === 'added') return 'bg-green-950/40 text-green-300';
  if (type === 'removed') return 'bg-red-950/40 text-red-300';
  if (type === 'context') return 'text-zinc-300 bg-zinc-900/20';
  if (type === 'hunk') return 'text-cyan-400 bg-zinc-900/50';
  return 'text-zinc-500 bg-zinc-900/30';
}

function commentKey(filePath: string, lineIndex: number) {
  return `${filePath}:${lineIndex}`;
}

export function WorkspaceDiffView({ workspaceId }: WorkspaceDiffViewProps) {
  const [viewMode, setViewMode] = useState<DiffMode>('unified');
  const [reviewRange, setReviewRange] = useState<api.WorkspaceDiffRange | undefined>(undefined);
  const [draftFromRef, setDraftFromRef] = useState('');
  const [draftToRef, setDraftToRef] = useState('');
  const [revisions, setRevisions] = useState<api.WorkspaceRevision[]>([]);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'unreviewed' | 'reviewed'>('all');
  const [reviewedFiles, setReviewedFiles] = useState<Record<string, boolean>>({});
  const [activeCommentTarget, setActiveCommentTarget] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, InlineComment[]>>({});
  const [commentIdCounter, setCommentIdCounter] = useState(0);

  const { diff, changedFiles, loading, error, fetchDiff } = useWorkspaceDiff(
    workspaceId,
    reviewRange
  );
  const parsedFiles = useMemo(() => parseWorkspaceDiff(diff), [diff]);

  useEffect(() => {
    let cancelled = false;
    api.fetchWorkspaceRevisions(workspaceId)
      .then((result) => {
        if (cancelled) return;
        setRevisions(result.revisions);
        if (result.revisions.length >= 2) {
          setDraftFromRef(result.revisions[1].id);
          setDraftToRef(result.revisions[0].id);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setRangeError(err instanceof Error ? err.message : 'Failed to fetch revisions');
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    setReviewedFiles((prev) => {
      const next = { ...prev };
      for (const file of changedFiles) {
        if (next[file.path] === undefined) next[file.path] = false;
      }
      return next;
    });
  }, [changedFiles]);

  useEffect(() => {
    fetchDiff();
  }, [fetchDiff]);

  const filesToDisplay = useMemo(() => {
    const parsedByPath = new Map(parsedFiles.map((f) => [f.path, f]));
    const fileSet: Array<{ path: string; status: string; file: ParsedDiffFile | null }> = [];

    for (const file of changedFiles) {
      const parsed = parsedByPath.get(file.path) ?? null;
      fileSet.push({ path: file.path, status: file.status, file: parsed });
    }

    for (const file of parsedFiles) {
      if (!changedFiles.some((f) => f.path === file.path)) {
        fileSet.push({ path: file.path, status: 'modified', file });
      }
    }

    return fileSet.filter((file) => {
      if (filterMode === 'all') return true;
      const reviewed = reviewedFiles[file.path];
      return filterMode === 'reviewed' ? reviewed : !reviewed;
    });
  }, [parsedFiles, changedFiles, reviewedFiles, filterMode]);

  const applyRange = () => {
    if ((draftFromRef && !draftToRef) || (draftToRef && !draftFromRef)) {
      setRangeError('Select both refs to compare a historical range.');
      return;
    }
    setRangeError(null);

    if (draftFromRef && draftToRef) {
      setReviewRange({ fromRef: draftFromRef, toRef: draftToRef });
      return;
    }

    setReviewRange(undefined);
  };

  const toggleReviewed = (path: string) => {
    setReviewedFiles((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const toggleAllReviewed = () => {
    const shouldReviewAll = filesToDisplay.some((file) => !reviewedFiles[file.path]);
    const next: Record<string, boolean> = {};

    for (const file of filesToDisplay) {
      next[file.path] = shouldReviewAll;
    }
    setReviewedFiles((prev) => ({ ...prev, ...next }));
  };

  const isAllReviewed = filesToDisplay.every((file) => reviewedFiles[file.path]);
  const hasRangeDiff = Boolean(reviewRange);

  const saveComment = () => {
    if (!activeCommentTarget) return;
    const markdown = commentDrafts[activeCommentTarget]?.trim();
    if (!markdown) return;

    const id = `comment-${commentIdCounter + 1}`;
    setCommentIdCounter((current) => current + 1);
    setComments((prev) => ({
      ...prev,
      [activeCommentTarget]: [...(prev[activeCommentTarget] ?? []), { id, markdown }],
    }));
    setCommentDrafts((prev) => {
      const next = { ...prev };
      delete next[activeCommentTarget];
      return next;
    });
    setActiveCommentTarget(null);
  };

  const cancelComment = () => {
    if (!activeCommentTarget) return;
    setCommentDrafts((prev) => {
      const next = { ...prev };
      delete next[activeCommentTarget];
      return next;
    });
    setActiveCommentTarget(null);
  };

  const changeComment = (target: string, value: string) => {
    setCommentDrafts((prev) => ({ ...prev, [target]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">
        {error}
        <Button variant="ghost" size="sm" className="ml-2" onClick={fetchDiff}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top controls */}
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
            <Button variant="ghost" size="sm" onClick={fetchDiff}>
              Refresh
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
          <Button size="sm" onClick={applyRange}>
            Apply
          </Button>
          <span className="text-xs text-muted-foreground">
            {changedFiles.length} changed file{changedFiles.length !== 1 ? 's' : ''}
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
          <Button size="sm" variant="outline" onClick={toggleAllReviewed}>
            {isAllReviewed ? 'Mark all unreviewed' : 'Mark all reviewed'}
          </Button>
        </div>
      </div>

      <div className="grid h-1/3 min-h-0 border-b border-border">
        {/* File list */}
        <ScrollArea className="border-r border-border">
          <div className="flex flex-col px-3 py-2 text-xs gap-1">
            {filesToDisplay.length > 0 ? (
              filesToDisplay.map((file) => (
                <div
                  key={file.path}
                  className={`rounded border border-transparent px-2 py-1 ${
                    reviewedFiles[file.path]
                      ? 'border-emerald-900/40 bg-emerald-950/15'
                      : 'bg-zinc-900/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`font-bold ${statusColors[file.status] || 'text-muted-foreground'}`}>
                        {statusLabels[file.status] || '?'}
                      </span>
                      <span className="text-foreground truncate">{file.path}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleReviewed(file.path)}
                    >
                      {reviewedFiles[file.path] ? 'Reviewed' : 'Mark reviewed'}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-2 py-6 text-muted-foreground">No files in this diff</div>
            )}
          </div>
        </ScrollArea>

        {/* Diff content */}
        <ScrollArea className="min-h-0 h-full">
          <div className="font-mono text-xs">
            {parsedFiles.length > 0 ? (
              parsedFiles.map((file) => {
                const status = changedFiles.find((f) => f.path === file.path)?.status ?? 'modified';
                const fileCommentable = comments[file.path] ?? [];
                return (
                  <div key={file.path} className="border-b border-border/80">
                    <div className="flex items-center justify-between border-b border-border bg-zinc-900/50 px-2 py-1">
                      <span className={`font-bold ${statusColors[status] || 'text-muted-foreground'}`}>
                        {statusLabels[status] || '?'} {file.path}
                      </span>
                      {reviewedFiles[file.path] ? (
                        <span className="text-xs text-emerald-300">Reviewed</span>
                      ) : (
                        <span className="text-xs text-yellow-300">Needs review</span>
                      )}
                    </div>

                    {file.lines.length > 0 ? (
                      <div>
                        {file.lines.map((line, index) => {
                          const key = commentKey(file.path, index);
                          const isActiveComment = activeCommentTarget === key;
                          const hasComments = comments[key]?.length ? comments[key]!.length : 0;

                          if (line.type === 'meta' || line.type === 'hunk') {
                            return (
                              <div key={key} className={`px-2 py-0.5 ${lineClassName(line.type)}`}>
                                <span className="text-[10px] opacity-80">{line.content}</span>
                              </div>
                            );
                          }

                          const baseLineClass = lineClassName(line.type);

                          if (viewMode === 'unified') {
                            const prefix =
                              line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
                            return (
                              <div key={key}>
                                <div
                                  className={`grid grid-cols-[3.2rem_3.2rem_1.5rem_1fr_4.5rem] ${baseLineClass}`}
                                >
                                  <span className="px-2 py-1 text-right text-zinc-500 shrink-0">
                                    {line.oldLine ?? ''}
                                  </span>
                                  <span className="px-2 py-1 text-right text-zinc-500 shrink-0">
                                    {line.newLine ?? ''}
                                  </span>
                                  <span className="text-zinc-500 shrink-0 px-1 text-center">{prefix}</span>
                                  <span className="py-1 px-2 whitespace-pre-wrap break-words min-w-0">
                                    {line.content}
                                  </span>
                                  <span className="px-1 py-1 text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2"
                                      onClick={() => {
                                        setActiveCommentTarget(isActiveComment ? null : key);
                                      }}
                                    >
                                      Comment
                                    </Button>
                                  </span>
                                </div>
                                {hasComments > 0 && (
                                  <div className="px-3 py-2 border-t border-border/70 bg-zinc-950/20 text-zinc-200 space-y-2">
                                    {comments[key]?.map((comment) => (
                                      <div key={comment.id} className="rounded border border-border p-2 bg-zinc-900/30">
                                        <MarkdownRenderer content={comment.markdown} />
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {isActiveComment && (
                                  <div className="flex flex-col gap-2 border-y border-border bg-zinc-950/40 p-2">
                                    <textarea
                                      value={commentDrafts[key] ?? ''}
                                      onChange={(event) => changeComment(key, event.target.value)}
                                      className="w-full min-h-20 rounded border border-border bg-background p-2 text-xs font-mono text-foreground"
                                      placeholder="Add review comment (Markdown supported)"
                                    />
                                    <div className="flex items-center justify-end gap-2">
                                      <Button size="sm" variant="outline" onClick={cancelComment}>
                                        Cancel
                                      </Button>
                                      <Button size="sm" onClick={saveComment}>
                                        Save comment
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div key={`${key}:side`} className="space-y-0.5">
                              <div
                                className={`grid grid-cols-[3.2rem_1fr_3.2rem_1fr_4.5rem] ${baseLineClass}`}
                              >
                                <span className="px-2 py-1 text-right text-zinc-500 shrink-0">
                                  {line.type === 'removed' || line.type === 'context' ? line.oldLine : ''}
                                </span>
                                <span className="py-1 px-2 whitespace-pre-wrap break-words min-w-0">
                                  {line.type === 'removed' || line.type === 'context' ? line.content : ''}
                                </span>
                                <span className="px-2 py-1 text-right text-zinc-500 shrink-0">
                                  {line.type === 'added' || line.type === 'context' ? line.newLine : ''}
                                </span>
                                <span className="py-1 px-2 whitespace-pre-wrap break-words min-w-0">
                                  {line.type === 'added' || line.type === 'context' ? line.content : ''}
                                </span>
                                <span className="px-1 py-1 text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2"
                                    onClick={() => {
                                      setActiveCommentTarget(isActiveComment ? null : key);
                                    }}
                                  >
                                    Comment
                                  </Button>
                                </span>
                              </div>
                              {hasComments > 0 && (
                                <div className="px-3 py-2 border-t border-border/70 bg-zinc-950/20 text-zinc-200 space-y-2">
                                  {comments[key]?.map((comment) => (
                                    <div key={comment.id} className="rounded border border-border p-2 bg-zinc-900/30">
                                      <MarkdownRenderer content={comment.markdown} />
                                    </div>
                                  ))}
                                </div>
                              )}
                              {isActiveComment && (
                                <div className="flex flex-col gap-2 border-y border-border bg-zinc-950/40 p-2">
                                  <textarea
                                    value={commentDrafts[key] ?? ''}
                                    onChange={(event) => changeComment(key, event.target.value)}
                                    className="w-full min-h-20 rounded border border-border bg-background p-2 text-xs font-mono text-foreground"
                                    placeholder="Add review comment (Markdown supported)"
                                  />
                                  <div className="flex items-center justify-end gap-2">
                                    <Button size="sm" variant="outline" onClick={cancelComment}>
                                      Cancel
                                    </Button>
                                    <Button size="sm" onClick={saveComment}>
                                      Save comment
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 text-xs text-muted-foreground">
                        No file hunks available
                      </div>
                    )}
                    <div className="px-3 py-2 border-t border-border bg-zinc-950/30">
                      <span className="text-[11px] text-muted-foreground">
                        File comments: {fileCommentable.length}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
                No changes
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {hasRangeDiff && revisions.length > 0 && (
        <div className="border-t border-border px-3 py-1 text-[11px] text-muted-foreground">
          Comparing {revisions.find((r) => r.id === draftFromRef)?.shortId ?? draftFromRef} to{' '}
          {revisions.find((r) => r.id === draftToRef)?.shortId ?? draftToRef}
        </div>
      )}
    </div>
  );
}
