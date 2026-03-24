import { useState } from 'react';
import { Trash, X } from '@phosphor-icons/react';

interface BulkActionsBarProps {
  selectedCount: number;
  onDelete: () => void;
  onClearSelection: () => void;
}

export function BulkActionsBar({ selectedCount, onDelete, onClearSelection }: BulkActionsBarProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <>
      <div
        data-testid="bulk-actions-bar"
        className="flex items-center gap-3 px-4 py-2.5 mb-4 rounded-xl bg-card border border-border shadow-sm"
      >
        <span className="text-sm font-medium text-foreground" data-testid="bulk-selection-count">
          {selectedCount} selected
        </span>

        <div className="h-4 w-px bg-border" />

        <button
          onClick={() => setShowConfirm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          data-testid="bulk-delete-button"
        >
          <Trash size={14} />
          Delete
        </button>

        {/* Future: Add more actions here (Move to folder, Tag, etc.) */}

        <div className="flex-1" />

        <button
          onClick={onClearSelection}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-border/40 transition-colors"
          data-testid="bulk-clear-selection"
        >
          <X size={12} />
          Clear selection
        </button>
      </div>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          data-testid="bulk-delete-confirm-dialog"
          onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}
        >
          <div className="bg-card border border-border rounded-2xl p-6 shadow-lg max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-foreground mb-2">
              Delete {selectedCount} document{selectedCount !== 1 ? 's' : ''}?
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              This cannot be undone. The selected documents and their files will be permanently deleted.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-border/40 transition-colors"
                data-testid="bulk-delete-cancel"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false);
                  onDelete();
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
                data-testid="bulk-delete-confirm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
