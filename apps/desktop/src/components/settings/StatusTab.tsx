import type { AppSettings } from '@/hooks/useSettings';
import { SettingField } from '@/components/settings/SettingField';
import { ToggleSwitch } from '@/components/settings/ToggleSwitch';
import type { SessionRuntimeInfo } from '@/components/settings/SettingsPanel';

export function StatusTab({
  sessionInfo,
  email,
  plan,
  settings,
  updateSettings,
}: {
  sessionInfo?: SessionRuntimeInfo | null;
  email?: string;
  plan?: string;
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
}) {
  return (
    <>
      {/* Diagnostics */}
      <SettingField
        label="Diagnostics"
        description="Show CPU and memory usage in the status bar."
      >
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-foreground">Show Resource Usage</div>
            <div className="text-xs text-muted-foreground">
              Poll the local diagnostics endpoint while the status bar is visible.
            </div>
          </div>
          <ToggleSwitch
            data-testid="show-resource-usage-toggle"
            checked={settings.showResourceUsage}
            onChange={(checked) => updateSettings({ showResourceUsage: checked })}
          />
        </div>
      </SettingField>

      {/* Account */}
      <SettingField label="Account" description="Your Claude subscription info">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-mono">{email || 'Connected via Claude subscription'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plan</span>
            <span className="capitalize">{plan || 'Unknown'}</span>
          </div>
        </div>
      </SettingField>

      {/* Session Info */}
      <SettingField label="Session" description="Current chat session details">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Model</span>
            <span className="font-mono">{sessionInfo?.model || 'No active session'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Version</span>
            <span className="font-mono">{sessionInfo?.claudeCodeVersion || '\u2014'}</span>
          </div>
          {sessionInfo?.sessionId && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Session ID</span>
              <span className="font-mono text-xs truncate max-w-[200px]" title={sessionInfo.sessionId}>
                {sessionInfo.sessionId}
              </span>
            </div>
          )}
        </div>
      </SettingField>

      {/* MCP Servers */}
      <SettingField label="MCP Servers" description="Connected Model Context Protocol servers">
        {sessionInfo?.mcpServers && sessionInfo.mcpServers.length > 0 ? (
          <div className="space-y-1">
            {sessionInfo.mcpServers.map((server) => (
              <div key={server.name} className="flex items-center justify-between text-sm">
                <span className="font-mono">{server.name}</span>
                <span className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      server.status === 'connected'
                        ? 'bg-green-500'
                        : server.status === 'error'
                          ? 'bg-red-500'
                          : 'bg-yellow-500'
                    }`}
                  />
                  <span className="text-xs text-muted-foreground">{server.status}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No MCP servers connected</p>
        )}
      </SettingField>

      {/* Tools */}
      <SettingField
        label="Available Tools"
        description={`${sessionInfo?.tools?.length ?? 0} tools available`}
      >
        {sessionInfo?.tools && sessionInfo.tools.length > 0 ? (
          <div className="max-h-48 overflow-y-auto rounded-md border border-input p-2 space-y-0.5">
            {sessionInfo.tools.map((tool) => (
              <div key={tool} className="text-xs font-mono text-muted-foreground">
                {tool}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active session</p>
        )}
      </SettingField>
    </>
  );
}
