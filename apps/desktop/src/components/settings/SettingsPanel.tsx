import { useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import type { AppSettings } from '@/hooks/useSettings';
import { InstructionsPanel } from '@/components/settings/InstructionsPanel';
import { MemoryPanel } from '@/components/settings/MemoryPanel';
import { McpPanel } from '@/components/settings/McpPanel';
import { HooksPanel } from '@/components/settings/HooksPanel';

type TabId = 'general' | 'model' | 'appearance' | 'instructions' | 'memory' | 'mcp' | 'hooks' | 'advanced';

const TABS: { id: TabId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'model', label: 'Model' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'instructions', label: 'Instructions' },
  { id: 'memory', label: 'Memory' },
  { id: 'mcp', label: 'MCP' },
  { id: 'hooks', label: 'Hooks' },
  { id: 'advanced', label: 'Advanced' },
];

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [showApiKey, setShowApiKey] = useState(false);
  const { settings, updateSettings } = useSettings();

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        data-testid="settings-overlay"
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-[420px] max-w-full flex-col border-l border-border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            data-testid="settings-close-button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {activeTab === 'general' && (
            <GeneralTab
              settings={settings}
              updateSettings={updateSettings}
              showApiKey={showApiKey}
              onToggleApiKey={() => setShowApiKey(!showApiKey)}
            />
          )}
          {activeTab === 'model' && (
            <ModelTab settings={settings} updateSettings={updateSettings} />
          )}
          {activeTab === 'appearance' && (
            <AppearanceTab
              settings={settings}
              updateSettings={updateSettings}
            />
          )}
          {activeTab === 'instructions' && <InstructionsPanel />}
          {activeTab === 'memory' && <MemoryPanel />}
          {activeTab === 'mcp' && <McpPanel />}
          {activeTab === 'hooks' && <HooksPanel />}
          {activeTab === 'advanced' && (
            <AdvancedTab settings={settings} updateSettings={updateSettings} />
          )}
        </div>
      </div>
    </>
  );
}

// ─── Tab Components ───

interface TabProps {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
}

function GeneralTab({
  settings,
  updateSettings,
  showApiKey,
  onToggleApiKey,
}: TabProps & { showApiKey: boolean; onToggleApiKey: () => void }) {
  return (
    <>
      {/* API Key */}
      <SettingField label="API Key" description="Your Anthropic API key">
        <div className="flex gap-2">
          <input
            data-testid="api-key-input"
            type={showApiKey ? 'text' : 'password'}
            value={settings.apiKey}
            onChange={(e) => updateSettings({ apiKey: e.target.value })}
            placeholder="sk-ant-..."
            className="h-8 flex-1 min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <button
            data-testid="api-key-toggle"
            onClick={onToggleApiKey}
            className="h-8 shrink-0 rounded-lg border border-input px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {showApiKey ? 'Hide' : 'Show'}
          </button>
        </div>
      </SettingField>

      {/* Model */}
      <SettingField label="Default Model" description="Claude model to use for new chats">
        <select
          data-testid="model-select"
          value={settings.model}
          onChange={(e) =>
            updateSettings({
              model: e.target.value as AppSettings['model'],
            })
          }
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="sonnet">Claude Sonnet</option>
          <option value="opus">Claude Opus</option>
          <option value="haiku">Claude Haiku</option>
        </select>
      </SettingField>

      {/* Max Tokens */}
      <SettingField
        label="Max Tokens"
        description={`Maximum output tokens: ${settings.maxTokens.toLocaleString()}`}
      >
        <input
          data-testid="max-tokens-slider"
          type="range"
          min="256"
          max="32768"
          step="256"
          value={settings.maxTokens}
          onChange={(e) =>
            updateSettings({ maxTokens: parseInt(e.target.value, 10) })
          }
          className="w-full accent-primary"
        />
      </SettingField>
    </>
  );
}

function ModelTab({ settings, updateSettings }: TabProps) {
  return (
    <>
      {/* Temperature */}
      <SettingField
        label="Temperature"
        description={`Controls randomness: ${settings.temperature.toFixed(1)}`}
      >
        <input
          data-testid="temperature-slider"
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={settings.temperature}
          onChange={(e) =>
            updateSettings({ temperature: parseFloat(e.target.value) })
          }
          className="w-full accent-primary"
        />
      </SettingField>

      {/* System Prompt */}
      <SettingField
        label="System Prompt"
        description="Custom instructions prepended to every chat"
      >
        <textarea
          data-testid="system-prompt-input"
          value={settings.systemPrompt}
          onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
          placeholder="You are a helpful assistant..."
          rows={4}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </SettingField>

      {/* Thinking Effort */}
      <SettingField
        label="Thinking Effort"
        description="Controls how much effort Claude puts into reasoning"
      >
        <select
          data-testid="effort-select"
          value={settings.effort}
          onChange={(e) =>
            updateSettings({
              effort: e.target.value as AppSettings['effort'],
            })
          }
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="max">Max</option>
        </select>
      </SettingField>
    </>
  );
}

function AppearanceTab({ settings, updateSettings }: TabProps) {
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

function AdvancedTab({ settings, updateSettings }: TabProps) {
  return (
    <>
      {/* Permission Mode */}
      <SettingField
        label="Permission Mode"
        description="How Claude handles actions that need approval"
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
    </>
  );
}

// ─── Shared UI Components ───

function SettingField({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <label className="text-sm font-medium text-foreground">{label}</label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  'data-testid': testId,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  'data-testid'?: string;
}) {
  return (
    <button
      data-testid={testId}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
        checked ? 'bg-primary' : 'bg-input'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
