import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWorkspaceDiff } from '@/hooks/useWorkspaceDiff';
import { useSettings } from '@/hooks/useSettings';
import * as api from '@/lib/workspace-api';
import type { DiffComment, CodeReviewResult } from '@claude-tauri/shared';
import { CodeReviewDialog } from './CodeReviewDialog';
import { CodeReviewSummary } from './CodeReviewSummary';
import { getWorkflowPrompt } from '@/lib/workflowPrompts';
import {
  parseWorkspaceDiff,
  commentKey,
  statusLabels,
  statusColors,
} from './diff-parser';
import type { DiffMode, ParsedDiffFile, InlineComment } from './diff-parser';
import { DiffToolbar } from './DiffToolbar';
import { DiffFileList } from './DiffFileList';
import { DiffLineView } from './DiffLineView';

// Re-export types for backward compatibility
export type { ParsedDiffLine, ParsedDiffFile, InlineComment } from './diff-parser';
export { parseWorkspaceDiff } from './diff-parser';

interface WorkspaceDiffViewProps {
  workspaceId: string;
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
  const [diffComments, setDiffComments] = useState<DiffComment[]>([]);
  const [comments, setComments] = useState<Record<string, InlineComment[]>>({});
  const { settings } = useSettings();
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewResult, setReviewResult] = useState<CodeReviewResult | null>(null);
  const diffContainerRef = useRef<HTMLDivElement>(null);
  const [activeCommentMeta, setActiveCommentMeta] = useState<{
    filePath: string;
    lineNumber: number | null;
  } | null>(null);

  const { diff, changedFiles, loading, error, fetchDiff } = useWorkspaceDiff(workspaceId, reviewRange);
  const parsedFiles = useMemo(() => parseWorkspaceDiff(diff), [diff]);

  const commentsByKey = useMemo(() => {
    const map: Record<string, DiffComment[]> = {};
    for (const c of diffComments) {
      const key = c.lineNumber != null
        ? `${c.filePath}:line:${c.lineNumber}`
        : `${c.filePath}:file`;
      map[key] = [...(map[key] ?? []), c];
    }
    return map;
  }, [diffComments]);

  const loadDiffComments = useCallback(() => {
    api.fetchDiffComments(workspaceId)
      .then((loaded) => setDiffComments(loaded))
      .catch(() => {});
  }, [workspaceId]);

  useEffect(() => { loadDiffComments(); }, [loadDiffComments]);

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
    return () => { cancelled = true; };
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

  useEffect(() => { fetchDiff(); }, [fetchDiff]);

  const filesToDisplay = useMemo(() => {
    const parsedByPath = new Map(parsedFiles.map((f) => [f.path, f]));
    const fileSet: Array<{ path: string; status: string; file: ParsedDiffFile | null }> = [];
    for (const file of changedFiles) {
      fileSet.push({ path: file.path, status: file.status, file: parsedByPath.get(file.path) ?? null });
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
    setReviewRange(draftFromRef && draftToRef ? { fromRef: draftFromRef, toRef: draftToRef } : undefined);
  };

  const toggleReviewed = (path: string) => {
    setReviewedFiles((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const toggleAllReviewed = () => {
    const shouldReviewAll = filesToDisplay.some((file) => !reviewedFiles[file.path]);
    const next: Record<string, boolean> = {};
    for (const file of filesToDisplay) next[file.path] = shouldReviewAll;
    setReviewedFiles((prev) => ({ ...prev, ...next }));
  };

  const isAllReviewed = filesToDisplay.every((file) => reviewedFiles[file.path]);
  const hasRangeDiff = Boolean(reviewRange);

  const saveComment = async () => {
    if (!activeCommentTarget || !activeCommentMeta) return;
    const content = commentDrafts[activeCommentTarget]?.trim();
    if (!content) return;
    try {
      const saved = await api.createDiffComment(workspaceId, {
        filePath: activeCommentMeta.filePath,
        lineNumber: activeCommentMeta.lineNumber,
        content,
        author: 'user',
      });
      setDiffComments((prev) => [...prev, saved]);
    } catch {
      // non-fatal
    }
    setCommentDrafts((prev) => {
      const next = { ...prev };
      delete next[activeCommentTarget];
      return next;
    });
    setActiveCommentTarget(null);
    setActiveCommentMeta(null);
  };

  const cancelComment = () => {
    if (!activeCommentTarget) return;
    setCommentDrafts((prev) => {
      const next = { ...prev };
      delete next[activeCommentTarget];
      return next;
    });
    setActiveCommentTarget(null);
    setActiveCommentMeta(null);
  };

  const deleteComment = async (commentId: string) => {
    try {
      await api.deleteDiffComment(workspaceId, commentId);
      setDiffComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      // non-fatal
    }
  };

  const openCommentComposer = (key: string, filePath: string, lineNumber: number | null) => {
    setActiveCommentTarget(activeCommentTarget === key ? null : key);
    setActiveCommentMeta(activeCommentTarget === key ? null : { filePath, lineNumber });
  };

  const injectAIComments = useCallback((result: CodeReviewResult) => {
    setComments((prev) => {
      const next = { ...prev };
      for (const c of result.comments) {
        const fileData = parsedFiles.find((f) => f.path === c.file);
        let targetKey: string | null = null;
        if (fileData && c.line) {
          const idx = fileData.lines.findIndex((l) => l.newLine === c.line);
          if (idx >= 0) targetKey = commentKey(c.file, idx);
        }
        if (!targetKey) targetKey = `${c.file}:file`;
        const inline: InlineComment = {
          id: c.id,
          markdown: `**${c.severity.toUpperCase()}**: ${c.body}`,
          isAI: true,
          severity: c.severity,
        };
        next[targetKey] = [...(next[targetKey] ?? []), inline];
      }
      return next;
    });
  }, [parsedFiles]);

  const startReview = useCallback(
    async (prompt: string, model: string, effort: 'low' | 'medium' | 'high' | 'max') => {
      setReviewLoading(true);
      setReviewError(null);
      setReviewResult(null);
      try {
        const result = await api.fetchCodeReview(workspaceId, { prompt, model, effort });
        setReviewResult(result);
        injectAIComments(result);
      } catch (err) {
        setReviewError(err instanceof Error ? err.message : 'Review failed');
      } finally {
        setReviewLoading(false);
      }
    },
    [workspaceId, injectAIComments],
  );

  const handleReviewClick = useCallback(() => {
    const prompt = getWorkflowPrompt(settings.workflowPrompts, 'codeReview');
    void startReview(prompt, settings.codeReviewModel, settings.codeReviewEffort);
  }, [settings, startReview]);

  const handleReviewContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setReviewDialogOpen(true);
  }, []);

  const handleScrollToComment = useCallback((file: string, line?: number) => {
    if (!diffContainerRef.current) return;
    const selector = line
      ? `[data-diff-file="${CSS.escape(file)}"][data-diff-line="${line}"]`
      : `[data-diff-file="${CSS.escape(file)}"]`;
    diffContainerRef.current.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

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
        <Button variant="ghost" size="sm" className="ml-2" onClick={fetchDiff}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <DiffToolbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        hasRangeDiff={hasRangeDiff}
        changedFilesCount={changedFiles.length}
        draftFromRef={draftFromRef}
        setDraftFromRef={setDraftFromRef}
        draftToRef={draftToRef}
        setDraftToRef={setDraftToRef}
        revisions={revisions}
        rangeError={rangeError}
        filterMode={filterMode}
        setFilterMode={setFilterMode}
        isAllReviewed={isAllReviewed}
        reviewLoading={reviewLoading}
        onRefresh={fetchDiff}
        onApplyRange={applyRange}
        onToggleAllReviewed={toggleAllReviewed}
        onReviewClick={handleReviewClick}
        onReviewContextMenu={handleReviewContextMenu}
      />

      {reviewError && (
        <div className="px-3 py-2 text-sm text-destructive border-b border-border bg-destructive/10">
          Review failed: {reviewError}
        </div>
      )}

      {reviewResult && (
        <div className="px-3 py-2 border-b border-border">
          <CodeReviewSummary result={reviewResult} onCommentClick={handleScrollToComment} />
        </div>
      )}

      <div className="grid h-1/3 min-h-0 border-b border-border">
        <DiffFileList
          files={filesToDisplay}
          reviewedFiles={reviewedFiles}
          onToggleReviewed={toggleReviewed}
        />

        <ScrollArea className="min-h-0 h-full">
          <div className="font-mono text-xs" ref={diffContainerRef}>
            {parsedFiles.length > 0 ? (
              parsedFiles.map((file) => {
                const status = changedFiles.find((f) => f.path === file.path)?.status ?? 'modified';
                const fileCommentCount = diffComments.filter((c) => c.filePath === file.path).length;
                return (
                  <div key={file.path} className="border-b border-border/80" data-diff-file={file.path}>
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
                          const gitLineNumber: number | null =
                            line.type === 'added' ? (line.newLine ?? null) :
                            line.type === 'removed' ? (line.oldLine ?? null) :
                            line.type === 'context' ? (line.newLine ?? null) : null;
                          const lookupKey = gitLineNumber != null ? `${file.path}:line:${gitLineNumber}` : null;

                          return (
                            <DiffLineView
                              key={viewMode === 'unified' ? key : `${key}:side`}
                              line={line}
                              lineKey={key}
                              filePath={file.path}
                              viewMode={viewMode}
                              gitLineNumber={gitLineNumber}
                              lineComments={lookupKey ? (commentsByKey[lookupKey] ?? []) : []}
                              inlineComments={comments[key]}
                              isActiveComment={activeCommentTarget === key}
                              commentDraft={commentDrafts[key] ?? ''}
                              onOpenComposer={openCommentComposer}
                              onChangeComment={(k, v) => setCommentDrafts((prev) => ({ ...prev, [k]: v }))}
                              onSaveComment={saveComment}
                              onCancelComment={cancelComment}
                              onDeleteComment={deleteComment}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 text-xs text-muted-foreground">No file hunks available</div>
                    )}
                    <div className="px-3 py-2 border-t border-border bg-zinc-950/30">
                      <span className="text-[11px] text-muted-foreground">File comments: {fileCommentCount}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">No changes</div>
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

      <CodeReviewDialog
        isOpen={reviewDialogOpen}
        initialPrompt={getWorkflowPrompt(settings.workflowPrompts, 'codeReview')}
        model={settings.codeReviewModel}
        effort={settings.codeReviewEffort}
        onClose={() => setReviewDialogOpen(false)}
        onStartReview={(prompt, model, effort) => { void startReview(prompt, model, effort); }}
      />
    </div>
  );
}
