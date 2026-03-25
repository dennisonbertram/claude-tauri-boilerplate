import type { AppSettings } from '@/hooks/useSettings';
import { AVAILABLE_MODELS } from '@/lib/models';
import { EffortSelector } from '@/components/ui/EffortSelector';
import { SettingField } from '@/components/settings/SettingField';
import type { TabProps } from '@/components/settings/types';

const MIN_THINKING_BUDGET_TOKENS = 1024;
const MAX_THINKING_BUDGET_TOKENS = 32000;

export function ModelTab({ settings, updateSettings }: TabProps) {
  return (
    <>
      {/* Model */}
      <SettingField
        label="Model"
        description="Global default for the next chat run. Profile settings can override this value."
      >
        <select
          data-testid="model-select"
          value={settings.model}
          onChange={(e) => updateSettings({ model: e.target.value })}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {AVAILABLE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </SettingField>

      {/* Max Tokens */}
      <SettingField
        label="Max Tokens"
        description={`Maximum output tokens for the next chat run: ${settings.maxTokens.toLocaleString()}.`}
      >
        <input
          data-testid="max-tokens-slider"
          type="range"
          min="256"
          max="32768"
          step="256"
          value={settings.maxTokens}
          onChange={(e) =>
            updateSettings({ maxTokens: parseInt(e.target.value, 10) })
          }
          className="w-full accent-primary"
        />
      </SettingField>

      {/* Temperature */}
      <SettingField
        label="Temperature"
        description={`Default output variability for the next chat run: ${settings.temperature.toFixed(1)}.`}
      >
        <input
          data-testid="temperature-slider"
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={settings.temperature}
          onChange={(e) =>
            updateSettings({ temperature: parseFloat(e.target.value) })
          }
          className="w-full accent-primary"
        />
      </SettingField>

      {/* System Prompt */}
      <SettingField
        label="System Prompt"
        description="Custom instructions prepended to every chat"
      >
        <textarea
          data-testid="system-prompt-input"
          value={settings.systemPrompt}
          onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
          placeholder="You are a helpful assistant..."
          rows={4}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </SettingField>

      {/* Thinking Effort */}
      <SettingField
        label="Thinking Effort"
        description="Default thinking effort for the next chat run. Profile values can override this default."
      >
        <EffortSelector
          data-testid="effort-select"
          value={settings.effort}
          onChange={(val) =>
            updateSettings({
              effort: val as AppSettings['effort'],
            })
          }
        />
      </SettingField>

      <SettingField
        label="Thinking Budget"
        description={`Maximum thinking tokens for the next chat run: ${settings.thinkingBudgetTokens.toLocaleString()}. Profile values can override this default.`}
      >
        <input
          data-testid="thinking-budget-input"
          type="number"
          min={MIN_THINKING_BUDGET_TOKENS}
          max={MAX_THINKING_BUDGET_TOKENS}
          step="1024"
          value={settings.thinkingBudgetTokens}
          onChange={(e) => {
            const parsed = parseInt(e.target.value, 10);
            if (Number.isNaN(parsed)) return;
            updateSettings({
              thinkingBudgetTokens: Math.min(
                MAX_THINKING_BUDGET_TOKENS,
                Math.max(MIN_THINKING_BUDGET_TOKENS, parsed)
              ),
            });
          }}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </SettingField>
    </>
  );
}
