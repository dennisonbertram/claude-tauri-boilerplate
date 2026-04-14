/**
 * Bluesky AT Protocol API client.
 * Uses direct fetch() calls to the XRPC API at https://bsky.social/xrpc.
 * No SDK dependency — follows the same pattern as the weather connector.
 */

const BSKY_BASE = 'https://bsky.social/xrpc';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BlueskySession {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
}

export interface BlueskyProfile {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  followersCount: number;
  followsCount: number;
  postsCount: number;
}

export interface BlueskyPostRecord {
  text: string;
  createdAt: string;
  facets?: RichtextFacet[];
}

export interface BlueskyPost {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
  };
  record: BlueskyPostRecord;
  likeCount?: number;
  replyCount?: number;
  repostCount?: number;
  indexedAt: string;
}

export interface BlueskyFeed {
  feed: BlueskyPost[];
  cursor?: string;
}

export interface BlueskySearchResult {
  posts: BlueskyPost[];
  hitsTotal?: number;
}

export interface BlueskyCreateResult {
  uri: string;
  cid: string;
}

export interface BlueskyThread {
  thread: {
    post: BlueskyPost;
    replies?: BlueskyThread[];
  };
}

export interface RichtextFacet {
  index: { byteStart: number; byteEnd: number };
  features: Array<{
    $type: string;
    uri?: string;
    did?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Grapheme counting
// ---------------------------------------------------------------------------

/**
 * Count the number of Unicode grapheme clusters in a string.
 * Uses Intl.Segmenter so emoji sequences (like ZWJ sequences) count as 1.
 */
export function countGraphemes(text: string): number {
  const segmenter = new Intl.Segmenter();
  return [...segmenter.segment(text)].length;
}

// ---------------------------------------------------------------------------
// Rich text facet detection
// ---------------------------------------------------------------------------

const URL_REGEX = /https?:\/\/[^\s\u0000-\u001f\u007f-\u009f<>|\\^`"[\]{}]*[^\s\u0000-\u001f\u007f-\u009f<>|\\^`"[\]{}.,;:!?]/g;

/**
 * Detect URLs in text and return AT Protocol richtext facets.
 * Byte indices are UTF-8, not JS UTF-16.
 */
export function detectUrlFacets(text: string): RichtextFacet[] {
  const encoder = new TextEncoder();
  const facets: RichtextFacet[] = [];
  const textBytes = encoder.encode(text);

  let match: RegExpExecArray | null;
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    const urlText = match[0];
    // Compute byte offset by encoding the prefix before the match
    const prefix = text.slice(0, match.index);
    const byteStart = encoder.encode(prefix).length;
    const byteEnd = byteStart + encoder.encode(urlText).length;

    facets.push({
      index: { byteStart, byteEnd },
      features: [
        {
          $type: 'app.bsky.richtext.facet#link',
          uri: urlText,
        },
      ],
    });
  }

  return facets;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function xrpcGet<T>(
  method: string,
  params: Record<string, string | number | undefined> = {},
  accessJwt?: string
): Promise<T> {
  const url = new URL(`${BSKY_BASE}/${method}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) {
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessJwt) {
    headers['Authorization'] = `Bearer ${accessJwt}`;
  }

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Bluesky API error ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function xrpcPost<T>(
  method: string,
  body: unknown,
  accessJwt?: string
): Promise<T> {
  const url = `${BSKY_BASE}/${method}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessJwt) {
    headers['Authorization'] = `Bearer ${accessJwt}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Bluesky API error ${res.status}: ${errBody || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

export async function createSession(
  identifier: string,
  password: string
): Promise<BlueskySession> {
  return xrpcPost<BlueskySession>('com.atproto.server.createSession', {
    identifier,
    password,
  });
}

export async function refreshSession(refreshJwt: string): Promise<BlueskySession> {
  return xrpcPost<BlueskySession>(
    'com.atproto.server.refreshSession',
    {},
    refreshJwt
  );
}

// ---------------------------------------------------------------------------
// Session loading from environment (used by tools at runtime)
// ---------------------------------------------------------------------------

/**
 * Loads the Bluesky session from environment variables.
 * Throws a clear error if credentials are missing.
 */
export async function loadSessionFromEnv(): Promise<BlueskySession> {
  const identifier = process.env.BLUESKY_IDENTIFIER;
  const appPassword = process.env.BLUESKY_APP_PASSWORD;

  if (!identifier || !appPassword) {
    throw new Error(
      'Bluesky credentials not configured. Set BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD environment variables.'
    );
  }

  return createSession(identifier, appPassword);
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function getProfile(
  session: BlueskySession,
  actor: string
): Promise<BlueskyProfile> {
  return xrpcGet<BlueskyProfile>(
    'app.bsky.actor.getProfile',
    { actor },
    session.accessJwt
  );
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export async function getTimeline(
  session: BlueskySession,
  limit: number = 20
): Promise<BlueskyFeed> {
  return xrpcGet<BlueskyFeed>(
    'app.bsky.feed.getTimeline',
    { limit },
    session.accessJwt
  );
}

// ---------------------------------------------------------------------------
// Author feed
// ---------------------------------------------------------------------------

export async function getAuthorFeed(
  session: BlueskySession,
  actor: string,
  limit: number = 20
): Promise<BlueskyFeed> {
  return xrpcGet<BlueskyFeed>(
    'app.bsky.feed.getAuthorFeed',
    { actor, limit },
    session.accessJwt
  );
}

// ---------------------------------------------------------------------------
// Search posts
// ---------------------------------------------------------------------------

export async function searchPosts(
  session: BlueskySession,
  q: string,
  limit: number = 25
): Promise<BlueskySearchResult> {
  const url = new URL(`${BSKY_BASE}/app.bsky.feed.searchPosts`);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url.toString(), {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessJwt}`,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Bluesky API error ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<BlueskySearchResult>;
}

// ---------------------------------------------------------------------------
// Create post
// ---------------------------------------------------------------------------

export async function createPost(
  session: BlueskySession,
  text: string,
  facets?: RichtextFacet[]
): Promise<BlueskyCreateResult> {
  const graphemeCount = countGraphemes(text);
  if (graphemeCount > 300) {
    throw new Error(
      `Post text exceeds 300 graphemes (got ${graphemeCount}). Bluesky posts are limited to 300 graphemes.`
    );
  }

  // Auto-detect URL facets if not provided
  const resolvedFacets = facets ?? detectUrlFacets(text);

  const record: Record<string, unknown> = {
    $type: 'app.bsky.feed.post',
    text,
    createdAt: new Date().toISOString(),
  };
  if (resolvedFacets.length > 0) {
    record.facets = resolvedFacets;
  }

  return xrpcPost<BlueskyCreateResult>(
    'com.atproto.repo.createRecord',
    {
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record,
    },
    session.accessJwt
  );
}

// ---------------------------------------------------------------------------
// Like post
// ---------------------------------------------------------------------------

export async function likePost(
  session: BlueskySession,
  uri: string,
  cid: string
): Promise<BlueskyCreateResult> {
  return xrpcPost<BlueskyCreateResult>(
    'com.atproto.repo.createRecord',
    {
      repo: session.did,
      collection: 'app.bsky.feed.like',
      record: {
        $type: 'app.bsky.feed.like',
        subject: { uri, cid },
        createdAt: new Date().toISOString(),
      },
    },
    session.accessJwt
  );
}

// ---------------------------------------------------------------------------
// Get post thread
// ---------------------------------------------------------------------------

export async function getPostThread(
  session: BlueskySession,
  uri: string,
  depth: number = 6
): Promise<BlueskyThread> {
  return xrpcGet<BlueskyThread>(
    'app.bsky.feed.getPostThread',
    { uri, depth },
    session.accessJwt
  );
}

// ---------------------------------------------------------------------------
// Resolve handle to DID
// ---------------------------------------------------------------------------

export async function resolveHandle(
  session: BlueskySession,
  handle: string
): Promise<string> {
  const result = await xrpcGet<{ did: string }>(
    'com.atproto.identity.resolveHandle',
    { handle },
    session.accessJwt
  );
  return result.did;
}
