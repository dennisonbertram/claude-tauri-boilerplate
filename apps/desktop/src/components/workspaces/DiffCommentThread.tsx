import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from '../chat/MarkdownRenderer';
import type { DiffComment } from '@claude-tauri/shared';
import type { InlineComment } from './diff-parser';

interface DiffCommentThreadProps {
  lineComments: DiffComment[];
  inlineComments?: InlineComment[];
  onDeleteComment: (commentId: string) => void;
}

export function DiffCommentThread({
  lineComments,
  inlineComments,
  onDeleteComment,
}: DiffCommentThreadProps) {
  if (lineComments.length === 0 && (!inlineComments || inlineComments.length === 0)) {
    return null;
  }

  return (
    <div className="px-3 py-2 border-t border-border/70 bg-zinc-950/20 text-zinc-200 space-y-2">
      {lineComments.map((comment) => (
        <div key={comment.id} className="rounded border border-border p-2 bg-zinc-900/30 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <MarkdownRenderer content={comment.content} />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => onDeleteComment(comment.id)}
          >
            Delete
          </Button>
        </div>
      ))}
      {inlineComments?.map((comment) => (
        <div
          key={comment.id}
          className={`rounded border p-2 ${
            comment.isAI
              ? 'border-primary/40 bg-primary/5'
              : 'border-border bg-zinc-900/30'
          }`}
        >
          {comment.isAI && (
            <span className="mb-1 inline-block rounded bg-primary/20 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
              AI
            </span>
          )}
          <MarkdownRenderer content={comment.markdown} />
        </div>
      ))}
    </div>
  );
}
