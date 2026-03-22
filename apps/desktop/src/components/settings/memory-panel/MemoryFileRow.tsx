import type { MemoryFile } from '@claude-tauri/shared';
import { formatBytesInline } from './memory-utils';

interface MemoryFileRowProps {
  file: MemoryFile;
  isSelected: boolean;
  isEditing: boolean;
  isDeleteConfirm: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}

export function MemoryFileRow({
  file,
  isSelected,
  isEditing,
  isDeleteConfirm,
  onSelect,
  onEdit,
  onCancelEdit,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: MemoryFileRowProps) {
  return (
    <div
      data-testid={`memory-file-${file.name}`}
      className={`flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
        isSelected
          ? 'border-primary/50 bg-primary/5'
          : 'border-border hover:border-border/80 hover:bg-muted/30'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm shrink-0">
          {file.isEntrypoint ? '\u2B50' : '\uD83D\uDCC4'}
        </span>
        <span className="text-sm text-foreground truncate">{file.name}</span>
        {file.isEntrypoint && (
          <span
            data-testid="memory-entrypoint-badge"
            className="shrink-0 rounded-full border px-1.5 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 border-amber-500/30"
          >
            entrypoint
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {formatBytesInline(file.sizeBytes)}
        </span>
      </div>

      <div
        className="flex items-center gap-1 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {isDeleteConfirm ? (
          <>
            <span className="text-xs text-red-400 mr-1">Delete?</span>
            <button
              data-testid={`memory-delete-confirm-${file.name}`}
              onClick={onDeleteConfirm}
              className="rounded-md px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Yes
            </button>
            <button
              data-testid={`memory-delete-cancel-${file.name}`}
              onClick={onDeleteCancel}
              className="rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
            >
              No
            </button>
          </>
        ) : (
          <>
            <button
              data-testid={`memory-edit-btn-${file.name}`}
              onClick={() => { if (isEditing) onCancelEdit(); else onEdit(); }}
              className="rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
            {!file.isEntrypoint && (
              <button
                data-testid={`memory-delete-btn-${file.name}`}
                onClick={onDeleteRequest}
                className="rounded-md px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
