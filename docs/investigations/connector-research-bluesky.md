# Bluesky / AT Protocol Connector Research

**Issue:** #393
**Date:** 2026-03-25
**Status:** Research complete

---

## 1. Existing Implementations & Prior Art

### Existing Bluesky MCP Servers

| Implementation | Description | Key Features |
|---|---|---|
| [brianellin/bsky-mcp-server](https://github.com/brianellin/bsky-mcp-server) | Most mature TypeScript MCP server for Bluesky | Search posts, get profiles, convert URLs to AT URIs, get user posts, follow/unfollow, like/unlike |
| [berlinbra/bluesky](https://www.pulsemcp.com/servers/berlinbra-bluesky) | Profile and social graph focused | User analysis, network visualization, content discovery |
| [semioz/bluesky-mcp](https://mcpservers.org/servers/semioz/bluesky-mcp) | Claude Desktop integration | Installable via Smithery |
| [briangershon/bluesky-daily-mcp-server](https://github.com/briangershon/bluesky-daily-mcp-server) | Feed summarization | Solves "endless scroll" by summarizing daily feeds |

### Brian Ellin's bsky-mcp-server (Reference Implementation)

The most feature-complete existing MCP server provides these tools:

| Tool | Description |
|------|-------------|
| `search-posts` | Search posts by query |
| `get-profile` | Get a user's profile by handle or DID |
| `get-post-thread` | Get a post and its replies |
| `get-author-feed` | Get posts by a specific user |
| `convert-url-to-uri` | Convert Bluesky web URL to AT URI |
| `create-post` | Create a new post (with optional reply/quote) |
| `like-post` | Like a post by AT URI |
| `follow-user` | Follow a user by handle/DID |

**Architecture:** Uses `@atproto/api` with app password auth. Runs as stdio MCP server. All tools return plain text content blocks.

### Key Takeaway for Our Connector

Existing implementations are stdio-based MCP servers. Our connector uses in-process `createSdkMcpServer()` with the `tool()` helper, giving us tighter integration, no subprocess overhead, and direct access to our credential store. We should cover the reference tool set as baseline and add richer features like notifications, rich text composition, and feed management.

---

## 2. AT Protocol Architecture

### Core Concepts

The AT Protocol (Authenticated Transfer Protocol) is a federated social networking protocol built on these primitives:

| Concept | Description |
|---------|-------------|
| **DID** (Decentralized Identifier) | Permanent user identity (e.g., `did:plc:abc123`). Immutable, survives handle changes. |
| **Handle** | Human-readable username (e.g., `alice.bsky.social` or custom domain `alice.com`). DNS-based resolution. |
| **PDS** (Personal Data Server) | Hosts user data (repos). Users can self-host or use `bsky.social`. |
| **AppView** | Aggregates data from across the network. Bluesky's AppView is at `api.bsky.app`. |
| **Relay (Firehose)** | Streams all network events for indexing. |
| **Lexicon** | Schema language for API methods and record types (JSON Schema-like). |
| **NSID** | Namespaced identifier for lexicons (e.g., `app.bsky.feed.post`). |
| **XRPC** | HTTP-based RPC protocol. Thin wrapper around HTTPS with defined schemas. |
| **Repository** | Signed Merkle tree of user records, stored on their PDS. |

### Bluesky-Specific Namespaces (app.bsky.*)

| Namespace | Purpose | Key Types |
|-----------|---------|-----------|
| `app.bsky.actor` | User profiles and preferences | `profile`, `searchActors`, `getProfile` |
| `app.bsky.feed` | Posts, feeds, timelines | `post`, `like`, `repost`, `threadgate`, `getTimeline`, `getAuthorFeed`, `searchPosts` |
| `app.bsky.graph` | Social graph | `follow`, `block`, `list`, `getFollows`, `getFollowers` |
| `app.bsky.notification` | Notifications | `listNotifications`, `updateSeen` |
| `app.bsky.embed` | Post embeds | `images`, `external` (link cards), `record` (quotes), `recordWithMedia` |
| `app.bsky.richtext` | Rich text annotations | `facet` (mentions, links, tags) |

### Request Routing

- **Public endpoints** (no auth required): `https://public.api.bsky.app/xrpc/...`
- **Authenticated endpoints**: Route to user's PDS (e.g., `https://bsky.social/xrpc/...`), which proxies to AppView as needed
- **Service proxying**: PDS automatically proxies `app.bsky.*` queries to the AppView

---

## 3. Library Selection: `@atproto/api`

### Overview

`@atproto/api` is the official TypeScript SDK for the AT Protocol. ~38K weekly npm downloads. Actively maintained by the Bluesky team.

### Key Features

| Feature | Details |
|---------|---------|
| **Full TypeScript types** | All lexicon types generated from schema, including type guards (`isRecord()`, `validateRecord()`) |
| **Agent class** | High-level client with session management, auto-refresh, service proxying |
| **RichText** | UTF-8 facet detection for mentions, links, hashtags. Handles JS UTF-16 to AT Protocol UTF-8 conversion |
| **Moderation** | Built-in moderation/labeling APIs |
| **Weight** | ~200KB (reasonable for server-side use) |
| **Runtime** | Works with Node.js and Bun |

### Agent vs CredentialSession

```typescript
// Option A: BskyAgent (convenience wrapper, slightly deprecated naming)
import { BskyAgent } from '@atproto/api'
const agent = new BskyAgent({ service: 'https://bsky.social' })
await agent.login({ identifier: 'handle.bsky.social', password: 'app-password' })

// Option B: Agent + CredentialSession (newer, preferred pattern)
import { Agent, CredentialSession } from '@atproto/api'
const session = new CredentialSession(new URL('https://bsky.social'))
await session.login({ identifier: 'handle.bsky.social', password: 'app-password' })
const agent = new Agent(session)
```

### RichText Usage

```typescript
import { RichText } from '@atproto/api'

const rt = new RichText({
  text: 'Hello @alice.bsky.social! Check out https://example.com #atproto',
})
await rt.detectFacets(agent) // resolves handles to DIDs, detects links and tags

const postRecord = {
  $type: 'app.bsky.feed.post',
  text: rt.text,
  facets: rt.facets,
  createdAt: new Date().toISOString(),
}
```

**Critical:** Always use `RichText.detectFacets()` for post creation. JavaScript uses UTF-16 internally but AT Protocol facets use UTF-8 byte offsets. Manual facet construction is error-prone and will produce corrupted mentions/links.

### Recommendation

Use `@atproto/api` exclusively. No alternative libraries needed. It covers authentication, all API endpoints, rich text, and moderation in a single well-typed package.

---

## 4. Authentication & Session Management

### Authentication Methods

| Method | Status | Use Case |
|--------|--------|----------|
| **App Passwords** | Stable, widely used | Desktop apps, bots, MCP servers. Simple username+password auth. |
| **OAuth (DPoP)** | Production-ready (2025+) | Web apps, third-party clients needing granular scopes. |
| **createSession** (direct password) | Deprecated for production | Original auth flow, being replaced by OAuth. |

### App Passwords (Recommended for V1)

App passwords are special credentials generated from Bluesky Settings > App Passwords. They:
- Are scoped to the app (revocable independently of main password)
- Work with `createSession` / `agent.login()`
- Don't require OAuth infrastructure
- Are the standard approach for MCP servers and bots

```typescript
// App password auth flow
const agent = new Agent(new CredentialSession(new URL('https://bsky.social')))
await agent.login({
  identifier: 'user.bsky.social',   // handle or DID
  password: 'xxxx-xxxx-xxxx-xxxx',  // app password (NOT main password)
})
```

### Session Refresh

The `@atproto/api` Agent automatically manages session tokens:
- `accessJwt` -- short-lived (~2 hours), used for API requests
- `refreshJwt` -- longer-lived (~90 days), used to obtain new access tokens
- Agent handles refresh transparently on 401 responses

```typescript
// Session persistence (save/restore across restarts)
const session = new CredentialSession(new URL('https://bsky.social'))

// Save session after login
session.addEventListener('update', () => {
  saveToCredentialStore({
    did: session.did,
    handle: session.handle,
    accessJwt: session.accessJwt,
    refreshJwt: session.refreshJwt,
  })
})

// Restore session on startup
await session.resumeSession(savedSession)
```

### OAuth with DPoP (V2 / Future)

AT Protocol OAuth mandates DPoP (Demonstrating Proof of Possession):
- Each session gets a unique ES256 keypair
- DPoP nonces rotate every 5 minutes max
- Access tokens expire in < 30 minutes (5 min recommended)
- Granular scopes for specific record types and endpoints
- Official packages: `@atproto/oauth-client-node`, `@atproto/oauth-client-browser`

**For V1:** Use app passwords. OAuth adds significant complexity (DPoP key management, nonce tracking, callback URLs) with no functional benefit for a desktop MCP connector. Migrate to OAuth in V2 when granular scopes become important.

### Token Storage

Store in our existing credential system (SQLite `credentials` table, encrypted):

```typescript
interface BlueskyCredentials {
  did: string;              // did:plc:...
  handle: string;           // user.bsky.social
  service: string;          // https://bsky.social (or custom PDS)
  accessJwt: string;        // short-lived access token
  refreshJwt: string;       // long-lived refresh token
  appPassword?: string;     // stored for re-auth if refresh expires
}
```

---

## 5. Post Creation & Rich Text (Facets)

### Post Record Schema

```typescript
// app.bsky.feed.post record
{
  $type: 'app.bsky.feed.post',
  text: string,                    // max 300 graphemes (NOT characters)
  facets?: Facet[],                // rich text annotations
  reply?: ReplyRef,                // parent + root references for threads
  embed?: Embed,                   // images, link cards, quotes
  langs?: string[],                // language tags (e.g., ['en'])
  tags?: string[],                 // topic tags (not displayed, for feed generators)
  createdAt: string,               // ISO 8601 timestamp
}
```

### Rich Text Facets

Facets annotate byte ranges of the text with semantic meaning:

```typescript
interface Facet {
  index: {
    byteStart: number,  // UTF-8 byte offset (inclusive)
    byteEnd: number,    // UTF-8 byte offset (exclusive)
  },
  features: FacetFeature[],
}

// Feature types
type FacetFeature =
  | { $type: 'app.bsky.richtext.facet#mention', did: string }
  | { $type: 'app.bsky.richtext.facet#link', uri: string }
  | { $type: 'app.bsky.richtext.facet#tag', tag: string }
```

**Critical Implementation Detail:** Facet indices are UTF-8 byte offsets, NOT JavaScript string indices (which are UTF-16 code units). Emoji and non-ASCII characters have different byte lengths in UTF-8 vs UTF-16. Always use the `RichText` class.

### Embed Types

| Embed Type | Lexicon | Description |
|------------|---------|-------------|
| **Images** | `app.bsky.embed.images` | Up to 4 images per post. Upload via `com.atproto.repo.uploadBlob`, then reference blob in embed. Alt text supported. |
| **External Link** | `app.bsky.embed.external` | Link card with title, description, thumbnail. Client must fetch OG metadata and upload thumbnail. |
| **Quote Post** | `app.bsky.embed.record` | Embeds another post by AT URI + CID reference. |
| **Quote + Media** | `app.bsky.embed.recordWithMedia` | Quote post combined with images or external link. |

### Reply Threading

```typescript
// Creating a reply
{
  $type: 'app.bsky.feed.post',
  text: 'My reply',
  reply: {
    root: { uri: 'at://did:plc:.../app.bsky.feed.post/root-rkey', cid: '...' },
    parent: { uri: 'at://did:plc:.../app.bsky.feed.post/parent-rkey', cid: '...' },
  },
  createdAt: new Date().toISOString(),
}
```

Both `root` (original thread starter) and `parent` (immediate post being replied to) are required. For a direct reply to the root post, `root` and `parent` are the same.

### Best Practices

1. **Always use `RichText.detectFacets(agent)`** for mention/link/tag detection
2. **Validate text length** in graphemes (not bytes or JS string length): max 300 graphemes
3. **Set `createdAt`** to current time -- omitting it causes display issues
4. **Include `langs`** when known -- improves feed algorithm relevance
5. **Link cards require client-side work** -- fetch Open Graph metadata and upload thumbnail before posting

---

## 6. Feed Algorithms & Cursor-Based Pagination

### Feed Types

| Endpoint | Description | Auth Required |
|----------|-------------|---------------|
| `app.bsky.feed.getTimeline` | User's home timeline (following + algorithmic) | Yes |
| `app.bsky.feed.getAuthorFeed` | Posts by a specific user | No (public) |
| `app.bsky.feed.getFeed` | Custom feed generator output | Varies |
| `app.bsky.feed.searchPosts` | Full-text search across posts | No (public) |
| `app.bsky.feed.getPostThread` | Single post with reply tree | No (public) |
| `app.bsky.feed.getLikes` | Posts liked by a user | No (public) |

### Cursor-Based Pagination

All list/feed endpoints use opaque cursor strings:

```typescript
// Paginated feed retrieval
let cursor: string | undefined
const posts = []

do {
  const response = await agent.getAuthorFeed({
    actor: 'alice.bsky.social',
    limit: 50,       // max 100
    cursor,
    filter: 'posts_no_replies',  // optional filter
  })
  posts.push(...response.data.feed)
  cursor = response.data.cursor
} while (cursor)
```

### Cursor Best Practices

- **Cursors are opaque** -- don't parse or construct them; just pass them back
- **Recommended compound format** for custom feeds: `timestamp::cid` (e.g., `1683654690921::bafyreia3...`)
- **Cursors may expire** -- use them within minutes, not hours
- **Empty/undefined cursor** signals end of results
- **For MCP tools:** Return one page per call with optional cursor input, letting the LLM paginate as needed

### Feed Filters for `getAuthorFeed`

| Filter | Description |
|--------|-------------|
| `posts_with_replies` | All posts including replies |
| `posts_no_replies` | Original posts only |
| `posts_with_media` | Only posts containing images/video |
| `posts_and_author_threads` | Posts + threads authored by the user |

### Tool Design Pattern

```typescript
// Return a page + cursor for the LLM to paginate
{
  posts: [...],
  cursor: "abc123" | null,
  has_more: true
}
```

---

## 7. Notifications, Social Graph & Interactions

### Notifications (`app.bsky.notification`)

| Endpoint | Description |
|----------|-------------|
| `listNotifications` | Get notifications (likes, replies, follows, mentions, quotes, reposts) |
| `getUnreadCount` | Count of unread notifications |
| `updateSeen` | Mark notifications as read up to a timestamp |

Notifications include a `reason` field: `like`, `repost`, `follow`, `mention`, `reply`, `quote`, `starterpack-joined`.

### Social Graph (`app.bsky.graph`)

| Action | Method | Description |
|--------|--------|-------------|
| Follow | `agent.follow(did)` | Creates `app.bsky.graph.follow` record |
| Unfollow | `agent.deleteFollow(followUri)` | Deletes the follow record |
| Get follows | `agent.getFollows({ actor })` | Paginated list of who a user follows |
| Get followers | `agent.getFollowers({ actor })` | Paginated list of a user's followers |
| Mute | `agent.mute(did)` | Mute a user |
| Block | `agent.app.bsky.graph.block.create(...)` | Block a user |
| Get relationships | `getRelationships` | Check follow/block/mute status between users |

### Engagement Actions

| Action | Method | Record Type |
|--------|--------|-------------|
| Like | `agent.like(uri, cid)` | `app.bsky.feed.like` |
| Unlike | `agent.deleteLike(likeUri)` | Deletes like record |
| Repost | `agent.repost(uri, cid)` | `app.bsky.feed.repost` |
| Unrepost | `agent.deleteRepost(repostUri)` | Deletes repost record |

**Note:** Like, repost, and follow are all records in the user's repository. "Deleting" an action means deleting the corresponding record by its AT URI.

---

## 8. Rate Limits & API Considerations

### Rate Limiting

The AT Protocol does not have a formal published rate limit tier system like Slack or Twitter. However:

- **PDS-level limits**: Individual PDS instances may enforce their own rate limits
- **AppView limits**: The public Bluesky AppView (`public.api.bsky.app`) has undocumented rate limits
- **General guidance**: Respect `429 Too Many Requests` with `Retry-After` header
- **Unauthenticated requests** are more heavily rate-limited than authenticated ones

### Best Practices

1. **Authenticate all requests** -- lower rate limit risk
2. **Implement exponential backoff** on 429 responses
3. **Cache profiles and feed data** with short TTLs (2-5 min)
4. **Use pagination limits** -- request 50-100 items per page, not max
5. **Avoid polling loops** -- no real-time events needed for MCP tools

### API Advantages Over Other Platforms

| Advantage | Details |
|-----------|---------|
| **Free access** | No API pricing tiers, no developer account approval needed |
| **No app review** | No Twitter-style app review process. Create app passwords immediately. |
| **Open protocol** | Fully documented, open-source reference implementations |
| **Public endpoints** | Many read endpoints work without authentication |
| **Self-hostable** | Can run your own PDS for full data sovereignty |
| **Generous limits** | No per-month post caps or search restrictions |
| **Developer-friendly** | Active developer community, responsive maintainers |

---

## 9. Testing Strategy

### Testing Infrastructure

| Resource | Description |
|----------|-------------|
| **`@atproto/dev-env`** | Local network with PDS, AppView, Ozone, and supporting services. Full integration testing. |
| **[PDS.RIP](https://pds.rip/)** | Public ephemeral sandbox PDS. Accounts wiped weekly. Good for manual testing. |
| **Mock fetch** | Our standard pattern -- intercept `globalThis.fetch` in bun:test |
| **MCP Inspector** | Test tools directly: `npx @modelcontextprotocol/inspector` |

### Recommended Testing Approach

Following our existing weather connector pattern (mock `globalThis.fetch`):

1. **Mock `fetch` globally** -- intercept calls to `https://bsky.social/xrpc/*` and `https://public.api.bsky.app/xrpc/*`
2. **Create test data factories** -- `makePostResponse()`, `makeProfileResponse()`, `makeFeedResponse()`, `makeNotificationResponse()`
3. **Router-based mock** -- route by XRPC method name to appropriate mock response
4. **Test error paths** -- expired sessions (401), rate limits (429), invalid handles, deleted posts
5. **Test pagination** -- verify cursor forwarding and empty-cursor termination
6. **Test RichText** -- verify facet generation for mentions, links, tags

```typescript
// Example test pattern (bun:test)
describe('Bluesky API', () => {
  afterEach(() => restoreFetch());

  test('gets user profile', async () => {
    mockFetch(createXrpcRouter({
      'app.bsky.actor.getProfile': {
        did: 'did:plc:abc123',
        handle: 'alice.bsky.social',
        displayName: 'Alice',
        followersCount: 100,
        followsCount: 50,
        postsCount: 200,
      },
    }));
    const result = await getProfile('alice.bsky.social');
    expect(result.handle).toBe('alice.bsky.social');
  });

  test('creates post with rich text', async () => {
    mockFetch(createXrpcRouter({
      'com.atproto.identity.resolveHandle': { did: 'did:plc:mentioned' },
      'com.atproto.repo.createRecord': { uri: 'at://...', cid: '...' },
    }));
    const result = await createPost('Hello @someone.bsky.social!');
    expect(result.uri).toBeDefined();
  });
});
```

### Integration Testing (Optional)

For integration tests against a real network, use a dedicated test account on `bsky.social` with an app password stored in env vars. Gate these tests behind an `INTEGRATION_TEST` flag so they don't run in CI by default.

---

## 10. Proposed Tool Set & File Structure

### Tools (Phase 1 -- Core)

| Tool | Annotations | Description |
|------|-------------|-------------|
| `bluesky_get_profile` | readOnly | Get a user's profile by handle or DID |
| `bluesky_get_timeline` | readOnly | Get authenticated user's home timeline |
| `bluesky_get_author_feed` | readOnly | Get posts by a specific user with filtering |
| `bluesky_get_post_thread` | readOnly | Get a post and its reply thread |
| `bluesky_search_posts` | readOnly | Search posts by query |
| `bluesky_create_post` | destructive | Create a post with rich text, optional reply/quote |
| `bluesky_like_post` | destructive | Like a post by AT URI |
| `bluesky_get_notifications` | readOnly | Get recent notifications |

### Tools (Phase 2 -- Extended)

| Tool | Description |
|------|-------------|
| `bluesky_follow_user` | Follow a user by handle or DID |
| `bluesky_unfollow_user` | Unfollow a user |
| `bluesky_repost` | Repost a post |
| `bluesky_delete_post` | Delete own post by AT URI |
| `bluesky_get_followers` | Get a user's followers (paginated) |
| `bluesky_get_follows` | Get who a user follows (paginated) |
| `bluesky_search_actors` | Search for users by query |
| `bluesky_get_feed` | Get posts from a custom feed generator |
| `bluesky_upload_image` | Upload an image blob for embedding |

### File Structure

```
apps/server/src/connectors/bluesky/
  index.ts          -- ConnectorDefinition export
  tools.ts          -- Tool definitions using sdk `tool()` helper
  api.ts            -- BlueskyApiClient wrapper around @atproto/api Agent
  types.ts          -- Bluesky-specific TypeScript interfaces
  formatters.ts     -- Post/profile/notification formatting for LLM consumption
  bluesky.test.ts   -- Tests with mocked fetch (bun:test)
```

### ConnectorDefinition

```typescript
export const blueskyConnector: ConnectorDefinition = {
  name: 'bluesky',
  displayName: 'Bluesky',
  description: 'Read and create posts, search content, manage your social graph, and get notifications on Bluesky.',
  icon: '🦋',
  category: 'communication',
  requiresAuth: true,
  tools: blueskyTools,
};
```

### Example Tool Implementation

```typescript
const getProfileTool = tool(
  'bluesky_get_profile',
  'Get a Bluesky user profile by handle (e.g. alice.bsky.social) or DID.',
  {
    actor: z.string().describe('Handle (e.g. "alice.bsky.social") or DID (e.g. "did:plc:...")'),
  },
  async (args) => {
    try {
      const agent = await getAuthenticatedAgent();
      const { data } = await agent.getProfile({ actor: args.actor });

      const text = [
        `Profile: ${data.displayName ?? data.handle}`,
        `Handle: @${data.handle}`,
        `DID: ${data.did}`,
        `Bio: ${data.description ?? '(none)'}`,
        '',
        `Posts: ${data.postsCount ?? 0}`,
        `Followers: ${data.followersCount ?? 0}`,
        `Following: ${data.followsCount ?? 0}`,
        data.viewer?.following ? '(You follow this user)' : '',
        data.viewer?.followedBy ? '(This user follows you)' : '',
      ].filter(Boolean).join('\n');

      return { content: [{ type: 'text' as const, text }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
    }
  },
  {
    annotations: {
      title: 'Bluesky Profile',
      readOnlyHint: true,
      openWorldHint: true,
    },
  }
);

const createPostTool = tool(
  'bluesky_create_post',
  'Create a new post on Bluesky. Supports mentions (@handle), links, and hashtags. Optionally reply to or quote another post.',
  {
    text: z.string().max(300).describe('Post text (max 300 graphemes). Mentions, links, and hashtags are auto-detected.'),
    reply_to: z.string().optional().describe('AT URI of post to reply to (e.g. "at://did:plc:.../app.bsky.feed.post/...")'),
    quote: z.string().optional().describe('AT URI of post to quote'),
    langs: z.array(z.string()).optional().describe('Language tags (e.g. ["en"])'),
  },
  async (args) => {
    try {
      const agent = await getAuthenticatedAgent();
      const rt = new RichText({ text: args.text });
      await rt.detectFacets(agent);

      const record: any = {
        $type: 'app.bsky.feed.post',
        text: rt.text,
        facets: rt.facets,
        langs: args.langs,
        createdAt: new Date().toISOString(),
      };

      // Handle reply threading
      if (args.reply_to) {
        const thread = await agent.getPostThread({ uri: args.reply_to, depth: 0 });
        const parent = thread.data.thread.post;
        record.reply = {
          root: parent.record.reply?.root ?? { uri: parent.uri, cid: parent.cid },
          parent: { uri: parent.uri, cid: parent.cid },
        };
      }

      // Handle quote embed
      if (args.quote) {
        const quoted = await agent.getPostThread({ uri: args.quote, depth: 0 });
        record.embed = {
          $type: 'app.bsky.embed.record',
          record: { uri: quoted.data.thread.post.uri, cid: quoted.data.thread.post.cid },
        };
      }

      const result = await agent.post(record);
      return { content: [{ type: 'text' as const, text: `Post created: ${result.uri}` }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
    }
  },
  {
    annotations: {
      title: 'Create Bluesky Post',
      readOnlyHint: false,
      openWorldHint: true,
    },
  }
);
```

---

## Summary of Recommendations

1. **Library:** `@atproto/api` (official SDK) -- full TypeScript types, session management, RichText handling
2. **Auth (V1):** App passwords via `agent.login()` with session persistence and auto-refresh
3. **Auth (V2):** OAuth with DPoP via `@atproto/oauth-client-node` for granular scopes
4. **Rich text:** Always use `RichText.detectFacets()` -- never manually construct facet byte offsets
5. **Pagination:** Cursor-based, one page per tool call, expose cursor to LLM
6. **Rate limits:** Implement exponential backoff on 429; cache profiles/feeds (2-5 min TTL)
7. **Post creation:** Support text, mentions, links, hashtags, replies, quotes. Image embeds in Phase 2.
8. **Testing:** Mock `globalThis.fetch` (bun:test), XRPC router pattern, factory functions for test data
9. **File structure:** `bluesky/{index,tools,api,types,formatters,bluesky.test}.ts`
10. **Phase 1 tools:** 8 core tools covering profiles, timelines, feeds, threads, search, posting, likes, notifications

---

## Sources

- [brianellin/bsky-mcp-server | GitHub](https://github.com/brianellin/bsky-mcp-server)
- [@atproto/api | npm](https://www.npmjs.com/package/@atproto/api)
- [Get Started | Bluesky Developer Docs](https://docs.bsky.app/docs/get-started)
- [Posts | Bluesky Developer Docs](https://docs.bsky.app/docs/advanced-guides/posts)
- [Links, mentions, and rich text | Bluesky Developer Docs](https://docs.bsky.app/docs/advanced-guides/post-richtext)
- [Creating a post | Bluesky Developer Docs](https://docs.bsky.app/docs/tutorials/creating-a-post)
- [Posting via the Bluesky API | Bluesky Blog](https://docs.bsky.app/blog/create-post)
- [The AT Protocol | Bluesky Developer Docs](https://docs.bsky.app/docs/advanced-guides/atproto)
- [OAuth Client Implementation | Bluesky Developer Docs](https://docs.bsky.app/docs/advanced-guides/oauth-client)
- [OAuth for AT Protocol | Bluesky Blog](https://docs.bsky.app/blog/oauth-atproto)
- [OAuth - AT Protocol Spec](https://atproto.com/specs/oauth)
- [Lexicons - AT Protocol Docs](https://atproto.com/guides/lexicon)
- [AT Protocol XRPC API | Bluesky Developer Docs](https://docs.bsky.app/docs/api/at-protocol-xrpc-api)
- [Custom Feeds | Bluesky Developer Docs](https://docs.bsky.app/docs/starter-templates/custom-feeds)
- [Viewing feeds | Bluesky Developer Docs](https://docs.bsky.app/docs/tutorials/viewing-feeds)
- [Federation Developer Sandbox Guidelines | Bluesky Blog](https://docs.bsky.app/blog/federation-sandbox)
- [2025 Protocol Roadmap | Bluesky Blog](https://docs.bsky.app/blog/2025-protocol-roadmap-spring)
- [@atproto/api v0.14.0 Release Notes | Bluesky Blog](https://docs.bsky.app/blog/api-v0-14-0-release-notes)
- [TypeScript API Package Auth Refactor | Bluesky Blog](https://docs.bsky.app/blog/ts-api-refactor)
- [bluesky-social/atproto | GitHub](https://github.com/bluesky-social/atproto)
- [PDS.RIP - Ephemeral Sandbox PDS](https://pds.rip/)
- [Quick start guide to building applications on AT Protocol](https://atproto.com/guides/applications)
