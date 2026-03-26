import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { sanitizeError, fenceUntrustedContent } from '../utils';

// ---------------------------------------------------------------------------
// Discord API helpers
// ---------------------------------------------------------------------------

const DISCORD_API_BASE = 'https://discord.com/api/v10';

function getToken(): string {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error('DISCORD_BOT_TOKEN is not set');
  }
  return token;
}

async function discordGet<T>(path: string): Promise<T> {
  const token = getToken();
  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${response.statusText}${errorBody ? ` — ${errorBody}` : ''}`);
  }

  return response.json() as Promise<T>;
}

async function discordPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const token = getToken();
  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${response.statusText}${errorBody ? ` — ${errorBody}` : ''}`);
  }

  return response.json() as Promise<T>;
}

async function discordPut(path: string): Promise<void> {
  const token = getToken();
  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${response.statusText}${errorBody ? ` — ${errorBody}` : ''}`);
  }
}

// ---------------------------------------------------------------------------
// discord_list_guilds
// ---------------------------------------------------------------------------

function createListGuildsTool(_db: Database) {
  return tool(
    'discord_list_guilds',
    'List Discord guilds (servers) the bot is a member of.',
    {},
    async (_args) => {
      try {
        interface DiscordGuild {
          id: string;
          name: string;
          icon?: string;
          owner?: boolean;
          permissions?: string;
        }

        const guilds = await discordGet<DiscordGuild[]>('/users/@me/guilds');

        if (!guilds || guilds.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No guilds found.' }] };
        }

        const lines: string[] = [
          `Found ${guilds.length} guild${guilds.length !== 1 ? 's' : ''}:`,
          '',
        ];

        for (const guild of guilds) {
          lines.push(`ID: ${guild.id}`);
          lines.push(`Name: ${fenceUntrustedContent(guild.name, 'discord.guild')}`);
          if (guild.owner !== undefined) {
            lines.push(`Owner: ${guild.owner ? 'yes' : 'no'}`);
          }
          lines.push('');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing guilds: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Discord Guilds',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// discord_list_channels
// ---------------------------------------------------------------------------

function createListChannelsTool(_db: Database) {
  return tool(
    'discord_list_channels',
    'List channels in a Discord guild (server).',
    {
      guild_id: z.string().describe('The Discord guild (server) ID'),
    },
    async (args) => {
      try {
        interface DiscordChannel {
          id: string;
          name?: string;
          type: number;
          topic?: string;
          position?: number;
          parent_id?: string;
        }

        const channels = await discordGet<DiscordChannel[]>(`/guilds/${args.guild_id}/channels`);

        if (!channels || channels.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No channels found in this guild.' }] };
        }

        const lines: string[] = [
          `Found ${channels.length} channel${channels.length !== 1 ? 's' : ''} in guild ${args.guild_id}:`,
          '',
        ];

        // Channel type 0 = text, 2 = voice, 4 = category, 5 = announcement
        const typeNames: Record<number, string> = {
          0: 'text',
          2: 'voice',
          4: 'category',
          5: 'announcement',
          10: 'announcement-thread',
          11: 'public-thread',
          12: 'private-thread',
          13: 'stage',
          15: 'forum',
        };

        for (const channel of channels) {
          lines.push(`ID: ${channel.id}`);
          if (channel.name) {
            lines.push(`Name: ${fenceUntrustedContent(channel.name, 'discord.channel')}`);
          }
          lines.push(`Type: ${typeNames[channel.type] ?? `unknown(${channel.type})`}`);
          if (channel.topic) {
            lines.push(`Topic: ${fenceUntrustedContent(channel.topic, 'discord.channel')}`);
          }
          if (channel.position !== undefined) {
            lines.push(`Position: ${channel.position}`);
          }
          lines.push('');
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
        title: 'List Discord Channels',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// discord_get_messages
// ---------------------------------------------------------------------------

function createGetMessagesTool(_db: Database) {
  return tool(
    'discord_get_messages',
    'Get recent messages from a Discord channel.',
    {
      channel_id: z.string().describe('The Discord channel ID'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Number of messages to retrieve (1–100, default 50)'),
      before: z
        .string()
        .optional()
        .describe('Retrieve messages before this message ID (for pagination)'),
    },
    async (args) => {
      try {
        interface DiscordMessage {
          id: string;
          content: string;
          timestamp: string;
          author: {
            id: string;
            username: string;
            global_name?: string;
            bot?: boolean;
          };
          referenced_message?: { id: string };
        }

        const limit = args.limit ?? 50;
        let path = `/channels/${args.channel_id}/messages?limit=${limit}`;
        if (args.before) path += `&before=${args.before}`;

        const messages = await discordGet<DiscordMessage[]>(path);

        if (!messages || messages.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No messages found in this channel.' }] };
        }

        const lines: string[] = [
          `${messages.length} message${messages.length !== 1 ? 's' : ''} from channel ${args.channel_id}:`,
          '',
        ];

        for (const msg of messages) {
          const displayName = msg.author.global_name ?? msg.author.username;
          lines.push(`ID: ${msg.id}`);
          lines.push(`Author: ${fenceUntrustedContent(displayName, 'discord.message')} (${msg.author.id})`);
          lines.push(`Timestamp: ${msg.timestamp}`);
          lines.push(`Content: ${fenceUntrustedContent(msg.content || '(empty)', 'discord.message')}`);
          lines.push('');
        }

        if (messages.length === limit) {
          lines.push(`Use before=${messages[messages.length - 1].id} to get older messages.`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting messages: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Discord Messages',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// discord_send_message
// ---------------------------------------------------------------------------

function createSendMessageTool(_db: Database) {
  return tool(
    'discord_send_message',
    'Send a message to a Discord channel. This sends a real message — confirm with the user before calling.',
    {
      channel_id: z.string().describe('The Discord channel ID to send the message to'),
      content: z
        .string()
        .max(2000)
        .describe('The message content (max 2000 characters)'),
    },
    async (args) => {
      try {
        interface DiscordMessage {
          id: string;
          channel_id: string;
          timestamp: string;
        }

        const data = await discordPost<DiscordMessage>(`/channels/${args.channel_id}/messages`, {
          content: args.content,
        });

        const lines = [
          'Message sent successfully.',
          `Message ID: ${data.id}`,
          `Channel ID: ${data.channel_id}`,
          `Timestamp: ${data.timestamp}`,
        ];

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error sending message: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Send Discord Message',
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// discord_add_reaction
// ---------------------------------------------------------------------------

function createAddReactionTool(_db: Database) {
  return tool(
    'discord_add_reaction',
    'Add an emoji reaction to a Discord message.',
    {
      channel_id: z.string().describe('The Discord channel ID where the message is'),
      message_id: z.string().describe('The Discord message ID to react to'),
      emoji: z
        .string()
        .describe(
          'The emoji to react with. For standard Unicode emoji use the character (e.g. "👍"). For custom emoji use "name:id" format (e.g. "custom_emoji:123456789").'
        ),
    },
    async (args) => {
      try {
        // URL-encode the emoji for the path
        const encodedEmoji = encodeURIComponent(args.emoji);
        await discordPut(
          `/channels/${args.channel_id}/messages/${args.message_id}/reactions/${encodedEmoji}/@me`
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: `Reaction ${args.emoji} added to message ${args.message_id} in channel ${args.channel_id}.`,
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
        title: 'Add Discord Reaction',
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// discord_get_user
// ---------------------------------------------------------------------------

function createGetUserTool(_db: Database) {
  return tool(
    'discord_get_user',
    'Get information about a Discord user by their user ID.',
    {
      user_id: z.string().describe('The Discord user ID to look up'),
    },
    async (args) => {
      try {
        interface DiscordUser {
          id: string;
          username: string;
          global_name?: string;
          discriminator?: string;
          bot?: boolean;
          avatar?: string;
        }

        const user = await discordGet<DiscordUser>(`/users/${args.user_id}`);

        const lines: string[] = [
          `User ID: ${user.id}`,
          `Username: ${fenceUntrustedContent(user.username, 'discord.user')}`,
        ];

        if (user.global_name) {
          lines.push(`Display Name: ${fenceUntrustedContent(user.global_name, 'discord.user')}`);
        }
        if (user.discriminator && user.discriminator !== '0') {
          lines.push(`Discriminator: ${user.discriminator}`);
        }
        if (user.bot !== undefined) {
          lines.push(`Bot: ${user.bot ? 'yes' : 'no'}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting user: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Discord User',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createDiscordTools(db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'discord_list_guilds',
      description: 'List Discord guilds (servers) the bot is a member of',
      sdkTool: createListGuildsTool(db),
    },
    {
      name: 'discord_list_channels',
      description: 'List channels in a Discord guild',
      sdkTool: createListChannelsTool(db),
    },
    {
      name: 'discord_get_messages',
      description: 'Get recent messages from a Discord channel',
      sdkTool: createGetMessagesTool(db),
    },
    {
      name: 'discord_send_message',
      description: 'Send a message to a Discord channel',
      sdkTool: createSendMessageTool(db),
    },
    {
      name: 'discord_add_reaction',
      description: 'Add an emoji reaction to a Discord message',
      sdkTool: createAddReactionTool(db),
    },
    {
      name: 'discord_get_user',
      description: 'Get information about a Discord user by ID',
      sdkTool: createGetUserTool(db),
    },
  ];
}
