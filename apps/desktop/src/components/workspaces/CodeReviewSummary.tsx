import type { CodeReviewResult, CodeReviewComment } from '@claude-tauri/shared';

interface CodeReviewSummaryProps {
  result: CodeReviewResult;
  onCommentClick: (file: string, line?: number) => void;
  projectId?: string;
  onFileIssue?: (comment: CodeReviewComment) => void;
}

const SEVERITY_LABEL: Record<CodeReviewComment['severity'], string> = {
  critical: 'Critical',
  warning: 'Warning',
  suggestion: 'Suggestion',
  info: 'Info',
};

const SEVERITY_COLOR: Record<CodeReviewComment['severity'], string> = {
  critical: 'bg-red-950/60 border-red-700/60 text-red-300',
  warning: 'bg-yellow-950/50 border-yellow-700/50 text-yellow-300',
  suggestion: 'bg-blue-950/50 border-blue-700/50 text-blue-300',
  info: 'bg-zinc-900/50 border-zinc-700/50 text-zinc-300',
};

const SEVERITY_BADGE: Record<CodeReviewComment['severity'], string> = {
  critical: 'bg-red-500 text-white',
  warning: 'bg-yellow-500 text-black',
  suggestion: 'bg-blue-500 text-white',
  info: 'bg-zinc-500 text-white',
};

const SEVERITY_DOT: Record<CodeReviewComment['severity'], string> = {
  critical: 'bg-red-500',
  warning: 'bg-yellow-500',
  suggestion: 'bg-blue-500',
  info: 'bg-zinc-500',
};

function countBySeverity(comments: CodeReviewComment[]) {
  return comments.reduce(
    (acc, c) => {
      acc[c.severity] = (acc[c.severity] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<CodeReviewComment['severity'], number>>
  );
}

function groupBySeverity(comments: CodeReviewComment[]) {
  const groups: Partial<Record<CodeReviewComment['severity'], CodeReviewComment[]>> = {};
  for (const c of comments) {
    if (!groups[c.severity]) groups[c.severity] = [];
    groups[c.severity]!.push(c);
  }
  return groups;
}

export function CodeReviewSummary({ result, onCommentClick, projectId, onFileIssue }: CodeReviewSummaryProps) {
  const counts = countBySeverity(result.comments);
  const severities: CodeReviewComment['severity'][] = ['critical', 'warning', 'suggestion', 'info'];
  const grouped = groupBySeverity(result.comments);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-zinc-900/40 p-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
            AI Review
          </span>
          <span className="text-[10px] text-muted-foreground">
            {new Date(result.reviewedAt).toLocaleTimeString()}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {severities.map((sev) => {
            const count = counts[sev] ?? 0;
            if (count === 0) return null;
            return (
              <span
                key={sev}
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${SEVERITY_BADGE[sev]}`}
                title={`${count} ${SEVERITY_LABEL[sev].toLowerCase()}${count !== 1 ? 's' : ''}`}
              >
                {count} {SEVERITY_LABEL[sev]}
              </span>
            );
          })}
          {result.comments.length === 0 && (
            <span className="text-[10px] text-emerald-400">No issues found</span>
          )}
        </div>
      </div>

      {/* Severity summary bar */}
      <div className="flex items-center gap-2 rounded-md border border-border bg-zinc-950/30 px-3 py-2">
        {severities.map((sev) => {
          const count = counts[sev] ?? 0;
          if (count === 0) return null;
          return (
            <div key={sev} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${SEVERITY_DOT[sev]}`} />
              <span className="text-xs text-foreground font-medium">{count}</span>
              <span className="text-xs text-muted-foreground">{SEVERITY_LABEL[sev]}</span>
            </div>
          );
        })}
        {result.comments.length === 0 && (
          <span className="text-xs text-emerald-400">Clean — no issues found</span>
        )}
      </div>

      {/* Summary text */}
      <p className="text-xs text-zinc-300 leading-relaxed">{result.summary}</p>

      {/* Comment index — grouped by severity */}
      {result.comments.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Review comments ({result.comments.length})
          </div>
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
            {severities.map((sev) => {
              const group = grouped[sev];
              if (!group || group.length === 0) return null;
              return (
                <div key={sev} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className={`w-2 h-2 rounded-full ${SEVERITY_DOT[sev]}`} />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {SEVERITY_LABEL[sev]} ({group.length})
                    </span>
                  </div>
                  {group.map((comment) => (
                    <div key={comment.id} className="flex items-stretch gap-0.5">
                      <button
                        onClick={() => onCommentClick(comment.file, comment.line)}
                        className={`flex-1 rounded border px-2 py-1.5 text-left text-xs transition-opacity hover:opacity-90 ${SEVERITY_COLOR[comment.severity]}`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase ${SEVERITY_BADGE[comment.severity]}`}
                          >
                            {SEVERITY_LABEL[comment.severity]}
                          </span>
                          <span className="font-mono text-[10px] opacity-80 truncate">{comment.file}</span>
                          {comment.line && (
                            <span className="text-[10px] opacity-60 shrink-0">:{comment.line}</span>
                          )}
                        </div>
                        <p className="leading-snug line-clamp-2 opacity-90">{comment.body}</p>
                      </button>
                      {onFileIssue && projectId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onFileIssue(comment);
                          }}
                          title="File GitHub Issue"
                          className="shrink-0 flex items-center px-1.5 rounded border border-border bg-zinc-900/60 text-[9px] font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-800/80 transition-colors"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-0.5" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          Issue
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
