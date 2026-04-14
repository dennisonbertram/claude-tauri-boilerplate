import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { sanitizeError, fenceUntrustedContent } from '../utils';

// ---------------------------------------------------------------------------
// JXA helper
// ---------------------------------------------------------------------------

const execFileAsync = promisify(execFile);

export type JxaRunner = (script: string) => Promise<string>;

export async function runJxa(script: string): Promise<string> {
  const { stdout } = await execFileAsync('osascript', ['-l', 'JavaScript', '-e', script], {
    timeout: 15_000,
  });
  return stdout.trim();
}

// ---------------------------------------------------------------------------
// HTML tag stripping helper
// ---------------------------------------------------------------------------

export function stripHtmlTags(html: string): string {
  // Replace common block-level tags with newlines for readability
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n');
  // Strip all remaining tags
  text = text.replace(/<[^>]+>/g, '');
  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  // Collapse excessive whitespace/newlines while preserving paragraph breaks
  text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

// ---------------------------------------------------------------------------
// notes_list_folders
// ---------------------------------------------------------------------------

function createListFoldersTool(jxa: JxaRunner) {
  return tool(
    'notes_list_folders',
    'List all note folders and accounts in Apple Notes. Returns folder names and IDs.',
    {},
    async (_args) => {
      try {
        const script = `
          var app = Application("Notes");
          var folders = app.folders();
          var result = [];
          folders.forEach(function(f) {
            try {
              result.push({
                id: f.id(),
                name: f.name(),
                noteCount: (function() { try { return f.notes().length; } catch(e) { return 0; } })()
              });
            } catch(e) {}
          });
          JSON.stringify(result);
        `;

        const raw = await jxa(script);
        const folders: Array<{ id: string; name: string; noteCount: number }> = JSON.parse(raw || '[]');

        if (folders.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No folders found in Apple Notes.' }],
          };
        }

        const lines: string[] = [`Found ${folders.length} folder${folders.length !== 1 ? 's' : ''}:`, ''];

        for (const f of folders) {
          lines.push(
            `ID: ${f.id}`,
            `Name: ${fenceUntrustedContent(f.name, 'apple-notes')}`,
            `Notes: ${f.noteCount}`,
            ''
          );
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing folders: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Note Folders',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// notes_list_notes
// ---------------------------------------------------------------------------

function createListNotesTool(jxa: JxaRunner) {
  return tool(
    'notes_list_notes',
    'List notes in an Apple Notes folder. Returns note names, IDs, and modification dates.',
    {
      folderName: z
        .string()
        .optional()
        .describe('Folder name to list notes from. Omit to list notes from all folders.'),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Maximum number of notes to return (1-100, default 25)'),
    },
    async (args) => {
      try {
        const max = args.maxResults ?? 25;

        const script = args.folderName
          ? `
            var app = Application("Notes");
            var folderName = ${JSON.stringify(args.folderName)};
            var matchingFolders = app.folders.whose({name: folderName});
            if (matchingFolders.length === 0) {
              JSON.stringify({ error: "Folder not found: " + folderName });
            } else {
              var folder = matchingFolders[0];
              var notes = folder.notes();
              var max = ${max};
              var result = [];
              var count = Math.min(notes.length, max);
              for (var i = 0; i < count; i++) {
                try {
                  var n = notes[i];
                  result.push({
                    id: n.id(),
                    name: n.name(),
                    modificationDate: (function() { try { return n.modificationDate().toString(); } catch(e) { return ""; } })()
                  });
                } catch(e) {}
              }
              JSON.stringify({ notes: result, total: notes.length });
            }
          `
          : `
            var app = Application("Notes");
            var allNotes = app.notes();
            var max = ${max};
            var result = [];
            var count = Math.min(allNotes.length, max);
            for (var i = 0; i < count; i++) {
              try {
                var n = allNotes[i];
                result.push({
                  id: n.id(),
                  name: n.name(),
                  modificationDate: (function() { try { return n.modificationDate().toString(); } catch(e) { return ""; } })()
                });
              } catch(e) {}
            }
            JSON.stringify({ notes: result, total: allNotes.length });
          `;

        const raw = await jxa(script);
        const parsed = JSON.parse(raw || '{"notes":[],"total":0}') as
          | { notes: Array<{ id: string; name: string; modificationDate: string }>; total: number }
          | { error: string };

        if ('error' in parsed) {
          return {
            content: [{ type: 'text' as const, text: `Error: ${fenceUntrustedContent(parsed.error, 'apple-notes')}` }],
            isError: true,
          };
        }

        const { notes, total } = parsed;

        if (notes.length === 0) {
          const location = args.folderName
            ? ` in folder "${fenceUntrustedContent(args.folderName, 'apple-notes')}"`
            : '';
          return {
            content: [{ type: 'text' as const, text: `No notes found${location}.` }],
          };
        }

        const truncated = total > notes.length ? ` (showing first ${notes.length} of ${total})` : '';
        const location = args.folderName
          ? ` in "${fenceUntrustedContent(args.folderName, 'apple-notes')}"`
          : '';
        const lines: string[] = [
          `Found ${total} note${total !== 1 ? 's' : ''}${location}${truncated}:`,
          '',
        ];

        for (const n of notes) {
          lines.push(
            `ID: ${n.id}`,
            `Name: ${fenceUntrustedContent(n.name, 'apple-notes')}`,
            ...(n.modificationDate ? [`Modified: ${fenceUntrustedContent(n.modificationDate, 'apple-notes')}`] : []),
            ''
          );
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing notes: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Notes',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// notes_get_note
// ---------------------------------------------------------------------------

function createGetNoteTool(jxa: JxaRunner) {
  return tool(
    'notes_get_note',
    'Get the full content of an Apple Note by name or ID. Returns plain text (HTML tags stripped). Truncated at 50KB.',
    {
      id: z.string().optional().describe('Note ID (from notes_list_notes). Takes precedence over name.'),
      name: z.string().optional().describe('Note name/title to look up (used if id is not provided).'),
    },
    async (args) => {
      if (!args.id && !args.name) {
        return {
          content: [{ type: 'text' as const, text: 'Error: provide either "id" or "name".' }],
          isError: true,
        };
      }

      try {
        const lookupExpr = args.id
          ? `app.notes.byId(${JSON.stringify(args.id)})`
          : `app.notes.whose({name: ${JSON.stringify(args.name)}})[0]`;

        const script = `
          var app = Application("Notes");
          var note = ${lookupExpr};
          if (!note) throw new Error("Note not found");
          JSON.stringify({
            id: note.id(),
            name: note.name(),
            body: note.body(),
            modificationDate: (function() { try { return note.modificationDate().toString(); } catch(e) { return ""; } })(),
            creationDate: (function() { try { return note.creationDate().toString(); } catch(e) { return ""; } })()
          });
        `;

        const raw = await jxa(script);
        const note = JSON.parse(raw) as {
          id: string;
          name: string;
          body: string;
          modificationDate: string;
          creationDate: string;
        };

        const MAX_BODY = 50_000;
        let plainText = stripHtmlTags(note.body || '');
        let truncated = false;
        if (plainText.length > MAX_BODY) {
          plainText = plainText.slice(0, MAX_BODY);
          truncated = true;
        }

        const lines = [
          `ID: ${note.id}`,
          `Title: ${fenceUntrustedContent(note.name, 'apple-notes')}`,
          ...(note.creationDate ? [`Created: ${fenceUntrustedContent(note.creationDate, 'apple-notes')}`] : []),
          ...(note.modificationDate ? [`Modified: ${fenceUntrustedContent(note.modificationDate, 'apple-notes')}`] : []),
          '',
          '--- Content ---',
          fenceUntrustedContent(plainText, 'apple-notes'),
          ...(truncated ? [`\n[Note content truncated — showing first ${MAX_BODY} characters]`] : []),
        ];

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error retrieving note: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Note Content',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// notes_create_note
// ---------------------------------------------------------------------------

function createCreateNoteTool(jxa: JxaRunner) {
  return tool(
    'notes_create_note',
    'Create a new note in Apple Notes. The body can be plain text or HTML.',
    {
      title: z.string().describe('Note title/name'),
      body: z.string().describe('Note body content (plain text or HTML)'),
      folderName: z
        .string()
        .optional()
        .describe('Folder to create the note in. Omit to create in the default Notes folder.'),
    },
    async (args) => {
      try {
        const script = args.folderName
          ? `
            var app = Application("Notes");
            var folderName = ${JSON.stringify(args.folderName)};
            var matchingFolders = app.folders.whose({name: folderName});
            if (matchingFolders.length === 0) {
              JSON.stringify({ error: "Folder not found: " + folderName });
            } else {
              var folder = matchingFolders[0];
              var note = app.Note({
                name: ${JSON.stringify(args.title)},
                body: ${JSON.stringify(args.body)}
              });
              folder.notes.push(note);
              JSON.stringify({ id: note.id(), name: note.name() });
            }
          `
          : `
            var app = Application("Notes");
            var note = app.Note({
              name: ${JSON.stringify(args.title)},
              body: ${JSON.stringify(args.body)}
            });
            app.defaultAccount.notes.push(note);
            JSON.stringify({ id: note.id(), name: note.name() });
          `;

        const raw = await jxa(script);
        const result = JSON.parse(raw) as { id: string; name: string } | { error: string };

        if ('error' in result) {
          return {
            content: [{ type: 'text' as const, text: `Error: ${fenceUntrustedContent(result.error, 'apple-notes')}` }],
            isError: true,
          };
        }

        const lines = [
          'Note created successfully.',
          `ID: ${result.id}`,
          `Title: ${fenceUntrustedContent(result.name, 'apple-notes')}`,
          ...(args.folderName ? [`Folder: ${fenceUntrustedContent(args.folderName, 'apple-notes')}`] : []),
        ];

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error creating note: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Create Note',
        readOnlyHint: false,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// notes_search
// ---------------------------------------------------------------------------

function createSearchTool(jxa: JxaRunner) {
  return tool(
    'notes_search',
    'Search Apple Notes by text content. Returns matching note names, IDs, and snippets.',
    {
      query: z.string().describe('Text to search for in note names and content'),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe('Maximum number of results to return (1-50, default 20)'),
    },
    async (args) => {
      try {
        const max = args.maxResults ?? 20;

        const script = `
          var app = Application("Notes");
          var query = ${JSON.stringify(args.query)};
          var max = ${max};
          var allNotes = app.notes();
          var results = [];
          var qLower = query.toLowerCase();

          for (var i = 0; i < allNotes.length && results.length < max; i++) {
            try {
              var n = allNotes[i];
              var name = n.name();
              var bodyHtml = n.body();
              // Strip basic tags for search
              var bodyText = bodyHtml.replace(/<[^>]+>/g, ' ').toLowerCase();
              if (name.toLowerCase().indexOf(qLower) !== -1 || bodyText.indexOf(qLower) !== -1) {
                // Get a short snippet around the match
                var snippet = bodyText.replace(/\\s+/g, ' ').trim().substring(0, 200);
                results.push({
                  id: n.id(),
                  name: name,
                  snippet: snippet,
                  modificationDate: (function() { try { return n.modificationDate().toString(); } catch(e) { return ""; } })()
                });
              }
            } catch(e) {}
          }

          JSON.stringify(results);
        `;

        const raw = await jxa(script);
        const results: Array<{ id: string; name: string; snippet: string; modificationDate: string }> =
          JSON.parse(raw || '[]');

        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No notes found matching: ${fenceUntrustedContent(args.query, 'apple-notes.query')}`,
              },
            ],
          };
        }

        const lines: string[] = [
          `Found ${results.length} note${results.length !== 1 ? 's' : ''} matching ${fenceUntrustedContent(args.query, 'apple-notes.query')}:`,
          '',
        ];

        for (const r of results) {
          lines.push(
            `ID: ${r.id}`,
            `Name: ${fenceUntrustedContent(r.name, 'apple-notes')}`,
            ...(r.modificationDate ? [`Modified: ${fenceUntrustedContent(r.modificationDate, 'apple-notes')}`] : []),
            ...(r.snippet ? [`Snippet: ${fenceUntrustedContent(r.snippet, 'apple-notes')}`] : []),
            ''
          );
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error searching notes: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Search Notes',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createAppleNotesTools(jxa: JxaRunner = runJxa): ConnectorToolDefinition[] {
  return [
    {
      name: 'notes_list_folders',
      description: 'List all note folders in Apple Notes',
      sdkTool: createListFoldersTool(jxa),
    },
    {
      name: 'notes_list_notes',
      description: 'List notes in an Apple Notes folder',
      sdkTool: createListNotesTool(jxa),
    },
    {
      name: 'notes_get_note',
      description: 'Get the full content of an Apple Note by name or ID',
      sdkTool: createGetNoteTool(jxa),
    },
    {
      name: 'notes_create_note',
      description: 'Create a new note in Apple Notes',
      sdkTool: createCreateNoteTool(jxa),
    },
    {
      name: 'notes_search',
      description: 'Search Apple Notes by text content',
      sdkTool: createSearchTool(jxa),
    },
  ];
}
