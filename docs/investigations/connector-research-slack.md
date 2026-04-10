# Slack Connector Research

**Issue:** #374
**Date:** 2026-03-25
**Status:** Research complete

---

## 1. Existing Implementations & Prior Art

### Official MCP Slack Server (`@modelcontextprotocol/server-slack`)

The official MCP reference implementation provides a baseline Slack server with these tools:

| Tool | Description |
|------|-------------|
| `slack_list_channels` | List public or predefined channels with optional pagination |
| `slack_post_message` | Post new messages to specific Slack channels |
| `slack_reply_to_thread` | Reply to existing message threads |
| `slack_add_reaction` | Add emoji reactions to messages |
| `slack_get_channel_history` | Retrieve channel history / recent messages |
| `slack_get_thread_replies` | Get all replies in a specific message thread |
| `slack_get_users` | List workspace users with basic profile info |
| `slack_get_user_profile` | Access detailed user profile information |

**Config:** Requires `SLACK_BOT_TOKEN` (xoxb-) and `SLACK_TEAM_ID` (T...) as env vars. Uses direct HTTP calls to Slack Web API (no SDK dependency).

### Third-Party MCP Slack Servers

- **korotovsky/slack-mcp-server** -- Adds DMs, Group DMs, GovSlack support, smart history fetch with no extra permission requirements. More feature-rich than the official server.
- **@soramash/slack-mcp-server-typescript** -- TypeScript implementation with additional search capabilities.
- **Slack's own MCP server** (closed beta, GA early 2026) -- First-party solution with OAuth, admin governance, canvas support. Uses Slack's Remote MCP Server architecture.

### Key Takeaway for Our Connector

The official MCP server is intentionally minimal. Our connector should cover the official tool set as a baseline and add search, DM support, and better error handling. Since we use in-process `createSdkMcpServer()` (not stdio), we have more flexibility for token management and caching.

---

## 2. Slack API Landscape

### Web API (Primary -- use this)
- REST-based, 200+ methods at `https://slack.com/api/{method}`
- Supports both bot and user tokens
- Cursor-based pagination on collection endpoints
- Per-method rate limit tiers (1-100+ req/min depending on tier)

### Events API
- Webhook-based push notifications for workspace events
- **Not needed for our connector** -- we are request/response only, not event-driven

### Socket Mode
- WebSocket-based alternative to Events API (no public URL needed)
- **Not needed** -- same reason as Events API

### RTM API (Deprecated)
- Legacy real-time WebSocket API. Cannot be used with granular-permission apps since June 2024
- **Do not use**

### Recommendation

Use **Web API only** via `@slack/web-api`. Our connector is tool-based (request/response), not event-driven. No need for Bolt, Socket Mode, or Events API.

---

## 3. Library Selection: `@slack/web-api` vs `@slack/bolt`

| Criteria | `@slack/web-api` | `@slack/bolt` |
|----------|-------------------|---------------|
| Purpose | Direct API client | Full app framework |
| Weight | ~150KB | ~500KB+ (includes web-api) |
| Event handling | No | Yes (Socket Mode, HTTP) |
| Rate limit handling | Built-in retry with `Retry-After` | Same (uses web-api internally) |
| Pagination helpers | `WebClient.paginate()` async iterator | Same |
| TypeScript types | Full types for args + responses (v6.2+) | Full types |
| Our use case fit | Perfect -- lightweight API client | Overkill -- we don't need event listeners |

### Recommendation: `@slack/web-api`

- Lighter weight, fewer dependencies
- Full TypeScript support for all API methods
- Built-in rate limit retry logic
- Built-in cursor pagination helpers via `WebClient.paginate()`
- No framework overhead we won't use
- Compatible with Bun runtime

```typescript
import { WebClient } from '@slack/web-api';

const client = new WebClient(token, {
  retryConfig: { retries: 3 },  // auto-retry on rate limits
});

// Paginated channel list
for await (const page of client.paginate('conversations.list', { types: 'public_channel', limit: 200 })) {
  // process page.channels
}
```

---

## 4. Authentication & OAuth

### Token Types

| Token | Prefix | Use Case |
|-------|--------|----------|
| Bot token | `xoxb-` | App acting as itself. Preferred for most operations. |
| User token | `xoxp-` | Acting on behalf of a user. Needed for some search/admin APIs. |
| App-level token | `xapp-` | Socket Mode connections only. Not needed. |

### OAuth 2.0 v2 Flow

1. Redirect user to `https://slack.com/oauth/v2/authorize?client_id=...&scope=...&user_scope=...`
2. User authorizes; Slack redirects back with `code`
3. Exchange code via `oauth.v2.access` -- returns `access_token` (bot), optionally `authed_user.access_token` (user)
4. Store tokens securely (encrypted in SQLite via our existing credential store)

### Required Bot Scopes (Minimum Viable)

```
channels:read          -- List channels
channels:history       -- Read channel messages
groups:read            -- List private channels (if needed)
groups:history         -- Read private channel messages
chat:write             -- Post messages
reactions:read         -- Read reactions
reactions:write        -- Add reactions
users:read             -- List users
users.profile:read     -- Read user profiles
search:read            -- Search messages (requires user token!)
im:read                -- List DMs
im:history             -- Read DM messages
mpim:read              -- List group DMs
mpim:history           -- Read group DM messages
```

**Important:** `search:read` only works with user tokens, not bot tokens. If search is critical, we need both token types.

### Token Storage

Store in our existing credential system (SQLite `credentials` table, encrypted). Schema:

```typescript
interface SlackCredentials {
  botToken: string;       // xoxb-...
  userToken?: string;     // xoxp-... (optional, for search)
  teamId: string;         // T...
  teamName: string;
  installedBy: string;    // user ID who installed
  scopes: string[];       // granted scopes
}
```

### Token Rotation

Slack supports optional token rotation (refresh tokens with expiring access tokens). For V1, skip this and use long-lived tokens. Add rotation in a future iteration if needed.

---

## 5. Rate Limits

### Tier System

| Tier | Limit | Example Methods |
|------|-------|-----------------|
| Tier 1 | 1 req/min | `admin.*`, `migration.*` |
| Tier 2 | 20 req/min | `conversations.history`, `users.list` |
| Tier 3 | 50 req/min | `chat.postMessage`, `reactions.add` |
| Tier 4 | 100+ req/min | `auth.test`, `api.test` |

### 2025 Rate Limit Changes

As of May 2025, commercially distributed apps not approved for the Slack Marketplace face stricter limits on `conversations.history` and `conversations.replies` (1 req/min, max 15 objects per page). This does **not** affect internally installed apps, which is our use case.

### Handling Strategy

1. **`@slack/web-api` handles retries automatically** -- respects `Retry-After` header, configurable retry count
2. **Add request queuing** for burst protection (optional, V2)
3. **Cache aggressively** -- channel lists, user profiles (TTL: 5-15 min)
4. **Use pagination** -- always paginate, never fetch all-at-once (stricter limits apply without pagination)

```typescript
const client = new WebClient(token, {
  retryConfig: {
    retries: 3,
    factor: 1.5,  // exponential backoff
  },
});
```

---

## 6. Pagination (Cursor-Based)

### How It Works

All collection endpoints use cursor-based pagination:

```typescript
// Manual pagination
let cursor: string | undefined;
const allChannels = [];

do {
  const result = await client.conversations.list({
    limit: 200,              // Slack recommends 100-200
    cursor,
    types: 'public_channel',
  });
  allChannels.push(...(result.channels ?? []));
  cursor = result.response_metadata?.next_cursor || undefined;
} while (cursor);
```

### Best Practices

- **Page size:** 100-200 items (max 1000, varies by method)
- **Cursor lifetime:** Cursors expire -- use them within minutes, not hours
- **Empty/null `next_cursor`:** Signals end of results
- **For tools:** Return one page at a time with `next_cursor` as an optional input parameter, letting the LLM paginate as needed

### Recommended Tool Design

```typescript
// Tool returns a page + cursor for next page
{
  channels: [...],
  next_cursor: "dXNlcj..." | null,
  has_more: true
}
```

This avoids fetching thousands of channels when the LLM only needs a few.

---

## 7. Message Formatting (Block Kit & mrkdwn)

### mrkdwn (Slack's Markdown Variant)

| Syntax | Result |
|--------|--------|
| `*bold*` | **bold** |
| `_italic_` | *italic* |
| `~strikethrough~` | ~~strikethrough~~ |
| `` `code` `` | `code` |
| ` ```code block``` ` | code block |
| `<https://url\|label>` | hyperlink |
| `<@U123>` | @mention user |
| `<#C123>` | #channel reference |
| `>` | blockquote |

### Character Escaping

Must escape `&`, `<`, `>` in text content:
- `&` -> `&amp;`
- `<` -> `&lt;`
- `>` -> `&gt;`

### Block Kit (for Rich Messages)

For posting messages, support plain text (mrkdwn) by default. Block Kit can be a V2 enhancement.

```typescript
// Simple message (V1)
await client.chat.postMessage({
  channel: 'C123',
  text: 'Hello from the connector!',
});

// Block Kit message (V2)
await client.chat.postMessage({
  channel: 'C123',
  text: 'Fallback text',
  blocks: [
    { type: 'section', text: { type: 'mrkdwn', text: '*Summary:* ...' } },
    { type: 'divider' },
    { type: 'section', text: { type: 'mrkdwn', text: 'Details here...' } },
  ],
});
```

### Tool Output Formatting

When returning messages to the LLM, convert mrkdwn to readable plain text. Strip Block Kit to extract text content. The LLM does not need to see raw block JSON.

---

## 8. Threading Model

### How Slack Threading Works

- Every message has a `ts` (timestamp) that serves as its unique ID
- Replies reference a parent via `thread_ts`
- A message is a thread parent if `reply_count > 0`
- Use `conversations.replies` with `ts` parameter to fetch thread

### Tool Design for Threading

```typescript
// Read thread
slack_get_thread({
  channel: 'C123',
  thread_ts: '1234567890.123456',
  limit: 50,
})

// Reply to thread
slack_post_message({
  channel: 'C123',
  text: 'My reply',
  thread_ts: '1234567890.123456',  // optional -- omit for top-level message
})
```

---

## 9. Multi-Workspace Support

### Approaches

| Approach | Complexity | Use Case |
|----------|------------|----------|
| One token per workspace | Low | Our V1 -- single workspace |
| Token map keyed by team_id | Medium | V2 -- user connects multiple workspaces |
| Enterprise Grid org token | High | Enterprise customers |

### Recommended Architecture (V1 -> V2)

**V1:** Single workspace connection. Store one bot token + team_id. Simple.

**V2:** Multiple workspace connections. Each workspace is a separate "connection" in the credential store:

```typescript
interface SlackConnection {
  id: string;            // UUID
  teamId: string;        // T...
  teamName: string;      // "Acme Corp"
  botToken: string;      // xoxb-...
  userToken?: string;    // xoxp-...
  scopes: string[];
  connectedAt: string;
}

// Tools accept optional workspace_id parameter
slack_list_channels({
  workspace_id: "...",   // optional -- defaults to primary workspace
  limit: 100,
})
```

**Enterprise Grid:** Single org-wide bot token covers all workspaces. One token, but channels span workspaces. Add support later if needed.

---

## 10. Proposed Tool Set & File Structure

### Tools (Phase 1 -- Core)

| Tool | Annotations | Description |
|------|-------------|-------------|
| `slack_list_channels` | readOnly | List channels with pagination, filter by type |
| `slack_get_channel_history` | readOnly | Get recent messages from a channel |
| `slack_get_thread` | readOnly | Get all replies in a thread |
| `slack_post_message` | destructive | Post a message (top-level or thread reply) |
| `slack_search_messages` | readOnly | Search messages across workspace |
| `slack_list_users` | readOnly | List workspace members |
| `slack_get_user_profile` | readOnly | Get detailed user profile |
| `slack_add_reaction` | destructive | Add an emoji reaction |

### Tools (Phase 2 -- Extended)

| Tool | Description |
|------|-------------|
| `slack_list_dms` | List DM conversations |
| `slack_get_dm_history` | Read DM messages |
| `slack_set_channel_topic` | Update channel topic |
| `slack_upload_file` | Upload a file to a channel |
| `slack_remove_reaction` | Remove an emoji reaction |

### File Structure

```
apps/server/src/connectors/slack/
  index.ts          -- ConnectorDefinition export
  tools.ts          -- Tool definitions using sdk `tool()` helper
  api.ts            -- SlackApiClient wrapper around @slack/web-api
  types.ts          -- Slack-specific TypeScript interfaces
  formatters.ts     -- mrkdwn-to-text conversion, message formatting
  slack.test.ts     -- Tests with mocked fetch/WebClient
```

### ConnectorDefinition

```typescript
export const slackConnector: ConnectorDefinition = {
  name: 'slack',
  displayName: 'Slack',
  description: 'Send and read messages, search conversations, and manage channels in your Slack workspace.',
  icon: '💬',
  category: 'communication',
  requiresAuth: true,
  tools: slackTools,
};
```

### Testing Strategy

Following the existing weather connector pattern (mock `globalThis.fetch`):

1. **Mock `fetch` globally** -- intercept calls to `https://slack.com/api/*`
2. **Create test data factories** -- `makeChannelResponse()`, `makeMessageResponse()`, `makeUserResponse()`
3. **Router-based mock** -- route by URL path to appropriate mock response
4. **Test error paths** -- rate limits (429 + Retry-After), auth errors (401), not_in_channel, etc.
5. **Test pagination** -- verify cursor forwarding and empty-cursor termination

```typescript
// Example test pattern (bun:test)
describe('Slack API', () => {
  afterEach(() => restoreFetch());

  test('lists channels with pagination', async () => {
    mockFetch(createSlackRouter({
      'conversations.list': {
        ok: true,
        channels: [{ id: 'C1', name: 'general' }],
        response_metadata: { next_cursor: '' },
      },
    }));
    const result = await listChannels(token, { limit: 100 });
    expect(result.channels).toHaveLength(1);
  });
});
```

Alternatively, since `@slack/web-api`'s `WebClient` uses `fetch` internally, mocking fetch at the global level (as the weather connector does) works cleanly with bun:test. No additional mock libraries needed.

---

## Summary of Recommendations

1. **Library:** `@slack/web-api` (not Bolt) -- lightweight, typed, built-in rate limit handling
2. **Auth:** OAuth 2.0 v2 with bot token (xoxb-). User token (xoxp-) optional for search
3. **API:** Web API only. No Events API, Socket Mode, or RTM
4. **Pagination:** Cursor-based, one page per tool call, expose `next_cursor` to LLM
5. **Rate limits:** Rely on `@slack/web-api` built-in retry + add caching for channel/user lists
6. **Messages:** Plain text (mrkdwn) for V1, Block Kit for V2
7. **Multi-workspace:** Single workspace V1, token-map V2
8. **Testing:** Mock fetch globally (bun:test), factory functions, router pattern (matches weather connector)
9. **File structure:** `slack/{index,tools,api,types,formatters,slack.test}.ts`
10. **Phase 1 tools:** 8 core tools covering channels, messages, threads, users, reactions, search

---

## Sources

- [Slack MCP Server Overview | Slack Developer Docs](https://docs.slack.dev/ai/slack-mcp-server/)
- [@modelcontextprotocol/server-slack - npm](https://www.npmjs.com/package/@modelcontextprotocol/server-slack)
- [Rate Limits | Slack Developer Docs](https://docs.slack.dev/apis/web-api/rate-limits/)
- [Pagination | Slack Developer Docs](https://docs.slack.dev/apis/web-api/pagination/)
- [Evolving API Pagination at Slack | Slack Engineering](https://slack.engineering/evolving-api-pagination-at-slack/)
- [Installing with OAuth | Slack Developer Docs](https://docs.slack.dev/authentication/installing-with-oauth/)
- [Formatting Message Text | Slack Developer Docs](https://docs.slack.dev/messaging/formatting-message-text/)
- [Block Kit | Slack Developer Docs](https://docs.slack.dev/block-kit/)
- [Comparing HTTP & Socket Mode | Slack Developer Docs](https://docs.slack.dev/apis/events-api/comparing-http-socket-mode/)
- [Legacy RTM API | Slack Developer Docs](https://api.slack.com/rtm)
- [Bolt for JavaScript | Slack Developer Docs](https://tools.slack.dev/bolt-js/)
- [Using TypeScript | Slack Developer Docs](https://docs.slack.dev/tools/node-slack-sdk/typescript/)
- [Enterprise Organizations | Slack Developer Docs](https://docs.slack.dev/enterprise/)
- [Organization-Ready Apps | Slack Developer Docs](https://api.slack.com/enterprise/org-ready-apps)
- [korotovsky/slack-mcp-server | GitHub](https://github.com/korotovsky/slack-mcp-server)
- [@slack-wrench/jest-mock-web-client - npm](https://www.npmjs.com/package/@slack-wrench/jest-mock-web-client)
- [Best MCP Server for Slack in 2026 | Truto Blog](https://truto.one/blog/best-mcp-server-for-slack-in-2026)
