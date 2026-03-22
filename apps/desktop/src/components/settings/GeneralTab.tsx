import { useState } from 'react';
import type { AppSettings } from '@/hooks/useSettings';
import {
  PROVIDER_CAPABILITY_LIST,
  getProviderSettingsFields,
  type ProviderConfigFieldKey,
} from '@claude-tauri/shared';
import { IDE_CONFIGS, type IdeId } from '@/lib/ide-opener';
import { SettingField } from '@/components/settings/SettingField';
import type { TabProps } from '@/components/settings/types';

export function GeneralTab({
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
