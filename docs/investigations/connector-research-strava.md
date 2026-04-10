# Connector Research: Strava (Health & Fitness)

**Date:** 2026-03-25
**Issue:** [#385](https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/385)
**Category:** Health & Fitness (lifestyle)
**Priority:** Medium
**Complexity:** Low

---

## 1. Overview

Strava is a social fitness platform with 120M+ athletes, focused on running, cycling, swimming, and 30+ other sport types. Its API v3 provides access to activities, athlete stats, segments, routes, GPS streams, clubs, and gear. For this app, a Strava connector enables an AI assistant to analyze training patterns, summarize recent activities, track goals, compare workouts, and provide coaching insights based on real performance data.

**Current state in the codebase:** Not yet implemented. Will follow the `ConnectorDefinition` pattern established by the weather connector (`apps/server/src/connectors/weather/`), with `index.ts`, `tools.ts`, `api.ts`, and colocated `strava.test.ts`.

### Existing MCP Implementations

Several open-source Strava MCP servers exist and inform our design:

| Project | Language | Tools | Notable Features |
|---------|----------|-------|-----------------|
| [eddmann/strava-mcp](https://github.com/eddmann/strava-mcp) | Python | 11 | Training analysis, activity comparison, similar-activity finder |
| [gcoombe/strava-mcp](https://github.com/gcoombe/strava-mcp) | TypeScript | 22 | Full API coverage, stdio + HTTP auth modes, SQLite token storage |
| [MariyaFilippova/mcp-strava](https://github.com/MariyaFilippova/mcp-strava) | TypeScript | ~10 | Month comparison, heart rate streams, lap splits, route suggestions |
| [r-huijts/strava-mcp](https://github.com/r-huijts/strava-mcp) | TypeScript | ~8 | npx quick-start, basic activity/athlete tools |
| [kw510/strava-mcp](https://github.com/kw510/strava-mcp) | TypeScript | ~6 | Cloudflare Workers deployment, OAuth on the edge |

**Recommendation:** Build our own in-process connector following the `ConnectorDefinition` pattern rather than wrapping an external MCP server. The Strava REST API is straightforward, and an in-process connector avoids process management overhead. We can reference `gcoombe/strava-mcp` (TypeScript, comprehensive) and `eddmann/strava-mcp` (best analysis tools) for design inspiration.

---

## 2. API Surface

### Base URL

`https://www.strava.com/api/v3`

All requests require `Authorization: Bearer <access_token>` header.

### Core Endpoints

| Category | Method | Endpoint | Description |
|----------|--------|----------|-------------|
| **Activities** | GET | `/athlete/activities` | List authenticated athlete's activities (paginated) |
| | GET | `/activities/{id}` | Get activity detail |
| | POST | `/activities` | Create manual activity |
| | PUT | `/activities/{id}` | Update activity |
| | GET | `/activities/{id}/comments` | List comments |
| | GET | `/activities/{id}/kudos` | List kudos |
| | GET | `/activities/{id}/laps` | List lap splits |
| | GET | `/activities/{id}/zones` | Heart rate / power zones (Summit) |
| **Streams** | GET | `/activities/{id}/streams` | Raw data streams (GPS, HR, power, cadence, altitude, etc.) |
| | GET | `/segments/{id}/streams` | Segment streams (distance, altitude, latlng) |
| | GET | `/segment_efforts/{id}/streams` | Effort streams |
| | GET | `/routes/{id}/streams` | Route streams |
| **Athlete** | GET | `/athlete` | Authenticated athlete profile |
| | GET | `/athletes/{id}/stats` | Athlete statistics (totals by sport) |
| | GET | `/athlete/zones` | Heart rate and power zones |
| **Segments** | GET | `/segments/{id}` | Segment detail |
| | GET | `/segments/explore` | Explore segments by geographic bounds |
| | GET | `/segments/{id}/efforts` | List segment efforts |
| | GET | `/athlete/segments/starred` | Starred segments |
| | PUT | `/segments/{id}/starred` | Star/unstar segment |
| **Routes** | GET | `/athletes/{id}/routes` | List athlete's routes |
| | GET | `/routes/{id}` | Route detail |
| | GET | `/routes/{id}/gpx` | Export as GPX |
| | GET | `/routes/{id}/tcx` | Export as TCX |
| **Clubs** | GET | `/athlete/clubs` | List athlete's clubs |
| | GET | `/clubs/{id}` | Club detail |
| | GET | `/clubs/{id}/members` | Club members |
| | GET | `/clubs/{id}/activities` | Club activities |
| **Gear** | GET | `/gear/{id}` | Gear detail (shoes, bikes) |
| **Uploads** | POST | `/uploads` | Upload activity file (FIT, TCX, GPX) |
| | GET | `/uploads/{id}` | Upload status |

### Stream Types

Streams are parallel arrays of raw activity data. Available types:

| Stream Key | Description | Unit |
|-----------|-------------|------|
| `time` | Elapsed time | seconds |
| `distance` | Cumulative distance | meters |
| `latlng` | GPS coordinates | [lat, lng] pairs |
| `altitude` | Elevation | meters |
| `heartrate` | Heart rate | bpm |
| `cadence` | Cadence | rpm (cycling) or spm (running) |
| `watts` | Power | watts |
| `temp` | Temperature | Celsius |
| `moving` | Moving/stopped | boolean |
| `grade_smooth` | Smoothed grade | percent |
| `velocity_smooth` | Smoothed speed | m/s |

Request specific keys via `?keys=heartrate,latlng,altitude&key_type=time`.

### Activity Sport Types

The `sport_type` field (preferred over deprecated `type`) includes 60+ values. Key categories:

- **Run:** Run, TrailRun, VirtualRun
- **Ride:** Ride, MountainBikeRide, GravelRide, VirtualRide, EBikeRide, EMountainBikeRide, Velomobile, HandCycle
- **Swim:** Swim
- **Winter:** AlpineSki, BackcountrySki, NordicSki, Snowboard, Snowshoe, IceSkate
- **Water:** Canoeing, Kayaking, Rowing, StandUpPaddling, Surfing, Kitesurf, Windsurf, Sail
- **Other:** Walk, Hike, RockClimbing, WeightTraining, Yoga, Pilates, CrossFit, Elliptical, StairStepper, Wheelchair, Golf, Pickleball, Badminton, Tennis, TableTennis, Squash, Soccer, HIIT

### Pagination

- Default: 30 items per page
- Max: 200 items per page (`per_page=200`)
- Use `page` parameter (1-indexed) for offset pagination
- **Best practice:** Iterate until an empty page is returned (item count may be less than `per_page` on non-final pages)
- For activities, also supports `before` and `after` epoch timestamps for time-range filtering

---

## 3. Auth Flow

### OAuth 2.0 Authorization Code Flow

Strava uses standard OAuth 2.0, well-suited for desktop apps with a local callback server.

#### Step 1: Redirect to Strava Authorization

```
GET https://www.strava.com/oauth/authorize
  ?client_id={CLIENT_ID}
  &redirect_uri={REDIRECT_URI}
  &response_type=code
  &scope=read,activity:read_all
  &approval_prompt=auto
```

#### Step 2: User Authorizes, Strava Redirects with Code

Strava redirects to `redirect_uri?code={CODE}&scope={GRANTED_SCOPES}`.

For a Tauri desktop app, options:
1. **Local HTTP callback server** (recommended): Start a temporary HTTP server on `localhost:{random_port}`, set `redirect_uri=http://localhost:{port}/callback`, capture the code, shut down the server.
2. **Deep link / custom protocol**: Register `claude-tauri://strava/callback` as redirect URI.

#### Step 3: Exchange Code for Tokens

```
POST https://www.strava.com/oauth/token
  client_id={CLIENT_ID}
  client_secret={CLIENT_SECRET}
  code={CODE}
  grant_type=authorization_code
```

Response includes:
- `access_token` (short-lived, ~6 hours)
- `refresh_token` (long-lived, may rotate)
- `expires_at` (Unix timestamp)
- `athlete` (profile object)

#### Step 4: Refresh Token Flow

```
POST https://www.strava.com/oauth/token
  client_id={CLIENT_ID}
  client_secret={CLIENT_SECRET}
  refresh_token={REFRESH_TOKEN}
  grant_type=refresh_token
```

**Critical:** The response may return a NEW refresh token. Always persist the latest `refresh_token` from every token response. The old refresh token becomes invalid if a new one is issued.

#### Scopes

| Scope | Access |
|-------|--------|
| `read` | Public profile, public activities, public segments |
| `read_all` | Private activities, private segments, all athlete data |
| `profile:read_all` | All profile info |
| `profile:write` | Update profile |
| `activity:read` | Read activities (public) |
| `activity:read_all` | Read all activities (including private) |
| `activity:write` | Create/update/delete activities |

**Recommended scopes for this connector:** `read,activity:read_all,profile:read_all` -- full read access without write permissions.

#### Token Storage

Store in the app's SQLite database (encrypted, same pattern as Plaid):
- `access_token` (encrypted)
- `refresh_token` (encrypted)
- `expires_at` (Unix timestamp)
- `athlete_id` (for multi-user support)
- `scopes` (granted scopes string)

#### Environment Variables

```
STRAVA_CLIENT_ID=<from strava.com/settings/api>
STRAVA_CLIENT_SECRET=<from strava.com/settings/api>
```

---

## 4. Rate Limits

### Default Limits

| Window | Limit | Notes |
|--------|-------|-------|
| 15-minute | 200 requests | Resets on 0, 15, 30, 45 minute marks |
| Daily | 2,000 requests | Resets at midnight UTC |

### Response Headers

```
X-RateLimit-Limit: 200,2000
X-RateLimit-Usage: 45,1100
```

Format: `{15min_limit},{daily_limit}` and `{15min_usage},{daily_usage}`.

### Rate Limit Strategy

1. **Parse headers** on every response and track usage in memory.
2. **Proactive throttling:** If usage exceeds 80% of 15-min limit (160 requests), delay subsequent requests.
3. **Backoff on 429:** Exponential backoff starting at 60 seconds. The 15-minute window resets at the next quarter-hour.
4. **Caching:** Cache athlete profile, zones, and gear data aggressively (TTL 1 hour). Cache activity lists for 5 minutes. Stream data is immutable once fetched -- cache indefinitely.
5. **Batch awareness:** A single "get recent activities" request is 1 API call. Enriching each with streams costs 1 call per activity. Design tools to be explicit about when enrichment happens.

### Budget Per Interaction

Typical AI conversation budget:
- List recent activities: 1 call
- Get activity detail + streams: 2 calls
- Get athlete stats: 1 call
- Weekly summary (7 activities + streams): ~15 calls
- Safe budget per conversation turn: 10-20 calls

---

## 5. Webhook Subscriptions

### Overview

Strava supports push webhooks for real-time event notifications. Each application gets exactly **one** subscription that covers all authorized athletes.

### Subscription Setup

```
POST https://www.strava.com/api/v3/push_subscriptions
  client_id={CLIENT_ID}
  client_secret={CLIENT_SECRET}
  callback_url=https://your-server.com/webhook/strava
  verify_token={YOUR_VERIFY_TOKEN}
```

Strava validates the callback with a GET request:
```
GET {callback_url}?hub.mode=subscribe&hub.challenge={CHALLENGE}&hub.verify_token={TOKEN}
```

Must respond with `200 OK` and body: `{"hub.challenge": "{CHALLENGE}"}`.

### Event Payload

```json
{
  "object_type": "activity",     // "activity" or "athlete"
  "object_id": 12345678,
  "aspect_type": "create",       // "create", "update", or "delete"
  "updates": {},                  // Changed fields on update (e.g., {"title": "Morning Run"})
  "owner_id": 987654,            // Athlete ID
  "subscription_id": 12345,
  "event_time": 1711900000
}
```

### Event Types

| object_type | aspect_type | Trigger |
|-------------|-------------|---------|
| activity | create | New activity uploaded/synced |
| activity | update | Title, type, or privacy changed |
| activity | delete | Activity deleted |
| athlete | update | Athlete deauthorizes the app |

### Constraints

- Must respond with `200 OK` within **2 seconds** (process async)
- Retried up to **3 times** if no 200 response
- Only **one subscription per application**
- Webhook payload is minimal -- must call API to get full activity data

### Desktop App Considerations

Webhooks require a publicly accessible URL, which is impractical for a desktop app. **Strategy:**
1. **Primary approach:** Poll on app startup and periodically (every 15 minutes). Use `after` timestamp parameter to only fetch new activities since last check.
2. **Future enhancement:** If/when we add a cloud relay, register a webhook there and push notifications to desktop clients via WebSocket.

---

## 6. Proposed Tool Design

### Tool Naming Convention

Follow `strava_` prefix with `verb_noun` pattern, matching the weather connector's style.

### Phase 1: Core Tools (MVP)

| Tool | Description | API Calls | Scope |
|------|-------------|-----------|-------|
| `strava_get_activities` | List recent activities with filters (type, date range, count) | 1 | activity:read_all |
| `strava_get_activity` | Get detailed activity by ID, optionally with streams | 1-2 | activity:read_all |
| `strava_get_athlete` | Get athlete profile with stats | 1-2 | profile:read_all |
| `strava_get_athlete_stats` | Get all-time and YTD stats by sport type | 1 | profile:read_all |

### Phase 2: Analysis Tools

| Tool | Description | API Calls | Scope |
|------|-------------|-----------|-------|
| `strava_analyze_training` | Weekly/monthly aggregates: distance, time, elevation, avg pace | 1-5 | activity:read_all |
| `strava_compare_activities` | Side-by-side comparison of 2-5 activities | 2-10 | activity:read_all |
| `strava_get_activity_streams` | Get raw GPS/HR/power/cadence data for an activity | 1 | activity:read_all |

### Phase 3: Extended Tools

| Tool | Description | API Calls | Scope |
|------|-------------|-----------|-------|
| `strava_get_segments` | Get starred segments or explore by location | 1 | read |
| `strava_get_routes` | List athlete's routes | 1 | read |
| `strava_get_clubs` | List athlete's clubs and recent club activities | 1-2 | read |
| `strava_get_gear` | Get gear details (shoes, bikes, total distance) | 1 | read |

### Tool Implementation Example

```typescript
// tools.ts
const getActivitiesTool = tool(
  'strava_get_activities',
  'List recent Strava activities for the authenticated athlete. Supports filtering by sport type and date range.',
  {
    sport_type: z.string().optional().describe('Filter by sport type (e.g. "Run", "Ride", "Swim")'),
    after: z.string().optional().describe('Only activities after this date (ISO 8601)'),
    before: z.string().optional().describe('Only activities before this date (ISO 8601)'),
    count: z.number().min(1).max(50).optional().describe('Number of activities to return (default 10, max 50)'),
  },
  async (args) => {
    const activities = await getActivities({
      sport_type: args.sport_type,
      after: args.after ? Math.floor(new Date(args.after).getTime() / 1000) : undefined,
      before: args.before ? Math.floor(new Date(args.before).getTime() / 1000) : undefined,
      per_page: args.count ?? 10,
    });
    // Format as human-readable text for LLM consumption
    const text = formatActivitiesSummary(activities);
    return { content: [{ type: 'text' as const, text }] };
  },
  { annotations: { title: 'Strava Activities', readOnlyHint: true, openWorldHint: true } }
);
```

### ConnectorDefinition

```typescript
// index.ts
export const stravaConnector: ConnectorDefinition = {
  name: 'strava',
  displayName: 'Strava',
  description: 'Access your Strava activities, training stats, segments, routes, and GPS data for fitness analysis and coaching insights.',
  icon: '🏃',
  category: 'lifestyle',
  requiresAuth: true,
  tools: stravaTools,
};
```

---

## 7. Data Insights & Derived Metrics

The AI assistant can compute these from raw API data without needing Strava's premium metrics:

### Training Load (DIY)

Strava does not expose its Fitness & Freshness data via API. However, we can compute approximations:

1. **Relative Effort (HR-based):** Use stream `heartrate` data with athlete's HR zones to calculate TRIMP (Training Impulse):
   ```
   TRIMP = duration_minutes * avg_HR_fraction * 0.64 * e^(1.92 * avg_HR_fraction)
   ```
   where `avg_HR_fraction = (avg_HR - resting_HR) / (max_HR - resting_HR)`

2. **Training Stress Score (power-based):** For cycling with power meters:
   ```
   TSS = (duration_seconds * NP * IF) / (FTP * 3600) * 100
   ```

3. **Fitness/Fatigue (Banister model):**
   ```
   CTL_today = CTL_yesterday + (load_today - CTL_yesterday) / 42
   ATL_today = ATL_yesterday + (load_today - ATL_yesterday) / 7
   Form = CTL - ATL
   ```

### Weekly/Monthly Summaries

From `GET /athlete/activities`:
- Total distance, time, elevation gain per sport
- Average pace/speed trends
- Activity frequency (sessions/week)
- Longest activity, fastest pace
- Rest day identification

### Goal Tracking

- Weekly distance targets (e.g., "run 30 miles this week")
- Monthly volume trends vs. previous months
- Race preparation milestones (long run progression, weekly mileage ramp)
- Year-to-date totals vs. annual goals

### Segment Analysis

- Personal records vs. historical efforts
- Performance trends on frequently-ridden/run segments
- Leaderboard position changes

---

## 8. Testing Strategy

### Unit Test Approach

Follow the weather connector pattern: mock `fetch` globally, use a URL-based router to return fixture data.

```typescript
// strava.test.ts
function createStravaRouter(overrides: {
  activities?: any;
  activity?: any;
  athlete?: any;
  stats?: any;
  streams?: any;
  activitiesStatus?: number;
} = {}) {
  return (url: string, init?: RequestInit) => {
    const headers = { 'X-RateLimit-Limit': '200,2000', 'X-RateLimit-Usage': '10,100' };

    if (url.includes('/athlete/activities')) {
      return new Response(
        JSON.stringify(overrides.activities ?? makeSampleActivities()),
        { status: overrides.activitiesStatus ?? 200, headers }
      );
    }
    if (url.match(/\/activities\/\d+\/streams/)) {
      return new Response(
        JSON.stringify(overrides.streams ?? makeSampleStreams()),
        { status: 200, headers }
      );
    }
    if (url.match(/\/activities\/\d+$/)) {
      return new Response(
        JSON.stringify(overrides.activity ?? makeSampleActivity()),
        { status: 200, headers }
      );
    }
    if (url.match(/\/athletes\/\d+\/stats/)) {
      return new Response(
        JSON.stringify(overrides.stats ?? makeSampleStats()),
        { status: 200, headers }
      );
    }
    if (url.includes('/athlete')) {
      return new Response(
        JSON.stringify(overrides.athlete ?? makeSampleAthlete()),
        { status: 200, headers }
      );
    }
    return new Response('Not Found', { status: 404 });
  };
}
```

### Test Data Factories

```typescript
function makeSampleActivity(overrides = {}) {
  return {
    id: 12345678901,
    name: 'Morning Run',
    sport_type: 'Run',
    distance: 8046.72, // 5 miles in meters
    moving_time: 2400,  // 40 minutes
    elapsed_time: 2520,
    total_elevation_gain: 45.2,
    start_date: '2026-03-20T07:30:00Z',
    start_date_local: '2026-03-20T07:30:00-07:00',
    average_speed: 3.35,  // m/s (~8:00/mi)
    max_speed: 4.47,
    average_heartrate: 155,
    max_heartrate: 178,
    average_cadence: 87,
    has_heartrate: true,
    suffer_score: 67,
    map: { summary_polyline: 'encodedPolylineString...' },
    gear_id: 'g12345',
    ...overrides,
  };
}

function makeSampleStreams() {
  return [
    { type: 'time', data: [0, 1, 2, 3, 4], series_type: 'time', resolution: 'high' },
    { type: 'heartrate', data: [120, 135, 150, 155, 160], series_type: 'time', resolution: 'high' },
    { type: 'distance', data: [0, 3.2, 6.5, 10.1, 13.8], series_type: 'distance', resolution: 'high' },
    { type: 'altitude', data: [50, 52, 55, 53, 50], series_type: 'distance', resolution: 'high' },
    { type: 'latlng', data: [[37.77, -122.42], [37.771, -122.421], [37.772, -122.42], [37.773, -122.419], [37.774, -122.418]], series_type: 'distance', resolution: 'high' },
  ];
}
```

### Key Test Cases

1. **Auth:** Token refresh on 401, rotating refresh token persistence
2. **Rate limiting:** 429 response triggers backoff, header parsing works correctly
3. **Pagination:** Multi-page activity fetching, empty final page detection
4. **Data formatting:** Activity summary text, pace/speed unit conversion (m/s to min/mi or min/km)
5. **Error handling:** Network errors, invalid activity IDs, expired tokens, scope errors
6. **Streams:** Handling missing stream types, large payloads
7. **BigInt safety:** Activity IDs can exceed `Number.MAX_SAFE_INTEGER`

---

## 9. Library Decision

### Option A: Direct REST Client (Recommended)

Use native `fetch` (available in Bun) with a thin wrapper, matching the weather connector pattern.

**Pros:**
- Zero dependencies
- Full control over caching, rate limiting, error handling
- Matches existing codebase patterns
- Bun's native fetch is fast and reliable
- Easier to test (mock fetch)

**Cons:**
- Must handle BigInt activity IDs manually (use `json-bigint` or string IDs)
- Must implement token refresh logic

### Option B: strava-v3 npm Package

The `strava-v3` npm package is a wrapper around the API.

**Pros:**
- Built-in rate limit tracking (`strava.rateLimiting`)
- Handles BigInt with `json-bigint`
- Promise-based API

**Cons:**
- Last updated 2023, may lag behind API changes
- Callback-style API design (Promises added via wrapper)
- Additional dependency, harder to mock in tests
- Config is global (problematic for multi-user)

### Recommendation

**Use direct REST client.** The Strava API is simple REST with JSON responses. Our existing pattern (weather connector) uses direct `fetch`, and maintaining consistency is more valuable than saving a few lines of boilerplate. Implement a `StravaClient` class that handles auth headers, token refresh, rate limit tracking, and BigInt-safe JSON parsing.

---

## 10. Implementation Plan

### File Structure

```
apps/server/src/connectors/strava/
  index.ts          # ConnectorDefinition export
  api.ts            # StravaClient class, API methods, token management
  tools.ts          # MCP tool definitions using sdk tool()
  types.ts          # Strava-specific TypeScript interfaces
  strava.test.ts    # Unit tests with mocked fetch
```

### Phase 1: Foundation (MVP)

1. **api.ts:** `StravaClient` with token refresh, rate limit tracking, base request method
2. **types.ts:** Interfaces for Activity, Athlete, AthleteStats, Stream, Segment
3. **tools.ts:** `strava_get_activities`, `strava_get_activity`, `strava_get_athlete`, `strava_get_athlete_stats`
4. **index.ts:** `stravaConnector` definition
5. **Auth routes:** Add OAuth flow endpoints to Hono server (authorize redirect, callback handler, token storage)
6. **Tests:** Full test coverage for api.ts methods and tool handlers

### Phase 2: Analysis & Streams

1. Add `strava_get_activity_streams`, `strava_analyze_training`, `strava_compare_activities`
2. Implement training load calculation helpers (TRIMP, weekly summaries)
3. Add pace/speed conversion utilities (m/s to min/mi, min/km, mph, km/h)

### Phase 3: Extended Features

1. Add segment, route, club, and gear tools
2. Add polling-based sync for new activities on app startup
3. Add activity data caching in SQLite (stream data is immutable)

### Estimated Effort

| Phase | Effort | Description |
|-------|--------|-------------|
| Phase 1 | ~4 hours | Core tools + auth + tests |
| Phase 2 | ~3 hours | Analysis tools + derived metrics |
| Phase 3 | ~2 hours | Extended tools + caching |
| **Total** | **~9 hours** | Full connector |

### Dependencies

- `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` environment variables
- OAuth callback route in Hono server
- Token storage in SQLite (encrypted, same pattern as Plaid)
- No external npm packages needed beyond what's already in the project

---

## Sources

- [Strava API v3 Reference](https://developers.strava.com/docs/reference/)
- [Strava API Documentation](https://developers.strava.com/docs/)
- [Strava Authentication](https://developers.strava.com/docs/authentication/)
- [Strava Rate Limits](https://developers.strava.com/docs/rate-limits/)
- [Strava Webhook Events API](https://developers.strava.com/docs/webhooks/)
- [Strava Supported Sport Types](https://support.strava.com/hc/en-us/articles/216919407-Supported-Sport-Types-on-Strava)
- [Strava Fitness & Freshness](https://support.strava.com/hc/en-us/articles/216918477-Fitness-Freshness)
- [strava-v3 npm package](https://www.npmjs.com/package/strava-v3)
- [node-strava-v3 GitHub](https://github.com/node-strava/node-strava-v3)
- [eddmann/strava-mcp](https://github.com/eddmann/strava-mcp)
- [gcoombe/strava-mcp](https://github.com/gcoombe/strava-mcp)
- [MariyaFilippova/mcp-strava](https://github.com/MariyaFilippova/mcp-strava)
- [r-huijts/strava-mcp](https://github.com/r-huijts/strava-mcp)
- [kw510/strava-mcp](https://github.com/kw510/strava-mcp)
