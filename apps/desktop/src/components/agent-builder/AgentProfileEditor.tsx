import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AgentProfile, UpdateAgentProfileRequest } from '@claude-tauri/shared';
import { Button } from '@/components/ui/button';
import { GeneralTab } from './tabs/GeneralTab';
import { PromptTab } from './tabs/PromptTab';
import { ModelTab } from './tabs/ModelTab';
import { ToolsTab } from './tabs/ToolsTab';
import { HooksTab } from './tabs/HooksTab';
import { McpTab } from './tabs/McpTab';
import { SandboxTab } from './tabs/SandboxTab';
import { AdvancedTab } from './tabs/AdvancedTab';

type TabId =
  | 'general'
  | 'prompt'
  | 'model'
  | 'tools'
  | 'hooks'
  | 'mcp'
  | 'sandbox'
  | 'advanced';

const TABS: { id: TabId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'prompt', label: 'Prompt' },
  { id: 'model', label: 'Model' },
  { id: 'tools', label: 'Tools' },
  { id: 'hooks', label: 'Hooks' },
  { id: 'mcp', label: 'MCP' },
  { id: 'sandbox', label: 'Sandbox' },
  { id: 'advanced', label: 'Advanced' },
];

interface AgentProfileEditorProps {
  profile: AgentProfile;
  onSave: (updates: UpdateAgentProfileRequest) => Promise<AgentProfile>;
  onDelete: () => Promise<void>;
}

/** Build a draft from a profile, extracting only editable fields. */
function profileToDraft(profile: AgentProfile): UpdateAgentProfileRequest {
  return {
    name: profile.name,
    description: profile.description ?? '',
    icon: profile.icon ?? '',
    color: profile.color ?? '#6b7280',
    isDefault: profile.isDefault ?? false,
    sortOrder: profile.sortOrder ?? 0,
    systemPrompt: profile.systemPrompt ?? '',
    useClaudeCodePrompt: profile.useClaudeCodePrompt ?? true,
    settingSources: profile.settingSources ?? [],
    model: profile.model ?? '',
    effort: profile.effort ?? 'medium',
    thinkingBudgetTokens: profile.thinkingBudgetTokens ?? 10000,
    permissionMode: profile.permissionMode ?? 'default',
    allowedTools: profile.allowedTools ?? [],
    disallowedTools: profile.disallowedTools ?? [],
    hooksJson: profile.hooksJson ?? '',
    mcpServersJson: profile.mcpServersJson ?? '',
    sandboxJson: profile.sandboxJson ?? '',
    agentsJson: profile.agentsJson ?? '',
    cwd: profile.cwd ?? '',
    additionalDirectories: profile.additionalDirectories ?? [],
    maxTurns: profile.maxTurns ?? 0,
    maxBudgetUsd: profile.maxBudgetUsd ?? 0,
  };
}

export function AgentProfileEditor({
  profile,
  onSave,
  onDelete,
}: AgentProfileEditorProps) {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [draft, setDraft] = useState<UpdateAgentProfileRequest>(() =>
    profileToDraft(profile)
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset draft when the profile changes (different profile selected)
  useEffect(() => {
    setDraft(profileToDraft(profile));
    setConfirmDelete(false);
  }, [profile.id]);

  // Check for unsaved changes
  const hasChanges = useMemo(() => {
    const original = profileToDraft(profile);
    return JSON.stringify(draft) !== JSON.stringify(original);
  }, [draft, profile]);

  const handleChange = useCallback(
    (updates: Partial<UpdateAgentProfileRequest>) => {
      setDraft((prev: UpdateAgentProfileRequest) => ({ ...prev, ...updates }));
    },
    []
  );

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      await onSave(draft);
    } catch (err) {
      // Error handling is managed by the parent
      console.error('Failed to save profile:', err);
    } finally {
      setSaving(false);
    }
  }, [draft, onSave]);

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await onDelete();
    setConfirmDelete(false);
  }, [confirmDelete, onDelete]);

  return (
    <div className="flex h-full flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg" aria-hidden="true">
            {draft.icon || '🤖'}
          </span>
          <h2 className="text-sm font-semibold text-foreground truncate">
            {draft.name || 'Untitled Profile'}
          </h2>
          {hasChanges && (
            <span
              className="shrink-0 h-2 w-2 rounded-full bg-amber-500"
              title="Unsaved changes"
            />
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
          >
            {confirmDelete ? 'Confirm Delete' : 'Delete'}
          </Button>
        </div>
      </div>

      {/* Tab bar (horizontally scrollable) */}
      <div
        className="flex border-b border-border overflow-x-auto scrollbar-none"
        role="tablist"
      >
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

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeTab === 'general' && (
          <GeneralTab draft={draft} onChange={handleChange} />
        )}
        {activeTab === 'prompt' && (
          <PromptTab draft={draft} onChange={handleChange} />
        )}
        {activeTab === 'model' && (
          <ModelTab draft={draft} onChange={handleChange} />
        )}
        {activeTab === 'tools' && (
          <ToolsTab draft={draft} onChange={handleChange} />
        )}
        {activeTab === 'hooks' && (
          <HooksTab draft={draft} onChange={handleChange} profileId={profile.id} />
        )}
        {activeTab === 'mcp' && (
          <McpTab draft={draft} onChange={handleChange} />
        )}
        {activeTab === 'sandbox' && (
          <SandboxTab draft={draft} onChange={handleChange} />
        )}
        {activeTab === 'advanced' && (
          <AdvancedTab draft={draft} onChange={handleChange} />
        )}
      </div>
    </div>
  );
}
