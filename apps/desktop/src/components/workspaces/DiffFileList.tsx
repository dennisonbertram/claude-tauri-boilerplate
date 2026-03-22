import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { statusLabels, statusColors } from './diff-parser';

interface DiffFileListProps {
  files: Array<{ path: string; status: string }>;
  reviewedFiles: Record<string, boolean>;
  onToggleReviewed: (path: string) => void;
}

export function DiffFileList({ files, reviewedFiles, onToggleReviewed }: DiffFileListProps) {
  return (
    <ScrollArea className="border-r border-border">
      <div className="flex flex-col px-3 py-2 text-xs gap-1">
        {files.length > 0 ? (
          files.map((file) => (
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
                  onClick={() => onToggleReviewed(file.path)}
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
  );
}
