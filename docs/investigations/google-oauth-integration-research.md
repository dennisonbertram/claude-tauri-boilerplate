# Google OAuth 2.0 Integration Research for Tauri Desktop App

> **Date:** 2026-03-23
> **Stack:** Tauri (Rust backend) + React frontend + Hono/Bun server
> **Goal:** Native OAuth integrations for Sign-in, Gmail, Calendar, Drive, and Docs

---

## Table of Contents

1. [Google Cloud Console Setup](#1-google-cloud-console-setup)
2. [OAuth Flow for Desktop Apps](#2-oauth-flow-for-desktop-apps)
3. [Gmail API](#3-gmail-api)
4. [Google Calendar API](#4-google-calendar-api)
5. [Google Drive API](#5-google-drive-api)
6. [Google Docs API](#6-google-docs-api)
7. [Security Considerations](#7-security-considerations)
8. [Libraries & SDKs](#8-libraries--sdks)
9. [Recommended Architecture](#9-recommended-architecture-for-tauri--honobun)
10. [Implementation Checklist](#10-implementation-checklist)

---

## 1. Google Cloud Console Setup

**Reference:** [Using OAuth 2.0 to Access Google APIs](https://developers.google.com/identity/protocols/oauth2)

### 1.1 Create a Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Note the **Project Number** and **Project ID**

### 1.2 Enable Required APIs

Enable these APIs in **APIs & Services > Library**:

| API | Purpose |
|-----|---------|
| **Google Identity / People API** | Sign in with Google, user profile |
| **Gmail API** | Read/write emails |
| **Google Calendar API** | Read/write calendar events |
| **Google Drive API** | Read/write files and folders |
| **Google Docs API** | Read/write document content |

### 1.3 OAuth Credential Type: Desktop App

**Reference:** [OAuth 2.0 for Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app)

For a Tauri desktop application, create **Desktop application** credentials:

1. Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**
2. Application type: **Desktop app**
3. This gives you a `client_id` and `client_secret`

**Important:** Desktop apps are considered "public clients" -- the `client_secret` is embedded in the distributed app and cannot be kept truly secret. Google still issues one, and it must be included in token exchange requests, but it does NOT provide real security. PKCE is what secures the flow.

### 1.4 Configure the Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. Choose **External** user type (unless using Google Workspace)
3. Fill in app name, support email, developer contact
4. Add all required scopes (see sections below)
5. Add test users during development (before verification)

**Verification requirement:** Apps requesting restricted scopes (Gmail read, Drive full access) must undergo Google's verification process before going to production. During development, the app works for up to 100 test users added in the console.

### 1.5 All Required OAuth Scopes (Combined)

```
# Authentication (Sign in with Google)
openid
email
profile

# Gmail (read + write)
https://www.googleapis.com/auth/gmail.modify

# Calendar (read + write events)
https://www.googleapis.com/auth/calendar.events

# Drive (read + write files)
https://www.googleapis.com/auth/drive.file

# Docs (read + write documents)
https://www.googleapis.com/auth/documents
```

This is the **minimal recommended set**. See each API section below for alternatives.

---

## 2. OAuth Flow for Desktop Apps

**Reference:** [OAuth 2.0 for iOS & Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app)

### 2.1 Flow Overview (Authorization Code + PKCE)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Tauri App   │     │   Browser    │     │  Google Auth  │
│  (Rust/JS)   │     │  (System)    │     │   Server     │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ 1. Generate PKCE   │                    │
       │    code_verifier   │                    │
       │    + code_challenge │                    │
       │                    │                    │
       │ 2. Start localhost │                    │
       │    server on       │                    │
       │    random port     │                    │
       │                    │                    │
       │ 3. Open system ────┼───────────────────>│
       │    browser with    │ Authorization URL  │
       │    auth URL        │                    │
       │                    │                    │
       │                    │ 4. User signs in   │
       │                    │    and consents    │
       │                    │                    │
       │ 5. Redirect to  <─┼────────────────────│
       │    localhost with  │  ?code=AUTH_CODE   │
       │    auth code       │                    │
       │                    │                    │
       │ 6. Exchange code ──┼───────────────────>│
       │    + code_verifier │  Token endpoint    │
       │                    │                    │
       │ 7. Receive tokens <┼────────────────────│
       │    (access_token,  │                    │
       │     refresh_token) │                    │
       └──────────────────────────────────────────
```

### 2.2 Step-by-Step Details

#### Step 1: Generate PKCE Code Verifier & Challenge

```typescript
// Generate code_verifier: 43-128 chars from [A-Za-z0-9-._~]
import crypto from 'crypto';

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
  // Produces 43 chars of URL-safe base64
}

function generateCodeChallenge(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

const codeVerifier = generateCodeVerifier();
const codeChallenge = generateCodeChallenge(codeVerifier);
```

#### Step 2: Build Authorization URL

```typescript
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', `http://127.0.0.1:${port}`);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
].join(' '));
authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');
authUrl.searchParams.set('access_type', 'offline');     // Request refresh_token
authUrl.searchParams.set('prompt', 'consent');           // Force consent to get refresh_token
authUrl.searchParams.set('state', crypto.randomBytes(16).toString('hex')); // CSRF protection
```

**Key parameters:**
- `access_type=offline` -- ensures a `refresh_token` is returned
- `prompt=consent` -- forces consent screen even for returning users (guarantees refresh_token)
- `code_challenge_method=S256` -- Google recommends SHA256 over plain

#### Step 3: Handle the Redirect (Three Options for Tauri)

##### Option A: Loopback/Localhost Server (Recommended for Google)

**Reference:** [tauri-plugin-oauth](https://github.com/FabianLars/tauri-plugin-oauth)

Google explicitly supports `http://127.0.0.1:<port>` as a redirect URI for desktop apps. No need to pre-register the port -- Google allows any port on loopback.

```rust
// Cargo.toml
// tauri-plugin-oauth = "2"

// In Tauri Rust backend:
use tauri_plugin_oauth::start;

// Start temporary localhost server, returns the port
let port = start(move |url| {
    // url contains the full redirect with ?code=...&state=...
    // Parse and handle the authorization code
}).await?;
```

**Pros:**
- Google officially supports and recommends this for desktop apps
- No custom URI scheme registration needed
- Works cross-platform (macOS, Windows, Linux)
- `tauri-plugin-oauth` handles server lifecycle automatically

**Cons:**
- Briefly opens a port on localhost (security reviewed -- only accepts the one redirect)
- Firewall software could theoretically block it

##### Option B: Deep Links (`tauri-plugin-deep-link`)

**Reference:** [Tauri Deep Linking Plugin](https://v2.tauri.app/plugin/deep-linking/)

Google does NOT directly support custom URI schemes (like `myapp://callback`) as redirect URIs. However, you can work around this:

1. Set redirect_uri to a web page you control (e.g., `https://yourapp.com/auth/callback`)
2. That page extracts the auth code and triggers a deep link: `myapp://auth?code=...`
3. Tauri catches the deep link

**Pros:**
- No localhost server needed
- Works even if localhost is blocked

**Cons:**
- Requires a hosted web page as intermediary
- More complex setup
- Custom URI scheme registration per platform

##### Option C: Manual Copy-Paste (Fallback)

Google supports `urn:ietf:wg:oauth:2.0:oob` which displays the auth code in the browser for the user to manually copy. **Note: This is deprecated by Google and should only be used as a last resort.**

**Recommendation:** Use **Option A (loopback)** with `tauri-plugin-oauth`. It's what Google recommends for desktop apps and has the simplest implementation.

#### Step 4: Exchange Authorization Code for Tokens

```typescript
// POST https://oauth2.googleapis.com/token
const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET, // Required even for desktop apps
    code: authorizationCode,
    code_verifier: codeVerifier,  // PKCE verification
    grant_type: 'authorization_code',
    redirect_uri: `http://127.0.0.1:${port}`,
  }),
});

const tokens = await tokenResponse.json();
// {
//   access_token: "ya29.a0...",
//   expires_in: 3600,           // 1 hour
//   refresh_token: "1//0e...",  // Only on first auth or with prompt=consent
//   scope: "openid email profile https://...",
//   token_type: "Bearer",
//   id_token: "eyJhbGci..."    // JWT with user info (if openid scope)
// }
```

#### Step 5: Refresh Access Token

```typescript
// POST https://oauth2.googleapis.com/token
const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: storedRefreshToken,
    grant_type: 'refresh_token',
  }),
});

const newTokens = await refreshResponse.json();
// { access_token: "ya29.a0...", expires_in: 3600, token_type: "Bearer", scope: "..." }
// NOTE: refresh_token is NOT returned on refresh -- keep the original
```

#### Step 6: Revoke Tokens

```typescript
// Revoke access (user signs out or disconnects)
await fetch(`https://oauth2.googleapis.com/revoke?token=${refreshToken}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
});
// Returns 200 on success, 400 on error
// Revoking refresh_token also revokes associated access_tokens
```

---

## 3. Gmail API

**Reference:** [Gmail API Scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) | [Gmail API Quotas](https://developers.google.com/workspace/gmail/api/reference/quota)

### 3.1 OAuth Scopes

| Scope | Description | Sensitivity | Use Case |
|-------|-------------|-------------|----------|
| `https://www.googleapis.com/auth/gmail.readonly` | View email messages and settings | **Restricted** | Read-only access |
| `https://www.googleapis.com/auth/gmail.send` | Send email on behalf of user | Sensitive | Send only, no read |
| `https://www.googleapis.com/auth/gmail.compose` | Manage drafts and send emails | **Restricted** | Draft + send |
| `https://www.googleapis.com/auth/gmail.modify` | Read, compose, send emails | **Restricted** | Full read + write (no delete) |
| `https://mail.google.com/` | Full access including permanent delete | **Restricted** | Everything |
| `https://www.googleapis.com/auth/gmail.labels` | See and edit email labels | Non-sensitive | Label management only |
| `https://www.googleapis.com/auth/gmail.metadata` | View metadata (labels, headers) | **Restricted** | Headers only, no body |

**Recommendation:** Use `gmail.modify` for read + write without permanent delete capability. If you only need to send, use `gmail.send` (sensitive, not restricted -- easier verification).

### 3.2 Key API Endpoints

**Base URL:** `https://gmail.googleapis.com/gmail/v1/users/me`

```
# List messages
GET /messages?q={query}&maxResults=10
  - q: Gmail search query (same syntax as Gmail search box)
  - Returns: { messages: [{ id, threadId }], nextPageToken }

# Get a single message
GET /messages/{id}?format=full
  - format: full | metadata | minimal | raw
  - Returns: { id, threadId, labelIds, snippet, payload: { headers, body, parts } }

# Send a message
POST /messages/send
  - Body: { raw: base64url_encoded_rfc2822_message }
  - The "raw" field is a base64url-encoded RFC 2822 email string

# Create a draft
POST /drafts
  - Body: { message: { raw: base64url_encoded_message } }

# Send a draft
POST /drafts/send
  - Body: { id: draft_id }

# Modify message labels
POST /messages/{id}/modify
  - Body: { addLabelIds: ["STARRED"], removeLabelIds: ["UNREAD"] }

# List labels
GET /labels
  - Returns: { labels: [{ id, name, type }] }

# Search with query
GET /messages?q=from:user@example.com+after:2024/01/01+has:attachment
```

### 3.3 Building an RFC 2822 Email Message

```typescript
function buildRawEmail(to: string, from: string, subject: string, body: string): string {
  const message = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    `Content-Type: text/html; charset=utf-8`,
    '',
    body,
  ].join('\r\n');

  // Base64url encode (no padding, URL-safe chars)
  return Buffer.from(message).toString('base64url');
}
```

### 3.4 Rate Limits

| Metric | Limit |
|--------|-------|
| Per-project per minute | 1,200,000 quota units |
| Per-user per minute | 15,000 quota units |

| Method | Quota Units |
|--------|------------|
| `messages.get` | 5 |
| `messages.list` | 5 |
| `messages.send` | 100 |
| `messages.modify` | 5 |
| `messages.delete` | 10 |
| `drafts.send` | 100 |
| `threads.get` | 10 |
| `threads.list` | 10 |
| `labels.list` | 1 |
| `getProfile` | 1 |

**Practical limit:** At 15,000 units/user/min, you can do ~3,000 message reads or ~150 sends per minute per user.

---

## 4. Google Calendar API

**Reference:** [Calendar API Scopes](https://developers.google.com/workspace/calendar/api/auth) | [Calendar Quota Management](https://developers.google.com/workspace/calendar/api/guides/quota)

### 4.1 OAuth Scopes

| Scope | Description | Sensitivity |
|-------|-------------|-------------|
| `https://www.googleapis.com/auth/calendar` | Full access to all calendars | High |
| `https://www.googleapis.com/auth/calendar.readonly` | Read-only access to all calendars | Medium |
| `https://www.googleapis.com/auth/calendar.events` | View and edit events on all calendars | High |
| `https://www.googleapis.com/auth/calendar.events.readonly` | View events on all calendars | Medium |
| `https://www.googleapis.com/auth/calendar.events.owned` | CRUD on events you own | High |
| `https://www.googleapis.com/auth/calendar.events.owned.readonly` | View events you own | Medium |
| `https://www.googleapis.com/auth/calendar.freebusy` | View availability only | Low |
| `https://www.googleapis.com/auth/calendar.settings.readonly` | View calendar settings | Low |
| `https://www.googleapis.com/auth/calendar.calendarlist` | Manage calendar subscriptions | High |
| `https://www.googleapis.com/auth/calendar.calendarlist.readonly` | View calendar list | Low |

**Recommendation:** Use `calendar.events` for read+write events across all calendars. Use `calendar.events.owned` if you only need to manage events the user created.

### 4.2 Key API Endpoints

**Base URL:** `https://www.googleapis.com/calendar/v3`

```
# List calendars
GET /users/me/calendarList
  - Returns: { items: [{ id, summary, primary, accessRole }] }

# List events
GET /calendars/{calendarId}/events?timeMin=...&timeMax=...&maxResults=10
  - calendarId: "primary" for main calendar, or specific calendar ID
  - timeMin/timeMax: RFC 3339 format (e.g., 2024-01-01T00:00:00Z)
  - Returns: { items: [{ id, summary, start, end, attendees, ... }] }

# Get single event
GET /calendars/{calendarId}/events/{eventId}

# Create event
POST /calendars/{calendarId}/events
  Body: {
    summary: "Meeting",
    description: "Discuss project",
    start: { dateTime: "2024-03-20T10:00:00-07:00", timeZone: "America/Los_Angeles" },
    end: { dateTime: "2024-03-20T11:00:00-07:00", timeZone: "America/Los_Angeles" },
    attendees: [{ email: "user@example.com" }],
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] }
  }

# Update event
PUT /calendars/{calendarId}/events/{eventId}
  Body: (full event object)

# Patch event (partial update)
PATCH /calendars/{calendarId}/events/{eventId}
  Body: { summary: "Updated Title" }

# Delete event
DELETE /calendars/{calendarId}/events/{eventId}

# Quick add (natural language)
POST /calendars/{calendarId}/events/quickAdd?text=Lunch+with+John+Friday+at+noon
```

### 4.3 Rate Limits

| Metric | Limit |
|--------|-------|
| Per project per minute | ~1,000,000 queries/day (enforced per-minute sliding window) |
| Per project per user | Enforced per-minute sliding window |
| Write operations | More heavily rate-limited than reads |

**Error codes:** `403 usageLimits` or `429 rateLimitExceeded` when exceeded. Use exponential backoff.

---

## 5. Google Drive API

**Reference:** [Drive API Scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) | [Drive API Limits](https://developers.google.com/workspace/drive/api/guides/limits)

### 5.1 OAuth Scopes

| Scope | Description | Sensitivity |
|-------|-------------|-------------|
| `https://www.googleapis.com/auth/drive` | Full access to all Drive files | **Restricted** |
| `https://www.googleapis.com/auth/drive.readonly` | Read-only to all Drive files | **Restricted** |
| `https://www.googleapis.com/auth/drive.file` | Access only files opened/created by app | **Non-sensitive** |
| `https://www.googleapis.com/auth/drive.appdata` | App-specific hidden folder | Non-sensitive |
| `https://www.googleapis.com/auth/drive.metadata` | View/manage file metadata | **Restricted** |
| `https://www.googleapis.com/auth/drive.metadata.readonly` | View file metadata | **Restricted** |

**Recommendation:** Use `drive.file` whenever possible -- it's non-sensitive (no verification required) and gives access to files the user explicitly picks via your app or that your app creates. Only use `drive` (full access) if you need to browse/search all user files.

### 5.2 Key API Endpoints

**Base URL:** `https://www.googleapis.com/drive/v3`

```
# List files
GET /files?q={query}&fields=files(id,name,mimeType,modifiedTime)&pageSize=10
  - q: Search query (e.g., "mimeType='application/vnd.google-apps.document'")
  - Returns: { files: [{ id, name, mimeType, ... }], nextPageToken }

# Search query syntax examples:
#   name contains 'report'
#   mimeType = 'application/vnd.google-apps.document'
#   '1234567' in parents  (files in specific folder)
#   modifiedTime > '2024-01-01T00:00:00'
#   trashed = false

# Get file metadata
GET /files/{fileId}?fields=id,name,mimeType,size,modifiedTime,parents

# Download file content
GET /files/{fileId}?alt=media
  - Returns raw file bytes
  - For Google Docs/Sheets: use export instead

# Export Google Workspace files
GET /files/{fileId}/export?mimeType=application/pdf
  - Supported export types:
  -   Google Docs: application/pdf, text/plain, application/vnd.openxmlformats-officedocument.wordprocessingml.document
  -   Google Sheets: text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  -   Google Slides: application/pdf, application/vnd.openxmlformats-officedocument.presentationml.presentation

# Upload file (simple, <5MB)
POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart
  Content-Type: multipart/related
  Part 1: JSON metadata { name, mimeType, parents }
  Part 2: File content

# Upload file (resumable, for large files)
POST https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable
  - Step 1: Initiate (returns upload URI)
  - Step 2: Upload chunks to the URI

# Create folder
POST /files
  Body: { name: "My Folder", mimeType: "application/vnd.google-apps.folder" }

# Move file to folder
PATCH /files/{fileId}?addParents={folderId}&removeParents={oldParentId}

# Delete file (trash)
PATCH /files/{fileId}
  Body: { trashed: true }
```

### 5.3 Rate Limits

| Metric | Limit |
|--------|-------|
| Queries per 60 seconds (project) | 12,000 |
| Queries per 60 seconds (per user) | 12,000 |
| Write requests | Max 3/second sustained per account |
| Daily upload cap | 750 GB per user |
| Max file size (upload) | 5 TB |
| Max file size (copy) | 750 GB |

**Error codes:** `403 User rate limit exceeded`, `429 Too many requests`. No daily request limit if you stay within per-minute quotas.

---

## 6. Google Docs API

**Reference:** [Docs API Scopes](https://developers.google.com/workspace/docs/api/auth)

### 6.1 OAuth Scopes

| Scope | Description | Sensitivity |
|-------|-------------|-------------|
| `https://www.googleapis.com/auth/documents` | Full read/write to all Docs | Sensitive |
| `https://www.googleapis.com/auth/documents.readonly` | Read-only to all Docs | Sensitive |
| `https://www.googleapis.com/auth/drive.file` | Access docs opened/created by app | **Non-sensitive** |
| `https://www.googleapis.com/auth/drive` | Full Drive access (includes Docs) | **Restricted** |

**Recommendation:** Use `documents` for read/write. If you also use Drive, `drive.file` covers Docs created by your app.

### 6.2 Key API Endpoints

**Base URL:** `https://docs.googleapis.com/v1`

```
# Create a new document
POST /documents
  Body: { title: "My Document" }
  Returns: { documentId, title, body, ... }

# Get document content
GET /documents/{documentId}
  Returns: Full document structure including:
  - body.content: Array of structural elements (paragraphs, tables, etc.)
  - Each paragraph contains elements with textRun.content

# Batch update (the primary editing mechanism)
POST /documents/{documentId}:batchUpdate
  Body: {
    requests: [
      {
        insertText: {
          location: { index: 1 },  // 1-based index in document body
          text: "Hello, World!\n"
        }
      },
      {
        updateTextStyle: {
          range: { startIndex: 1, endIndex: 14 },
          textStyle: { bold: true, fontSize: { magnitude: 18, unit: "PT" } },
          fields: "bold,fontSize"
        }
      }
    ]
  }
```

### 6.3 Batch Update Request Types

The Docs API uses a **batch update model** -- all edits are expressed as requests in a `batchUpdate` call:

| Request Type | Purpose |
|-------------|---------|
| `insertText` | Insert text at a location |
| `deleteContentRange` | Delete content in a range |
| `insertTable` | Insert a table |
| `insertInlineImage` | Insert an image |
| `updateTextStyle` | Bold, italic, font, color, etc. |
| `updateParagraphStyle` | Alignment, spacing, headings |
| `replaceAllText` | Find and replace |
| `createNamedRange` | Create a bookmark |
| `insertPageBreak` | Insert page break |
| `createHeader` / `createFooter` | Document headers/footers |

**Important pattern:** When making multiple edits, process requests in **reverse index order** (highest index first) to avoid index shifting issues.

### 6.4 Rate Limits

Google Docs API shares Drive quota infrastructure:
- Read requests: 300 per minute per user (default)
- Write requests: 60 per minute per user (default)
- These can be increased via Google Cloud Console quota management

---

## 7. Security Considerations

### 7.1 Token Storage

**Desktop apps must store tokens securely.** Options:

| Platform | Recommended Storage |
|----------|-------------------|
| macOS | Keychain (via `security` CLI or `keytar` npm) |
| Windows | Credential Manager (via `keytar`) |
| Linux | Secret Service / libsecret (via `keytar`) |
| Cross-platform (Tauri) | `tauri-plugin-store` with encryption, or OS keychain |

**In a Tauri app:**
- **Best:** Use Tauri's Rust backend to interact with the OS keychain directly (e.g., `keyring` crate)
- **Good:** Use `tauri-plugin-store` (encrypted JSON store) -- simpler but less secure than OS keychain
- **Acceptable:** Store encrypted tokens in SQLite (your existing `bun:sqlite` DB) -- convenient since you already have a DB

**Never:**
- Store tokens in localStorage/sessionStorage (accessible via DevTools)
- Store tokens in plaintext files
- Include tokens in URLs or query parameters

### 7.2 Client Secret Handling

Desktop app credentials include a `client_secret`, but for installed/desktop apps, Google considers this **not truly confidential**. It's embedded in the distributed binary.

- The `client_secret` is still required for token exchange
- PKCE (`code_challenge` + `code_verifier`) is the real security mechanism
- Do NOT try to hide the secret via obfuscation -- it provides no real security
- Store client_id and client_secret in your app config (environment variables or bundled config)

### 7.3 Refresh Token Rotation

- Google may rotate refresh tokens -- when a new `refresh_token` is returned during a refresh request, store it immediately and discard the old one
- Refresh tokens can expire if: user revokes access, token unused for 6 months, user changes password (for Gmail scopes), the app exceeds max tokens per account (limit: 100 per OAuth client per account)
- Always handle `invalid_grant` errors by re-initiating the full auth flow

### 7.4 Scope Minimization

- Request only the scopes you need
- Use incremental authorization: request basic scopes first, then ask for additional scopes when the user needs that feature
- Google supports `include_granted_scopes=true` parameter to add scopes to existing grants without re-prompting for previously granted scopes

```typescript
// Incremental authorization example
authUrl.searchParams.set('include_granted_scopes', 'true');
authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.modify');
// This adds Gmail to existing grants without re-prompting for Calendar, etc.
```

### 7.5 Verify Granted Scopes

Always check which scopes were actually granted -- users can decline individual scopes:

```typescript
const grantedScopes = tokens.scope.split(' ');
const hasGmail = grantedScopes.includes('https://www.googleapis.com/auth/gmail.modify');
const hasCalendar = grantedScopes.includes('https://www.googleapis.com/auth/calendar.events');
// Gracefully disable features for which scopes were denied
```

---

## 8. Libraries & SDKs

### 8.1 Node.js / TypeScript (for Hono/Bun Server)

| Package | Purpose | Notes |
|---------|---------|-------|
| [`googleapis`](https://www.npmjs.com/package/googleapis) | Full Google API client | Includes Gmail, Calendar, Drive, Docs clients. Auto-generated from Google's API discovery docs. |
| [`google-auth-library`](https://www.npmjs.com/package/google-auth-library) | OAuth2 authentication | Handles token exchange, refresh, PKCE. Used by `googleapis` internally. |
| `@googleapis/gmail` | Gmail-only client | Lighter than full `googleapis` bundle |
| `@googleapis/calendar` | Calendar-only client | Lighter than full `googleapis` bundle |
| `@googleapis/drive` | Drive-only client | Lighter than full `googleapis` bundle |
| `@googleapis/docs` | Docs-only client | Lighter than full `googleapis` bundle |

**Usage example with `googleapis`:**

```typescript
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  'http://127.0.0.1:PORT' // or postmessage for web
);

// Set credentials
oauth2Client.setCredentials({
  access_token: 'ya29...',
  refresh_token: '1//0e...',
  expiry_date: Date.now() + 3600000,
});

// Auto-refresh on expiry
oauth2Client.on('tokens', (tokens) => {
  // Store new tokens
  if (tokens.refresh_token) saveRefreshToken(tokens.refresh_token);
  saveAccessToken(tokens.access_token);
});

// Use API clients
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
const drive = google.drive({ version: 'v3', auth: oauth2Client });
const docs = google.docs({ version: 'v1', auth: oauth2Client });

// Example: List emails
const { data } = await gmail.users.messages.list({
  userId: 'me',
  q: 'is:unread',
  maxResults: 10,
});
```

### 8.2 Rust Crates (for Tauri Backend)

| Crate | Purpose | Notes |
|-------|---------|-------|
| [`tauri-plugin-oauth`](https://crates.io/crates/tauri-plugin-oauth) | Localhost redirect server for OAuth | Handles the redirect flow, port management |
| [`tauri-plugin-google-auth`](https://crates.io/crates/tauri-plugin-google-auth) | Google-specific OAuth for Tauri | Higher-level, handles the full Google flow |
| [`oauth2`](https://crates.io/crates/oauth2) | Generic OAuth2 client | PKCE support, token management |
| [`google-apis-rs`](https://github.com/Byron/google-apis-rs) | Google API bindings for Rust | Auto-generated, covers all Google APIs |
| [`keyring`](https://crates.io/crates/keyring) | OS keychain access | For secure token storage |

### 8.3 JS vs Rust: Which Approach?

| Approach | Pros | Cons |
|----------|------|------|
| **JS on Hono/Bun server** | Mature `googleapis` library, easy to use, lots of examples, familiar TypeScript | Extra hop through server, server must be running |
| **Rust in Tauri backend** | Direct OS keychain access, no server dependency, potentially more secure | Less mature libraries, more boilerplate, harder to debug |
| **Hybrid (recommended)** | OAuth flow in Rust (secure token storage), API calls via Hono (developer productivity) | Slightly more complex architecture |

---

## 9. Recommended Architecture for Tauri + Hono/Bun

### 9.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                    Tauri App                         │
│                                                     │
│  ┌──────────────┐  IPC   ┌────────────────────┐    │
│  │ React        │◄──────►│ Rust Backend        │    │
│  │ Frontend     │        │                    │    │
│  │              │        │ - OAuth flow       │    │
│  │ - UI         │        │   (tauri-plugin-   │    │
│  │ - State      │        │    oauth)          │    │
│  │              │        │ - Token storage    │    │
│  └──────┬───────┘        │   (OS keychain)    │    │
│         │                │ - Token refresh    │    │
│         │ HTTP           └────────────────────┘    │
│         │                                          │
│  ┌──────▼───────────────────────────────────┐      │
│  │ Hono/Bun Server                          │      │
│  │                                          │      │
│  │ - Google API proxy endpoints             │      │
│  │   POST /api/gmail/messages               │      │
│  │   GET  /api/gmail/messages/:id           │      │
│  │   POST /api/calendar/events              │      │
│  │   GET  /api/drive/files                  │      │
│  │   POST /api/docs/:id/batchUpdate         │      │
│  │                                          │      │
│  │ - Receives access_token from Rust via    │      │
│  │   IPC or request header                  │      │
│  │ - Makes Google API calls with googleapis │      │
│  └──────────────────────────────────────────┘      │
│                         │                           │
└─────────────────────────┼───────────────────────────┘
                          │ HTTPS
                          ▼
                 Google APIs
                 (gmail, calendar, drive, docs)
```

### 9.2 Token Flow

1. **Initial auth:** React triggers "Sign in with Google" -> Tauri Rust command starts OAuth flow -> opens browser -> localhost redirect captures code -> Rust exchanges for tokens -> stores `refresh_token` in OS keychain, `access_token` in memory
2. **API calls:** React calls Hono server endpoints -> Hono gets fresh `access_token` from Rust backend via Tauri IPC -> Hono calls Google APIs with `googleapis` library -> returns data to React
3. **Token refresh:** When `access_token` expires, Rust backend uses `refresh_token` from keychain to get a new one transparently

### 9.3 Where to Store What

| Data | Storage | Why |
|------|---------|-----|
| `client_id` | App config / env var | Not secret for desktop apps |
| `client_secret` | App config / env var | Not truly secret for desktop apps |
| `refresh_token` | OS Keychain (via `keyring` crate) | Long-lived, most sensitive |
| `access_token` | In-memory (Rust state) | Short-lived (1 hr), regenerable |
| `user_email`, `user_name` | SQLite DB | Profile info, non-sensitive |
| `token_expiry` | In-memory or SQLite | For proactive refresh |

### 9.4 Why Hono Server for API Calls (Not Just Rust)

- The `googleapis` npm library is battle-tested with great TypeScript types
- Hono/Bun already exists in the stack -- no new infrastructure
- Easier to add request batching, caching, and rate limiting in JS
- Rust Google API crates are functional but less ergonomic
- The Rust backend focuses on what it does best: secure token management and OS integration

---

## 10. Implementation Checklist

### Phase 1: Google Cloud Setup
- [ ] Create Google Cloud project
- [ ] Enable APIs: Gmail, Calendar, Drive, Docs, People
- [ ] Create OAuth 2.0 credentials (Desktop app type)
- [ ] Configure consent screen with all scopes
- [ ] Add test users

### Phase 2: OAuth Flow
- [ ] Add `tauri-plugin-oauth` to Cargo.toml
- [ ] Implement PKCE code verifier/challenge generation in Rust
- [ ] Implement authorization URL builder
- [ ] Handle localhost redirect and code capture
- [ ] Implement token exchange
- [ ] Store refresh_token in OS keychain (`keyring` crate)
- [ ] Implement token refresh logic with auto-retry
- [ ] Expose Tauri commands: `google_sign_in`, `google_sign_out`, `get_access_token`

### Phase 3: Hono API Proxy
- [ ] Install `googleapis` in server package
- [ ] Create middleware to inject access_token from Tauri IPC
- [ ] Implement Gmail proxy endpoints
- [ ] Implement Calendar proxy endpoints
- [ ] Implement Drive proxy endpoints
- [ ] Implement Docs proxy endpoints
- [ ] Add error handling for 401 (trigger re-auth) and 429 (rate limit backoff)

### Phase 4: React Frontend
- [ ] Sign in / Sign out UI
- [ ] Gmail: inbox list, message view, compose
- [ ] Calendar: event list, create/edit event
- [ ] Drive: file browser, upload, download
- [ ] Docs: document list, open/edit
- [ ] Handle scope denial gracefully (disable features user declined)

### Phase 5: Production Readiness
- [ ] Submit app for Google OAuth verification (required for restricted scopes)
- [ ] Implement incremental authorization
- [ ] Add offline support / token caching
- [ ] Rate limiting and retry logic with exponential backoff
- [ ] Error handling for revoked tokens

---

## Appendix: Quick Reference

### All Endpoints

| Service | Base URL |
|---------|----------|
| Auth | `https://accounts.google.com/o/oauth2/v2/auth` |
| Token | `https://oauth2.googleapis.com/token` |
| Revoke | `https://oauth2.googleapis.com/revoke` |
| Gmail | `https://gmail.googleapis.com/gmail/v1` |
| Calendar | `https://www.googleapis.com/calendar/v3` |
| Drive | `https://www.googleapis.com/drive/v3` |
| Drive Upload | `https://www.googleapis.com/upload/drive/v3` |
| Docs | `https://docs.googleapis.com/v1` |

### Minimal Scope Set

```
openid email profile
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/documents
```

### Key npm Packages

```json
{
  "googleapis": "^140.0.0",
  "google-auth-library": "^9.0.0"
}
```

### Key Rust Crates

```toml
[dependencies]
tauri-plugin-oauth = "2"
keyring = "3"
oauth2 = "5"
```

---

## Sources

- [OAuth 2.0 for Desktop Apps (Google)](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Using OAuth 2.0 to Access Google APIs](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API Scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [Gmail API Quotas](https://developers.google.com/workspace/gmail/api/reference/quota)
- [Calendar API Scopes](https://developers.google.com/workspace/calendar/api/auth)
- [Calendar Quota Management](https://developers.google.com/workspace/calendar/api/guides/quota)
- [Drive API Scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Drive API Limits](https://developers.google.com/workspace/drive/api/guides/limits)
- [Docs API Scopes](https://developers.google.com/workspace/docs/api/auth)
- [OAuth 2.0 Scopes Reference (all Google APIs)](https://developers.google.com/identity/protocols/oauth2/scopes)
- [OAuth Best Practices (Google)](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)
- [tauri-plugin-oauth (GitHub)](https://github.com/FabianLars/tauri-plugin-oauth)
- [tauri-plugin-google-auth (crates.io)](https://crates.io/crates/tauri-plugin-google-auth)
- [google-auth-library (npm)](https://www.npmjs.com/package/google-auth-library)
- [googleapis (npm)](https://www.npmjs.com/package/googleapis)
- [Tauri Deep Linking Plugin](https://v2.tauri.app/plugin/deep-linking/)
