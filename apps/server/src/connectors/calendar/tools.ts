import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { listEvents, createEvent, updateEvent, deleteEvent } from '../../services/google/calendar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEventTime(isoString: string): string {
  if (!isoString) return 'Unknown time';
  // Date-only (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) {
    return isoString;
  }
  try {
    return new Date(isoString).toLocaleString();
  } catch {
    return isoString;
  }
}

// ---------------------------------------------------------------------------
// calendar_list_events
// ---------------------------------------------------------------------------

function createListEventsTool(db: Database) {
  return tool(
    'calendar_list_events',
    'List upcoming Google Calendar events. Optionally filter by time range and limit results.',
    {
      calendarId: z
        .string()
        .optional()
        .describe('Calendar ID to list events from (default: "primary")'),
      timeMin: z
        .string()
        .optional()
        .describe('Start of time range as ISO 8601 string (e.g. "2025-01-01T00:00:00Z")'),
      timeMax: z
        .string()
        .optional()
        .describe('End of time range as ISO 8601 string (e.g. "2025-01-31T23:59:59Z")'),
      maxResults: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe('Maximum number of events to return (1-100, default 50)'),
      pageToken: z
        .string()
        .optional()
        .describe('Page token for pagination from a previous response'),
    },
    async (args) => {
      try {
        const result = await listEvents(
          db,
          args.calendarId,
          args.timeMin,
          args.timeMax,
          args.pageToken,
          args.maxResults,
        );

        if (result.items.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No events found in the specified time range.' }],
          };
        }

        const lines: string[] = [`Found ${result.items.length} event(s):`, ''];
        for (const event of result.items) {
          lines.push(`Title: ${event.summary}`);
          lines.push(`Start: ${formatEventTime(event.start)}`);
          lines.push(`End:   ${formatEventTime(event.end)}`);
          if (event.location) lines.push(`Location: ${event.location}`);
          if (event.description) lines.push(`Description: ${event.description}`);
          if (event.attendees && event.attendees.length > 0) {
            lines.push(`Attendees: ${event.attendees.map((a) => a.email).join(', ')}`);
          }
          if (event.htmlLink) lines.push(`Link: ${event.htmlLink}`);
          lines.push('');
        }

        if (result.nextPageToken) {
          lines.push(`(More events available — use pageToken: "${result.nextPageToken}" to fetch the next page)`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error listing events: ${message}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Calendar Events',
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
  );
}

// ---------------------------------------------------------------------------
// calendar_create_event
// ---------------------------------------------------------------------------

function createCreateEventTool(db: Database) {
  return tool(
    'calendar_create_event',
    'Create a new event on Google Calendar.',
    {
      summary: z.string().describe('Event title/summary'),
      start: z
        .string()
        .describe('Event start time as ISO 8601 string or date (e.g. "2025-06-01T10:00:00-07:00")'),
      end: z
        .string()
        .describe('Event end time as ISO 8601 string or date (e.g. "2025-06-01T11:00:00-07:00")'),
      description: z.string().optional().describe('Event description or notes'),
      location: z.string().optional().describe('Event location or address'),
      attendees: z
        .array(z.string())
        .optional()
        .describe('List of attendee email addresses'),
      calendarId: z
        .string()
        .optional()
        .describe('Calendar ID to create the event in (default: "primary")'),
    },
    async (args) => {
      try {
        const event = await createEvent(
          db,
          {
            summary: args.summary,
            start: args.start,
            end: args.end,
            description: args.description,
            location: args.location,
            attendees: args.attendees,
          },
          args.calendarId,
        );

        const lines: string[] = ['Event created successfully:', ''];
        lines.push(`Title: ${event.summary}`);
        lines.push(`Start: ${formatEventTime(event.start)}`);
        lines.push(`End:   ${formatEventTime(event.end)}`);
        if (event.location) lines.push(`Location: ${event.location}`);
        if (event.description) lines.push(`Description: ${event.description}`);
        if (event.attendees && event.attendees.length > 0) {
          lines.push(`Attendees: ${event.attendees.map((a) => a.email).join(', ')}`);
        }
        lines.push(`Event ID: ${event.id}`);
        if (event.htmlLink) lines.push(`Link: ${event.htmlLink}`);

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error creating event: ${message}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Create Calendar Event',
        readOnlyHint: false,
        openWorldHint: false,
      },
    },
  );
}

// ---------------------------------------------------------------------------
// calendar_update_event
// ---------------------------------------------------------------------------

function createUpdateEventTool(db: Database) {
  return tool(
    'calendar_update_event',
    'Update an existing Google Calendar event. Only provided fields will be changed.',
    {
      eventId: z.string().describe('The ID of the event to update'),
      summary: z.string().optional().describe('New event title/summary'),
      start: z.string().optional().describe('New start time as ISO 8601 string'),
      end: z.string().optional().describe('New end time as ISO 8601 string'),
      description: z.string().optional().describe('New event description or notes'),
      location: z.string().optional().describe('New event location or address'),
      calendarId: z
        .string()
        .optional()
        .describe('Calendar ID containing the event (default: "primary")'),
    },
    async (args) => {
      try {
        const { eventId, calendarId, ...updates } = args;
        const event = await updateEvent(db, eventId, updates, calendarId);

        const lines: string[] = ['Event updated successfully:', ''];
        lines.push(`Title: ${event.summary}`);
        lines.push(`Start: ${formatEventTime(event.start)}`);
        lines.push(`End:   ${formatEventTime(event.end)}`);
        if (event.location) lines.push(`Location: ${event.location}`);
        if (event.description) lines.push(`Description: ${event.description}`);
        if (event.attendees && event.attendees.length > 0) {
          lines.push(`Attendees: ${event.attendees.map((a) => a.email).join(', ')}`);
        }
        lines.push(`Event ID: ${event.id}`);
        if (event.htmlLink) lines.push(`Link: ${event.htmlLink}`);

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error updating event: ${message}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Update Calendar Event',
        readOnlyHint: false,
        openWorldHint: false,
      },
    },
  );
}

// ---------------------------------------------------------------------------
// calendar_delete_event
// ---------------------------------------------------------------------------

function createDeleteEventTool(db: Database) {
  return tool(
    'calendar_delete_event',
    'Delete a Google Calendar event permanently. This action cannot be undone.',
    {
      eventId: z.string().describe('The ID of the event to delete'),
      calendarId: z
        .string()
        .optional()
        .describe('Calendar ID containing the event (default: "primary")'),
    },
    async (args) => {
      try {
        await deleteEvent(db, args.eventId, args.calendarId);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Event "${args.eventId}" deleted successfully.`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error deleting event: ${message}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Delete Calendar Event',
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: true,
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createCalendarTools(db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'calendar_list_events',
      description: 'List upcoming Google Calendar events with optional time range filter',
      sdkTool: createListEventsTool(db),
    },
    {
      name: 'calendar_create_event',
      description: 'Create a new event on Google Calendar',
      sdkTool: createCreateEventTool(db),
    },
    {
      name: 'calendar_update_event',
      description: 'Update an existing Google Calendar event',
      sdkTool: createUpdateEventTool(db),
    },
    {
      name: 'calendar_delete_event',
      description: 'Delete a Google Calendar event permanently',
      sdkTool: createDeleteEventTool(db),
    },
  ];
}
