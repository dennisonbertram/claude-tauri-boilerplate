import { Hono } from 'hono';
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

interface McpJsonEntry {
  type?: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  disabled?: boolean;
}

interface McpJsonFile {
  mcpServers: Record<string, McpJsonEntry>;
}

function getMcpJsonPath(): string {
  return join(getMcpConfigRoot(), '.mcp.json');
}

function isWorkspaceRoot(dir: string): boolean {
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

function getMcpConfigRoot(): string {
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

async function readMcpJson(): Promise<McpJsonFile> {
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

async function writeMcpJson(data: McpJsonFile): Promise<void> {
  await Bun.write(getMcpJsonPath(), JSON.stringify(data, null, 2) + '\n');
}

/** Names or commands that identify internal/infrastructure MCP servers. */
const INTERNAL_SERVER_NAMES = new Set(['claude-code', 'claude', 'claude-code-mcp']);
const INTERNAL_COMMANDS = new Set(['claude', 'claude-code']);

function isInternalServer(name: string, entry: McpJsonEntry): boolean {
  if (INTERNAL_SERVER_NAMES.has(name.toLowerCase())) return true;
  if (entry.command && INTERNAL_COMMANDS.has(entry.command.toLowerCase())) return true;
  return false;
}

interface McpServerConfigWithMeta extends McpServerConfig {
  isInternal?: boolean;
}

function toServerConfig(name: string, entry: McpJsonEntry): McpServerConfigWithMeta {
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

function toJsonEntry(config: Partial<McpServerConfig> & { enabled?: boolean }): McpJsonEntry {
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

function validateServerName(name: string): string | null {
  if (!name || typeof name !== 'string') return 'name is required';
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    return 'Invalid server name';
  }
  return null;
}

export function createMcpRouter() {
  const mcpRouter = new Hono();

  // GET /api/mcp/servers - List all configured MCP servers
  mcpRouter.get('/servers', async (c) => {
    const data = await readMcpJson();
    const servers: McpServerConfig[] = Object.entries(data.mcpServers).map(
      ([name, entry]) => toServerConfig(name, entry)
    );
    return c.json({ servers });
  });

  // POST /api/mcp/servers - Add a new MCP server
  mcpRouter.post('/servers', async (c) => {
    const body = await c.req.json<Partial<McpServerConfig>>();

    // Validate name
    const nameError = validateServerName(body.name || '');
    if (nameError) {
      return c.json({ error: nameError }, 400);
    }

    // Validate type
    const serverType = body.type || 'stdio';
    if (!['stdio', 'http', 'sse'].includes(serverType)) {
      return c.json({ error: 'type must be stdio, http, or sse' }, 400);
    }

    // Validate required fields per type
    if (serverType === 'stdio' && !body.command) {
      return c.json({ error: 'command is required for stdio type' }, 400);
    }
    if ((serverType === 'http' || serverType === 'sse') && !body.url) {
      return c.json({ error: 'url is required for http/sse type' }, 400);
    }

    const data = await readMcpJson();
    const name = body.name!;

    // Check for duplicate name
    if (data.mcpServers[name]) {
      return c.json({ error: `Server "${name}" already exists` }, 409);
    }

    // Create entry (defaults to enabled)
    const entry = toJsonEntry({ ...body, enabled: body.enabled !== false });
    data.mcpServers[name] = entry;

    await writeMcpJson(data);
    return c.json({ success: true, server: toServerConfig(name, entry) }, 201);
  });

  // PUT /api/mcp/servers/:name - Update a server config
  mcpRouter.put('/servers/:name', async (c) => {
    const name = c.req.param('name');
    const nameError = validateServerName(name);
    if (nameError) return c.json({ error: nameError }, 400);

    const data = await readMcpJson();
    if (!data.mcpServers[name]) {
      return c.json({ error: `Server "${name}" not found` }, 404);
    }

    const body = await c.req.json<Partial<McpServerConfig>>();
    const existing = data.mcpServers[name];

    // Merge updates
    if (body.type !== undefined) existing.type = body.type;
    if (body.command !== undefined) existing.command = body.command;
    if (body.args !== undefined) existing.args = body.args;
    if (body.env !== undefined) existing.env = body.env;
    if (body.url !== undefined) existing.url = body.url;
    if (body.headers !== undefined) existing.headers = body.headers;
    if (body.enabled !== undefined) existing.disabled = !body.enabled;

    // Re-validate required fields after merge
    const currentType = existing.type || 'stdio';
    if (currentType === 'stdio' && !existing.command) {
      return c.json({ error: 'command is required for stdio type' }, 400);
    }
    if ((currentType === 'http' || currentType === 'sse') && !existing.url) {
      return c.json({ error: 'url is required for http/sse type' }, 400);
    }

    data.mcpServers[name] = existing;
    await writeMcpJson(data);

    return c.json({ success: true, server: toServerConfig(name, existing) });
  });

  // DELETE /api/mcp/servers/:name - Remove a server
  mcpRouter.delete('/servers/:name', async (c) => {
    const name = c.req.param('name');
    const nameError = validateServerName(name);
    if (nameError) return c.json({ error: nameError }, 400);

    const data = await readMcpJson();
    if (!data.mcpServers[name]) {
      return c.json({ error: `Server "${name}" not found` }, 404);
    }

    delete data.mcpServers[name];
    await writeMcpJson(data);

    return c.json({ success: true });
  });

  // PATCH /api/mcp/servers/:name/toggle - Enable/disable a server
  mcpRouter.patch('/servers/:name/toggle', async (c) => {
    const name = c.req.param('name');
    const nameError = validateServerName(name);
    if (nameError) return c.json({ error: nameError }, 400);

    const data = await readMcpJson();
    if (!data.mcpServers[name]) {
      return c.json({ error: `Server "${name}" not found` }, 404);
    }

    const body = await c.req.json<{ enabled: boolean }>();
    if (typeof body.enabled !== 'boolean') {
      return c.json({ error: 'enabled must be a boolean' }, 400);
    }

    data.mcpServers[name].disabled = !body.enabled;
    await writeMcpJson(data);

    return c.json({
      success: true,
      server: toServerConfig(name, data.mcpServers[name]),
    });
  });

  return mcpRouter;
}
