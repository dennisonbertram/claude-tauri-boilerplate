import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import { getGoogleOAuth } from '../../db';
import { classifyGoogleError } from '../../services/google/auth';
import { listFiles, getFile, getFileContent, uploadFile } from '../../services/google/drive';

function codeToHttpStatus(code: string): 400 | 401 | 403 | 404 | 429 | 500 | 502 {
  switch (code) {
    case 'not_found': return 404;
    case 'forbidden': return 403;
    case 'unauthorized': return 401;
    case 'rate_limited': return 429;
    case 'invalid_grant': return 401;
    case 'server_error': return 502;
    default: return 500;
  }
}

export function createDriveRouter(db: Database) {
  const router = new Hono();

  // ----- GET /files -----
  router.get('/files', async (c) => {
    const oauth = getGoogleOAuth(db);
    if (!oauth?.accessToken) {
      return c.json({ error: 'Google is not connected', code: 'GOOGLE_NOT_CONNECTED' }, 401);
    }

    const q = c.req.query('q') ?? '';
    const pageToken = c.req.query('pageToken');
    const pageSize = Math.min(Math.max(Number(c.req.query('pageSize') ?? 25), 1), 100);

    try {
      const result = await listFiles(db, q || undefined, pageToken ?? undefined, pageSize);
      return c.json(result);
    } catch (err) {
      const classified = classifyGoogleError(err);
      return c.json(
        {
          error: classified.message,
          code: classified.code,
          provider: 'google',
          retryable: classified.retryable,
          needsReconnect: classified.needsReconnect,
        },
        codeToHttpStatus(classified.code),
      );
    }
  });

  // ----- GET /files/:id -----
  router.get('/files/:id', async (c) => {
    const oauth = getGoogleOAuth(db);
    if (!oauth?.accessToken) {
      return c.json({ error: 'Google is not connected', code: 'GOOGLE_NOT_CONNECTED' }, 401);
    }

    const fileId = c.req.param('id');

    try {
      const file = await getFile(db, fileId);
      return c.json(file);
    } catch (err) {
      const classified = classifyGoogleError(err);
      return c.json(
        {
          error: classified.message,
          code: classified.code,
          provider: 'google',
          retryable: classified.retryable,
          needsReconnect: classified.needsReconnect,
        },
        codeToHttpStatus(classified.code),
      );
    }
  });

  // ----- GET /files/:id/content -----
  router.get('/files/:id/content', async (c) => {
    const oauth = getGoogleOAuth(db);
    if (!oauth?.accessToken) {
      return c.json({ error: 'Google is not connected', code: 'GOOGLE_NOT_CONNECTED' }, 401);
    }

    const fileId = c.req.param('id');
    const exportMimeType = c.req.query('exportMimeType');

    try {
      const content = await getFileContent(db, fileId, exportMimeType ?? undefined);
      return c.json(content);
    } catch (err) {
      const classified = classifyGoogleError(err);
      return c.json(
        {
          error: classified.message,
          code: classified.code,
          provider: 'google',
          retryable: classified.retryable,
          needsReconnect: classified.needsReconnect,
        },
        codeToHttpStatus(classified.code),
      );
    }
  });

  // ----- POST /files -----
  router.post('/files', async (c) => {
    const oauth = getGoogleOAuth(db);
    if (!oauth?.accessToken) {
      return c.json({ error: 'Google is not connected', code: 'GOOGLE_NOT_CONNECTED' }, 401);
    }

    const body = await c.req.json<{
      name: string;
      content: string;
      mimeType: string;
      parentId?: string;
    }>();

    if (!body.name || !body.content || !body.mimeType) {
      return c.json(
        { error: 'Missing required fields: name, content, mimeType', code: 'VALIDATION_ERROR' },
        400
      );
    }

    try {
      const result = await uploadFile(db, body.name, body.content, body.mimeType, body.parentId);
      return c.json(result, 201);
    } catch (err) {
      const classified = classifyGoogleError(err);
      return c.json(
        {
          error: classified.message,
          code: classified.code,
          provider: 'google',
          retryable: classified.retryable,
          needsReconnect: classified.needsReconnect,
        },
        codeToHttpStatus(classified.code),
      );
    }
  });

  return router;
}
