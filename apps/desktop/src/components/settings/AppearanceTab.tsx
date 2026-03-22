import type { AppSettings } from '@/hooks/useSettings';
import { SettingField } from '@/components/settings/SettingField';
import { ToggleSwitch } from '@/components/settings/ToggleSwitch';
import type { TabProps } from '@/components/settings/types';

export function AppearanceTab({ settings, updateSettings }: TabProps) {
  return (
    <>
      {/* Theme */}
      <SettingField label="Theme" description="Color scheme for the app">
        <select
          data-testid="theme-select"
          value={settings.theme}
          onChange={(e) =>
            updateSettings({
              theme: e.target.value as AppSettings['theme'],
            })
          }
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="system">System</option>
        </select>
      </SettingField>

      {/* Accent Color */}
      <SettingField
        label="Accent Color"
        description="Custom accent for buttons, rings, and highlights"
      >
        <select
          data-testid="accent-color-select"
          value={settings.accentColor}
          onChange={(e) =>
            updateSettings({
              accentColor: e.target.value as AppSettings['accentColor'],
            })
          }
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="slate">Slate</option>
          <option value="blue">Blue</option>
          <option value="emerald">Emerald</option>
          <option value="amber">Amber</option>
          <option value="rose">Rose</option>
        </select>
      </SettingField>

      {/* Font Size */}
      <SettingField
        label="Font Size"
        description={`Chat text size: ${settings.fontSize}px`}
      >
        <input
          data-testid="font-size-slider"
          type="range"
          min="10"
          max="24"
          step="1"
          value={settings.fontSize}
          onChange={(e) =>
            updateSettings({ fontSize: parseInt(e.target.value, 10) })
          }
          className="w-full accent-primary"
        />
      </SettingField>

      {/* Chat Font */}
      <SettingField
        label="Chat Font"
        description="Choose proportional or monospace chat text"
      >
        <select
          data-testid="chat-font-select"
          value={settings.chatFont}
          onChange={(e) =>
            updateSettings({
              chatFont: e.target.value as AppSettings['chatFont'],
            })
          }
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="proportional">Proportional</option>
          <option value="mono">Monospace</option>
        </select>
      </SettingField>

      <SettingField
        label="Monospace Family"
        description="Pick which monospace family powers chat when mono mode is enabled"
      >
        <select
          data-testid="mono-font-family-select"
          value={settings.monoFontFamily}
          onChange={(e) =>
            updateSettings({
              monoFontFamily: e.target.value as AppSettings['monoFontFamily'],
            })
          }
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="system">System Mono</option>
          <option value="menlo">Menlo</option>
          <option value="courier">Courier New</option>
        </select>
      </SettingField>

      {/* Chat Density */}
      <SettingField
        label="Chat Density"
        description="Adjust spacing between messages and controls"
      >
        <select
          data-testid="chat-density-select"
          value={settings.chatDensity}
          onChange={(e) =>
            updateSettings({
              chatDensity: e.target.value as AppSettings['chatDensity'],
            })
          }
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </select>
      </SettingField>

      <SettingField
        label="Tab Density"
        description="Control how compact the settings tabs appear"
      >
        <select
          data-testid="tab-density-select"
          value={settings.tabDensity}
          onChange={(e) =>
            updateSettings({
              tabDensity: e.target.value as AppSettings['tabDensity'],
            })
          }
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </select>
      </SettingField>

      {/* Chat Width */}
      <SettingField
        label="Chat Width"
        description="Set how wide chat messages and the composer may grow"
      >
        <select
          data-testid="chat-width-select"
          value={settings.chatWidth}
          onChange={(e) =>
            updateSettings({
              chatWidth: e.target.value as AppSettings['chatWidth'],
            })
          }
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="standard">Standard</option>
          <option value="wide">Wide</option>
          <option value="full">Full Width</option>
        </select>
      </SettingField>

      {/* Show Thinking */}
      <SettingField
        label="Show Thinking"
        description="Display Claude's thinking process"
      >
        <ToggleSwitch
          data-testid="show-thinking-toggle"
          checked={settings.showThinking}
          onChange={(checked) => updateSettings({ showThinking: checked })}
        />
      </SettingField>

      {/* Show Tool Calls */}
      <SettingField
        label="Show Tool Calls"
        description="Display tool call details"
      >
        <ToggleSwitch
          data-testid="show-tool-calls-toggle"
          checked={settings.showToolCalls}
          onChange={(checked) => updateSettings({ showToolCalls: checked })}
        />
      </SettingField>
    </>
  );
}
