import { describe, test, expect, mock, beforeEach, afterEach, afterAll } from 'bun:test';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';

const fixturePrefix = join(tmpdir(), 'issue-121-memory-');
const fixtureProjectRoot = mkdtempSync(fixturePrefix);
const fixtureHomeDir = mkdtempSync(fixturePrefix);

mock.module('os', () => ({
  homedir: () => fixtureHomeDir,
}));

process.env.PROJECT_ROOT = fixtureProjectRoot;
delete process.env.CLAUDE_MEMORY_DIR;

const { createMemoryRouter } = await import('./memory');
const { Hono } = await import('hono');

const PROJECT_HASH = fixtureProjectRoot.replace(/[/\\]/g, '-');
const expectedMemoryDir = join(
  fixtureHomeDir,
  '.claude',
  'projects',
  PROJECT_HASH,
  'memory'
);
const fixtureFileName = 'issue-121-regression.md';
const fixtureContent = '# Regression fixture memory file';

describe('Memory route default path regression', () => {
  const originalCwd = process.cwd();
  const externalCwd = mkdtempSync(join(tmpdir(), 'issue-121-cwd-'));
  let testApp: InstanceType<typeof Hono>;

  beforeEach(() => {
    process.chdir(externalCwd);
    mkdirSync(expectedMemoryDir, { recursive: true });
    writeFileSync(join(expectedMemoryDir, fixtureFileName), fixtureContent);

    testApp = new Hono();
    testApp.route('/api/memory', createMemoryRouter());
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  afterAll(() => {
    rmSync(fixtureProjectRoot, { recursive: true, force: true });
    rmSync(fixtureHomeDir, { recursive: true, force: true });
    rmSync(externalCwd, { recursive: true, force: true });
    delete process.env.CLAUDE_MEMORY_DIR;
    delete process.env.PROJECT_ROOT;
    delete process.env.HOME;
  });

  test('uses the project-root-derived memory path when env path overrides are absent', async () => {
    const res = await testApp.request('/api/memory');
    expect(res.status).toBe(200);

    const body = (await res.json()) as { files: { name: string }[]; memoryDir: string };
    expect(body.memoryDir).toBe(expectedMemoryDir);
    expect(body.files.map((f) => f.name)).toContain(fixtureFileName);

    const cwdBasedDir = join(fixtureHomeDir, '.claude', 'projects', process.cwd().replace(/[/\\]/g, '-'), 'memory');
    expect(body.memoryDir).not.toBe(cwdBasedDir);
  });
});
