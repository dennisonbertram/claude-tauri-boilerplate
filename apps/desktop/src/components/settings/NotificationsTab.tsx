import { useState, useEffect } from 'react';
import type { AppSettings } from '@/hooks/useSettings';
import { playNotificationSound, requestNotificationPermission } from '@/lib/notifications';
import { SettingField } from '@/components/settings/SettingField';
import { ToggleSwitch } from '@/components/settings/ToggleSwitch';
import type { TabProps } from '@/components/settings/types';

export function NotificationsTab({ settings, updateSettings }: TabProps) {
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unknown'>('unknown');

  useEffect(() => {
    if (!window.Notification) {
      setPermissionState('denied');
      return;
    }
    setPermissionState(window.Notification.permission);
  }, []);

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission();
    setPermissionState(result);
  };

  return (
    <>
      {/* Permission status */}
      <SettingField
        label="Browser Permission"
        description="Desktop notifications require browser permission"
      >
        <div className="flex items-center gap-3">
          <span className={`text-sm ${
            permissionState === 'granted'
              ? 'text-green-400'
              : permissionState === 'denied'
                ? 'text-red-400'
                : 'text-muted-foreground'
          }`}>
            {permissionState === 'granted' && 'Granted'}
            {permissionState === 'denied' && 'Denied'}
            {(permissionState === 'default' || permissionState === 'unknown') && 'Not requested'}
          </span>
          {permissionState !== 'granted' && permissionState !== 'denied' && (
            <button
              data-testid="request-notification-permission-button"
              onClick={() => void handleRequestPermission()}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Request permission
            </button>
          )}
        </div>
      </SettingField>

      {/* Enable notifications */}
      <SettingField
        label="Desktop Notifications"
        description="Show a system notification when an agent task completes"
      >
        <ToggleSwitch
          data-testid="notifications-enabled-toggle"
          checked={settings.notificationsEnabled}
          onChange={(checked) => updateSettings({ notificationsEnabled: checked })}
        />
      </SettingField>

      {/* Sound */}
      <SettingField
        label="Notification Sound"
        description="Sound to play when a notification fires"
      >
        <div className="flex items-center gap-2">
          <select
            data-testid="notification-sound-select"
            value={settings.notificationSound}
            onChange={(e) =>
              updateSettings({
                notificationSound: e.target.value as AppSettings['notificationSound'],
              })
            }
            className="h-8 flex-1 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="none">None</option>
            <option value="beep">Beep</option>
            <option value="chime">Chime</option>
          </select>
          <button
            data-testid="test-notification-sound-button"
            onClick={() => playNotificationSound(settings.notificationSound)}
            disabled={settings.notificationSound === 'none'}
            className="h-8 shrink-0 rounded-lg border border-input px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Test
          </button>
        </div>
      </SettingField>

      {/* Workspace unread indicators */}
      <SettingField
        label="Workspace Unread Indicators"
        description="Show a dot on workspaces that have new activity while not focused"
      >
        <ToggleSwitch
          data-testid="notifications-workspace-unread-toggle"
          checked={settings.notificationsWorkspaceUnread}
          onChange={(checked) => updateSettings({ notificationsWorkspaceUnread: checked })}
        />
      </SettingField>
    </>
  );
}
