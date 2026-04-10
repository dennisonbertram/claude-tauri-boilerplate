# Google Drive Connector Research

**Issue**: #394
**Date**: 2026-03-25
**Status**: Capability audit for partially-integrated Google Drive connector

---

## 1. Current State Audit

### What Already Exists

The codebase has a partially-integrated Google Drive implementation across three layers:

| Layer | File | Capabilities |
|-------|------|-------------|
| Auth | `apps/server/src/services/google/auth.ts` | OAuth2 client factory, token refresh, error classification (`invalid_grant`, rate limits, 403/404/401/5xx) |
| Service | `apps/server/src/services/google/drive.ts` | `listFiles`, `getFile`, `getFileContent`, `uploadFile` |
| Routes | `apps/server/src/routes/google/drive.ts` | REST endpoints: `GET /files`, `GET /files/:id`, `GET /files/:id/content`, `POST /files` |
| Frontend | `apps/desktop/src/components/settings/GooglePanel.tsx` | Settings UI for Google connection |

### What Is Missing

The Drive service is **not** registered as a `ConnectorDefinition`. It lives in `services/google/` as a standalone REST API but is not wired into the connector/MCP system (`apps/server/src/connectors/`). This means:

- Claude sessions cannot call Drive tools via the in-process MCP server
- No `ConnectorToolDefinition` wrappers exist for Drive operations
- The weather connector (`apps/server/src/connectors/weather/`) is the only registered connector

### OAuth Scopes (Current)

```typescript
// apps/server/src/services/google/auth.ts
export const GOOGLE_SCOPES = [
  'openid', 'email', 'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive',  // Full read+write access
];
```

The current scope `drive` grants full read/write access. This is broader than necessary for most operations.

---

## 2. Google Drive API v3 -- Comprehensive Reference

### Core Resources

| Resource | Key Endpoints | Description |
|----------|--------------|-------------|
| **Files** | `list`, `get`, `create`, `update`, `delete`, `copy`, `export` | File CRUD and export |
| **Permissions** | `list`, `get`, `create`, `update`, `delete` | Sharing and access control |
| **Comments** | `list`, `get`, `create`, `update`, `delete` | File comments |
| **Replies** | `list`, `get`, `create`, `update`, `delete` | Replies to comments |
| **Revisions** | `list`, `get`, `update`, `delete` | File version history |
| **Changes** | `list`, `getStartPageToken`, `watch` | Change tracking (incremental sync) |
| **Drives** | `list`, `get`, `create`, `update`, `delete`, `hide`, `unhide` | Shared drives management |

### File Search Query Syntax

The `files.list` endpoint accepts a `q` parameter with powerful query syntax:

```
# By name
name contains 'budget'
name = 'Q1 Report.docx'

# By MIME type
mimeType = 'application/vnd.google-apps.spreadsheet'
mimeType != 'application/vnd.google-apps.folder'

# By parent folder
'FOLDER_ID' in parents

# By date
modifiedTime > '2026-01-01T00:00:00'
createdTime > '2025-06-01T00:00:00'

# By owner/visibility
'user@example.com' in owners
sharedWithMe = true
starred = true
trashed = false

# Full-text content search
fullText contains 'quarterly earnings'

# Combined queries (AND only, no OR)
name contains 'budget' and mimeType = 'application/vnd.google-apps.spreadsheet'
```

**Important operators**: `contains`, `=`, `!=`, `<`, `>`, `<=`, `>=`, `in`, `has`, `not ... has`

### Corpora Parameter

Controls which collection of files to search:

| Value | Description | Use Case |
|-------|-------------|----------|
| `user` | User's My Drive + shared files (default) | Most common |
| `drive` | A specific shared drive (requires `driveId`) | Shared drive access |
| `domain` | All files shared to the domain | Workspace admin |
| `allDrives` | My Drive + all shared drives | Broad search (slower, may be incomplete) |

**Best practice**: Prefer `user` or `drive` over `allDrives`. If `allDrives` returns `incompleteSearch: true`, narrow the scope.

### Pagination

- `pageSize`: 1-1000 (default 100 for files.list)
- `pageToken`: Opaque token from previous response's `nextPageToken`
- Always check for `nextPageToken` -- if absent, you've reached the end
- `fields` parameter is critical for performance (see Section 7)

### Rate Limits

| Limit Type | Value |
|-----------|-------|
| Per-user rate | ~600 requests/minute (soft) |
| Per-project | ~12,000 requests/minute |
| Per-project daily | ~1,000,000,000 queries/day |
| Export file size | 10 MB max |
| Upload (simple) | 5 MB max |
| Upload (multipart/resumable) | 5 TB max |

**Backoff strategy**: On 429 or 5xx, use exponential backoff starting at 1s, doubling up to 32s. The existing `classifyGoogleError()` in auth.ts already identifies rate-limited and retryable errors, but no retry logic is implemented.

---

## 3. Google Workspace File Handling

### MIME Types for Workspace Files

| Google Type | MIME Type | Best Export Formats |
|-------------|----------|-------------------|
| Document | `application/vnd.google-apps.document` | `text/plain`, `text/html`, `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (docx) |
| Spreadsheet | `application/vnd.google-apps.spreadsheet` | `text/csv`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (xlsx), `application/pdf` |
| Presentation | `application/vnd.google-apps.presentation` | `text/plain`, `application/pdf`, `application/vnd.openxmlformats-officedocument.presentationml.presentation` (pptx) |
| Drawing | `application/vnd.google-apps.drawing` | `image/png`, `image/svg+xml`, `application/pdf` |
| Apps Script | `application/vnd.google-apps.script` | `application/vnd.google-apps.script+json` |
| Form | `application/vnd.google-apps.form` | Not exportable via Drive API |

### Current Export Defaults (drive.ts)

```typescript
const WORKSPACE_EXPORT_DEFAULTS: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
  'application/vnd.google-apps.drawing': 'image/png',
};
```

**Gap**: For LLM consumption, `text/plain` is good for Docs. CSV is acceptable for Sheets but loses formatting/formulas. For Presentations, `text/plain` loses slide structure. Consider offering Markdown (via HTML conversion) for richer output.

### Drive API vs Docs/Sheets/Slides APIs

| Capability | Drive API | Docs/Sheets/Slides API |
|-----------|-----------|----------------------|
| File metadata & list | Yes | No |
| Export to various formats | Yes (`files.export`) | No |
| Read structured content | No | Yes (paragraphs, cells, slides) |
| Edit content | No (upload only) | Yes (granular edits) |
| Create from template | No | Yes (merge) |
| Permissions/sharing | Yes | No |

**Recommendation for MCP connector**: Start with Drive API only. The Docs/Sheets/Slides APIs add significant complexity and are only needed for granular in-document editing. For reading, `files.export` to text/CSV/HTML covers most LLM use cases.

---

## 4. Existing MCP Implementations -- Landscape

### Official Anthropic Reference (modelcontextprotocol/servers)

The official gdrive MCP server provides:
- `gdrive_search` -- search files by query
- `gdrive_read_file` -- read file contents (auto-exports Workspace files)
- `gdrive_read_spreadsheet` -- read spreadsheet data with range options
- `gdrive_update_spreadsheet_cell` -- update a single cell

Scope: `drive.readonly` only. Minimal, read-focused.

### felores/gdrive-mcp-server

- `gdrive_search`, `gdrive_read_file`, `gdrive_list_files`
- Node.js/TypeScript, MIT license
- OAuth credentials stored in local JSON file
- Focused on search + read, no write operations

### piotr-agier/google-drive-mcp

- Full CRUD: create, update, delete, rename, move, copy files and folders
- Google Docs, Sheets, Slides, Calendar integration
- Most feature-complete community implementation
- More complex auth setup

### isaacphi/mcp-gdrive

- Go implementation
- Read files + edit Google Sheets
- Lightweight alternative

### Key Takeaway

All major implementations converge on a core tool set:
1. **Search/list** files
2. **Read** file content (with auto-export for Workspace files)
3. **Spreadsheet** read (with range support)
4. Optional: write/update operations

---

## 5. Recommended Tool Design for Connector

Based on the existing ConnectorDefinition pattern and community MCP implementations, here are the recommended tools:

### Tier 1 -- Core (MVP)

```typescript
// Search files with Drive query syntax
drive_search(query: string, pageSize?: number, pageToken?: string)
  -> { files: DriveFile[], nextPageToken?: string }

// Read file content (auto-exports Workspace files)
drive_read(fileId: string, exportFormat?: string)
  -> { content: string, mimeType: string, name: string }

// Get file metadata
drive_get_metadata(fileId: string)
  -> DriveFile (id, name, mimeType, size, modifiedTime, webViewLink, parents)
```

### Tier 2 -- Spreadsheets

```typescript
// Read spreadsheet with range support
drive_read_spreadsheet(fileId: string, range?: string, sheetName?: string)
  -> { headers: string[], rows: string[][], sheetName: string }

// Update spreadsheet cell
drive_update_cell(fileId: string, range: string, value: string)
  -> { updatedRange: string, updatedValue: string }
```

### Tier 3 -- Write Operations

```typescript
// Create/upload a file
drive_create(name: string, content: string, mimeType: string, parentId?: string)
  -> DriveFile

// List folder contents
drive_list_folder(folderId?: string, pageSize?: number)
  -> { files: DriveFile[], nextPageToken?: string }
```

### Tool Annotations

Following the weather connector pattern, each tool should declare annotations:

```typescript
annotations: {
  title: 'Search Google Drive',
  readOnlyHint: true,    // for search/read tools
  openWorldHint: true,   // accesses external service
}
```

Write tools should set `readOnlyHint: false` and `destructiveHint: true` (for delete operations).

---

## 6. Authentication Strategy

### Scope Recommendations

| Use Case | Scope | Risk Level |
|----------|-------|-----------|
| Read-only connector | `drive.readonly` | Low (non-sensitive) |
| Read + app-created files | `drive.file` | Low (non-sensitive) |
| Full read/write | `drive` | High (sensitive, requires verification) |
| Metadata only | `drive.metadata.readonly` | Lowest |

**Recommendation**: Use `drive.readonly` as the default scope for the MCP connector. Upgrade to `drive` only when write tools are enabled. The current codebase requests `drive` (full access), which is more than needed for read operations.

### Incremental Authorization

Google supports incremental authorization -- request only `drive.readonly` initially, then prompt for `drive` when the user first attempts a write operation. This reduces consent friction.

### Token Storage (Current)

Tokens are stored in SQLite via `apps/server/src/db/` functions:
- `getGoogleOAuth(db)` -- retrieve stored tokens
- `updateGoogleOAuthTokens(db, ...)` -- persist refreshed tokens
- `clearGoogleOAuth(db)` -- remove on revocation

This is already well-implemented with proactive refresh (`refreshTokenIfNeeded`) and automatic persistence via the `tokens` event listener.

---

## 7. Performance Best Practices

### Partial Responses (fields parameter)

Always specify `fields` to avoid downloading unnecessary data:

```typescript
// Good -- only fetches needed fields
fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)'

// Bad -- fetches everything including permissions, thumbnails, etc.
fields: '*'
```

The existing `listFiles` and `getFile` already do this correctly.

### Batch Requests

Google Drive API supports batching up to 100 requests in a single HTTP call. The `googleapis` library supports this via `google.newBatch()`. Useful for fetching metadata of multiple files simultaneously.

### Content Size Management

- **Export limit**: 10 MB per Workspace file export
- **For LLM context**: Most files should be truncated or summarized if they exceed ~50KB of text content
- **Binary files**: Should not be sent to the LLM as raw content. Return metadata + download link instead.
- **Large spreadsheets**: Always use range-based reads rather than full export

### Caching Considerations

- File metadata changes infrequently -- cache with 5-minute TTL
- Content changes more often -- use `modifiedTime` as a cache key
- The `changes.list` API can enable efficient incremental sync for frequently accessed files

---

## 8. Shared Drive Support

### Required Parameters

To support shared drives, API calls need additional parameters:

```typescript
drive.files.list({
  q: query,
  corpora: 'allDrives',           // or 'drive' with driveId
  includeItemsFromAllDrives: true,
  supportsAllDrives: true,
  // driveId: 'SPECIFIC_DRIVE_ID'  // for single shared drive
});

drive.files.get({
  fileId: id,
  supportsAllDrives: true,
});
```

**Gap in current implementation**: The existing `listFiles` and `getFile` do NOT pass `supportsAllDrives: true`, so shared drive files will fail with 404 errors. This is a bug.

### Recommendation

Add `supportsAllDrives: true` to all file operations by default. Add an optional `corpora` parameter to the search tool to let users target specific shared drives.

---

## 9. Testing Strategy

### Mock API Approach

The `googleapis` library can be mocked at the HTTP level using `nock` or by mocking the `drive.files.*` methods directly:

```typescript
import { google } from 'googleapis';
import { describe, it, expect, mock } from 'bun:test';

// Mock the entire drive API
const mockDrive = {
  files: {
    list: mock(() => Promise.resolve({
      data: {
        files: [{ id: '1', name: 'test.txt', mimeType: 'text/plain' }],
        nextPageToken: undefined,
      }
    })),
    get: mock(() => Promise.resolve({
      data: { id: '1', name: 'test.txt', mimeType: 'text/plain' }
    })),
    export: mock(() => Promise.resolve({ data: 'exported content' })),
  }
};

// Override google.drive to return mock
mock.module('googleapis', () => ({
  google: { drive: () => mockDrive }
}));
```

### Test Fixture Files

Create fixtures for different file types:
- `fixtures/drive-files-list.json` -- typical files.list response
- `fixtures/drive-doc-export.txt` -- exported Google Doc content
- `fixtures/drive-sheet-export.csv` -- exported spreadsheet
- `fixtures/drive-error-403.json` -- permission denied response
- `fixtures/drive-error-429.json` -- rate limit response

### Test Categories

1. **Unit tests**: Each tool function (search, read, get_metadata) with mocked API
2. **Error handling**: All classified error types (revoked, rate-limited, forbidden, not-found, server-error)
3. **Workspace export**: Correct MIME type selection for each Google file type
4. **Pagination**: Verify nextPageToken is properly forwarded
5. **Connector registration**: Verify the connector appears in `getAllConnectors()` and tools are available via `getConnectorTools()`

---

## 10. Implementation Plan

### Phase 1: Wire Up as ConnectorDefinition (Core)

1. Create `apps/server/src/connectors/google-drive/index.ts` following weather connector pattern
2. Create `apps/server/src/connectors/google-drive/tools.ts` with Tier 1 tools:
   - `drive_search` -- wraps existing `listFiles`
   - `drive_read` -- wraps existing `getFileContent`
   - `drive_get_metadata` -- wraps existing `getFile`
3. Register in `apps/server/src/connectors/index.ts`:
   ```typescript
   const CONNECTORS: ConnectorDefinition[] = [weatherConnector, googleDriveConnector];
   ```
4. Add `supportsAllDrives: true` to all existing Drive API calls (shared drive fix)
5. Write tests for all three tools

### Phase 2: Spreadsheet Support

1. Add `drive_read_spreadsheet` tool using Sheets API (`google.sheets({ version: 'v4' })`)
2. Add `drive_update_cell` for single-cell updates
3. Requires adding `https://www.googleapis.com/auth/spreadsheets` scope (or rely on existing `drive` scope)

### Phase 3: Write Operations & Enhancements

1. Add `drive_create` and `drive_list_folder` tools
2. Add retry logic with exponential backoff (leveraging existing `classifyGoogleError`)
3. Consider incremental authorization for write scopes
4. Add content size guards (truncate large files for LLM context)

### Phase 4: Advanced Features

1. Comments/revisions tools (if user demand warrants)
2. Change watching for real-time sync
3. Batch metadata fetching
4. Shared drive listing/navigation

### Dependencies

Already installed in the project:
- `googleapis` -- Google API client (includes Drive, Sheets, Docs)
- `google-auth-library` -- OAuth2 client
- `zod` -- Schema validation for tool inputs
- `@anthropic-ai/claude-agent-sdk` -- `tool()` helper and `createSdkMcpServer()`

No new dependencies required for Phase 1.

---

## Sources

- [Google Drive API v3 Reference](https://developers.google.com/workspace/drive/api/reference/rest/v3)
- [Search for files and folders](https://developers.google.com/workspace/drive/api/guides/search-files)
- [Search query terms and operators](https://developers.google.com/workspace/drive/api/guides/ref-search-terms)
- [Export MIME types for Google Workspace documents](https://developers.google.com/workspace/drive/api/guides/ref-export-formats)
- [Google Workspace and Google Drive supported MIME types](https://developers.google.com/workspace/drive/api/guides/mime-types)
- [Choose Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Implement shared drive support](https://developers.google.com/workspace/drive/api/guides/enable-shareddrives)
- [Manage comments and replies](https://developers.google.com/workspace/drive/api/guides/manage-comments)
- [Manage file revisions](https://developers.google.com/drive/api/guides/manage-revisions)
- [Usage limits](https://developers.google.com/workspace/drive/api/guides/limits)
- [Improve performance](https://developers.google.com/workspace/drive/api/guides/performance)
- [Announcing official MCP support for Google services](https://cloud.google.com/blog/products/ai-machine-learning/announcing-official-mcp-support-for-google-services)
- [Official Anthropic gdrive MCP server](https://www.pulsemcp.com/servers/modelcontextprotocol-gdrive)
- [felores/gdrive-mcp-server](https://github.com/felores/gdrive-mcp-server)
- [piotr-agier/google-drive-mcp](https://github.com/piotr-agier/google-drive-mcp)
- [isaacphi/mcp-gdrive](https://github.com/isaacphi/mcp-gdrive)
- [google-auth-library npm](https://www.npmjs.com/package/google-auth-library)
- [googleapis npm](https://www.npmjs.com/package/googleapis)
