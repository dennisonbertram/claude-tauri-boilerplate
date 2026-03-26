import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { listFiles, getFile, getFileContent, uploadFile } from '../../services/google/drive';
import { sanitizeError } from '../utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALLOWED_EXPORT_TYPES = [
  'text/plain',
  'text/csv',
  'text/html',
  'text/tab-separated-values',
  'application/json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(size?: string): string {
  if (!size) return 'N/A';
  const bytes = parseInt(size, 10);
  if (isNaN(bytes)) return size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMimeType(mimeType: string): string {
  const typeMap: Record<string, string> = {
    'application/vnd.google-apps.document': 'Google Doc',
    'application/vnd.google-apps.spreadsheet': 'Google Sheet',
    'application/vnd.google-apps.presentation': 'Google Slides',
    'application/vnd.google-apps.folder': 'Folder',
    'application/vnd.google-apps.drawing': 'Google Drawing',
    'application/vnd.google-apps.form': 'Google Form',
    'application/pdf': 'PDF',
    'text/plain': 'Text',
    'text/csv': 'CSV',
    'image/png': 'PNG',
    'image/jpeg': 'JPEG',
  };
  return typeMap[mimeType] ?? mimeType;
}

function formatModifiedTime(modifiedTime?: string): string {
  if (!modifiedTime) return 'N/A';
  try {
    return new Date(modifiedTime).toLocaleString();
  } catch {
    return modifiedTime;
  }
}

// ---------------------------------------------------------------------------
// drive_search_files
// ---------------------------------------------------------------------------

function createSearchFilesTool(db: Database) {
  return tool(
    'drive_search_files',
    'Search or list files in Google Drive. Use Google Drive query syntax for filtering (e.g. "name contains \'report\'", "mimeType = \'application/pdf\'"). Returns file name, type, modified date, and link.',
    {
      query: z
        .string()
        .optional()
        .describe("Google Drive query string (e.g. \"name contains 'report'\" or \"mimeType = 'application/pdf'\"). Omit to list recent files."),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Maximum number of results to return (1-100, default 50)'),
      pageToken: z
        .string()
        .optional()
        .describe('Page token for pagination (from a previous search result)'),
    },
    async (args) => {
      try {
        const { files, nextPageToken } = await listFiles(
          db,
          args.query,
          args.pageToken,
          args.maxResults ?? 50,
        );

        if (files.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: args.query
                  ? `No files found matching query: ${args.query}`
                  : 'No files found in Google Drive.',
              },
            ],
          };
        }

        const lines: string[] = [
          `Google Drive Files (${files.length} result${files.length !== 1 ? 's' : ''})`,
          '',
        ];

        for (const file of files) {
          lines.push(`Name: ${file.name}`);
          lines.push(`  ID: ${file.id}`);
          lines.push(`  Type: ${formatMimeType(file.mimeType)}`);
          lines.push(`  Modified: ${formatModifiedTime(file.modifiedTime)}`);
          lines.push(`  Size: ${formatFileSize(file.size)}`);
          if (file.webViewLink) {
            lines.push(`  Link: ${file.webViewLink}`);
          }
          lines.push('');
        }

        if (nextPageToken) {
          lines.push(`More results available. Use pageToken: ${nextPageToken}`);
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Search Drive Files',
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
  );
}

// ---------------------------------------------------------------------------
// drive_get_file
// ---------------------------------------------------------------------------

function createGetFileTool(db: Database) {
  return tool(
    'drive_get_file',
    'Get metadata for a specific Google Drive file by its ID. Returns name, type, size, modified date, and view link.',
    {
      fileId: z.string().describe('The Google Drive file ID'),
    },
    async (args) => {
      try {
        const file = await getFile(db, args.fileId);

        const lines = [
          `File: ${file.name}`,
          `ID: ${file.id}`,
          `Type: ${formatMimeType(file.mimeType)} (${file.mimeType})`,
          `Size: ${formatFileSize(file.size)}`,
          `Modified: ${formatModifiedTime(file.modifiedTime)}`,
        ];

        if (file.webViewLink) {
          lines.push(`Link: ${file.webViewLink}`);
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Drive File',
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
  );
}

// ---------------------------------------------------------------------------
// drive_read_file
// ---------------------------------------------------------------------------

function createReadFileTool(db: Database) {
  return tool(
    'drive_read_file',
    'Read the content of a Google Drive file. Google Docs are exported as text/plain by default; Google Sheets as text/csv. Use exportMimeType to override the export format for Google Workspace files.',
    {
      fileId: z.string().describe('The Google Drive file ID'),
      exportMimeType: z
        .enum(ALLOWED_EXPORT_TYPES)
        .optional()
        .describe(
          `MIME type to export Google Workspace files as. Allowed values: ${ALLOWED_EXPORT_TYPES.join(', ')}. Only used for Google Docs, Sheets, Slides, etc.`,
        ),
    },
    async (args) => {
      try {
        const fileContent = await getFileContent(db, args.fileId, args.exportMimeType);

        const MAX_CONTENT_LENGTH = 100_000; // ~100KB
        let text = fileContent.content;
        if (text.length > MAX_CONTENT_LENGTH) {
          text = text.slice(0, MAX_CONTENT_LENGTH) + `\n\n[Content truncated — showing first ${MAX_CONTENT_LENGTH} characters of ${fileContent.content.length}]`;
        }

        const header = `[Content-Type: ${fileContent.mimeType}]\n\n`;
        return {
          content: [
            {
              type: 'text' as const,
              text: header + text,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Read Drive File',
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
  );
}

// ---------------------------------------------------------------------------
// drive_upload_file
// ---------------------------------------------------------------------------

function createUploadFileTool(db: Database) {
  return tool(
    'drive_upload_file',
    'Upload a new file to Google Drive. Provide the file name, content as a string, and MIME type. Optionally specify a parent folder ID.',
    {
      name: z.string().describe('The name for the new file'),
      content: z.string().max(1_000_000).describe('The file content as a string'),
      mimeType: z
        .string()
        .describe('MIME type of the file (e.g. "text/plain", "text/csv", "application/json")'),
      parentId: z
        .string()
        .optional()
        .describe('ID of the parent folder to upload into (omit for root)'),
    },
    async (args) => {
      try {
        const file = await uploadFile(
          db,
          args.name,
          args.content,
          args.mimeType,
          args.parentId,
        );

        const lines = [
          `File uploaded successfully.`,
          `Name: ${file.name}`,
          `ID: ${file.id}`,
          `Type: ${formatMimeType(file.mimeType)} (${file.mimeType})`,
          `Size: ${formatFileSize(file.size)}`,
          `Modified: ${formatModifiedTime(file.modifiedTime)}`,
        ];

        if (file.webViewLink) {
          lines.push(`Link: ${file.webViewLink}`);
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Upload Drive File',
        readOnlyHint: false,
        openWorldHint: false,
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createDriveTools(db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'drive_search_files',
      description: 'Search or list files in Google Drive',
      sdkTool: createSearchFilesTool(db),
    },
    {
      name: 'drive_get_file',
      description: 'Get metadata for a specific Google Drive file',
      sdkTool: createGetFileTool(db),
    },
    {
      name: 'drive_read_file',
      description: 'Read the content of a Google Drive file',
      sdkTool: createReadFileTool(db),
    },
    {
      name: 'drive_upload_file',
      description: 'Upload a new file to Google Drive',
      sdkTool: createUploadFileTool(db),
    },
  ];
}
