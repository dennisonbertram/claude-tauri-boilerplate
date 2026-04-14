import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { sanitizeError, fenceUntrustedContent } from '../utils';

// ---------------------------------------------------------------------------
// Slack API helpers
// ---------------------------------------------------------------------------

const SLACK_API_BASE = 'https://slack.com/api';

function getToken(): string {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error('SLACK_BOT_TOKEN is not set');
  }
  return token;
}

interface SlackResponse {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

async function slackPost<T extends SlackResponse>(
  method: string,
  body: Record<string, unknown>
): Promise<T> {
  const token = getToken();
  const response = await fetch(`${SLACK_API_BASE}/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as T;
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error ?? 'unknown error'}`);
  }

  return data;
}

// ---------------------------------------------------------------------------
// slack_list_channels
// ---------------------------------------------------------------------------

function createListChannelsTool(_db: Database) {
  return tool(
    'slack_list_channels',
    'List Slack channels (public channels and joined private channels). Supports cursor-based pagination.',
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe('Maximum number of channels to return (1–200, default 100)'),
      cursor: z
        .string()
        .optional()
        .describe('Pagination cursor from a previous response to get the next page'),
    },
    async (args) => {
      try {
        interface ChannelListResponse extends SlackResponse {
          channels: Array<{
            id: string;
            name: string;
            is_private: boolean;
            num_members?: number;
            topic?: { value: string };
            purpose?: { value: string };
          }>;
          response_metadata?: { next_cursor?: string };
        }

        const data = await slackPost<ChannelListResponse>('conversations.list', {
          types: 'public_channel,private_channel',
          limit: args.limit ?? 100,
          ...(args.cursor ? { cursor: args.cursor } : {}),
        });

        if (!data.channels || data.channels.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No channels found.' }] };
        }

        const lines: string[] = [
          `Found ${data.channels.length} channel${data.channels.length !== 1 ? 's' : ''}:`,
          '',
        ];

        for (const ch of data.channels) {
          lines.push(`ID: ${ch.id}`);
          lines.push(`Name: ${fenceUntrustedContent(ch.name, 'slack.channel')}`);
          lines.push(`Private: ${ch.is_private ? 'yes' : 'no'}`);
          if (ch.num_members !== undefined) {
            lines.push(`Members: ${ch.num_members}`);
          }
          if (ch.topic?.value) {
            lines.push(`Topic: ${fenceUntrustedContent(ch.topic.value, 'slack.channel')}`);
          }
          if (ch.purpose?.value) {
            lines.push(`Purpose: ${fenceUntrustedContent(ch.purpose.value, 'slack.channel')}`);
          }
          lines.push('');
        }

        const nextCursor = data.response_metadata?.next_cursor;
        if (nextCursor) {
          lines.push(`Next cursor: ${nextCursor}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing channels: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Slack Channels',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// slack_get_channel_history
// ---------------------------------------------------------------------------

function createGetChannelHistoryTool(_db: Database) {
  return tool(
    'slack_get_channel_history',
    'Get recent messages from a Slack channel. Returns message text, timestamps, and user IDs.',
    {
      channel: z.string().describe('Channel ID (e.g. C012AB3CD)'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Maximum number of messages to return (1–100, default 20)'),
      cursor: z
        .string()
        .optional()
        .describe('Pagination cursor from a previous response to get the next page'),
      oldest: z
        .string()
        .optional()
        .describe('Only return messages after this Unix timestamp (e.g. "1512085950.000216")'),
      latest: z
        .string()
        .optional()
        .describe('Only return messages before this Unix timestamp'),
    },
    async (args) => {
      try {
        interface HistoryResponse extends SlackResponse {
          messages: Array<{
            ts: string;
            user?: string;
            bot_id?: string;
            text: string;
            reply_count?: number;
            thread_ts?: string;
          }>;
          has_more?: boolean;
          response_metadata?: { next_cursor?: string };
        }

        const body: Record<string, unknown> = {
          channel: args.channel,
          limit: args.limit ?? 20,
        };
        if (args.cursor) body.cursor = args.cursor;
        if (args.oldest) body.oldest = args.oldest;
        if (args.latest) body.latest = args.latest;

        const data = await slackPost<HistoryResponse>('conversations.history', body);

        if (!data.messages || data.messages.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No messages found in this channel.' }] };
        }

        const lines: string[] = [
          `${data.messages.length} message${data.messages.length !== 1 ? 's' : ''} from channel ${args.channel}:`,
          '',
        ];

        for (const msg of data.messages) {
          const author = msg.user ?? msg.bot_id ?? 'unknown';
          lines.push(`ts: ${msg.ts}`);
          lines.push(`user: ${fenceUntrustedContent(author, 'slack.message')}`);
          lines.push(`text: ${fenceUntrustedContent(msg.text, 'slack.message')}`);
          if (msg.reply_count && msg.reply_count > 0) {
            lines.push(`replies: ${msg.reply_count} (thread_ts: ${msg.thread_ts ?? msg.ts})`);
          }
          lines.push('');
        }

        const nextCursor = data.response_metadata?.next_cursor;
        if (nextCursor) {
          lines.push(`Next cursor: ${nextCursor}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting channel history: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Slack Channel History',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// slack_get_thread
// ---------------------------------------------------------------------------

function createGetThreadTool(_db: Database) {
  return tool(
    'slack_get_thread',
    'Get all replies in a Slack thread. The thread is identified by the channel and the timestamp of the parent message.',
    {
      channel: z.string().describe('Channel ID where the thread lives'),
      thread_ts: z.string().describe('Timestamp of the parent message that started the thread'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Maximum number of replies to return (1–100, default 50)'),
      cursor: z
        .string()
        .optional()
        .describe('Pagination cursor from a previous response'),
    },
    async (args) => {
      try {
        interface RepliesResponse extends SlackResponse {
          messages: Array<{
            ts: string;
            user?: string;
            bot_id?: string;
            text: string;
            thread_ts?: string;
            parent_user_id?: string;
          }>;
          has_more?: boolean;
          response_metadata?: { next_cursor?: string };
        }

        const body: Record<string, unknown> = {
          channel: args.channel,
          ts: args.thread_ts,
          limit: args.limit ?? 50,
        };
        if (args.cursor) body.cursor = args.cursor;

        const data = await slackPost<RepliesResponse>('conversations.replies', body);

        if (!data.messages || data.messages.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No messages found in this thread.' }] };
        }

        const lines: string[] = [
          `Thread ${args.thread_ts} in channel ${args.channel} — ${data.messages.length} message${data.messages.length !== 1 ? 's' : ''}:`,
          '',
        ];

        for (const msg of data.messages) {
          const author = msg.user ?? msg.bot_id ?? 'unknown';
          lines.push(`ts: ${msg.ts}`);
          lines.push(`user: ${fenceUntrustedContent(author, 'slack.thread')}`);
          lines.push(`text: ${fenceUntrustedContent(msg.text, 'slack.thread')}`);
          lines.push('');
        }

        const nextCursor = data.response_metadata?.next_cursor;
        if (nextCursor) {
          lines.push(`Next cursor: ${nextCursor}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting thread: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Slack Thread',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// slack_post_message
// ---------------------------------------------------------------------------

function createPostMessageTool(_db: Database) {
  return tool(
    'slack_post_message',
    'Post a message to a Slack channel or reply to a thread. This action sends a real message — confirm with the user before calling.',
    {
      channel: z.string().describe('Channel ID to post to (e.g. C012AB3CD)'),
      text: z
        .string()
        .max(40000)
        .describe(
          'Message text. Supports Slack mrkdwn formatting. Ampersands (&), less-than (<), and greater-than (>) are automatically escaped.'
        ),
      thread_ts: z
        .string()
        .optional()
        .describe(
          'Thread timestamp to reply to. Omit to post a new top-level message. Provide the ts of the parent message to reply in that thread.'
        ),
    },
    async (args) => {
      try {
        // Escape special Slack mrkdwn characters in user-supplied text to prevent injection
        const safeText = args.text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

        interface PostMessageResponse extends SlackResponse {
          channel: string;
          ts: string;
          message?: { text: string };
        }

        const body: Record<string, unknown> = {
          channel: args.channel,
          text: safeText,
        };
        if (args.thread_ts) body.thread_ts = args.thread_ts;

        const data = await slackPost<PostMessageResponse>('chat.postMessage', body);

        const lines = [
          'Message posted successfully.',
          `Channel: ${data.channel}`,
          `Timestamp: ${data.ts}`,
        ];
        if (args.thread_ts) {
          lines.push(`Thread: ${args.thread_ts}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error posting message: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Post Slack Message',
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// slack_search_messages
// ---------------------------------------------------------------------------

function createSearchMessagesTool(_db: Database) {
  return tool(
    'slack_search_messages',
    'Search messages across the entire Slack workspace. Returns matching messages with channel and timestamp.',
    {
      query: z.string().describe('Search query string (e.g. "deploy production", "from:@alice budget")'),
      count: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Maximum number of results to return (1–100, default 20)'),
      page: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe('Page number (1-indexed) for pagination'),
    },
    async (args) => {
      try {
        interface SearchMatch {
          ts: string;
          text: string;
          username?: string;
          channel?: { id: string; name: string };
          permalink?: string;
        }
        interface SearchResponse extends SlackResponse {
          messages?: {
            total: number;
            pagination?: { page_count?: number };
            matches: SearchMatch[];
          };
        }

        const body: Record<string, unknown> = {
          query: args.query,
          count: args.count ?? 20,
          highlight: false,
        };
        if (args.page) body.page = args.page;

        const data = await slackPost<SearchResponse>('search.messages', body);

        const messages = data.messages;
        if (!messages || messages.matches.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No messages found matching: "${fenceUntrustedContent(args.query, 'slack.search')}"`,
              },
            ],
          };
        }

        const lines: string[] = [
          `Found ${messages.total} result${messages.total !== 1 ? 's' : ''} for "${fenceUntrustedContent(args.query, 'slack.search')}" (showing ${messages.matches.length}):`,
          '',
        ];

        for (const match of messages.matches) {
          lines.push(`ts: ${match.ts}`);
          if (match.channel) {
            lines.push(`channel: ${match.channel.id} (#${fenceUntrustedContent(match.channel.name, 'slack.search')})`);
          }
          if (match.username) {
            lines.push(`user: ${fenceUntrustedContent(match.username, 'slack.search')}`);
          }
          lines.push(`text: ${fenceUntrustedContent(match.text, 'slack.search')}`);
          if (match.permalink) {
            lines.push(`permalink: ${match.permalink}`);
          }
          lines.push('');
        }

        const pageCount = messages.pagination?.page_count;
        if (pageCount && pageCount > (args.page ?? 1)) {
          lines.push(`More pages available. Use page=${(args.page ?? 1) + 1} for next page.`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error searching messages: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Search Slack Messages',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// slack_list_users
// ---------------------------------------------------------------------------

function createListUsersTool(_db: Database) {
  return tool(
    'slack_list_users',
    'List workspace members in Slack. Returns user IDs, display names, and basic profile information.',
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe('Maximum number of users to return (1–200, default 100)'),
      cursor: z
        .string()
        .optional()
        .describe('Pagination cursor from a previous response'),
    },
    async (args) => {
      try {
        interface SlackUser {
          id: string;
          name: string;
          real_name?: string;
          deleted?: boolean;
          is_bot?: boolean;
          profile?: {
            display_name?: string;
            email?: string;
          };
        }
        interface UsersListResponse extends SlackResponse {
          members: SlackUser[];
          response_metadata?: { next_cursor?: string };
        }

        const body: Record<string, unknown> = {
          limit: args.limit ?? 100,
        };
        if (args.cursor) body.cursor = args.cursor;

        const data = await slackPost<UsersListResponse>('users.list', body);

        if (!data.members || data.members.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No users found.' }] };
        }

        // Filter out deleted users and bots for cleaner output
        const activeHumans = data.members.filter((u) => !u.deleted && !u.is_bot);

        const lines: string[] = [
          `Found ${activeHumans.length} active user${activeHumans.length !== 1 ? 's' : ''} (${data.members.length} total including bots/deleted):`,
          '',
        ];

        for (const user of activeHumans) {
          lines.push(`ID: ${user.id}`);
          lines.push(`Username: ${fenceUntrustedContent(user.name, 'slack.users')}`);
          if (user.real_name) {
            lines.push(`Real name: ${fenceUntrustedContent(user.real_name, 'slack.users')}`);
          }
          if (user.profile?.display_name) {
            lines.push(`Display name: ${fenceUntrustedContent(user.profile.display_name, 'slack.users')}`);
          }
          lines.push('');
        }

        const nextCursor = data.response_metadata?.next_cursor;
        if (nextCursor) {
          lines.push(`Next cursor: ${nextCursor}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing users: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Slack Users',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// slack_add_reaction
// ---------------------------------------------------------------------------

function createAddReactionTool(_db: Database) {
  return tool(
    'slack_add_reaction',
    'Add an emoji reaction to a Slack message.',
    {
      channel: z.string().describe('Channel ID where the message lives'),
      timestamp: z.string().describe('Timestamp (ts) of the message to react to'),
      emoji: z
        .string()
        .describe(
          'Emoji name without colons (e.g. "thumbsup", "white_check_mark", "rocket"). Do not include the : delimiters.'
        ),
    },
    async (args) => {
      try {
        // Strip colon delimiters if the user included them by mistake
        const emojiName = args.emoji.replace(/^:/, '').replace(/:$/, '');

        await slackPost('reactions.add', {
          channel: args.channel,
          timestamp: args.timestamp,
          name: emojiName,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: `Reaction :${emojiName}: added to message ${args.timestamp} in channel ${args.channel}.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error adding reaction: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Add Slack Reaction',
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createTools(_db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'slack_list_channels',
      description: 'List Slack channels (public + joined private)',
      sdkTool: createListChannelsTool(_db),
    },
    {
      name: 'slack_get_channel_history',
      description: 'Get recent messages from a Slack channel',
      sdkTool: createGetChannelHistoryTool(_db),
    },
    {
      name: 'slack_get_thread',
      description: 'Get all replies in a Slack thread',
      sdkTool: createGetThreadTool(_db),
    },
    {
      name: 'slack_post_message',
      description: 'Post a message to a Slack channel or thread',
      sdkTool: createPostMessageTool(_db),
    },
    {
      name: 'slack_search_messages',
      description: 'Search messages workspace-wide in Slack',
      sdkTool: createSearchMessagesTool(_db),
    },
    {
      name: 'slack_list_users',
      description: 'List workspace members in Slack',
      sdkTool: createListUsersTool(_db),
    },
    {
      name: 'slack_add_reaction',
      description: 'Add an emoji reaction to a Slack message',
      sdkTool: createAddReactionTool(_db),
    },
  ];
}
