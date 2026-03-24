import { google } from 'googleapis';
import type { Database } from 'bun:sqlite';
import { getAuthenticatedClient, classifyGoogleError } from './auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  status?: string;
  htmlLink?: string;
  attendees?: Array<{ email: string; responseStatus?: string }>;
}

export interface CreateEventInput {
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  attendees?: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toCalendarEvent(item: any): CalendarEvent {
  return {
    id: item.id ?? '',
    summary: item.summary ?? '',
    description: item.description ?? undefined,
    location: item.location ?? undefined,
    start: item.start?.dateTime ?? item.start?.date ?? '',
    end: item.end?.dateTime ?? item.end?.date ?? '',
    status: item.status ?? undefined,
    htmlLink: item.htmlLink ?? undefined,
    attendees: item.attendees?.map((a: any) => ({
      email: a.email ?? '',
      responseStatus: a.responseStatus ?? undefined,
    })),
  };
}

/**
 * Build a datetime object for Calendar API.
 * If the string looks like a date-only (YYYY-MM-DD), use `date`.
 * Otherwise treat as dateTime with a timezone.
 */
function toEventDateTime(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { date: value };
  }
  return { dateTime: value, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listEvents(
  db: Database,
  calendarId: string = 'primary',
  timeMin?: string,
  timeMax?: string,
  pageToken?: string,
  maxResults: number = 50,
): Promise<{ items: CalendarEvent[]; nextPageToken?: string }> {
  const client = getAuthenticatedClient(db);
  const calendar = google.calendar({ version: 'v3', auth: client });

  try {
    const res = await calendar.events.list({
      calendarId,
      timeMin: timeMin ?? undefined,
      timeMax: timeMax ?? undefined,
      pageToken: pageToken ?? undefined,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return {
      items: (res.data.items ?? []).map(toCalendarEvent),
      nextPageToken: res.data.nextPageToken ?? undefined,
    };
  } catch (err) {
    throw Object.assign(new Error('Calendar listEvents failed'), {
      cause: err,
      classified: classifyGoogleError(err),
    });
  }
}

export async function createEvent(
  db: Database,
  event: CreateEventInput,
  calendarId: string = 'primary',
): Promise<CalendarEvent> {
  const client = getAuthenticatedClient(db);
  const calendar = google.calendar({ version: 'v3', auth: client });

  try {
    const res = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: toEventDateTime(event.start),
        end: toEventDateTime(event.end),
        attendees: event.attendees?.map((email) => ({ email })),
      },
    });

    return toCalendarEvent(res.data);
  } catch (err) {
    throw Object.assign(new Error('Calendar createEvent failed'), {
      cause: err,
      classified: classifyGoogleError(err),
    });
  }
}

export async function updateEvent(
  db: Database,
  eventId: string,
  event: Partial<CreateEventInput>,
  calendarId: string = 'primary',
): Promise<CalendarEvent> {
  const client = getAuthenticatedClient(db);
  const calendar = google.calendar({ version: 'v3', auth: client });

  const body: any = {};
  if (event.summary !== undefined) body.summary = event.summary;
  if (event.description !== undefined) body.description = event.description;
  if (event.location !== undefined) body.location = event.location;
  if (event.start !== undefined) body.start = toEventDateTime(event.start);
  if (event.end !== undefined) body.end = toEventDateTime(event.end);
  if (event.attendees !== undefined) {
    body.attendees = event.attendees.map((email) => ({ email }));
  }

  try {
    const res = await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: body,
    });

    return toCalendarEvent(res.data);
  } catch (err) {
    throw Object.assign(new Error('Calendar updateEvent failed'), {
      cause: err,
      classified: classifyGoogleError(err),
    });
  }
}

export async function deleteEvent(
  db: Database,
  eventId: string,
  calendarId: string = 'primary',
): Promise<void> {
  const client = getAuthenticatedClient(db);
  const calendar = google.calendar({ version: 'v3', auth: client });

  try {
    await calendar.events.delete({ calendarId, eventId });
  } catch (err) {
    throw Object.assign(new Error('Calendar deleteEvent failed'), {
      cause: err,
      classified: classifyGoogleError(err),
    });
  }
}
