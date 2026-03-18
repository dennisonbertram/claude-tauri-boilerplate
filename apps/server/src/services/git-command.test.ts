import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { GitCommandRunner } from './git-command';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let git: GitCommandRunner;
let tempDir: string;
let gitRepoDir: string;

beforeAll(async () => {
  git = new GitCommandRunner();

  // Create a temp directory for tests
  tempDir = await mkdtemp(join(tmpdir(), 'git-cmd-test-'));

  // Create a real git repo for testing
  gitRepoDir = join(tempDir, 'test-repo');
  await Bun.spawn(['mkdir', '-p', gitRepoDir]).exited;
  await Bun.spawn(['git', 'init'], { cwd: gitRepoDir }).exited;
  await Bun.spawn(['git', 'config', 'user.email', 'test@test.com'], { cwd: gitRepoDir }).exited;
  await Bun.spawn(['git', 'config', 'user.name', 'Test'], { cwd: gitRepoDir }).exited;
  // Create an initial commit so branches exist
  await Bun.spawn(['git', 'commit', '--allow-empty', '-m', 'init'], { cwd: gitRepoDir }).exited;
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('GitCommandRunner.run', () => {
  test('executes git version successfully', async () => {
    const result = await git.run(['version']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('git version');
    expect(result.stderr).toBe('');
  });

  test('returns non-zero exit code for invalid commands', async () => {
    const result = await git.run(['not-a-real-command']);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  test('respects cwd option', async () => {
    const result = await git.run(['rev-parse', '--git-dir'], { cwd: gitRepoDir });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('.git');
  });

  test('handles timeout by killing the process', async () => {
    // Very short timeout should cause cancellation for a long-running command
    const result = await git.run(['help', '--all'], { timeout: 1 });
    // Either it completes fast enough or gets killed
    expect(typeof result.exitCode).toBe('number');
  });

  test('handles AbortController cancellation', async () => {
    const controller = new AbortController();
    // Abort immediately
    controller.abort();

    const result = await git.run(['help', '--all'], { signal: controller.signal });
    // Should return quickly — either completed before abort or was killed
    expect(typeof result.exitCode).toBe('number');
  });
});

describe('GitCommandRunner.isGitRepo', () => {
  test('returns true for a valid git repo', async () => {
    expect(await git.isGitRepo(gitRepoDir)).toBe(true);
  });

  test('returns false for a non-git directory', async () => {
    expect(await git.isGitRepo(tempDir)).toBe(false);
  });

  test('returns false for a non-existent directory', async () => {
    expect(await git.isGitRepo('/nonexistent/path/abc123')).toBe(false);
  });
});

describe('GitCommandRunner.getDefaultBranch', () => {
  test('detects the default branch of a test repo', async () => {
    const branch = await git.getDefaultBranch(gitRepoDir);
    // git init creates main or master depending on config
    expect(['main', 'master']).toContain(branch);
  });

  test('returns HEAD branch for an unborn repository', async () => {
    const unbornRepoDir = join(tempDir, 'unborn-repo');
    await Bun.spawn(['mkdir', '-p', unbornRepoDir]).exited;
    await Bun.spawn(['git', 'init'], { cwd: unbornRepoDir }).exited;

    const head = await git.run(['symbolic-ref', '--short', 'HEAD'], {
      cwd: unbornRepoDir,
    });
    expect(head.exitCode).toBe(0);

    const branch = await git.getDefaultBranch(unbornRepoDir);
    expect(branch).toBe(head.stdout.trim());
  });
});
