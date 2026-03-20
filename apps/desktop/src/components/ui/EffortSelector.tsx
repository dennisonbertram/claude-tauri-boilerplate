interface EffortOption {
  value: string;
  label: string;
  description?: string;
}

interface EffortSelectorProps {
  value: string;
  onChange: (value: string) => void;
  options?: EffortOption[];
  'data-testid'?: string;
}

const DEFAULT_OPTIONS: EffortOption[] = [
  { value: 'low', label: 'Low', description: 'Faster responses, uses fewer tokens. Good for simple tasks.' },
  { value: 'medium', label: 'Medium', description: 'Balanced performance. Recommended for most tasks.' },
  { value: 'high', label: 'High', description: 'Deep reasoning, more tokens used. Best for complex problems.' },
  { value: 'max', label: 'Max', description: 'Maximum extended thinking. Best for the hardest problems.' },
];

export function EffortSelector({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  'data-testid': testId,
}: EffortSelectorProps) {
  return (
    <div className="inline-flex rounded-lg border border-border overflow-hidden" data-testid={testId}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-4 py-1.5 text-sm font-medium transition-colors ${
            value === opt.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export { DEFAULT_OPTIONS as EFFORT_OPTIONS };
export type { EffortOption };
