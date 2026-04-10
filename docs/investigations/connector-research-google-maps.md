# Google Maps Connector Research

## 1. Problem Statement

Issue #387 requests a Google Maps connector for the desktop app. The connector should follow the existing `ConnectorDefinition` pattern (in-process MCP server via `createSdkMcpServer()`) and expose geospatial tools -- geocoding, directions/routing, place search, and distance calculation -- to Claude sessions. Key concerns: API cost management, caching strategy, auth model, and whether Google Maps is the right choice vs. free alternatives.

## 2. Existing MCP Implementations

### Official Google Maps MCP (December 2025)

Google launched managed MCP servers for Maps as part of a broader cloud MCP rollout (December 10, 2025). However, the official MCP server (`mapstools.googleapis.com`) is a **documentation RAG tool**, not a direct Maps API proxy. It provides two tools:
- `retrieve-instructions` -- system prompt for query formulation
- `retrieve-google-maps-platform-docs` -- searches official documentation via hosted RAG

This is **not useful** for our connector -- it answers questions about Maps APIs, it does not call them.

### Community: cablate/mcp-google-map (Best Reference)

The most complete community implementation. Architecture:
- **18 tools** organized as atomic + composite
- **Atomic tools (14):** `maps_geocode`, `maps_reverse_geocode`, `maps_batch_geocode`, `maps_directions`, `maps_distance_matrix`, `maps_search_nearby`, `maps_search_places`, `maps_search_along_route`, `maps_place_details`, `maps_elevation`, `maps_timezone`, `maps_weather`, `maps_air_quality`, `maps_static_map`
- **Composite tools (4):** `maps_explore_area`, `maps_plan_route`, `maps_compare_places`, `maps_local_rank_tracker`
- Uses `@googlemaps/places` (v2) + `@googlemaps/google-maps-services-js`
- Zod validation, all tools marked `readOnlyHint: true`
- Supports `GOOGLE_MAPS_ENABLED_TOOLS` env var to limit which tools are registered (reduces token overhead)
- Batch geocode handles 50 addresses with 20-concurrent parallelism

### Anthropic Reference (PulseMCP listing)

Anthropic published a simpler Google Maps MCP server focused on core operations: geocoding, reverse geocoding, place search, place details, and directions. Lighter weight than the cablate implementation.

## 3. Google Maps Platform APIs

### Recommended APIs for Our Connector

| API | Use Case | Status | Pricing Tier |
|-----|----------|--------|-------------|
| **Geocoding** | Address to lat/lng and reverse | Current | Essentials |
| **Routes API** (Compute Routes) | Directions with traffic awareness | Current (replaces Directions API) | Essentials/Pro |
| **Places (New)** | Text search, nearby search, details | Current | Pro/Enterprise |
| **Places Autocomplete** | Address/place typeahead | Current | Essentials |
| **Distance Matrix** | Travel time between multiple origins/destinations | Legacy (use Routes Compute Route Matrix) | Essentials/Pro |
| **Elevation** | Terrain elevation data | Current | Essentials |

### Routes API vs. Directions API (Legacy)

As of March 1, 2025, Directions API and Distance Matrix API are **legacy**. Routes API is the replacement:
- POST-based (not GET), no URL length limits on waypoints
- Supports field masks to request only needed data (reduces cost)
- Includes toll info, 2-wheel routes, improved ETA
- Essentials tier: $5/1K requests; Pro tier: $10/1K; Enterprise: $15/1K
- **Recommendation:** Use Routes API from the start, not legacy Directions.

## 4. Pricing & Cost Analysis

### Current Pricing (Post-March 2025 Restructure)

| SKU | Tier | Price per 1K | Free Monthly Cap |
|-----|------|-------------|-----------------|
| Geocoding | Essentials | $5.00 | 10,000 |
| Routes Compute (basic) | Essentials | $5.00 | 10,000 |
| Routes Compute (traffic-aware) | Pro | $10.00 | 5,000 |
| Routes Compute (preferred) | Enterprise | $15.00 | 1,000 |
| Places Text Search | Pro | $32.00 | 5,000 |
| Places Nearby Search | Pro | $32.00 | 5,000 |
| Autocomplete Requests | Essentials | $2.83 | 10,000 |
| Elevation | Essentials | $5.00 | 10,000 |

### Cost Projection for Desktop App

For a single-user desktop app, the free tiers are generous:
- **10,000 free geocoding requests/month** -- more than sufficient
- **10,000 free basic route computations/month** -- ample for personal use
- **5,000 free Places searches/month** -- reasonable
- **Realistic monthly cost for moderate use: $0** (stays within free tiers)
- Heavy use (hundreds of requests/day): $5-20/month

### Key Insight: Field Masks

Routes API and Places (New) support **field masks**. By requesting only the fields you need, you can often stay in the cheaper Essentials tier instead of triggering Pro pricing. For example, requesting only route duration and polyline (no traffic) stays at $5/1K vs $10/1K.

## 5. Caching Strategy

### Google ToS Constraints

- **Place IDs can be cached indefinitely** (explicitly exempt from restrictions)
- **Geocoding results** (lat/lng): cacheable for up to **30 days** per ToS Section 3.2.3
- **Other content**: must not be "pre-fetched, indexed, stored, or cached" beyond ToS limits
- Route/direction results should NOT be cached long-term (real-time traffic changes)

### Recommended Caching Implementation

```typescript
// In-memory TTL cache per connector instance
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL = {
  geocode: 30 * 24 * 60 * 60 * 1000,   // 30 days (ToS max)
  placeId: Infinity,                      // Indefinite (ToS exempt)
  placeDetails: 24 * 60 * 60 * 1000,     // 24 hours (conservative)
  directions: 5 * 60 * 1000,             // 5 minutes (traffic changes)
  elevation: 7 * 24 * 60 * 60 * 1000,    // 7 days (static data)
};
```

**SQLite persistence option**: Since the app already uses `bun:sqlite`, geocode results and place IDs can be persisted to a `maps_cache` table for cross-session caching. This is the biggest cost saver -- geocoding the same address twice is wasted money.

### Batch Geocoding

For lists of addresses, queue them and batch-process with concurrency limiting (20 parallel max, matching the cablate pattern). Deduplicate against cache before sending.

## 6. Authentication Model

### API Key (Recommended)

- Simplest approach, matches the existing weather connector pattern
- Stored in settings/env, passed per-request via `key` parameter
- **Restriction best practices:**
  - Restrict by IP address (server-side only)
  - Restrict to specific APIs (Geocoding, Routes, Places)
  - Set daily quota caps in Google Cloud Console
  - Never expose in frontend code (Tauri sidecar handles all calls)

### OAuth (Not Recommended)

- Only needed for user-specific data (e.g., saved places in user's Google account)
- Our use case is purely API-based (geocoding, routing, search) -- no user data
- Adds significant complexity with no benefit

### Implementation

```typescript
// API key from settings, same pattern as other connectors
function getGoogleMapsApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY || getSettingValue('google_maps_api_key');
  if (!key) throw new Error('Google Maps API key not configured');
  return key;
}
```

The connector should set `requiresAuth: true` in the `ConnectorDefinition` since it needs an API key, and the settings UI should provide a field for entering it.

## 7. Alternatives Analysis

### Apple MapKit JS

| Aspect | Verdict |
|--------|---------|
| **Pricing** | 250K map loads + 25K service calls free/day -- extremely generous |
| **Geocoding** | Yes, included |
| **Routing** | Yes, but less detailed than Google |
| **Places** | Limited compared to Google |
| **Transit/Traffic** | Basic overlays only, no real-time transit |
| **Auth** | Requires Apple Developer account + MapKit JS token (JWT signed with private key) |
| **Global data** | Weaker outside US/EU |
| **Recommendation** | Viable free alternative for basic geocoding/routing; insufficient for rich place data |

### OpenStreetMap / Nominatim

| Aspect | Verdict |
|--------|---------|
| **Pricing** | Free (public API) |
| **Rate limit** | 1 request/second, no autocomplete allowed |
| **Geocoding** | Good quality, community-maintained data |
| **Routing** | Not provided (need OSRM or Valhalla separately) |
| **Places** | Not provided (need Overpass API separately) |
| **Auth** | None (just requires User-Agent header) |
| **Self-hosting** | Can run your own Nominatim instance |
| **Recommendation** | Good free fallback for geocoding only; not a full replacement |

### Recommended Strategy

Use **Google Maps as primary** with **Nominatim as free fallback** for geocoding:
1. If Google API key is configured, use Google for everything
2. If no API key, degrade gracefully to Nominatim for geocoding-only (1 req/sec limit)
3. This mirrors the weather connector pattern (NWS API is free, no key needed)

## 8. Proposed Connector Architecture

### File Structure

```
apps/server/src/connectors/maps/
  index.ts          -- ConnectorDefinition export
  tools.ts          -- Tool definitions (geocode, route, places, etc.)
  api.ts            -- Google Maps API client wrapper
  cache.ts          -- TTL cache with SQLite persistence
  nominatim.ts      -- Free fallback geocoder
  types.ts          -- Response types
```

### Tool Definitions (Priority Order)

**Phase 1 (MVP):**
1. `maps_geocode` -- Address to coordinates (and reverse)
2. `maps_directions` -- Route between two points (via Routes API)
3. `maps_search_places` -- Find businesses/POIs by text query
4. `maps_place_details` -- Get details for a specific place

**Phase 2:**
5. `maps_distance_matrix` -- Travel time between multiple points
6. `maps_autocomplete` -- Place/address autocomplete suggestions
7. `maps_nearby_search` -- Find places near coordinates by type

**Phase 3 (Composite):**
8. `maps_explore_area` -- Multi-category neighborhood overview
9. `maps_plan_route` -- Multi-waypoint trip planning

### ConnectorDefinition

```typescript
export const mapsConnector: ConnectorDefinition = {
  name: 'maps',
  displayName: 'Maps',
  description: 'Search places, get directions, geocode addresses, and explore locations using Google Maps.',
  icon: '🗺️',
  category: 'lifestyle',
  requiresAuth: true,  // needs Google Maps API key
  tools: mapsTools,
};
```

## 9. Library Recommendation

### @googlemaps/google-maps-services-js

- Official Google library for Node.js server-side use
- Promise-based, Axios transport, built-in TypeScript types
- Supports: Geocoding, Elevation, Time Zone, Roads, Static Maps
- **Caveat:** Directions and Places methods are legacy wrappers
- For Routes API (new): use direct REST calls (POST to `https://routes.googleapis.com/...`)
- For Places (New): use `@googlemaps/places` package

### Recommended Approach

```typescript
import { Client } from '@googlemaps/google-maps-services-js';

const mapsClient = new Client({});

// Geocoding (via library)
const geocodeResult = await mapsClient.geocode({
  params: { address: 'Tokyo Tower', key: apiKey },
  timeout: 5000,
});

// Routes API (direct REST -- library doesn't support new API)
const routeResult = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline',
  },
  body: JSON.stringify({
    origin: { location: { latLng: { latitude: 35.6586, longitude: 139.7454 } } },
    destination: { location: { latLng: { latitude: 35.6762, longitude: 139.6503 } } },
    travelMode: 'DRIVE',
  }),
});
```

## 10. Testing Strategy

### Mock API Responses

All Google Maps API calls should go through a thin client wrapper (`api.ts`) that can be mocked in tests:

```typescript
// Fixture data
const FIXTURE_LOCATIONS = {
  newYork: { lat: 40.7128, lng: -74.0060, address: 'New York, NY, USA' },
  sanFrancisco: { lat: 37.7749, lng: -122.4194, address: 'San Francisco, CA, USA' },
  tokyo: { lat: 35.6762, lng: 139.6503, address: 'Tokyo, Japan' },
};

// Mock the API client in tests
vi.mock('./api', () => ({
  geocodeAddress: vi.fn().mockResolvedValue(FIXTURE_LOCATIONS.newYork),
  computeRoute: vi.fn().mockResolvedValue({
    duration: '1234s',
    distanceMeters: 5678,
    polyline: { encodedPolyline: 'mock_polyline' },
  }),
}));
```

### Test Categories

1. **Unit tests:** Each tool handler with mocked API responses, cache hit/miss scenarios
2. **Cache tests:** TTL expiration, SQLite persistence, deduplication
3. **Fallback tests:** Nominatim fallback when no API key configured
4. **Error handling:** Invalid addresses, rate limits, network failures, invalid API keys
5. **Integration tests (optional, requires API key):** Real API calls against fixture locations with assertions on response shape

### Test Location

```
apps/server/src/connectors/maps/__tests__/
  tools.test.ts       -- Tool handler tests
  cache.test.ts       -- Cache logic tests
  api.test.ts         -- API client tests (mocked)
  nominatim.test.ts   -- Fallback geocoder tests
```

## Summary & Recommendations

1. **Use Google Maps with API key auth** -- simplest model, generous free tiers for desktop app use
2. **Start with Routes API** (not legacy Directions) and Places (New) from day one
3. **Implement aggressive caching** -- geocode results for 30 days, place IDs indefinitely, routes for 5 min
4. **Use field masks** on Routes and Places to stay in cheaper Essentials tier
5. **Provide Nominatim fallback** for geocoding when no API key is configured
6. **Phase the implementation** -- start with 4 core tools (geocode, directions, places search, place details)
7. **Follow the weather connector pattern** exactly for `ConnectorDefinition`, tool structure, and error handling
8. **Library:** `@googlemaps/google-maps-services-js` for geocoding/elevation, direct REST for Routes API and Places (New)
9. **Budget:** A single desktop user will almost certainly stay within free tiers ($0/month)
10. **Avoid Apple MapKit JS** unless Apple ecosystem lock-in is desired -- Google has superior data and API surface
