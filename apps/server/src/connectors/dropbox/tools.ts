import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { sanitizeError, fenceUntrustedContent } from '../utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DROPBOX_API_BASE = 'https://api.dropboxapi.com/2';
const DROPBOX_CONTENT_BASE = 'https://content.dropboxapi.com/2';
const MAX_FILE_READ_BYTES = 100_000; // 100KB
const MAX_FILE_UPLOAD_BYTES = 1_000_000; // 1MB

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAccessToken(): string {
  const token = process.env.DROPBOX_ACCESS_TOKEN;
  if (!token) {
    throw new Error('DROPBOX_ACCESS_TOKEN environment variable is not set');
  }
  return token;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function dropboxPost(endpoint: string, body: unknown): Promise<unknown> {
  const token = getAccessToken();
  const response = await fetch(`${DROPBOX_API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Dropbox API error ${response.status}: ${text.substring(0, 200)}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// dropbox_list_folder
// ---------------------------------------------------------------------------

function createListFolderTool(_db: Database) {
  return tool(
    'dropbox_list_folder',
    'List the contents of a Dropbox folder. Returns files and sub-folders at the given path.',
    {
      path: z
        .string()
        .describe('The path of the folder to list (e.g. "/Documents"). Use "" or "/" for the root folder.'),
    },
    async (args) => {
      try {
        // Dropbox API requires "" for root, not "/"
        const normalizedPath = args.path === '/' ? '' : args.path;
        const data = await dropboxPost('/files/list_folder', { path: normalizedPath }) as any;

        const entries: any[] = data.entries ?? [];

        if (entries.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Folder is empty: ${fenceUntrustedContent(args.path, 'dropbox.path')}`,
              },
            ],
          };
        }

        const lines: string[] = [
          `Dropbox folder: ${fenceUntrustedContent(args.path, 'dropbox.path')}`,
          `${entries.length} item${entries.length !== 1 ? 's' : ''}`,
          '',
        ];

        for (const entry of entries) {
          const tag = entry['.tag'] ?? 'unknown';
          const name = fenceUntrustedContent(String(entry.name ?? ''), 'dropbox.name');
          const entryPath = fenceUntrustedContent(String(entry.path_display ?? entry.path_lower ?? ''), 'dropbox.path');

          if (tag === 'folder') {
            lines.push(`[folder] ${name}`);
            lines.push(`  Path: ${entryPath}`);
          } else {
            const size = typeof entry.size === 'number' ? ` (${formatBytes(entry.size)})` : '';
            const modified = entry.server_modified ? ` — modified ${entry.server_modified}` : '';
            lines.push(`[file] ${name}${size}${modified}`);
            lines.push(`  Path: ${entryPath}`);
          }
          lines.push('');
        }

        if (data.has_more) {
          lines.push(`More entries available. Cursor: ${data.cursor}`);
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing folder: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Dropbox Folder',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// dropbox_search
// ---------------------------------------------------------------------------

function createSearchTool(_db: Database) {
  return tool(
    'dropbox_search',
    'Search for files and folders in Dropbox by name or content.',
    {
      query: z.string().describe('Search query string to match against file names and content'),
    },
    async (args) => {
      try {
        const data = await dropboxPost('/files/search_v2', { query: args.query }) as any;

        const matches: any[] = data.matches ?? [];

        if (matches.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No results found for query: ${fenceUntrustedContent(args.query, 'dropbox.query')}`,
              },
            ],
          };
        }

        const lines: string[] = [
          `Search results for: ${fenceUntrustedContent(args.query, 'dropbox.query')}`,
          `${matches.length} match${matches.length !== 1 ? 'es' : ''}`,
          '',
        ];

        for (const match of matches) {
          const metadata = match.metadata?.metadata ?? match.metadata ?? {};
          const tag = metadata['.tag'] ?? 'unknown';
          const name = fenceUntrustedContent(String(metadata.name ?? ''), 'dropbox.name');
          const path = fenceUntrustedContent(String(metadata.path_display ?? metadata.path_lower ?? ''), 'dropbox.path');

          if (tag === 'folder') {
            lines.push(`[folder] ${name}`);
          } else {
            const size = typeof metadata.size === 'number' ? ` (${formatBytes(metadata.size)})` : '';
            lines.push(`[file] ${name}${size}`);
          }
          lines.push(`  Path: ${path}`);
          lines.push('');
        }

        if (data.has_more) {
          lines.push(`More results available. Cursor: ${data.cursor}`);
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error searching Dropbox: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Search Dropbox',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// dropbox_get_metadata
// ---------------------------------------------------------------------------

function createGetMetadataTool(_db: Database) {
  return tool(
    'dropbox_get_metadata',
    'Get metadata for a file or folder in Dropbox (name, size, modified date, path).',
    {
      path: z.string().describe('The path to the file or folder (e.g. "/Documents/report.pdf")'),
    },
    async (args) => {
      try {
        const data = await dropboxPost('/files/get_metadata', { path: args.path }) as any;

        const tag = data['.tag'] ?? 'unknown';
        const lines: string[] = [
          `Type: ${tag}`,
          `Name: ${fenceUntrustedContent(String(data.name ?? ''), 'dropbox.name')}`,
          `Path: ${fenceUntrustedContent(String(data.path_display ?? data.path_lower ?? ''), 'dropbox.path')}`,
        ];

        if (tag === 'file') {
          if (typeof data.size === 'number') {
            lines.push(`Size: ${formatBytes(data.size)} (${data.size} bytes)`);
          }
          if (data.server_modified) {
            lines.push(`Modified: ${data.server_modified}`);
          }
          if (data.client_modified) {
            lines.push(`Client Modified: ${data.client_modified}`);
          }
          if (data.content_hash) {
            lines.push(`Content Hash: ${data.content_hash}`);
          }
          if (data.rev) {
            lines.push(`Revision: ${data.rev}`);
          }
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting metadata: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Dropbox Metadata',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// dropbox_read_file
// ---------------------------------------------------------------------------

function createReadFileTool(_db: Database) {
  return tool(
    'dropbox_read_file',
    'Download and read the contents of a file from Dropbox. Content is truncated at 100KB.',
    {
      path: z.string().describe('The path to the file in Dropbox (e.g. "/notes.txt")'),
    },
    async (args) => {
      try {
        const token = getAccessToken();
        const response = await fetch(`${DROPBOX_CONTENT_BASE}/files/download`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Dropbox-API-Arg': JSON.stringify({ path: args.path }),
          },
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`Dropbox API error ${response.status}: ${text.substring(0, 200)}`);
        }

        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const totalBytes = bytes.length;

        let content: string;
        let truncated = false;

        if (totalBytes > MAX_FILE_READ_BYTES) {
          const slice = bytes.slice(0, MAX_FILE_READ_BYTES);
          content = new TextDecoder('utf-8', { fatal: false }).decode(slice);
          truncated = true;
        } else {
          content = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        }

        const lines: string[] = [
          `File: ${fenceUntrustedContent(args.path, 'dropbox.path')}`,
          `Size: ${formatBytes(totalBytes)}`,
          '',
          '--- Content ---',
          fenceUntrustedContent(content, 'dropbox.file_content'),
        ];

        if (truncated) {
          lines.push('');
          lines.push(`[Content truncated — showing first ${MAX_FILE_READ_BYTES} bytes of ${totalBytes}]`);
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error reading file: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Read Dropbox File',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// dropbox_upload_file
// ---------------------------------------------------------------------------

function createUploadFileTool(_db: Database) {
  return tool(
    'dropbox_upload_file',
    'Upload a file to Dropbox. Provide the destination path and file content as a string. Maximum 1MB content.',
    {
      path: z
        .string()
        .describe('The destination path in Dropbox (e.g. "/Documents/notes.txt")'),
      content: z
        .string()
        .max(MAX_FILE_UPLOAD_BYTES)
        .describe('The file content as a string (max 1MB)'),
      mode: z
        .enum(['add', 'overwrite', 'update'])
        .optional()
        .describe('Write mode: "add" (default, fail if exists), "overwrite" (replace if exists), "update" (update specific revision)'),
    },
    async (args) => {
      try {
        const contentBytes = new TextEncoder().encode(args.content);
        if (contentBytes.length > MAX_FILE_UPLOAD_BYTES) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: File content exceeds maximum upload size of ${formatBytes(MAX_FILE_UPLOAD_BYTES)}. Provided: ${formatBytes(contentBytes.length)}`,
              },
            ],
            isError: true,
          };
        }

        const token = getAccessToken();
        const apiArg = {
          path: args.path,
          mode: args.mode ?? 'add',
          autorename: false,
          mute: false,
        };

        const response = await fetch(`${DROPBOX_CONTENT_BASE}/files/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Dropbox-API-Arg': JSON.stringify(apiArg),
            'Content-Type': 'application/octet-stream',
          },
          body: contentBytes,
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`Dropbox API error ${response.status}: ${text.substring(0, 200)}`);
        }

        const data = await response.json() as any;

        const lines: string[] = [
          'File uploaded successfully.',
          `Name: ${fenceUntrustedContent(String(data.name ?? ''), 'dropbox.name')}`,
          `Path: ${fenceUntrustedContent(String(data.path_display ?? data.path_lower ?? ''), 'dropbox.path')}`,
        ];

        if (typeof data.size === 'number') {
          lines.push(`Size: ${formatBytes(data.size)}`);
        }
        if (data.server_modified) {
          lines.push(`Modified: ${data.server_modified}`);
        }
        if (data.content_hash) {
          lines.push(`Content Hash: ${data.content_hash}`);
        }
        if (data.rev) {
          lines.push(`Revision: ${data.rev}`);
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error uploading file: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Upload Dropbox File',
        readOnlyHint: false,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// dropbox_get_space_usage
// ---------------------------------------------------------------------------

function createGetSpaceUsageTool(_db: Database) {
  return tool(
    'dropbox_get_space_usage',
    'Get the storage space usage for the current Dropbox account, including used and allocated storage.',
    {},
    async (_args) => {
      try {
        const data = await dropboxPost('/users/get_space_usage', null) as any;

        const usedBytes: number = data.used ?? 0;
        const allocation = data.allocation ?? {};
        const allocationTag = allocation['.tag'] ?? 'unknown';

        const lines: string[] = [
          `Dropbox Space Usage`,
          `Used: ${formatBytes(usedBytes)}`,
        ];

        if (allocationTag === 'individual') {
          const allocatedBytes: number = allocation.allocated ?? 0;
          const percent = allocatedBytes > 0 ? ((usedBytes / allocatedBytes) * 100).toFixed(1) : '0.0';
          lines.push(`Allocated: ${formatBytes(allocatedBytes)}`);
          lines.push(`Usage: ${percent}%`);
          lines.push(`Free: ${formatBytes(Math.max(0, allocatedBytes - usedBytes))}`);
        } else if (allocationTag === 'team') {
          const usedInTeam: number = allocation.used ?? 0;
          const allocated: number = allocation.allocated ?? 0;
          lines.push(`Team Used: ${formatBytes(usedInTeam)}`);
          if (allocated > 0) {
            lines.push(`Team Allocated: ${formatBytes(allocated)}`);
          }
        } else {
          lines.push(`Allocation Type: ${allocationTag}`);
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting space usage: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Dropbox Space Usage',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createDropboxTools(db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'dropbox_list_folder',
      description: 'List the contents of a Dropbox folder',
      sdkTool: createListFolderTool(db),
    },
    {
      name: 'dropbox_search',
      description: 'Search for files and folders in Dropbox',
      sdkTool: createSearchTool(db),
    },
    {
      name: 'dropbox_get_metadata',
      description: 'Get metadata for a file or folder in Dropbox',
      sdkTool: createGetMetadataTool(db),
    },
    {
      name: 'dropbox_read_file',
      description: 'Download and read the contents of a file from Dropbox',
      sdkTool: createReadFileTool(db),
    },
    {
      name: 'dropbox_upload_file',
      description: 'Upload a file to Dropbox',
      sdkTool: createUploadFileTool(db),
    },
    {
      name: 'dropbox_get_space_usage',
      description: 'Get the storage space usage for the Dropbox account',
      sdkTool: createGetSpaceUsageTool(db),
    },
  ];
}
