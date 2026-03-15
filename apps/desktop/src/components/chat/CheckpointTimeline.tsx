import { useState } from 'react';
import type { Checkpoint } from '@claude-tauri/shared';

interface CheckpointTimelineProps {
  checkpoints: Checkpoint[];
  onRewind: (checkpointId: string) => void;
}

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function fileActionSummary(checkpoint: Checkpoint): string {
  const counts = { created: 0, modified: 0, deleted: 0 };
  for (const fc of checkpoint.filesChanged) {
    counts[fc.action]++;
  }
  const parts: string[] = [];
  if (counts.created > 0) parts.push(`${counts.created} created`);
  if (counts.modified > 0) parts.push(`${counts.modified} modified`);
  if (counts.deleted > 0) parts.push(`${counts.deleted} deleted`);
  return parts.join(', ');
}

export function CheckpointTimeline({ checkpoints, onRewind }: CheckpointTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (checkpoints.length === 0) return null;

  return (
    <div className="border-t border-border" data-testid="checkpoint-timeline">
      {/* Toggle bar */}
      <button
        data-testid="checkpoint-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <span className="text-xs">{isExpanded ? '\u25BC' : '\u25B6'}</span>
        <span>Checkpoints</span>
        <span
          data-testid="checkpoint-count"
          className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-medium rounded-full bg-primary/20 text-primary"
        >
          {checkpoints.length}
        </span>
      </button>

      {/* Timeline content */}
      {isExpanded && (
        <div data-testid="checkpoint-list" className="px-4 pb-3 max-h-64 overflow-y-auto">
          <div className="relative">
            {checkpoints.map((cp, index) => (
              <div
                key={cp.id}
                data-testid={`checkpoint-item-${cp.id}`}
                className="relative pl-6 pb-4 last:pb-0"
              >
                {/* Vertical timeline line */}
                {index < checkpoints.length - 1 && (
                  <div
                    data-testid="timeline-line"
                    className="absolute left-[5px] top-3 bottom-0 w-px bg-border"
                  />
                )}

                {/* Timeline dot */}
                <div
                  data-testid="timeline-dot"
                  className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-primary"
                />

                {/* Checkpoint content */}
                <div className="flex flex-col gap-0.5">
                  {/* Turn number and prompt preview */}
                  <div className="flex items-center gap-2">
                    <span
                      data-testid={`checkpoint-turn-${cp.id}`}
                      className="text-sm font-medium text-foreground"
                    >
                      Turn {cp.turnIndex + 1}:
                    </span>
                    <span
                      data-testid={`checkpoint-prompt-${cp.id}`}
                      className="text-sm text-foreground truncate max-w-[200px]"
                      title={cp.promptPreview}
                    >
                      "{cp.promptPreview}"
                    </span>
                  </div>

                  {/* File change summary */}
                  <div
                    data-testid={`checkpoint-files-${cp.id}`}
                    className="text-xs text-muted-foreground"
                  >
                    {fileActionSummary(cp)}
                  </div>

                  {/* Individual file paths */}
                  <div className="text-xs text-muted-foreground">
                    {cp.filesChanged.map((fc, fIndex) => (
                      <span key={fIndex}>
                        {fc.path}
                        {fIndex < cp.filesChanged.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>

                  {/* Timestamp and rewind button */}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      data-testid={`checkpoint-time-${cp.id}`}
                      className="text-xs text-muted-foreground"
                    >
                      {formatTime(cp.timestamp)}
                    </span>
                    <button
                      data-testid={`checkpoint-rewind-${cp.id}`}
                      onClick={() => onRewind(cp.id)}
                      className="text-xs text-primary hover:underline"
                    >
                      Rewind
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
