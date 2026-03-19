import { query } from '@anthropic-ai/claude-agent-sdk';
import { mapSdkEvent } from './event-mapper';
import {
  getProviderCapability,
  type AgentProfile,
  type PermissionMode,
  type ProviderConfig,
  type ProviderType,
  type StreamEvent,
} from '@claude-tauri/shared';

export interface ClaudeStreamOptions {
  prompt: string;
  sessionId?: string;
  model?: string;
  effort?: 'low' | 'medium' | 'high' | 'max';
  thinkingBudgetTokens?: number;
  permissionMode?: PermissionMode;
  cwd?: string;
  additionalDirectories?: string[];
  provider?: ProviderType;
  providerConfig?: ProviderConfig;
  runtimeEnv?: Record<string, string>;
  agentProfile?: AgentProfile | null;
}

type EnvSnapshot = Record<string, string | undefined>;

type EnvKey = string;

function setProviderEnv(
  env: EnvSnapshot,
  key: EnvKey,
  value: string | undefined,
) {
  env[key] = process.env[key];
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function applyProviderEnv(
  provider: ProviderType | undefined,
  config: ProviderConfig = {},
  runtimeEnv: Record<string, string> = {},
): EnvSnapshot {
  const original: EnvSnapshot = {};
  const capability = getProviderCapability(provider);

  for (const [envKey, binding] of Object.entries(capability.env)) {
    if (binding.type === 'literal') {
      setProviderEnv(original, envKey, binding.value);
      continue;
    }

    if (binding.type === 'config') {
      setProviderEnv(original, envKey, config[binding.key]);
      continue;
    }

    if (binding.type === 'clear') {
      setProviderEnv(original, envKey, undefined);
    }
  }

  for (const [key, value] of Object.entries(runtimeEnv)) {
    setProviderEnv(original, key, value);
  }

  return original;
}

function restoreProviderEnv(original: EnvSnapshot) {
  for (const key in original) {
    const value = original[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function buildProfileQueryOptions(profile: AgentProfile): Record<string, unknown> {
  const opts: Record<string, unknown> = {};

  // Setting sources - empty array means no filesystem settings (sandboxed)
  if (profile.settingSources && profile.settingSources.length > 0) {
    opts.settingSources = profile.settingSources;
  } else {
    opts.settingSources = []; // Default: sandboxed, no filesystem settings
  }

  // System prompt
  if (profile.systemPrompt) {
    if (profile.useClaudeCodePrompt) {
      opts.systemPrompt = {
        type: 'preset' as const,
        preset: 'claude_code' as const,
        append: profile.systemPrompt,
      };
    } else {
      opts.systemPrompt = profile.systemPrompt;
    }
  } else if (profile.useClaudeCodePrompt) {
    opts.systemPrompt = {
      type: 'preset' as const,
      preset: 'claude_code' as const,
    };
  }

  // Model and thinking
  if (profile.model) opts.model = profile.model;
  if (profile.effort) opts.effort = profile.effort;
  if (profile.thinkingBudgetTokens) {
    opts.thinkingConfig = {
      type: 'enabled',
      budgetTokens: profile.thinkingBudgetTokens,
    };
  }

  // Tool permissions
  if (profile.allowedTools?.length) opts.allowedTools = profile.allowedTools;
  if (profile.disallowedTools?.length) opts.disallowedTools = profile.disallowedTools;
  if (profile.permissionMode && profile.permissionMode !== 'default') {
    opts.permissionMode = profile.permissionMode;
  }

  // Hooks
  if (profile.hooksJson) {
    try { opts.hooks = JSON.parse(profile.hooksJson); } catch { /* ignore invalid JSON */ }
  }

  // MCP Servers
  if (profile.mcpServersJson) {
    try { opts.mcpServers = JSON.parse(profile.mcpServersJson); } catch { /* ignore invalid JSON */ }
  }

  // Sandbox
  if (profile.sandboxJson) {
    try { opts.sandbox = JSON.parse(profile.sandboxJson); } catch { /* ignore invalid JSON */ }
  }

  // Working directory
  if (profile.cwd) opts.cwd = profile.cwd;
  if (profile.additionalDirectories?.length) {
    opts.additionalDirectories = profile.additionalDirectories;
  }

  // Limits
  if (profile.maxTurns) opts.maxTurns = profile.maxTurns;
  if (profile.maxBudgetUsd) opts.maxBudgetUsd = profile.maxBudgetUsd;

  // Sub-agents
  if (profile.agentsJson) {
    try { opts.agents = JSON.parse(profile.agentsJson); } catch { /* ignore invalid JSON */ }
  }

  return opts;
}

export async function* streamClaude(
  options: ClaudeStreamOptions
): AsyncGenerator<StreamEvent> {
  const queryOptions: Record<string, unknown> = {
    includePartialMessages: true,
  };

  if (options.sessionId) {
    queryOptions.resume = options.sessionId;
  }

  if (options.model) {
    queryOptions.model = options.model;
  }

  if (options.effort) {
    queryOptions.effort = options.effort;
  }

  if (options.thinkingBudgetTokens) {
    queryOptions.thinkingConfig = {
      type: 'enabled',
      budgetTokens: options.thinkingBudgetTokens,
    };
  }

  if (options.permissionMode) {
    queryOptions.permissionMode = options.permissionMode;
  }

  if (options.cwd) {
    queryOptions.cwd = options.cwd;
  }

  if (options.additionalDirectories && options.additionalDirectories.length > 0) {
    queryOptions.additionalDirectories = options.additionalDirectories;
  }

  // If agent profile provided, apply profile options (overrides individual fields)
  if (options.agentProfile) {
    const profileOpts = buildProfileQueryOptions(options.agentProfile);
    Object.assign(queryOptions, profileOpts);
  }

  const originalEnv = applyProviderEnv(
    options.provider,
    options.providerConfig,
    options.runtimeEnv ?? {}
  );

  const stream = query({
    prompt: options.prompt,
    options: queryOptions,
  });

  try {
    for await (const event of stream) {
      const mapped = mapSdkEvent(event);
      for (const streamEvent of mapped) {
        yield streamEvent;
      }
    }
  } finally {
    restoreProviderEnv(originalEnv);
  }
}
