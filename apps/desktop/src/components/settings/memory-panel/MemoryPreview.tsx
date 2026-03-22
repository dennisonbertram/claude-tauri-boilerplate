import type { MemoryFile } from '@claude-tauri/shared';

interface MemoryPreviewProps {
  file: MemoryFile;
}

export function MemoryPreview({ file }: MemoryPreviewProps) {
  return (
    <div data-testid="memory-preview" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Preview</h3>
        <span className="text-xs text-muted-foreground truncate max-w-[240px]">
          {file.name}
        </span>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 max-h-64 overflow-y-auto">
        <pre className="text-sm font-mono whitespace-pre-wrap text-foreground/80">
          {file.content}
        </pre>
      </div>
    </div>
  );
}
