import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { ConnectorToolDefinition } from '../types';
import { fenceUntrustedContent, sanitizeError } from '../utils';

// ---------------------------------------------------------------------------
// Twitter API v2 helpers
// ---------------------------------------------------------------------------

const TWITTER_API_BASE = 'https://api.twitter.com/2';

function getBearerToken(): string {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) {
    throw new Error('TWITTER_BEARER_TOKEN environment variable is not set');
  }
  return token;
}

/**
 * Checks whether OAuth 2.0 user-context tokens are configured for write operations.
 * Returns the token if available, or null if not.
 */
function getUserAccessToken(): string | null {
  return process.env.TWITTER_USER_ACCESS_TOKEN ?? null;
}

/**
 * Returns a clear error result when write tools are called without user-context auth.
 * Bearer tokens (app-only) only support read operations on Twitter API v2.
 */
function writeAuthError(): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  return {
    content: [
      {
        type: 'text' as const,
        text: [
          'This write operation requires OAuth 2.0 user-context authentication.',
          '',
          'Bearer tokens (app-only auth) only support read operations.',
          'Write operations (posting tweets, liking, retweeting) must act on behalf of',
          'a specific Twitter user and require user-context tokens.',
          '',
          'To enable write operations, set: TWITTER_USER_ACCESS_TOKEN',
        ].join('\n'),
      },
    ],
    isError: true as const,
  };
}

async function twitterFetch(path: string, init?: RequestInit): Promise<unknown> {
  const token = getBearerToken();
  const url = `${TWITTER_API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Twitter API error ${res.status}: ${body.substring(0, 300)}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// twitter_get_user
// ---------------------------------------------------------------------------

const getUserTool = tool(
  'twitter_get_user',
  'Get a Twitter/X user profile by username. Returns name, bio, location, and follower counts.',
  {
    username: z.string().describe('Twitter username without the @ symbol (e.g. "jack")'),
  },
  async (args) => {
    try {
      const data = (await twitterFetch(
        `/users/by/username/${encodeURIComponent(args.username)}?user.fields=name,description,location,public_metrics,created_at`
      )) as { data?: Record<string, unknown>; errors?: Array<{ detail: string }> };

      if (!data.data) {
        const detail = data.errors?.[0]?.detail ?? 'User not found';
        return {
          content: [{ type: 'text' as const, text: `Error: ${detail}` }],
          isError: true,
        };
      }

      const user = data.data as {
        id: string;
        name: string;
        username: string;
        description?: string;
        location?: string;
        public_metrics?: {
          followers_count: number;
          following_count: number;
          tweet_count: number;
        };
        created_at?: string;
      };

      const lines = [
        `Twitter User: @${user.username}`,
        `Name: ${fenceUntrustedContent(user.name ?? '', 'Twitter')}`,
        `ID: ${user.id}`,
        `Bio: ${fenceUntrustedContent(user.description ?? '(no bio)', 'Twitter')}`,
        `Location: ${fenceUntrustedContent(user.location ?? '(no location)', 'Twitter')}`,
      ];

      if (user.public_metrics) {
        lines.push(
          `Followers: ${user.public_metrics.followers_count} | Following: ${user.public_metrics.following_count} | Tweets: ${user.public_metrics.tweet_count}`
        );
      }

      if (user.created_at) {
        lines.push(`Joined: ${user.created_at}`);
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error fetching user: ${sanitizeError(error)}` }],
        isError: true,
      };
    }
  },
  {
    annotations: {
      title: 'Get Twitter User',
      readOnlyHint: true,
      openWorldHint: true,
    },
  }
);

// ---------------------------------------------------------------------------
// twitter_get_timeline
// ---------------------------------------------------------------------------

const getTimelineTool = tool(
  'twitter_get_timeline',
  "Get recent tweets from a Twitter/X user's timeline by their user ID.",
  {
    userId: z.string().describe('Twitter user ID (numeric string, e.g. "12345678")'),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('Maximum number of tweets to return (1-100, default 10)'),
    paginationToken: z
      .string()
      .optional()
      .describe('Pagination token from a previous response to get the next page'),
  },
  async (args) => {
    try {
      const params = new URLSearchParams({
        'tweet.fields': 'created_at,author_id,public_metrics',
        expansions: 'author_id',
        'user.fields': 'name,username',
        max_results: String(args.maxResults ?? 10),
      });

      if (args.paginationToken) {
        params.set('pagination_token', args.paginationToken);
      }

      const data = (await twitterFetch(
        `/users/${encodeURIComponent(args.userId)}/tweets?${params.toString()}`
      )) as {
        data?: Array<{ id: string; text: string; created_at?: string; author_id?: string; public_metrics?: { like_count: number; retweet_count: number; reply_count: number } }>;
        includes?: { users?: Array<{ id: string; name: string; username: string }> };
        meta?: { next_token?: string; result_count?: number };
        errors?: Array<{ detail: string }>;
      };

      if (!data.data || data.data.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No tweets found.' }],
        };
      }

      const usersById: Record<string, { name: string; username: string }> = {};
      for (const u of data.includes?.users ?? []) {
        usersById[u.id] = { name: u.name, username: u.username };
      }

      const lines: string[] = [`Timeline (${data.data.length} tweets)`, ''];

      for (let i = 0; i < data.data.length; i++) {
        const tweet = data.data[i];
        const author = tweet.author_id ? usersById[tweet.author_id] : null;
        const authorLabel = author
          ? `${fenceUntrustedContent(author.name, 'Twitter')} (@${author.username})`
          : tweet.author_id ?? 'unknown';

        lines.push(`[${i + 1}] ${authorLabel}`);
        lines.push(`    ${fenceUntrustedContent(tweet.text, 'Twitter')}`);
        lines.push(`    ID: ${tweet.id}`);

        if (tweet.public_metrics) {
          lines.push(
            `    Likes: ${tweet.public_metrics.like_count} | Retweets: ${tweet.public_metrics.retweet_count} | Replies: ${tweet.public_metrics.reply_count}`
          );
        }

        if (tweet.created_at) {
          lines.push(`    Posted: ${tweet.created_at}`);
        }

        lines.push('');
      }

      if (data.meta?.next_token) {
        lines.push(`Next page token: ${data.meta.next_token}`);
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error fetching timeline: ${sanitizeError(error)}` }],
        isError: true,
      };
    }
  },
  {
    annotations: {
      title: 'Get Twitter Timeline',
      readOnlyHint: true,
      openWorldHint: true,
    },
  }
);

// ---------------------------------------------------------------------------
// twitter_search
// ---------------------------------------------------------------------------

const searchTool = tool(
  'twitter_search',
  'Search recent tweets on Twitter/X. Note: requires Twitter API Basic tier ($200/mo) or higher.',
  {
    query: z.string().describe('Twitter search query (e.g. "from:user", "#hashtag", "keyword lang:en")'),
    maxResults: z
      .number()
      .int()
      .min(10)
      .max(100)
      .optional()
      .describe('Maximum number of results to return (10-100, default 10)'),
    nextToken: z
      .string()
      .optional()
      .describe('Pagination token from a previous search response'),
  },
  async (args) => {
    try {
      const params = new URLSearchParams({
        query: args.query,
        'tweet.fields': 'created_at,author_id,public_metrics',
        expansions: 'author_id',
        'user.fields': 'name,username',
        max_results: String(args.maxResults ?? 10),
      });

      if (args.nextToken) {
        params.set('next_token', args.nextToken);
      }

      const data = (await twitterFetch(
        `/tweets/search/recent?${params.toString()}`
      )) as {
        data?: Array<{ id: string; text: string; created_at?: string; author_id?: string; public_metrics?: { like_count: number; retweet_count: number; reply_count: number } }>;
        includes?: { users?: Array<{ id: string; name: string; username: string }> };
        meta?: { next_token?: string; result_count?: number; newest_id?: string; oldest_id?: string };
        errors?: Array<{ detail: string }>;
      };

      if (!data.data || data.data.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No tweets found for query: "${fenceUntrustedContent(args.query, 'Twitter')}"`,
            },
          ],
        };
      }

      const usersById: Record<string, { name: string; username: string }> = {};
      for (const u of data.includes?.users ?? []) {
        usersById[u.id] = { name: u.name, username: u.username };
      }

      const lines: string[] = [
        `Search results for "${fenceUntrustedContent(args.query, 'Twitter')}" (${data.data.length} tweets)`,
        '',
      ];

      for (let i = 0; i < data.data.length; i++) {
        const tweet = data.data[i];
        const author = tweet.author_id ? usersById[tweet.author_id] : null;
        const authorLabel = author
          ? `${fenceUntrustedContent(author.name, 'Twitter')} (@${author.username})`
          : tweet.author_id ?? 'unknown';

        lines.push(`[${i + 1}] ${authorLabel}`);
        lines.push(`    ${fenceUntrustedContent(tweet.text, 'Twitter')}`);
        lines.push(`    ID: ${tweet.id}`);

        if (tweet.public_metrics) {
          lines.push(
            `    Likes: ${tweet.public_metrics.like_count} | Retweets: ${tweet.public_metrics.retweet_count} | Replies: ${tweet.public_metrics.reply_count}`
          );
        }

        if (tweet.created_at) {
          lines.push(`    Posted: ${tweet.created_at}`);
        }

        lines.push('');
      }

      if (data.meta?.next_token) {
        lines.push(`Next page token: ${data.meta.next_token}`);
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error searching tweets: ${sanitizeError(error)}` }],
        isError: true,
      };
    }
  },
  {
    annotations: {
      title: 'Search Tweets',
      readOnlyHint: true,
      openWorldHint: true,
    },
  }
);

// ---------------------------------------------------------------------------
// twitter_create_tweet
// ---------------------------------------------------------------------------

const createTweetTool = tool(
  'twitter_create_tweet',
  'Post a new tweet on Twitter/X. Maximum 280 characters. Use with care — always confirm with the user before posting.',
  {
    text: z
      .string()
      .max(280)
      .describe('Tweet text (max 280 characters)'),
    replyToTweetId: z
      .string()
      .optional()
      .describe('Tweet ID to reply to. Omit to post a new standalone tweet.'),
  },
  async (args) => {
    try {
      const userToken = getUserAccessToken();
      if (!userToken) {
        return writeAuthError();
      }

      const body: Record<string, unknown> = { text: args.text };
      if (args.replyToTweetId) {
        body.reply = { in_reply_to_tweet_id: args.replyToTweetId };
      }

      const data = (await twitterFetch('/tweets', {
        method: 'POST',
        body: JSON.stringify(body),
      })) as {
        data?: { id: string; text: string };
        errors?: Array<{ detail: string }>;
      };

      if (!data.data) {
        const detail = data.errors?.[0]?.detail ?? 'Unknown error creating tweet';
        return {
          content: [{ type: 'text' as const, text: `Error: ${detail}` }],
          isError: true,
        };
      }

      const lines = [
        'Tweet posted successfully!',
        `ID: ${data.data.id}`,
        `Text: ${fenceUntrustedContent(data.data.text, 'Twitter')}`,
      ];

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error creating tweet: ${sanitizeError(error)}` }],
        isError: true,
      };
    }
  },
  {
    annotations: {
      title: 'Create Tweet',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: true,
    },
  }
);

// ---------------------------------------------------------------------------
// twitter_get_tweet
// ---------------------------------------------------------------------------

const getTweetTool = tool(
  'twitter_get_tweet',
  'Get a single tweet by its ID, including the author information.',
  {
    tweetId: z.string().describe('The tweet ID to retrieve (e.g. "1234567890123456789")'),
  },
  async (args) => {
    try {
      const data = (await twitterFetch(
        `/tweets/${encodeURIComponent(args.tweetId)}?expansions=author_id&tweet.fields=created_at,public_metrics&user.fields=name,username,description`
      )) as {
        data?: { id: string; text: string; created_at?: string; author_id?: string; public_metrics?: { like_count: number; retweet_count: number; reply_count: number } };
        includes?: { users?: Array<{ id: string; name: string; username: string; description?: string }> };
        errors?: Array<{ detail: string }>;
      };

      if (!data.data) {
        const detail = data.errors?.[0]?.detail ?? 'Tweet not found';
        return {
          content: [{ type: 'text' as const, text: `Error: ${detail}` }],
          isError: true,
        };
      }

      const tweet = data.data;
      const usersById: Record<string, { name: string; username: string; description?: string }> = {};
      for (const u of data.includes?.users ?? []) {
        usersById[u.id] = { name: u.name, username: u.username, description: u.description };
      }

      const author = tweet.author_id ? usersById[tweet.author_id] : null;

      const lines: string[] = [`Tweet ID: ${tweet.id}`, ''];

      if (author) {
        lines.push(`Author: ${fenceUntrustedContent(author.name, 'Twitter')} (@${author.username})`);
      }

      lines.push(`Text: ${fenceUntrustedContent(tweet.text, 'Twitter')}`);

      if (tweet.public_metrics) {
        lines.push(
          `Likes: ${tweet.public_metrics.like_count} | Retweets: ${tweet.public_metrics.retweet_count} | Replies: ${tweet.public_metrics.reply_count}`
        );
      }

      if (tweet.created_at) {
        lines.push(`Posted: ${tweet.created_at}`);
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error fetching tweet: ${sanitizeError(error)}` }],
        isError: true,
      };
    }
  },
  {
    annotations: {
      title: 'Get Tweet',
      readOnlyHint: true,
      openWorldHint: true,
    },
  }
);

// ---------------------------------------------------------------------------
// twitter_get_mentions
// ---------------------------------------------------------------------------

const getMentionsTool = tool(
  'twitter_get_mentions',
  'Get recent tweets mentioning a Twitter/X user by their user ID.',
  {
    userId: z.string().describe('Twitter user ID (numeric string, e.g. "12345678")'),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('Maximum number of mentions to return (1-100, default 10)'),
    paginationToken: z
      .string()
      .optional()
      .describe('Pagination token from a previous response to get the next page'),
  },
  async (args) => {
    try {
      const params = new URLSearchParams({
        'tweet.fields': 'created_at,author_id,public_metrics',
        expansions: 'author_id',
        'user.fields': 'name,username',
        max_results: String(args.maxResults ?? 10),
      });

      if (args.paginationToken) {
        params.set('pagination_token', args.paginationToken);
      }

      const data = (await twitterFetch(
        `/users/${encodeURIComponent(args.userId)}/mentions?${params.toString()}`
      )) as {
        data?: Array<{ id: string; text: string; created_at?: string; author_id?: string; public_metrics?: { like_count: number; retweet_count: number; reply_count: number } }>;
        includes?: { users?: Array<{ id: string; name: string; username: string }> };
        meta?: { next_token?: string; result_count?: number };
        errors?: Array<{ detail: string }>;
      };

      if (!data.data || data.data.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No mentions found.' }],
        };
      }

      const usersById: Record<string, { name: string; username: string }> = {};
      for (const u of data.includes?.users ?? []) {
        usersById[u.id] = { name: u.name, username: u.username };
      }

      const lines: string[] = [`Mentions (${data.data.length} tweets)`, ''];

      for (let i = 0; i < data.data.length; i++) {
        const tweet = data.data[i];
        const author = tweet.author_id ? usersById[tweet.author_id] : null;
        const authorLabel = author
          ? `${fenceUntrustedContent(author.name, 'Twitter')} (@${author.username})`
          : tweet.author_id ?? 'unknown';

        lines.push(`[${i + 1}] ${authorLabel}`);
        lines.push(`    ${fenceUntrustedContent(tweet.text, 'Twitter')}`);
        lines.push(`    ID: ${tweet.id}`);

        if (tweet.public_metrics) {
          lines.push(
            `    Likes: ${tweet.public_metrics.like_count} | Retweets: ${tweet.public_metrics.retweet_count} | Replies: ${tweet.public_metrics.reply_count}`
          );
        }

        if (tweet.created_at) {
          lines.push(`    Posted: ${tweet.created_at}`);
        }

        lines.push('');
      }

      if (data.meta?.next_token) {
        lines.push(`Next page token: ${data.meta.next_token}`);
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error fetching mentions: ${sanitizeError(error)}` }],
        isError: true,
      };
    }
  },
  {
    annotations: {
      title: 'Get Twitter Mentions',
      readOnlyHint: true,
      openWorldHint: true,
    },
  }
);

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const twitterTools: ConnectorToolDefinition[] = [
  {
    name: 'twitter_get_user',
    description: 'Get a Twitter/X user profile by username',
    sdkTool: getUserTool,
  },
  {
    name: 'twitter_get_timeline',
    description: "Get recent tweets from a Twitter/X user's timeline",
    sdkTool: getTimelineTool,
  },
  {
    name: 'twitter_search',
    description: 'Search recent tweets on Twitter/X (requires Basic tier)',
    sdkTool: searchTool,
  },
  {
    name: 'twitter_create_tweet',
    description: 'Post a new tweet on Twitter/X',
    sdkTool: createTweetTool,
  },
  {
    name: 'twitter_get_tweet',
    description: 'Get a single tweet by its ID',
    sdkTool: getTweetTool,
  },
  {
    name: 'twitter_get_mentions',
    description: 'Get recent tweets mentioning a Twitter/X user',
    sdkTool: getMentionsTool,
  },
];
