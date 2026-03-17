import { Hono } from 'hono';
import { join, basename, resolve, normalize } from 'path';
import { homedir } from 'os';
import { readdir, stat, mkdir } from 'fs/promises';
import type { MemoryFile, MemorySearchResult } from '@claude-tauri/shared';

// import.meta.dir is the directory of this source file:
//   apps/server/src/routes/
// Go up 4 levels: routes -> src -> server -> apps -> project root
const PROJECT_ROOT = process.env.PROJECT_ROOT ?? resolve(import.meta.dir, '../../../..');

/**
 * Derive a project hash from the CWD path.
 * Claude uses a path-based hash for project directories:
 *   ~/.claude/projects/<path-with-dashes>/memory/
 * e.g. /Users/foo/project -> -Users-foo-project
 */
function deriveProjectHash(cwd: string): string {
  return cwd.replace(/\//g, '-');
}

/**
 * Get the memory directory for the current project.
 * Uses PROJECT_ROOT (derived from import.meta.dir) instead of process.cwd()
 * so that the path is always relative to the project root, not the server CWD.
 */
function getMemoryDir(): string {
  const base =
    process.env.CLAUDE_MEMORY_DIR ||
    join(homedir(), '.claude', 'projects');
  const projectHash = deriveProjectHash(PROJECT_ROOT);
  return join(base, projectHash, 'memory');
}

/**
 * Validate a memory filename: must end in .md, no path traversal.
 */
function isValidFilename(name: string): boolean {
  if (!name.endsWith('.md')) return false;
  if (name.includes('/') || name.includes('\\')) return false;
  if (name.includes('..')) return false;
  if (name !== basename(name)) return false;
  // Reject empty base name
  if (name === '.md') return false;
  return true;
}

/**
 * Read a memory file and return its metadata + content.
 */
async function readMemoryFile(
  memoryDir: string,
  filename: string
): Promise<MemoryFile | null> {
  const filePath = join(memoryDir, filename);
  try {
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) return null;

    const [content, fileStat] = await Promise.all([
      file.text(),
      stat(filePath),
    ]);

    return {
      name: filename,
      path: filePath,
      content,
      isEntrypoint: filename === 'MEMORY.md',
      sizeBytes: fileStat.size,
      modifiedAt: fileStat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

export function createMemoryRouter() {
  const memoryRouter = new Hono();

  // GET /api/memory/search?q=<query> - Search across all memory files
  // NOTE: This route MUST be defined before /:filename to avoid the path
  // parameter matching "search" as a filename.
  memoryRouter.get('/search', async (c) => {
    const query = c.req.query('q');
    if (!query || query.trim() === '') {
      return c.json({ results: [] });
    }

    const memoryDir = getMemoryDir();
    const results: MemorySearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    try {
      const entries = await readdir(memoryDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

        const filePath = join(memoryDir, entry.name);
        const file = Bun.file(filePath);
        const content = await file.text();
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(lowerQuery)) {
            // Build context: up to 1 line before and 1 after
            const contextLines: string[] = [];
            if (i > 0) contextLines.push(lines[i - 1]);
            contextLines.push(lines[i]);
            if (i < lines.length - 1) contextLines.push(lines[i + 1]);

            results.push({
              file: entry.name,
              line: i + 1,
              text: lines[i],
              context: contextLines.join('\n'),
            });
          }
        }
      }
    } catch {
      // Directory doesn't exist or can't be read - return empty results
    }

    return c.json({ results });
  });

  // GET /api/memory - List all memory files for the current project
  memoryRouter.get('/', async (c) => {
    const memoryDir = getMemoryDir();
    const files: MemoryFile[] = [];

    try {
      await mkdir(memoryDir, { recursive: true });
      const entries = await readdir(memoryDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

        const memFile = await readMemoryFile(memoryDir, entry.name);
        if (memFile) files.push(memFile);
      }

      // Sort: MEMORY.md first, then alphabetical
      files.sort((a, b) => {
        if (a.isEntrypoint) return -1;
        if (b.isEntrypoint) return 1;
        return a.name.localeCompare(b.name);
      });
    } catch {
      // Directory doesn't exist or can't be created
    }

    return c.json({ files, memoryDir });
  });

  // GET /api/memory/:filename - Get a specific memory file
  memoryRouter.get('/:filename', async (c) => {
    const filename = c.req.param('filename');

    if (!isValidFilename(filename)) {
      return c.json({ error: 'Invalid filename' }, 400);
    }

    const memoryDir = getMemoryDir();
    const memFile = await readMemoryFile(memoryDir, filename);

    if (!memFile) {
      return c.json({ error: 'File not found' }, 404);
    }

    return c.json(memFile);
  });

  // PUT /api/memory/:filename - Update a memory file
  memoryRouter.put('/:filename', async (c) => {
    const filename = c.req.param('filename');

    if (!isValidFilename(filename)) {
      return c.json({ error: 'Invalid filename' }, 400);
    }

    const body = await c.req.json<{ content: string }>();
    if (typeof body.content !== 'string') {
      return c.json({ error: 'content must be a string' }, 400);
    }

    const memoryDir = getMemoryDir();
    const filePath = join(memoryDir, filename);

    // Ensure the file exists before updating
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) {
      return c.json({ error: 'File not found' }, 404);
    }

    try {
      await Bun.write(filePath, body.content);
      return c.json({ success: true, path: filePath });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Write failed';
      return c.json({ error: message }, 500);
    }
  });

  // POST /api/memory - Create a new memory file
  memoryRouter.post('/', async (c) => {
    const body = await c.req.json<{ name: string; content: string }>();

    if (typeof body.name !== 'string' || typeof body.content !== 'string') {
      return c.json({ error: 'name and content must be strings' }, 400);
    }

    if (!isValidFilename(body.name)) {
      return c.json(
        { error: 'Invalid filename. Must end in .md with no path separators.' },
        400
      );
    }

    const memoryDir = getMemoryDir();

    // Ensure directory exists
    try {
      await mkdir(memoryDir, { recursive: true });
    } catch {
      // Already exists, that's fine
    }

    const filePath = join(memoryDir, body.name);

    // Check if already exists
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (exists) {
      return c.json({ error: 'File already exists' }, 409);
    }

    try {
      await Bun.write(filePath, body.content);
      return c.json({ success: true, path: filePath }, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Create failed';
      return c.json({ error: message }, 500);
    }
  });

  // DELETE /api/memory/:filename - Delete a memory file
  memoryRouter.delete('/:filename', async (c) => {
    const filename = c.req.param('filename');

    if (!isValidFilename(filename)) {
      return c.json({ error: 'Invalid filename' }, 400);
    }

    // Cannot delete the entrypoint MEMORY.md
    if (filename === 'MEMORY.md') {
      return c.json(
        { error: 'Cannot delete MEMORY.md. You can only edit it.' },
        403
      );
    }

    const memoryDir = getMemoryDir();
    const filePath = join(memoryDir, filename);

    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) {
      return c.json({ error: 'File not found' }, 404);
    }

    try {
      const { unlink } = await import('fs/promises');
      await unlink(filePath);
      return c.json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      return c.json({ error: message }, 500);
    }
  });

  return memoryRouter;
}
