import { Hono } from 'hono';
import type { McpServerConfig } from '@claude-tauri/shared';
import {
  readMcpJson,
  writeMcpJson,
  toServerConfig,
  toJsonEntry,
  validateServerName,
} from '../services/mcp-config';

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
