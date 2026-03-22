import type { McpServerConfig } from '@claude-tauri/shared';
import type { McpPreset } from './types';
import { MCP_PRESETS } from './types';

interface PresetListProps {
  servers: McpServerConfig[];
  installingPresetId: string | null;
  onInstallPreset: (preset: McpPreset) => void;
}

export function PresetList({ servers, installingPresetId, onInstallPreset }: PresetListProps) {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-medium text-foreground">Recommended presets</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Install optional MCP companions here. Browser testing now uses the `agent-browser`
          CLI, while `agentation` remains a separate visual-feedback tool.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {MCP_PRESETS.map((preset) => {
          const alreadyInstalled = servers.some((server) => server.name === preset.config.name);
          const isInstalling = installingPresetId === preset.id;

          return (
            <div
              key={preset.id}
              data-testid={`mcp-preset-${preset.id}`}
              className="rounded-lg border border-border bg-muted/20 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground">{preset.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{preset.description}</div>
                </div>

                <button
                  data-testid={`mcp-install-preset-${preset.id}`}
                  onClick={() => onInstallPreset(preset)}
                  disabled={alreadyInstalled || isInstalling}
                  className="shrink-0 rounded-lg border border-input px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {alreadyInstalled ? 'Installed' : isInstalling ? 'Installing...' : 'Install'}
                </button>
              </div>

              <div className="mt-3 rounded-md border border-border/60 bg-background/60 px-2 py-2 font-mono text-[11px] text-muted-foreground">
                {preset.config.type === 'stdio'
                  ? `${preset.config.command} ${preset.config.args?.join(' ') || ''}`
                  : preset.config.url}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
