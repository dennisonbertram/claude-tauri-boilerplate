# Connector Research: TripIt / Flight Tracking

Created: 2026-03-25
Issue: [#388](https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/388)

---

## 1. Executive Summary

A TripIt + Flight Tracking connector would give the Claude desktop app access to the user's travel itineraries, real-time flight status, and trip timeline data. The recommended architecture is a two-layer approach: TripIt as the primary data source for trip/itinerary management (OAuth 1.0a), augmented by a lightweight flight status API (AeroDataBox or AviationStack) for real-time tracking. An alternative email-parsing path via the existing Gmail connector can bootstrap trip data without requiring a TripIt account. Complexity is **Medium** due to OAuth 1.0a requirements and timezone handling; estimated effort is 3-5 days.

---

## 2. API Landscape

### TripIt API v1

| Aspect | Detail |
|--------|--------|
| Base URL | `https://api.tripit.com/v1/` |
| Auth | OAuth 1.0a (consumer key + secret, 3-legged flow) |
| Format | XML (default) or JSON (`?format=json`) |
| Rate limits | Undocumented; anecdotally ~1000 req/hour |
| Pricing | Free (register app at tripit.com/developer) |
| Node.js libs | [`tripit-node`](https://github.com/mbmccormick/tripit-node), [`passport-tripit`](https://github.com/jaredhanson/passport-tripit) |

**Key object types:**

| Object | Description |
|--------|-------------|
| `TripObject` | Top-level container: display_name, start_date, end_date, primary_location |
| `AirObject` | Flight segments: airline, flight_number, departure/arrival airport, times |
| `LodgingObject` | Hotel/accommodation: name, address, check-in/out dates |
| `CarObject` | Car rental: pickup/dropoff locations, times |
| `RailObject` | Train segments |
| `TransportObject` | Generic ground transport |
| `ActivityObject` | Tours, events |
| `RestaurantObject` | Dining reservations |

**Key endpoints:**

```
GET /v1/list/trip                          # All trips
GET /v1/list/trip/past/true                # Past trips
GET /v1/list/trip/traveler/true            # Trips where user is traveler
GET /v1/get/trip/id/{trip_id}              # Single trip with all objects
GET /v1/list/object/trip_id/{trip_id}      # All objects within a trip
GET /v1/list/object/type/air              # All air objects across trips
```

### Flight Status APIs (Real-Time Tracking)

| API | Free Tier | Paid From | Key Feature | Best For |
|-----|-----------|-----------|-------------|----------|
| **AeroDataBox** | 150 calls/mo (RapidAPI) | $0.99/mo (600 calls) | Cheapest option | Budget-friendly MVP |
| **AviationStack** | 100 calls/mo | $49.99/mo (10K calls) | 30-60s delay | Mid-tier reliability |
| **FlightAware AeroAPI** | 500 calls/mo (personal) | $100/mo (10K calls) | Most comprehensive | Production-grade |
| **Flightradar24 API** | Credit-based | $9/mo (30K credits) | Best live tracking | Real-time focus |

**Recommendation:** Start with **AeroDataBox** via RapidAPI for MVP (cheapest, sufficient for personal use), upgrade to FlightAware AeroAPI for production if needed.

### Email Parsing (Alternative Data Source)

| Approach | Description |
|----------|-------------|
| **Google schema.org markup** | Airlines embed `FlightReservation` / `LodgingReservation` structured data in confirmation emails. Gmail API can search for these. |
| **AwardWallet Email Parsing API** | Commercial service that extracts flight, hotel, car rental data from forwarded confirmation emails. Returns structured JSON. |
| **LLM-based parsing** | Use Claude itself to parse travel confirmation email bodies — flexible but less reliable for structured extraction. |
| **Open-source** | [`flight-reservation-emails`](https://github.com/JohannesBuchner/flight-reservation-emails) — Python parser for schema.org flight reservations in Gmail. |

**Recommendation:** Leverage the existing Gmail connector to search for travel confirmations with schema.org markup as a "no extra account needed" fallback.

---

## 3. Authentication Architecture

### TripIt OAuth 1.0a Flow

```
1. App registers at tripit.com/developer -> consumer_key + consumer_secret
2. GET /oauth/request_token -> request_token + request_token_secret
3. Redirect user to: https://www.tripit.com/oauth/authorize?oauth_token={request_token}
4. User authorizes -> callback with oauth_token + oauth_verifier
5. POST /oauth/access_token -> access_token + access_token_secret
6. Store encrypted tokens per-user in SQLite
```

**Implementation notes:**
- OAuth 1.0a requires signing every request with HMAC-SHA1 (use `oauth-1.0a` npm package)
- TripIt also supports simpler 2-legged OAuth (consumer key/secret only) but with limited access
- Tokens do not expire (persist until user revokes)
- Store `access_token` and `access_token_secret` encrypted in `~/.claude-tauri/data.db`

### Flight API Auth

- AeroDataBox / AviationStack: Simple API key in header (`x-rapidapi-key` or `access_key` query param)
- FlightAware AeroAPI: API key in `x-apikey` header
- No OAuth needed for flight status APIs

---

## 4. Connector Design

### File Structure

```
apps/server/src/connectors/travel/
  index.ts          # ConnectorDefinition
  tools.ts          # Tool definitions (6 tools)
  tripit-api.ts     # TripIt API client with OAuth 1.0a
  flight-api.ts     # Flight status API client (AeroDataBox)
  types.ts          # Trip, Flight, Hotel, etc. interfaces
  timeline.ts       # Trip timeline construction + timezone handling
  travel.test.ts    # Tests
```

### ConnectorDefinition

```typescript
export const travelConnector: ConnectorDefinition = {
  name: 'travel',
  displayName: 'Travel & Flights',
  description: 'Access TripIt itineraries, track flights in real-time, and view trip timelines with hotel, transport, and activity details.',
  icon: '✈️',
  category: 'lifestyle',
  requiresAuth: true,
  tools: travelTools,
};
```

### Proposed Tools (6)

| Tool Name | Description | Data Source |
|-----------|-------------|-------------|
| `travel_list_trips` | List upcoming and past trips | TripIt API |
| `travel_get_trip` | Get full trip details (flights, hotels, activities) | TripIt API |
| `travel_flight_status` | Real-time flight status by flight number + date | Flight Status API |
| `travel_search_flights` | Search for flights between airports on a date | Flight Status API |
| `travel_trip_timeline` | Construct chronological timeline of a trip | TripIt + timezone logic |
| `travel_import_from_email` | Parse travel confirmation email into trip data | Gmail connector + LLM |

### Tool Schemas (Key Examples)

```typescript
// travel_list_trips
{
  filter: z.enum(['upcoming', 'past', 'all']).optional().default('upcoming'),
  limit: z.number().min(1).max(50).optional().default(10),
}

// travel_flight_status
{
  flight_number: z.string().describe('IATA flight number, e.g. "UA1234"'),
  date: z.string().describe('Flight date in YYYY-MM-DD format'),
}

// travel_get_trip
{
  trip_id: z.string().describe('TripIt trip ID'),
  include: z.array(z.enum(['flights', 'hotels', 'cars', 'activities', 'all']))
    .optional().default(['all']),
}
```

---

## 5. Data Model & Types

```typescript
interface Trip {
  id: string;
  displayName: string;
  startDate: string;          // YYYY-MM-DD
  endDate: string;            // YYYY-MM-DD
  primaryLocation: string;
  imageUrl?: string;
  segments: TripSegment[];
}

interface FlightSegment {
  type: 'flight';
  airline: string;
  flightNumber: string;
  departureAirport: string;   // IATA code
  arrivalAirport: string;     // IATA code
  departureTime: string;      // ISO 8601 with timezone offset
  arrivalTime: string;        // ISO 8601 with timezone offset
  departureTimezone: string;  // IANA timezone (e.g. "America/New_York")
  arrivalTimezone: string;
  terminal?: string;
  gate?: string;
  seatAssignment?: string;
  status?: FlightStatus;
}

interface HotelSegment {
  type: 'hotel';
  name: string;
  address: string;
  checkIn: string;            // ISO 8601
  checkOut: string;
  confirmationNumber?: string;
  timezone: string;
}

type TripSegment = FlightSegment | HotelSegment | CarSegment | ActivitySegment;

interface FlightStatus {
  status: 'scheduled' | 'active' | 'landed' | 'cancelled' | 'diverted' | 'delayed';
  departureDelay?: number;    // minutes
  arrivalDelay?: number;
  actualDeparture?: string;
  actualArrival?: string;
  gate?: string;
  terminal?: string;
  baggageClaim?: string;
}
```

---

## 6. Timezone Handling Best Practices

Flight itinerary timezone handling is the single hardest aspect of this connector. Key principles:

### Rules

1. **Store all times in ISO 8601 with explicit timezone offset** (e.g., `2026-04-15T14:30:00-04:00`)
2. **Also store IANA timezone identifiers** (e.g., `America/New_York`) — offsets alone are ambiguous due to DST
3. **Departure times are always local to departure airport; arrival times are always local to arrival airport** — this matches airline industry convention
4. **Never convert to UTC for display** — users expect local times
5. **Duration calculation must use UTC** — subtract UTC representations, not local times
6. **Use `Temporal` API or `date-fns-tz`** for timezone-aware arithmetic (avoid `moment-timezone` — deprecated)

### Airport-to-Timezone Mapping

Maintain a mapping of IATA airport codes to IANA timezones. Options:
- Embed a static lookup table (~4000 entries, ~80KB)
- Use the `airports` npm package and cross-reference with timezone databases
- Query the flight status API (AeroDataBox returns timezone info per airport)

### Timeline Construction Algorithm

```
1. Fetch all segments for a trip
2. For each segment, normalize times to { localTime, utcTime, timezone }
3. Sort all events by utcTime
4. Generate chronological timeline with:
   - Time-until-next-event (calculated in UTC)
   - Local time display for each location
   - Timezone change indicators (e.g., "You'll gain 3 hours")
5. Flag potential issues: tight connections (<90min international, <45min domestic),
   overnight layovers, timezone confusion risks
```

---

## 7. Real-Time Flight Status Integration

### Polling Strategy

Flight status changes infrequently, so aggressive polling wastes API quota:

| Window | Poll Interval | Rationale |
|--------|---------------|-----------|
| >24h before departure | Once/day | Status rarely changes |
| 6-24h before | Every 2 hours | Gate assignments appear |
| 1-6h before | Every 30 min | Delays emerge |
| <1h before / in-flight | Every 5 min | Active tracking |
| Post-landing | Once at ETA+30min | Final status |

### Caching

- Cache flight status in SQLite with TTL based on the polling windows above
- Cache airport/airline metadata aggressively (changes rarely)
- Cache TripIt trip data with 15-min TTL (user edits are infrequent)

---

## 8. Existing MCP Implementations

### TripIt MCP Server (viasocket.com)

A community MCP server exists using FastMCP v2:
- Supports both 2-legged and 3-legged OAuth
- Exposes trip listing and detail retrieval
- Python/asyncio implementation
- Can serve as reference but not directly usable (wrong runtime, different patterns)

### Travel MCP Server (gs-ysingh)

A multi-source travel MCP server:
- Combines flight search, accommodation, weather, and budget tools
- Demonstrates the multi-API orchestration pattern we'd use
- Good reference for tool design

### VariFlight TripmatchMCP

- China-focused flight data MCP server
- Demonstrates real-time flight status as MCP tools

**Key takeaway:** No existing implementation matches our ConnectorDefinition pattern or uses the Claude Agent SDK's `tool()` helper. We need a from-scratch implementation following the weather connector pattern.

---

## 9. Testing Strategy

### Mock Data

```typescript
// Fixture: Multi-segment international trip
const mockTokyoTrip: Trip = {
  id: 'trip-123',
  displayName: 'Tokyo Business Trip',
  startDate: '2026-04-10',
  endDate: '2026-04-17',
  primaryLocation: 'Tokyo, Japan',
  segments: [
    {
      type: 'flight',
      airline: 'United Airlines',
      flightNumber: 'UA837',
      departureAirport: 'SFO',
      arrivalAirport: 'NRT',
      departureTime: '2026-04-10T11:30:00-07:00',
      arrivalTime: '2026-04-11T15:05:00+09:00',
      departureTimezone: 'America/Los_Angeles',
      arrivalTimezone: 'Asia/Tokyo',
    },
    // ... hotel, return flight
  ],
};
```

### Test Cases

| Category | Test | Priority |
|----------|------|----------|
| **Timezone** | Duration calc across dateline (SFO->NRT) | Critical |
| **Timezone** | DST transition mid-trip (US spring forward) | Critical |
| **Timezone** | Same-timezone domestic flight | High |
| **Timeline** | Correct chronological ordering | Critical |
| **Timeline** | Tight connection warning (<90min intl) | High |
| **Timeline** | Overnight layover detection | Medium |
| **OAuth** | Token exchange flow mock | High |
| **OAuth** | Expired/revoked token handling | High |
| **Flight status** | Delayed flight response parsing | High |
| **Flight status** | Cancelled flight handling | High |
| **Flight status** | API rate limit / error handling | Medium |
| **Email parse** | schema.org FlightReservation extraction | Medium |
| **Email parse** | Fallback to LLM parsing | Low |
| **Cache** | TTL-based cache invalidation | Medium |
| **Cache** | Stale-while-revalidate for flight status | Medium |

### Test File Structure

```
apps/server/src/connectors/travel/
  __tests__/
    tripit-api.test.ts      # OAuth flow + API response parsing
    flight-api.test.ts       # Flight status API mocking
    timeline.test.ts         # Timezone + ordering tests (most critical)
    tools.test.ts            # Tool integration tests
```

---

## 10. Implementation Recommendations

### Priority Order

1. **Phase 1 (MVP):** `travel_list_trips` + `travel_get_trip` via TripIt API with OAuth 1.0a
2. **Phase 2:** `travel_flight_status` via AeroDataBox (cheapest real-time option)
3. **Phase 3:** `travel_trip_timeline` with timezone-aware chronological ordering
4. **Phase 4:** `travel_import_from_email` leveraging existing Gmail connector
5. **Phase 5:** `travel_search_flights` for discovery

### Key Dependencies

```json
{
  "oauth-1.0a": "^2.2.6",       // OAuth 1.0a request signing
  "date-fns": "^3.x",            // Already in project likely
  "date-fns-tz": "^3.x",         // Timezone-aware date operations
}
```

**Note:** Avoid adding `axios` — use native `fetch` (available in Bun runtime).

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| TripIt API deprecation (SAP Concur ownership) | High | Email parsing fallback; design types to be source-agnostic |
| OAuth 1.0a complexity vs OAuth 2.0 | Medium | Use `oauth-1.0a` npm package; well-tested pattern |
| Flight API costs at scale | Medium | Start with AeroDataBox free tier; smart polling windows |
| Timezone bugs | High | Exhaustive test fixtures; IANA timezone database |
| TripIt rate limits (undocumented) | Medium | Aggressive caching; 15-min TTL for trip data |

### Estimated Effort

| Phase | Effort | Dependencies |
|-------|--------|-------------|
| Phase 1 (TripIt core) | 2 days | OAuth 1.0a setup, API client |
| Phase 2 (Flight status) | 1 day | AeroDataBox API key |
| Phase 3 (Timeline) | 1 day | Timezone test fixtures |
| Phase 4 (Email import) | 1 day | Gmail connector must exist |
| Phase 5 (Search) | 0.5 day | Flight API already integrated |
| **Total** | **~5.5 days** | |

---

## Sources

- [TripIt API v1 Documentation](https://tripit.github.io/api/doc/v1/)
- [TripIt API GitHub](https://github.com/tripit/api)
- [tripit-node (Node.js client)](https://github.com/mbmccormick/tripit-node)
- [passport-tripit (Passport.js strategy)](https://github.com/jaredhanson/passport-tripit)
- [FlightAware AeroAPI](https://www.flightaware.com/commercial/aeroapi/)
- [AeroAPI Pricing](https://www.flightaware.com/commercial/aeroapi/v3/pricing.rvt)
- [AviationStack](https://aviationstack.com/)
- [AviationStack Pricing](https://aviationstack.com/pricing)
- [Flightradar24 API](https://fr24api.flightradar24.com/)
- [Flightradar24 API Pricing](https://fr24api.flightradar24.com/subscriptions-and-credits)
- [AeroDataBox Pricing](https://aerodatabox.com/pricing/)
- [Best Flight Data APIs in 2026](https://geekflare.com/dev/flight-data-api/)
- [AwardWallet Email Parsing API](https://awardwallet.com/email-parsing-api)
- [flight-reservation-emails (open source)](https://github.com/JohannesBuchner/flight-reservation-emails)
- [TripIt MCP Server (viasocket)](https://viasocket.com/mcp/tripit)
- [Travel MCP Server (gs-ysingh)](https://mcpservers.org/servers/gs-ysingh/travel-mcp-server)
- [MCP Travel Assistant Suite](https://github.com/skarlekar/mcp_travelassistant)
