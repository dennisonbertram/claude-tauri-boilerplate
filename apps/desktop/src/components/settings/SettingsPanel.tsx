import { useState, useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';
import type { AppSettings } from '@/hooks/useSettings';
import { playNotificationSound, requestNotificationPermission } from '@/lib/notifications';
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
import {
  PROVIDER_CAPABILITY_LIST,
  getProviderSettingsFields,
  type ProviderConfigFieldKey,
} from '@claude-tauri/shared';
import { IDE_CONFIGS, type IdeId } from '@/lib/ide-opener';

const MIN_THINKING_BUDGET_TOKENS = 1024;
const MAX_THINKING_BUDGET_TOKENS = 32000;

type TabId =
  | 'general'
  | 'git'
  | 'model'
  | 'workflows'
  | 'appearance'
  | 'notifications'
  | 'instructions'
  | 'memory'
  | 'mcp'
  | 'linear'
  | 'hooks'
  | 'advanced'
  | 'status';

type GroupId = 'general' | 'ai-model' | 'data-context' | 'integrations' | 'status';

interface SettingsGroup {
  id: GroupId;
  label: string;
  tabs: { id: TabId; label: string }[];
}

const GROUPS: SettingsGroup[] = [
  {
    id: 'general',
    label: 'General',
    tabs: [
      { id: 'general', label: 'General' },
      { id: 'appearance', label: 'Appearance' },
      { id: 'notifications', label: 'Notifications' },
    ],
  },
  {
    id: 'ai-model',
    label: 'AI & Model',
    tabs: [
      { id: 'model', label: 'Model' },
      { id: 'advanced', label: 'Advanced' },
      { id: 'workflows', label: 'Workflows' },
    ],
  },
  {
    id: 'data-context',
    label: 'Data & Context',
    tabs: [
      { id: 'instructions', label: 'Instructions' },
      { id: 'memory', label: 'Memory' },
      { id: 'mcp', label: 'MCP' },
      { id: 'hooks', label: 'Hooks' },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    tabs: [
      { id: 'git', label: 'Git' },
      { id: 'linear', label: 'Linear' },
    ],
  },
  {
    id: 'status',
    label: 'Status',
    tabs: [
      { id: 'status', label: 'Status' },
    ],
  },
];

/** Map a legacy TabId (used by deep-link callers) to a GroupId */
function tabToGroup(tabId: string): GroupId {
  const mapping: Record<string, GroupId> = {
    general: 'general',
    appearance: 'general',
    notifications: 'general',
    model: 'ai-model',
    advanced: 'ai-model',
    workflows: 'ai-model',
    instructions: 'data-context',
    memory: 'data-context',
    mcp: 'data-context',
    hooks: 'data-context',
    git: 'integrations',
    linear: 'integrations',
    status: 'status',
  };
  return mapping[tabId] ?? 'general';
}

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
  const [activeGroup, setActiveGroup] = useState<GroupId>(
    initialTab ? tabToGroup(initialTab) : 'general'
  );

  useEffect(() => {
    if (isOpen) setActiveGroup(initialTab ? tabToGroup(initialTab) : 'general');
  }, [isOpen, initialTab]);
  const [showApiKey, setShowApiKey] = useState(false);
  const { settings, updateSettings } = useSettings();

  if (!isOpen) return null;

  const currentGroup = GROUPS.find((g) => g.id === activeGroup) ?? GROUPS[0];

  return (
    <>
      {/* Overlay */}
      <div
        data-testid="settings-overlay"
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-[560px] max-w-[90vw] flex-col border-l border-border bg-background shadow-xl overflow-hidden">
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

        {/* Sidebar + Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar */}
          <nav className="w-[180px] shrink-0 border-r border-border py-2 overflow-y-auto" role="tablist">
            {GROUPS.map((group) => (
              <button
                key={group.id}
                role="tab"
                aria-selected={activeGroup === group.id}
                onClick={() => setActiveGroup(group.id)}
                className={`w-full px-4 py-2 text-left text-sm font-medium transition-colors ${
                  activeGroup === group.id
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                {group.label}
              </button>
            ))}
          </nav>

          {/* Right content area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {currentGroup.tabs.map((tab, idx) => (
              <div key={tab.id}>
                {idx > 0 && <hr className="border-border mb-6" />}
                <h3 className="text-sm font-semibold text-foreground mb-4">{tab.label}</h3>
                <div className="space-y-6">
                  <TabContent
                    tabId={tab.id}
                    settings={settings}
                    updateSettings={updateSettings}
                    showApiKey={showApiKey}
                    onToggleApiKey={() => setShowApiKey(!showApiKey)}
                    sessionInfo={sessionInfo}
                    email={email}
                    plan={plan}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Tab Content Router ───

function TabContent({
  tabId,
  settings,
  updateSettings,
  showApiKey,
  onToggleApiKey,
  sessionInfo,
  email,
  plan,
}: {
  tabId: TabId;
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  showApiKey: boolean;
  onToggleApiKey: () => void;
  sessionInfo?: SessionRuntimeInfo;
  email?: string;
  plan?: string;
}) {
  switch (tabId) {
    case 'general':
      return <GeneralTab settings={settings} updateSettings={updateSettings} showApiKey={showApiKey} onToggleApiKey={onToggleApiKey} />;
    case 'git':
      return <GitTab settings={settings} updateSettings={updateSettings} />;
    case 'model':
      return <ModelTab settings={settings} updateSettings={updateSettings} />;
    case 'workflows':
      return <WorkflowsTab settings={settings} updateSettings={updateSettings} />;
    case 'appearance':
      return <AppearanceTab settings={settings} updateSettings={updateSettings} />;
    case 'notifications':
      return <NotificationsTab settings={settings} updateSettings={updateSettings} />;
    case 'instructions':
      return <InstructionsPanel />;
    case 'memory':
      return <MemoryPanel />;
    case 'mcp':
      return <McpPanel />;
    case 'linear':
      return <LinearPanel />;
    case 'hooks':
      return <HooksPanel />;
    case 'advanced':
      return <AdvancedTab settings={settings} updateSettings={updateSettings} />;
    case 'status':
      return <StatusTab sessionInfo={sessionInfo} email={email} plan={plan} settings={settings} updateSettings={updateSettings} />;
    default:
      return null;
  }
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
  const providerFields = getProviderSettingsFields(settings.provider);

  const updateProviderField = (key: ProviderConfigFieldKey, value: string) => {
    updateSettings({
      [key]: value,
    } as Pick<AppSettings, ProviderConfigFieldKey>);
  };

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
          {PROVIDER_CAPABILITY_LIST.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
        </select>
      </SettingField>

      {providerFields.map((field) => (
        <SettingField
          key={field.key}
          label={field.label}
          description={field.description}
        >
          <input
            data-testid={`provider-${field.key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`}
            type="text"
            value={settings[field.key]}
            onChange={(e) => updateProviderField(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </SettingField>
      ))}

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

      {/* Preferred IDE */}
      <SettingField
        label="Preferred IDE"
        description="IDE used by the 'Open In' button on workspaces"
      >
        <select
          data-testid="preferred-ide-select"
          value={settings.preferredIde}
          onChange={(e) =>
            updateSettings({ preferredIde: e.target.value as IdeId })
          }
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {(Object.entries(IDE_CONFIGS) as [IdeId, { label: string }][]).map(
            ([id, config]) => (
              <option key={id} value={id}>
                {config.label}
              </option>
            )
          )}
        </select>
      </SettingField>

      {/* Custom IDE URL — only shown when custom is selected */}
      {settings.preferredIde === 'custom' && (
        <SettingField
          label="Custom IDE URL"
          description="URL template with {path} as the path placeholder, e.g. myide://open?path={path}"
        >
          <input
            data-testid="custom-ide-url-input"
            type="text"
            value={settings.customIdeUrl}
            onChange={(e) => updateSettings({ customIdeUrl: e.target.value })}
            placeholder="myide://open?path={path}"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </SettingField>
      )}
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

      <SettingField
        label="Thinking Budget"
        description={`Maximum thinking tokens: ${settings.thinkingBudgetTokens.toLocaleString()}`}
      >
        <input
          data-testid="thinking-budget-input"
          type="number"
          min={MIN_THINKING_BUDGET_TOKENS}
          max={MAX_THINKING_BUDGET_TOKENS}
          step="1024"
          value={settings.thinkingBudgetTokens}
          onChange={(e) => {
            const parsed = parseInt(e.target.value, 10);
            if (Number.isNaN(parsed)) return;
            updateSettings({
              thinkingBudgetTokens: Math.min(
                MAX_THINKING_BUDGET_TOKENS,
                Math.max(MIN_THINKING_BUDGET_TOKENS, parsed)
              ),
            });
          }}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
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
          the `/review`, `/pr`, `/branch`, and `/browser` workflows.
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

      <SettingField
        label="Browser Testing Prompt"
        description="Prompt template used by /browser"
      >
        <textarea
          data-testid="workflow-browser-prompt"
          value={settings.workflowPrompts.browser}
          onChange={(e) =>
            updateSettings({
              workflowPrompts: {
                ...settings.workflowPrompts,
                browser: e.target.value,
              },
            })
          }
          rows={10}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </SettingField>

      <SettingField
        label="Review Memory Prompt"
        description="Draft template used when durable review feedback should become repository memory"
      >
        <textarea
          data-testid="workflow-review-memory-prompt"
          value={settings.workflowPrompts.reviewMemory}
          onChange={(e) =>
            updateSettings({
              workflowPrompts: {
                ...settings.workflowPrompts,
                reviewMemory: e.target.value,
              },
            })
          }
          rows={6}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </SettingField>

      <SettingField
        label="Merge Memory Prompt"
        description="Draft template used after a merge when lasting guidance should be recorded"
      >
        <textarea
          data-testid="workflow-merge-memory-prompt"
          value={settings.workflowPrompts.mergeMemory}
          onChange={(e) =>
            updateSettings({
              workflowPrompts: {
                ...settings.workflowPrompts,
                mergeMemory: e.target.value,
              },
            })
          }
          rows={6}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </SettingField>

      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 mt-2">
        <div className="text-sm font-medium text-foreground">AI Code Review</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Configure the model, effort level, and prompt for inline diff reviews.
        </div>
      </div>

      <SettingField
        label="Code Review Model"
        description="Model used for AI-powered inline diff reviews"
      >
        <select
          data-testid="code-review-model-select"
          value={settings.codeReviewModel}
          onChange={(e) => updateSettings({ codeReviewModel: e.target.value })}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {AVAILABLE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </SettingField>

      <SettingField
        label="Code Review Effort"
        description="Thinking effort level for AI code reviews"
      >
        <select
          data-testid="code-review-effort-select"
          value={settings.codeReviewEffort}
          onChange={(e) =>
            updateSettings({
              codeReviewEffort: e.target.value as AppSettings['codeReviewEffort'],
            })
          }
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="low">Low (fast, less thorough)</option>
          <option value="medium">Medium</option>
          <option value="high">High (slower, more thorough)</option>
          <option value="max">Max (extended thinking)</option>
        </select>
      </SettingField>

      <SettingField
        label="Code Review Prompt"
        description="System prompt for AI diff reviews. Must instruct Claude to output JSON."
      >
        <textarea
          data-testid="workflow-code-review-prompt"
          value={settings.workflowPrompts.codeReview}
          onChange={(e) =>
            updateSettings({
              workflowPrompts: {
                ...settings.workflowPrompts,
                codeReview: e.target.value,
              },
            })
          }
          rows={10}
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

// ─── Notifications Tab ───

function NotificationsTab({ settings, updateSettings }: TabProps) {
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
