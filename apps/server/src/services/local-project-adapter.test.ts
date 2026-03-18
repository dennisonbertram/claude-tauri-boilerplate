import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalProjectAdapter } from './local-project-adapter';

let tempDir: string;
let projectDir: string;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'local-adapter-test-'));
  projectDir = join(tempDir, 'project');
  await mkdir(projectDir, { recursive: true });
  // Create a test file inside the project
  await writeFile(join(projectDir, 'hello.txt'), 'hello world');
  await mkdir(join(projectDir, 'subdir'), { recursive: true });
  await writeFile(join(projectDir, 'subdir', 'nested.txt'), 'nested content');
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('LocalProjectAdapter.checkAccess', () => {
  test('returns { accessible: true } for an existing directory', async () => {
    const adapter = new LocalProjectAdapter(projectDir);
    const result = await adapter.checkAccess();
    expect(result.accessible).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('returns { accessible: false } for a non-existent directory', async () => {
    const adapter = new LocalProjectAdapter('/nonexistent/path/xyzzy123');
    const result = await adapter.checkAccess();
    expect(result.accessible).toBe(false);
    expect(typeof result.error).toBe('string');
  });
});

describe('LocalProjectAdapter.exists', () => {
  test('returns true for a file that exists', async () => {
    const adapter = new LocalProjectAdapter(projectDir);
    expect(await adapter.exists('hello.txt')).toBe(true);
  });

  test('returns true for a subdirectory that exists', async () => {
    const adapter = new LocalProjectAdapter(projectDir);
    expect(await adapter.exists('subdir')).toBe(true);
  });

  test('returns false for a file that does not exist', async () => {
    const adapter = new LocalProjectAdapter(projectDir);
    expect(await adapter.exists('does-not-exist.txt')).toBe(false);
  });
});

describe('LocalProjectAdapter.readFile', () => {
  test('reads the content of an existing file', async () => {
    const adapter = new LocalProjectAdapter(projectDir);
    const content = await adapter.readFile('hello.txt');
    expect(content).toBe('hello world');
  });

  test('reads a nested file', async () => {
    const adapter = new LocalProjectAdapter(projectDir);
    const content = await adapter.readFile('subdir/nested.txt');
    expect(content).toBe('nested content');
  });

  test('throws for a non-existent file', async () => {
    const adapter = new LocalProjectAdapter(projectDir);
    await expect(adapter.readFile('no-such-file.txt')).rejects.toThrow();
  });

  test('throws for path traversal attempt', async () => {
    const adapter = new LocalProjectAdapter(projectDir);
    await expect(adapter.readFile('../../../etc/passwd')).rejects.toThrow(/path traversal/i);
  });
});

describe('LocalProjectAdapter.listDir', () => {
  test('lists entries at the project root when no path given', async () => {
    const adapter = new LocalProjectAdapter(projectDir);
    const entries = await adapter.listDir();
    expect(entries).toContain('hello.txt');
    expect(entries).toContain('subdir');
  });

  test('lists entries in a subdirectory', async () => {
    const adapter = new LocalProjectAdapter(projectDir);
    const entries = await adapter.listDir('subdir');
    expect(entries).toContain('nested.txt');
  });

  test('throws for a non-existent directory', async () => {
    const adapter = new LocalProjectAdapter(projectDir);
    await expect(adapter.listDir('no-such-dir')).rejects.toThrow();
  });
});

describe('LocalProjectAdapter.exec', () => {
  test('runs a command and returns stdout', async () => {
    const adapter = new LocalProjectAdapter(projectDir);
    const result = await adapter.exec('echo', ['hello from exec']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello from exec');
  });

  test('returns non-zero exit code for failing commands', async () => {
    const adapter = new LocalProjectAdapter(projectDir);
    const result = await adapter.exec('false', []);
    expect(result.exitCode).not.toBe(0);
  });

  test('captures stderr output', async () => {
    const adapter = new LocalProjectAdapter(projectDir);
    // ls on a non-existent path writes to stderr
    const result = await adapter.exec('ls', ['/nonexistent/path/xyz']);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  test('passes environment variables to the command', async () => {
    const adapter = new LocalProjectAdapter(projectDir);
    const result = await adapter.exec('sh', ['-c', 'echo $TEST_VAR_XYZ'], {
      env: { TEST_VAR_XYZ: 'adapter-env-test' },
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('adapter-env-test');
  });
});

describe('LocalProjectAdapter.resolvePath', () => {
  test('resolves a relative path to an absolute path within the project', async () => {
    const adapter = new LocalProjectAdapter(projectDir);
    const resolved = await adapter.resolvePath('hello.txt');
    expect(resolved).toBe(join(projectDir, 'hello.txt'));
  });

  test('throws for path traversal attempt', async () => {
    const adapter = new LocalProjectAdapter(projectDir);
    await expect(adapter.resolvePath('../../../etc/passwd')).rejects.toThrow(/path traversal/i);
  });
});
