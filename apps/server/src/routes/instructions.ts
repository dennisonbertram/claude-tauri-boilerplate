import { Hono } from 'hono';
import { join } from 'path';
import { homedir } from 'os';
import type { InstructionFile, RuleFile } from '@claude-tauri/shared';

/**
 * Read a file and return its content, or null if it doesn't exist.
 */
async function readFileIfExists(
  filePath: string
): Promise<{ content: string; exists: boolean }> {
  try {
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) return { content: '', exists: false };
    const content = await file.text();
    return { content, exists: true };
  } catch {
    return { content: '', exists: false };
  }
}

/**
 * Parse simple YAML frontmatter from a markdown file.
 * Extracts the 'paths' field if present:
 *   ---
 *   paths: src/**, tests/**
 *   ---
 */
function parsePathScope(content: string): string[] | undefined {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return undefined;

  const frontmatter = match[1];
  const pathsLine = frontmatter
    .split('\n')
    .find((line) => line.trim().startsWith('paths:'));

  if (!pathsLine) return undefined;

  const pathsValue = pathsLine.replace(/^paths:\s*/, '').trim();
  if (!pathsValue) return undefined;

  return pathsValue.split(',').map((p) => p.trim()).filter(Boolean);
}

export function createInstructionsRouter() {
  const instructionsRouter = new Hono();

  // GET /api/instructions - Discover and return all CLAUDE.md files
  instructionsRouter.get('/', async (c) => {
    const projectRoot = process.cwd();
    const home = homedir();

    const candidates: { path: string; level: InstructionFile['level'] }[] = [
      { path: join(projectRoot, 'CLAUDE.md'), level: 'project' },
      { path: join(projectRoot, '.claude', 'CLAUDE.md'), level: 'managed' },
      { path: join(home, '.claude', 'CLAUDE.md'), level: 'user' },
      {
        path: '/Library/Application Support/ClaudeCode/CLAUDE.md',
        level: 'global',
      },
    ];

    const files: InstructionFile[] = await Promise.all(
      candidates.map(async ({ path, level }) => {
        const { content, exists } = await readFileIfExists(path);
        return { path, level, content, exists };
      })
    );

    return c.json({ files });
  });

  // GET /api/instructions/rules - List .claude/rules/ files
  instructionsRouter.get('/rules', async (c) => {
    const projectRoot = process.cwd();
    const rulesDir = join(projectRoot, '.claude', 'rules');

    const rules: RuleFile[] = [];

    try {
      const { readdir } = await import('fs/promises');
      const entries = await readdir(rulesDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.endsWith('.md')) continue;

        const filePath = join(rulesDir, entry.name);
        const { content, exists } = await readFileIfExists(filePath);

        if (exists) {
          rules.push({
            path: filePath,
            name: entry.name,
            content,
            pathScope: parsePathScope(content),
          });
        }
      }
    } catch {
      // Directory doesn't exist or can't be read - return empty
    }

    return c.json({ rules });
  });

  // PUT /api/instructions/:encodedPath - Save a CLAUDE.md file
  instructionsRouter.put('/:encodedPath', async (c) => {
    const encodedPath = c.req.param('encodedPath');

    let filePath: string;
    try {
      filePath = atob(encodedPath);
    } catch {
      return c.json({ error: 'Invalid base64-encoded path' }, 400);
    }

    // Security: only allow writing to CLAUDE.md files
    if (!filePath.endsWith('CLAUDE.md')) {
      return c.json({ error: 'Can only write to CLAUDE.md files' }, 403);
    }

    const body = await c.req.json<{ content: string }>();
    if (typeof body.content !== 'string') {
      return c.json({ error: 'content must be a string' }, 400);
    }

    try {
      await Bun.write(filePath, body.content);
      return c.json({ success: true, path: filePath });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Write failed';
      return c.json({ error: message }, 500);
    }
  });

  // POST /api/instructions/create - Create a new CLAUDE.md at project root
  instructionsRouter.post('/create', async (c) => {
    const body = await c.req.json<{ content: string }>();
    if (typeof body.content !== 'string') {
      return c.json({ error: 'content must be a string' }, 400);
    }

    const projectRoot = process.cwd();
    const filePath = join(projectRoot, 'CLAUDE.md');

    // Check if it already exists
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (exists) {
      return c.json({ error: 'CLAUDE.md already exists at project root' }, 409);
    }

    try {
      await Bun.write(filePath, body.content);
      return c.json({ success: true, path: filePath }, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Create failed';
      return c.json({ error: message }, 500);
    }
  });

  return instructionsRouter;
}
