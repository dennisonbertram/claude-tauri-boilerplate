import { useSettingsContext } from '@/contexts/SettingsContext';
import { DEFAULT_WORKFLOW_PROMPTS, type WorkflowPrompts } from '@/lib/workflowPrompts';

export interface AppSettings {
  // Provider
  provider: 'anthropic' | 'bedrock' | 'vertex' | 'custom';
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
  fastMode: boolean;
  prReviewModel: string;

  // Workflows
  workflowPrompts: WorkflowPrompts;

  // Appearance
  theme: 'dark' | 'light' | 'system';
  accentColor: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose';
  fontSize: number;
  chatFont: 'proportional' | 'mono';
  chatDensity: 'comfortable' | 'compact';
  chatWidth: 'standard' | 'wide' | 'full';
  showThinking: boolean;
  showToolCalls: boolean;

  // Advanced
  permissionMode: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions';
  autoCompact: boolean;
  maxTurns: number;
  // Runtime environment variables
  runtimeEnv: Record<string, string>;
  workspaceBranchPrefix: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  // Provider
  provider: 'anthropic',
  bedrockBaseUrl: '',
  bedrockProjectId: '',
  vertexProjectId: '',
  vertexBaseUrl: '',
  customBaseUrl: '',

  // General
  apiKey: '',
  model: 'claude-sonnet-4-6',
  maxTokens: 4096,

  // Model
  temperature: 1.0,
  systemPrompt: '',
  effort: 'high',
  fastMode: false,
  prReviewModel: 'claude-haiku-4-5-20251001',

  // Workflows
  workflowPrompts: { ...DEFAULT_WORKFLOW_PROMPTS },

  // Appearance
  theme: 'dark',
  accentColor: 'slate',
  fontSize: 14,
  chatFont: 'proportional',
  chatDensity: 'comfortable',
  chatWidth: 'standard',
  showThinking: true,
  showToolCalls: true,

  // Advanced
  permissionMode: 'default',
  autoCompact: false,
  maxTurns: 25,
  // Runtime environment variables
  runtimeEnv: {},
  workspaceBranchPrefix: 'workspace',
};

const STORAGE_KEY = 'claude-tauri-settings';

// Migration map: old short model names -> full model IDs
const MODEL_MIGRATION: Record<string, string> = {
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-6',
  haiku: 'claude-haiku-4-5-20251001',
};

export function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(stored);
    // Migrate old short model names to full model IDs
    if (parsed.model && parsed.model in MODEL_MIGRATION) {
      parsed.model = MODEL_MIGRATION[parsed.model];
    }
    // Merge with defaults so new keys get default values
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  const { workflowPrompts: _workflowPrompts, ...persisted } = settings;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}

/**
 * Hook to access shared app settings.
 * Must be used within a SettingsProvider.
 */
export function useSettings() {
  return useSettingsContext();
}
