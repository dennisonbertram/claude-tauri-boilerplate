import { useSettingsContext } from '@/contexts/SettingsContext';
import { DEFAULT_WORKFLOW_PROMPTS, type WorkflowPrompts } from '@/lib/workflowPrompts';
import type { ProviderType } from '@claude-tauri/shared';
import { DEFAULT_PROVIDER_CONFIG } from '@claude-tauri/shared';
import type { IdeId } from '@/lib/ide-opener';
import {
  getCredential,
  setCredential,
  CredentialKeys,
} from '@/services/secure-credentials';

export interface AppSettings {
  // Provider
  provider: ProviderType;
  bedrockBaseUrl: string;
  bedrockProjectId: string;
  vertexProjectId: string;
  vertexBaseUrl: string;
  customBaseUrl: string;

  // General
  apiKey: string;
  model: string;
  maxTokens: number;

  // Model
  temperature: number;
  systemPrompt: string;
  effort: 'low' | 'medium' | 'high' | 'max';
  thinkingBudgetTokens: number;
  fastMode: boolean;
  prReviewModel: string;
  codeReviewModel: string;
  codeReviewEffort: 'low' | 'medium' | 'high' | 'max';

  // Workflows
  workflowPrompts: WorkflowPrompts;

  // Appearance
  theme: 'dark' | 'light' | 'system';
  accentColor: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose';
  fontSize: number;
  chatFont: 'proportional' | 'mono';
  monoFontFamily: 'system' | 'menlo' | 'courier';
  chatDensity: 'comfortable' | 'compact';
  tabDensity: 'comfortable' | 'compact';
  chatWidth: 'standard' | 'wide' | 'full';
  showThinking: boolean;
  showToolCalls: boolean;
  showResourceUsage: boolean;

  // Notifications
  notificationsEnabled: boolean;
  notificationSound: 'none' | 'chime' | 'beep';
  notificationsWorkspaceUnread: boolean;

  // Advanced
  permissionMode: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions';
  autoCompact: boolean;
  maxTurns: number;
  // Runtime environment variables
  runtimeEnv: Record<string, string>;
  workspaceBranchPrefix: string;

  // Privacy
  privacyMode: boolean;

  // Integrations
  githubToken: string;

  // IDE
  preferredIde: IdeId;
  customIdeUrl: string;

  // UX hints
  hasDismissedCommandTip?: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  // Provider
  provider: 'anthropic',
  ...DEFAULT_PROVIDER_CONFIG,

  // General
  apiKey: '',
  model: 'claude-sonnet-4-6',
  maxTokens: 4096,

  // Model
  temperature: 1.0,
  systemPrompt: '',
  effort: 'high',
  thinkingBudgetTokens: 16000,
  fastMode: false,
  prReviewModel: 'claude-haiku-4-5-20251001',
  codeReviewModel: 'claude-haiku-4-5-20251001',
  codeReviewEffort: 'low',

  // Workflows
  workflowPrompts: { ...DEFAULT_WORKFLOW_PROMPTS },

  // Appearance
  theme: 'light',
  accentColor: 'slate',
  fontSize: 14,
  chatFont: 'proportional',
  monoFontFamily: 'system',
  chatDensity: 'comfortable',
  tabDensity: 'comfortable',
  chatWidth: 'standard',
  showThinking: true,
  showToolCalls: true,
  showResourceUsage: false,

  // Notifications
  notificationsEnabled: true,
  notificationSound: 'chime',
  notificationsWorkspaceUnread: true,

  // Advanced
  permissionMode: 'default',
  autoCompact: false,
  maxTurns: 25,
  // Runtime environment variables
  runtimeEnv: {},
  workspaceBranchPrefix: 'workspace',

  // Privacy
  privacyMode: false,

  // Integrations
  githubToken: '',

  // IDE
  preferredIde: 'vscode',
  customIdeUrl: '',

  // UX hints
  hasDismissedCommandTip: false,
};

const STORAGE_KEY = 'claude-tauri-settings';

/** Fields that are credentials and must NOT be persisted in the main
 *  settings blob. They are stored via the secure-credentials service. */
const CREDENTIAL_FIELDS = ['apiKey', 'githubToken'] as const;

// Migration map: old short model names -> full model IDs
const MODEL_MIGRATION: Record<string, string> = {
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-6',
  haiku: 'claude-haiku-4-5-20251001',
};

/**
 * Load non-credential settings from localStorage (synchronous).
 * Credentials are loaded separately via `loadCredentials()`.
 */
export function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(stored);
    // Migrate old short model names to full model IDs
    if (parsed.model && parsed.model in MODEL_MIGRATION) {
      parsed.model = MODEL_MIGRATION[parsed.model];
    }
    // Strip credential fields that may have been persisted by older versions
    for (const field of CREDENTIAL_FIELDS) {
      delete parsed[field];
    }
    // Merge with defaults so new keys get default values
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Persist non-credential settings to localStorage.
 * Credential fields are stripped before writing.
 */
export function saveSettings(settings: AppSettings): void {
  const { workflowPrompts: _workflowPrompts, ...persisted } = settings;
  // Remove credentials from the blob — they are stored separately
  const cleaned: Record<string, unknown> = { ...persisted };
  for (const field of CREDENTIAL_FIELDS) {
    delete cleaned[field];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
}

// ---------------------------------------------------------------------------
// Credential helpers (async)
// ---------------------------------------------------------------------------

/** Map from AppSettings field name to credential store key. */
const FIELD_TO_CRED_KEY: Record<string, string> = {
  apiKey: CredentialKeys.API_KEY,
  githubToken: CredentialKeys.GITHUB_TOKEN,
};

/**
 * Load credentials from the secure store and return partial settings to merge.
 * Also performs a one-time migration: if the old settings blob still contains
 * credential values, they are moved to the secure store and removed from the
 * blob.
 */
export async function loadCredentials(): Promise<Partial<AppSettings>> {
  // --- One-time migration from old settings blob ---
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      let dirty = false;
      for (const field of CREDENTIAL_FIELDS) {
        if (parsed[field]) {
          await setCredential(FIELD_TO_CRED_KEY[field], parsed[field]);
          delete parsed[field];
          dirty = true;
        }
      }
      if (dirty) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
    }
  } catch {
    // Migration is best-effort
  }

  // --- Read credentials from secure store ---
  const result: Partial<AppSettings> = {};
  const apiKey = await getCredential(CredentialKeys.API_KEY);
  if (apiKey) result.apiKey = apiKey;
  const githubToken = await getCredential(CredentialKeys.GITHUB_TOKEN);
  if (githubToken) result.githubToken = githubToken;
  return result;
}

/**
 * Persist credential fields to the secure store.
 * Only writes fields present in `updates`.
 */
export async function saveCredentials(updates: Partial<AppSettings>): Promise<void> {
  for (const field of CREDENTIAL_FIELDS) {
    if (field in updates) {
      const value = updates[field] as string;
      await setCredential(FIELD_TO_CRED_KEY[field], value);
    }
  }
}

/**
 * Hook to access shared app settings.
 * Must be used within a SettingsProvider.
 */
export function useSettings() {
  return useSettingsContext();
}
