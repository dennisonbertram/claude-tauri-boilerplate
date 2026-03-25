import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import type { McpServerConfig } from '@claude-tauri/shared';

/**
 * .mcp.json file format:
 * {
 *   "mcpServers": {
 *     "server-name": {
 *       "type": "stdio",
 *       "command": "node",
 *       "args": ["./server.js"],
 *       "env": { "KEY": "value" },
 *       "disabled": true  // optional, indicates server is disabled
 *     }
 *   }
 * }
 */

export interface McpJsonEntry {
  type?: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  disabled?: boolean;
}

export interface McpJsonFile {
  mcpServers: Record<string, McpJsonEntry>;
}

export function isWorkspaceRoot(dir: string): boolean {
  const packageJsonPath = join(dir, 'package.json');
  if (!existsSync(packageJsonPath)) return false;

  try {
    const content = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      workspaces?: unknown;
    };
    return Array.isArray(content.workspaces);
  } catch {
    return false;
  }
}

export function getMcpConfigRoot(): string {
  let currentDir = process.cwd();
  let workspaceRoot: string | null = null;
  let discoveredConfigRoot: string | null = null;

  while (true) {
    if (existsSync(join(currentDir, '.mcp.json'))) {
      discoveredConfigRoot = currentDir;
    }

    if (workspaceRoot === null && isWorkspaceRoot(currentDir)) {
      workspaceRoot = currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      if (workspaceRoot && existsSync(join(workspaceRoot, '.mcp.json'))) {
        return workspaceRoot;
      }
      return workspaceRoot ?? discoveredConfigRoot ?? process.cwd();
    }
    currentDir = parentDir;
  }
}

export function getMcpJsonPath(): string {
  return join(getMcpConfigRoot(), '.mcp.json');
}

export async function readMcpJson(): Promise<McpJsonFile> {
  try {
    const file = Bun.file(getMcpJsonPath());
    const exists = await file.exists();
    if (!exists) return { mcpServers: {} };
    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<McpJsonFile>;
    return { mcpServers: parsed.mcpServers || {} };
  } catch {
    return { mcpServers: {} };
  }
}

export async function writeMcpJson(data: McpJsonFile): Promise<void> {
  await Bun.write(getMcpJsonPath(), JSON.stringify(data, null, 2) + '\n');
}

/** Names or commands that identify internal/infrastructure MCP servers. */
export const INTERNAL_SERVER_NAMES = new Set(['claude-code', 'claude', 'claude-code-mcp']);
export const INTERNAL_COMMANDS = new Set(['claude', 'claude-code']);

export function isInternalServer(name: string, entry: McpJsonEntry): boolean {
  if (INTERNAL_SERVER_NAMES.has(name.toLowerCase())) return true;
  if (entry.command && INTERNAL_COMMANDS.has(entry.command.toLowerCase())) return true;
  return false;
}

export interface McpServerConfigWithMeta extends McpServerConfig {
  isInternal?: boolean;
}

export function toServerConfig(name: string, entry: McpJsonEntry): McpServerConfigWithMeta {
  const serverType = entry.type || 'stdio';
  const config: McpServerConfigWithMeta = {
    name,
    type: serverType,
    enabled: !entry.disabled,
    isInternal: isInternalServer(name, entry),
  };

  if (serverType === 'stdio') {
    if (entry.command) config.command = entry.command;
    if (entry.args) config.args = entry.args;
    if (entry.env) config.env = entry.env;
  } else {
    if (entry.url) config.url = entry.url;
    if (entry.headers) config.headers = entry.headers;
  }

  return config;
}

export function toJsonEntry(config: Partial<McpServerConfig> & { enabled?: boolean }): McpJsonEntry {
  const entry: McpJsonEntry = {};

  if (config.type) entry.type = config.type;
  if (config.command !== undefined) entry.command = config.command;
  if (config.args !== undefined) entry.args = config.args;
  if (config.env !== undefined) entry.env = config.env;
  if (config.url !== undefined) entry.url = config.url;
  if (config.headers !== undefined) entry.headers = config.headers;
  if (config.enabled === false) entry.disabled = true;

  return entry;
}

export function validateServerName(name: string): string | null {
  if (!name || typeof name !== 'string') return 'name is required';
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    return 'Invalid server name';
  }
  return null;
}
