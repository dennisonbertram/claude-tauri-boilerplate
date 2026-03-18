import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { createDb, createProject } from '../db';
import { createGithubIssuesRouter, parseGhIssueOutput, parseGitBranchOutput } from './github-issues';
import { errorHandler } from '../middleware/error-handler';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let tempDir: string;
let repoPath: string;
let db: Database;
let app: Hono;
let projectId: string;

beforeAll(async () => {
  tempDir = join(tmpdir(), `github-issues-test-${Date.now()}`);
  repoPath = join(tempDir, 'repo');
  mkdirSync(repoPath, { recursive: true });

  // Initialize a minimal git repo
  Bun.spawnSync(['git', 'init'], { cwd: repoPath });
  Bun.spawnSync(['git', 'config', 'user.email', 'test@test.com'], { cwd: repoPath });
  Bun.spawnSync(['git', 'config', 'user.name', 'Test'], { cwd: repoPath });
  await Bun.write(join(repoPath, 'README.md'), '# Test');
  Bun.spawnSync(['git', 'add', '.'], { cwd: repoPath });
  Bun.spawnSync(['git', 'commit', '-m', 'initial'], { cwd: repoPath });

  // Create additional branches for branch listing tests
  Bun.spawnSync(['git', 'checkout', '-b', 'feature/auth'], { cwd: repoPath });
  Bun.spawnSync(['git', 'checkout', 'main'], { cwd: repoPath }).exitCode ||
    Bun.spawnSync(['git', 'checkout', '-b', 'main'], { cwd: repoPath });
  Bun.spawnSync(['git', 'branch', '-m', 'main'], { cwd: repoPath });
  Bun.spawnSync(['git', 'checkout', '-b', 'fix/bug-123'], { cwd: repoPath });
  Bun.spawnSync(['git', 'checkout', 'main'], { cwd: repoPath });
});

afterAll(() => {
  if (db) db.close();
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

beforeEach(() => {
  if (db) db.close();
  db = createDb(':memory:');

  const realpath = Bun.spawnSync(['realpath', repoPath]).stdout.toString().trim();
  const project = createProject(
    db,
    crypto.randomUUID(),
    'test-project',
    repoPath,
    realpath || repoPath,
    'main'
  );
  projectId = project.id;

  app = new Hono();
  app.onError(errorHandler);
  app.route('/api/projects', createGithubIssuesRouter(db));
});

// --- Unit tests for pure parsing functions ---

describe('parseGhIssueOutput', () => {
  test('parses valid gh issue list JSON', () => {
    const raw = JSON.stringify([
      { number: 42, title: 'Fix login bug', url: 'https://github.com/org/repo/issues/42', state: 'OPEN', body: 'Details' },
      { number: 99, title: 'Add dark mode', url: 'https://github.com/org/repo/issues/99', state: 'OPEN' },
    ]);
    const result = parseGhIssueOutput(raw);
    expect(result).toHaveLength(2);
    expect(result[0].number).toBe(42);
    expect(result[0].title).toBe('Fix login bug');
    expect(result[0].url).toBe('https://github.com/org/repo/issues/42');
    expect(result[0].body).toBe('Details');
    expect(result[1].number).toBe(99);
    expect(result[1].body).toBeUndefined();
  });

  test('returns empty array for invalid JSON', () => {
    expect(parseGhIssueOutput('not-json')).toEqual([]);
    expect(parseGhIssueOutput('')).toEqual([]);
    expect(parseGhIssueOutput('null')).toEqual([]);
  });

  test('filters out entries with missing number or title', () => {
    const raw = JSON.stringify([
      { number: 0, title: 'bad number', url: 'https://example.com', state: 'OPEN' },
      { number: 1, title: '', url: 'https://example.com', state: 'OPEN' },
      { number: 5, title: 'Valid issue', url: 'https://example.com', state: 'OPEN' },
    ]);
    const result = parseGhIssueOutput(raw);
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(5);
  });

  test('handles non-array JSON gracefully', () => {
    const raw = JSON.stringify({ error: 'not an array' });
    expect(parseGhIssueOutput(raw)).toEqual([]);
  });
});

describe('parseGitBranchOutput', () => {
  test('parses local branch listing', () => {
    const raw = `  main\n  feature/auth\n* fix/bug-123\n`;
    const result = parseGitBranchOutput(raw);
    expect(result.map((b) => b.name)).toContain('main');
    expect(result.map((b) => b.name)).toContain('feature/auth');
    expect(result.map((b) => b.name)).toContain('fix/bug-123');
  });

  test('strips origin/ prefix from remote branches', () => {
    const raw = `  origin/main\n  origin/feature/auth\n  origin/HEAD -> origin/main\n`;
    const result = parseGitBranchOutput(raw);
    expect(result.map((b) => b.name)).toContain('main');
    expect(result.map((b) => b.name)).toContain('feature/auth');
    // HEAD pointer should be filtered out
    expect(result.map((b) => b.name)).not.toContain('HEAD');
  });

  test('returns empty array for empty string', () => {
    expect(parseGitBranchOutput('')).toEqual([]);
    expect(parseGitBranchOutput('\n\n')).toEqual([]);
  });
});

// --- HTTP route tests ---

describe('GET /api/projects/:projectId/github-issues', () => {
  test('returns 404 for unknown project', async () => {
    const res = await app.request('/api/projects/no-such-project/github-issues');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('NOT_FOUND');
  });

  test('returns 404 for unknown project with query', async () => {
    const res = await app.request('/api/projects/no-such-project/github-issues?q=login');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('NOT_FOUND');
  });

  test('returns array or error for valid project (gh may not be available in test env)', async () => {
    const res = await app.request(`/api/projects/${projectId}/github-issues`);
    // Either 200 with array, 502/503 if gh unavailable - both are acceptable
    expect([200, 502, 503]).toContain(res.status);
    if (res.status === 200) {
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    }
  });

  test('accepts query parameter without error', async () => {
    const res = await app.request(`/api/projects/${projectId}/github-issues?q=authentication`);
    expect([200, 502, 503]).toContain(res.status);
  });
});

describe('GET /api/projects/:projectId/branches', () => {
  test('returns 404 for unknown project', async () => {
    const res = await app.request('/api/projects/no-such-project/branches');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('NOT_FOUND');
  });

  test('returns array of branches for valid project', async () => {
    const res = await app.request(`/api/projects/${projectId}/branches`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    // Should contain at least main/master
    const names = body.map((b: { name: string }) => b.name);
    expect(names.length).toBeGreaterThan(0);
  });

  test('branch list includes expected branches', async () => {
    const res = await app.request(`/api/projects/${projectId}/branches`);
    expect(res.status).toBe(200);
    const body = await res.json();
    const names = body.map((b: { name: string }) => b.name);
    // We created feature/auth and fix/bug-123 in beforeAll
    expect(names).toContain('feature/auth');
    expect(names).toContain('fix/bug-123');
  });

  test('branch list has correct shape', async () => {
    const res = await app.request(`/api/projects/${projectId}/branches`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
    const first = body[0];
    expect(typeof first.name).toBe('string');
    expect(typeof first.isCurrent).toBe('boolean');
  });

  test('does not include HEAD entries', async () => {
    const res = await app.request(`/api/projects/${projectId}/branches`);
    expect(res.status).toBe(200);
    const body = await res.json();
    const names = body.map((b: { name: string }) => b.name);
    expect(names).not.toContain('HEAD');
    expect(names.some((n: string) => n.includes('HEAD'))).toBe(false);
  });
});
