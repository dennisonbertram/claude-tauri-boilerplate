import type { UpdateAgentProfileRequest } from '@claude-tauri/shared';
import { AVAILABLE_MODELS } from '@/lib/models';
import { EffortSelector, EFFORT_OPTIONS } from '@/components/ui/EffortSelector';

interface ModelTabProps {
  draft: UpdateAgentProfileRequest;
  onChange: (updates: Partial<UpdateAgentProfileRequest>) => void;
}

const MIN_THINKING_BUDGET = 1000;
const MAX_THINKING_BUDGET = 100000;

export function ModelTab({ draft, onChange }: ModelTabProps) {
  const currentEffort = draft.effort ?? 'medium';
  const thinkingBudget = draft.thinkingBudgetTokens ?? 10000;

  return (
    <div className="space-y-5">
      {/* Model */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Model
        </label>
        <select
          value={draft.model ?? ''}
          onChange={(e) => onChange({ model: e.target.value })}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30"
        >
          <option value="" title="Uses the session's configured model">Default</option>
          {AVAILABLE_MODELS.map((m) => (
            <option key={m.id} value={m.id} title={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          This profile override is used when this profile is active.
          Leave empty to use global defaults.
        </p>
      </div>

      {/* Effort */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Effort
        </label>
        <EffortSelector
          value={currentEffort}
          onChange={(val) => onChange({ effort: val })}
        />
        <p className="text-xs text-muted-foreground mt-1">
          {EFFORT_OPTIONS.find((o) => o.value === currentEffort)?.description}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Profile controls are overrides for this chat run.
        </p>
      </div>

      {/* Thinking Budget Tokens */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Extended Thinking Budget
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={MIN_THINKING_BUDGET}
            max={MAX_THINKING_BUDGET}
            step={1000}
            value={thinkingBudget}
            onChange={(e) =>
              onChange({
                thinkingBudgetTokens: parseInt(e.target.value, 10),
              })
            }
            aria-label="Extended thinking budget in tokens"
            className="flex-1 h-2 rounded-full accent-primary cursor-pointer"
          />
          <input
            type="number"
            min={MIN_THINKING_BUDGET}
            max={MAX_THINKING_BUDGET}
            step={1000}
            value={thinkingBudget}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                onChange({
                  thinkingBudgetTokens: Math.max(
                    MIN_THINKING_BUDGET,
                    Math.min(MAX_THINKING_BUDGET, val)
                  ),
                });
              }
            }}
            className="w-24 h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground text-right focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Maximum tokens for extended thinking (range:{' '}
          {MIN_THINKING_BUDGET.toLocaleString()} -{' '}
          {MAX_THINKING_BUDGET.toLocaleString()})
        </p>
      </div>
    </div>
  );
}
