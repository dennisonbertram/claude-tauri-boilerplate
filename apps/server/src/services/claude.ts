import { query } from '@anthropic-ai/claude-agent-sdk';
import { mapSdkEvent } from './event-mapper';
import type { StreamEvent } from '@claude-tauri/shared';

type ProviderType = 'anthropic' | 'bedrock' | 'vertex' | 'custom';

type ProviderConfig = {
  bedrockBaseUrl?: string;
  bedrockProjectId?: string;
  vertexProjectId?: string;
  vertexBaseUrl?: string;
  customBaseUrl?: string;
};

export interface ClaudeStreamOptions {
  prompt: string;
  sessionId?: string;
  model?: string;
  effort?: 'low' | 'medium' | 'high' | 'max';
  permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions';
  cwd?: string;
  provider?: ProviderType;
  providerConfig?: ProviderConfig;
}

type EnvKey = 'ANTHROPIC_API_KEY' | 'CLAUDE_CODE_USE_BEDROCK' | 'CLAUDE_CODE_USE_VERTEX' | 'ANTHROPIC_BEDROCK_BASE_URL' | 'ANTHROPIC_VERTEX_BASE_URL' | 'ANTHROPIC_VERTEX_PROJECT_ID' | 'ANTHROPIC_BASE_URL';

function setProviderEnv(
  env: Partial<Record<EnvKey, string | undefined>>,
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
): Partial<Record<EnvKey, string | undefined>> {
  const original: Partial<Record<EnvKey, string | undefined>> = {};
  const providerType = provider ?? 'anthropic';

  // Always clear API key to force subscription auth unless a provider explicitly
  // sets up auth via its own env variables.
  setProviderEnv(original, 'ANTHROPIC_API_KEY', '');

  switch (providerType) {
    case 'bedrock':
      setProviderEnv(original, 'CLAUDE_CODE_USE_BEDROCK', '1');
      setProviderEnv(original, 'CLAUDE_CODE_USE_VERTEX', undefined);
      setProviderEnv(original, 'ANTHROPIC_BEDROCK_BASE_URL', config.bedrockBaseUrl);
      setProviderEnv(original, 'ANTHROPIC_VERTEX_BASE_URL', undefined);
      setProviderEnv(original, 'ANTHROPIC_VERTEX_PROJECT_ID', undefined);
      setProviderEnv(original, 'ANTHROPIC_BASE_URL', undefined);
      break;
    case 'vertex':
      setProviderEnv(original, 'CLAUDE_CODE_USE_VERTEX', '1');
      setProviderEnv(original, 'CLAUDE_CODE_USE_BEDROCK', undefined);
      setProviderEnv(original, 'ANTHROPIC_VERTEX_BASE_URL', config.vertexBaseUrl);
      setProviderEnv(original, 'ANTHROPIC_VERTEX_PROJECT_ID', config.vertexProjectId);
      setProviderEnv(original, 'ANTHROPIC_BEDROCK_BASE_URL', undefined);
      setProviderEnv(original, 'ANTHROPIC_BASE_URL', undefined);
      break;
    case 'custom':
      setProviderEnv(original, 'CLAUDE_CODE_USE_BEDROCK', undefined);
      setProviderEnv(original, 'CLAUDE_CODE_USE_VERTEX', undefined);
      setProviderEnv(original, 'ANTHROPIC_BEDROCK_BASE_URL', undefined);
      setProviderEnv(original, 'ANTHROPIC_VERTEX_BASE_URL', undefined);
      setProviderEnv(original, 'ANTHROPIC_VERTEX_PROJECT_ID', undefined);
      setProviderEnv(original, 'ANTHROPIC_BASE_URL', config.customBaseUrl);
      break;
    default:
      setProviderEnv(original, 'CLAUDE_CODE_USE_BEDROCK', undefined);
      setProviderEnv(original, 'CLAUDE_CODE_USE_VERTEX', undefined);
      setProviderEnv(original, 'ANTHROPIC_BEDROCK_BASE_URL', undefined);
      setProviderEnv(original, 'ANTHROPIC_VERTEX_BASE_URL', undefined);
      setProviderEnv(original, 'ANTHROPIC_VERTEX_PROJECT_ID', undefined);
      setProviderEnv(original, 'ANTHROPIC_BASE_URL', undefined);
      break;
  }

  return original;
}

function restoreProviderEnv(original: Partial<Record<EnvKey, string | undefined>>) {
  for (const key in original) {
    const typedKey = key as EnvKey;
    const value = original[typedKey];
    if (value === undefined) {
      delete process.env[typedKey];
    } else {
      process.env[typedKey] = value;
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

  if (options.permissionMode) {
    queryOptions.permissionMode = options.permissionMode;
  }

  if (options.cwd) {
    queryOptions.cwd = options.cwd;
  }

  const originalEnv = applyProviderEnv(options.provider, options.providerConfig);

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
