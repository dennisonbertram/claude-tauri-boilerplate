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
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-foreground">
            MCP Servers JSON
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
          Configure MCP (Model Context Protocol) servers that this agent profile
          can connect to. Each server provides additional tools and context.
        </p>
      </div>
    </div>
  );
}
