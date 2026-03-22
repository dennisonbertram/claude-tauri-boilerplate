import { useEffect, useCallback } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useUnread } from '@/hooks/useUnread';
import {
  requestNotificationPermission,
  sendNotification,
  playNotificationSound,
} from '@/lib/notifications';

export function useTaskNotifications() {
  const { settings } = useSettings();
  const { markAsUnread, markAsRead } = useUnread();

  useEffect(() => { void requestNotificationPermission(); }, []);

  const handleTaskComplete = useCallback(
    (params: {
      status: 'completed' | 'failed' | 'stopped';
      summary: string;
      workspaceId?: string;
      branch?: string;
      workspaceName?: string;
    }) => {
      if (!settings.notificationsEnabled) return;

      const label = params.workspaceName
        ? `${params.workspaceName} (${params.branch ?? ''})`
        : 'Agent task';

      const statusLabel =
        params.status === 'completed' ? 'completed'
          : params.status === 'failed' ? 'failed' : 'stopped';

      sendNotification(`Task ${statusLabel}`, `${label}: ${params.summary}`);
      playNotificationSound(settings.notificationSound);

      if (settings.notificationsWorkspaceUnread && params.workspaceId) {
        markAsUnread(params.workspaceId);
      }
    },
    [settings.notificationsEnabled, settings.notificationSound, settings.notificationsWorkspaceUnread, markAsUnread]
  );

  return { handleTaskComplete, markAsRead };
}
