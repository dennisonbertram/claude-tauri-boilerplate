import { useState, useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';
import type { AppSettings } from '@/hooks/useSettings';
import { InstructionsPanel } from '@/components/settings/InstructionsPanel';
import { MemoryPanel } from '@/components/settings/MemoryPanel';
import { McpPanel } from '@/components/settings/McpPanel';
import { HooksPanel } from '@/components/settings/HooksPanel';
import { LinearPanel } from '@/components/settings/LinearPanel';
import { GooglePanel } from '@/components/settings/GooglePanel';
import { GeneralTab } from '@/components/settings/GeneralTab';
import { GitTab } from '@/components/settings/GitTab';
import { ModelTab } from '@/components/settings/ModelTab';
import { WorkflowsTab } from '@/components/settings/WorkflowsTab';
import { AppearanceTab } from '@/components/settings/AppearanceTab';
import { NotificationsTab } from '@/components/settings/NotificationsTab';
import { AdvancedTab } from '@/components/settings/AdvancedTab';
import { StatusTab } from '@/components/settings/StatusTab';

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
  | 'google'
  | 'hooks'
  | 'advanced'
  | 'status';

type GroupId = 'general' | 'ai-model' | 'data-context' | 'integrations' | 'status';
type GeneralTabId = 'general' | 'appearance' | 'notifications';

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
      { id: 'google', label: 'Google' },
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
    google: 'integrations',
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
  const [activeGeneralTab, setActiveGeneralTab] = useState<GeneralTabId>(
    initialTab && tabToGroup(initialTab) === 'general'
      ? (initialTab as GeneralTabId)
      : 'general'
  );

  useEffect(() => {
    if (isOpen) {
      const nextGroup = initialTab ? tabToGroup(initialTab) : 'general';
      setActiveGroup(nextGroup);
      if (nextGroup === 'general') {
        setActiveGeneralTab(initialTab ? (initialTab as GeneralTabId) : 'general');
      }
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
            aria-label="Close settings"
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
            {currentGroup.id === 'general' ? (
              <>
                <div
                  className="rounded-lg border border-border bg-background p-1"
                  role="tablist"
                  aria-label="General settings subsections"
                >
                  <div className="grid grid-cols-3 gap-1">
                    {currentGroup.tabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={activeGeneralTab === tab.id}
                        aria-controls={`general-subsection-panel-${tab.id}`}
                        onClick={() => setActiveGeneralTab(tab.id as GeneralTabId)}
                        className={`h-8 rounded-md px-3 text-xs font-medium transition-colors sm:text-sm ${
                          activeGeneralTab === tab.id
                            ? 'bg-accent text-foreground'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {currentGroup.tabs.map(
                  (tab) =>
                    tab.id === activeGeneralTab && (
                      <section
                        key={tab.id}
                        id={`general-subsection-panel-${tab.id}`}
                        role="tabpanel"
                        aria-labelledby={`general-subsection-${tab.id}`}
                        className="space-y-6"
                      >
                        <h3
                          id={`general-subsection-${tab.id}`}
                          className="text-sm font-semibold text-foreground"
                        >
                          {tab.label}
                        </h3>
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
                      </section>
                    )
                )}
              </>
            ) : (
              currentGroup.tabs.map((tab, idx) => (
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
              ))
            )}
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
    case 'google':
      return <GooglePanel />;
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
