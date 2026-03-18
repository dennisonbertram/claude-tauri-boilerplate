export const PROVIDER_TYPES = [
  'anthropic',
  'bedrock',
  'vertex',
  'custom',
] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number];

export const PROVIDER_CONFIG_FIELD_KEYS = [
  'bedrockBaseUrl',
  'bedrockProjectId',
  'vertexProjectId',
  'vertexBaseUrl',
  'customBaseUrl',
] as const;

export type ProviderConfigFieldKey = (typeof PROVIDER_CONFIG_FIELD_KEYS)[number];
export type ProviderConfig = Partial<Record<ProviderConfigFieldKey, string>>;

export const PERMISSION_MODES = [
  'default',
  'acceptEdits',
  'plan',
  'bypassPermissions',
] as const;

export type PermissionMode = (typeof PERMISSION_MODES)[number];

export interface ProviderSettingsField {
  key: ProviderConfigFieldKey;
  label: string;
  description: string;
  placeholder: string;
}

type ProviderEnvBinding =
  | { type: 'literal'; value: string }
  | { type: 'config'; key: ProviderConfigFieldKey }
  | { type: 'clear' };

export interface ProviderCapability {
  id: ProviderType;
  label: string;
  authMode: 'subscription' | 'provider-env';
  settingsFields: readonly ProviderSettingsField[];
  requiredConfigKeys: readonly ProviderConfigFieldKey[];
  supportedPermissionModes: readonly PermissionMode[];
  supportsResume: boolean;
  supportsRuntimeEnv: boolean;
  supportsAttachments: boolean;
  supportsSubagents: boolean;
  supportsPlanMode: boolean;
  supportsReviewHooks: boolean;
  supportsWorkspaceIsolation: boolean;
  env: Record<string, ProviderEnvBinding>;
}

const PROVIDER_SETTINGS_FIELDS: Record<
  ProviderConfigFieldKey,
  ProviderSettingsField
> = {
  bedrockBaseUrl: {
    key: 'bedrockBaseUrl',
    label: 'Bedrock Base URL',
    description: 'Optional Bedrock endpoint override',
    placeholder: 'https://bedrock.example.com',
  },
  bedrockProjectId: {
    key: 'bedrockProjectId',
    label: 'Bedrock Project ID',
    description: 'Optional Bedrock project identifier',
    placeholder: 'project-id',
  },
  vertexProjectId: {
    key: 'vertexProjectId',
    label: 'Vertex Project ID',
    description: 'Google Cloud project ID',
    placeholder: 'project-id',
  },
  vertexBaseUrl: {
    key: 'vertexBaseUrl',
    label: 'Vertex Base URL',
    description: 'Optional Vertex endpoint override',
    placeholder: 'https://us-central1-aiplatform.googleapis.com',
  },
  customBaseUrl: {
    key: 'customBaseUrl',
    label: 'Custom Base URL',
    description: 'Override Claude API base URL',
    placeholder: 'https://gateway.example.com/v1',
  },
};

function getCommonCapabilityFields() {
  return {
    supportedPermissionModes: PERMISSION_MODES,
    supportsResume: true,
    supportsRuntimeEnv: true,
    supportsAttachments: true,
    supportsSubagents: true,
    supportsPlanMode: true,
    supportsReviewHooks: true,
    supportsWorkspaceIsolation: true,
  } as const;
}

export const PROVIDER_CAPABILITIES: Record<ProviderType, ProviderCapability> = {
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    authMode: 'subscription',
    settingsFields: [],
    requiredConfigKeys: [],
    ...getCommonCapabilityFields(),
    env: {
      ANTHROPIC_API_KEY: { type: 'literal', value: '' },
      CLAUDE_CODE_USE_BEDROCK: { type: 'clear' },
      CLAUDE_CODE_USE_VERTEX: { type: 'clear' },
      ANTHROPIC_BEDROCK_BASE_URL: { type: 'clear' },
      ANTHROPIC_VERTEX_BASE_URL: { type: 'clear' },
      ANTHROPIC_VERTEX_PROJECT_ID: { type: 'clear' },
      ANTHROPIC_BASE_URL: { type: 'clear' },
    },
  },
  bedrock: {
    id: 'bedrock',
    label: 'AWS Bedrock',
    authMode: 'provider-env',
    settingsFields: [
      PROVIDER_SETTINGS_FIELDS.bedrockBaseUrl,
      PROVIDER_SETTINGS_FIELDS.bedrockProjectId,
    ],
    requiredConfigKeys: [],
    ...getCommonCapabilityFields(),
    env: {
      ANTHROPIC_API_KEY: { type: 'literal', value: '' },
      CLAUDE_CODE_USE_BEDROCK: { type: 'literal', value: '1' },
      CLAUDE_CODE_USE_VERTEX: { type: 'clear' },
      ANTHROPIC_BEDROCK_BASE_URL: { type: 'config', key: 'bedrockBaseUrl' },
      ANTHROPIC_VERTEX_BASE_URL: { type: 'clear' },
      ANTHROPIC_VERTEX_PROJECT_ID: { type: 'clear' },
      ANTHROPIC_BASE_URL: { type: 'clear' },
    },
  },
  vertex: {
    id: 'vertex',
    label: 'Google Vertex',
    authMode: 'provider-env',
    settingsFields: [
      PROVIDER_SETTINGS_FIELDS.vertexProjectId,
      PROVIDER_SETTINGS_FIELDS.vertexBaseUrl,
    ],
    requiredConfigKeys: [],
    ...getCommonCapabilityFields(),
    env: {
      ANTHROPIC_API_KEY: { type: 'literal', value: '' },
      CLAUDE_CODE_USE_BEDROCK: { type: 'clear' },
      CLAUDE_CODE_USE_VERTEX: { type: 'literal', value: '1' },
      ANTHROPIC_BEDROCK_BASE_URL: { type: 'clear' },
      ANTHROPIC_VERTEX_BASE_URL: { type: 'config', key: 'vertexBaseUrl' },
      ANTHROPIC_VERTEX_PROJECT_ID: { type: 'config', key: 'vertexProjectId' },
      ANTHROPIC_BASE_URL: { type: 'clear' },
    },
  },
  custom: {
    id: 'custom',
    label: 'Custom Base URL',
    authMode: 'provider-env',
    settingsFields: [PROVIDER_SETTINGS_FIELDS.customBaseUrl],
    requiredConfigKeys: [],
    ...getCommonCapabilityFields(),
    env: {
      ANTHROPIC_API_KEY: { type: 'literal', value: '' },
      CLAUDE_CODE_USE_BEDROCK: { type: 'clear' },
      CLAUDE_CODE_USE_VERTEX: { type: 'clear' },
      ANTHROPIC_BEDROCK_BASE_URL: { type: 'clear' },
      ANTHROPIC_VERTEX_BASE_URL: { type: 'clear' },
      ANTHROPIC_VERTEX_PROJECT_ID: { type: 'clear' },
      ANTHROPIC_BASE_URL: { type: 'config', key: 'customBaseUrl' },
    },
  },
};

export const PROVIDER_CAPABILITY_LIST = PROVIDER_TYPES.map(
  (provider) => PROVIDER_CAPABILITIES[provider]
);

export const DEFAULT_PROVIDER_CONFIG: Record<ProviderConfigFieldKey, string> =
  PROVIDER_CONFIG_FIELD_KEYS.reduce(
    (acc, key) => {
      acc[key] = '';
      return acc;
    },
    {} as Record<ProviderConfigFieldKey, string>
  );

export function getProviderCapability(
  provider: ProviderType | undefined
): ProviderCapability {
  return PROVIDER_CAPABILITIES[provider ?? 'anthropic'];
}

export function getProviderSettingsFields(
  provider: ProviderType | undefined
): readonly ProviderSettingsField[] {
  return getProviderCapability(provider).settingsFields;
}

export function pickProviderConfig(
  provider: ProviderType | undefined,
  source: Partial<Record<ProviderConfigFieldKey, string>>
): ProviderConfig {
  const config: ProviderConfig = {};

  for (const field of getProviderSettingsFields(provider)) {
    config[field.key] = source[field.key] ?? '';
  }

  return config;
}

export function findUnsupportedProviderConfigKeys(
  provider: ProviderType | undefined,
  config: ProviderConfig | undefined
): ProviderConfigFieldKey[] {
  if (!config) return [];

  const supportedKeys = new Set(
    getProviderSettingsFields(provider).map((field) => field.key)
  );

  return PROVIDER_CONFIG_FIELD_KEYS.filter((key) => {
    const value = config[key];
    return value !== undefined && value !== '' && !supportedKeys.has(key);
  });
}

export function findMissingRequiredProviderConfigKeys(
  provider: ProviderType | undefined,
  config: ProviderConfig | undefined
): ProviderConfigFieldKey[] {
  const capability = getProviderCapability(provider);
  return capability.requiredConfigKeys.filter((key) => !(config?.[key] ?? '').trim());
}

export function getRuntimeCapabilitiesSnapshot() {
  return {
    providers: PROVIDER_CAPABILITY_LIST.map((provider) => ({
      id: provider.id,
      label: provider.label,
      authMode: provider.authMode,
      settingsFields: provider.settingsFields,
      requiredConfigKeys: provider.requiredConfigKeys,
      supportedPermissionModes: provider.supportedPermissionModes,
      supportsResume: provider.supportsResume,
      supportsRuntimeEnv: provider.supportsRuntimeEnv,
      supportsAttachments: provider.supportsAttachments,
      supportsSubagents: provider.supportsSubagents,
      supportsPlanMode: provider.supportsPlanMode,
      supportsReviewHooks: provider.supportsReviewHooks,
      supportsWorkspaceIsolation: provider.supportsWorkspaceIsolation,
    })),
  };
}
