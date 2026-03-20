import { SquaresFour, Archive } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { Artifact } from '@claude-tauri/shared';

interface ArtifactBlockProps {
  artifact: Artifact;
  onArchive?: (id: string) => void;
}

export function ArtifactBlock({ artifact, onArchive }: ArtifactBlockProps) {
  const isArchived = artifact.status === 'archived';

  return (
    <div
      className={cn(
        'mt-2 rounded-lg border border-border bg-background/60 p-3 flex items-start gap-3',
        isArchived && 'opacity-60'
      )}
      data-testid="artifact-block"
      data-artifact-id={artifact.id}
    >
      <div className="mt-0.5 shrink-0 rounded-md bg-primary/10 p-1.5 text-primary">
        <SquaresFour className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{artifact.title}</span>
          {isArchived && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">archived</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Dashboard artifact</p>
      </div>
      {onArchive && !isArchived && (
        <button
          type="button"
          title="Archive artifact"
          onClick={() => onArchive(artifact.id)}
          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
