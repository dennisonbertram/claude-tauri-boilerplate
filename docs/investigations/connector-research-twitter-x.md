# Twitter/X Connector Research

**Issue**: #391
**Date**: 2026-03-25
**Status**: Research Complete

---

## 1. Executive Summary

This document captures research for building a Twitter/X connector following the existing ConnectorDefinition pattern (weather connector as reference). The X API v2 is the only viable official path. The Free tier is write-only (~500 posts/month, no read access), making it insufficient for a useful connector. The Basic tier ($200/month) unlocks read endpoints (timelines, search, bookmarks, lists) but is expensive for individual users. OAuth 2.0 with PKCE is the required auth flow for user-context endpoints. The recommended TypeScript client library is `twitter-api-v2` (npm), which provides strong typing, automatic pagination, and rate-limit handling.

---

## 2. Existing Twitter/X MCP Server Implementations

Several community MCP servers already exist:

| Project | URL | Notes |
|---------|-----|-------|
| **crazyrabbitLTC/mcp-twitter-server** | [GitHub](https://github.com/crazyrabbitLTC/mcp-twitter-server) | 53 tools, uses `twitter-api-v2` + SocialData.tools for enhanced research. Most comprehensive. |
| **EnesCinr/twitter-mcp** | [GitHub](https://github.com/EnesCinr/twitter-mcp) | Basic posting and search. |
| **lord-dubious/x-mcp** | [GitHub](https://github.com/lord-dubious/x-mcp) | Uses Twikit (Python library) for scraping-based access. Bridges LLMs to Twitter without official API. |
| **armatrix/x-twitter** | [PulseMCP](https://www.pulsemcp.com/servers/gh-armatrix-x-twitter) | Hybrid API architecture for search, timelines, posting. |
| **X API MCP Server** | [MCP Market](https://mcpmarket.com/server/x-api) | Full X API v2 wrapper for Claude/ChatGPT. |

**Key takeaway**: The crazyrabbitLTC implementation is the best reference. It uses the same stack we would (TypeScript, `twitter-api-v2` npm package, MCP SDK, zod). However, all of these are standalone MCP servers, not in-process connectors matching our ConnectorDefinition pattern.

---

## 3. X API v2 Endpoint Coverage

### Core Endpoints by Category

| Category | Endpoints | Auth Required | Min Tier |
|----------|-----------|---------------|----------|
| **Tweets** | POST /2/tweets, DELETE /2/tweets/:id | User Context (PKCE) | Free |
| **Tweet Lookup** | GET /2/tweets/:id, GET /2/tweets | App-Only or User | Basic |
| **User Timeline** | GET /2/users/:id/tweets | App-Only or User | Basic |
| **Mentions** | GET /2/users/:id/mentions | App-Only or User | Basic |
| **Search** | GET /2/tweets/search/recent | App-Only or User | Basic |
| **Full-Archive Search** | GET /2/tweets/search/all | User Context | Pro |
| **Bookmarks** | GET/POST /2/users/:id/bookmarks | User Context (PKCE) | Basic |
| **Lists** | GET/POST /2/lists, manage members | User Context (PKCE) | Basic |
| **DMs** | GET /2/dm_conversations, POST messages | User Context (PKCE) | Basic |
| **Likes** | POST /2/users/:id/likes | User Context (PKCE) | Basic* |
| **Follows** | POST /2/users/:id/following | User Context (PKCE) | Basic* |
| **Media Upload** | POST /2/media/upload (chunked) | User Context + media.write | Basic |

*Note: As of August 2025, likes and follows were removed from the Free tier without warning.

### Useful Fields (via `tweet.fields` and `expansions`)
- `public_metrics` (likes, retweets, replies, impressions)
- `author_id` with `user.fields=profile_image_url,verified,description`
- `referenced_tweets` for quotes/replies/retweets
- `attachments` with media expansions

---

## 4. Pricing Tiers (as of March 2026)

| Tier | Monthly Cost | Posts/Month | Reads/Month | Key Features |
|------|-------------|-------------|-------------|--------------|
| **Free** | $0 | ~500 | 0 (write-only) | POST tweets only. No read, search, likes, follows. |
| **Basic** | $200 | 10,000 | 10,000 | Read tweets, search (recent), timelines, bookmarks, lists, DMs. |
| **Pro** | $5,000 | 1,000,000 | 1,000,000 | Full-archive search, streaming, high volume. |
| **Enterprise** | $42,000+ | 50,000,000+ | Custom | Firehose-level access. |
| **Pay-Per-Use** | Variable | Per-operation | Per-operation | Launched Feb 2026. No monthly commitment. Different prices per operation type. |

### Free Tier Reality
- Can only POST up to ~500 tweets/month (some sources say 1,500 -- the number has changed over time)
- **Cannot read tweets, search, view timelines, access bookmarks, or use most GET endpoints**
- Rate limits use 24-hour windows (extremely restrictive vs. 15-minute windows on paid tiers)
- Practically useless for a connector that needs to read data

### Recommendation
The **Pay-Per-Use** tier (launched Feb 2026) is the most practical for individual users who want occasional read+write access without a $200/month commitment. The connector should be designed to work with any tier but document that Free tier is write-only.

---

## 5. Authentication: OAuth 2.0 with PKCE

### Flow Overview
1. App generates a `code_verifier` (random string) and derives `code_challenge` (SHA-256 hash)
2. User is redirected to `https://twitter.com/i/oauth2/authorize` with scopes, challenge, and callback URL
3. User authorizes the app on twitter.com
4. X redirects back with an authorization `code`
5. App exchanges `code` + `code_verifier` for an access token + refresh token
6. Access tokens expire in **2 hours**; use refresh token (requires `offline.access` scope) to renew

### Required Scopes

| Scope | Purpose |
|-------|---------|
| `tweet.read` | Read tweets, timelines, search |
| `tweet.write` | Post and delete tweets |
| `users.read` | Read user profiles |
| `offline.access` | Get refresh token for persistent access |
| `bookmark.read` | Read bookmarks |
| `bookmark.write` | Add/remove bookmarks |
| `list.read` | Read lists |
| `list.write` | Create/manage lists |
| `dm.read` | Read DMs |
| `dm.write` | Send DMs |
| `like.read` | Read likes |
| `like.write` | Like/unlike tweets |
| `follows.read` | Read follows |
| `follows.write` | Follow/unfollow |
| `media.write` | Upload media (images, video) |

### App-Only vs User Context
- **App-Only (Bearer Token)**: Rate-limited per app. Can access public data (tweet lookup, user lookup, recent search) but cannot perform user actions (post, like, bookmark).
- **User Context (PKCE)**: Rate-limited per user. Required for all write operations and private data (DMs, bookmarks). This is what the connector needs.

### Implementation Notes for Tauri Desktop App
- The callback URL for PKCE can use a custom scheme (e.g., `tauri://oauth/twitter`) or a localhost redirect
- Store refresh tokens securely in the app's credential store (not in SQLite)
- Implement automatic token refresh before expiry (check remaining TTL on each request)

---

## 6. Rate Limit Handling Best Practices

### Rate Limit Headers
Every X API response includes:
- `x-rate-limit-limit`: Max requests in window
- `x-rate-limit-remaining`: Remaining requests
- `x-rate-limit-reset`: Unix timestamp when window resets

### Implementation Strategy
```typescript
// The twitter-api-v2 package handles this via plugin:
import { TwitterApi } from 'twitter-api-v2';
import { TwitterApiRateLimitPlugin } from '@twitter-api-v2/plugin-rate-limit';

const rateLimitPlugin = new TwitterApiRateLimitPlugin();
const client = new TwitterApi('token', { plugins: [rateLimitPlugin] });

// Check before making a call:
const rateLimit = await rateLimitPlugin.v2.getRateLimit('tweets/:id');
if (rateLimit && rateLimit.remaining === 0) {
  const resetMs = rateLimit.reset * 1000 - Date.now();
  // Wait or return cached data
}
```

### Recommended Patterns
1. **Proactive checking**: Read rate limit headers after each response; pause before hitting zero
2. **Exponential backoff**: On 429 responses, back off 1s -> 2s -> 4s -> 8s -> max 60s
3. **Request coalescing**: Batch tweet lookups (up to 100 IDs per request) instead of individual fetches
4. **Caching**: Cache user profiles (change rarely), tweet data (immutable except metrics), and search results (short TTL)
5. **Monthly budget tracking**: Track cumulative reads/writes against tier limits; warn user when approaching cap

---

## 7. Tweet Formatting and Thread Construction

### Thread Construction
X API does not support posting a thread atomically. The process is:
1. Post the first tweet via `POST /2/tweets`
2. Get the returned tweet ID
3. Post each subsequent tweet with `reply: { in_reply_to_tweet_id: previousId }`
4. If any tweet in the chain fails, the thread is partially posted (no rollback)

```typescript
async function postThread(client: TwitterApi, tweets: string[]): Promise<string[]> {
  const ids: string[] = [];
  let replyTo: string | undefined;

  for (const text of tweets) {
    const params: any = { text };
    if (replyTo) {
      params.reply = { in_reply_to_tweet_id: replyTo };
    }
    const result = await client.v2.tweet(params);
    ids.push(result.data.id);
    replyTo = result.data.id;
  }
  return ids;
}
```

### Character Limits
- Standard tweet: 280 characters
- X Premium subscribers: 25,000 characters
- URLs count as 23 characters regardless of actual length (t.co wrapping)

### Media Attachment
- Up to 4 images OR 1 video OR 1 animated GIF per tweet
- Images: JPEG, PNG, GIF, WEBP (max 5MB standard, 15MB via API)
- Video: MP4 (max 512MB, up to 140 seconds for standard, longer for Premium)
- Chunked upload required for files > 5MB: INIT -> APPEND (chunks) -> FINALIZE
- Media upload uses v2 endpoint: `POST /2/media/upload`

---

## 8. Testing Strategy

### No Official Sandbox for v2
X does **not** provide a sandbox/test environment for API v2. The only official sandbox is for the Ads API (different product). This means:
- All testing against the real API uses real rate limits and real tweets
- You must use a dedicated test account to avoid polluting a real account

### Recommended Testing Approach

1. **Mock-based unit tests** (primary strategy): Use Mockoon or custom mocks based on the [OpenAPI spec](https://docs.x.com) to simulate API responses. The `twitter-api-v2` library responses are well-typed, making mock construction straightforward.

2. **Integration tests with test account**: Create a dedicated X test account. Post tweets, read them back, delete them. Run sparingly to avoid rate limits.

3. **Connector-level tests** (bun:test): Follow the weather connector pattern:
   - Mock `twitter-api-v2` client methods
   - Test tool input validation (zod schemas)
   - Test error handling (rate limits, auth failures, network errors)
   - Test response formatting

4. **Rate limit simulation**: Mock 429 responses and verify backoff behavior.

### Mock Example
```typescript
// twitter.test.ts (bun:test)
import { describe, it, expect, mock } from 'bun:test';

const mockTweet = mock(() => Promise.resolve({
  data: { id: '123', text: 'Hello world' }
}));

// Inject mock into tool handler, verify formatting
```

---

## 9. Alternatives to Official API

### Nitter (Unofficial Frontend/RSS)
- **Status (March 2026)**: Largely dead. Most public instances are offline. Self-hosting requires real X accounts and faces constant breakage from X's anti-scraping measures.
- **RSS feeds**: Were useful but depend on functioning Nitter instances.
- **Verdict**: Not viable for a production connector.

### Scraping Libraries
- **Twikit** (Python): Used by x-mcp. Scrapes Twitter directly. Fragile, breaks frequently.
- **ntscraper**: Python library that scrapes via Nitter instances. Same availability problems.
- **Verdict**: Too fragile for a desktop app connector. Breaks without warning.

### Third-Party Data Providers
- **SocialData.tools**: Used by crazyrabbitLTC's MCP server for enhanced analytics. Paid service.
- **Postproxy.dev**: Proxy service that handles API complexity.
- **Verdict**: Could supplement the official API but adds another dependency and cost.

### RSS Bridges
- **RSSBridge**: Can generate RSS feeds from Twitter if configured with working instances.
- **Five Filters**: Twitter-to-RSS service.
- **Verdict**: Read-only, unreliable, not suitable for a two-way connector.

### Recommendation
Use the **official X API v2** exclusively. Unofficial approaches are all fragile and violate ToS. The Pay-Per-Use tier makes the cost manageable for light usage.

---

## 10. Proposed Connector Design

### File Structure
```
apps/server/src/connectors/twitter/
  index.ts          # ConnectorDefinition export
  tools.ts          # Tool definitions using SDK tool()
  api.ts            # X API v2 client wrapper
  auth.ts           # OAuth 2.0 PKCE flow
  types.ts          # Twitter-specific types
  twitter.test.ts   # bun:test suite
```

### ConnectorDefinition

```typescript
export const twitterConnector: ConnectorDefinition = {
  name: 'twitter',
  displayName: 'X (Twitter)',
  description: 'Read and post tweets, search, manage bookmarks and lists on X (formerly Twitter).',
  icon: '𝕏',
  category: 'communication',
  requiresAuth: true,  // OAuth 2.0 PKCE required
  tools: twitterTools,
};
```

### Proposed Tools (Priority Order)

**Phase 1 - Core (MVP)**:
| Tool | Description | Read/Write | Min Tier |
|------|-------------|------------|----------|
| `twitter_post_tweet` | Post a tweet (with optional media) | Write | Free |
| `twitter_search` | Search recent tweets | Read | Basic |
| `twitter_get_timeline` | Get a user's tweet timeline | Read | Basic |
| `twitter_get_tweet` | Get a specific tweet by ID | Read | Basic |
| `twitter_get_user` | Get user profile info | Read | Basic |

**Phase 2 - Engagement**:
| Tool | Description | Read/Write | Min Tier |
|------|-------------|------------|----------|
| `twitter_post_thread` | Post a multi-tweet thread | Write | Free |
| `twitter_like_tweet` | Like a tweet | Write | Basic |
| `twitter_retweet` | Retweet a tweet | Write | Basic |
| `twitter_get_mentions` | Get mentions of the authenticated user | Read | Basic |

**Phase 3 - Organization**:
| Tool | Description | Read/Write | Min Tier |
|------|-------------|------------|----------|
| `twitter_get_bookmarks` | Get bookmarked tweets | Read | Basic |
| `twitter_add_bookmark` | Bookmark a tweet | Write | Basic |
| `twitter_get_lists` | Get user's lists | Read | Basic |
| `twitter_get_list_tweets` | Get tweets from a list | Read | Basic |

**Phase 4 - Messaging** (if needed):
| Tool | Description | Read/Write | Min Tier |
|------|-------------|------------|----------|
| `twitter_get_dms` | Get direct message conversations | Read | Basic |
| `twitter_send_dm` | Send a direct message | Write | Basic |

### Dependencies
- `twitter-api-v2` (npm) - Strongly typed X API client
- `@twitter-api-v2/plugin-rate-limit` (npm) - Rate limit tracking plugin

### Key Implementation Considerations
1. **Tier detection**: On first auth, probe which endpoints are accessible. Cache the detected tier. Disable tools that require a higher tier than the user has.
2. **Token storage**: Store OAuth refresh tokens in the app's secure credential store, not in SQLite.
3. **Rate limit UX**: When rate-limited, return a helpful message ("Rate limit reached. Resets in X minutes.") rather than an error.
4. **Monthly usage tracking**: Track cumulative API calls against tier limits. Warn at 80% and block at 95% to avoid unexpected charges on Pay-Per-Use.
5. **Tweet formatting**: Truncate long text to 280 chars with a warning. For longer content, offer to split into a thread automatically.

---

## Open Questions

1. **Which tier should we target as minimum?** Free is write-only and nearly useless. Basic ($200/mo) or Pay-Per-Use are the practical minimums for a useful connector.
2. **Should we support media upload in Phase 1?** It adds complexity (chunked upload, file handling) but is a high-value feature for an AI assistant.
3. **How should we handle the Tauri OAuth callback?** Custom URL scheme (`tauri://`) vs localhost redirect. Need to check Tauri's deep-link support.
4. **Pay-Per-Use cost visibility**: Should the connector show estimated cost per operation to the user?

---

## Sources

- [X API Official Pricing](https://docs.x.com/x-api/getting-started/pricing)
- [X API Rate Limits Documentation](https://docs.x.com/x-api/fundamentals/rate-limits)
- [OAuth 2.0 Authorization Code Flow with PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code)
- [X API v2 Authentication Mapping](https://docs.x.com/fundamentals/authentication/guides/v2-authentication-mapping)
- [twitter-api-v2 npm package](https://www.npmjs.com/package/twitter-api-v2)
- [twitter-api-v2 rate limiting docs](https://github.com/PLhery/node-twitter-api-v2/blob/master/doc/rate-limiting.md)
- [crazyrabbitLTC/mcp-twitter-server](https://github.com/crazyrabbitLTC/mcp-twitter-server)
- [X API Pricing 2026 - Postproxy](https://postproxy.dev/blog/x-api-pricing-2026/)
- [X API Pricing Tiers Compared - Xpoz](https://www.xpoz.ai/blog/guides/understanding-twitter-api-pricing-tiers-and-alternatives/)
- [Media Upload Chunked Quickstart](https://docs.x.com/x-api/media/quickstart/media-upload-chunked)
- [Mockoon Twitter API v2 Mock](https://mockoon.com/mock-samples/twittercom-current/)
- [Nitter GitHub](https://github.com/zedeus/nitter)
