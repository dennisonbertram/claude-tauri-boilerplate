interface MemorySettingsProps {
  autoMemory: boolean;
  onToggleAutoMemory: () => void;
  memoryDir: string;
}

export function MemorySettings({ autoMemory, onToggleAutoMemory, memoryDir }: MemorySettingsProps) {
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-medium text-foreground">Settings</h3>

      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm text-foreground">Auto-memory</label>
          <p className="text-xs text-muted-foreground">
            Automatically save important context
          </p>
        </div>
        <button
          data-testid="memory-auto-toggle"
          role="switch"
          aria-checked={autoMemory}
          onClick={onToggleAutoMemory}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            autoMemory ? 'bg-primary' : 'bg-input'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${
              autoMemory ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div>
        <label className="text-sm text-foreground">Memory directory</label>
        <p
          data-testid="memory-dir-display"
          className="text-xs text-muted-foreground font-mono mt-0.5 break-all"
        >
          {memoryDir}
        </p>
      </div>
    </div>
  );
}
