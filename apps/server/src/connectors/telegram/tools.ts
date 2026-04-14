import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { sanitizeError, fenceUntrustedContent } from '../utils';

// ---------------------------------------------------------------------------
// Telegram Bot API helpers
//
// NOTE: This connector uses the Telegram Bot API (not MTProto). Bots can only
// see messages sent directly to them, or messages in groups/channels where
// the bot is a member and has been granted appropriate permissions.
// ---------------------------------------------------------------------------

const TELEGRAM_API_BASE = 'https://api.telegram.org';

function getToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set');
  }
  return token;
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

async function telegramGet<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  const token = getToken();
  let url = `${TELEGRAM_API_BASE}/bot${token}/${method}`;

  if (params && Object.keys(params).length > 0) {
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        queryParams.set(key, String(value));
      }
    }
    url += `?${queryParams.toString()}`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as TelegramResponse<T>;

  if (!data.ok) {
    const desc = data.description ?? 'unknown error';
    const code = data.error_code ? ` (code ${data.error_code})` : '';
    throw new Error(`Telegram API error: ${desc}${code}`);
  }

  return data.result as T;
}

async function telegramPost<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = getToken();
  const url = `${TELEGRAM_API_BASE}/bot${token}/${method}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as TelegramResponse<T>;

  if (!data.ok) {
    const desc = data.description ?? 'unknown error';
    const code = data.error_code ? ` (code ${data.error_code})` : '';
    throw new Error(`Telegram API error: ${desc}${code}`);
  }

  return data.result as T;
}

// ---------------------------------------------------------------------------
// telegram_get_updates
// ---------------------------------------------------------------------------

function createGetUpdatesTool(_db: Database) {
  return tool(
    'telegram_get_updates',
    [
      'Get recent updates (messages, events) received by the bot via long-polling. Returns up to 50 of the most recent updates.',
      'LIMITATION: Bots only receive messages sent directly to them, or messages in groups/channels where the bot is a member.',
      'Use the offset parameter to paginate through updates (pass update_id + 1 of the last seen update).',
    ].join(' '),
    {
      offset: z
        .number()
        .int()
        .optional()
        .describe(
          'Identifier of the first update to return. Pass (last update_id + 1) to acknowledge previously received updates.'
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Maximum number of updates to retrieve (1–100, default 50)'),
    },
    async (args) => {
      try {
        interface TelegramUser {
          id: number;
          first_name: string;
          last_name?: string;
          username?: string;
          is_bot?: boolean;
        }
        interface TelegramChat {
          id: number;
          type: string;
          title?: string;
          username?: string;
          first_name?: string;
          last_name?: string;
        }
        interface TelegramMessage {
          message_id: number;
          from?: TelegramUser;
          chat: TelegramChat;
          date: number;
          text?: string;
          caption?: string;
        }
        interface TelegramUpdate {
          update_id: number;
          message?: TelegramMessage;
          edited_message?: TelegramMessage;
          channel_post?: TelegramMessage;
        }

        const params: Record<string, unknown> = {
          limit: args.limit ?? 50,
        };
        if (args.offset !== undefined) params.offset = args.offset;

        const updates = await telegramGet<TelegramUpdate[]>('getUpdates', params);

        if (!updates || updates.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No new updates.' }] };
        }

        const lines: string[] = [`${updates.length} update${updates.length !== 1 ? 's' : ''}:`, ''];

        for (const update of updates) {
          lines.push(`Update ID: ${update.update_id}`);

          const msg = update.message ?? update.edited_message ?? update.channel_post;
          if (msg) {
            const type = update.message
              ? 'message'
              : update.edited_message
                ? 'edited_message'
                : 'channel_post';
            lines.push(`Type: ${type}`);
            lines.push(`Message ID: ${msg.message_id}`);
            lines.push(`Chat ID: ${msg.chat.id} (${msg.chat.type})`);

            if (msg.chat.title) {
              lines.push(`Chat title: ${fenceUntrustedContent(msg.chat.title, 'telegram.update')}`);
            }

            if (msg.from) {
              const senderName = [msg.from.first_name, msg.from.last_name]
                .filter(Boolean)
                .join(' ');
              lines.push(`From: ${fenceUntrustedContent(senderName, 'telegram.update')} (id: ${msg.from.id})`);
              if (msg.from.username) {
                lines.push(`Username: @${fenceUntrustedContent(msg.from.username, 'telegram.update')}`);
              }
            }

            lines.push(`Date: ${new Date(msg.date * 1000).toISOString()}`);

            if (msg.text) {
              lines.push(`Text: ${fenceUntrustedContent(msg.text, 'telegram.update')}`);
            } else if (msg.caption) {
              lines.push(`Caption: ${fenceUntrustedContent(msg.caption, 'telegram.update')}`);
            }
          } else {
            lines.push('(non-message update)');
          }

          lines.push('');
        }

        const lastUpdateId = updates[updates.length - 1]?.update_id;
        if (lastUpdateId !== undefined) {
          lines.push(`To acknowledge these updates, use offset=${lastUpdateId + 1} on the next call.`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting updates: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Telegram Updates',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// telegram_send_message
// ---------------------------------------------------------------------------

function createSendMessageTool(_db: Database) {
  return tool(
    'telegram_send_message',
    'Send a text message to a Telegram chat. This action sends a real message — confirm with the user before calling. HTML parse mode is used: supported tags are <b>, <i>, <u>, <s>, <code>, <pre>, <a href="...">.',
    {
      chat_id: z
        .union([z.string(), z.number()])
        .describe(
          'Unique identifier for the target chat, or the username of a public channel (e.g. @channelusername)'
        ),
      text: z
        .string()
        .max(4096)
        .describe('Text of the message to send (max 4096 characters). HTML formatting is supported.'),
      reply_to_message_id: z
        .number()
        .int()
        .optional()
        .describe('If provided, the message will be sent as a reply to this message ID in the same chat.'),
    },
    async (args) => {
      try {
        interface SentMessage {
          message_id: number;
          chat: { id: number; type: string };
          date: number;
        }

        const body: Record<string, unknown> = {
          chat_id: args.chat_id,
          text: args.text,
          parse_mode: 'HTML',
        };
        if (args.reply_to_message_id !== undefined) {
          body.reply_to_message_id = args.reply_to_message_id;
        }

        const msg = await telegramPost<SentMessage>('sendMessage', body);

        const lines = [
          'Message sent successfully.',
          `Message ID: ${msg.message_id}`,
          `Chat ID: ${msg.chat.id}`,
          `Date: ${new Date(msg.date * 1000).toISOString()}`,
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
        title: 'Send Telegram Message',
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// telegram_get_chat
// ---------------------------------------------------------------------------

function createGetChatTool(_db: Database) {
  return tool(
    'telegram_get_chat',
    [
      'Get information about a Telegram chat (group, supergroup, channel, or private chat).',
      'The bot must be a member of the chat to retrieve its details.',
    ].join(' '),
    {
      chat_id: z
        .union([z.string(), z.number()])
        .describe('Unique identifier for the chat or the username of a public channel (e.g. @channelusername)'),
    },
    async (args) => {
      try {
        interface ChatFull {
          id: number;
          type: string;
          title?: string;
          username?: string;
          first_name?: string;
          last_name?: string;
          description?: string;
          invite_link?: string;
          member_count?: number;
        }

        const chat = await telegramGet<ChatFull>('getChat', { chat_id: args.chat_id });

        const lines: string[] = [
          `Chat ID: ${chat.id}`,
          `Type: ${chat.type}`,
        ];

        if (chat.title) {
          lines.push(`Title: ${fenceUntrustedContent(chat.title, 'telegram.chat')}`);
        }
        if (chat.username) {
          lines.push(`Username: @${fenceUntrustedContent(chat.username, 'telegram.chat')}`);
        }
        if (chat.first_name) {
          const fullName = [chat.first_name, chat.last_name].filter(Boolean).join(' ');
          lines.push(`Name: ${fenceUntrustedContent(fullName, 'telegram.chat')}`);
        }
        if (chat.description) {
          lines.push(`Description: ${fenceUntrustedContent(chat.description, 'telegram.chat')}`);
        }
        if (chat.invite_link) {
          lines.push(`Invite link: ${chat.invite_link}`);
        }
        if (chat.member_count !== undefined) {
          lines.push(`Members: ${chat.member_count}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting chat: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Telegram Chat',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// telegram_get_chat_history
// ---------------------------------------------------------------------------

function createGetChatHistoryTool(_db: Database) {
  return tool(
    'telegram_get_chat_history',
    [
      'Retrieve recent messages for a chat using the Bot API getUpdates endpoint with a specific offset range.',
      'IMPORTANT LIMITATION: The Telegram Bot API does not provide a direct "get message history" method.',
      'This tool retrieves updates (including messages) within a given update_id range.',
      'Bots can only access messages they have already received via getUpdates — messages sent before the bot joined are not accessible.',
      'For full message history, use a Telegram client app or the MTProto API (not available in this connector).',
    ].join(' '),
    {
      chat_id: z
        .union([z.string(), z.number()])
        .describe('Chat ID to filter messages for. Only messages from this chat will be shown.'),
      offset: z
        .number()
        .int()
        .optional()
        .describe('Starting update_id offset to retrieve from. Omit to start from the oldest available update.'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Maximum number of updates to scan (1–100, default 100). Increases coverage of the chat history window.'),
    },
    async (args) => {
      try {
        interface TelegramUser {
          id: number;
          first_name: string;
          last_name?: string;
          username?: string;
        }
        interface TelegramChat {
          id: number;
          type: string;
          title?: string;
        }
        interface TelegramMessage {
          message_id: number;
          from?: TelegramUser;
          chat: TelegramChat;
          date: number;
          text?: string;
          caption?: string;
        }
        interface TelegramUpdate {
          update_id: number;
          message?: TelegramMessage;
          edited_message?: TelegramMessage;
          channel_post?: TelegramMessage;
        }

        const params: Record<string, unknown> = {
          limit: args.limit ?? 100,
        };
        if (args.offset !== undefined) params.offset = args.offset;

        const updates = await telegramGet<TelegramUpdate[]>('getUpdates', params);

        const targetChatId = String(args.chat_id);
        const filtered = (updates ?? []).filter((u) => {
          const msg = u.message ?? u.edited_message ?? u.channel_post;
          return msg && String(msg.chat.id) === targetChatId;
        });

        if (filtered.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: [
                  `No messages found for chat ${args.chat_id}.`,
                  'Note: Bots can only retrieve messages received after they joined the chat.',
                ].join(' '),
              },
            ],
          };
        }

        const lines: string[] = [
          `${filtered.length} message${filtered.length !== 1 ? 's' : ''} from chat ${args.chat_id}:`,
          '',
        ];

        for (const update of filtered) {
          const msg = update.message ?? update.edited_message ?? update.channel_post;
          if (!msg) continue;

          lines.push(`Message ID: ${msg.message_id}`);
          lines.push(`Update ID: ${update.update_id}`);
          lines.push(`Date: ${new Date(msg.date * 1000).toISOString()}`);

          if (msg.from) {
            const senderName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');
            lines.push(`From: ${fenceUntrustedContent(senderName, 'telegram.history')}`);
          }

          if (msg.text) {
            lines.push(`Text: ${fenceUntrustedContent(msg.text, 'telegram.history')}`);
          } else if (msg.caption) {
            lines.push(`Caption: ${fenceUntrustedContent(msg.caption, 'telegram.history')}`);
          }

          lines.push('');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error getting chat history: ${sanitizeError(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Telegram Chat History',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// telegram_send_photo
// ---------------------------------------------------------------------------

function createSendPhotoTool(_db: Database) {
  return tool(
    'telegram_send_photo',
    'Send a photo to a Telegram chat by URL. This action sends a real photo — confirm with the user before calling. The bot must be a member of the target chat.',
    {
      chat_id: z
        .union([z.string(), z.number()])
        .describe('Unique identifier for the target chat or username of a public channel'),
      photo: z
        .string()
        .url()
        .describe('HTTPS URL of the photo to send. Must be a direct image URL (JPEG, PNG, GIF, BMP, or WEBP).'),
      caption: z
        .string()
        .max(1024)
        .optional()
        .describe('Optional caption for the photo (max 1024 characters). HTML formatting is supported.'),
      reply_to_message_id: z
        .number()
        .int()
        .optional()
        .describe('Optional message ID to reply to in the same chat.'),
    },
    async (args) => {
      try {
        interface SentMessage {
          message_id: number;
          chat: { id: number; type: string };
          date: number;
        }

        const body: Record<string, unknown> = {
          chat_id: args.chat_id,
          photo: args.photo,
          parse_mode: 'HTML',
        };
        if (args.caption !== undefined) {
          body.caption = args.caption;
        }
        if (args.reply_to_message_id !== undefined) {
          body.reply_to_message_id = args.reply_to_message_id;
        }

        const msg = await telegramPost<SentMessage>('sendPhoto', body);

        const lines = [
          'Photo sent successfully.',
          `Message ID: ${msg.message_id}`,
          `Chat ID: ${msg.chat.id}`,
          `Date: ${new Date(msg.date * 1000).toISOString()}`,
        ];

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error sending photo: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Send Telegram Photo',
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// telegram_get_me
// ---------------------------------------------------------------------------

function createGetMeTool(_db: Database) {
  return tool(
    'telegram_get_me',
    'Get basic information about the bot itself (username, id, name). Useful for confirming the bot is connected and seeing its identity.',
    {},
    async (_args) => {
      try {
        interface BotInfo {
          id: number;
          is_bot: boolean;
          first_name: string;
          username: string;
          can_join_groups?: boolean;
          can_read_all_group_messages?: boolean;
          supports_inline_queries?: boolean;
        }

        const bot = await telegramGet<BotInfo>('getMe');

        const lines: string[] = [
          `Bot ID: ${bot.id}`,
          `Name: ${fenceUntrustedContent(bot.first_name, 'telegram.me')}`,
          `Username: @${fenceUntrustedContent(bot.username, 'telegram.me')}`,
          `Is bot: ${bot.is_bot}`,
        ];

        if (bot.can_join_groups !== undefined) {
          lines.push(`Can join groups: ${bot.can_join_groups}`);
        }
        if (bot.can_read_all_group_messages !== undefined) {
          lines.push(`Can read all group messages: ${bot.can_read_all_group_messages}`);
        }
        if (bot.supports_inline_queries !== undefined) {
          lines.push(`Supports inline queries: ${bot.supports_inline_queries}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting bot info: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Telegram Bot Info',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createTelegramTools(_db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'telegram_get_updates',
      description: 'Get recent updates (messages) received by the bot',
      sdkTool: createGetUpdatesTool(_db),
    },
    {
      name: 'telegram_send_message',
      description: 'Send a text message to a Telegram chat',
      sdkTool: createSendMessageTool(_db),
    },
    {
      name: 'telegram_get_chat',
      description: 'Get information about a Telegram chat',
      sdkTool: createGetChatTool(_db),
    },
    {
      name: 'telegram_get_chat_history',
      description: 'Get message history for a chat (via getUpdates, Bot API limitation applies)',
      sdkTool: createGetChatHistoryTool(_db),
    },
    {
      name: 'telegram_send_photo',
      description: 'Send a photo to a Telegram chat by URL',
      sdkTool: createSendPhotoTool(_db),
    },
    {
      name: 'telegram_get_me',
      description: 'Get information about the bot itself',
      sdkTool: createGetMeTool(_db),
    },
  ];
}
