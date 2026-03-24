import { google } from 'googleapis';
import type { Database } from 'bun:sqlite';
import { getAuthenticatedClient, classifyGoogleError } from './auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface DriveFileContent {
  content: string;
  mimeType: string;
}

// ---------------------------------------------------------------------------
// Default export MIME types for Google Workspace files
// ---------------------------------------------------------------------------

const WORKSPACE_EXPORT_DEFAULTS: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
  'application/vnd.google-apps.drawing': 'image/png',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listFiles(
  db: Database,
  query?: string,
  pageToken?: string,
  pageSize: number = 50,
): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
  const client = getAuthenticatedClient(db);
  const drive = google.drive({ version: 'v3', auth: client });

  try {
    const res = await drive.files.list({
      q: query ?? undefined,
      pageToken: pageToken ?? undefined,
      pageSize,
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)',
    });

    const files: DriveFile[] = (res.data.files ?? []).map((f: any) => ({
      id: f.id ?? '',
      name: f.name ?? '',
      mimeType: f.mimeType ?? '',
      size: f.size ?? undefined,
      modifiedTime: f.modifiedTime ?? undefined,
      webViewLink: f.webViewLink ?? undefined,
    }));

    return {
      files,
      nextPageToken: res.data.nextPageToken ?? undefined,
    };
  } catch (err) {
    throw Object.assign(new Error('Drive listFiles failed'), {
      cause: err,
      classified: classifyGoogleError(err),
    });
  }
}

export async function getFile(
  db: Database,
  fileId: string,
): Promise<DriveFile> {
  const client = getAuthenticatedClient(db);
  const drive = google.drive({ version: 'v3', auth: client });

  try {
    const res = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, modifiedTime, webViewLink',
    });

    return {
      id: res.data.id ?? '',
      name: res.data.name ?? '',
      mimeType: res.data.mimeType ?? '',
      size: res.data.size ?? undefined,
      modifiedTime: res.data.modifiedTime ?? undefined,
      webViewLink: res.data.webViewLink ?? undefined,
    };
  } catch (err) {
    throw Object.assign(new Error('Drive getFile failed'), {
      cause: err,
      classified: classifyGoogleError(err),
    });
  }
}

export async function getFileContent(
  db: Database,
  fileId: string,
  exportMimeType?: string,
): Promise<DriveFileContent> {
  const client = getAuthenticatedClient(db);
  const drive = google.drive({ version: 'v3', auth: client });

  try {
    // First, determine the file's MIME type
    const meta = await drive.files.get({ fileId, fields: 'mimeType' });
    const fileMime = meta.data.mimeType ?? '';

    const isWorkspaceFile = fileMime.startsWith('application/vnd.google-apps.');

    if (isWorkspaceFile) {
      // Export Google Workspace files
      const targetMime =
        exportMimeType ?? WORKSPACE_EXPORT_DEFAULTS[fileMime] ?? 'text/plain';
      const res = await drive.files.export(
        { fileId, mimeType: targetMime },
        { responseType: 'text' },
      );
      return {
        content: String(res.data),
        mimeType: targetMime,
      };
    }

    // Regular file — download content
    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'text' },
    );
    return {
      content: String(res.data),
      mimeType: fileMime,
    };
  } catch (err) {
    throw Object.assign(new Error('Drive getFileContent failed'), {
      cause: err,
      classified: classifyGoogleError(err),
    });
  }
}

export async function uploadFile(
  db: Database,
  name: string,
  content: string,
  mimeType: string,
  parentId?: string,
): Promise<DriveFile> {
  const client = getAuthenticatedClient(db);
  const drive = google.drive({ version: 'v3', auth: client });

  try {
    const res = await drive.files.create({
      requestBody: {
        name,
        parents: parentId ? [parentId] : undefined,
      },
      media: {
        mimeType,
        body: content,
      },
      fields: 'id, name, mimeType, size, modifiedTime, webViewLink',
    });

    return {
      id: res.data.id ?? '',
      name: res.data.name ?? '',
      mimeType: res.data.mimeType ?? '',
      size: res.data.size ?? undefined,
      modifiedTime: res.data.modifiedTime ?? undefined,
      webViewLink: res.data.webViewLink ?? undefined,
    };
  } catch (err) {
    throw Object.assign(new Error('Drive uploadFile failed'), {
      cause: err,
      classified: classifyGoogleError(err),
    });
  }
}
