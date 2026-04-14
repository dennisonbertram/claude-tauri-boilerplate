# Discord Connector Research

**Issue:** #399
**Date:** 2026-03-25
**Status:** Research complete

---

## 1. Overview

A Discord connector for the desktop app, implemented as an in-process MCP server following the existing `ConnectorDefinition` pattern (see `apps/server/src/connectors/weather/`). The connector would use the **Discord Bot API** (REST + optional Gateway WebSocket) to let Claude read messages, send messages, list servers/channels, manage reactions, and search history within Discord servers where the bot has been invited.

---

## 2. Discord API Landscape

### 2.1 REST API

The primary integration surface. Stateless HTTP calls to `https://discord.com/api/v10/`.

**Key endpoints for the connector:**

| Endpoint | Method | Purpose |
|---|---|---|
| `/users/@me/guilds` | GET | List guilds the bot belongs to |
| `/guilds/{id}/channels` | GET | List channels in a guild |
| `/channels/{id}/messages` | GET | Read messages (paginated, max 100/request) |
| `/channels/{id}/messages` | POST | Send a message |
| `/channels/{id}/messages/{id}/reactions/{emoji}/@me` | PUT | Add reaction |
| `/channels/{id}/messages/{id}` | PATCH | Edit a message |
| `/channels/{id}/messages/{id}` | DELETE | Delete a message |
| `/guilds/{id}` | GET | Get guild info (name, icon, member count) |
| `/channels/{id}` | GET | Get channel info |

### 2.2 Gateway (WebSocket)

Real-time event stream over WebSocket. Requires maintaining a persistent connection with heartbeats.

**For this connector: NOT recommended initially.** The connector pattern is request/response (tool calls), not event-driven. Gateway adds complexity (heartbeat, reconnection, sharding) with little benefit for on-demand tool invocations. Use REST API exclusively for v1.

**When Gateway makes sense later:** If the app needs real-time notifications (new messages, mentions) or presence information, Gateway would be the path. This would require architectural changes beyond the current connector model.

### 2.3 Interactions API

For slash commands and message components (buttons, dropdowns). Not relevant here -- the connector is the AI calling Discord, not Discord users calling the AI.

### 2.4 Rate Limits

Discord enforces rate limits per-route and globally:

- **Global:** 50 requests/second per bot
- **Per-route:** Varies; typically 5 requests per 5 seconds for message sends
- **Response headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `X-RateLimit-Bucket`
- **429 responses:** Include `Retry-After` header (seconds)

**Implementation strategy:**
- Parse `X-RateLimit-Remaining` and `X-RateLimit-Reset` from every response
- Queue requests when remaining = 0, wait until reset timestamp
- On 429: respect `Retry-After`, retry automatically
- Do NOT hardcode rate limits; they change per route and over time
- Consider a simple token bucket or leaky bucket per route bucket

---

## 3. Bot API vs User API (ToS Compliance)

### CRITICAL: Only use the Bot API

Discord explicitly prohibits automating user accounts ("self-bots"):

> "Automating normal user accounts (generally called 'self-bots') outside of the OAuth2/bot API is forbidden, and can result in an account termination if found."
> -- [Discord Support: Automated User Accounts](https://support.discord.com/hc/en-us/articles/115002192352)

**What this means for the connector:**

- **Bot tokens ONLY** -- obtained from the Discord Developer Portal
- Bots have a `[BOT]` tag next to their name in Discord
- Bots can only see channels they have permissions for
- Bots must be explicitly invited to each server via OAuth2 bot authorization flow
- No reading DMs of other users, no impersonating users

**Consequences of violation:** Account termination, potential legal action under Discord's Platform Manipulation Policy.

---

## 4. Authentication

### 4.1 Bot Token

The primary authentication method. A single token per bot application.

```
Authorization: Bot MTk4NjIy...
```

**Token management best practices:**
- Store encrypted in the app's credential store (the existing settings/secrets pattern)
- Never log or expose in error messages
- Environment variable `DISCORD_TOKEN` for the connector
- Tokens do not expire but can be regenerated in the Developer Portal
- If compromised: regenerate immediately in Developer Portal

### 4.2 OAuth2 (for bot installation)

The bot authorization flow lets server admins add the bot to their server:

```
https://discord.com/oauth2/authorize?client_id=APP_ID&scope=bot&permissions=PERMISSION_INT
```

**Required OAuth2 scopes:**
- `bot` -- adds the bot user to a guild
- `applications.commands` -- if using slash commands (optional for v1)

**Required bot permissions (bitfield):**
- `VIEW_CHANNEL` (1024) -- see channels
- `READ_MESSAGE_HISTORY` (65536) -- read past messages
- `SEND_MESSAGES` (2048) -- send messages
- `ADD_REACTIONS` (64) -- add reactions
- `EMBED_LINKS` (16384) -- for rich embeds
- Combined permission integer: `84992` (view + read + send + reactions + embeds)

### 4.3 Gateway Intents

If Gateway is used later, these intents would be needed:
- `GUILDS` (non-privileged) -- guild create/update/delete events
- `GUILD_MESSAGES` (non-privileged) -- message events in guilds
- `MESSAGE_CONTENT` (PRIVILEGED) -- access to message content; requires approval for bots in 100+ guilds

**For REST-only v1:** Intents are not relevant (they only apply to Gateway connections).

---

## 5. Per-Server Setup (Bot Installation)

### The Invitation Problem

Unlike the weather connector (no auth, works immediately), Discord requires the bot to be added to each server individually by a server admin with `MANAGE_SERVER` permission.

### Recommended UX Flow

1. **Settings page:** User enters their bot token (from Discord Developer Portal)
2. **Bot invite link:** App generates the OAuth2 authorize URL with correct permissions
3. **User opens link in browser** -> selects server -> authorizes
4. **App calls `/users/@me/guilds`** to discover which servers the bot is in
5. **Channel picker:** User selects default channels or the AI enumerates them on demand

### Setup Instructions to Surface in UI

1. Go to https://discord.com/developers/applications
2. Create a New Application
3. Go to Bot section, click "Add Bot"
4. Copy the bot token
5. Under "Privileged Gateway Intents", enable Message Content Intent (if needed)
6. Use the generated invite link to add bot to your server(s)

---

## 6. Library Recommendation

### discord.js vs Eris vs Raw REST

| Factor | discord.js | Eris | Raw fetch |
|---|---|---|---|
| Weekly downloads | ~350K | ~3K | N/A |
| GitHub stars | ~26K | ~1.5K | N/A |
| API coverage | 100% | Partial | As needed |
| Bundle size | Large (~2MB) | Medium (~500KB) | Minimal |
| Maintenance | Active | Fragmented/stale | N/A |
| Gateway required | Yes (core design) | Yes (core design) | No |
| TypeScript support | Excellent | Decent | Manual |

### Recommendation: Raw REST API with thin wrapper

**Neither discord.js nor Eris is a good fit** for this connector because:

1. Both libraries are designed around the Gateway WebSocket connection. They expect you to create a `Client`, call `.login()`, and maintain a persistent connection. This is fundamentally incompatible with the connector's request/response model.
2. The connector only needs ~10 REST endpoints. A thin typed wrapper around `fetch()` is simpler, lighter, and follows the pattern established by the weather connector's `api.ts`.
3. No dependency bloat. discord.js pulls in `@discordjs/rest`, `@discordjs/ws`, `discord-api-types`, and more.

**However**, `discord-api-types` (the types-only package) is useful for TypeScript definitions of Discord API objects without any runtime cost:

```bash
pnpm add -D discord-api-types
```

### Thin REST client pattern (matching weather/api.ts):

```typescript
const DISCORD_API = 'https://discord.com/api/v10';

async function discordFetch<T>(
  path: string,
  token: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (response.status === 429) {
    const retryAfter = parseFloat(response.headers.get('Retry-After') || '1');
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return discordFetch(path, token, options); // retry once
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord API ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}
```

---

## 7. Proposed Tool Definitions

Following the `ConnectorToolDefinition` pattern from `weather/tools.ts`:

### 7.1 discord_list_servers

List all servers (guilds) the bot belongs to.

```typescript
const listServersTool = tool(
  'discord_list_servers',
  'List all Discord servers the bot has access to.',
  {},
  async () => { /* GET /users/@me/guilds */ }
);
```
**Annotations:** `readOnlyHint: true`

### 7.2 discord_list_channels

List channels in a specific server.

```typescript
// Input: { server_id: string, type?: 'text' | 'voice' | 'category' | 'forum' }
// GET /guilds/{server_id}/channels
```
**Annotations:** `readOnlyHint: true`

### 7.3 discord_read_messages

Read recent messages from a channel with pagination.

```typescript
// Input: { channel_id: string, limit?: number (1-100, default 50), before?: string, after?: string }
// GET /channels/{channel_id}/messages?limit=N&before=snowflake
```
**Annotations:** `readOnlyHint: true`

### 7.4 discord_send_message

Send a message to a channel.

```typescript
// Input: { channel_id: string, content: string, reply_to?: string }
// POST /channels/{channel_id}/messages
```
**Annotations:** `readOnlyHint: false, destructiveHint: false`

### 7.5 discord_add_reaction

Add an emoji reaction to a message.

```typescript
// Input: { channel_id: string, message_id: string, emoji: string }
// PUT /channels/{channel_id}/messages/{message_id}/reactions/{emoji}/@me
```
**Annotations:** `readOnlyHint: false, destructiveHint: false`

### 7.6 discord_get_server_info

Get detailed information about a server.

```typescript
// Input: { server_id: string }
// GET /guilds/{server_id}
```
**Annotations:** `readOnlyHint: true`

### 7.7 discord_search_messages (stretch)

Discord does not have a public message search REST endpoint for bots. Implementation options:
- Paginate through channel history with `before`/`after` and filter client-side
- Use the undocumented `/guilds/{id}/messages/search` endpoint (risky, may break)
- Skip for v1, note as limitation

---

## 8. File Structure

Following the established connector pattern:

```
apps/server/src/connectors/discord/
  index.ts          # ConnectorDefinition export
  api.ts            # Thin REST client (discordFetch, typed endpoint wrappers)
  tools.ts          # Tool definitions using sdk `tool()` helper
  types.ts          # Discord-specific types (Guild, Channel, Message, etc.)
  discord.test.ts   # Tests using mocked fetch responses
```

### ConnectorDefinition (index.ts):

```typescript
export const discordConnector: ConnectorDefinition = {
  name: 'discord',
  displayName: 'Discord',
  description: 'Read and send messages, list servers and channels, and manage reactions on Discord.',
  icon: 'MessageCircle', // or a Discord-specific icon
  category: 'communication',
  requiresAuth: true,  // bot token required
  tools: discordTools,
};
```

### Registration (connectors/index.ts):

```typescript
import { discordConnector } from './discord';
const CONNECTORS: ConnectorDefinition[] = [weatherConnector, discordConnector];
```

---

## 9. Testing Strategy

### 9.1 Unit Tests with Mocked Fetch

Following the weather connector test pattern, mock `fetch` globally:

```typescript
import { describe, test, expect, mock, beforeEach } from 'bun:test';

// Mock Discord API responses
const mockGuilds = [
  { id: '123', name: 'Test Server', icon: null, owner: false, permissions: '2048' }
];

const mockMessages = [
  { id: '456', content: 'Hello', author: { id: '789', username: 'testuser' }, timestamp: '2026-03-25T00:00:00Z' }
];

// Test each API function with mocked responses
// Test rate limit handling (429 response -> retry)
// Test error handling (403 forbidden, 404 not found)
```

### 9.2 Integration Testing

- Create a dedicated Discord test server
- Use a real bot token (stored in CI secrets)
- Test actual API calls against the test server
- Clean up messages after tests

### 9.3 Key Test Scenarios

- List servers returns expected format
- List channels filters by type correctly
- Read messages handles pagination (before/after)
- Send message returns created message with ID
- Rate limit retry works (mock 429 then 200)
- Invalid token returns clear error
- Missing permissions returns clear error
- Empty server/channel lists handled gracefully
- Message content over 2000 chars is rejected client-side

---

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Rate limiting | Tool calls fail or slow down | Parse headers, implement backoff, surface wait time to user |
| Bot token leaked | Full bot access compromised | Encrypt in credential store, never log, rotation instructions |
| Message Content Intent | Bots in 100+ servers need Discord approval | Document in setup; REST API reads content without this intent (it's Gateway-only) |
| No message search API | Users expect search | Client-side filtering over paginated history; document limitation |
| Bot removed from server | API calls fail with 403 | Graceful error: "Bot no longer has access to this server" |
| Discord API changes | Breaking changes | Pin to API v10, use `discord-api-types` for type safety |
| Large message history | Slow pagination | Default limit of 50, max 100 per request; let AI paginate as needed |

---

## Existing MCP Discord Implementations (Reference)

Several open-source Discord MCP servers exist:

1. **[barryyip0625/mcp-discord](https://github.com/barryyip0625/mcp-discord)** (76 stars) -- Most complete. Tools: login, list_servers, send, get_server_info, read messages, manage channels, forum posts, reactions. Supports stdio and streamable HTTP transport.

2. **[SaseQ/discord-mcp](https://github.com/SaseQ/discord-mcp)** -- Discord integration for AI assistants with automation capabilities.

3. **[v-3/discordmcp](https://github.com/v-3/discordmcp)** -- Claude-specific Discord MCP integration.

4. **[tolgasumer/discord-mcp](https://github.com/tolgasumer/discord-mcp)** -- Full tool suite with real-time event streams.

**Key takeaway from existing implementations:** All use discord.js internally (which pulls in Gateway), but our connector should use raw REST to stay lightweight and match the existing connector architecture.

---

## Decision Summary

| Decision | Choice | Rationale |
|---|---|---|
| API approach | REST only (no Gateway) | Matches request/response connector model |
| Library | Raw fetch + discord-api-types | Lightweight, no Gateway dependency |
| Auth | Bot token | Only ToS-compliant option for automation |
| v1 tools | 6 tools (list servers, list channels, read, send, react, server info) | Core functionality without overscoping |
| Message search | Deferred to v2 | No public bot search endpoint |
| Rate limiting | Parse headers + automatic retry | Discord best practice |

---

## Sources

- [Discord Rate Limits Documentation](https://docs.discord.com/developers/topics/rate-limits)
- [Discord OAuth2 Documentation](https://docs.discord.com/developers/topics/oauth2)
- [Discord Bot Permissions and Intents Explained (2025)](https://friendify.net/blog/discord-bot-permissions-and-intents-explained-2025.html)
- [Discord Gateway Intents - discord.js Guide](https://discordjs.guide/legacy/popular-topics/intents)
- [Discord Automated User Accounts Policy](https://support.discord.com/hc/en-us/articles/115002192352)
- [Discord Platform Manipulation Policy](https://discord.com/safety/platform-manipulation-policy-explainer)
- [barryyip0625/mcp-discord GitHub](https://github.com/barryyip0625/mcp-discord)
- [SaseQ/discord-mcp GitHub](https://github.com/SaseQ/discord-mcp)
- [discord.js vs eris npm trends](https://npmtrends.com/discord.js-vs-eris)
- [Rate Limits & API Optimization - discord.js DeepWiki](https://deepwiki.com/discordjs/discord.js/5.3-rate-limits-and-api-optimization)
- [Building a MCP Server for Discord - Speakeasy](https://www.speakeasy.com/blog/build-a-mcp-server-tutorial)
- [Discord Channels Resource Documentation](https://discord.com/developers/docs/resources/channel)
