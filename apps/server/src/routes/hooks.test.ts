import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import type { HookConfig, HookEventMeta } from '@claude-tauri/shared';

const { createHooksRouter } = await import('./hooks');
const { Hono } = await import('hono');

// Use a temp directory for .claude/settings.json
const tmpDir = join(process.cwd(), '.test-tmp-hooks');

describe('Hooks Routes', () => {
  let testApp: InstanceType<typeof Hono>;
  let originalCwd: () => string;

  beforeEach(() => {
    mkdirSync(join(tmpDir, '.claude'), { recursive: true });
    originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    testApp = new Hono();
    testApp.route('/api/hooks', createHooksRouter());
  });

  afterEach(() => {
    process.cwd = originalCwd;
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  function writeSettings(content: object) {
    writeFileSync(
      join(tmpDir, '.claude', 'settings.json'),
      JSON.stringify(content, null, 2)
    );
  }

  describe('GET /api/hooks/events', () => {
    test('returns hook event metadata', async () => {
      const res = await testApp.request('/api/hooks/events');
      expect(res.status).toBe(200);

      const body = (await res.json()) as { events: HookEventMeta[] };
      expect(body.events).toBeInstanceOf(Array);
      expect(body.events.length).toBeGreaterThan(0);

      // Check a known event
      const preToolUse = body.events.find((e) => e.event === 'PreToolUse');
      expect(preToolUse).toBeDefined();
      expect(preToolUse!.canBlock).toBe(true);
      expect(preToolUse!.supportsMatcher).toBe(true);
      expect(preToolUse!.description).toBe('Before tool execution');

      // Check an event that can't block
      const sessionStart = body.events.find((e) => e.event === 'SessionStart');
      expect(sessionStart).toBeDefined();
      expect(sessionStart!.canBlock).toBe(false);
      expect(sessionStart!.supportsMatcher).toBe(false);
    });

    test('includes all 12 events', async () => {
      const res = await testApp.request('/api/hooks/events');
      const body = (await res.json()) as { events: HookEventMeta[] };
      expect(body.events.length).toBe(12);
    });
  });

  describe('GET /api/hooks', () => {
    test('returns empty list when no settings.json exists', async () => {
      // Remove the .claude directory so there's no settings.json
      rmSync(join(tmpDir, '.claude'), { recursive: true, force: true });

      const res = await testApp.request('/api/hooks');
      expect(res.status).toBe(200);

      const body = (await res.json()) as { hooks: HookConfig[] };
      expect(body.hooks).toEqual([]);
    });

    test('returns empty list when no hooks section', async () => {
      writeSettings({ someOtherSetting: true });

      const res = await testApp.request('/api/hooks');
      expect(res.status).toBe(200);

      const body = (await res.json()) as { hooks: HookConfig[] };
      expect(body.hooks).toEqual([]);
    });

    test('returns flattened hook list from settings.json', async () => {
      writeSettings({
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                { type: 'command', command: 'bash ./hooks/scan-secrets.sh', timeout: 30 },
              ],
            },
          ],
          Stop: [
            {
              hooks: [
                { type: 'prompt', prompt: 'Verify all tasks complete' },
              ],
            },
          ],
        },
      });

      const res = await testApp.request('/api/hooks');
      expect(res.status).toBe(200);

      const body = (await res.json()) as { hooks: HookConfig[] };
      expect(body.hooks.length).toBe(2);

      const preToolHook = body.hooks.find((h) => h.event === 'PreToolUse');
      expect(preToolHook).toBeDefined();
      expect(preToolHook!.matcher).toBe('Bash');
      expect(preToolHook!.handler.type).toBe('command');
      expect(preToolHook!.handler.command).toBe('bash ./hooks/scan-secrets.sh');
      expect(preToolHook!.handler.timeout).toBe(30);
      expect(preToolHook!.enabled).toBe(true);

      const stopHook = body.hooks.find((h) => h.event === 'Stop');
      expect(stopHook).toBeDefined();
      expect(stopHook!.handler.type).toBe('prompt');
      expect(stopHook!.handler.prompt).toBe('Verify all tasks complete');
    });

    test('marks disabled hooks correctly', async () => {
      writeSettings({
        hooks: {
          PreToolUse: [
            {
              matcher: 'Write',
              hooks: [
                { type: 'command', command: 'echo test', _disabled: true },
              ],
            },
          ],
        },
      });

      const res = await testApp.request('/api/hooks');
      const body = (await res.json()) as { hooks: HookConfig[] };
      expect(body.hooks[0].enabled).toBe(false);
    });
  });

  describe('POST /api/hooks', () => {
    test('creates a new command hook', async () => {
      const res = await testApp.request('/api/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'PreToolUse',
          matcher: 'Bash',
          handler: {
            type: 'command',
            command: 'bash ./hooks/scan.sh',
            timeout: 60,
          },
        }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as { success: boolean; hook: HookConfig };
      expect(body.success).toBe(true);
      expect(body.hook.event).toBe('PreToolUse');
      expect(body.hook.matcher).toBe('Bash');
      expect(body.hook.handler.type).toBe('command');
      expect(body.hook.handler.command).toBe('bash ./hooks/scan.sh');
      expect(body.hook.enabled).toBe(true);

      // Verify it was persisted
      const file = Bun.file(join(tmpDir, '.claude', 'settings.json'));
      const settings = JSON.parse(await file.text());
      expect(settings.hooks).toBeDefined();
      expect(settings.hooks.PreToolUse).toBeDefined();
    });

    test('creates a new http hook', async () => {
      const res = await testApp.request('/api/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'Stop',
          handler: {
            type: 'http',
            url: 'https://hooks.example.com/notify',
            method: 'POST',
            headers: { Authorization: 'Bearer token' },
          },
        }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as { success: boolean; hook: HookConfig };
      expect(body.hook.handler.type).toBe('http');
      expect(body.hook.handler.url).toBe('https://hooks.example.com/notify');
    });

    test('creates a new prompt hook', async () => {
      const res = await testApp.request('/api/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'PostToolUse',
          matcher: 'Write',
          handler: {
            type: 'prompt',
            prompt: 'Check the output for correctness',
          },
        }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as { success: boolean; hook: HookConfig };
      expect(body.hook.handler.type).toBe('prompt');
      expect(body.hook.handler.prompt).toBe('Check the output for correctness');
    });

    test('rejects invalid event type', async () => {
      const res = await testApp.request('/api/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'InvalidEvent',
          handler: { type: 'command', command: 'echo hi' },
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('event');
    });

    test('rejects missing handler', async () => {
      const res = await testApp.request('/api/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'PreToolUse' }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('handler');
    });

    test('rejects command handler without command', async () => {
      const res = await testApp.request('/api/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'PreToolUse',
          handler: { type: 'command' },
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('command');
    });

    test('rejects http handler without url', async () => {
      const res = await testApp.request('/api/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'Stop',
          handler: { type: 'http' },
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('url');
    });

    test('rejects prompt handler without prompt', async () => {
      const res = await testApp.request('/api/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'Stop',
          handler: { type: 'prompt' },
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('prompt');
    });

    test('rejects invalid handler type', async () => {
      const res = await testApp.request('/api/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'Stop',
          handler: { type: 'websocket' },
        }),
      });

      expect(res.status).toBe(400);
    });

    test('preserves existing settings when adding hook', async () => {
      writeSettings({
        customSetting: 'keep-me',
        hooks: {
          Stop: [{ hooks: [{ type: 'command', command: 'echo existing' }] }],
        },
      });

      await testApp.request('/api/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'PreToolUse',
          handler: { type: 'command', command: 'echo new' },
        }),
      });

      const file = Bun.file(join(tmpDir, '.claude', 'settings.json'));
      const settings = JSON.parse(await file.text());
      expect(settings.customSetting).toBe('keep-me');
      expect(settings.hooks.Stop).toBeDefined();
      expect(settings.hooks.PreToolUse).toBeDefined();
    });
  });

  describe('PUT /api/hooks/:id', () => {
    test('updates hook handler', async () => {
      writeSettings({
        hooks: {
          PreToolUse: [
            { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo old' }] },
          ],
        },
      });

      const listRes = await testApp.request('/api/hooks');
      const listBody = (await listRes.json()) as { hooks: HookConfig[] };
      const hookId = listBody.hooks[0].id;

      const res = await testApp.request(`/api/hooks/${hookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handler: { command: 'echo new' },
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; hook: HookConfig };
      expect(body.success).toBe(true);
      expect(body.hook.handler.command).toBe('echo new');
      expect(body.hook.handler.type).toBe('command'); // unchanged
    });

    test('updates hook matcher', async () => {
      writeSettings({
        hooks: {
          PreToolUse: [
            { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo test' }] },
          ],
        },
      });

      const listRes = await testApp.request('/api/hooks');
      const listBody = (await listRes.json()) as { hooks: HookConfig[] };
      const hookId = listBody.hooks[0].id;

      const res = await testApp.request(`/api/hooks/${hookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matcher: 'Write' }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; hook: HookConfig };
      expect(body.hook.matcher).toBe('Write');
    });

    test('returns 404 for non-existent hook', async () => {
      const res = await testApp.request('/api/hooks/hook-999', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matcher: 'test' }),
      });

      expect(res.status).toBe(404);
    });

    test('rejects invalid event on update', async () => {
      writeSettings({
        hooks: {
          PreToolUse: [
            { hooks: [{ type: 'command', command: 'echo test' }] },
          ],
        },
      });

      const listRes = await testApp.request('/api/hooks');
      const listBody = (await listRes.json()) as { hooks: HookConfig[] };
      const hookId = listBody.hooks[0].id;

      const res = await testApp.request(`/api/hooks/${hookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'InvalidEvent' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/hooks/:id', () => {
    test('removes a hook', async () => {
      writeSettings({
        hooks: {
          PreToolUse: [
            { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo a' }] },
          ],
          Stop: [
            { hooks: [{ type: 'prompt', prompt: 'check' }] },
          ],
        },
      });

      const listRes = await testApp.request('/api/hooks');
      const listBody = (await listRes.json()) as { hooks: HookConfig[] };
      expect(listBody.hooks.length).toBe(2);

      const preToolHookId = listBody.hooks.find((h) => h.event === 'PreToolUse')!.id;

      const res = await testApp.request(`/api/hooks/${preToolHookId}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);

      // Verify only one hook remains
      const afterRes = await testApp.request('/api/hooks');
      const afterBody = (await afterRes.json()) as { hooks: HookConfig[] };
      expect(afterBody.hooks.length).toBe(1);
      expect(afterBody.hooks[0].event).toBe('Stop');
    });

    test('returns 404 for non-existent hook', async () => {
      const res = await testApp.request('/api/hooks/hook-999', {
        method: 'DELETE',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/hooks/:id/toggle', () => {
    test('disables an enabled hook', async () => {
      writeSettings({
        hooks: {
          PreToolUse: [
            { hooks: [{ type: 'command', command: 'echo test' }] },
          ],
        },
      });

      const listRes = await testApp.request('/api/hooks');
      const listBody = (await listRes.json()) as { hooks: HookConfig[] };
      const hookId = listBody.hooks[0].id;
      expect(listBody.hooks[0].enabled).toBe(true);

      const res = await testApp.request(`/api/hooks/${hookId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; hook: HookConfig };
      expect(body.hook.enabled).toBe(false);

      // Verify persistence
      const afterRes = await testApp.request('/api/hooks');
      const afterBody = (await afterRes.json()) as { hooks: HookConfig[] };
      expect(afterBody.hooks[0].enabled).toBe(false);
    });

    test('enables a disabled hook', async () => {
      writeSettings({
        hooks: {
          PreToolUse: [
            { hooks: [{ type: 'command', command: 'echo test', _disabled: true }] },
          ],
        },
      });

      const listRes = await testApp.request('/api/hooks');
      const listBody = (await listRes.json()) as { hooks: HookConfig[] };
      const hookId = listBody.hooks[0].id;
      expect(listBody.hooks[0].enabled).toBe(false);

      const res = await testApp.request(`/api/hooks/${hookId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; hook: HookConfig };
      expect(body.hook.enabled).toBe(true);
    });

    test('returns 404 for non-existent hook', async () => {
      const res = await testApp.request('/api/hooks/hook-999/toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });

      expect(res.status).toBe(404);
    });

    test('rejects non-boolean enabled', async () => {
      writeSettings({
        hooks: {
          PreToolUse: [
            { hooks: [{ type: 'command', command: 'echo test' }] },
          ],
        },
      });

      const listRes = await testApp.request('/api/hooks');
      const listBody = (await listRes.json()) as { hooks: HookConfig[] };
      const hookId = listBody.hooks[0].id;

      const res = await testApp.request(`/api/hooks/${hookId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: 'yes' }),
      });

      expect(res.status).toBe(400);
    });
  });
});
