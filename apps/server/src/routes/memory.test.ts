import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { join, resolve } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import type { MemoryFile, MemorySearchResult } from '@claude-tauri/shared';

const { createMemoryRouter } = await import('./memory');
const { Hono } = await import('hono');

// Use a temp directory as the memory dir.
// PROJECT_ROOT is computed the same way as in memory.ts:
//   import.meta.dir is apps/server/src/routes/, go up 4 levels to project root.
const PROJECT_ROOT = process.env.PROJECT_ROOT ?? resolve(import.meta.dir, '../../../..');
const tmpBase = join(process.cwd(), '.test-tmp-memory');
const projectHash = PROJECT_ROOT.replace(/\//g, '-');
const memoryDir = join(tmpBase, projectHash, 'memory');

describe('Memory Routes', () => {
  let testApp: InstanceType<typeof Hono>;

  beforeEach(() => {
    // Set up env to use our temp dir
    process.env.CLAUDE_MEMORY_DIR = tmpBase;

    // Create temp memory directory with test files
    mkdirSync(memoryDir, { recursive: true });
    writeFileSync(
      join(memoryDir, 'MEMORY.md'),
      '# Project Memory\n\nKey facts about this project.\n\n## API Keys\nStored in ~/.zshrc'
    );
    writeFileSync(
      join(memoryDir, 'debugging.md'),
      '# Debugging Notes\n\nCommon issues:\n- Port 3131 already in use\n- Missing env vars'
    );
    writeFileSync(
      join(memoryDir, 'patterns.md'),
      '# Code Patterns\n\nUse Hono for routing.\nUse Bun for testing.'
    );

    testApp = new Hono();
    testApp.route('/api/memory', createMemoryRouter());
  });

  afterEach(() => {
    delete process.env.CLAUDE_MEMORY_DIR;
    if (existsSync(tmpBase)) {
      rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  describe('GET /api/memory', () => {
    test('returns 200 with files array and memoryDir', async () => {
      const res = await testApp.request('/api/memory');
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        files: MemoryFile[];
        memoryDir: string;
      };
      expect(body).toHaveProperty('files');
      expect(body).toHaveProperty('memoryDir');
      expect(Array.isArray(body.files)).toBe(true);
    });

    test('returns all .md files in memory directory', async () => {
      const res = await testApp.request('/api/memory');
      const body = (await res.json()) as { files: MemoryFile[] };

      expect(body.files.length).toBe(3);
      const names = body.files.map((f) => f.name);
      expect(names).toContain('MEMORY.md');
      expect(names).toContain('debugging.md');
      expect(names).toContain('patterns.md');
    });

    test('MEMORY.md is first (sorted as entrypoint)', async () => {
      const res = await testApp.request('/api/memory');
      const body = (await res.json()) as { files: MemoryFile[] };

      expect(body.files[0].name).toBe('MEMORY.md');
      expect(body.files[0].isEntrypoint).toBe(true);
    });

    test('each file has required properties', async () => {
      const res = await testApp.request('/api/memory');
      const body = (await res.json()) as { files: MemoryFile[] };

      for (const file of body.files) {
        expect(file).toHaveProperty('name');
        expect(file).toHaveProperty('path');
        expect(file).toHaveProperty('content');
        expect(file).toHaveProperty('isEntrypoint');
        expect(file).toHaveProperty('sizeBytes');
        expect(file).toHaveProperty('modifiedAt');
        expect(typeof file.name).toBe('string');
        expect(typeof file.path).toBe('string');
        expect(typeof file.content).toBe('string');
        expect(typeof file.isEntrypoint).toBe('boolean');
        expect(typeof file.sizeBytes).toBe('number');
        expect(typeof file.modifiedAt).toBe('string');
      }
    });

    test('returns empty array when memory dir is empty', async () => {
      // Remove all files
      rmSync(memoryDir, { recursive: true, force: true });
      mkdirSync(memoryDir, { recursive: true });

      const res = await testApp.request('/api/memory');
      const body = (await res.json()) as { files: MemoryFile[] };
      expect(body.files).toEqual([]);
    });
  });

  describe('GET /api/memory/:filename', () => {
    test('returns specific file', async () => {
      const res = await testApp.request('/api/memory/MEMORY.md');
      expect(res.status).toBe(200);

      const body = (await res.json()) as MemoryFile;
      expect(body.name).toBe('MEMORY.md');
      expect(body.isEntrypoint).toBe(true);
      expect(body.content).toContain('# Project Memory');
    });

    test('returns 404 for non-existent file', async () => {
      const res = await testApp.request('/api/memory/nonexistent.md');
      expect(res.status).toBe(404);
    });

    test('returns 400 for invalid filename', async () => {
      const res = await testApp.request('/api/memory/badfile.txt');
      expect(res.status).toBe(400);
    });

    test('returns 400 for path traversal attempt', async () => {
      const res = await testApp.request('/api/memory/..%2F..%2Fetc%2Fpasswd');
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/memory/:filename', () => {
    test('updates file content', async () => {
      const res = await testApp.request('/api/memory/MEMORY.md', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '# Updated Memory' }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; path: string };
      expect(body.success).toBe(true);

      // Verify file was written
      const file = Bun.file(join(memoryDir, 'MEMORY.md'));
      const written = await file.text();
      expect(written).toBe('# Updated Memory');
    });

    test('returns 404 for non-existent file', async () => {
      const res = await testApp.request('/api/memory/nonexistent.md', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'test' }),
      });

      expect(res.status).toBe(404);
    });

    test('returns 400 when content is not a string', async () => {
      const res = await testApp.request('/api/memory/MEMORY.md', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 123 }),
      });

      expect(res.status).toBe(400);
    });

    test('returns 400 for invalid filename', async () => {
      const res = await testApp.request('/api/memory/badfile.txt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'test' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/memory', () => {
    test('creates a new memory file', async () => {
      const res = await testApp.request('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'new-topic.md',
          content: '# New Topic\n\nSome content.',
        }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as { success: boolean; path: string };
      expect(body.success).toBe(true);

      // Verify file was created
      const file = Bun.file(join(memoryDir, 'new-topic.md'));
      const written = await file.text();
      expect(written).toBe('# New Topic\n\nSome content.');
    });

    test('returns 409 when file already exists', async () => {
      const res = await testApp.request('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'MEMORY.md',
          content: 'duplicate',
        }),
      });

      expect(res.status).toBe(409);
    });

    test('rejects names without .md extension', async () => {
      const res = await testApp.request('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'noextension',
          content: 'test',
        }),
      });

      expect(res.status).toBe(400);
    });

    test('rejects names with path traversal', async () => {
      const res = await testApp.request('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '../../../etc/passwd.md',
          content: 'malicious',
        }),
      });

      expect(res.status).toBe(400);
    });

    test('rejects names with path separators', async () => {
      const res = await testApp.request('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'sub/dir.md',
          content: 'test',
        }),
      });

      expect(res.status).toBe(400);
    });

    test('returns 400 when name or content missing', async () => {
      const res = await testApp.request('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'no name' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/memory/:filename', () => {
    test('deletes a topic file', async () => {
      const res = await testApp.request('/api/memory/debugging.md', {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);

      // Verify file was deleted
      expect(existsSync(join(memoryDir, 'debugging.md'))).toBe(false);
    });

    test('returns 403 for MEMORY.md', async () => {
      const res = await testApp.request('/api/memory/MEMORY.md', {
        method: 'DELETE',
      });

      expect(res.status).toBe(403);

      // Verify file still exists
      expect(existsSync(join(memoryDir, 'MEMORY.md'))).toBe(true);
    });

    test('returns 404 for non-existent file', async () => {
      const res = await testApp.request('/api/memory/nonexistent.md', {
        method: 'DELETE',
      });

      expect(res.status).toBe(404);
    });

    test('returns 400 for invalid filename', async () => {
      const res = await testApp.request('/api/memory/badfile.txt', {
        method: 'DELETE',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/memory/search', () => {
    test('returns matching results', async () => {
      const res = await testApp.request('/api/memory/search?q=Port');
      expect(res.status).toBe(200);

      const body = (await res.json()) as { results: MemorySearchResult[] };
      expect(body.results.length).toBeGreaterThan(0);

      const result = body.results[0];
      expect(result).toHaveProperty('file');
      expect(result).toHaveProperty('line');
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('context');
      expect(result.text.toLowerCase()).toContain('port');
    });

    test('returns empty results for no match', async () => {
      const res = await testApp.request(
        '/api/memory/search?q=zzzznonexistentzzzz'
      );
      const body = (await res.json()) as { results: MemorySearchResult[] };
      expect(body.results).toEqual([]);
    });

    test('returns empty results when query is empty', async () => {
      const res = await testApp.request('/api/memory/search?q=');
      const body = (await res.json()) as { results: MemorySearchResult[] };
      expect(body.results).toEqual([]);
    });

    test('search is case-insensitive', async () => {
      const res = await testApp.request('/api/memory/search?q=hono');
      const body = (await res.json()) as { results: MemorySearchResult[] };
      expect(body.results.length).toBeGreaterThan(0);
      // The actual file has "Hono" (capitalized)
      expect(body.results[0].text).toContain('Hono');
    });

    test('results include correct file name', async () => {
      const res = await testApp.request('/api/memory/search?q=Debugging');
      const body = (await res.json()) as { results: MemorySearchResult[] };
      expect(body.results.length).toBeGreaterThan(0);
      expect(body.results[0].file).toBe('debugging.md');
    });
  });
});
