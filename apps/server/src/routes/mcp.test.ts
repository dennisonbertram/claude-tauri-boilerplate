import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { join } from 'path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import type { McpServerConfig } from '@claude-tauri/shared';

const { createMcpRouter } = await import('./mcp');
const { Hono } = await import('hono');

describe('MCP Routes', () => {
  let testApp: InstanceType<typeof Hono>;
  let originalCwd: () => string;
  let tmpDir: string;
  let nestedServerDir: string;

  beforeEach(() => {
    // Create temp directory and point CWD at it
    tmpDir = mkdtempSync(join(tmpdir(), 'claude-tauri-mcp-'));
    nestedServerDir = join(tmpDir, 'apps', 'server');
    mkdirSync(nestedServerDir, { recursive: true });
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify({ private: true, workspaces: ['apps/*', 'packages/*'] }, null, 2)
    );
    originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    testApp = new Hono();
    testApp.route('/api/mcp', createMcpRouter());
  });

  afterEach(() => {
    process.cwd = originalCwd;
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  function writeMcpJson(content: object) {
    writeFileSync(join(tmpDir, '.mcp.json'), JSON.stringify(content, null, 2));
  }

  describe('GET /api/mcp/servers', () => {
    test('returns empty list when no .mcp.json exists', async () => {
      const res = await testApp.request('/api/mcp/servers');
      expect(res.status).toBe(200);

      const body = (await res.json()) as { servers: McpServerConfig[] };
      expect(body.servers).toEqual([]);
    });

    test('returns server list from .mcp.json', async () => {
      writeMcpJson({
        mcpServers: {
          'my-server': {
            type: 'stdio',
            command: 'node',
            args: ['./server.js'],
            env: { API_KEY: 'test' },
          },
          'weather-api': {
            type: 'http',
            url: 'https://api.weather.com/mcp',
            disabled: true,
          },
        },
      });

      const res = await testApp.request('/api/mcp/servers');
      expect(res.status).toBe(200);

      const body = (await res.json()) as { servers: McpServerConfig[] };
      expect(body.servers.length).toBe(2);

      const stdio = body.servers.find((s) => s.name === 'my-server');
      expect(stdio).toBeDefined();
      expect(stdio!.type).toBe('stdio');
      expect(stdio!.command).toBe('node');
      expect(stdio!.args).toEqual(['./server.js']);
      expect(stdio!.env).toEqual({ API_KEY: 'test' });
      expect(stdio!.enabled).toBe(true);

      const http = body.servers.find((s) => s.name === 'weather-api');
      expect(http).toBeDefined();
      expect(http!.type).toBe('http');
      expect(http!.url).toBe('https://api.weather.com/mcp');
      expect(http!.enabled).toBe(false);
    });

    test('defaults type to stdio when not specified', async () => {
      writeMcpJson({
        mcpServers: {
          'legacy-server': {
            command: 'python',
            args: ['server.py'],
          },
        },
      });

      const res = await testApp.request('/api/mcp/servers');
      const body = (await res.json()) as { servers: McpServerConfig[] };
      expect(body.servers[0].type).toBe('stdio');
    });

    test('resolves the repo root .mcp.json when launched from apps/server', async () => {
      process.cwd = () => nestedServerDir;
      writeMcpJson({
        mcpServers: {
          playwright: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@playwright/mcp@latest'],
          },
        },
      });

      const res = await testApp.request('/api/mcp/servers');
      expect(res.status).toBe(200);

      const body = (await res.json()) as { servers: McpServerConfig[] };
      expect(body.servers).toHaveLength(1);
      expect(body.servers[0].name).toBe('playwright');
      expect(body.servers[0].command).toBe('npx');
    });

    test('prefers the workspace root .mcp.json over a nested apps/server copy', async () => {
      process.cwd = () => nestedServerDir;
      writeMcpJson({
        mcpServers: {
          playwright: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@playwright/mcp@latest', '--browser', 'chrome'],
          },
        },
      });
      writeFileSync(
        join(nestedServerDir, '.mcp.json'),
        JSON.stringify({
          mcpServers: {
            stale: {
              type: 'stdio',
              command: 'node',
              args: ['stale-server.js'],
            },
          },
        })
      );

      const res = await testApp.request('/api/mcp/servers');
      expect(res.status).toBe(200);

      const body = (await res.json()) as { servers: McpServerConfig[] };
      expect(body.servers).toHaveLength(1);
      expect(body.servers[0].name).toBe('playwright');
      expect(body.servers[0].args).toContain('chrome');
    });
  });

  describe('POST /api/mcp/servers', () => {
    test('adds a new stdio server', async () => {
      const res = await testApp.request('/api/mcp/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'test-server',
          type: 'stdio',
          command: 'node',
          args: ['./index.js'],
          env: { PORT: '8080' },
        }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as { success: boolean; server: McpServerConfig };
      expect(body.success).toBe(true);
      expect(body.server.name).toBe('test-server');
      expect(body.server.type).toBe('stdio');
      expect(body.server.command).toBe('node');
      expect(body.server.enabled).toBe(true);

      // Verify file was written
      const file = Bun.file(join(tmpDir, '.mcp.json'));
      const written = JSON.parse(await file.text()) as { mcpServers: Record<string, unknown> };
      expect(written.mcpServers['test-server']).toBeDefined();
    });

    test('adds a new http server', async () => {
      const res = await testApp.request('/api/mcp/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'api-server',
          type: 'http',
          url: 'https://example.com/mcp',
          headers: { Authorization: 'Bearer token' },
        }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as { success: boolean; server: McpServerConfig };
      expect(body.server.type).toBe('http');
      expect(body.server.url).toBe('https://example.com/mcp');
    });

    test('writes new servers to the repo root .mcp.json when launched from apps/server', async () => {
      process.cwd = () => nestedServerDir;

      const res = await testApp.request('/api/mcp/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'playwright',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@playwright/mcp@latest'],
        }),
      });

      expect(res.status).toBe(201);
      expect(existsSync(join(tmpDir, '.mcp.json'))).toBe(true);
      expect(existsSync(join(nestedServerDir, '.mcp.json'))).toBe(false);
    });

    test('rejects duplicate server name', async () => {
      writeMcpJson({
        mcpServers: {
          existing: { type: 'stdio', command: 'node' },
        },
      });

      const res = await testApp.request('/api/mcp/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'existing',
          type: 'stdio',
          command: 'bun',
        }),
      });

      expect(res.status).toBe(409);
    });

    test('rejects missing name', async () => {
      const res = await testApp.request('/api/mcp/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'stdio',
          command: 'node',
        }),
      });

      expect(res.status).toBe(400);
    });

    test('rejects stdio without command', async () => {
      const res = await testApp.request('/api/mcp/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'bad-server',
          type: 'stdio',
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('command');
    });

    test('rejects http without url', async () => {
      const res = await testApp.request('/api/mcp/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'bad-http',
          type: 'http',
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('url');
    });

    test('rejects sse without url', async () => {
      const res = await testApp.request('/api/mcp/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'bad-sse',
          type: 'sse',
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('url');
    });

    test('rejects invalid type', async () => {
      const res = await testApp.request('/api/mcp/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'bad-type',
          type: 'websocket',
          url: 'ws://localhost',
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/mcp/servers/:name', () => {
    test('updates server config', async () => {
      writeMcpJson({
        mcpServers: {
          'my-server': { type: 'stdio', command: 'node', args: ['old.js'] },
        },
      });

      const res = await testApp.request('/api/mcp/servers/my-server', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          args: ['new.js'],
          env: { NEW: 'var' },
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; server: McpServerConfig };
      expect(body.success).toBe(true);
      expect(body.server.args).toEqual(['new.js']);
      expect(body.server.env).toEqual({ NEW: 'var' });
      expect(body.server.command).toBe('node'); // unchanged
    });

    test('returns 404 for non-existent server', async () => {
      const res = await testApp.request('/api/mcp/servers/nonexistent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'bun' }),
      });

      expect(res.status).toBe(404);
    });

    test('rejects update that removes required field', async () => {
      writeMcpJson({
        mcpServers: {
          'my-server': { type: 'stdio', command: 'node' },
        },
      });

      const res = await testApp.request('/api/mcp/servers/my-server', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: '', // empty string = no command
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/mcp/servers/:name', () => {
    test('removes a server', async () => {
      writeMcpJson({
        mcpServers: {
          'server-a': { type: 'stdio', command: 'node' },
          'server-b': { type: 'http', url: 'https://example.com' },
        },
      });

      const res = await testApp.request('/api/mcp/servers/server-a', {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);

      // Verify it was removed
      const file = Bun.file(join(tmpDir, '.mcp.json'));
      const written = JSON.parse(await file.text()) as { mcpServers: Record<string, unknown> };
      expect(written.mcpServers['server-a']).toBeUndefined();
      expect(written.mcpServers['server-b']).toBeDefined();
    });

    test('returns 404 for non-existent server', async () => {
      const res = await testApp.request('/api/mcp/servers/nonexistent', {
        method: 'DELETE',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/mcp/servers/:name/toggle', () => {
    test('disables an enabled server', async () => {
      writeMcpJson({
        mcpServers: {
          'my-server': { type: 'stdio', command: 'node' },
        },
      });

      const res = await testApp.request('/api/mcp/servers/my-server/toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; server: McpServerConfig };
      expect(body.server.enabled).toBe(false);

      // Verify file
      const file = Bun.file(join(tmpDir, '.mcp.json'));
      const written = JSON.parse(await file.text()) as {
        mcpServers: Record<string, { disabled?: boolean }>;
      };
      expect(written.mcpServers['my-server'].disabled).toBe(true);
    });

    test('enables a disabled server', async () => {
      writeMcpJson({
        mcpServers: {
          'my-server': { type: 'stdio', command: 'node', disabled: true },
        },
      });

      const res = await testApp.request('/api/mcp/servers/my-server/toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; server: McpServerConfig };
      expect(body.server.enabled).toBe(true);
    });

    test('returns 404 for non-existent server', async () => {
      const res = await testApp.request('/api/mcp/servers/nonexistent/toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });

      expect(res.status).toBe(404);
    });

    test('rejects non-boolean enabled', async () => {
      writeMcpJson({
        mcpServers: {
          'my-server': { type: 'stdio', command: 'node' },
        },
      });

      const res = await testApp.request('/api/mcp/servers/my-server/toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: 'yes' }),
      });

      expect(res.status).toBe(400);
    });
  });
});
