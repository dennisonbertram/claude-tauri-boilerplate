import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadWorkspaceConfig } from './workspace-config';

/**
 * TDD tests for workspace-config loader.
 * These tests verify that .claude/workspace.toml is parsed correctly.
 */
describe('loadWorkspaceConfig', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = join(tmpdir(), `workspace-config-test-${crypto.randomUUID()}`);
    mkdirSync(repoDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  test('returns null when .claude/workspace.toml does not exist', async () => {
    const result = await loadWorkspaceConfig(repoDir);
    expect(result).toBeNull();
  });

  test('returns null when .claude directory does not exist', async () => {
    const result = await loadWorkspaceConfig('/nonexistent/path/12345');
    expect(result).toBeNull();
  });

  test('parses lifecycle section correctly', async () => {
    mkdirSync(join(repoDir, '.claude'), { recursive: true });
    writeFileSync(
      join(repoDir, '.claude', 'workspace.toml'),
      `[lifecycle]\nsetup = "npm install && npm run build"\nteardown = "npm run clean"\n`
    );

    const result = await loadWorkspaceConfig(repoDir);

    expect(result).not.toBeNull();
    expect(result!.lifecycle).toBeDefined();
    expect(result!.lifecycle!.setup).toBe('npm install && npm run build');
    expect(result!.lifecycle!.teardown).toBe('npm run clean');
  });

  test('parses env section correctly', async () => {
    mkdirSync(join(repoDir, '.claude'), { recursive: true });
    writeFileSync(
      join(repoDir, '.claude', 'workspace.toml'),
      `[env]\nPORT = "3000"\nNODE_ENV = "development"\n`
    );

    const result = await loadWorkspaceConfig(repoDir);

    expect(result).not.toBeNull();
    expect(result!.env).toBeDefined();
    expect(result!.env!.PORT).toBe('3000');
    expect(result!.env!.NODE_ENV).toBe('development');
  });

  test('parses preserve.files correctly', async () => {
    mkdirSync(join(repoDir, '.claude'), { recursive: true });
    writeFileSync(
      join(repoDir, '.claude', 'workspace.toml'),
      `[preserve]\nfiles = [".env.example", "config/local.sample.json"]\n`
    );

    const result = await loadWorkspaceConfig(repoDir);

    expect(result).not.toBeNull();
    expect(result!.preserve).toBeDefined();
    expect(result!.preserve!.files).toEqual(['.env.example', 'config/local.sample.json']);
  });

  test('parses a complete config with all sections', async () => {
    mkdirSync(join(repoDir, '.claude'), { recursive: true });
    writeFileSync(
      join(repoDir, '.claude', 'workspace.toml'),
      [
        '[lifecycle]',
        'setup = "npm install"',
        'teardown = ""',
        '',
        '[env]',
        'PORT = "3000"',
        'NODE_ENV = "development"',
        '',
        '[preserve]',
        'files = [".env.example"]',
      ].join('\n')
    );

    const result = await loadWorkspaceConfig(repoDir);

    expect(result).not.toBeNull();
    expect(result!.lifecycle!.setup).toBe('npm install');
    expect(result!.lifecycle!.teardown).toBe('');
    expect(result!.env!.PORT).toBe('3000');
    expect(result!.preserve!.files).toEqual(['.env.example']);
  });

  test('handles malformed TOML gracefully — returns null without throwing', async () => {
    mkdirSync(join(repoDir, '.claude'), { recursive: true });
    writeFileSync(
      join(repoDir, '.claude', 'workspace.toml'),
      `this is not valid toml !!! @@@ ===`
    );

    const result = await loadWorkspaceConfig(repoDir);
    expect(result).toBeNull();
  });

  test('handles empty TOML file gracefully — returns empty config object', async () => {
    mkdirSync(join(repoDir, '.claude'), { recursive: true });
    writeFileSync(join(repoDir, '.claude', 'workspace.toml'), '');

    const result = await loadWorkspaceConfig(repoDir);

    // Empty TOML is valid — returns an empty config (not null)
    expect(result).not.toBeNull();
    expect(result!.lifecycle).toBeUndefined();
    expect(result!.env).toBeUndefined();
    expect(result!.preserve).toBeUndefined();
  });

  test('handles config with only lifecycle.setup (no teardown)', async () => {
    mkdirSync(join(repoDir, '.claude'), { recursive: true });
    writeFileSync(
      join(repoDir, '.claude', 'workspace.toml'),
      `[lifecycle]\nsetup = "pnpm install"\n`
    );

    const result = await loadWorkspaceConfig(repoDir);

    expect(result).not.toBeNull();
    expect(result!.lifecycle!.setup).toBe('pnpm install');
    expect(result!.lifecycle!.teardown).toBeUndefined();
  });
});
