import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import type { SessionMcpServer } from '@claude-tauri/shared';
import { getSessionMcpOverrides, setSessionMcpOverride, deleteSessionMcpOverride } from '../db';
import { readMcpJson, toServerConfig, isInternalServer } from '../services/mcp-config';
import { getAllConnectors } from '../connectors';

export function createSessionMcpRouter(db: Database) {
  const router = new Hono();

  // GET /:id/mcp-servers — merged view of global + session overrides + built-in connectors
  router.get('/:id/mcp-servers', async (c) => {
    const sessionId = c.req.param('id');
    const globalData = await readMcpJson();
    const overrides = getSessionMcpOverrides(db, sessionId);
    const overrideMap = new Map(overrides.map(o => [o.serverName, o.enabled]));

    // External MCP servers from .mcp.json
    const externalServers: SessionMcpServer[] = Object.entries(globalData.mcpServers)
      .filter(([name, entry]) => !isInternalServer(name, entry))
      .map(([name, entry]) => {
        const config = toServerConfig(name, entry);
        const hasOverride = overrideMap.has(name);
        const globalEnabled = config.enabled;
        const enabled = hasOverride ? !!overrideMap.get(name) : globalEnabled;
        return {
          name,
          type: config.type,
          enabled,
          globalEnabled,
          hasSessionOverride: hasOverride,
        };
      });

    // Built-in connectors from the connector registry
    const builtinServers: SessionMcpServer[] = getAllConnectors().map((connector) => {
      const hasOverride = overrideMap.has(connector.name);
      const globalEnabled = true; // built-in connectors default to enabled
      const enabled = hasOverride ? !!overrideMap.get(connector.name) : globalEnabled;
      return {
        name: connector.name,
        type: 'builtin',
        enabled,
        globalEnabled,
        hasSessionOverride: hasOverride,
      };
    });

    return c.json({ servers: [...builtinServers, ...externalServers] });
  });

  // PUT /:id/mcp-servers/:name — toggle a server for this session
  router.put('/:id/mcp-servers/:name', async (c) => {
    const sessionId = c.req.param('id');
    const serverName = c.req.param('name');
    const body = await c.req.json<{ enabled: boolean }>();

    if (typeof body.enabled !== 'boolean') {
      return c.json({ error: 'enabled must be a boolean', code: 'VALIDATION_ERROR' }, 400);
    }

    setSessionMcpOverride(db, sessionId, serverName, body.enabled);
    return c.json({ success: true });
  });

  // DELETE /:id/mcp-servers/:name — remove override (revert to global default)
  router.delete('/:id/mcp-servers/:name', async (c) => {
    const sessionId = c.req.param('id');
    const serverName = c.req.param('name');
    deleteSessionMcpOverride(db, sessionId, serverName);
    return c.json({ success: true });
  });

  return router;
}
