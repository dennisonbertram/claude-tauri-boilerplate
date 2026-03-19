import type { UpdateAgentProfileRequest } from '@claude-tauri/shared';
import { AVAILABLE_MODELS } from '@/lib/models';

interface ModelTabProps {
  draft: UpdateAgentProfileRequest;
  onChange: (updates: Partial<UpdateAgentProfileRequest>) => void;
}

const EFFORT_OPTIONS: Array<{ value: 'low' | 'medium' | 'high'; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

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
          <option value="">Default (use session model)</option>
          {AVAILABLE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} ({m.id})
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          Override the model used when this profile is active. Leave empty to
          use the session default.
        </p>
      </div>

      {/* Effort */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Effort
        </label>
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          {EFFORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ effort: opt.value })}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                currentEffort === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Controls how much effort Claude puts into responses. Higher effort
          uses more tokens.
        </p>
      </div>

      {/* Thinking Budget Tokens */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Thinking Budget Tokens
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
