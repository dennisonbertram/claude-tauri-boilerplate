import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import type { InstructionFile, RuleFile } from '@claude-tauri/shared';

const { createInstructionsRouter } = await import('./instructions');
const { Hono } = await import('hono');

describe('Instructions Routes', () => {
  let testApp: InstanceType<typeof Hono>;

  beforeEach(() => {
    testApp = new Hono();
    testApp.route('/api/instructions', createInstructionsRouter());
  });

  describe('GET /api/instructions', () => {
    test('returns 200 with files array', async () => {
      const res = await testApp.request('/api/instructions');
      expect(res.status).toBe(200);

      const body = await res.json() as { files: InstructionFile[] };
      expect(body).toHaveProperty('files');
      expect(Array.isArray(body.files)).toBe(true);
    });

    test('each file has required properties', async () => {
      const res = await testApp.request('/api/instructions');
      const body = await res.json() as { files: InstructionFile[] };

      for (const file of body.files) {
        expect(file).toHaveProperty('path');
        expect(file).toHaveProperty('level');
        expect(file).toHaveProperty('content');
        expect(file).toHaveProperty('exists');
        expect(typeof file.path).toBe('string');
        expect(typeof file.content).toBe('string');
        expect(typeof file.exists).toBe('boolean');
        expect(['project', 'user', 'global', 'managed']).toContain(file.level);
      }
    });

    test('returns exactly 4 candidate paths', async () => {
      const res = await testApp.request('/api/instructions');
      const body = await res.json() as { files: InstructionFile[] };

      // Should check: CWD/CLAUDE.md, CWD/.claude/CLAUDE.md, ~/.claude/CLAUDE.md, /Library/...
      expect(body.files.length).toBe(4);
    });

    test('includes project, user, and global level files', async () => {
      const res = await testApp.request('/api/instructions');
      const body = await res.json() as { files: InstructionFile[] };

      const levels = body.files.map((f) => f.level);
      expect(levels).toContain('project');
      expect(levels).toContain('user');
      expect(levels).toContain('global');
    });

    test('returns exists: false for non-existent files', async () => {
      const res = await testApp.request('/api/instructions');
      const body = await res.json() as { files: InstructionFile[] };

      // The global-level file almost certainly doesn't exist
      const globalFile = body.files.find((f) => f.level === 'global');
      expect(globalFile).toBeDefined();
      expect(globalFile!.exists).toBe(false);
      expect(globalFile!.content).toBe('');
    });

    test('returns exactly one entry with level "project"', async () => {
      const res = await testApp.request('/api/instructions');
      const body = await res.json() as { files: InstructionFile[] };

      const projectFiles = body.files.filter((f) => f.level === 'project');
      expect(projectFiles.length).toBe(1);
    });

    test('.claude/CLAUDE.md entry has level "managed"', async () => {
      const res = await testApp.request('/api/instructions');
      const body = await res.json() as { files: InstructionFile[] };

      const managedFile = body.files.find((f) =>
        f.path.endsWith(join('.claude', 'CLAUDE.md'))
      );
      expect(managedFile).toBeDefined();
      expect(managedFile!.level).toBe('managed');
    });
  });

  describe('GET /api/instructions/rules', () => {
    test('returns 200 with rules array', async () => {
      const res = await testApp.request('/api/instructions/rules');
      expect(res.status).toBe(200);

      const body = await res.json() as { rules: RuleFile[] };
      expect(body).toHaveProperty('rules');
      expect(Array.isArray(body.rules)).toBe(true);
    });

    test('each rule has required properties', async () => {
      const res = await testApp.request('/api/instructions/rules');
      const body = await res.json() as { rules: RuleFile[] };

      for (const rule of body.rules) {
        expect(rule).toHaveProperty('path');
        expect(rule).toHaveProperty('name');
        expect(rule).toHaveProperty('content');
        expect(typeof rule.path).toBe('string');
        expect(typeof rule.name).toBe('string');
        expect(typeof rule.content).toBe('string');
        expect(rule.name.endsWith('.md')).toBe(true);
      }
    });
  });

  describe('PUT /api/instructions/:encodedPath', () => {
    const tmpDir = join(process.cwd(), '.test-tmp-instructions');
    const tmpFile = join(tmpDir, 'CLAUDE.md');

    beforeEach(() => {
      mkdirSync(tmpDir, { recursive: true });
      writeFileSync(tmpFile, '# Original content');
    });

    afterEach(() => {
      if (existsSync(tmpDir)) {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test('saves content to the specified path', async () => {
      const encoded = btoa(tmpFile);
      const res = await testApp.request(`/api/instructions/${encoded}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '# Updated content' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; path: string };
      expect(body.success).toBe(true);
      expect(body.path).toBe(tmpFile);

      // Verify file was actually written
      const file = Bun.file(tmpFile);
      const written = await file.text();
      expect(written).toBe('# Updated content');
    });

    test('returns 400 for invalid base64 path', async () => {
      const res = await testApp.request('/api/instructions/!!!invalid!!!', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'test' }),
      });

      expect(res.status).toBe(400);
    });

    test('returns 403 for non-CLAUDE.md paths', async () => {
      const encoded = btoa('/tmp/evil.txt');
      const res = await testApp.request(`/api/instructions/${encoded}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'malicious' }),
      });

      expect(res.status).toBe(403);
    });

    test('returns 400 when content is missing', async () => {
      const encoded = btoa(tmpFile);
      const res = await testApp.request(`/api/instructions/${encoded}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notContent: 123 }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/instructions/create', () => {
    const cwd = process.cwd();
    const targetFile = join(cwd, 'CLAUDE.md');

    afterEach(() => {
      // Clean up any test-created CLAUDE.md in the server's CWD
      if (existsSync(targetFile)) {
        rmSync(targetFile);
      }
    });

    test('creates CLAUDE.md when it does not exist', async () => {
      // Ensure no CLAUDE.md exists at CWD (apps/server/)
      if (existsSync(targetFile)) {
        rmSync(targetFile);
      }

      const res = await testApp.request('/api/instructions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '# New project file' }),
      });

      expect(res.status).toBe(201);
      const body = await res.json() as { success: boolean; path: string };
      expect(body.success).toBe(true);

      // Verify file was created
      const written = await Bun.file(targetFile).text();
      expect(written).toBe('# New project file');
    });

    test('returns 409 when CLAUDE.md already exists', async () => {
      // First create it
      writeFileSync(targetFile, '# Existing');

      const res = await testApp.request('/api/instructions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '# New file' }),
      });

      expect(res.status).toBe(409);
    });

    test('returns 400 when content is not a string', async () => {
      // Ensure file doesn't exist so we don't get 409
      if (existsSync(targetFile)) {
        rmSync(targetFile);
      }

      const res = await testApp.request('/api/instructions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 123 }),
      });

      expect(res.status).toBe(400);
    });
  });
});
