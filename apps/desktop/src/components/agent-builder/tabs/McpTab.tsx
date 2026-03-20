import { useMemo } from 'react';
import type { UpdateAgentProfileRequest } from '@claude-tauri/shared';

interface McpTabProps {
  draft: UpdateAgentProfileRequest;
  onChange: (updates: Partial<UpdateAgentProfileRequest>) => void;
}

export function McpTab({ draft, onChange }: McpTabProps) {
  const mcpJson = draft.mcpServersJson ?? '';

  const jsonValid = useMemo(() => {
    if (!mcpJson.trim()) return null;
    try {
      JSON.parse(mcpJson);
      return true;
    } catch {
      return false;
    }
  }, [mcpJson]);

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-muted/40 border border-border p-3 mb-1">
        <p className="text-sm font-medium text-foreground mb-1">Model Context Protocol (MCP) Servers</p>
        <p className="text-xs text-muted-foreground">
          MCP servers extend your agent with additional capabilities like web search, database access, or custom tools.
          Each server runs as a local process your agent can call during a session.
        </p>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-foreground">
            Server Configuration
          </label>
          {jsonValid !== null && (
            <span
              className={`text-xs font-medium ${
                jsonValid ? 'text-green-500' : 'text-destructive'
              }`}
            >
              {jsonValid ? 'Valid JSON' : 'Invalid JSON'}
            </span>
          )}
        </div>
        <textarea
          value={mcpJson}
          onChange={(e) => onChange({ mcpServersJson: e.target.value })}
          placeholder={`{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "@my/mcp-server"],
      "env": {
        "API_KEY": "..."
      }
    }
  }
}`}
          rows={14}
          className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Configure MCP servers available to this agent. Each key is a server name with its command and environment settings.
        </p>
      </div>
    </div>
  );
}
