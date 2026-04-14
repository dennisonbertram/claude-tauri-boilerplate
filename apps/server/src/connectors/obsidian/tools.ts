import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import fs from 'fs/promises';
import path from 'path';
import type { ConnectorToolDefinition } from '../types';
import { sanitizeError, fenceUntrustedContent } from '../utils';

// ---------------------------------------------------------------------------
// Path safety helpers
// ---------------------------------------------------------------------------

/**
 * Resolves a relative path within the vault and throws if the resolved path
 * escapes the vault root (path traversal prevention).
 */
function safePath(vaultPath: string, relativePath: string): string {
  const resolvedVault = path.resolve(vaultPath);
  const resolved = path.resolve(vaultPath, relativePath);
  if (!resolved.startsWith(resolvedVault + path.sep) && resolved !== resolvedVault) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}

/**
 * Returns the OBSIDIAN_VAULT_PATH env var or throws a clear error.
 */
function getVaultPath(): string {
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
  if (!vaultPath) {
    throw new Error(
      'OBSIDIAN_VAULT_PATH environment variable is not set. Please configure it to point to your Obsidian vault directory.'
    );
  }
  return vaultPath;
}

/**
 * Recursively collects all .md file paths relative to the given root.
 */
async function collectMarkdownFiles(dir: string, root: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await collectMarkdownFiles(fullPath, root);
      results.push(...sub);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(path.relative(root, fullPath));
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// obsidian_list_notes
// ---------------------------------------------------------------------------

function createListNotesTool() {
  return tool(
    'obsidian_list_notes',
    'List all Markdown (.md) files in the Obsidian vault or a subfolder within the vault.',
    {
      folder: z
        .string()
        .optional()
        .describe(
          'Optional subfolder path relative to the vault root (e.g. "Projects/2024"). Omit to list the entire vault.'
        ),
    },
    async (args) => {
      try {
        const vaultPath = getVaultPath();
        const searchRoot = args.folder ? safePath(vaultPath, args.folder) : path.resolve(vaultPath);

        const files = await collectMarkdownFiles(searchRoot, path.resolve(vaultPath));

        if (files.length === 0) {
          const locationLabel = args.folder ? `folder "${args.folder}"` : 'vault';
          return {
            content: [{ type: 'text' as const, text: `No Markdown files found in ${locationLabel}.` }],
          };
        }

        const locationLabel = args.folder ? `folder "${args.folder}"` : 'vault';
        const header = `Found ${files.length} note${files.length !== 1 ? 's' : ''} in ${locationLabel}:`;
        const fencedList = fenceUntrustedContent(files.join('\n'), 'obsidian.filenames');

        return {
          content: [{ type: 'text' as const, text: [header, '', fencedList].join('\n') }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing notes: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Obsidian Notes',
        readOnlyHint: true,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// obsidian_read_note
// ---------------------------------------------------------------------------

const MAX_NOTE_BYTES = 100_000; // 100 KB

function createReadNoteTool() {
  return tool(
    'obsidian_read_note',
    'Read the content of a Markdown file in the Obsidian vault.',
    {
      notePath: z
        .string()
        .describe('Path to the note relative to the vault root (e.g. "Projects/MyNote.md")'),
    },
    async (args) => {
      try {
        const vaultPath = getVaultPath();
        const fullPath = safePath(vaultPath, args.notePath);

        const stat = await fs.stat(fullPath);
        if (!stat.isFile()) {
          return {
            content: [{ type: 'text' as const, text: `Error: "${args.notePath}" is not a file.` }],
            isError: true,
          };
        }

        let content: string;
        if (stat.size > MAX_NOTE_BYTES) {
          const buffer = Buffer.alloc(MAX_NOTE_BYTES);
          const fh = await fs.open(fullPath, 'r');
          try {
            await fh.read(buffer, 0, MAX_NOTE_BYTES, 0);
          } finally {
            await fh.close();
          }
          content =
            buffer.toString('utf8') +
            `\n\n[Note truncated — showing first ${MAX_NOTE_BYTES} bytes of ${stat.size} total]`;
        } else {
          content = await fs.readFile(fullPath, 'utf8');
        }

        const header = `Note: ${args.notePath}`;
        const fencedContent = fenceUntrustedContent(content, 'obsidian.note');

        return {
          content: [{ type: 'text' as const, text: [header, '', fencedContent].join('\n') }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error reading note: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Read Obsidian Note',
        readOnlyHint: true,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// obsidian_create_note
// ---------------------------------------------------------------------------

function createCreateNoteTool() {
  return tool(
    'obsidian_create_note',
    'Create a new Markdown file in the Obsidian vault. Fails if the file already exists unless overwrite is set.',
    {
      notePath: z
        .string()
        .describe('Path for the new note relative to the vault root (e.g. "Projects/NewNote.md")'),
      content: z.string().describe('Markdown content for the new note'),
      overwrite: z
        .boolean()
        .optional()
        .describe('If true, overwrite the file if it already exists. Default: false'),
    },
    async (args) => {
      try {
        const vaultPath = getVaultPath();
        const fullPath = safePath(vaultPath, args.notePath);

        if (!args.overwrite) {
          try {
            await fs.stat(fullPath);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Error: Note "${args.notePath}" already exists. Set overwrite=true to replace it.`,
                },
              ],
              isError: true,
            };
          } catch {
            // File does not exist — proceed
          }
        }

        // Ensure parent directory exists
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, args.content, 'utf8');

        return {
          content: [
            {
              type: 'text' as const,
              text: `Note created successfully: ${args.notePath}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error creating note: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Create Obsidian Note',
        readOnlyHint: false,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// obsidian_update_note
// ---------------------------------------------------------------------------

function createUpdateNoteTool() {
  return tool(
    'obsidian_update_note',
    'Update an existing Markdown note in the Obsidian vault by appending text or replacing its full content.',
    {
      notePath: z
        .string()
        .describe('Path to the note relative to the vault root (e.g. "Projects/MyNote.md")'),
      content: z.string().describe('The new content to write or append'),
      mode: z
        .enum(['append', 'replace'])
        .optional()
        .describe(
          '"append" adds content to the end of the file, "replace" overwrites the entire file. Default: "append"'
        ),
    },
    async (args) => {
      try {
        const vaultPath = getVaultPath();
        const fullPath = safePath(vaultPath, args.notePath);

        // Verify the file exists before updating
        const stat = await fs.stat(fullPath);
        if (!stat.isFile()) {
          return {
            content: [{ type: 'text' as const, text: `Error: "${args.notePath}" is not a file.` }],
            isError: true,
          };
        }

        const mode = args.mode ?? 'append';
        if (mode === 'append') {
          const existing = await fs.readFile(fullPath, 'utf8');
          const separator = existing.endsWith('\n') ? '' : '\n';
          await fs.writeFile(fullPath, existing + separator + args.content, 'utf8');
        } else {
          await fs.writeFile(fullPath, args.content, 'utf8');
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: `Note updated (${mode}): ${args.notePath}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error updating note: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Update Obsidian Note',
        readOnlyHint: false,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// obsidian_search
// ---------------------------------------------------------------------------

const MAX_SEARCH_RESULTS = 50;
const MAX_SNIPPET_LENGTH = 200;

function createSearchTool() {
  return tool(
    'obsidian_search',
    'Search for text across all Markdown notes in the Obsidian vault. Returns matching file paths and snippets.',
    {
      query: z.string().min(1).describe('Text to search for (case-insensitive)'),
      folder: z
        .string()
        .optional()
        .describe('Optional subfolder to limit the search (relative to vault root)'),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe('Maximum number of matching files to return (default 20)'),
    },
    async (args) => {
      try {
        const vaultPath = getVaultPath();
        const searchRoot = args.folder ? safePath(vaultPath, args.folder) : path.resolve(vaultPath);
        const limit = args.maxResults ?? 20;

        const files = await collectMarkdownFiles(searchRoot, path.resolve(vaultPath));
        const queryLower = args.query.toLowerCase();

        const matches: { notePath: string; snippet: string }[] = [];

        for (const relPath of files) {
          if (matches.length >= limit) break;
          const fullPath = path.join(path.resolve(vaultPath), relPath);
          let content: string;
          try {
            content = await fs.readFile(fullPath, 'utf8');
          } catch {
            continue;
          }

          const idx = content.toLowerCase().indexOf(queryLower);
          if (idx === -1) continue;

          const start = Math.max(0, idx - 60);
          const end = Math.min(content.length, idx + args.query.length + 60);
          const snippet = (start > 0 ? '…' : '') + content.slice(start, end).trim() + (end < content.length ? '…' : '');

          matches.push({
            notePath: relPath,
            snippet: snippet.length > MAX_SNIPPET_LENGTH ? snippet.slice(0, MAX_SNIPPET_LENGTH) + '…' : snippet,
          });
        }

        if (matches.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No notes found containing "${fenceUntrustedContent(args.query, 'obsidian.query')}"`,
              },
            ],
          };
        }

        const header = `Found ${matches.length} note${matches.length !== 1 ? 's' : ''} matching "${fenceUntrustedContent(args.query, 'obsidian.query')}":`;
        const lines: string[] = [header, ''];

        for (const match of matches) {
          lines.push(`File: ${fenceUntrustedContent(match.notePath, 'obsidian.filenames')}`);
          lines.push(`Snippet: ${fenceUntrustedContent(match.snippet, 'obsidian.note')}`);
          lines.push('');
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error searching notes: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Search Obsidian Notes',
        readOnlyHint: true,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// obsidian_daily_note
// ---------------------------------------------------------------------------

function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function createDailyNoteTool() {
  return tool(
    'obsidian_daily_note',
    "Get or create today's daily note. The note is placed in a configurable daily notes folder within the vault.",
    {
      dailyNotesFolder: z
        .string()
        .optional()
        .describe(
          'Folder for daily notes relative to vault root (e.g. "Daily Notes"). Defaults to "Daily Notes".'
        ),
      createIfMissing: z
        .boolean()
        .optional()
        .describe("If true, create today's daily note if it does not exist. Default: true"),
      template: z
        .string()
        .optional()
        .describe('Initial content template if creating a new note. Defaults to a simple date heading.'),
    },
    async (args) => {
      try {
        const vaultPath = getVaultPath();
        const folder = args.dailyNotesFolder ?? 'Daily Notes';
        const today = getTodayString();
        const noteRelPath = path.join(folder, `${today}.md`);
        const fullPath = safePath(vaultPath, noteRelPath);

        let exists = false;
        try {
          await fs.stat(fullPath);
          exists = true;
        } catch {
          // Does not exist
        }

        if (exists) {
          let content = await fs.readFile(fullPath, 'utf8');
          if (content.length > MAX_NOTE_BYTES) {
            content =
              content.slice(0, MAX_NOTE_BYTES) +
              `\n\n[Note truncated — showing first ${MAX_NOTE_BYTES} bytes]`;
          }
          const fencedContent = fenceUntrustedContent(content, 'obsidian.note');
          return {
            content: [
              {
                type: 'text' as const,
                text: [`Daily note for ${today} (${noteRelPath}):`, '', fencedContent].join('\n'),
              },
            ],
          };
        }

        // Note does not exist
        const shouldCreate = args.createIfMissing !== false;
        if (!shouldCreate) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Daily note for ${today} does not exist at "${noteRelPath}". Set createIfMissing=true to create it.`,
              },
            ],
          };
        }

        const defaultTemplate = `# ${today}\n\n`;
        const noteContent = args.template ?? defaultTemplate;

        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, noteContent, 'utf8');

        return {
          content: [
            {
              type: 'text' as const,
              text: `Created daily note for ${today} at "${noteRelPath}".\n\n${fenceUntrustedContent(noteContent, 'obsidian.note')}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error accessing daily note: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Obsidian Daily Note',
        readOnlyHint: false,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createObsidianTools(): ConnectorToolDefinition[] {
  return [
    {
      name: 'obsidian_list_notes',
      description: 'List .md files in the Obsidian vault or a subfolder',
      sdkTool: createListNotesTool(),
    },
    {
      name: 'obsidian_read_note',
      description: 'Read the content of an Obsidian note',
      sdkTool: createReadNoteTool(),
    },
    {
      name: 'obsidian_create_note',
      description: 'Create a new Markdown note in the vault',
      sdkTool: createCreateNoteTool(),
    },
    {
      name: 'obsidian_update_note',
      description: 'Append or replace content in an existing Obsidian note',
      sdkTool: createUpdateNoteTool(),
    },
    {
      name: 'obsidian_search',
      description: 'Search note contents across the vault using text matching',
      sdkTool: createSearchTool(),
    },
    {
      name: 'obsidian_daily_note',
      description: "Get or create today's daily note",
      sdkTool: createDailyNoteTool(),
    },
  ];
}
