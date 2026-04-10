import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { ConnectorToolDefinition } from '../types';
import { fenceUntrustedContent, sanitizeError } from '../utils';
import {
  loadSessionFromEnv,
  getProfile,
  getTimeline,
  getAuthorFeed,
  searchPosts,
  createPost,
  likePost,
  getPostThread,
  detectUrlFacets,
  type BlueskyPost,
  type BlueskyThread,
} from './api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wrap a short string (display name, handle, bio) for safe embedding.
 * For larger chunks of untrusted data we use fenceUntrustedContent instead.
 */
function fence(content: string | undefined | null): string {
  if (content == null) return '';
  return content.replace(/</g, '\u003c').replace(/>/g, '\u003e');
}

function formatPost(post: BlueskyPost, index?: number): string {
  const prefix = index !== undefined ? `[${index + 1}] ` : '';
  const author = fence(post.author.displayName ?? post.author.handle);
  const handle = fence(post.author.handle);
  const text = fence(post.record.text);
  const lines = [
    `${prefix}@${handle} (${author})`,
    `   ${text}`,
    `   URI: ${post.uri}`,
    `   CID: ${post.cid}`,
    `   Likes: ${post.likeCount ?? 0} | Replies: ${post.replyCount ?? 0} | Reposts: ${post.repostCount ?? 0}`,
    `   Posted: ${post.record.createdAt}`,
  ];
  return lines.join('\n');
}

function formatThread(node: BlueskyThread, depth: number = 0): string {
  const indent = '  '.repeat(depth);
  const post = node.thread.post;
  const author = fence(post.author.displayName ?? post.author.handle);
  const handle = fence(post.author.handle);
  const text = fence(post.record.text);
  const lines = [`${indent}@${handle} (${author})`, `${indent}  ${text}`];

  if (node.thread.replies && node.thread.replies.length > 0) {
    for (const reply of node.thread.replies) {
      lines.push('');
      lines.push(formatThread(reply, depth + 1));
    }
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// bluesky_get_profile
// ---------------------------------------------------------------------------

const getProfileTool = tool(
  'bluesky_get_profile',
  'Get a Bluesky user profile by handle or DID.',
  {
    actor: z
      .string()
      .describe('Handle (e.g. "user.bsky.social") or DID (e.g. "did:plc:abc123")'),
  },
  async (args) => {
    try {
      const session = await loadSessionFromEnv();
      const profile = await getProfile(session, args.actor);

      const text = [
        `Bluesky Profile: @${fence(profile.handle)}`,
        `Display Name: ${fence(profile.displayName ?? '(none)')}`,
        `DID: ${profile.did}`,
        `Bio: ${fence(profile.description ?? '(no bio)')}`,
        `Followers: ${profile.followersCount} | Following: ${profile.followsCount} | Posts: ${profile.postsCount}`,
      ].join('\n');

      return { content: [{ type: 'text' as const, text }] };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${sanitizeError(error)}` }],
        isError: true,
      };
    }
  },
  {
    annotations: {
      title: 'Get Bluesky Profile',
      readOnlyHint: true,
      openWorldHint: true,
    },
  }
);

// ---------------------------------------------------------------------------
// bluesky_get_timeline
// ---------------------------------------------------------------------------

const getTimelineTool = tool(
  'bluesky_get_timeline',
  'Get the authenticated user\'s home timeline (posts from followed accounts).',
  {
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .describe('Number of posts to retrieve (1-100, default 20)'),
  },
  async (args) => {
    try {
      const session = await loadSessionFromEnv();
      const result = await getTimeline(session, args.limit ?? 20);

      if (result.feed.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'Timeline is empty.' }],
        };
      }

      const lines = [`Home Timeline (${result.feed.length} posts)`, ''];
      result.feed.forEach((post, i) => {
        lines.push(formatPost(post, i));
        lines.push('');
      });

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${sanitizeError(error)}` }],
        isError: true,
      };
    }
  },
  {
    annotations: {
      title: 'Get Timeline',
      readOnlyHint: true,
      openWorldHint: true,
    },
  }
);

// ---------------------------------------------------------------------------
// bluesky_get_author_feed
// ---------------------------------------------------------------------------

const getAuthorFeedTool = tool(
  'bluesky_get_author_feed',
  'Get posts by a specific Bluesky user.',
  {
    actor: z
      .string()
      .describe('Handle or DID of the user whose posts to retrieve'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .describe('Number of posts to retrieve (1-100, default 20)'),
  },
  async (args) => {
    try {
      const session = await loadSessionFromEnv();
      const result = await getAuthorFeed(session, args.actor, args.limit ?? 20);

      if (result.feed.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No posts found for @${fence(args.actor)}.`,
            },
          ],
        };
      }

      const lines = [
        `Posts by @${fence(args.actor)} (${result.feed.length} posts)`,
        '',
      ];
      result.feed.forEach((post, i) => {
        lines.push(formatPost(post, i));
        lines.push('');
      });

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${sanitizeError(error)}` }],
        isError: true,
      };
    }
  },
  {
    annotations: {
      title: 'Get Author Feed',
      readOnlyHint: true,
      openWorldHint: true,
    },
  }
);

// ---------------------------------------------------------------------------
// bluesky_search_posts
// ---------------------------------------------------------------------------

const searchPostsTool = tool(
  'bluesky_search_posts',
  'Full-text search for Bluesky posts.',
  {
    query: z.string().describe('Search query string'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .describe('Number of results to return (1-100, default 25)'),
  },
  async (args) => {
    try {
      const session = await loadSessionFromEnv();
      const result = await searchPosts(session, args.query, args.limit ?? 25);

      if (result.posts.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No posts found for query: "${fence(args.query)}"`,
            },
          ],
        };
      }

      const total = result.hitsTotal !== undefined ? ` (${result.hitsTotal} total)` : '';
      const lines = [
        `Search Results for "${fence(args.query)}"${total}`,
        `Showing ${result.posts.length} posts`,
        '',
      ];
      result.posts.forEach((post, i) => {
        lines.push(formatPost(post, i));
        lines.push('');
      });

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${sanitizeError(error)}` }],
        isError: true,
      };
    }
  },
  {
    annotations: {
      title: 'Search Posts',
      readOnlyHint: true,
      openWorldHint: true,
    },
  }
);

// ---------------------------------------------------------------------------
// bluesky_create_post
// ---------------------------------------------------------------------------

const createPostTool = tool(
  'bluesky_create_post',
  'Create a new post on Bluesky. Maximum 300 graphemes. URLs will automatically be linked.',
  {
    text: z
      .string()
      .describe(
        'Post text (max 300 graphemes). URLs will be auto-detected and converted to links.'
      ),
  },
  async (args) => {
    try {
      const session = await loadSessionFromEnv();
      const facets = detectUrlFacets(args.text);
      const result = await createPost(session, args.text, facets);

      const text = [
        'Post created successfully!',
        `URI: ${result.uri}`,
        `CID: ${result.cid}`,
      ].join('\n');

      return { content: [{ type: 'text' as const, text }] };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${sanitizeError(error)}` }],
        isError: true,
      };
    }
  },
  {
    annotations: {
      title: 'Create Post',
      readOnlyHint: false,
      openWorldHint: true,
    },
  }
);

// ---------------------------------------------------------------------------
// bluesky_like_post
// ---------------------------------------------------------------------------

const likePostTool = tool(
  'bluesky_like_post',
  'Like a Bluesky post by its AT URI and CID.',
  {
    uri: z
      .string()
      .describe('AT URI of the post (e.g. "at://did:plc:abc/app.bsky.feed.post/xyz")'),
    cid: z.string().describe('CID of the post (content hash)'),
  },
  async (args) => {
    try {
      const session = await loadSessionFromEnv();
      const result = await likePost(session, args.uri, args.cid);

      const text = [
        'Post liked successfully!',
        `Like URI: ${result.uri}`,
      ].join('\n');

      return { content: [{ type: 'text' as const, text }] };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${sanitizeError(error)}` }],
        isError: true,
      };
    }
  },
  {
    annotations: {
      title: 'Like Post',
      readOnlyHint: false,
      openWorldHint: true,
    },
  }
);

// ---------------------------------------------------------------------------
// bluesky_get_post_thread
// ---------------------------------------------------------------------------

const getPostThreadTool = tool(
  'bluesky_get_post_thread',
  'Get a Bluesky post along with its reply tree.',
  {
    uri: z
      .string()
      .describe('AT URI of the post (e.g. "at://did:plc:abc/app.bsky.feed.post/xyz")'),
    depth: z
      .number()
      .min(0)
      .max(10)
      .optional()
      .describe('How deep to fetch replies (0-10, default 6)'),
  },
  async (args) => {
    try {
      const session = await loadSessionFromEnv();
      const result = await getPostThread(session, args.uri, args.depth ?? 6);

      const lines = ['Post Thread', ''];
      lines.push(formatThread(result));

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${sanitizeError(error)}` }],
        isError: true,
      };
    }
  },
  {
    annotations: {
      title: 'Get Post Thread',
      readOnlyHint: true,
      openWorldHint: true,
    },
  }
);

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const blueskyTools: ConnectorToolDefinition[] = [
  {
    name: 'bluesky_get_profile',
    description: 'Get a Bluesky user profile by handle or DID',
    sdkTool: getProfileTool,
  },
  {
    name: 'bluesky_get_timeline',
    description: "Get the authenticated user's home timeline",
    sdkTool: getTimelineTool,
  },
  {
    name: 'bluesky_get_author_feed',
    description: 'Get posts by a specific Bluesky user',
    sdkTool: getAuthorFeedTool,
  },
  {
    name: 'bluesky_search_posts',
    description: 'Full-text search for Bluesky posts',
    sdkTool: searchPostsTool,
  },
  {
    name: 'bluesky_create_post',
    description: 'Create a new post on Bluesky',
    sdkTool: createPostTool,
  },
  {
    name: 'bluesky_like_post',
    description: 'Like a Bluesky post by its AT URI and CID',
    sdkTool: likePostTool,
  },
  {
    name: 'bluesky_get_post_thread',
    description: 'Get a Bluesky post along with its reply tree',
    sdkTool: getPostThreadTool,
  },
];
