# Gmail Connector Research — Issue #370

## 1. Executive Summary

The Gmail API provides a comprehensive REST interface for inbox management, message composition, thread tracking, and label organization. The app already has a working Google OAuth flow, a `googleapis`-based Gmail service layer (`services/google/gmail.ts`), and REST routes for listing/reading/sending messages. Enhancing this into a full `ConnectorDefinition` requires wrapping the existing service functions as MCP tools, adding draft management, label operations, thread reading, and action-item extraction tools, then registering the connector in the static array alongside the weather connector.

Several open-source Gmail MCP servers exist (detailed below) that validate the tool surface area, but none can be used directly because this project uses an in-process `createSdkMcpServer()` pattern with `tool()` + Zod, not a standalone MCP transport. The implementation is **Medium** complexity because the hard parts (OAuth, token refresh, error classification) are already solved.

---

## 2. API Reference

### Key Gmail API Endpoints

| Endpoint | Method | Description | Quota Units |
|---|---|---|---|
| `users.messages.list` | GET | List message IDs matching a query | 5 |
| `users.messages.get` | GET | Get a single message (metadata, minimal, full, raw) | 5 |
| `users.messages.send` | POST | Send a new message | 100 |
| `users.messages.modify` | POST | Add/remove labels on a message | 5 |
| `users.messages.trash` | POST | Move message to trash | 5 |
| `users.messages.batchModify` | POST | Bulk label changes | 50 |
| `users.threads.list` | GET | List threads | 10 |
| `users.threads.get` | GET | Get full thread with all messages | 10 |
| `users.threads.modify` | POST | Modify thread labels | 5 |
| `users.drafts.create` | POST | Create a draft | 10 |
| `users.drafts.update` | PUT | Update a draft | 10 |
| `users.drafts.send` | POST | Send a draft | 100 |
| `users.drafts.list` | GET | List drafts | 5 |
| `users.labels.list` | GET | List all labels | 1 |
| `users.labels.create` | POST | Create a label | 5 |
| `users.labels.get` | GET | Get label details | 1 |
| `users.history.list` | GET | Incremental sync since historyId | 2 |
| `users.getProfile` | GET | Get email address and history ID | 1 |

### Rate Limits

| Limit | Value |
|---|---|
| Daily quota (project) | 1,000,000,000 quota units |
| Per-user rate limit | 250 quota units / second |
| Batch request max | 100 calls per batch |
| Send limits (consumer Gmail) | 500 emails/day |
| Send limits (Google Workspace) | 2,000 emails/day |

### OAuth Scopes

| Scope | Access Level | Restricted? | Notes |
|---|---|---|---|
| `gmail.readonly` | Read messages, threads, labels, drafts | Yes | Safest for read-only use cases |
| `gmail.send` | Send messages only (no read) | Yes | Cannot read inbox |
| `gmail.compose` | Create/update drafts, send | Yes | No label/delete access |
| `gmail.modify` | Read + write + label + delete (not settings) | Yes | Best for full inbox management |
| `gmail.metadata` | Read metadata only (headers, no body) | No | Useful for triage without body access |
| `gmail.labels` | Create/edit/delete labels | No | Not restricted |

**Current app scopes** (from `auth.ts`): `gmail.readonly` + `gmail.send`. This is insufficient for the full connector because it cannot modify labels or create drafts. The scope needs to be upgraded to `gmail.modify` (which subsumes `gmail.readonly`) to enable label management and draft creation.

**Recommended scopes for the connector:**
```
gmail.modify    // read + write + labels + trash (subsumes gmail.readonly)
gmail.send      // retained for explicit send permission clarity
```

Note: All `gmail.*` scopes except `gmail.metadata` and `gmail.labels` are **restricted scopes** requiring Google's OAuth verification process (security assessment) for production apps with >100 users.

---

## 3. Existing MCP Servers

### TypeScript / JavaScript

| Project | Stars | Tools | Pros | Cons |
|---|---|---|---|---|
| [GongRzhe/Gmail-MCP-Server](https://github.com/GongRzhe/Gmail-MCP-Server) | ~800 | search, read, send, labels, drafts | Widely used, auto-auth flow | Unmaintained since Aug 2025, 72+ unmerged PRs. Standalone transport, not embeddable |
| [shinzo-labs/gmail-mcp](https://github.com/shinzo-labs/gmail-mcp) | ~200 | Full Gmail API coverage (messages, threads, labels, drafts, settings) | Most complete TS implementation, clean code | Standalone MCP server, would need extraction |
| [taylorwilsdon/google_workspace_mcp](https://github.com/taylorwilsdon/google_workspace_mcp) | ~2500 | Gmail + Calendar + Drive + Docs + Sheets + Chat + Tasks | Most feature-complete, remote OAuth2.1, multi-user | Python, massive scope creep for our needs |
| [j3k0/mcp-google-workspace](https://github.com/j3k0/mcp-google-workspace) | ~300 | Gmail + Calendar | TypeScript, lightweight | Limited tool set |

### Python

| Project | Notes |
|---|---|
| [theposch/gmail-mcp](https://github.com/theposch/gmail-mcp) | Feature-rich Python implementation |
| [jeremyjordan/mcp-gmail](https://github.com/jeremyjordan/mcp-gmail) | Python SDK-based, clean architecture |
| [david-strejc/gmail-mcp-server](https://github.com/david-strejc/gmail-mcp-server) | IMAP/SMTP based (not Gmail API) |

### Official

| Project | Notes |
|---|---|
| [google/mcp](https://github.com/google/mcp) | Google's official MCP repo; includes Gmail tools. Reference for correct API usage patterns |

**Verdict:** None of these can be directly embedded because they all use standalone MCP transports (stdio/SSE). However, `shinzo-labs/gmail-mcp` and the Google official repo are excellent references for tool surface area and edge case handling. The tool names and schemas from these projects should inform our ConnectorDefinition design.

---

## 4. Recommended Implementation

### Architecture

Follow the existing `ConnectorDefinition` pattern exactly:

```
apps/server/src/connectors/gmail/
  index.ts    — exports ConnectorDefinition
  tools.ts    — tool() definitions with Zod schemas
  api.ts      — pure API functions (wraps existing services/google/gmail.ts)
  gmail.test.ts — bun:test with fetch mocking
```

### Key Design Decisions

1. **Reuse existing service layer:** `services/google/gmail.ts` already has `listMessages`, `getMessage`, `sendMessage`. The new `api.ts` should re-export these and add missing functions (drafts, labels, threads, modify).

2. **Database access pattern:** The existing service layer takes `db: Database` as a parameter. The connector tools need access to the DB instance. Pass it through a factory function or closure when creating tools (similar to how routes receive `db`).

3. **Scope upgrade:** Change `GOOGLE_SCOPES` in `auth.ts` to include `gmail.modify` instead of `gmail.readonly`. Users will need to re-authorize.

4. **Human-in-the-loop for sends:** Mark send/draft-send tools with `annotations.readOnlyHint: false` and potentially add a confirmation mechanism. The LLM should describe the email before sending and ask for user confirmation.

5. **Pagination:** Expose `pageToken` and `maxResults` in list tools so the LLM can paginate through results. Default to 10-20 results.

6. **Search:** Gmail's search query syntax is powerful (`from:`, `to:`, `subject:`, `is:unread`, `after:`, `has:attachment`, etc.). Expose the full `q` parameter.

---

## 5. Tool Definitions

### Read-Only Tools

#### `gmail_search`
Search and list messages matching a Gmail query.
```typescript
{
  q: z.string().optional().describe('Gmail search query (e.g. "is:unread from:boss@co.com")'),
  maxResults: z.number().min(1).max(50).optional().default(10),
  pageToken: z.string().optional().describe('Pagination token from previous response'),
  labelIds: z.array(z.string()).optional().describe('Filter by label IDs (e.g. ["INBOX", "UNREAD"])'),
}
// Returns: { messages: MessageSummary[], nextPageToken?: string }
// Annotations: readOnlyHint: true
```

#### `gmail_read_message`
Read the full content of a specific message.
```typescript
{
  messageId: z.string().describe('The message ID to read'),
}
// Returns: { id, threadId, from, to, subject, date, body, labelIds }
// Annotations: readOnlyHint: true
```

#### `gmail_read_thread`
Read an entire email thread with all messages.
```typescript
{
  threadId: z.string().describe('The thread ID to read'),
}
// Returns: { threadId, messages: MessageFull[], subject }
// Annotations: readOnlyHint: true
```

#### `gmail_list_labels`
List all labels in the mailbox.
```typescript
{
  // No parameters
}
// Returns: { labels: { id, name, type, messagesTotal, messagesUnread }[] }
// Annotations: readOnlyHint: true
```

#### `gmail_get_profile`
Get the authenticated user's email address and mailbox stats.
```typescript
{
  // No parameters
}
// Returns: { emailAddress, messagesTotal, threadsTotal, historyId }
// Annotations: readOnlyHint: true
```

### Write Tools

#### `gmail_send`
Send a new email or reply to a thread.
```typescript
{
  to: z.string().describe('Recipient email address(es), comma-separated'),
  subject: z.string().describe('Email subject line'),
  body: z.string().describe('Email body (plain text)'),
  cc: z.string().optional().describe('CC recipients, comma-separated'),
  bcc: z.string().optional().describe('BCC recipients, comma-separated'),
  threadId: z.string().optional().describe('Thread ID to reply to'),
  inReplyTo: z.string().optional().describe('Message-ID header of the message being replied to'),
}
// Returns: { id, threadId }
// Annotations: readOnlyHint: false
```

#### `gmail_create_draft`
Create a draft email.
```typescript
{
  to: z.string().describe('Recipient email address(es)'),
  subject: z.string().describe('Email subject'),
  body: z.string().describe('Email body (plain text)'),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  threadId: z.string().optional().describe('Thread ID for reply drafts'),
}
// Returns: { draftId, messageId }
// Annotations: readOnlyHint: false
```

#### `gmail_modify_labels`
Add or remove labels from messages (for inbox triage).
```typescript
{
  messageIds: z.array(z.string()).min(1).max(50).describe('Message IDs to modify'),
  addLabelIds: z.array(z.string()).optional().describe('Label IDs to add'),
  removeLabelIds: z.array(z.string()).optional().describe('Label IDs to remove'),
}
// Returns: { modified: number }
// Annotations: readOnlyHint: false
```

#### `gmail_trash`
Move a message to trash.
```typescript
{
  messageId: z.string().describe('Message ID to trash'),
}
// Returns: { success: true }
// Annotations: readOnlyHint: false
```

### Triage / Intelligence Tools

#### `gmail_triage_inbox`
High-level tool that fetches recent unread messages and categorizes them.
```typescript
{
  maxResults: z.number().min(1).max(50).optional().default(20),
  categories: z.array(z.string()).optional()
    .describe('Custom categories (default: urgent, needs-reply, informational, promotional)'),
}
// Returns: { categories: { name: string, messages: MessageSummary[] }[] }
// Annotations: readOnlyHint: true
// Note: This is a compound tool that calls messages.list + messages.get internally.
// The categorization is done by returning structured data for the LLM to reason about,
// NOT by the tool itself doing classification.
```

**Note on `gmail_triage_inbox`:** This tool is a convenience wrapper. It fetches unread messages with metadata and returns them in a structured format that makes it easy for the LLM to categorize and suggest actions. The LLM does the actual intelligence work. If this proves too opinionated, it can be dropped in favor of the LLM composing `gmail_search` + `gmail_read_message` calls directly.

---

## 6. Testing Plan

### Unit Tests (api.ts)

Mock `googleapis` at the module level. The existing weather test pattern of mocking `globalThis.fetch` does not apply here because `googleapis` uses its own HTTP client internally.

**Preferred mocking strategy:** Mock the `google.gmail()` return value.

```typescript
// gmail.test.ts
import { describe, test, expect, mock, beforeEach } from 'bun:test';

// Mock googleapis module
const mockGmail = {
  users: {
    messages: {
      list: mock(() => ({ data: { messages: [], nextPageToken: null } })),
      get: mock(() => ({ data: { id: '123', payload: { headers: [] } } })),
      send: mock(() => ({ data: { id: '123', threadId: 'thread1' } })),
      modify: mock(() => ({ data: {} })),
      trash: mock(() => ({ data: {} })),
      batchModify: mock(() => ({ data: {} })),
    },
    threads: {
      get: mock(() => ({ data: { id: 'thread1', messages: [] } })),
      list: mock(() => ({ data: { threads: [] } })),
    },
    drafts: {
      create: mock(() => ({ data: { id: 'draft1', message: { id: 'msg1' } } })),
      list: mock(() => ({ data: { drafts: [] } })),
    },
    labels: {
      list: mock(() => ({ data: { labels: [] } })),
      create: mock(() => ({ data: { id: 'label1' } })),
    },
    getProfile: mock(() => ({ data: { emailAddress: 'test@gmail.com' } })),
  },
};
```

### Test Scenarios

**Read operations:**
- `listMessages` — returns paginated results, handles empty inbox, respects maxResults
- `getMessage` — decodes base64url body, handles multipart/alternative, handles missing headers
- `getThread` — returns all messages in thread order
- `listLabels` — returns system + user labels
- `getProfile` — returns email address and stats

**Write operations:**
- `sendMessage` — constructs valid RFC 2822, handles CC/BCC, handles reply threading
- `createDraft` — creates draft with correct structure
- `modifyLabels` — adds/removes labels, handles batch modify for >1 message
- `trashMessage` — moves to trash successfully

**Error handling:**
- Auth revoked (invalid_grant) -> `needsReconnect: true`
- Rate limited (429) -> `retryable: true`
- Not found (404) -> appropriate error message
- Insufficient permissions (403) -> does NOT disconnect
- Server error (500) -> `retryable: true`

**Regression test scenarios:**
- Base64url decoding handles strings without padding correctly
- `extractPlainText` traverses nested multipart structures (already exists in service layer)
- Empty search results return empty array (not error)
- Thread with deleted messages handles gracefully
- Label modification with empty add/remove arrays is a no-op
- Send with threadId correctly sets In-Reply-To and References headers

### Integration Test Strategy

For CI/CD, use mocked tests exclusively. For manual validation:
1. Use a dedicated test Google account (not personal)
2. Set the OAuth app to "Testing" mode in Google Cloud Console
3. Add the test account as a test user
4. Note: Refresh tokens expire after 7 days in testing mode

---

## 7. Security & Privacy

### Token Storage
- **Current approach (good):** Tokens stored in local SQLite (`bun:sqlite`) at `~/.claude-tauri/data.db`
- **Refresh token protection:** The `updateGoogleOAuthTokens` function never overwrites refresh_token with null (already implemented in `auth.ts`)
- **Token auto-refresh:** The `client.on('tokens')` listener persists refreshed tokens back to DB (already implemented)

### Scope Minimization
- Use `gmail.modify` instead of the full `mail.google.com` scope
- Never request `gmail.settings.basic` or `gmail.settings.sharing` unless managing filters/forwarding
- The `gmail.modify` scope cannot permanently delete messages (only trash), which is a good safety net

### User Approval for Sends
- Mark all write tools with `annotations.readOnlyHint: false`
- The LLM should be instructed (via tool description) to always confirm with the user before sending
- Consider implementing a server-side "dry run" mode that returns the composed email for review before actually sending
- Rate limit sends server-side (e.g., max 10 sends per session without explicit user re-confirmation)

### Data Handling
- Email bodies may contain sensitive data — do not log full message bodies in production
- Truncate body content in tool responses to a reasonable length (e.g., 10,000 chars) to avoid context window bloat
- Strip HTML tags from body content; return plain text only
- Never store email content in the local DB; only access it transiently through the API

### OAuth Security
- Redirect URI is locked to `localhost:{port}` (already implemented)
- PKCE is not used by the current implementation but recommended for public clients. Since this is a desktop app (Tauri), consider adding PKCE support.
- State parameter should be validated in the OAuth callback to prevent CSRF (verify this is implemented)

---

## 8. Watchouts & Risks

### API Quirks
1. **`messages.list` returns only IDs:** You must make a separate `messages.get` call for each message to get headers/body. For 20 messages, that is 21 API calls. Use `format: 'metadata'` for list views and `format: 'full'` only when reading a specific message.

2. **Base64url encoding:** Gmail uses URL-safe base64 without padding. The existing `decodeBase64Url` helper handles this correctly.

3. **Multipart MIME complexity:** Messages can have deeply nested multipart structures (multipart/mixed > multipart/alternative > text/plain + text/html). The existing `extractPlainText` function handles this but should be tested against edge cases (inline images, attachments, S/MIME encrypted).

4. **Thread ordering:** `threads.get` returns messages in the order they were received, but `internalDate` should be used for accurate chronological ordering.

5. **Label IDs vs Names:** System labels use fixed IDs (`INBOX`, `UNREAD`, `STARRED`, `TRASH`, etc.) while user labels have opaque IDs like `Label_123`. Always resolve label names to IDs before passing to the API.

6. **Search query encoding:** Gmail's `q` parameter supports complex syntax but some characters need escaping. The `googleapis` library handles URL encoding.

7. **Draft updates are replacements:** `drafts.update` replaces the entire draft, not a partial update. Always send the complete draft content.

### Rate Limit Strategy
- The per-user limit of 250 quota units/second is generous for single-user desktop use
- A worst-case inbox triage (list 20 messages + get each) costs 5 + (20 * 5) = 105 quota units, well within the per-second limit
- Implement exponential backoff with jitter for 429 responses (the existing `isRateLimited` helper already detects these)

### Scope Change Impact
- Upgrading from `gmail.readonly` to `gmail.modify` requires users to re-authorize
- The app should detect the scope mismatch and prompt re-authorization gracefully
- Existing tokens with `gmail.readonly` will get 403 errors on modify operations

### Large Mailbox Performance
- Gmail API handles large mailboxes well (pagination is mandatory)
- Never fetch all messages at once; always use `maxResults` + `pageToken`
- For inbox triage, default to 10-20 messages to keep response times under 3 seconds

---

## 9. Dependencies

### Already in Use (no new installs needed)
- `googleapis` — Google API Node.js client (already in `package.json`)
- `google-auth-library` — OAuth2 client (transitive dep of `googleapis`)
- `zod` — Schema validation (already in use for tools)
- `@anthropic-ai/claude-agent-sdk` — MCP tool definitions (already in use)

### No New Dependencies Required

The implementation can be done entirely with existing dependencies. The `googleapis` library already includes full Gmail API support including threads, drafts, labels, and batch operations.

---

## 10. Estimated Complexity

**Medium**

### Justification

**Already done (Low effort):**
- Google OAuth flow (complete with token refresh, error classification)
- `listMessages`, `getMessage`, `sendMessage` in `services/google/gmail.ts`
- Error classification (`classifyGoogleError` in `auth.ts`)
- REST routes for Gmail (reading, sending)
- `ConnectorDefinition` pattern established with weather connector

**New work (Medium effort):**
- ~8-10 new MCP tool definitions in `tools.ts` following the weather pattern
- ~5-6 new API functions in `api.ts` (getThread, listLabels, createDraft, modifyLabels, trashMessage, getProfile)
- Database access injection pattern for the connector (tools need `db` reference)
- Scope upgrade and re-authorization flow
- Comprehensive test suite (~15-20 test cases)
- Body truncation and formatting logic for tool responses

**Estimated effort:** 1-2 days for a developer familiar with the codebase.

### Implementation Order (Recommended)
1. Add new API functions to `services/google/gmail.ts` (or a new `api.ts` in the connector)
2. Create `connectors/gmail/api.ts` wrapping the service layer
3. Create `connectors/gmail/tools.ts` with all tool definitions
4. Create `connectors/gmail/index.ts` exporting `ConnectorDefinition`
5. Register in `connectors/index.ts` CONNECTORS array
6. Upgrade OAuth scopes in `auth.ts`
7. Write tests in `connectors/gmail/gmail.test.ts`
8. Test end-to-end with Claude session

---

## Sources

- [Gmail API Usage Limits](https://developers.google.com/workspace/gmail/api/reference/quota)
- [Gmail API OAuth Scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [Gmail API Sync Guide](https://developers.google.com/workspace/gmail/api/guides/sync)
- [Gmail API Push Notifications](https://developers.google.com/workspace/gmail/api/guides/push)
- [Gmail API Batch Requests](https://developers.google.com/workspace/gmail/api/guides/batch)
- [GongRzhe/Gmail-MCP-Server](https://github.com/GongRzhe/Gmail-MCP-Server)
- [shinzo-labs/gmail-mcp](https://github.com/shinzo-labs/gmail-mcp)
- [taylorwilsdon/google_workspace_mcp](https://github.com/taylorwilsdon/google_workspace_mcp)
- [j3k0/mcp-google-workspace](https://github.com/j3k0/mcp-google-workspace)
- [google/mcp](https://github.com/google/mcp)
- [jeremyjordan/mcp-gmail](https://github.com/jeremyjordan/mcp-gmail)
- [googleapis Node.js Client](https://googleapis.dev/nodejs/googleapis/latest/gmail/classes/Gmail.html)
