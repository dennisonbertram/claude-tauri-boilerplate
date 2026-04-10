# Telegram Connector Research (Issue #372)

> Investigation date: 2026-03-25

## 1. Executive Summary

A Telegram connector for this app can be built using either the **Bot API** (simple, limited to bot interactions) or **MTProto** (full user-client access to personal chats, groups, channels). Given that the connector's goal is personal message access and management -- not building a public-facing bot -- **MTProto via the `@mtcute/node` library is the recommended approach**. This matches the architecture used by every successful Telegram MCP server found in the wild.

The connector maps cleanly onto the existing `ConnectorDefinition` pattern: an `api.ts` wrapping mtcute, `tools.ts` exposing 6-8 tools via the `tool()` helper with Zod schemas, and `index.ts` exporting the definition. Auth is the hardest part -- MTProto requires interactive phone-number + OTP + optional 2FA, which needs a multi-step UI flow in the desktop app.

**Estimated complexity: Medium-High (2-3 weeks).** The Telegram API surface is straightforward once auth is solved, but auth and session persistence are non-trivial.

---

## 2. API Reference: Bot API vs TDLib/MTProto

### 2.1 Bot API

| Aspect | Details |
|---|---|
| **Protocol** | HTTPS REST (JSON) |
| **Auth** | Single bot token from @BotFather |
| **Access scope** | Only messages sent TO the bot, or in groups where bot is a member |
| **Personal chats** | Cannot read user-to-user messages |
| **Rate limits** | 1 msg/sec per chat, 20 msg/min in groups, ~30 msg/sec broadcast |
| **File limits** | Download: 20MB (files), 5MB (photos). Upload: 50MB |
| **Message history** | No access to historical messages -- only new updates via getUpdates/webhooks |
| **Pagination** | getUpdates returns earliest 100 unconfirmed updates, offset-based confirmation |
| **Media** | Can send/receive photos, documents, audio, video, stickers |
| **Search** | Not supported |
| **Complexity** | Very low -- simple HTTP calls |

**Verdict for this use case:** Insufficient. Bot API cannot access personal messages, historical chat data, or perform search. Only useful if the connector is limited to "send messages through a bot."

### 2.2 MTProto (via TDLib or client libraries)

| Aspect | Details |
|---|---|
| **Protocol** | MTProto 2.0 (binary, encrypted, direct TCP to Telegram servers) |
| **Auth** | Phone number + SMS/Telegram OTP + optional 2FA password |
| **Access scope** | Full user account: all chats, groups, channels, contacts, media |
| **Personal chats** | Full read/write access to all conversations |
| **Rate limits** | Flood-wait based (server returns wait time on overuse), generally more generous |
| **File limits** | Up to 2GB per file (4GB with premium) |
| **Message history** | Full access to all historical messages with offset-based pagination |
| **Pagination** | `messages.getHistory` with `offset_id`, `offset_date`, `add_offset`, `limit` (max 100 per request) |
| **Media** | Full access -- download any file, thumbnails, streaming |
| **Search** | `messages.search` with query string, date filters, peer filters, media type filters |
| **Complexity** | High -- encryption, session management, DC migration, flood-wait handling |

**Verdict for this use case:** Required for personal message access. All existing Telegram MCP servers use MTProto.

### 2.3 Comparison Matrix

| Feature | Bot API | MTProto |
|---|---|---|
| Read personal messages | No | Yes |
| Search messages | No | Yes |
| Access message history | No (only new) | Yes (full) |
| Download large files | 20MB limit | 2GB+ |
| Auth complexity | Trivial (token) | Complex (phone+OTP+2FA) |
| Session persistence | Stateless | Required (session file) |
| Library maturity (JS/TS) | Excellent (grammY) | Good (mtcute, GramJS) |
| ToS risk | None | Moderate (see Section 7) |

---

## 3. Existing Telegram MCP Servers

### 3.1 sparfenyuk/mcp-telegram (Python, Telethon)
- **Language:** Python
- **Telegram lib:** Telethon (MTProto)
- **Transport:** stdio
- **Tools:** `get_dialogs`, `get_messages`, `mark_as_read`, `get_messages_by_date`, `download_media`, `get_contacts`
- **Status:** Read-only (no send/edit). Most mature and well-documented.
- **URL:** https://github.com/sparfenyuk/mcp-telegram

### 3.2 kfastov/telegram-mcp-server (TypeScript, mtcute)
- **Language:** TypeScript
- **Telegram lib:** @mtcute/node (MTProto)
- **Transport:** Streamable HTTP via @modelcontextprotocol/sdk
- **Features:** Background archive worker, SQLite message storage, sync jobs
- **Tools:** `list_dialogs`, `get_messages`, sync job management
- **Status:** Active, architecturally closest to our needs (TypeScript + SQLite pattern)
- **URL:** https://github.com/kfastov/telegram-mcp-server

### 3.3 tacticlaunch/mcp-telegram (TypeScript, FastMCP)
- **Language:** TypeScript
- **Telegram lib:** MTProto (unspecified client)
- **Transport:** stdio + SSE
- **Tools:** List dialogs, list messages, send/receive messages
- **License:** MIT
- **URL:** https://github.com/tacticlaunch/mcp-telegram

### 3.4 chigwell/telegram-mcp (Python, Telethon)
- **Language:** Python
- **Telegram lib:** Telethon (MTProto)
- **Tools:** Full CRUD -- send/edit/delete messages, manage groups, media, contacts, settings
- **Status:** Most feature-complete but Python-only
- **URL:** https://github.com/chigwell/telegram-mcp

### 3.5 n24q02m/better-telegram-mcp (Composite)
- **Language:** Not specified
- **Approach:** Combines Bot API + MTProto, composite tools optimized for AI agents
- **URL:** https://github.com/n24q02m/better-telegram-mcp

### 3.6 Summary

All serious implementations use MTProto for user-account access. The kfastov server is the closest reference architecture (TypeScript, mtcute, SQLite, MCP SDK).

---

## 4. Recommended Implementation

### 4.1 Architecture Decision: MTProto via @mtcute/node

**Why mtcute over alternatives:**

| Library | Language | Runtime | Pros | Cons |
|---|---|---|---|---|
| **@mtcute/node** | TypeScript | Node/Bun | Native TS types, modern API, <50MB RAM, actively maintained, multi-runtime | Newer, smaller community |
| GramJS | TypeScript | Node/Browser | Telegram Desktop port, mature | Complex API, heavier |
| @mtproto/core | TypeScript | Node/Browser | Low-level, flexible | Requires manual session/auth handling |
| Telethon | Python | Python | Most mature, huge community | Wrong language for this project |
| grammY | TypeScript | Deno/Node/Bun | Excellent DX, great docs | Bot API only -- cannot access personal messages |
| Telegraf | TypeScript | Node | Popular, mature | Bot API only, worse TS support than grammY |

**Recommendation: `@mtcute/node`** -- TypeScript-native, works on Bun, lightweight, clean API, and already proven in kfastov's MCP server.

### 4.2 Connector File Structure

```
apps/server/src/connectors/telegram/
  index.ts          # ConnectorDefinition export
  tools.ts          # Tool definitions with Zod schemas
  api.ts            # mtcute wrapper -- session management, API calls
  auth.ts           # Multi-step auth flow (phone, OTP, 2FA)
  types.ts          # Telegram-specific types
  __tests__/
    tools.test.ts   # Tool tests with mocked api.ts
    api.test.ts     # API client tests with mocked fetch/mtcute
```

### 4.3 Auth Flow

MTProto authentication is interactive and multi-step:

```
1. User provides phone number (e.g. +1234567890)
2. Server calls auth.sendCode(phone) --> returns phone_code_hash
3. Telegram sends OTP to user's Telegram app (or SMS)
4. User enters OTP code in desktop app UI
5. Server calls auth.signIn(phone, code, phone_code_hash)
6. IF 2FA enabled: server receives SESSION_PASSWORD_NEEDED error
   6a. User enters 2FA password in desktop app UI
   6b. Server calls auth.checkPassword(password) with SRP
7. Session is established and persisted to disk/SQLite
8. Subsequent launches reuse the session (no re-auth needed)
```

**Implementation notes:**
- Session must be persisted (mtcute supports file-based and custom storage)
- Store session in `~/.claude-tauri/telegram-session/` alongside the existing SQLite DB
- The auth flow requires a new frontend UI component (multi-step form)
- Telegram API credentials (`api_id`, `api_hash`) must be obtained from https://my.telegram.org and stored in settings

### 4.4 Session Persistence

mtcute supports custom session storage. For this app:
- Use SQLite (already available via `bun:sqlite`) for session data
- Store in the existing `~/.claude-tauri/` directory
- Session survives app restarts -- user authenticates once

---

## 5. Tool Definitions with Zod Schemas

### 5.1 telegram_list_chats

```typescript
const listChatsTool = tool(
  'telegram_list_chats',
  'List Telegram dialogs (chats, groups, channels). Returns chat ID, title, type, unread count, and last message preview.',
  {
    limit: z.number().min(1).max(100).optional()
      .describe('Max number of chats to return (1-100, default 20)'),
    folder: z.enum(['all', 'personal', 'groups', 'channels']).optional()
      .describe('Filter by chat type (default "all")'),
    archived: z.boolean().optional()
      .describe('Include archived chats (default false)'),
  },
  async (args) => { /* ... */ },
  { annotations: { title: 'List Telegram Chats', readOnlyHint: true, openWorldHint: true } }
);
```

### 5.2 telegram_get_messages

```typescript
const getMessagesTool = tool(
  'telegram_get_messages',
  'Get messages from a Telegram chat. Supports pagination and filtering by date.',
  {
    chat_id: z.union([z.number(), z.string()])
      .describe('Chat ID (numeric) or username (@channel)'),
    limit: z.number().min(1).max(100).optional()
      .describe('Number of messages to fetch (1-100, default 20)'),
    offset_id: z.number().optional()
      .describe('Message ID to paginate from (returns messages before this ID)'),
    min_date: z.string().optional()
      .describe('ISO 8601 date string -- only messages after this date'),
    max_date: z.string().optional()
      .describe('ISO 8601 date string -- only messages before this date'),
    unread_only: z.boolean().optional()
      .describe('Only return unread messages (default false)'),
  },
  async (args) => { /* ... */ },
  { annotations: { title: 'Get Telegram Messages', readOnlyHint: true, openWorldHint: true } }
);
```

### 5.3 telegram_search_messages

```typescript
const searchMessagesTool = tool(
  'telegram_search_messages',
  'Search messages across all chats or within a specific chat.',
  {
    query: z.string().min(1).describe('Search query string'),
    chat_id: z.union([z.number(), z.string()]).optional()
      .describe('Limit search to specific chat (omit for global search)'),
    limit: z.number().min(1).max(50).optional()
      .describe('Max results (1-50, default 20)'),
    from_user: z.string().optional()
      .describe('Filter by sender username'),
    media_type: z.enum(['photo', 'video', 'document', 'audio', 'link', 'all']).optional()
      .describe('Filter by media type'),
  },
  async (args) => { /* ... */ },
  { annotations: { title: 'Search Telegram Messages', readOnlyHint: true, openWorldHint: true } }
);
```

### 5.4 telegram_send_message

```typescript
const sendMessageTool = tool(
  'telegram_send_message',
  'Send a message in a Telegram chat. Supports text with Markdown formatting and reply-to.',
  {
    chat_id: z.union([z.number(), z.string()])
      .describe('Chat ID or username to send to'),
    text: z.string().min(1).max(4096)
      .describe('Message text (supports Markdown)'),
    reply_to: z.number().optional()
      .describe('Message ID to reply to'),
    silent: z.boolean().optional()
      .describe('Send without notification sound (default false)'),
  },
  async (args) => { /* ... */ },
  { annotations: { title: 'Send Telegram Message', readOnlyHint: false, openWorldHint: true } }
);
```

### 5.5 telegram_get_contacts

```typescript
const getContactsTool = tool(
  'telegram_get_contacts',
  'Get the user\'s Telegram contacts list with online status.',
  {
    query: z.string().optional()
      .describe('Filter contacts by name or username'),
  },
  async (args) => { /* ... */ },
  { annotations: { title: 'Get Telegram Contacts', readOnlyHint: true, openWorldHint: true } }
);
```

### 5.6 telegram_download_media

```typescript
const downloadMediaTool = tool(
  'telegram_download_media',
  'Download a media file (photo, document, video) from a message. Returns the local file path.',
  {
    chat_id: z.union([z.number(), z.string()])
      .describe('Chat ID containing the message'),
    message_id: z.number()
      .describe('Message ID containing the media'),
    thumb: z.boolean().optional()
      .describe('Download thumbnail instead of full file (default false)'),
  },
  async (args) => { /* ... */ },
  { annotations: { title: 'Download Telegram Media', readOnlyHint: true, openWorldHint: true } }
);
```

### 5.7 telegram_mark_read

```typescript
const markReadTool = tool(
  'telegram_mark_read',
  'Mark messages in a chat as read up to a given message ID.',
  {
    chat_id: z.union([z.number(), z.string()])
      .describe('Chat ID to mark as read'),
    max_id: z.number().optional()
      .describe('Mark all messages up to this ID as read (default: latest)'),
  },
  async (args) => { /* ... */ },
  { annotations: { title: 'Mark Telegram Messages Read', readOnlyHint: false, openWorldHint: true } }
);
```

### Tool Summary

| Tool | Read/Write | Priority |
|---|---|---|
| `telegram_list_chats` | Read | P0 - Core |
| `telegram_get_messages` | Read | P0 - Core |
| `telegram_search_messages` | Read | P0 - Core |
| `telegram_send_message` | Write | P1 - Important |
| `telegram_get_contacts` | Read | P1 - Important |
| `telegram_download_media` | Read | P2 - Nice to have |
| `telegram_mark_read` | Write | P2 - Nice to have |

---

## 6. Testing Plan

### 6.1 Unit Tests (tools.test.ts)

Mock the `api.ts` module entirely. Test each tool handler with:
- Valid inputs return properly formatted content
- Invalid inputs return isError: true with descriptive messages
- Pagination parameters are passed through correctly
- Date parsing works for ISO 8601 strings
- Chat ID accepts both numeric and string (@username) formats

```typescript
// Example test structure (bun:test)
import { describe, test, expect, mock } from 'bun:test';
import { mock as bunMock } from 'bun:test';

// Mock the api module
mock.module('./api', () => ({
  listDialogs: mock(() => Promise.resolve([
    { id: 123, title: 'Test Chat', type: 'private', unreadCount: 5 }
  ])),
  getMessages: mock(() => Promise.resolve([
    { id: 1, text: 'Hello', date: '2026-03-25T10:00:00Z', sender: 'Alice' }
  ])),
}));
```

### 6.2 API Client Tests (api.test.ts)

Mock the mtcute TelegramClient at the transport level:
- Auth flow state machine tests (phone -> OTP -> 2FA -> success)
- Session persistence and resumption
- Flood-wait error handling and retry logic
- DC migration handling
- Connection error recovery

### 6.3 Integration Testing Strategy

**Option A: telegram-test-api (npm package)**
- Local mock Telegram server for Node.js
- Simulates bot API endpoints
- Limited: only simulates Bot API, not MTProto

**Option B: Mock at mtcute transport layer**
- Intercept raw MTProto calls
- Return canned responses
- More realistic but complex to set up

**Option C: Dedicated test Telegram account**
- Create a real Telegram account for CI
- Run against actual API in test environment
- Most realistic but requires phone number and is flaky

**Recommendation:** Use Option B for CI (mock at transport layer) and Option C for manual integration verification. The existing pattern of fetch mocking in this codebase translates well to mocking mtcute's internal client calls.

### 6.4 Test Coverage Targets

- Tool handlers: 100% coverage (all tools, error paths, edge cases)
- API client: 90%+ (auth flow, pagination, error handling)
- Auth flow: 100% (every state transition)

---

## 7. Security and Privacy

### 7.1 Telegram API Terms of Service

**Critical restrictions from https://core.telegram.org/api/terms:**

1. **AI/ML prohibition:** "You must not use, access or aggregate data obtained from the Telegram platform to train, fine-tune or otherwise engage in the development, enhancement or deployment of artificial intelligence, machine learning models and similar technologies." This is a significant concern -- the connector must be framed as a **user-directed tool** (user asks Claude to read THEIR messages), not as data collection for training.

2. **No automation without consent:** "It is forbidden to interfere with the basic functionality of Telegram. This includes making actions on behalf of the user without the user's knowledge and consent." Every tool invocation must be user-initiated.

3. **Monitoring:** "All accounts that log in using unofficial Telegram API clients are automatically put under observation." The app will be flagged as an unofficial client.

4. **Spam/flood:** Aggressive usage triggers permanent bans.

### 7.2 Bot Developer ToS (if using Bot API)

- Must provide a privacy policy
- Must not attempt to circumvent Telegram's data access limitations
- Must handle deletion requests from users
- Violations result in bot termination and potential legal action

### 7.3 Security Recommendations

1. **Session encryption:** Encrypt the mtcute session file at rest using a key derived from the OS keychain (macOS Keychain, Windows Credential Manager)
2. **Credential storage:** `api_id` and `api_hash` should be stored in the app's secure settings, not in plaintext config
3. **No message caching by default:** Don't persist message content to SQLite unless the user explicitly enables archival
4. **Scope limiting:** Default to read-only tools; write tools (send, mark_read) require explicit user opt-in
5. **Rate limiting:** Implement client-side rate limiting to avoid flood-wait bans
6. **Session invalidation:** Provide a "disconnect Telegram" button that destroys the session

### 7.4 Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Account ban for "unofficial client" | Medium | Follow ToS, don't automate without user action, respect rate limits |
| AI/ML ToS clause | High | Frame as user tool, don't cache/aggregate data, add clear disclaimers |
| Session theft | High | Encrypt session at rest, OS keychain integration |
| Flood-wait ban | Low | Client-side rate limiting, exponential backoff |
| 2FA credential exposure | Medium | Never persist 2FA password, use SRP protocol correctly |

---

## 8. Watchouts and Risks

### 8.1 Technical Risks

1. **mtcute Bun compatibility:** mtcute targets Node.js. It uses native crypto and TCP modules. Bun compatibility should be verified early -- if it doesn't work, GramJS is the fallback. The mtcute docs claim multi-runtime support including Bun, but edge cases exist.

2. **DC migration:** Telegram distributes users across multiple data centers. mtcute handles this automatically, but it adds latency on first connection and can cause reconnection issues.

3. **Session invalidation:** Telegram can invalidate sessions at any time (security alerts, too many sessions). The app must handle graceful re-auth.

4. **Large media downloads:** Files up to 2GB. Need streaming download with progress, temp file management, and cleanup.

5. **Message formatting:** Telegram uses its own entity-based formatting (bold, italic, code, links as offset+length entities). Converting to/from Markdown is non-trivial.

### 8.2 UX Risks

1. **Auth flow complexity:** Phone + OTP + 2FA is 3 steps minimum. Users may be confused by "why do I need to enter my phone number?"

2. **Privacy perception:** Users may be uncomfortable giving an AI app full access to their Telegram account. Clear scope communication is critical.

3. **Telegram notifications:** When the app connects via MTProto, it appears as a new "device" in Telegram's active sessions. Users will see a "new login" notification.

### 8.3 Legal/Policy Risks

1. **The AI/ML ToS clause is the biggest risk.** While this connector is user-directed (not training), Telegram's enforcement is opaque. Conservative approach: clearly document that messages are processed ephemerally and never stored/aggregated.

2. **App review:** Telegram may review apps using their API and request compliance changes.

---

## 9. Dependencies

### 9.1 Required npm Packages

| Package | Purpose | Size |
|---|---|---|
| `@mtcute/node` | MTProto client for Node.js/Bun | ~2MB |
| `@mtcute/sqlite` | SQLite session storage (or use custom bun:sqlite adapter) | ~500KB |

**Note:** mtcute is modular. `@mtcute/node` pulls in `@mtcute/core`, `@mtcute/tl`, `@mtcute/crypto-node`. Total added dependency footprint is approximately 3-5MB.

### 9.2 Telegram API Credentials

The app needs a `api_id` (integer) and `api_hash` (string) obtained from https://my.telegram.org/apps. Two options:

1. **Ship with the app's own credentials** (recommended for simplicity -- most Telegram clients do this)
2. **Require users to register their own** (more private but worse UX)

### 9.3 No Additional System Dependencies

mtcute uses Node.js native crypto -- no external C libraries or native modules needed.

---

## 10. Estimated Complexity

### Phase 1: Read-Only Core (1 week)
- [ ] mtcute integration, session management, auth flow
- [ ] `telegram_list_chats`, `telegram_get_messages`, `telegram_search_messages`
- [ ] Tests for all tools and API client
- [ ] Basic error handling and rate limiting

### Phase 2: Auth UI (3-4 days)
- [ ] Frontend multi-step auth component (phone -> OTP -> 2FA)
- [ ] Session persistence with encryption
- [ ] "Disconnect" flow
- [ ] Settings integration

### Phase 3: Write Tools + Polish (3-4 days)
- [ ] `telegram_send_message`, `telegram_mark_read`
- [ ] `telegram_get_contacts`, `telegram_download_media`
- [ ] Media download streaming and temp file management
- [ ] Comprehensive test coverage

### Total Estimate: 2-3 weeks

**Complexity breakdown:**
- API client (mtcute wrapper): Medium
- Auth flow (phone + OTP + 2FA + session): High
- Tool definitions: Low (follows existing weather pattern exactly)
- Frontend auth UI: Medium
- Testing: Medium
- Session encryption: Low-Medium

---

## References

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [Telegram MTProto Protocol](https://core.telegram.org/mtproto)
- [Telegram API Terms of Service](https://core.telegram.org/api/terms)
- [Telegram Bot Developer ToS](https://telegram.org/tos/bot-developers)
- [mtcute Documentation](https://mtcute.dev/)
- [mtcute GitHub](https://github.com/mtcute/mtcute)
- [MTProto vs Bot API (mtcute docs)](https://mtcute.dev/guide/intro/mtproto-vs-bot-api)
- [MTProto vs Bot API (Telethon docs)](https://docs.telethon.dev/en/stable/concepts/botapi-vs-mtproto.html)
- [grammY Framework Comparison](https://grammy.dev/resources/comparison)
- [sparfenyuk/mcp-telegram (Python, read-only)](https://github.com/sparfenyuk/mcp-telegram)
- [kfastov/telegram-mcp-server (TypeScript, mtcute)](https://github.com/kfastov/telegram-mcp-server)
- [tacticlaunch/mcp-telegram (TypeScript)](https://github.com/tacticlaunch/mcp-telegram)
- [chigwell/telegram-mcp (Python, full CRUD)](https://github.com/chigwell/telegram-mcp)
- [n24q02m/better-telegram-mcp (composite)](https://github.com/n24q02m/better-telegram-mcp)
- [telegram-test-api (mock server)](https://github.com/jehy/telegram-test-api)
- [Telegram User Authorization](https://core.telegram.org/api/auth)
- [Obtaining Telegram API Credentials](https://core.telegram.org/api/obtaining_api_id)
