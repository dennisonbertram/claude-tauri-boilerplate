/**
 * Tests for the Obsidian connector tools.
 *
 * All file-system calls are mocked via mock.module so no real vault is needed.
 */
import { describe, test, expect, beforeEach, mock } from 'bun:test';

// ---------------------------------------------------------------------------
// We need to capture and replace the fs/promises module before importing
// the tools module. Bun's mock.module handles this.
// ---------------------------------------------------------------------------

const mockReaddir = mock(async (_dir: string, _opts?: unknown) => [] as any[]);
const mockStat = mock(async (_p: string) => ({ isFile: () => true, size: 10 } as any));
const mockReadFile = mock(async (_p: string, _enc?: string) => '' as any);
const mockWriteFile = mock(async (_p: string, _data: string, _enc?: string) => undefined as any);
const mockMkdir = mock(async (_p: string, _opts?: unknown) => undefined as any);
const mockOpen = mock(async (_p: string, _flags: string) => ({
  read: async (buf: Buffer, offset: number, length: number, position: number) => {
    const data = 'truncated content';
    buf.write(data, offset);
    return { bytesRead: data.length };
  },
  close: async () => {},
}) as any);

mock.module('fs/promises', () => ({
  default: {
    readdir: mockReaddir,
    stat: mockStat,
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    mkdir: mockMkdir,
    open: mockOpen,
  },
  readdir: mockReaddir,
  stat: mockStat,
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
  open: mockOpen,
}));

// Now import after mocking
import { createObsidianTools } from './tools';
import { obsidianConnectorFactory } from './index';

// ---------------------------------------------------------------------------
// Helper: invoke a tool's handler by name
// ---------------------------------------------------------------------------

function getHandler(toolName: string) {
  const tools = createObsidianTools();
  const def = tools.find((t) => t.name === toolName);
  if (!def) throw new Error(`Tool not found: ${toolName}`);
  // The SDK tool() function returns an object with a `.handler` function.
  return (def.sdkTool as any).handler as (args: Record<string, unknown>) => Promise<any>;
}

function setVault(p: string) {
  process.env.OBSIDIAN_VAULT_PATH = p;
}

function clearVault() {
  delete process.env.OBSIDIAN_VAULT_PATH;
}

// ---------------------------------------------------------------------------
// Connector factory tests
// ---------------------------------------------------------------------------

describe('obsidianConnectorFactory', () => {
  test('returns a connector with name "obsidian"', () => {
    const connector = obsidianConnectorFactory({} as any);
    expect(connector.name).toBe('obsidian');
  });

  test('has category "productivity"', () => {
    const connector = obsidianConnectorFactory({} as any);
    expect(connector.category).toBe('productivity');
  });

  test('has icon "💎"', () => {
    const connector = obsidianConnectorFactory({} as any);
    expect(connector.icon).toBe('💎');
  });

  test('requiresAuth is false (env-var auth, no OAuth)', () => {
    const connector = obsidianConnectorFactory({} as any);
    expect(connector.requiresAuth).toBe(false);
  });

  test('exposes exactly 6 tools', () => {
    const connector = obsidianConnectorFactory({} as any);
    expect(connector.tools).toHaveLength(6);
  });

  test('tool names are as expected', () => {
    const connector = obsidianConnectorFactory({} as any);
    const names = connector.tools.map((t) => t.name);
    expect(names).toContain('obsidian_list_notes');
    expect(names).toContain('obsidian_read_note');
    expect(names).toContain('obsidian_create_note');
    expect(names).toContain('obsidian_update_note');
    expect(names).toContain('obsidian_search');
    expect(names).toContain('obsidian_daily_note');
  });
});

// ---------------------------------------------------------------------------
// Path traversal prevention
// ---------------------------------------------------------------------------

describe('path traversal prevention', () => {
  beforeEach(() => {
    setVault('/vault');
    mockStat.mockImplementation(async () => { throw new Error('ENOENT'); });
  });

  test('list_notes: rejects ../ traversal in folder param', async () => {
    const handler = getHandler('obsidian_list_notes');
    const result = await handler({ folder: '../etc' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Path traversal');
  });

  test('read_note: rejects ../../etc/passwd traversal', async () => {
    const handler = getHandler('obsidian_read_note');
    const result = await handler({ notePath: '../../etc/passwd' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Path traversal');
  });

  test('create_note: rejects path escaping vault', async () => {
    const handler = getHandler('obsidian_create_note');
    const result = await handler({ notePath: '../outside/note.md', content: 'evil' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Path traversal');
  });

  test('update_note: rejects path escaping vault', async () => {
    const handler = getHandler('obsidian_update_note');
    const result = await handler({ notePath: '../../evil.md', content: 'bad' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Path traversal');
  });

  test('search: rejects traversal in folder param', async () => {
    const handler = getHandler('obsidian_search');
    const result = await handler({ query: 'test', folder: '../secrets' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Path traversal');
  });

  test('daily_note: rejects traversal in dailyNotesFolder param', async () => {
    const handler = getHandler('obsidian_daily_note');
    const result = await handler({ dailyNotesFolder: '../../etc' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Path traversal');
  });

  test('paths exactly equal to vault root are allowed', async () => {
    // A path that resolves to exactly /vault should not throw traversal error.
    // We verify by checking the error is NOT traversal (it may be a different error).
    mockReaddir.mockImplementation(async () => []);
    const handler = getHandler('obsidian_list_notes');
    const result = await handler({});
    // No traversal error
    expect(result.content[0].text).not.toContain('Path traversal');
  });
});

// ---------------------------------------------------------------------------
// Missing OBSIDIAN_VAULT_PATH
// ---------------------------------------------------------------------------

describe('missing OBSIDIAN_VAULT_PATH', () => {
  beforeEach(() => clearVault());

  test('list_notes returns error if env var not set', async () => {
    const handler = getHandler('obsidian_list_notes');
    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('OBSIDIAN_VAULT_PATH');
  });

  test('read_note returns error if env var not set', async () => {
    const handler = getHandler('obsidian_read_note');
    const result = await handler({ notePath: 'note.md' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('OBSIDIAN_VAULT_PATH');
  });
});

// ---------------------------------------------------------------------------
// obsidian_list_notes
// ---------------------------------------------------------------------------

describe('obsidian_list_notes', () => {
  beforeEach(() => {
    setVault('/vault');
    mockReaddir.mockImplementation(async (dir: string, opts?: any) => {
      if (dir === '/vault') {
        return [
          { name: 'note1.md', isDirectory: () => false, isFile: () => true },
          { name: 'subfolder', isDirectory: () => true, isFile: () => false },
          { name: 'image.png', isDirectory: () => false, isFile: () => true },
        ];
      }
      if (dir === '/vault/subfolder') {
        return [
          { name: 'note2.md', isDirectory: () => false, isFile: () => true },
        ];
      }
      return [];
    });
  });

  test('lists .md files in vault', async () => {
    const handler = getHandler('obsidian_list_notes');
    const result = await handler({});
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('note1.md');
    expect(result.content[0].text).toContain('note2.md');
  });

  test('excludes non-.md files', async () => {
    const handler = getHandler('obsidian_list_notes');
    const result = await handler({});
    expect(result.content[0].text).not.toContain('image.png');
  });

  test('returns empty message when no notes found', async () => {
    mockReaddir.mockImplementation(async () => []);
    const handler = getHandler('obsidian_list_notes');
    const result = await handler({});
    expect(result.content[0].text).toContain('No Markdown files found');
  });

  test('output is fenced', async () => {
    const handler = getHandler('obsidian_list_notes');
    const result = await handler({});
    expect(result.content[0].text).toContain('UNTRUSTED_BEGIN');
    expect(result.content[0].text).toContain('UNTRUSTED_END');
  });
});

// ---------------------------------------------------------------------------
// obsidian_read_note
// ---------------------------------------------------------------------------

describe('obsidian_read_note', () => {
  beforeEach(() => {
    setVault('/vault');
    mockStat.mockImplementation(async () => ({ isFile: () => true, size: 50 }));
    mockReadFile.mockImplementation(async () => '# My Note\n\nHello world');
  });

  test('reads a note and returns fenced content', async () => {
    const handler = getHandler('obsidian_read_note');
    const result = await handler({ notePath: 'note.md' });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('# My Note');
    expect(result.content[0].text).toContain('UNTRUSTED_BEGIN');
  });

  test('returns error when file does not exist', async () => {
    mockStat.mockImplementation(async () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); });
    const handler = getHandler('obsidian_read_note');
    const result = await handler({ notePath: 'missing.md' });
    expect(result.isError).toBe(true);
  });

  test('returns error when path is a directory', async () => {
    mockStat.mockImplementation(async () => ({ isFile: () => false, size: 0 }));
    const handler = getHandler('obsidian_read_note');
    const result = await handler({ notePath: 'somefolder' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('is not a file');
  });

  test('truncates note larger than 100KB', async () => {
    const bigSize = 150_000;
    mockStat.mockImplementation(async () => ({ isFile: () => true, size: bigSize }));
    // mockOpen already set up in global mock to return small content
    const handler = getHandler('obsidian_read_note');
    const result = await handler({ notePath: 'big.md' });
    expect(result.content[0].text).toContain('truncated');
  });
});

// ---------------------------------------------------------------------------
// obsidian_create_note
// ---------------------------------------------------------------------------

describe('obsidian_create_note', () => {
  beforeEach(() => {
    setVault('/vault');
    mockMkdir.mockClear();
    mockWriteFile.mockClear();
    mockMkdir.mockImplementation(async () => undefined);
    mockWriteFile.mockImplementation(async () => undefined);
  });

  test('creates a new note successfully', async () => {
    mockStat.mockImplementation(async () => { throw new Error('ENOENT'); });
    const handler = getHandler('obsidian_create_note');
    const result = await handler({ notePath: 'new-note.md', content: '# New Note' });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('created successfully');
  });

  test('fails if note already exists and overwrite is false', async () => {
    mockStat.mockImplementation(async () => ({ isFile: () => true, size: 10 }));
    const handler = getHandler('obsidian_create_note');
    const result = await handler({ notePath: 'existing.md', content: 'content' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('already exists');
  });

  test('overwrites if overwrite=true and file exists', async () => {
    mockStat.mockImplementation(async () => ({ isFile: () => true, size: 10 }));
    const handler = getHandler('obsidian_create_note');
    const result = await handler({ notePath: 'existing.md', content: 'new content', overwrite: true });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('created successfully');
  });

  test('creates parent directories automatically', async () => {
    mockStat.mockImplementation(async () => { throw new Error('ENOENT'); });
    const handler = getHandler('obsidian_create_note');
    await handler({ notePath: 'deep/path/note.md', content: '# Deep' });
    expect(mockMkdir).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// obsidian_update_note
// ---------------------------------------------------------------------------

describe('obsidian_update_note', () => {
  beforeEach(() => {
    setVault('/vault');
    mockWriteFile.mockClear();
    mockStat.mockImplementation(async () => ({ isFile: () => true, size: 20 }));
    mockReadFile.mockImplementation(async () => 'existing content\n');
    mockWriteFile.mockImplementation(async () => undefined);
  });

  test('appends content by default', async () => {
    const handler = getHandler('obsidian_update_note');
    const result = await handler({ notePath: 'note.md', content: 'new line' });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('append');
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('new line'),
      'utf8'
    );
  });

  test('replaces content when mode=replace', async () => {
    const handler = getHandler('obsidian_update_note');
    const result = await handler({ notePath: 'note.md', content: 'replacement', mode: 'replace' });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('replace');
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.any(String),
      'replacement',
      'utf8'
    );
  });

  test('returns error if note does not exist', async () => {
    mockStat.mockImplementation(async () => { throw new Error('ENOENT'); });
    const handler = getHandler('obsidian_update_note');
    const result = await handler({ notePath: 'missing.md', content: 'content' });
    expect(result.isError).toBe(true);
  });

  test('adds newline separator if existing content lacks trailing newline', async () => {
    mockReadFile.mockImplementation(async () => 'no newline at end');
    const handler = getHandler('obsidian_update_note');
    await handler({ notePath: 'note.md', content: 'appended' });
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.any(String),
      'no newline at end\nappended',
      'utf8'
    );
  });
});

// ---------------------------------------------------------------------------
// obsidian_search
// ---------------------------------------------------------------------------

describe('obsidian_search', () => {
  beforeEach(() => {
    setVault('/vault');
    mockReaddir.mockImplementation(async (dir: string) => {
      if (dir === '/vault') {
        return [
          { name: 'alpha.md', isDirectory: () => false, isFile: () => true },
          { name: 'beta.md', isDirectory: () => false, isFile: () => true },
        ];
      }
      return [];
    });
    mockReadFile.mockImplementation(async (p: string) => {
      if (p.includes('alpha')) return 'Hello world, this is a test note.';
      if (p.includes('beta')) return 'Nothing interesting here.';
      return '';
    });
  });

  test('returns files that match the query', async () => {
    const handler = getHandler('obsidian_search');
    const result = await handler({ query: 'Hello' });
    expect(result.content[0].text).toContain('alpha.md');
    expect(result.content[0].text).not.toContain('beta.md');
  });

  test('is case-insensitive', async () => {
    const handler = getHandler('obsidian_search');
    const result = await handler({ query: 'HELLO' });
    expect(result.content[0].text).toContain('alpha.md');
  });

  test('returns empty message when no matches', async () => {
    const handler = getHandler('obsidian_search');
    const result = await handler({ query: 'xyznotpresent' });
    expect(result.content[0].text).toContain('No notes found');
  });

  test('fences snippets and filenames', async () => {
    const handler = getHandler('obsidian_search');
    const result = await handler({ query: 'Hello' });
    expect(result.content[0].text).toContain('UNTRUSTED_BEGIN');
  });
});

// ---------------------------------------------------------------------------
// obsidian_daily_note
// ---------------------------------------------------------------------------

describe('obsidian_daily_note', () => {
  beforeEach(() => {
    setVault('/vault');
    mockMkdir.mockClear();
    mockWriteFile.mockClear();
    mockMkdir.mockImplementation(async () => undefined);
    mockWriteFile.mockImplementation(async () => undefined);
  });

  test('reads existing daily note', async () => {
    mockStat.mockImplementation(async () => ({ isFile: () => true, size: 30 }));
    mockReadFile.mockImplementation(async () => '# 2024-01-15\n\nToday was great.');
    const handler = getHandler('obsidian_daily_note');
    const result = await handler({});
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('UNTRUSTED_BEGIN');
  });

  test('creates daily note when it does not exist', async () => {
    mockStat.mockImplementation(async () => { throw new Error('ENOENT'); });
    const handler = getHandler('obsidian_daily_note');
    const result = await handler({ createIfMissing: true });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Created daily note');
    expect(mockWriteFile).toHaveBeenCalled();
  });

  test('does not create daily note when createIfMissing=false', async () => {
    mockStat.mockImplementation(async () => { throw new Error('ENOENT'); });
    const handler = getHandler('obsidian_daily_note');
    const result = await handler({ createIfMissing: false });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('does not exist');
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  test('uses custom dailyNotesFolder', async () => {
    mockStat.mockImplementation(async () => { throw new Error('ENOENT'); });
    const handler = getHandler('obsidian_daily_note');
    await handler({ dailyNotesFolder: 'Journal', createIfMissing: true });
    const calls = mockWriteFile.mock.calls as any[][];
    expect(calls.length).toBeGreaterThan(0);
    const writeCall = calls[calls.length - 1];
    expect(writeCall[0]).toContain('Journal');
  });

  test('uses custom template when creating', async () => {
    mockStat.mockImplementation(async () => { throw new Error('ENOENT'); });
    const handler = getHandler('obsidian_daily_note');
    await handler({ createIfMissing: true, template: '## Custom Template\n' });
    const calls = mockWriteFile.mock.calls as any[][];
    expect(calls.length).toBeGreaterThan(0);
    const writeCall = calls[calls.length - 1];
    expect(writeCall[1]).toContain('Custom Template');
  });

  test('path traversal in dailyNotesFolder is prevented', async () => {
    const handler = getHandler('obsidian_daily_note');
    const result = await handler({ dailyNotesFolder: '../../evil' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Path traversal');
  });
});
