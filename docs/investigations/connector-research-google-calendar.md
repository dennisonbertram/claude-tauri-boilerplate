# Google Calendar Connector Research — Issue #371

**Date**: 2026-03-25
**Status**: Research Complete
**Author**: Claude Code (automated research)

---

## 1. Executive Summary

The app already has a working Google Calendar integration via `googleapis` with full OAuth2 flow, token refresh, and CRUD operations in `apps/server/src/services/google/calendar.ts`. The existing code covers `events.list`, `events.insert`, `events.patch`, and `events.delete` behind REST routes. What is missing is the **connector layer** — wrapping these API calls as `ConnectorDefinition` tools that Claude can invoke directly via the in-process MCP server, plus additional capabilities (freebusy, list calendars, search, recurring event handling).

The recommended approach is to create `apps/server/src/connectors/google-calendar/` following the weather connector pattern, reusing the existing `services/google/calendar.ts` and `services/google/auth.ts` modules as the API layer. The connector adds 8-10 tools, requires `calendar.events` scope (already granted), and is estimated at **medium complexity** (3-5 days implementation + testing).

---

## 2. API Reference — Google Calendar API v3

### 2.1 Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `events.list` | GET | List events in a calendar, supports `timeMin`/`timeMax`/`q`/`singleEvents`/`orderBy` |
| `events.get` | GET | Get a single event by ID |
| `events.insert` | POST | Create a new event |
| `events.patch` | PATCH | Partially update an event (preferred over `update` for partial changes) |
| `events.update` | PUT | Full replace of an event |
| `events.delete` | DELETE | Delete an event |
| `events.instances` | GET | List instances of a recurring event |
| `calendarList.list` | GET | List calendars in the user's calendar list |
| `freebusy.query` | POST | Check free/busy status across calendars |
| `events.watch` | POST | Set up push notifications for event changes |
| `channels.stop` | POST | Stop a push notification channel |

### 2.2 Rate Limits & Quotas

| Limit | Value |
|-------|-------|
| **Daily queries** | 1,000,000 per project per day |
| **Per-user per-minute** | ~100-500 queries (dynamically enforced since May 2021) |
| **Per-calendar write rate** | Undocumented, but bursts of >10 writes/second trigger 429 |
| **Batch requests** | Up to 50 requests per batch |
| **Max results per page** | 2500 (default 250) |
| **Max attendees per event** | ~300 (practical limit) |
| **Push notification channels** | Expire after ~1 week, must be renewed |

**Quota enforcement model** (post-May 2021): Requests are rate-limited (throttled) rather than hard-failed for the rest of the day. The API returns HTTP 429 when per-minute quotas are exceeded.

**Best practices for quota management**:
- Use `syncToken` / incremental sync instead of full re-fetches
- Use push notifications (`events.watch`) instead of polling
- Set `singleEvents=true` and expand recurring events server-side only when needed
- Increase `maxResults` page size to reduce total request count
- Use exponential backoff with jitter on 429/5xx responses

### 2.3 Auth Scopes

| Scope | Access | Current Status |
|-------|--------|----------------|
| `calendar.readonly` | Read-only access to events and calendars | Not currently requested |
| `calendar.events` | Read/write access to events only | **Already in GOOGLE_SCOPES** |
| `calendar.events.readonly` | Read-only access to events | Not needed (covered by above) |
| `calendar` | Full read/write access to calendars + events | Not needed |
| `calendar.settings.readonly` | Read calendar settings | Not needed |

The existing `GOOGLE_SCOPES` in `apps/server/src/services/google/auth.ts` already includes `https://www.googleapis.com/auth/calendar.events`, which provides read/write access to events. For `calendarList.list` and `freebusy.query`, this scope is sufficient. No scope changes are needed.

---

## 3. Existing MCP Server Implementations

### 3.1 nspady/google-calendar-mcp (Leading community implementation)

- **GitHub**: https://github.com/nspady/google-calendar-mcp
- **Stars**: 1,100+
- **Language**: TypeScript
- **Auth**: OAuth 2.0 with PKCE
- **Tools (13)**:
  - **Read (7)**: `list-calendars`, `list-events`, `get-event`, `search-events`, `get-freebusy`, `get-current-time`, `list-colors`
  - **Write (5)**: `create-event`, `create-events` (bulk), `update-event`, `delete-event`, `respond-to-event`
  - **Admin (1)**: `manage-accounts`
- **Notable features**: Multi-account support, cross-account conflict detection, recurring event modification, smart scheduling with natural language, bulk event creation, import from images/PDFs
- **Relevance**: Good reference for tool naming and schema design, but the app's connector architecture (in-process MCP via `createSdkMcpServer`) is different from standalone MCP servers

### 3.2 deciduus/calendar-mcp

- **GitHub**: https://github.com/deciduus/calendar-mcp
- **Language**: Python
- **Simpler implementation**, acts as LLM-to-Calendar API bridge
- **Less relevant** due to language mismatch

### 3.3 Claude's Built-in Google Calendar MCP

The environment already has `mcp__claude_ai_Google_Calendar__gcal_*` tools available (8 tools: `list_calendars`, `list_events`, `get_event`, `find_meeting_times`, `find_my_free_time`, `create_event`, `update_event`, `delete_event`, `respond_to_event`). These are **external MCP tools** managed by Claude's platform, not the app's in-process connector system. The in-app connector would provide tighter integration with the app's UI, database, and session management.

### 3.4 Google Official MCP (Announced March 2026)

Google announced fully-managed remote MCP servers for Google services. Still in early access. Not suitable for this use case — the app needs in-process tools with local auth token management.

---

## 4. Recommended Implementation — ConnectorDefinition Pattern

### 4.1 File Structure

```
apps/server/src/connectors/google-calendar/
├── index.ts          # ConnectorDefinition export
├── tools.ts          # tool() definitions with Zod schemas
├── api.ts            # Thin wrapper around services/google/calendar.ts + new endpoints
└── google-calendar.test.ts  # Tests with fetch mocking
```

### 4.2 ConnectorDefinition

```typescript
// index.ts
import type { ConnectorDefinition } from '../types';
import { googleCalendarTools } from './tools';

export const googleCalendarConnector: ConnectorDefinition = {
  name: 'google-calendar',
  displayName: 'Google Calendar',
  description: 'Manage calendar events, check availability, and schedule meetings using Google Calendar.',
  icon: '📅',
  category: 'productivity',
  requiresAuth: true,   // Requires Google OAuth
  tools: googleCalendarTools,
};
```

### 4.3 API Layer Design

The `api.ts` file should be a thin adapter that:
1. **Reuses** existing `services/google/calendar.ts` functions (`listEvents`, `createEvent`, `updateEvent`, `deleteEvent`)
2. **Adds** new functions for missing capabilities:
   - `getEvent(db, eventId, calendarId)` — single event fetch
   - `listCalendars(db)` — list user's calendars
   - `queryFreebusy(db, timeMin, timeMax, calendarIds)` — free/busy check
   - `searchEvents(db, query, timeMin, timeMax)` — text search
3. **Accepts `db: Database`** parameter (injected at tool registration time via closure, same pattern as REST routes)

### 4.4 Database Injection Pattern

The weather connector doesn't need auth, so it has no `db` dependency. For Google Calendar, the `db` reference must be passed to tool handlers. Recommended approach:

```typescript
// In tools.ts — factory function that closes over db
export function createGoogleCalendarTools(db: Database): ConnectorToolDefinition[] {
  // ... tool definitions that call api functions with db
}
```

The connector registry or MCP server factory will need a minor update to support connectors that need runtime dependencies (db). This is a small architectural enhancement.

---

## 5. Tool Definitions

### 5.1 Tool Inventory (Recommended: 8 tools)

| # | Tool Name | Read/Write | Description |
|---|-----------|-----------|-------------|
| 1 | `gcal_list_calendars` | Read | List available calendars |
| 2 | `gcal_list_events` | Read | List events in a time range |
| 3 | `gcal_get_event` | Read | Get a single event by ID |
| 4 | `gcal_search_events` | Read | Search events by text query |
| 5 | `gcal_check_availability` | Read | Check free/busy across calendars |
| 6 | `gcal_create_event` | Write | Create a new event |
| 7 | `gcal_update_event` | Write | Update an existing event |
| 8 | `gcal_delete_event` | Write | Delete an event |

### 5.2 Detailed Tool Schemas

#### `gcal_list_calendars`
```typescript
{
  // No required inputs
}
// Output: Array of { id, summary, primary, accessRole, timeZone }
// Annotations: readOnlyHint: true
```

#### `gcal_list_events`
```typescript
{
  calendarId: z.string().optional().describe('Calendar ID (default: "primary")'),
  timeMin: z.string().optional().describe('Start of time range (ISO 8601, e.g. "2026-03-25T00:00:00-04:00")'),
  timeMax: z.string().optional().describe('End of time range (ISO 8601)'),
  maxResults: z.number().min(1).max(250).optional().describe('Max events to return (default: 50)'),
  pageToken: z.string().optional().describe('Pagination token from previous response'),
}
// Output: { items: CalendarEvent[], nextPageToken?: string }
// Annotations: readOnlyHint: true
```

#### `gcal_get_event`
```typescript
{
  eventId: z.string().describe('The event ID'),
  calendarId: z.string().optional().describe('Calendar ID (default: "primary")'),
}
// Output: CalendarEvent
// Annotations: readOnlyHint: true
```

#### `gcal_search_events`
```typescript
{
  query: z.string().describe('Text to search for in event summaries, descriptions, locations'),
  timeMin: z.string().optional().describe('Start of time range (ISO 8601)'),
  timeMax: z.string().optional().describe('End of time range (ISO 8601)'),
  calendarId: z.string().optional().describe('Calendar ID (default: "primary")'),
}
// Output: { items: CalendarEvent[] }
// Annotations: readOnlyHint: true
```

#### `gcal_check_availability`
```typescript
{
  timeMin: z.string().describe('Start of time range (ISO 8601)'),
  timeMax: z.string().describe('End of time range (ISO 8601)'),
  calendarIds: z.array(z.string()).optional().describe('Calendar IDs to check (default: ["primary"])'),
}
// Output: { calendars: Record<string, { busy: Array<{ start: string, end: string }> }> }
// Annotations: readOnlyHint: true
```

#### `gcal_create_event`
```typescript
{
  summary: z.string().describe('Event title'),
  start: z.string().describe('Start time (ISO 8601 or YYYY-MM-DD for all-day)'),
  end: z.string().describe('End time (ISO 8601 or YYYY-MM-DD for all-day)'),
  description: z.string().optional().describe('Event description'),
  location: z.string().optional().describe('Event location'),
  attendees: z.array(z.string()).optional().describe('Email addresses of attendees'),
  calendarId: z.string().optional().describe('Calendar ID (default: "primary")'),
  timeZone: z.string().optional().describe('IANA timezone (e.g. "America/New_York"). Defaults to system timezone'),
}
// Output: CalendarEvent (the created event)
// Annotations: readOnlyHint: false
```

#### `gcal_update_event`
```typescript
{
  eventId: z.string().describe('The event ID to update'),
  summary: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  attendees: z.array(z.string()).optional(),
  calendarId: z.string().optional(),
}
// Output: CalendarEvent (the updated event)
// Annotations: readOnlyHint: false
```

#### `gcal_delete_event`
```typescript
{
  eventId: z.string().describe('The event ID to delete'),
  calendarId: z.string().optional().describe('Calendar ID (default: "primary")'),
}
// Output: { ok: true }
// Annotations: readOnlyHint: false, destructiveHint: true
```

---

## 6. Testing Plan

### 6.1 Test Architecture

Follow the weather connector pattern: mock `globalThis.fetch` to intercept `googleapis` HTTP calls. The `googleapis` library ultimately uses `fetch`/`http` under the hood, but since the existing `services/google/calendar.ts` already uses `googleapis` which makes real HTTP calls, the test strategy should mock at the **API layer boundary**.

**Recommended approach**: Mock the `googleapis` calendar client methods directly rather than low-level fetch, since `googleapis` adds complexity (auth headers, retries, etc.) that would make fetch mocking brittle.

```typescript
// Mock pattern for googleapis
import { mock } from 'bun:test';

// Mock the getAuthenticatedClient to return a fake OAuth2Client
mock.module('../../services/google/auth', () => ({
  getAuthenticatedClient: () => fakeOAuth2Client,
  classifyGoogleError: actualClassifyGoogleError,
}));
```

### 6.2 Unit Test Scenarios

#### API Layer (`api.ts`)
- **listEvents**: Returns formatted events, handles pagination, handles empty results
- **getEvent**: Returns single event, handles 404
- **createEvent**: Creates event with all fields, creates all-day event, validates required fields
- **updateEvent**: Partial update works, handles missing event
- **deleteEvent**: Successful deletion, handles missing event
- **listCalendars**: Returns calendar list, handles empty
- **queryFreebusy**: Returns busy slots, handles multi-calendar, handles empty range

#### Tool Layer (`tools.ts`)
- Each tool returns `{ content: [{ type: 'text', text }] }` on success
- Each tool returns `{ content: [...], isError: true }` on failure
- Error messages are user-friendly
- Write tools have correct annotations (`readOnlyHint: false`)

### 6.3 Timezone Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Create event in different timezone than system | Uses provided `timeZone` param |
| All-day event across timezone boundary | Uses `date` field, not `dateTime` |
| DST transition during recurring event | Recurring instances stay at local time |
| List events spanning DST change | All events returned with correct times |
| UTC offset in ISO string vs IANA timezone | IANA timezone takes precedence |

### 6.4 Recurring Event Edge Cases

| Scenario | Expected |
|----------|----------|
| List with `singleEvents=true` | Recurring events expanded into instances |
| List with `singleEvents=false` | Returns recurring event parent + exceptions |
| Update single instance of recurring event | Only that instance changes |
| Delete single instance | Creates an exception, other instances remain |

### 6.5 Auth Error Scenarios

| Scenario | Expected |
|----------|----------|
| No Google OAuth tokens stored | Returns clear "not connected" error |
| Expired access token (refresh succeeds) | Transparent retry, user sees no error |
| Revoked refresh token (`invalid_grant`) | Returns `needsReconnect: true` |
| Rate limited (429) | Returns `retryable: true` with backoff guidance |
| Insufficient scope (403) | Returns clear scope error, does NOT disconnect |

### 6.6 Regression Test Candidates

- Timezone drift when creating events without explicit timezone
- `toEventDateTime` correctly distinguishes `YYYY-MM-DD` from full ISO strings
- Token refresh race condition (concurrent requests both try to refresh)
- Pagination token forwarding (ensure nextPageToken is correctly passed through)

---

## 7. Security & Privacy

### 7.1 Data Handling

- **No event data cached in SQLite** — all queries are pass-through to Google API
- **OAuth tokens stored in SQLite** — already handled by existing `db.ts` functions
- **Attendee emails exposed to LLM** — the LLM will see email addresses of event attendees. This is inherent to calendar functionality but should be documented
- **Event content visible to LLM** — descriptions, locations, attendees are all sent as tool results

### 7.2 Scope Principle of Least Privilege

The current `calendar.events` scope is appropriate — it allows read/write to events but NOT calendar settings, ACLs, or other users' calendars (unless shared). If read-only mode is desired in the future, `calendar.events.readonly` could be offered as a separate permission tier.

### 7.3 Write Operation Safety

- `gcal_delete_event` should have `destructiveHint: true` annotation
- `gcal_create_event` with attendees sends real invitations — the LLM should confirm attendee list with the user before creating
- `gcal_update_event` can modify attendees, triggering notification emails

### 7.4 Token Security

- Refresh tokens must NEVER be logged or included in error messages
- The existing `auth.ts` correctly handles token refresh without exposing tokens
- `classifyGoogleError` already strips sensitive data from error responses

---

## 8. Watchouts & Risks

### 8.1 High Risk

| Risk | Mitigation |
|------|------------|
| **Accidental event deletion** | `destructiveHint: true` annotation; Claude typically confirms destructive actions |
| **Sending invites to wrong people** | Tool description should warn about real invitation emails |
| **Token refresh race condition** | `googleapis` client handles this internally with token locking, but concurrent tool calls could still hit edge cases |

### 8.2 Medium Risk

| Risk | Mitigation |
|------|------------|
| **Rate limiting on busy calendars** | Implement exponential backoff in API layer; use `maxResults` judiciously |
| **Timezone confusion** | Default to system timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`; always include timezone in output |
| **All-day event handling** | Existing `toEventDateTime` handles this correctly with `date` vs `dateTime` |
| **Recurring event complexity** | Phase 1: Use `singleEvents=true` to expand instances. Phase 2: Add instance-level modification |

### 8.3 Low Risk

| Risk | Mitigation |
|------|------------|
| **Google API deprecation** | Calendar API v3 is stable and widely used |
| **Quota exhaustion** | 1M daily queries is very generous for single-user desktop app |
| **Large event payloads** | Use `fields` parameter to limit response fields if needed |

### 8.4 Architectural Consideration: Database Injection

The current `ConnectorDefinition` type does not support runtime dependencies. The weather connector is stateless, but Google Calendar needs `db: Database` for auth. Options:

1. **Closure pattern** (recommended): Factory function `createGoogleCalendarConnector(db)` that returns `ConnectorDefinition` with tools that close over `db`
2. **Context object**: Add optional `context` to `ConnectorDefinition` that gets passed to tools
3. **Global singleton**: Use a module-level db reference (not recommended — breaks testability)

Option 1 requires a small change to the connector registry in `connectors/index.ts` to support lazy initialization.

---

## 9. Dependencies

### 9.1 Already Present

| Dependency | Version | Usage |
|------------|---------|-------|
| `googleapis` | (in package.json) | Google Calendar API client |
| `google-auth-library` | (transitive via googleapis) | OAuth2Client |
| `zod` | (in package.json) | Tool input validation |
| `@anthropic-ai/claude-agent-sdk` | (in package.json) | `tool()` helper, `createSdkMcpServer` |

### 9.2 No New Dependencies Needed

The existing `googleapis` package provides complete Calendar API v3 coverage. No additional libraries (like `ical.js`) are needed unless iCal import/export is a future requirement.

### 9.3 Optional Future Dependencies

| Library | Purpose | When |
|---------|---------|------|
| `rrule` or `ical.js` | Advanced recurring event rule parsing | If natural language recurrence is needed |
| `luxon` or `date-fns-tz` | Advanced timezone arithmetic | If timezone conversion logic gets complex |

---

## 10. Estimated Complexity

### Phase 1: Core Connector (3-5 days)

| Task | Estimate |
|------|----------|
| Create `api.ts` wrapping existing service + new endpoints (getEvent, listCalendars, freebusy) | 0.5 day |
| Create `tools.ts` with 8 tools following weather pattern | 1 day |
| Create `index.ts` ConnectorDefinition | 0.25 day |
| Update connector registry to support auth-dependent connectors (db injection) | 0.5 day |
| Write tests (unit + timezone + auth error scenarios) | 1.5-2 days |
| Integration testing with real Google account | 0.5 day |

### Phase 2: Enhancements (2-3 days, future)

| Task | Estimate |
|------|----------|
| Recurring event instance modification | 1 day |
| Multi-calendar merge view | 0.5 day |
| Conflict detection / smart scheduling | 1 day |
| Push notification support (watch/channels) | 1 day |

### Complexity Rating: **Medium**

The core implementation is straightforward because:
- The API layer already exists (`services/google/calendar.ts`)
- Auth is fully handled (`services/google/auth.ts`)
- Error classification is comprehensive (`classifyGoogleError`)
- The connector pattern is well-established (weather reference)

The main new work is the tool definitions, the db injection pattern, and comprehensive testing.

---

## Sources

- [Google Calendar API Quota Management](https://developers.google.com/workspace/calendar/api/guides/quota)
- [Google Calendar API Error Handling](https://developers.google.com/workspace/calendar/api/guides/errors)
- [Google Calendar Recurring Events Guide](https://developers.google.com/workspace/calendar/api/guides/recurringevents)
- [Google Calendar Events & Calendars Concepts](https://developers.google.com/workspace/calendar/api/concepts/events-calendars)
- [Google Calendar API v3 Events Reference](https://developers.google.com/calendar/api/v3/reference/events)
- [Google Calendar Freebusy Query](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)
- [Google Calendar Push Notifications](https://developers.google.com/workspace/calendar/api/guides/push)
- [nspady/google-calendar-mcp](https://github.com/nspady/google-calendar-mcp) — Leading community MCP implementation (1,100+ stars, 13 tools)
- [deciduus/calendar-mcp](https://github.com/deciduus/calendar-mcp) — Python MCP implementation
- [Google Official MCP Announcement](https://cloud.google.com/blog/products/ai-machine-learning/announcing-official-mcp-support-for-google-services)
- [PulseMCP Google Calendar Servers](https://www.pulsemcp.com/servers?q=google-calendar) — Directory of 21 community implementations
- [Nylas: The Complex World of Calendar Events and RRULEs](https://www.nylas.com/blog/calendar-events-rrules/)
- [Google Calendar API Quota Changes (May 2021)](https://workspaceupdates.googleblog.com/2021/06/google-calendar-api-update.html)
