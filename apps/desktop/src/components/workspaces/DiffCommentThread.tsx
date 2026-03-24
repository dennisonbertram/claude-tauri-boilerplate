import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from '../chat/MarkdownRenderer';
import type { DiffComment } from '@claude-tauri/shared';
import type { InlineComment } from './diff-parser';

interface DiffCommentThreadProps {
  lineComments: DiffComment[];
  inlineComments?: InlineComment[];
  onDeleteComment: (commentId: string) => void;
  onSaveReply?: (filePath: string, lineNumber: number | null, content: string) => void;
}

export function DiffCommentThread({
  lineComments,
  inlineComments,
  onDeleteComment,
  onSaveReply,
}: DiffCommentThreadProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (replyingTo) {
      replyTextareaRef.current?.focus();
    }
  }, [replyingTo]);

  if (lineComments.length === 0 && (!inlineComments || inlineComments.length === 0)) {
    return null;
  }

  const handleSaveReply = (comment: DiffComment) => {
    const content = replyContent.trim();
    if (!content || !onSaveReply) return;
    onSaveReply(comment.filePath, comment.lineNumber ?? null, content);
    setReplyContent('');
    setReplyingTo(null);
  };

  const handleCancelReply = () => {
    setReplyContent('');
    setReplyingTo(null);
  };

  return (
    <div className="px-3 py-2 border-t border-border/70 bg-zinc-950/20 text-zinc-200 space-y-2">
      {lineComments.map((comment) => (
        <div key={comment.id}>
          <div className="rounded border border-border p-2 bg-zinc-900/30 flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <MarkdownRenderer content={comment.content} />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onSaveReply && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                >
                  Reply
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => onDeleteComment(comment.id)}
              >
                Delete
              </Button>
            </div>
          </div>
          {replyingTo === comment.id && (
            <div className="ml-4 mt-1 flex flex-col gap-1">
              <textarea
                ref={replyTextareaRef}
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                className="w-full min-h-14 rounded border border-border bg-background p-2 text-xs font-mono text-foreground"
                placeholder="Write a reply..."
              />
              <div className="flex items-center justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={handleCancelReply}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => handleSaveReply(comment)} disabled={!replyContent.trim()}>
                  Reply
                </Button>
              </div>
            </div>
          )}
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
