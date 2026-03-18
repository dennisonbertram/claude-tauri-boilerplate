import { useCallback, useState } from 'react';

/**
 * Tracks which workspace IDs have unread (new) activity.
 * State is transient — resets when the page is refreshed.
 */
export function useUnread() {
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());

  const markAsUnread = useCallback((workspaceId: string) => {
    setUnreadIds((prev) => {
      if (prev.has(workspaceId)) return prev;
      const next = new Set(prev);
      next.add(workspaceId);
      return next;
    });
  }, []);

  const markAsRead = useCallback((workspaceId: string) => {
    setUnreadIds((prev) => {
      if (!prev.has(workspaceId)) return prev;
      const next = new Set(prev);
      next.delete(workspaceId);
      return next;
    });
  }, []);

  const isUnread = useCallback(
    (workspaceId: string): boolean => unreadIds.has(workspaceId),
    [unreadIds]
  );

  const unreadCount = unreadIds.size;

  return { unreadIds, unreadCount, markAsUnread, markAsRead, isUnread };
}
