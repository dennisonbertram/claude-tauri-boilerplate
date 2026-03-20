import {
  getProviderCapability,
  type ProviderConfig,
  type ProviderType,
} from '@claude-tauri/shared';

export type SdkRequestEnv = Record<string, string | undefined>;

function applyEnvValue(
  env: SdkRequestEnv,
  key: string,
  value: string | undefined
) {
  if (value === undefined) {
    delete env[key];
    return;
  }

  env[key] = value;
}

/**
 * Build a request-scoped SDK env snapshot instead of mutating global process.env.
 */
export function buildSdkRequestEnv(
  provider: ProviderType | undefined,
  config: ProviderConfig = {},
  runtimeEnv: Record<string, string> = {}
): SdkRequestEnv {
  const env: SdkRequestEnv = { ...process.env };
  const capability = getProviderCapability(provider);

  for (const [envKey, binding] of Object.entries(capability.env)) {
    if (binding.type === 'literal') {
      applyEnvValue(env, envKey, binding.value);
      continue;
    }

    if (binding.type === 'config') {
      applyEnvValue(env, envKey, config[binding.key]);
      continue;
    }

    applyEnvValue(env, envKey, undefined);
  }

  for (const [key, value] of Object.entries(runtimeEnv)) {
    applyEnvValue(env, key, value);
  }

  return env;
}

export function buildSubscriptionSdkEnv(): SdkRequestEnv {
  return {
    ...process.env,
    ANTHROPIC_API_KEY: '',
  };
}
