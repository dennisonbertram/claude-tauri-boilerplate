import { Button } from '@/components/ui/button';
import type { DiffComment } from '@claude-tauri/shared';
import type { ParsedDiffLine, DiffMode, InlineComment } from './diff-parser';
import { lineClassName } from './diff-parser';
import { DiffCommentThread } from './DiffCommentThread';
import { DiffCommentComposer } from './DiffCommentComposer';

interface DiffLineViewProps {
  line: ParsedDiffLine;
  lineKey: string;
  filePath: string;
  viewMode: DiffMode;
  gitLineNumber: number | null;
  lineComments: DiffComment[];
  inlineComments?: InlineComment[];
  isActiveComment: boolean;
  commentDraft: string;
  onOpenComposer: (key: string, filePath: string, lineNumber: number | null) => void;
  onChangeComment: (key: string, value: string) => void;
  onSaveComment: () => void;
  onCancelComment: () => void;
  onDeleteComment: (commentId: string) => void;
}

export function DiffLineView({
  line,
  lineKey,
  filePath,
  viewMode,
  gitLineNumber,
  lineComments,
  inlineComments,
  isActiveComment,
  commentDraft,
  onOpenComposer,
  onChangeComment,
  onSaveComment,
  onCancelComment,
  onDeleteComment,
}: DiffLineViewProps) {
  if (line.type === 'meta' || line.type === 'hunk') {
    return (
      <div className={`px-2 py-0.5 ${lineClassName(line.type)}`}>
        <span className="text-[10px] opacity-80">{line.content}</span>
      </div>
    );
  }

  const hasComments = lineComments.length > 0 || (inlineComments && inlineComments.length > 0);
  const baseLineClass = lineClassName(line.type);

  if (viewMode === 'unified') {
    const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
    return (
      <div
        data-diff-file={filePath}
        data-diff-line={line.newLine ?? undefined}
      >
        <div className={`grid grid-cols-[3.2rem_3.2rem_1.5rem_1fr_4.5rem] ${baseLineClass}`}>
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
              onClick={() => onOpenComposer(lineKey, filePath, gitLineNumber)}
            >
              Comment
            </Button>
          </span>
        </div>
        {hasComments && (
          <DiffCommentThread
            lineComments={lineComments}
            inlineComments={inlineComments}
            onDeleteComment={onDeleteComment}
          />
        )}
        {isActiveComment && (
          <DiffCommentComposer
            value={commentDraft}
            onChange={(value) => onChangeComment(lineKey, value)}
            onSave={onSaveComment}
            onCancel={onCancelComment}
          />
        )}
      </div>
    );
  }

  // Side-by-side mode
  return (
    <div className="space-y-0.5">
      <div className={`grid grid-cols-[3.2rem_1fr_3.2rem_1fr_4.5rem] ${baseLineClass}`}>
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
            onClick={() => onOpenComposer(lineKey, filePath, gitLineNumber)}
          >
            Comment
          </Button>
        </span>
      </div>
      {hasComments && (
        <DiffCommentThread
          lineComments={lineComments}
          inlineComments={inlineComments}
          onDeleteComment={onDeleteComment}
        />
      )}
      {isActiveComment && (
        <DiffCommentComposer
          value={commentDraft}
          onChange={(value) => onChangeComment(lineKey, value)}
          onSave={onSaveComment}
          onCancel={onCancelComment}
        />
      )}
    </div>
  );
}
