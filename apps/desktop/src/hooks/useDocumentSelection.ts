import { useState, useCallback, useRef } from 'react';

export function useDocumentSelection(documentIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastClickedRef = useRef<string | null>(null);

  const toggle = useCallback((id: string, shiftKey = false) => {
    setSelectedIds(prev => {
      const next = new Set(prev);

      if (shiftKey && lastClickedRef.current && lastClickedRef.current !== id) {
        // Shift+click: select range
        const lastIdx = documentIds.indexOf(lastClickedRef.current);
        const currIdx = documentIds.indexOf(id);
        if (lastIdx !== -1 && currIdx !== -1) {
          const start = Math.min(lastIdx, currIdx);
          const end = Math.max(lastIdx, currIdx);
          for (let i = start; i <= end; i++) {
            next.add(documentIds[i]);
          }
          return next;
        }
      }

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      lastClickedRef.current = id;
      return next;
    });

    // Update lastClicked outside of shift path too
    if (!shiftKey) {
      lastClickedRef.current = id;
    }
  }, [documentIds]);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(documentIds));
  }, [documentIds]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
    lastClickedRef.current = null;
  }, []);

  const isAllSelected = documentIds.length > 0 && selectedIds.size === documentIds.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < documentIds.length;

  return {
    selectedIds,
    toggle,
    selectAll,
    deselectAll,
    isAllSelected,
    isSomeSelected,
    selectedCount: selectedIds.size,
  };
}
