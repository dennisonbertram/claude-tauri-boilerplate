import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { sanitizeError, fenceUntrustedContent } from '../utils';
import { getAuthenticatedClient } from '../../services/google/auth';

// ---------------------------------------------------------------------------
// Google Photos API helpers
// ---------------------------------------------------------------------------

const PICKER_API_BASE = 'https://photospicker.googleapis.com/v1';
const LIBRARY_API_BASE = 'https://photoslibrary.googleapis.com/v1';

async function getAccessToken(db: Database): Promise<string> {
  const client = getAuthenticatedClient(db);
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;
  if (!token) {
    throw new Error('Unable to retrieve Google OAuth access token — user must reconnect');
  }
  return token;
}

async function photosGet<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401) {
    throw new Error('Google Photos: unauthorized (401) — token may have expired');
  }
  if (response.status === 403) {
    throw new Error('Google Photos: forbidden (403) — missing required scope or access denied');
  }
  if (!response.ok) {
    throw new Error(`Google Photos API error: HTTP ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function photosPost<T>(url: string, token: string, body: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    throw new Error('Google Photos: unauthorized (401) — token may have expired');
  }
  if (response.status === 403) {
    throw new Error('Google Photos: forbidden (403) — missing required scope or access denied');
  }
  if (!response.ok) {
    throw new Error(`Google Photos API error: HTTP ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Type definitions for Google Photos API responses
// ---------------------------------------------------------------------------

interface PickerSession {
  id: string;
  pickerUri: string;
  pollingConfig?: {
    pollInterval?: string;
    timeoutIn?: string;
  };
  expireTime?: string;
  mediaItemsSet?: boolean;
}

interface PickerMediaItem {
  id: string;
  createTime?: string;
  type?: string;
  mediaFile?: {
    baseUrl?: string;
    mimeType?: string;
    mediaFileMetadata?: {
      width?: number;
      height?: number;
      filename?: string;
      photoMetadata?: Record<string, unknown>;
      videoMetadata?: Record<string, unknown>;
    };
  };
}

interface PickerMediaItemsResponse {
  mediaItems?: PickerMediaItem[];
  nextPageToken?: string;
}

interface LibraryMediaItem {
  id: string;
  description?: string;
  productUrl?: string;
  baseUrl?: string;
  mimeType?: string;
  mediaMetadata?: {
    creationTime?: string;
    width?: string;
    height?: string;
    filename?: string;
    photo?: Record<string, unknown>;
    video?: Record<string, unknown>;
  };
  filename?: string;
}

interface Album {
  id: string;
  title?: string;
  productUrl?: string;
  coverPhotoBaseUrl?: string;
  mediaItemsCount?: string;
  isWriteable?: boolean;
}

interface AlbumsResponse {
  albums?: Album[];
  nextPageToken?: string;
}

// ---------------------------------------------------------------------------
// photos_create_picker_session
// ---------------------------------------------------------------------------

function createPickerSessionTool(db: Database) {
  return tool(
    'photos_create_picker_session',
    'Create a Google Photos Picker session. Returns a pickerUri the user must open in their browser to select photos. The session expires after a limited time. After the user selects photos and closes the picker, use photos_poll_picker_session to check the status.',
    {},
    async (_args) => {
      try {
        const token = await getAccessToken(db);
        const session = await photosPost<PickerSession>(
          `${PICKER_API_BASE}/sessions`,
          token,
          {}
        );

        const lines = [
          'Google Photos Picker session created.',
          '',
          `Session ID: ${session.id}`,
          `Picker URL: ${session.pickerUri}`,
          '',
          'Ask the user to open the Picker URL in their browser to select photos.',
          'Once they have finished selecting and closed the picker, call photos_poll_picker_session to check if selection is complete.',
        ];

        if (session.expireTime) {
          lines.push(``, `Session expires at: ${session.expireTime}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error creating picker session: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Create Google Photos Picker Session',
        readOnlyHint: false,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// photos_poll_picker_session
// ---------------------------------------------------------------------------

function createPollPickerSessionTool(db: Database) {
  return tool(
    'photos_poll_picker_session',
    'Check the status of a Google Photos Picker session. Returns whether the user has finished selecting photos (mediaItemsSet: true). If true, call photos_list_selected to retrieve the selected items.',
    {
      sessionId: z.string().describe('The Picker session ID returned by photos_create_picker_session'),
    },
    async (args) => {
      try {
        const token = await getAccessToken(db);
        const session = await photosGet<PickerSession>(
          `${PICKER_API_BASE}/sessions/${encodeURIComponent(args.sessionId)}`,
          token
        );

        const lines = [
          `Session ID: ${session.id}`,
          `Selection complete: ${session.mediaItemsSet ? 'Yes' : 'No'}`,
        ];

        if (session.mediaItemsSet) {
          lines.push('', 'The user has finished selecting photos. Call photos_list_selected to retrieve the selected media items.');
        } else {
          lines.push('', 'The user has not yet finished selecting photos. The picker may still be open or the user has not started yet.');
          if (session.pollingConfig?.pollInterval) {
            lines.push(`Suggested polling interval: ${session.pollingConfig.pollInterval}`);
          }
        }

        if (session.expireTime) {
          lines.push(``, `Session expires at: ${session.expireTime}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error polling picker session: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Poll Google Photos Picker Session',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// photos_list_selected
// ---------------------------------------------------------------------------

function createListSelectedTool(db: Database) {
  return tool(
    'photos_list_selected',
    'List media items selected by the user in a Google Photos Picker session. Only available after the user has finished selecting (mediaItemsSet = true). Note: base URLs expire in ~60 minutes.',
    {
      sessionId: z.string().describe('The Picker session ID returned by photos_create_picker_session'),
      pageToken: z
        .string()
        .optional()
        .describe('Page token from a previous response to retrieve the next page'),
      pageSize: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Maximum number of items to return (1-100, default 25)'),
    },
    async (args) => {
      try {
        const token = await getAccessToken(db);

        const params = new URLSearchParams();
        if (args.pageToken) params.set('pageToken', args.pageToken);
        if (args.pageSize) params.set('pageSize', String(args.pageSize));

        const url = `${PICKER_API_BASE}/sessions/${encodeURIComponent(args.sessionId)}/mediaItems${params.size > 0 ? '?' + params.toString() : ''}`;
        const data = await photosGet<PickerMediaItemsResponse>(url, token);

        const items = data.mediaItems ?? [];
        if (items.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No media items found in this picker session. The user may not have selected any items, or the session may have expired.',
            }],
          };
        }

        const lines: string[] = [
          `Found ${items.length} selected media item${items.length !== 1 ? 's' : ''}:`,
          '',
        ];

        for (const item of items) {
          lines.push(`ID: ${item.id}`);
          if (item.mediaFile?.mediaFileMetadata?.filename) {
            lines.push(`Filename: ${fenceUntrustedContent(item.mediaFile.mediaFileMetadata.filename, 'GooglePhotos')}`);
          }
          if (item.type) {
            lines.push(`Type: ${item.type}`);
          }
          if (item.mediaFile?.mimeType) {
            lines.push(`MIME type: ${item.mediaFile.mimeType}`);
          }
          if (item.mediaFile?.baseUrl) {
            lines.push(`Base URL (expires ~60 min): ${item.mediaFile.baseUrl}`);
          }
          if (item.createTime) {
            lines.push(`Created: ${item.createTime}`);
          }
          const meta = item.mediaFile?.mediaFileMetadata;
          if (meta?.width && meta?.height) {
            lines.push(`Dimensions: ${meta.width}x${meta.height}`);
          }
          lines.push('');
        }

        if (data.nextPageToken) {
          lines.push(`Next page token: ${data.nextPageToken}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing selected media items: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Selected Google Photos',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// photos_get_media
// ---------------------------------------------------------------------------

function createGetMediaTool(db: Database) {
  return tool(
    'photos_get_media',
    'Get details and a base URL for a specific Google Photos media item by its ID. The base URL can be used to download or display the photo/video. Note: base URLs expire in ~60 minutes and must not be stored long-term.',
    {
      mediaItemId: z.string().describe('The media item ID to retrieve'),
    },
    async (args) => {
      try {
        const token = await getAccessToken(db);
        const item = await photosGet<LibraryMediaItem>(
          `${LIBRARY_API_BASE}/mediaItems/${encodeURIComponent(args.mediaItemId)}`,
          token
        );

        const lines: string[] = [
          `Media Item ID: ${item.id}`,
        ];

        if (item.filename) {
          lines.push(`Filename: ${fenceUntrustedContent(item.filename, 'GooglePhotos')}`);
        } else if (item.mediaMetadata?.filename) {
          lines.push(`Filename: ${fenceUntrustedContent(item.mediaMetadata.filename, 'GooglePhotos')}`);
        }

        if (item.description) {
          lines.push(`Description: ${fenceUntrustedContent(item.description, 'GooglePhotos')}`);
        }

        if (item.mimeType) {
          lines.push(`MIME type: ${item.mimeType}`);
        }

        if (item.baseUrl) {
          lines.push(`Base URL (expires ~60 min): ${item.baseUrl}`);
        }

        if (item.productUrl) {
          lines.push(`Google Photos URL: ${item.productUrl}`);
        }

        const meta = item.mediaMetadata;
        if (meta) {
          if (meta.creationTime) lines.push(`Created: ${meta.creationTime}`);
          if (meta.width && meta.height) lines.push(`Dimensions: ${meta.width}x${meta.height}`);
          if (meta.photo) lines.push(`Type: Photo`);
          if (meta.video) lines.push(`Type: Video`);
        }

        lines.push('', 'Note: Base URLs expire in approximately 60 minutes. Do not store them long-term.');

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error retrieving media item: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Google Photos Media Item',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// photos_list_albums
// ---------------------------------------------------------------------------

function createListAlbumsTool(db: Database) {
  return tool(
    'photos_list_albums',
    'List the user\'s Google Photos albums. Requires the photoslibrary.readonly scope. Returns album titles, IDs, and item counts. Note: cover photo base URLs expire in ~60 minutes.',
    {
      pageToken: z
        .string()
        .optional()
        .describe('Page token from a previous response to retrieve the next page'),
      pageSize: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe('Maximum number of albums to return (1-50, default 20)'),
    },
    async (args) => {
      try {
        const token = await getAccessToken(db);

        const params = new URLSearchParams();
        if (args.pageToken) params.set('pageToken', args.pageToken);
        params.set('pageSize', String(args.pageSize ?? 20));

        const url = `${LIBRARY_API_BASE}/albums?${params.toString()}`;
        const data = await photosGet<AlbumsResponse>(url, token);

        const albums = data.albums ?? [];
        if (albums.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No albums found in this Google Photos account.' }],
          };
        }

        const lines: string[] = [
          `Found ${albums.length} album${albums.length !== 1 ? 's' : ''}:`,
          '',
        ];

        for (const album of albums) {
          lines.push(`ID: ${album.id}`);
          if (album.title) {
            lines.push(`Title: ${fenceUntrustedContent(album.title, 'GooglePhotos')}`);
          }
          if (album.mediaItemsCount) {
            lines.push(`Items: ${album.mediaItemsCount}`);
          }
          if (album.isWriteable !== undefined) {
            lines.push(`Writeable: ${album.isWriteable ? 'Yes' : 'No'}`);
          }
          if (album.productUrl) {
            lines.push(`Google Photos URL: ${album.productUrl}`);
          }
          lines.push('');
        }

        if (data.nextPageToken) {
          lines.push(`Next page token: ${data.nextPageToken}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing albums: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Google Photos Albums',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createGooglePhotosTools(db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'photos_create_picker_session',
      description: 'Create a Google Photos Picker session and return a URI for the user to open',
      sdkTool: createPickerSessionTool(db),
    },
    {
      name: 'photos_poll_picker_session',
      description: 'Check if the user has finished selecting photos in a Picker session',
      sdkTool: createPollPickerSessionTool(db),
    },
    {
      name: 'photos_list_selected',
      description: 'List media items selected in a Google Photos Picker session',
      sdkTool: createListSelectedTool(db),
    },
    {
      name: 'photos_get_media',
      description: 'Get details and base URL for a specific Google Photos media item',
      sdkTool: createGetMediaTool(db),
    },
    {
      name: 'photos_list_albums',
      description: 'List the user\'s Google Photos albums (requires photoslibrary.readonly scope)',
      sdkTool: createListAlbumsTool(db),
    },
  ];
}
