import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import { getGoogleOAuth } from '../../db';
import { classifyGoogleError } from '../../services/google/auth';
import { listEvents, createEvent, updateEvent, deleteEvent } from '../../services/google/calendar';

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

export function createCalendarRouter(db: Database) {
  const router = new Hono();

  // ----- GET /events -----
  router.get('/events', async (c) => {
    const oauth = getGoogleOAuth(db);
    if (!oauth?.accessToken) {
      return c.json({ error: 'Google is not connected', code: 'GOOGLE_NOT_CONNECTED' }, 401);
    }

    const calendarId = c.req.query('calendarId') ?? 'primary';
    const timeMin = c.req.query('timeMin');
    const timeMax = c.req.query('timeMax');
    const pageToken = c.req.query('pageToken');
    const maxResults = Math.min(Math.max(Number(c.req.query('maxResults') ?? 25), 1), 250);

    try {
      const result = await listEvents(
        db,
        calendarId,
        timeMin ?? undefined,
        timeMax ?? undefined,
        pageToken ?? undefined,
        maxResults,
      );
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

  // ----- POST /events -----
  router.post('/events', async (c) => {
    const oauth = getGoogleOAuth(db);
    if (!oauth?.accessToken) {
      return c.json({ error: 'Google is not connected', code: 'GOOGLE_NOT_CONNECTED' }, 401);
    }

    const body = await c.req.json<{
      summary: string;
      start: string;
      end: string;
      description?: string;
      location?: string;
      attendees?: string[];
      calendarId?: string;
    }>();

    if (!body.summary || !body.start || !body.end) {
      return c.json(
        { error: 'Missing required fields: summary, start, end', code: 'VALIDATION_ERROR' },
        400
      );
    }

    try {
      const result = await createEvent(
        db,
        {
          summary: body.summary,
          start: body.start,
          end: body.end,
          description: body.description,
          location: body.location,
          attendees: body.attendees,
        },
        body.calendarId ?? 'primary',
      );
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

  // ----- PUT /events/:id -----
  router.put('/events/:id', async (c) => {
    const oauth = getGoogleOAuth(db);
    if (!oauth?.accessToken) {
      return c.json({ error: 'Google is not connected', code: 'GOOGLE_NOT_CONNECTED' }, 401);
    }

    const eventId = c.req.param('id');
    const body = await c.req.json<{
      summary?: string;
      start?: string;
      end?: string;
      description?: string;
      location?: string;
      attendees?: string[];
      calendarId?: string;
    }>();

    try {
      const { calendarId, ...eventFields } = body;
      const result = await updateEvent(
        db,
        eventId,
        eventFields,
        calendarId ?? 'primary',
      );
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

  // ----- DELETE /events/:id -----
  router.delete('/events/:id', async (c) => {
    const oauth = getGoogleOAuth(db);
    if (!oauth?.accessToken) {
      return c.json({ error: 'Google is not connected', code: 'GOOGLE_NOT_CONNECTED' }, 401);
    }

    const eventId = c.req.param('id');
    const calendarId = c.req.query('calendarId') ?? 'primary';

    try {
      await deleteEvent(db, eventId, calendarId);
      return c.json({ ok: true });
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
