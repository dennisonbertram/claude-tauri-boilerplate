# Google Photos Connector Research

**Issue**: #396
**Date**: 2026-03-25
**Status**: Research complete

---

## 1. Executive Summary

Google Photos is a high-value connector for a desktop AI assistant, but the API landscape underwent a major shift on **March 31, 2025**. The legacy Library API scopes (`photoslibrary.readonly`, `photoslibrary.sharing`, `photoslibrary`) were removed, restricting Library API access to **app-created content only**. For accessing a user's existing photo library, Google now requires the **Picker API**, which uses a session-based flow where the user selects photos in a Google-hosted UI before the app can access them. This fundamentally changes the connector design: instead of a free-form "search my library" tool, the connector must guide the user through a picker session, then operate on the selected items. A secondary option is using the **Google Drive API** to access the "Google Photos" folder directly, which avoids the picker flow but provides less metadata. The existing community MCP server (`savethepolarbears/google-photos-mcp`) provides a useful reference but is limited by the same API restrictions.

---

## 2. API Overview

### Google Photos APIs (Post-March 2025)

Google now offers two distinct APIs for photos:

#### A. Photos Library API (Restricted)

**Base URL**: `https://photoslibrary.googleapis.com/v1/`

After March 31, 2025, this API **only works with content the app itself created/uploaded**. It cannot browse or search the user's existing library.

| Endpoint | Method | Description | Notes |
|---|---|---|---|
| `mediaItems.list` | GET | List app-created media | pageSize max 100 |
| `mediaItems.get` | GET | Get single media item by ID | Returns metadata + baseUrl |
| `mediaItems.batchGet` | GET | Get up to 50 items at once | Batch retrieval |
| `mediaItems.search` | POST | Search app-created media | Filters: date, category, content |
| `albums.list` | GET | List app-created albums | pageSize max 50 |
| `albums.get` | GET | Get album by ID | |
| `albums.create` | POST | Create album | |
| `mediaItems.batchCreate` | POST | Upload media items | Multi-step upload process |

**Remaining scopes:**
- `photoslibrary.readonly.appcreateddata` -- read app-created content
- `photoslibrary.appendonly` -- upload/create only
- `photoslibrary.edit.appcreateddata` -- edit titles/descriptions of app-created content

#### B. Photos Picker API (For User Library Access)

**Base URL**: `https://photospicker.googleapis.com/v1/`

This is the **only supported way** to access a user's existing photos. It uses a session-based flow:

| Endpoint | Method | Description |
|---|---|---|
| `sessions.create` | POST | Create a picker session, returns `pickerUri` |
| `sessions.get` | GET | Poll session status (check `mediaItemsSet`) |
| `sessions.delete` | DELETE | Clean up a session |
| `mediaItems.list` | GET | List items the user selected (requires `sessionId`) |

**Picker flow:**
1. App calls `sessions.create` -- returns `pickerUri` and `pollingConfig`
2. App opens `pickerUri` in user's browser (cannot be iframed)
3. User selects photos/albums in the Google Photos UI
4. App polls `sessions.get` using `pollingConfig.pollInterval`
5. When `mediaItemsSet` is `true`, app calls `mediaItems.list` with the `sessionId`
6. App retrieves `PickedMediaItem` objects with `id`, `baseUrl`, `mimeType`, `mediaFile`

**Scope:** `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`

**Key limitations:**
- `pickerUri` cannot be opened in an iframe (security restriction)
- Sessions have a timeout (`pollingConfig.timeoutIn`)
- Append `/autoclose` to `pickerUri` to auto-close the browser tab after selection
- Selected items are only accessible for the session duration

#### C. Google Drive API (Alternative)

**Base URL**: `https://www.googleapis.com/drive/v3/`

Google Photos content is also accessible through the Google Drive "Google Photos" folder. This provides:
- Full file access without picker restrictions
- Standard file metadata (name, mimeType, size, createdTime)
- Less photo-specific metadata (no EXIF location, camera info, etc.)
- **Scope**: `https://www.googleapis.com/auth/drive.readonly`

### Rate Limits

- Library API: 10,000 requests per project per day, 75 requests per user per minute
- Picker API: Similar limits, but lower per-session due to polling overhead
- Recommendation: implement exponential backoff with jitter

---

## 3. Authentication

### OAuth 2.0 (Required for all approaches)

Google Photos requires OAuth 2.0 with user consent. No API key access.

**Setup:**
1. Create project in Google Cloud Console
2. Enable "Photos Library API" and/or "Photos Picker API"
3. Create OAuth 2.0 credentials (Desktop app or Web app type)
4. Configure OAuth consent screen

**Recommended scopes for our connector:**

| Scope | Purpose | When to request |
|---|---|---|
| `photospicker.mediaitems.readonly` | Access user-selected photos via Picker | Primary -- library browsing |
| `photoslibrary.readonly.appcreateddata` | Read app-uploaded content | If we support upload+retrieve |
| `photoslibrary.appendonly` | Upload photos to user's library | If we support upload |

**Token management:**
- Access tokens expire after 1 hour
- Refresh tokens should be stored securely (our existing OAuth pattern via `~/.claude-tauri/data.db`)
- Token refresh must be handled transparently

### Desktop App Flow

For a Tauri desktop app, use the **OAuth 2.0 for installed applications** flow:
1. Open system browser with auth URL
2. Listen on local redirect URI (e.g., `http://localhost:<port>/callback`) or use a custom URI scheme
3. Exchange authorization code for tokens
4. Store refresh token in the local database

This aligns with our existing Google OAuth implementation (see `docs/investigations/google-oauth-integration-research.md`).

---

## 4. Existing MCP Server Implementations

### Community: `savethepolarbears/google-photos-mcp`

- **Repo**: https://github.com/savethepolarbears/google-photos-mcp
- **Status**: Active, updated to Streamable HTTP transport (June 2025 MCP spec)
- **Language**: TypeScript/Node.js
- **Transport**: Dual (stdio + Streamable HTTP with 30s keep-alive, 60s idle timeout)

**Tools exposed (7 total):**

| Tool | Description |
|---|---|
| `search_photos` | Search photos by text query (pageSize, pageToken) |
| `get_photo` | Get details of a specific photo by ID |
| `list_albums` | List all photo albums |
| `get_album` | Get details of a specific album |
| `list_album_photos` | List photos in a specific album |
| (location enrichment) | Extracts location from descriptions, geocodes via Nominatim |

**Key observations:**
- Uses Library API which is now restricted to app-created content post-March 2025
- The README explicitly warns about limited functionality with existing photos
- Good tool naming patterns to follow
- Location enrichment is a creative workaround for missing EXIF location data

### Platform: Composio Google Photos MCP

- **URL**: https://mcp.composio.dev/googlephotos
- **Status**: Hosted/managed platform
- Wraps Google Photos API calls behind Composio's auth and tool framework
- Less relevant for our in-process pattern

### Platform: Pipedream Google Photos MCP

- **URL**: https://mcp.pipedream.com/app/google_photos
- Workflow-oriented, not suited for direct integration

### Design Decision

We should build our own connector following the existing `ConnectorDefinition` pattern rather than wrapping an external MCP server, because:
1. Our architecture uses in-process `createSdkMcpServer()`, not external server connections
2. We need full control over the Picker API session flow (browser opening, polling)
3. We need to integrate with our existing OAuth token storage

However, we should study `savethepolarbears/google-photos-mcp` for tool naming conventions and location enrichment patterns.

---

## 5. TypeScript SDK / Client Libraries

### Google APIs Node.js Client

- **Package**: `googleapis` (npm) -- monolithic, includes all Google APIs
- **Package**: `@googleapis/photoslibrary` -- standalone Photos Library API client
- **Recommendation**: Use `@googleapis/photoslibrary` for Library API calls, raw `fetch` for Picker API (no official Picker SDK exists yet)

**Library API usage:**
```typescript
import { photoslibrary } from '@googleapis/photoslibrary';

const client = photoslibrary({
  version: 'v1',
  auth: oAuth2Client, // google-auth-library OAuth2Client
});

// List app-created media
const res = await client.mediaItems.list({ pageSize: 25 });

// Search app-created media
const res = await client.mediaItems.search({
  requestBody: {
    filters: {
      dateFilter: { ranges: [{ startDate: { year: 2024, month: 1, day: 1 }, endDate: { year: 2024, month: 12, day: 31 } }] },
      contentFilter: { includedContentCategories: ['LANDSCAPES', 'PETS'] },
    },
  },
});
```

**Picker API usage (raw fetch, no SDK):**
```typescript
// Create session
const session = await fetch('https://photospicker.googleapis.com/v1/sessions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}` },
});
const { id, pickerUri, pollingConfig } = await session.json();

// Poll for completion
let mediaReady = false;
while (!mediaReady) {
  await sleep(pollingConfig.pollInterval);
  const status = await fetch(`https://photospicker.googleapis.com/v1/sessions/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await status.json();
  mediaReady = data.mediaItemsSet;
}

// List selected items
const items = await fetch(`https://photospicker.googleapis.com/v1/mediaItems?sessionId=${id}&pageSize=100`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

**Recommendation**: Use raw `fetch` for both APIs (lighter weight, no heavy `googleapis` dependency). The Picker API has no SDK anyway, and the Library API endpoints are simple REST.

---

## 6. Proposed Tool Definitions

### Core tools (Phase 1 -- Picker-based library access)

| Tool Name | Description | Read/Write | Annotations |
|---|---|---|---|
| `photos_start_picker` | Create a Picker session and return the URL for the user to select photos | Read | `readOnlyHint: true, openWorldHint: true` |
| `photos_check_picker` | Poll a picker session to check if the user has finished selecting | Read | `readOnlyHint: true` |
| `photos_list_selected` | List media items the user selected in a picker session | Read | `readOnlyHint: true` |
| `photos_get_media` | Get details and download URL for a specific media item | Read | `readOnlyHint: true` |

### Extended tools (Phase 2 -- App-created content management)

| Tool Name | Description | Read/Write | Annotations |
|---|---|---|---|
| `photos_upload` | Upload a photo/video to the user's Google Photos | Write | `readOnlyHint: false` |
| `photos_create_album` | Create a new album | Write | `readOnlyHint: false` |
| `photos_list_app_media` | List media items uploaded by our app | Read | `readOnlyHint: true` |
| `photos_search_app_media` | Search app-uploaded media by date, category | Read | `readOnlyHint: true` |

### Tool parameter design

```typescript
// photos_start_picker
{
  // No required params -- session is created with defaults
  // Returns: { sessionId, pickerUrl, pollInterval, timeout }
}

// photos_check_picker
{
  sessionId: string; // Required -- from photos_start_picker
  // Returns: { ready: boolean, pollInterval?: string }
}

// photos_list_selected
{
  sessionId: string; // Required
  pageSize?: number; // Default 25, max 100
  pageToken?: string;
  // Returns: { items: PickedMediaItem[], nextPageToken? }
}

// photos_get_media
{
  sessionId: string; // Required -- for auth context
  mediaItemId: string; // Required
  thumbnailWidth?: number; // For resized image URL
  thumbnailHeight?: number;
  // Returns: { id, baseUrl, mimeType, width, height, creationTime }
}
```

### UX Consideration: The Picker Flow

The Picker API requires opening a browser window, which means this connector has a fundamentally different interaction pattern than purely API-based connectors like Weather or Todoist:

1. Claude says: "I'll open Google Photos so you can select the photos you want to work with."
2. Tool `photos_start_picker` fires, returns a URL
3. Frontend opens the URL in the user's default browser
4. User selects photos in Google Photos UI
5. Claude polls with `photos_check_picker` until ready
6. Claude retrieves items with `photos_list_selected`

This requires frontend support for opening external URLs and potentially a notification when the user returns to the app.

---

## 7. API Deprecation Status (Critical)

### Timeline of Changes

| Date | Event |
|---|---|
| Sep 2024 | Google announces Library API scope deprecation |
| Oct 2024 | Picker API launched as replacement |
| **Mar 31, 2025** | **Library API scopes removed** -- `photoslibrary.readonly`, `photoslibrary.sharing`, `photoslibrary` return 403 |
| Post-Mar 2025 | Library API restricted to app-created content only |

### What This Means for Our Connector

1. **Cannot search the user's entire photo library** via API -- only the Picker UI allows this
2. **Cannot list all albums** -- only app-created albums visible via Library API
3. **Cannot access EXIF/location data** for existing photos -- Picker returns `baseUrl` and `mimeType` only
4. **Can upload and manage** photos our app creates
5. **Picker sessions are ephemeral** -- selected item access does not persist indefinitely

### Community Impact

The deprecation caused significant disruption:
- `rclone` Google Photos backend can only download app-uploaded photos
- `gphotos-sync` project filed issues about broken functionality
- `transloadit/uppy` tracking migration to Picker API
- `hermanho/MMM-GooglePhotos` (MagicMirror module) affected by sharing scope removal
- Hacker News discussion showed strong developer frustration

### Recommendation

Accept the Picker-based flow as the primary access pattern. For a desktop AI assistant, this actually provides a reasonable UX: the user picks photos, and Claude processes/analyzes them. The alternative (Google Drive API) provides broader access but worse metadata.

---

## 8. Media Handling Best Practices

### Base URLs and Thumbnails

Media items include a `baseUrl` that provides access to the image/video bytes. **Base URLs expire after ~60 minutes** and must not be cached.

**Image sizing parameters (append to baseUrl):**
- `=w{width}` -- scale to width (e.g., `=w800`)
- `=h{height}` -- scale to height
- `=w{w}-h{h}` -- scale to fit within dimensions
- `=w{w}-h{h}-c` -- crop to exact dimensions
- `=s{size}` -- scale to square
- `=d` -- force download header

**Video parameters:**
- `=dv` -- download video
- `=w{w}-h{h}` -- video thumbnail
- `=w{w}-h{h}-no` -- thumbnail without playback overlay

**Example thumbnail generation:**
```typescript
function getThumbnailUrl(baseUrl: string, width: number, height: number): string {
  return `${baseUrl}=w${width}-h${height}-c`;
}

function getDownloadUrl(baseUrl: string, isVideo: boolean): string {
  return isVideo ? `${baseUrl}=dv` : `${baseUrl}=d`;
}
```

### Caching Rules

| Data | Cache Duration | Storage |
|---|---|---|
| `baseUrl` | **Do NOT cache** (expires ~60 min) | Fetch fresh each time |
| Media item IDs | Indefinitely | SQLite |
| Album IDs | Indefinitely | SQLite |
| Thumbnails (bytes) | Up to 60 minutes | In-memory or temp file |
| Metadata (dates, descriptions) | Indefinitely | SQLite |

### Pagination

- Default page size: 25 items
- Maximum page size: 100 items
- Use `nextPageToken` from response for subsequent pages
- Always handle the case where `nextPageToken` is absent (last page)

---

## 9. File Structure

Following the existing connector pattern (`apps/server/src/connectors/weather/`):

```
apps/server/src/connectors/google-photos/
├── index.ts          # ConnectorDefinition export
├── tools.ts          # Tool definitions (ConnectorToolDefinition[])
├── api.ts            # Google Photos API client (Picker + Library)
├── types.ts          # API response types, PickedMediaItem, etc.
├── oauth.ts          # Google OAuth helper (token refresh, scope management)
├── __tests__/
│   ├── api.test.ts           # API client tests with mock responses
│   ├── tools.test.ts         # Tool handler tests
│   └── fixtures/
│       ├── picker-session.json    # Mock session response
│       ├── media-items.json       # Mock media items list
│       └── album.json             # Mock album response
└── README.md         # (only if requested)
```

### Connector registration

```typescript
// apps/server/src/connectors/google-photos/index.ts
import type { ConnectorDefinition } from '../types';
import { googlePhotosTools } from './tools';

export const googlePhotosConnector: ConnectorDefinition = {
  name: 'google-photos',
  displayName: 'Google Photos',
  description: 'Browse, select, and analyze photos from your Google Photos library using the Picker API.',
  icon: '📷',
  category: 'lifestyle',
  requiresAuth: true,
  tools: googlePhotosTools,
};
```

```typescript
// apps/server/src/connectors/index.ts -- add to CONNECTORS array
import { googlePhotosConnector } from './google-photos';
const CONNECTORS: ConnectorDefinition[] = [weatherConnector, googlePhotosConnector];
```

---

## 10. Testing Strategy

### Unit Tests

**API client tests (`api.test.ts`):**
- Mock `fetch` responses for all Picker API endpoints
- Test session creation, polling logic, media item retrieval
- Test baseUrl parameter generation (thumbnails, downloads)
- Test pagination handling (single page, multi-page, empty results)
- Test error handling (403 for expired tokens, 429 for rate limits, network errors)

**Tool handler tests (`tools.test.ts`):**
- Test each tool's input validation
- Test tool output formatting
- Test error messages for missing session IDs, invalid parameters

### Mock Fixtures

```typescript
// fixtures/picker-session.json
{
  "id": "session-abc123",
  "pickerUri": "https://photos.google.com/picker/session-abc123",
  "pollingConfig": {
    "pollInterval": "2s",
    "timeoutIn": "600s"
  },
  "mediaItemsSet": false,
  "expireTime": "2026-03-25T12:00:00Z"
}

// fixtures/media-items.json
{
  "mediaItems": [
    {
      "id": "media-item-001",
      "baseUrl": "https://lh3.googleusercontent.com/fake-base-url-001",
      "mimeType": "image/jpeg",
      "mediaFile": {
        "filename": "IMG_20240615_143022.jpg",
        "fileSize": "3456789",
        "mediaMetadata": {
          "width": "4032",
          "height": "3024",
          "creationTime": "2024-06-15T14:30:22Z"
        }
      }
    },
    {
      "id": "media-item-002",
      "baseUrl": "https://lh3.googleusercontent.com/fake-base-url-002",
      "mimeType": "video/mp4",
      "mediaFile": {
        "filename": "VID_20240620_091500.mp4",
        "fileSize": "45678901",
        "mediaMetadata": {
          "width": "1920",
          "height": "1080",
          "creationTime": "2024-06-20T09:15:00Z"
        }
      }
    }
  ],
  "nextPageToken": "page2token"
}
```

### Integration Test Considerations

- Google does not provide a sandbox/test environment for Photos APIs
- All integration testing requires a real Google account with OAuth consent
- For CI, rely on unit tests with mocked responses
- For manual testing, create a dedicated test Google account with known photo content

### Regression Tests for Known Edge Cases

1. **Expired baseUrl**: Ensure the connector re-fetches media items if a baseUrl returns 403
2. **Session timeout**: Verify graceful handling when `pollingConfig.timeoutIn` is exceeded
3. **Empty selection**: User opens picker but selects nothing -- handle gracefully
4. **Large selections**: Test pagination with >100 selected items
5. **Token refresh during long session**: Ensure OAuth token is refreshed if it expires mid-polling

---

## Sources

- [Google Photos API Updates](https://developers.google.com/photos/support/updates)
- [Picker API Launch Blog Post](https://developers.googleblog.com/en/google-photos-picker-api-launch-and-library-api-updates/)
- [Picker API Get Started Guide](https://developers.google.com/photos/picker/guides/get-started-picker)
- [Sessions REST Resource](https://developers.google.com/photos/picker/reference/rest/v1/sessions)
- [Picker mediaItems.list](https://developers.google.com/photos/picker/reference/rest/v1/mediaItems/list)
- [Authorization Scopes](https://developers.google.com/photos/overview/authorization)
- [Best Practices](https://developers.google.com/photos/overview/best-practices)
- [Library API Media Items](https://developers.google.com/photos/library/guides/access-media-items)
- [savethepolarbears/google-photos-mcp (GitHub)](https://github.com/savethepolarbears/google-photos-mcp)
- [Google Photos MCP (LobeHub)](https://lobehub.com/mcp/savethepolarbears-google-photos-mcp)
- [Google Photos API Deprecation Impact (memoryKPR)](https://memorykpr.com/blog/google-photos-api-deprecation-what-it-means-for-third-party-apps-and-how-to-prepare/)
- [Google Cloud MCP Announcement](https://cloud.google.com/blog/products/ai-machine-learning/announcing-official-mcp-support-for-google-services)
