import { SettingField } from '@/components/settings/SettingField';
import type { TabProps } from '@/components/settings/types';

export function GitTab({ settings, updateSettings }: TabProps) {
  return (
    <SettingField
      label="Workspace Branch Prefix"
      description="Prefix used when creating new workspace branches"
    >
      <input
        data-testid="workspace-branch-prefix-input"
        type="text"
        value={settings.workspaceBranchPrefix}
        onChange={(e) =>
          updateSettings({ workspaceBranchPrefix: e.target.value.trim() })
        }
        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        placeholder="workspace"
      />
    </SettingField>
  );
}
