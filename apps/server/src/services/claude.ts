import { query } from '@anthropic-ai/claude-agent-sdk';
import { mapSdkEvent } from './event-mapper';
import {
  getProviderCapability,
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
