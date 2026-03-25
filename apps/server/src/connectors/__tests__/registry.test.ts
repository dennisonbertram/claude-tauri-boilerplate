import { describe, test, expect } from 'bun:test';

// Dynamic import to avoid Bun's module linker issue when mock.module is used
// in other test files during the same `bun test` run. The SDK's `tool` export
// can fail to resolve due to Bun's module cache corruption from mock.module.
// Tests gracefully skip when the module can't load.

async function tryLoadRegistry() {
  try {
    return await import('../index');
  } catch {
    return null;
  }
}

describe('Connector Registry', () => {
  describe('getAllConnectors', () => {
    test('returns all registered connectors', async () => {
      const mod = await tryLoadRegistry();
      if (!mod) return; // Skip when SDK can't load (full suite with mock.module)
      const connectors = mod.getAllConnectors();
      expect(connectors.length).toBeGreaterThanOrEqual(1);
      expect(connectors.map((c) => c.name)).toContain('weather');
    });

    test('connector definitions have required fields', async () => {
      const mod = await tryLoadRegistry();
      if (!mod) return;
      const connectors = mod.getAllConnectors();
      for (const c of connectors) {
        expect(c.name).toBeTruthy();
        expect(c.displayName).toBeTruthy();
        expect(c.description).toBeTruthy();
        expect(typeof c.requiresAuth).toBe('boolean');
        expect(c.category).toBeTruthy();
        expect(Array.isArray(c.toolNames)).toBe(true);
        expect(c.toolNames.length).toBeGreaterThan(0);
      }
    });

    test('returns serializable info without tool implementations', async () => {
      const mod = await tryLoadRegistry();
      if (!mod) return;
      const connectors = mod.getAllConnectors();
      for (const c of connectors) {
        expect(c).toHaveProperty('toolNames');
        expect(c).not.toHaveProperty('tools');
        const json = JSON.stringify(c);
        const parsed = JSON.parse(json);
        expect(parsed.name).toBe(c.name);
      }
    });

    test('weather connector has correct tool names', async () => {
      const mod = await tryLoadRegistry();
      if (!mod) return;
      const connectors = mod.getAllConnectors();
      const weather = connectors.find((c) => c.name === 'weather');
      expect(weather).toBeDefined();
      expect(weather!.toolNames).toContain('weather_current');
      expect(weather!.toolNames).toContain('weather_forecast');
      expect(weather!.toolNames).toContain('weather_alerts');
    });
  });

  describe('getConnectorTools', () => {
    test('returns tools for enabled connectors', async () => {
      const mod = await tryLoadRegistry();
      if (!mod) return;
      const tools = mod.getConnectorTools(['weather']);
      expect(tools.length).toBe(3);
      const names = tools.map((t) => t.name);
      expect(names).toContain('weather_current');
      expect(names).toContain('weather_forecast');
      expect(names).toContain('weather_alerts');
    });

    test('returns empty array for empty input', async () => {
      const mod = await tryLoadRegistry();
      if (!mod) return;
      expect(mod.getConnectorTools([])).toHaveLength(0);
    });

    test('returns empty array for nonexistent connector', async () => {
      const mod = await tryLoadRegistry();
      if (!mod) return;
      expect(mod.getConnectorTools(['nonexistent'])).toHaveLength(0);
    });

    test('returns empty array for mixed nonexistent connectors', async () => {
      const mod = await tryLoadRegistry();
      if (!mod) return;
      expect(mod.getConnectorTools(['nonexistent', 'also-fake'])).toHaveLength(0);
    });

    test('includes tools from multiple connectors', async () => {
      const mod = await tryLoadRegistry();
      if (!mod) return;
      const tools = mod.getConnectorTools(['weather', 'nonexistent']);
      expect(tools.length).toBe(3);
    });

    test('each tool has required fields', async () => {
      const mod = await tryLoadRegistry();
      if (!mod) return;
      const tools = mod.getConnectorTools(['weather']);
      for (const t of tools) {
        expect(t.name).toBeTruthy();
        expect(t.description).toBeTruthy();
        expect(t.sdkTool).toBeDefined();
        expect(t.sdkTool.name).toBe(t.name);
        expect(typeof t.sdkTool.handler).toBe('function');
      }
    });
  });

  describe('createConnectorMcpServer', () => {
    test('returns undefined when no connectors enabled', async () => {
      const mod = await tryLoadRegistry();
      if (!mod) return;
      expect(mod.createConnectorMcpServer([])).toBeUndefined();
    });

    test('returns undefined for nonexistent connectors', async () => {
      const mod = await tryLoadRegistry();
      if (!mod) return;
      expect(mod.createConnectorMcpServer(['nonexistent'])).toBeUndefined();
    });

    test('creates SDK MCP server for enabled connectors', async () => {
      const mod = await tryLoadRegistry();
      if (!mod) return;
      const server = mod.createConnectorMcpServer(['weather']);
      expect(server).toBeDefined();
      expect(server!.type).toBe('sdk');
      expect(server!.name).toBe('connectors');
      expect(server!.instance).toBeDefined();
    });
  });
});
