import { describe, test, expect, mock, beforeEach } from 'bun:test';
import type { Database } from 'bun:sqlite';

// ---------------------------------------------------------------------------
// Mock the calendar service before importing tools
// ---------------------------------------------------------------------------

const mockListEvents = mock(async () => ({ items: [], nextPageToken: undefined }));
const mockCreateEvent = mock(async () => ({}));
const mockUpdateEvent = mock(async () => ({}));
const mockDeleteEvent = mock(async () => undefined);

mock.module('../../services/google/calendar', () => ({
  listEvents: mockListEvents,
  createEvent: mockCreateEvent,
  updateEvent: mockUpdateEvent,
  deleteEvent: mockDeleteEvent,
}));

// Import after mocking
import { createCalendarTools } from './tools';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal Database stub — the real db is only passed through to service fns */
const fakeDb = {} as unknown as Database;

function getTools() {
  return createCalendarTools(fakeDb);
}

function findTool(name: string) {
  const tools = getTools();
  const entry = tools.find((t) => t.name === name);
  if (!entry) throw new Error(`Tool not found: ${name}`);
  return entry.sdkTool;
}

/** Invoke the tool handler directly (MCP tool has an inputSchema + handler) */
async function invokeTool(toolName: string, args: Record<string, unknown>) {
  const sdkTool = findTool(toolName) as any;
  // The SDK tool() function returns an object with a .handler property
  return sdkTool.handler(args);
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleEvent = {
  id: 'evt-001',
  summary: 'Team Meeting',
  start: '2025-06-01T10:00:00Z',
  end: '2025-06-01T11:00:00Z',
  location: 'Conference Room A',
  description: 'Weekly sync',
  htmlLink: 'https://calendar.google.com/event?eid=evt-001',
  attendees: [
    { email: 'alice@example.com', responseStatus: 'accepted' },
    { email: 'bob@example.com', responseStatus: 'needsAction' },
  ],
};

// ---------------------------------------------------------------------------
// Tests: calendar_list_events
// ---------------------------------------------------------------------------

describe('calendar_list_events', () => {
  beforeEach(() => {
    mockListEvents.mockReset();
    mockCreateEvent.mockReset();
    mockUpdateEvent.mockReset();
    mockDeleteEvent.mockReset();
  });

  test('returns formatted event list when events exist', async () => {
    mockListEvents.mockResolvedValueOnce({ items: [sampleEvent], nextPageToken: undefined });

    const result = await invokeTool('calendar_list_events', {});

    expect(result.isError).toBeFalsy();
    const text: string = result.content[0].text;
    expect(text).toContain('Found 1 event(s)');
    expect(text).toContain('Team Meeting');
    expect(text).toContain('Conference Room A');
    expect(text).toContain('alice@example.com');
  });

  test('returns no events message when list is empty', async () => {
    mockListEvents.mockResolvedValueOnce({ items: [], nextPageToken: undefined });

    const result = await invokeTool('calendar_list_events', {});

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('No events found');
  });

  test('includes pagination token hint when nextPageToken present', async () => {
    mockListEvents.mockResolvedValueOnce({
      items: [sampleEvent],
      nextPageToken: 'tok-abc123',
    });

    const result = await invokeTool('calendar_list_events', {});
    expect(result.content[0].text).toContain('tok-abc123');
  });

  test('passes calendarId, timeMin, timeMax, maxResults, pageToken to service', async () => {
    mockListEvents.mockResolvedValueOnce({ items: [], nextPageToken: undefined });

    await invokeTool('calendar_list_events', {
      calendarId: 'work@example.com',
      timeMin: '2025-01-01T00:00:00Z',
      timeMax: '2025-12-31T23:59:59Z',
      maxResults: 10,
      pageToken: 'next-page',
    });

    expect(mockListEvents).toHaveBeenCalledWith(
      fakeDb,
      'work@example.com',
      '2025-01-01T00:00:00Z',
      '2025-12-31T23:59:59Z',
      'next-page',
      10,
    );
  });

  test('returns error response when service throws', async () => {
    mockListEvents.mockRejectedValueOnce(new Error('Auth expired'));

    const result = await invokeTool('calendar_list_events', {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Auth expired');
  });
});

// ---------------------------------------------------------------------------
// Tests: calendar_create_event
// ---------------------------------------------------------------------------

describe('calendar_create_event', () => {
  beforeEach(() => {
    mockListEvents.mockReset();
    mockCreateEvent.mockReset();
    mockUpdateEvent.mockReset();
    mockDeleteEvent.mockReset();
  });

  test('returns created event details on success', async () => {
    mockCreateEvent.mockResolvedValueOnce(sampleEvent);

    const result = await invokeTool('calendar_create_event', {
      summary: 'Team Meeting',
      start: '2025-06-01T10:00:00Z',
      end: '2025-06-01T11:00:00Z',
    });

    expect(result.isError).toBeFalsy();
    const text: string = result.content[0].text;
    expect(text).toContain('Event created successfully');
    expect(text).toContain('Team Meeting');
    expect(text).toContain('evt-001');
  });

  test('passes all fields to service including optional ones', async () => {
    mockCreateEvent.mockResolvedValueOnce(sampleEvent);

    await invokeTool('calendar_create_event', {
      summary: 'Team Meeting',
      start: '2025-06-01T10:00:00Z',
      end: '2025-06-01T11:00:00Z',
      description: 'Weekly sync',
      location: 'Conference Room A',
      attendees: ['alice@example.com', 'bob@example.com'],
      calendarId: 'work@example.com',
    });

    expect(mockCreateEvent).toHaveBeenCalledWith(
      fakeDb,
      {
        summary: 'Team Meeting',
        start: '2025-06-01T10:00:00Z',
        end: '2025-06-01T11:00:00Z',
        description: 'Weekly sync',
        location: 'Conference Room A',
        attendees: ['alice@example.com', 'bob@example.com'],
      },
      'work@example.com',
    );
  });

  test('returns error response when service throws', async () => {
    mockCreateEvent.mockRejectedValueOnce(new Error('Quota exceeded'));

    const result = await invokeTool('calendar_create_event', {
      summary: 'Test',
      start: '2025-06-01T10:00:00Z',
      end: '2025-06-01T11:00:00Z',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Quota exceeded');
  });
});

// ---------------------------------------------------------------------------
// Tests: calendar_update_event
// ---------------------------------------------------------------------------

describe('calendar_update_event', () => {
  beforeEach(() => {
    mockListEvents.mockReset();
    mockCreateEvent.mockReset();
    mockUpdateEvent.mockReset();
    mockDeleteEvent.mockReset();
  });

  test('returns updated event details on success', async () => {
    const updatedEvent = { ...sampleEvent, summary: 'Updated Meeting' };
    mockUpdateEvent.mockResolvedValueOnce(updatedEvent);

    const result = await invokeTool('calendar_update_event', {
      eventId: 'evt-001',
      summary: 'Updated Meeting',
    });

    expect(result.isError).toBeFalsy();
    const text: string = result.content[0].text;
    expect(text).toContain('Event updated successfully');
    expect(text).toContain('Updated Meeting');
    expect(text).toContain('evt-001');
  });

  test('passes eventId, updates, and calendarId to service', async () => {
    mockUpdateEvent.mockResolvedValueOnce(sampleEvent);

    await invokeTool('calendar_update_event', {
      eventId: 'evt-001',
      summary: 'New Title',
      location: 'Room B',
      calendarId: 'work@example.com',
    });

    expect(mockUpdateEvent).toHaveBeenCalledWith(
      fakeDb,
      'evt-001',
      { summary: 'New Title', location: 'Room B' },
      'work@example.com',
    );
  });

  test('returns error response when service throws', async () => {
    mockUpdateEvent.mockRejectedValueOnce(new Error('Event not found'));

    const result = await invokeTool('calendar_update_event', {
      eventId: 'nonexistent',
      summary: 'Updated',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Event not found');
  });

  test('returns error when no update fields provided', async () => {
    const result = await invokeTool('calendar_update_event', {
      eventId: 'evt-001',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('At least one field');
    // The service should NOT have been called
    expect(mockUpdateEvent).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: calendar_delete_event
// ---------------------------------------------------------------------------

describe('calendar_delete_event', () => {
  beforeEach(() => {
    mockListEvents.mockReset();
    mockCreateEvent.mockReset();
    mockUpdateEvent.mockReset();
    mockDeleteEvent.mockReset();
  });

  test('returns success message on deletion', async () => {
    mockDeleteEvent.mockResolvedValueOnce(undefined);

    const result = await invokeTool('calendar_delete_event', {
      eventId: 'evt-001',
    });

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('evt-001');
    expect(result.content[0].text).toContain('deleted successfully');
  });

  test('passes eventId and calendarId to service', async () => {
    mockDeleteEvent.mockResolvedValueOnce(undefined);

    await invokeTool('calendar_delete_event', {
      eventId: 'evt-001',
      calendarId: 'work@example.com',
    });

    expect(mockDeleteEvent).toHaveBeenCalledWith(fakeDb, 'evt-001', 'work@example.com');
  });

  test('returns error response when service throws', async () => {
    mockDeleteEvent.mockRejectedValueOnce(new Error('Insufficient permissions'));

    const result = await invokeTool('calendar_delete_event', {
      eventId: 'evt-001',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Insufficient permissions');
  });
});

// ---------------------------------------------------------------------------
// Tests: connector factory
// ---------------------------------------------------------------------------

describe('calendarConnectorFactory', () => {
  test('creates connector with correct metadata', async () => {
    const { calendarConnectorFactory } = await import('./index');
    const connector = calendarConnectorFactory(fakeDb);

    expect(connector.name).toBe('calendar');
    expect(connector.displayName).toBe('Google Calendar');
    expect(connector.category).toBe('productivity');
    expect(connector.requiresAuth).toBe(true);
    expect(connector.icon).toBe('📅');
  });

  test('creates connector with 4 tools', async () => {
    const { calendarConnectorFactory } = await import('./index');
    const connector = calendarConnectorFactory(fakeDb);

    expect(connector.tools).toHaveLength(4);
    const toolNames = connector.tools.map((t) => t.name);
    expect(toolNames).toContain('calendar_list_events');
    expect(toolNames).toContain('calendar_create_event');
    expect(toolNames).toContain('calendar_update_event');
    expect(toolNames).toContain('calendar_delete_event');
  });
});
