import type { AppSettings } from '@/hooks/useSettings';
import { SettingField } from '@/components/settings/SettingField';
import { ToggleSwitch } from '@/components/settings/ToggleSwitch';
import type { TabProps } from '@/components/settings/types';

export function AdvancedTab({ settings, updateSettings }: TabProps) {
  return (
    <>
      {/* Permission Mode */}
      <SettingField
        label="Permission Mode"
        description="Global default for how Claude handles actions that need approval. Profile settings can override this value."
      >
        <select
          data-testid="permission-mode-select"
          value={settings.permissionMode}
          onChange={(e) =>
            updateSettings({
              permissionMode: e.target
                .value as AppSettings['permissionMode'],
            })
          }
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="default">Default</option>
          <option value="acceptEdits">Accept Edits</option>
          <option value="plan">Plan</option>
          <option value="bypassPermissions">Bypass Permissions</option>
        </select>
      </SettingField>

      {/* Auto-Compact */}
      <SettingField
        label="Auto-Compact"
        description="Automatically compact conversation when context is large"
      >
        <ToggleSwitch
          data-testid="auto-compact-toggle"
          checked={settings.autoCompact}
          onChange={(checked) => updateSettings({ autoCompact: checked })}
        />
      </SettingField>

      {/* Max Turns */}
      <SettingField
        label="Max Turns"
        description="Maximum agentic round trips per request"
      >
        <input
          data-testid="max-turns-input"
          type="number"
          min="1"
          max="100"
          value={settings.maxTurns}
          onChange={(e) => {
            const value = parseInt(e.target.value, 10);
            if (!isNaN(value) && value >= 1 && value <= 100) {
              updateSettings({ maxTurns: value });
            }
          }}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </SettingField>

      {/* Enterprise Privacy Mode */}
      <SettingField
        label="Enterprise Privacy Mode"
        description="Disables AI-generated session titles and chat summaries. All processing stays within your configured provider."
      >
        <ToggleSwitch
          data-testid="privacy-mode-toggle"
          checked={settings.privacyMode}
          onChange={(checked) => updateSettings({ privacyMode: checked })}
        />
      </SettingField>
    </>
  );
}
