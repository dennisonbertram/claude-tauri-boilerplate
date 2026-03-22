import { useEffect } from 'react';

interface UseAppKeyboardShortcutsParams {
  activeView: string;
  activeSessionId: string | null;
  openSessionIds: string[];
  setActiveSessionId: (id: string | null) => void;
  setActiveSessionHasMessages: (v: boolean) => void;
  handleOpenSettings: () => void;
}

export function useAppKeyboardShortcuts({
  activeView,
  activeSessionId,
  openSessionIds,
  setActiveSessionId,
  setActiveSessionHasMessages,
  handleOpenSettings,
}: UseAppKeyboardShortcutsParams) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 't') {
        if (activeView !== 'chat') return;
        e.preventDefault();
        setActiveSessionId(null);
        setActiveSessionHasMessages(false);
        return;
      }

      if (e.ctrlKey && e.key === 'Tab') {
        if (activeView !== 'chat') return;
        if (openSessionIds.length < 2) return;
        e.preventDefault();
        const currentIndex = activeSessionId
          ? openSessionIds.indexOf(activeSessionId)
          : -1;
        const nextIndex = e.shiftKey
          ? (currentIndex - 1 + openSessionIds.length) % openSessionIds.length
          : (currentIndex + 1) % openSessionIds.length;
        const nextId = openSessionIds[nextIndex];
        if (nextId) setActiveSessionId(nextId);
        return;
      }

      if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleOpenSettings();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleOpenSettings, activeView, openSessionIds, activeSessionId, setActiveSessionId, setActiveSessionHasMessages]);
}
