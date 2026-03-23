import type { McpServerConfig } from '@claude-tauri/shared';
import { getApiBase } from '@/lib/api-config';

export const API_BASE = getApiBase();

export const TYPE_STYLES: Record<McpServerConfig['type'], { label: string; className: string }> = {
  stdio: { label: 'stdio', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  http: { label: 'http', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  sse: { label: 'sse', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
};

export type ServerType = 'stdio' | 'http' | 'sse';

export interface AddServerForm {
  name: string;
  type: ServerType;
  command: string;
  args: string;
  env: string;
  url: string;
  headers: string;
}

export const EMPTY_FORM: AddServerForm = {
  name: '',
  type: 'stdio',
  command: '',
  args: '',
  env: '',
  url: '',
  headers: '',
};

export interface McpPreset {
  id: string;
  title: string;
  description: string;
  config: Omit<McpServerConfig, 'enabled'> & { enabled?: boolean };
}

export const MCP_PRESETS: McpPreset[] = [
  {
    id: 'agentation',
    title: 'Agentation Visual Feedback',
    description:
      'Optional MCP companion for visual annotations and interaction feedback. Separate from the agent-browser CLI workflow.',
    config: {
      name: 'agentation',
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'agentation-mcp', 'server'],
    },
  },
];

export function parseKeyValuePairs(input: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pairs = input.split(',');
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx > 0) {
      const key = pair.slice(0, eqIdx).trim();
      const value = pair.slice(eqIdx + 1).trim();
      if (key) result[key] = value;
    }
  }
  return result;
}
