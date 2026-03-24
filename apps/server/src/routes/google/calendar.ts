import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import { getGoogleOAuth } from '../../db';
import { classifyGoogleError } from '../../services/google/auth';
import { listEvents, createEvent, updateEvent, deleteEvent } from '../../services/google/calendar';

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
      const result = await listEvents(db, { calendarId, timeMin, timeMax, pageToken, maxResults });
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

  // ----- POST /events -----
  router.post('/events', async (c) => {
    const oauth = getGoogleOAuth(db);
    if (!oauth?.accessToken) {
      return c.json({ error: 'Google is not connected', code: 'GOOGLE_NOT_CONNECTED' }, 401);
    }

    const body = await c.req.json<{
      summary: string;
      start: { dateTime?: string; date?: string; timeZone?: string };
      end: { dateTime?: string; date?: string; timeZone?: string };
      description?: string;
      location?: string;
      attendees?: Array<{ email: string }>;
      calendarId?: string;
    }>();

    if (!body.summary || !body.start || !body.end) {
      return c.json(
        { error: 'Missing required fields: summary, start, end', code: 'VALIDATION_ERROR' },
        400
      );
    }

    try {
      const result = await createEvent(db, {
        calendarId: body.calendarId ?? 'primary',
        summary: body.summary,
        start: body.start,
        end: body.end,
        description: body.description,
        location: body.location,
        attendees: body.attendees,
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

  // ----- PUT /events/:id -----
  router.put('/events/:id', async (c) => {
    const oauth = getGoogleOAuth(db);
    if (!oauth?.accessToken) {
      return c.json({ error: 'Google is not connected', code: 'GOOGLE_NOT_CONNECTED' }, 401);
    }

    const eventId = c.req.param('id');
    const body = await c.req.json<{
      summary?: string;
      start?: { dateTime?: string; date?: string; timeZone?: string };
      end?: { dateTime?: string; date?: string; timeZone?: string };
      description?: string;
      location?: string;
      attendees?: Array<{ email: string }>;
      calendarId?: string;
    }>();

    try {
      const result = await updateEvent(db, eventId, {
        calendarId: body.calendarId ?? 'primary',
        ...body,
      });
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

  // ----- DELETE /events/:id -----
  router.delete('/events/:id', async (c) => {
    const oauth = getGoogleOAuth(db);
    if (!oauth?.accessToken) {
      return c.json({ error: 'Google is not connected', code: 'GOOGLE_NOT_CONNECTED' }, 401);
    }

    const eventId = c.req.param('id');
    const calendarId = c.req.query('calendarId') ?? 'primary';

    try {
      await deleteEvent(db, eventId, { calendarId });
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
        classified.status as 400 | 401 | 403 | 404 | 429 | 500 | 502
      );
    }
  });

  return router;
}
