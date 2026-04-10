# Dropbox Connector Research

**Issue**: #395
**Date**: 2026-03-25
**Status**: Research complete

---

## 1. Executive Summary

Dropbox is a well-established cloud storage platform with a mature API v2, an official JavaScript SDK (`dropbox` on npm), and both an official remote MCP server (beta, at `mcp.dropbox.com`) and a community Go-based MCP server (`ngs/dropbox-mcp-server`). The connector should use OAuth 2.0 with PKCE (no client secret needed for desktop apps), expose 10-12 tools covering file/folder CRUD, search, sharing, and version history, and use cursor-based pagination for listing large directories. The existing weather connector pattern (tools.ts / api.ts / index.ts / test) maps cleanly, though Dropbox's auth requirement and binary file handling add moderate complexity. Dropbox Paper docs have been deprecated (mobile/desktop apps retired October 2025) and should be accessed via `/files/export` rather than the legacy `/paper` endpoints.

---

## 2. API Overview

### Dropbox API v2 (current)

Base URL: `https://api.dropboxapi.com/2/` (RPC endpoints) and `https://content.dropboxapi.com/2/` (content upload/download endpoints).

**Core namespaces:**

| Namespace | Key Endpoints | Notes |
|-----------|--------------|-------|
| Files | `list_folder`, `list_folder/continue`, `get_metadata`, `download`, `upload`, `upload_session/*`, `delete_v2`, `move_v2`, `copy_v2`, `create_folder_v2`, `search_v2`, `search/continue_v2`, `export` | Primary namespace; cursor-based listing |
| Sharing | `create_shared_link_with_settings`, `list_shared_links`, `modify_shared_link_settings`, `add_folder_member`, `list_folder_members` | Shared links + folder sharing |
| Users | `get_current_account`, `get_space_usage` | Account info and quota |

### Cursor-Based Listing

Dropbox uses cursor-based pagination for directory listing:

1. Call `/files/list_folder` with `path` -- returns entries + `cursor` + `has_more`
2. If `has_more` is true, call `/files/list_folder/continue` with the cursor
3. Repeat until `has_more` is false
4. Cursors can be reused with `/files/list_folder/longpoll` for real-time change detection

### Content Hash

Every file metadata includes a `content_hash` (SHA-256 based, computed in 4MB blocks). This allows change detection without downloading files -- compare local hash to remote hash. Useful for caching and sync scenarios.

### Search v2

`/files/search_v2` supports:
- Full-text search across file names and contents
- Filtering by file extension or category (image, document, video, etc.)
- Cursor-based pagination via `/files/search/continue_v2`
- Maximum 10,000 matches per search session
- Highlighting of matched terms

### Chunked Uploads

- Files under 150MB: use `/files/upload` directly
- Files over 150MB: use upload sessions:
  1. `/files/upload_session/start` -- initiate session (send no data here for reliability)
  2. `/files/upload_session/append_v2` -- send chunks (recommended: 4MB multiples, practical: ~12MB chunks)
  3. `/files/upload_session/finish` -- complete upload with commit info
- Upload sessions expire after 7 days
- Batch variants (`start_batch`, `finish_batch`) available for parallel multi-file uploads

### Paper (Deprecated)

- Dropbox Paper mobile/desktop apps retired October 2025
- Legacy `/paper` endpoints deprecated
- Paper docs accessible via `/files/export` endpoint
- No need to build Paper-specific tools; file export covers this

### Rate Limits

- **Not published as specific numbers** -- Dropbox intentionally does not document exact limits
- Per-user rate limiting (not per-app)
- HTTP 429 response with `Retry-After` header when throttled
- Separate throttling for write operations (`too_many_write_operations` reason code)
- Best practice: exponential backoff with jitter, respect `Retry-After` header
- Data transport limits apply to upload session chunk sizes (avoid unnecessarily small chunks)

---

## 3. Authentication

### OAuth 2.0 with PKCE (Recommended for Desktop Apps)

The PKCE (Proof Key for Code Exchange) flow is the recommended approach for desktop and mobile apps because it does not require embedding a client secret.

**Flow:**

1. Generate `code_verifier` (random 43-128 character string) and `code_challenge` (SHA-256 hash, base64url-encoded)
2. Open browser to `https://www.dropbox.com/oauth2/authorize` with:
   - `client_id` (app key)
   - `response_type=code`
   - `code_challenge` and `code_challenge_method=S256`
   - `token_access_type=offline` (to get refresh token)
   - `redirect_uri` (deep link back to app)
3. User authorizes, Dropbox redirects with `code`
4. Exchange `code` + `code_verifier` at `https://api.dropboxapi.com/oauth2/token` for:
   - Short-lived access token (~4 hours)
   - Long-lived refresh token (does not expire)
5. When access token expires, refresh using `grant_type=refresh_token` + `client_id` (no secret needed with PKCE)

### App Permissions (Scopes)

Dropbox uses app-level permission configuration (set in App Console), not per-request scopes:

| Permission | Access |
|-----------|--------|
| `files.metadata.read` | Read file/folder metadata |
| `files.metadata.write` | Create/move/delete files and folders |
| `files.content.read` | Download file content |
| `files.content.write` | Upload file content |
| `sharing.read` | Read shared links and folder membership |
| `sharing.write` | Create/modify shared links and folder sharing |
| `account_info.read` | Read user account info |

**Recommended permissions for our connector**: All of the above for full functionality.

### Token Storage

- Store refresh token securely (Tauri's secure storage / OS keychain)
- Access tokens are ephemeral; refresh on 401 or proactively before expiry
- Never store access tokens persistently

### Implementation Recommendation

Use PKCE-only OAuth flow:
1. Register a Dropbox App at https://www.dropbox.com/developers/apps with "Full Dropbox" access
2. Configure app permissions in the App Console
3. Implement PKCE flow with Tauri deep link callback (`tauri://` scheme)
4. Auto-refresh tokens on 401 responses
5. Set `requiresAuth: true` in ConnectorDefinition

---

## 4. Existing MCP Server Implementations

### Official: Dropbox Remote MCP Server (Beta)

- **URL**: `https://mcp.dropbox.com/mcp` (general) and `https://mcp.dropbox.com/dash` (Dash)
- **Status**: Beta, maintained by Dropbox
- **Architecture**: Remote/hosted MCP server using Dropbox OAuth
- **Capabilities**: Read-focused; write operations (upload, create, delete) appear to be limited or in development
- **Limitation**: Being a remote server, it cannot be used as an in-process connector. However, it validates the tool design patterns.

### Community: `ngs/dropbox-mcp-server` (Go)

- **Repo**: https://github.com/ngs/dropbox-mcp-server
- **Status**: Active, well-structured
- **Features**:
  - OAuth 2.0 authentication (browser-based flow)
  - File operations: list, search, download, upload, move, copy, delete
  - Folder management: create, navigate
  - Sharing: create, list, revoke shared links
  - Version control: view revision history, restore previous versions
  - Large file support: automatic chunked upload for files over 150MB
- **Architecture**: Go binary with internal packages for auth, config, Dropbox API client, and MCP tool handlers
- **Relevance**: Excellent reference for tool naming and parameter design, though we will rewrite in TypeScript using our connector pattern

### Community: `amgadabdelhafez/dbx-mcp-server`

- **Repo**: https://github.com/amgadabdelhafez/dbx-mcp-server
- **Status**: Active
- **Features**: File operations and folder management

### Composio / n8n / Zapier / Pipedream

Multiple integration platforms offer Dropbox MCP servers with varying tool sets (typically 11+ operations). These are hosted/managed solutions, not suitable for in-process use but useful for tool design reference.

### Design Decision

We should **not** depend on any existing MCP server. Instead:
1. Use the official `dropbox` npm SDK for API calls in `api.ts`
2. Define tools using `@anthropic-ai/claude-agent-sdk`'s `tool()` function
3. Study `ngs/dropbox-mcp-server` for tool naming conventions and parameter design
4. Reference the official remote MCP server's tool patterns where available

---

## 5. Official JavaScript SDK

### `dropbox` (npm)

- **npm**: https://www.npmjs.com/package/dropbox
- **GitHub**: https://github.com/dropbox/dropbox-sdk-js
- **Docs**: https://dropbox.github.io/dropbox-sdk-js/
- **Version**: 10.34.0 (latest)
- **License**: MIT

**Key characteristics:**
- Lightweight, promise-based interface
- Works in Node.js and browser environments
- Full TypeScript type definitions included
- Covers all API v2 endpoints
- Built-in auth helpers (OAuth flow, token refresh)

**Usage:**

```typescript
import { Dropbox } from 'dropbox';

// Initialize with access token
const dbx = new Dropbox({ accessToken: 'ACCESS_TOKEN' });

// List folder
const result = await dbx.filesListFolder({ path: '' }); // '' = root
for (const entry of result.result.entries) {
  console.log(entry.name, entry['.tag']); // 'file' or 'folder'
}

// Continue listing if has_more
if (result.result.has_more) {
  const more = await dbx.filesListFolderContinue({ cursor: result.result.cursor });
}

// Download file
const download = await dbx.filesDownload({ path: '/path/to/file.txt' });

// Upload file (small files)
await dbx.filesUpload({ path: '/path/to/file.txt', contents: buffer });

// Search
const search = await dbx.filesSearchV2({ query: 'quarterly report' });

// Sharing
const link = await dbx.sharingCreateSharedLinkWithSettings({ path: '/path/to/file.pdf' });

// Account info
const account = await dbx.usersGetCurrentAccount();
const space = await dbx.usersGetSpaceUsage();
```

**Auth with PKCE:**

```typescript
import { Dropbox, DropboxAuth } from 'dropbox';

const dbxAuth = new DropboxAuth({
  clientId: 'APP_KEY',
});

// Generate auth URL with PKCE
const authUrl = await dbxAuth.getAuthenticationUrl(
  'tauri://oauth/dropbox',  // redirect URI
  undefined,                 // state
  'code',                   // response type
  'offline',                // token access type (for refresh token)
  undefined,                // scope (use app-level permissions)
  undefined,                // include granted scopes
  true                      // use PKCE
);

// After redirect, exchange code
const codeVerifier = dbxAuth.getCodeVerifier();
dbxAuth.setCodeVerifier(codeVerifier);
const tokenResult = await dbxAuth.getAccessTokenFromCode('tauri://oauth/dropbox', authCode);

// Create authenticated client
const dbx = new Dropbox({ auth: dbxAuth });
```

**Recommendation**: Use the official `dropbox` SDK. It provides full TypeScript types, handles auth flows (including PKCE), and covers all endpoints. No need for raw fetch calls.

---

## 6. Proposed Tool Definitions

Based on analysis of existing MCP implementations and the weather connector pattern:

### Core Tools (Phase 1)

| Tool Name | Description | Read/Write | Annotations |
|-----------|-------------|------------|-------------|
| `dropbox_list_folder` | List files and folders at a path with pagination | Read | `readOnlyHint: true` |
| `dropbox_get_metadata` | Get metadata for a file or folder (size, modified date, content_hash) | Read | `readOnlyHint: true` |
| `dropbox_search` | Search for files by name or content | Read | `readOnlyHint: true` |
| `dropbox_download` | Download a file's content (text files returned inline, binary as base64) | Read | `readOnlyHint: true` |
| `dropbox_upload` | Upload a file (text content or base64-encoded binary) | Write | `readOnlyHint: false` |
| `dropbox_create_folder` | Create a new folder | Write | `readOnlyHint: false` |
| `dropbox_delete` | Delete a file or folder | Write | `destructiveHint: true` |
| `dropbox_move` | Move a file or folder to a new location | Write | `readOnlyHint: false` |
| `dropbox_get_shared_link` | Create or get a shared link for a file/folder | Read/Write | `readOnlyHint: false` |
| `dropbox_account_info` | Get current account info and space usage | Read | `readOnlyHint: true` |

### Extended Tools (Phase 2)

| Tool Name | Description |
|-----------|-------------|
| `dropbox_copy` | Copy a file or folder |
| `dropbox_list_shared_links` | List all shared links for a path or user |
| `dropbox_revoke_shared_link` | Revoke a shared link |
| `dropbox_get_revisions` | List revision history for a file |
| `dropbox_restore_revision` | Restore a file to a previous revision |
| `dropbox_export` | Export Paper docs or other special files |

### Tool Parameter Design

```typescript
// Example: dropbox_list_folder
{
  path: z.string().default('').describe('Folder path (empty string for root, e.g. "/Documents")'),
  recursive: z.boolean().optional().default(false).describe('List all subfolders recursively'),
  limit: z.number().min(1).max(2000).optional().default(100).describe('Max entries to return'),
  include_deleted: z.boolean().optional().default(false).describe('Include deleted entries'),
}

// Example: dropbox_search
{
  query: z.string().describe('Search query string'),
  path: z.string().optional().describe('Folder to search within (empty for entire Dropbox)'),
  file_extensions: z.array(z.string()).optional().describe('Filter by extensions, e.g. ["pdf", "docx"]'),
  file_categories: z.array(z.string()).optional().describe('Filter by category: image, document, video, audio, other'),
  max_results: z.number().min(1).max(100).optional().default(25).describe('Maximum results to return'),
}

// Example: dropbox_upload
{
  path: z.string().describe('Destination path including filename, e.g. "/Documents/report.txt"'),
  content: z.string().describe('File content (text) or base64-encoded binary data'),
  mode: z.enum(['add', 'overwrite']).optional().default('add').describe('Write mode: "add" fails if exists, "overwrite" replaces'),
  autorename: z.boolean().optional().default(false).describe('Auto-rename if conflict instead of failing'),
}

// Example: dropbox_download
{
  path: z.string().describe('File path to download, e.g. "/Documents/report.pdf"'),
  text_only: z.boolean().optional().default(true).describe('If true, return text content only (errors on binary). If false, return base64.'),
}
```

### Binary File Handling

Unlike the weather connector, Dropbox deals with binary files. Strategy:
- **Text files** (`.txt`, `.md`, `.csv`, `.json`, etc.): Return content as plain text
- **Binary files** (`.pdf`, `.docx`, `.png`, etc.): Return base64-encoded content with MIME type
- **Large files**: Return metadata only with a note that the file is too large to inline (threshold: ~1MB for text, ~500KB for binary to stay within MCP message limits)
- Upload: Accept text content or base64-encoded data

---

## 7. Edge Cases and Best Practices

### Path Conventions
- Root is `""` (empty string) or `"/"` -- Dropbox API uses `""` for root in most endpoints
- Paths are lowercase in the API (case-insensitive matching, case-preserving display)
- Special characters in filenames are URL-encoded in paths
- Tool descriptions should document the path format clearly

### Large Directory Listing
- Always implement cursor-based pagination
- Default to a reasonable page size (100 entries)
- For the LLM use case, consider truncating very large listings with a summary ("showing 100 of 5,432 items")
- Provide `recursive` option but warn about performance on deeply nested trees

### Content Hash for Caching
- Cache file metadata including `content_hash`
- Before downloading, check if cached hash matches current hash
- This avoids re-downloading unchanged files -- important for repeated tool calls

### Conflict Resolution
- `WriteMode.add`: Fails with conflict error if file exists (safe default)
- `WriteMode.overwrite`: Replaces regardless (use for explicit updates)
- `autorename`: Dropbox appends " (1)", " (2)" etc. to avoid conflicts
- Tool descriptions should explain these modes clearly

### Shared Link Visibility
- Default: publicly accessible
- Can be restricted to team members or password-protected
- Expiration dates can be set
- Always communicate the link's visibility to the user

### Error Handling
- 400: Bad request (malformed path, invalid parameters)
- 401: Invalid/expired token -- trigger token refresh, retry once
- 403: Insufficient permissions or shared folder access denied
- 404 / `path/not_found`: File/folder does not exist
- 409: Conflict (file exists in `add` mode, folder not empty for delete)
- 429: Rate limited -- respect `Retry-After`, exponential backoff with jitter
- 5xx: Dropbox service issues -- return user-friendly error

### Upload Size Considerations for MCP
- MCP messages have practical size limits
- For uploads via tool calls, limit to reasonable sizes (~10MB text, ~5MB base64)
- For larger files, the connector could accept a local file path (desktop app advantage)
- Document size limitations in tool descriptions

---

## 8. Alternatives Comparison: Dropbox vs Google Drive vs Unified "Cloud Storage"

### Feature Comparison

| Feature | Dropbox | Google Drive | OneDrive |
|---------|---------|-------------|----------|
| **API maturity** | Excellent (v2, stable since 2016) | Excellent (v3) | Good (Graph API) |
| **JS/TS SDK** | Official (`dropbox` npm, MIT) | Official (`googleapis` npm) | `@microsoft/microsoft-graph-client` |
| **OAuth complexity** | Low (PKCE, no secret for desktop) | Medium (requires client secret or service account) | High (Azure AD) |
| **MCP implementations** | Official remote + community Go | Multiple community implementations | Few |
| **File versioning** | Yes (revision history) | Yes (revision history) | Yes |
| **Real-time sync** | Longpoll endpoint | Changes API with push notifications | Delta query |
| **Search quality** | Good (full-text, filters) | Excellent (full-text, Google-quality search) | Good |
| **Content hash** | Yes (built-in metadata) | Yes (md5Checksum) | Yes (SHA-1) |
| **Chunked uploads** | Yes (session-based) | Yes (resumable uploads) | Yes (resumable) |
| **Rate limits** | Undisclosed, per-user | 20,000 queries/100s per project | Graph API throttling |
| **Free tier** | 2GB storage | 15GB storage | 5GB storage |
| **Paper/Docs** | Deprecated (use file export) | Google Docs/Sheets/Slides (rich API) | Office Online |

### Should This Be a Separate Connector or Unified "Cloud Storage"?

**Recommendation: Separate connectors, shared abstractions.**

**Reasons for separate connectors:**
1. **Auth flows differ significantly** -- Dropbox PKCE vs Google OAuth with client secret vs Azure AD
2. **API semantics differ** -- path-based (Dropbox) vs ID-based (Google Drive) vs hybrid (OneDrive)
3. **Unique features** -- Dropbox content_hash, Google Docs export formats, OneDrive delta queries
4. **Independent enablement** -- users should be able to connect just Dropbox without Google, or vice versa
5. **Testing isolation** -- each connector's mocks and tests are self-contained

**Shared abstractions (internal, not user-facing):**
- Common `CloudStorageFile` interface for normalized file metadata
- Shared utility functions for binary content handling, path normalization
- Common patterns for cursor-based pagination
- Shared OAuth token refresh logic

```typescript
// Potential shared types (not a public interface, just internal helpers)
interface CloudStorageFile {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  size: number;
  modifiedAt: string;
  hash?: string;
  provider: 'dropbox' | 'google-drive' | 'onedrive';
}
```

This keeps each connector as an independent `ConnectorDefinition` while reducing internal code duplication if/when Google Drive (#394) or other storage connectors are built.

---

## 9. Testing Strategy

Following the existing weather connector test pattern (`bun:test`, mock SDK methods):

### Unit Tests (`dropbox.test.ts`)

```
describe('Dropbox API')
  describe('listFolder')
    - returns formatted file/folder list
    - handles empty folder
    - paginates with cursor when has_more is true
    - handles path not found (404)
    - handles rate limiting (429 with Retry-After)

  describe('search')
    - searches by query string
    - filters by file extension
    - filters by category
    - paginates results
    - handles empty results

  describe('download')
    - downloads text file content
    - downloads binary file as base64
    - rejects files over size threshold
    - handles file not found

  describe('upload')
    - uploads text content
    - uploads base64 binary content
    - handles conflict in add mode
    - handles overwrite mode
    - handles rate limiting

  describe('createFolder')
    - creates folder at path
    - handles folder already exists

  describe('delete')
    - deletes file
    - deletes folder
    - handles path not found

  describe('move')
    - moves file to new path
    - moves folder to new path
    - handles source not found
    - handles destination conflict

  describe('sharing')
    - creates shared link
    - gets existing shared link
    - handles path not found

  describe('accountInfo')
    - returns account info and space usage
```

### Mock Strategy

Mock the `Dropbox` class from the `dropbox` SDK at the method level:

```typescript
import { mock } from 'bun:test';

const mockDbx = {
  filesListFolder: mock(() => Promise.resolve({
    result: {
      entries: [
        { '.tag': 'file', name: 'doc.txt', path_lower: '/doc.txt', size: 1024, content_hash: 'abc123' },
        { '.tag': 'folder', name: 'Photos', path_lower: '/photos' },
      ],
      cursor: 'cursor_abc',
      has_more: false,
    }
  })),
  filesSearchV2: mock(() => Promise.resolve({ /* ... */ })),
  // etc.
};
```

### Auth Tests

```typescript
describe('Dropbox Auth')
  - generates PKCE auth URL with correct parameters
  - exchanges code for tokens
  - refreshes expired access token
  - handles refresh token revocation
```

### Integration Test (Manual / CI with Test App)

Dropbox allows creating "Development" apps with a single test user:
1. Create a test app at https://www.dropbox.com/developers/apps
2. Use the generated access token for manual integration tests
3. CI can use a stored test token (with limited permissions) for smoke tests

---

## 10. Implementation Plan

### File Structure

```
apps/server/src/connectors/dropbox/
  index.ts           -- ConnectorDefinition export
  api.ts             -- Dropbox SDK wrapper (auth, error normalization, pagination helpers)
  tools.ts           -- Tool definitions using SDK tool() function
  auth.ts            -- PKCE OAuth flow helpers (generate verifier, exchange, refresh)
  dropbox.test.ts    -- Tests with mocked SDK
```

### Phase 1 (MVP -- Read-Only)

1. Add `dropbox` npm dependency (official SDK)
2. Implement `auth.ts` with PKCE flow helpers and token refresh
3. Implement `api.ts` with wrapper functions:
   - `listFolder(path, recursive, limit)` -- with cursor pagination
   - `getMetadata(path)`
   - `searchFiles(query, options)`
   - `downloadFile(path)` -- with text/binary detection
   - `getAccountInfo()`
4. Implement 5 read-only tools in `tools.ts`
5. Register connector in `apps/server/src/connectors/index.ts`
6. Write tests for all tools and API functions
7. Add `'storage'` to `ConnectorCategory` type (or use `'productivity'`)

### Phase 2 (Write Operations)

1. Implement write API functions:
   - `uploadFile(path, content, mode)`
   - `createFolder(path)`
   - `deleteItem(path)`
   - `moveItem(fromPath, toPath)`
2. Implement `getOrCreateSharedLink(path)`
3. Add 5 write tools
4. Add chunked upload support for large files
5. Write tests for write operations

### Phase 3 (Extended Features)

1. Copy, revisions, restore tools
2. List/revoke shared links
3. Export Paper docs
4. Real-time change detection via longpoll (optional)
5. Local file path upload support (Tauri IPC advantage)

### ConnectorDefinition

```typescript
export const dropboxConnector: ConnectorDefinition = {
  name: 'dropbox',
  displayName: 'Dropbox',
  description: 'Browse, search, upload, and share files in your Dropbox. Supports file versioning and shared links.',
  icon: '📦',
  category: 'productivity', // or add 'storage' category
  requiresAuth: true,
  tools: dropboxTools,
};
```

### Estimated Effort

- Phase 1 (read-only): ~6-8 hours (OAuth PKCE adds complexity vs weather connector)
- Phase 2 (write ops): ~4-6 hours
- Phase 3 (extended): ~4-6 hours

### Dependencies

- `dropbox` (official SDK, ~10.34.0, MIT license)
- No other new dependencies needed

---

## Sources

- [Dropbox API v2 HTTP Documentation](https://www.dropbox.com/developers/documentation/http/documentation)
- [Dropbox OAuth Guide](https://developers.dropbox.com/oauth-guide)
- [Using OAuth 2.0 with Offline Access](https://dropbox.tech/developers/using-oauth-2-0-with-offline-access)
- [DBX Performance Guide](https://developers.dropbox.com/dbx-performance-guide)
- [DBX File Access Guide](https://developers.dropbox.com/dbx-file-access-guide)
- [DBX Sharing Guide](https://developers.dropbox.com/dbx-sharing-guide)
- [Dropbox Error Handling Guide](https://developers.dropbox.com/error-handling-guide)
- [Search Files Using the Dropbox API](https://dropbox.tech/developers/search-files-using-the-dropbox-api)
- [Dropbox JavaScript SDK (GitHub)](https://github.com/dropbox/dropbox-sdk-js)
- [Dropbox SDK JS API Docs](https://dropbox.github.io/dropbox-sdk-js/Dropbox.html)
- [dropbox npm package](https://www.npmjs.com/package/dropbox)
- [ngs/dropbox-mcp-server (Go)](https://github.com/ngs/dropbox-mcp-server)
- [amgadabdelhafez/dbx-mcp-server](https://github.com/amgadabdelhafez/dbx-mcp-server)
- [Dropbox Official Remote MCP Server](https://help.dropbox.com/integrations/connect-dropbox-mcp-server)
- [Dropbox Dash MCP Server](https://help.dropbox.com/integrations/set-up-MCP-server)
- [Dropbox Data Transport Limits](https://www.dropbox.com/developers/reference/data-transport-limit)
- [Dropbox API Rate Limits (Community)](https://www.dropboxforum.com/t5/Dropbox-API-Support-Feedback/Dropbox-API-rate-limits/td-p/183714)
- [Dropbox Paper End of Life](https://directionforward.com/news/2025/end-of-life-for-dropbox-paper-apps)
- [Dropbox API Explorer](https://dropbox.github.io/dropbox-api-v2-explorer/)
