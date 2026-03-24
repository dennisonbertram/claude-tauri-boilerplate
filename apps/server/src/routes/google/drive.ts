import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import { getGoogleOAuth } from '../../db';
import { classifyGoogleError } from '../../services/google/auth';
import { listFiles, getFile, getFileContent, uploadFile } from '../../services/google/drive';

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
      const result = await listFiles(db, { q, pageToken, pageSize });
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
        classified.status as 400 | 401 | 403 | 404 | 429 | 500 | 502
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
        classified.status as 400 | 401 | 403 | 404 | 429 | 500 | 502
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
      const content = await getFileContent(db, fileId, { exportMimeType });
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
        classified.status as 400 | 401 | 403 | 404 | 429 | 500 | 502
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
      const result = await uploadFile(db, {
        name: body.name,
        content: body.content,
        mimeType: body.mimeType,
        parentId: body.parentId,
      });
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
        classified.status as 400 | 401 | 403 | 404 | 429 | 500 | 502
      );
    }
  });

  return router;
}
