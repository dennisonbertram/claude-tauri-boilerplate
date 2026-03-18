import { useState, useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';
import type { AppSettings } from '@/hooks/useSettings';
import { AVAILABLE_MODELS } from '@/lib/models';
import {
  DEFAULT_WORKFLOW_PROMPTS,
  saveRepoWorkflowPrompts,
} from '@/lib/workflowPrompts';
import { InstructionsPanel } from '@/components/settings/InstructionsPanel';
import { MemoryPanel } from '@/components/settings/MemoryPanel';
import { McpPanel } from '@/components/settings/McpPanel';
import { HooksPanel } from '@/components/settings/HooksPanel';
import { LinearPanel } from '@/components/settings/LinearPanel';

type TabId =
  | 'general'
  | 'git'
  | 'model'
  | 'workflows'
  | 'appearance'
  | 'instructions'
  | 'memory'
  | 'mcp'
  | 'linear'
  | 'hooks'
  | 'advanced'
  | 'status';

const TABS: { id: TabId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'git', label: 'Git' },
  { id: 'model', label: 'Model' },
  { id: 'workflows', label: 'Workflows' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'instructions', label: 'Instructions' },
  { id: 'memory', label: 'Memory' },
  { id: 'mcp', label: 'MCP' },
  { id: 'linear', label: 'Linear' },
  { id: 'hooks', label: 'Hooks' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'status', label: 'Status' },
];

export interface SessionRuntimeInfo {
  sessionId: string;
  model: string;
  tools: string[];
  mcpServers: Array<{ name: string; status: string }>;
  claudeCodeVersion: string;
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sessionInfo?: SessionRuntimeInfo;
  email?: string;
  plan?: string;
  initialTab?: TabId;
}

export function SettingsPanel({ isOpen, onClose, sessionInfo, email, plan, initialTab }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? 'general');

  useEffect(() => {
    if (isOpen) setActiveTab(initialTab ?? 'general');
  }, [isOpen, initialTab]);
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
        <div className="flex flex-wrap border-b border-border" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
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
          {activeTab === 'git' && (
            <GitTab settings={settings} updateSettings={updateSettings} />
          )}
          {activeTab === 'model' && (
            <ModelTab settings={settings} updateSettings={updateSettings} />
          )}
          {activeTab === 'workflows' && (
            <WorkflowsTab settings={settings} updateSettings={updateSettings} />
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
          {activeTab === 'linear' && <LinearPanel />}
          {activeTab === 'hooks' && <HooksPanel />}
          {activeTab === 'advanced' && (
            <AdvancedTab settings={settings} updateSettings={updateSettings} />
          )}
          {activeTab === 'status' && (
            <StatusTab
              sessionInfo={sessionInfo}
              email={email}
              plan={plan}
              settings={settings}
              updateSettings={updateSettings}
            />
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
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');

  const runtimeEnvEntries = Object.entries(settings.runtimeEnv);

  const handleAddRuntimeEnv = () => {
    const key = newEnvKey.trim();
    if (!key) return;
    if (settings.runtimeEnv[key] !== undefined) return;

    updateSettings({
      runtimeEnv: {
        ...settings.runtimeEnv,
        [key]: newEnvValue,
      },
    });
    setNewEnvKey('');
    setNewEnvValue('');
  };

  const handleRuntimeEnvValueChange = (key: string, value: string) => {
    updateSettings({
      runtimeEnv: {
        ...settings.runtimeEnv,
        [key]: value,
      },
    });
  };

  const handleRemoveRuntimeEnv = (key: string) => {
    const next = { ...settings.runtimeEnv };
    delete next[key];
    updateSettings({
      runtimeEnv: next,
    });
  };

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

      {/* Provider */}
      <SettingField label="Provider" description="Routing backend to Anthropic, Bedrock, Vertex, or custom provider">
        <select
          data-testid="provider-select"
          value={settings.provider}
          onChange={(e) =>
            updateSettings({
              provider: e.target.value as AppSettings['provider'],
            })
          }
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="anthropic">Anthropic</option>
          <option value="bedrock">AWS Bedrock</option>
          <option value="vertex">Google Vertex</option>
          <option value="custom">Custom Base URL</option>
        </select>
      </SettingField>

      {settings.provider === 'bedrock' && (
        <>
          <SettingField
            label="Bedrock Base URL"
            description="Optional Bedrock endpoint override"
          >
            <input
              data-testid="provider-bedrock-base-url"
              type="text"
              value={settings.bedrockBaseUrl}
              onChange={(e) =>
                updateSettings({ bedrockBaseUrl: e.target.value })
              }
              placeholder="https://bedrock.example.com"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </SettingField>
          <SettingField
            label="Bedrock Project ID"
            description="Optional Bedrock project identifier"
          >
            <input
              data-testid="provider-bedrock-project-id"
              type="text"
              value={settings.bedrockProjectId}
              onChange={(e) =>
                updateSettings({ bedrockProjectId: e.target.value })
              }
              placeholder="project-id"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </SettingField>
        </>
      )}

      {settings.provider === 'vertex' && (
        <>
          <SettingField
            label="Vertex Project ID"
            description="Google Cloud project ID"
          >
            <input
              data-testid="provider-vertex-project-id"
              type="text"
              value={settings.vertexProjectId}
              onChange={(e) =>
                updateSettings({ vertexProjectId: e.target.value })
              }
              placeholder="project-id"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </SettingField>
          <SettingField
            label="Vertex Base URL"
            description="Optional Vertex endpoint override"
          >
            <input
              data-testid="provider-vertex-base-url"
              type="text"
              value={settings.vertexBaseUrl}
              onChange={(e) =>
                updateSettings({ vertexBaseUrl: e.target.value })
              }
              placeholder="https://us-central1-aiplatform.googleapis.com"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </SettingField>
        </>
      )}

      {settings.provider === 'custom' && (
        <SettingField
          label="Custom Base URL"
          description="Override Claude API base URL"
        >
          <input
            data-testid="provider-custom-base-url"
            type="text"
            value={settings.customBaseUrl}
            onChange={(e) => updateSettings({ customBaseUrl: e.target.value })}
            placeholder="https://gateway.example.com/v1"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </SettingField>
      )}

      {/* Runtime Environment Variables */}
      <SettingField
        label="Runtime Environment Variables"
        description="Inject environment variables for the Claude process"
      >
        <div className="space-y-2">
          {runtimeEnvEntries.length > 0 ? (
            <div className="space-y-2">
              {runtimeEnvEntries.map(([key, value]) => (
                <div key={key} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input
                    value={key}
                    readOnly
                    className="h-8 rounded-lg border border-input bg-background/50 px-2.5 py-1 text-sm text-muted-foreground"
                  />
                  <input
                    data-testid={`runtime-env-value-${key}`}
                    type="text"
                    value={value}
                    onChange={(e) =>
                      handleRuntimeEnvValueChange(key, e.target.value)
                    }
                    className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                  <button
                    data-testid={`runtime-env-remove-${key}`}
                    onClick={() => handleRemoveRuntimeEnv(key)}
                    className="rounded-lg border border-input px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No runtime variables configured.</p>
          )}

          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 pt-1">
            <input
              data-testid="runtime-env-key-input"
              type="text"
              value={newEnvKey}
              onChange={(e) => setNewEnvKey(e.target.value)}
              placeholder="VARIABLE_NAME"
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <input
              data-testid="runtime-env-value-input"
              type="text"
              value={newEnvValue}
              onChange={(e) => setNewEnvValue(e.target.value)}
              placeholder="value"
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <button
              data-testid="runtime-env-add-button"
              onClick={handleAddRuntimeEnv}
              type="button"
              className="rounded-lg bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </SettingField>
    </>
  );
}

function GitTab({ settings, updateSettings }: TabProps) {
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

function ModelTab({ settings, updateSettings }: TabProps) {
  return (
    <>
      {/* Model */}
      <SettingField label="Model" description="AI model to use for conversations">
        <select
          data-testid="model-select"
          value={settings.model}
          onChange={(e) => updateSettings({ model: e.target.value })}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {AVAILABLE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
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

function WorkflowsTab({ settings, updateSettings }: TabProps) {
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async (workflowPrompts: AppSettings['workflowPrompts']) => {
    setSaveState('saving');
    setSaveError(null);
    try {
      await saveRepoWorkflowPrompts(workflowPrompts);
      setSaveState('saved');
    } catch (error) {
      setSaveState('error');
      setSaveError(error instanceof Error ? error.message : 'Failed to save repository prompts');
    }
  };

  return (
    <>
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
        <div className="text-sm font-medium text-foreground">Repository-scoped workflow prompts</div>
        <div className="mt-1 text-xs text-muted-foreground">
          These prompts override the defaults for this repository only and power
          the `/review`, `/pr`, and `/branch` workflows.
        </div>
      </div>

      <SettingField
        label="Review Prompt"
        description="Prompt template used by /review"
      >
        <textarea
          data-testid="workflow-review-prompt"
          value={settings.workflowPrompts.review}
          onChange={(e) =>
            updateSettings({
              workflowPrompts: {
                ...settings.workflowPrompts,
                review: e.target.value,
              },
            })
          }
          rows={8}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </SettingField>

      <SettingField
        label="PR Prompt"
        description="Prompt template used by /pr"
      >
        <textarea
          data-testid="workflow-pr-prompt"
          value={settings.workflowPrompts.pr}
          onChange={(e) =>
            updateSettings({
              workflowPrompts: {
                ...settings.workflowPrompts,
                pr: e.target.value,
              },
            })
          }
          rows={8}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </SettingField>

      <SettingField
        label="Branch Naming Prompt"
        description="Prompt template used by /branch"
      >
        <textarea
          data-testid="workflow-branch-prompt"
          value={settings.workflowPrompts.branch}
          onChange={(e) =>
            updateSettings({
              workflowPrompts: {
                ...settings.workflowPrompts,
                branch: e.target.value,
              },
            })
          }
          rows={6}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </SettingField>

      <div className="flex items-center justify-between gap-3">
        <div
          data-testid="workflow-prompts-status"
          className={`text-xs ${
            saveState === 'error'
              ? 'text-red-400'
              : saveState === 'saved'
                ? 'text-green-400'
                : 'text-muted-foreground'
          }`}
        >
          {saveState === 'saving' && 'Saving repository prompts...'}
          {saveState === 'saved' && 'Repository prompts saved.'}
          {saveState === 'error' && (saveError ?? 'Failed to save repository prompts')}
          {saveState === 'idle' &&
            'Defaults are used when a repository override is empty or removed.'}
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="workflow-prompts-reset"
            onClick={() => {
              const workflowPrompts = { ...DEFAULT_WORKFLOW_PROMPTS };
              updateSettings({ workflowPrompts });
              void handleSave(workflowPrompts);
            }}
            className="rounded-lg border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            Use defaults
          </button>
          <button
            data-testid="workflow-prompts-save"
            onClick={() => void handleSave(settings.workflowPrompts)}
            disabled={saveState === 'saving'}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saveState === 'saving' ? 'Saving...' : 'Save to repository'}
          </button>
        </div>
      </div>
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

// ─── Status Tab ───

function StatusTab({
  sessionInfo,
  email,
  plan,
  settings,
  updateSettings,
}: {
  sessionInfo?: SessionRuntimeInfo | null;
  email?: string;
  plan?: string;
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
}) {
  return (
    <>
      {/* Diagnostics */}
      <SettingField
        label="Diagnostics"
        description="Show CPU and memory usage in the status bar."
      >
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-foreground">Show Resource Usage</div>
            <div className="text-xs text-muted-foreground">
              Poll the local diagnostics endpoint while the status bar is visible.
            </div>
          </div>
          <ToggleSwitch
            data-testid="show-resource-usage-toggle"
            checked={settings.showResourceUsage}
            onChange={(checked) => updateSettings({ showResourceUsage: checked })}
          />
        </div>
      </SettingField>

      {/* Account */}
      <SettingField label="Account" description="Your Claude subscription info">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-mono">{email || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plan</span>
            <span className="capitalize">{plan || 'Unknown'}</span>
          </div>
        </div>
      </SettingField>

      {/* Session Info */}
      <SettingField label="Session" description="Current chat session details">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Model</span>
            <span className="font-mono">{sessionInfo?.model || 'No active session'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Version</span>
            <span className="font-mono">{sessionInfo?.claudeCodeVersion || '\u2014'}</span>
          </div>
          {sessionInfo?.sessionId && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Session ID</span>
              <span className="font-mono text-xs truncate max-w-[200px]" title={sessionInfo.sessionId}>
                {sessionInfo.sessionId}
              </span>
            </div>
          )}
        </div>
      </SettingField>

      {/* MCP Servers */}
      <SettingField label="MCP Servers" description="Connected Model Context Protocol servers">
        {sessionInfo?.mcpServers && sessionInfo.mcpServers.length > 0 ? (
          <div className="space-y-1">
            {sessionInfo.mcpServers.map((server) => (
              <div key={server.name} className="flex items-center justify-between text-sm">
                <span className="font-mono">{server.name}</span>
                <span className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      server.status === 'connected'
                        ? 'bg-green-500'
                        : server.status === 'error'
                          ? 'bg-red-500'
                          : 'bg-yellow-500'
                    }`}
                  />
                  <span className="text-xs text-muted-foreground">{server.status}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No MCP servers connected</p>
        )}
      </SettingField>

      {/* Tools */}
      <SettingField
        label="Available Tools"
        description={`${sessionInfo?.tools?.length ?? 0} tools available`}
      >
        {sessionInfo?.tools && sessionInfo.tools.length > 0 ? (
          <div className="max-h-48 overflow-y-auto rounded-md border border-input p-2 space-y-0.5">
            {sessionInfo.tools.map((tool) => (
              <div key={tool} className="text-xs font-mono text-muted-foreground">
                {tool}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active session</p>
        )}
      </SettingField>
    </>
  );
}
