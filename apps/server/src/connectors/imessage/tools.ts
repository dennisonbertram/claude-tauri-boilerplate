import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { fenceUntrustedContent, sanitizeError } from '../utils';

const execFileAsync = promisify(execFile);

const CHAT_DB_PATH = `${process.env.HOME}/Library/Messages/chat.db`;

// Apple epoch offset: seconds from Unix epoch to 2001-01-01
const APPLE_EPOCH_OFFSET_SEC = 978307200;

/**
 * Convert Apple timestamp (nanoseconds since 2001-01-01) to JS Date.
 */
function appleTimestampToDate(ts: number | bigint): Date {
  const secs = Number(ts) / 1e9;
  return new Date((secs + APPLE_EPOCH_OFFSET_SEC) * 1000);
}

/**
 * Open a read-only connection to the Messages chat.db.
 * Throws a user-friendly error if the DB is inaccessible.
 */
function openChatDb(): InstanceType<typeof import('bun:sqlite').Database> {
  // We import Database lazily so that the module can be mocked in tests.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Database } = require('bun:sqlite') as typeof import('bun:sqlite');
  try {
    return new Database(CHAT_DB_PATH, { readonly: true });
  } catch (err) {
    throw new Error(
      `Cannot open Messages database at ${CHAT_DB_PATH}. ` +
        'Full Disk Access may be required (System Settings → Privacy & Security → Full Disk Access). ' +
        `Original error: ${sanitizeError(err)}`
    );
  }
}

// ---------------------------------------------------------------------------
// imessage_list_conversations
// ---------------------------------------------------------------------------

function createListConversationsTool(_db: Database) {
  return tool(
    'imessage_list_conversations',
    'List recent iMessage conversations. Returns contact/group name, last message date, and unread count for each chat.',
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Maximum number of conversations to return (1-100, default 25)'),
    },
    async (args) => {
      try {
        const chatDb = openChatDb();
        try {
          const limit = args.limit ?? 25;

          // Get chats with their last message timestamp and unread count
          const rows = chatDb
            .query<
              {
                rowid: number;
                chat_identifier: string;
                display_name: string | null;
                last_date: number | null;
                unread_count: number;
              },
              [number]
            >(
              `SELECT
                c.ROWID        AS rowid,
                c.chat_identifier,
                c.display_name,
                MAX(m.date)    AS last_date,
                COALESCE(SUM(CASE WHEN m.is_read = 0 AND m.is_from_me = 0 THEN 1 ELSE 0 END), 0) AS unread_count
              FROM chat c
              LEFT JOIN chat_message_join cmj ON cmj.chat_id = c.ROWID
              LEFT JOIN message m ON m.ROWID = cmj.message_id
              GROUP BY c.ROWID
              ORDER BY last_date DESC NULLS LAST
              LIMIT ?`
            )
            .all(limit);

          if (rows.length === 0) {
            return { content: [{ type: 'text' as const, text: 'No conversations found.' }] };
          }

          const lines: string[] = [`Found ${rows.length} conversation${rows.length !== 1 ? 's' : ''}:`, ''];

          for (const row of rows) {
            const name = row.display_name || row.chat_identifier;
            const dateStr = row.last_date ? appleTimestampToDate(row.last_date).toLocaleString() : 'No messages';
            lines.push(
              `Chat ID: ${row.rowid}`,
              `Name: ${fenceUntrustedContent(name, 'iMessage')}`,
              `Last Message: ${dateStr}`,
              `Unread: ${row.unread_count}`,
              ''
            );
          }

          return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
        } finally {
          chatDb.close();
        }
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing conversations: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List iMessage Conversations',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// imessage_get_messages
// ---------------------------------------------------------------------------

function createGetMessagesTool(_db: Database) {
  return tool(
    'imessage_get_messages',
    'Get messages from a specific iMessage conversation by chat ID. Returns up to 50 recent messages with sender, text, and timestamp.',
    {
      chat_id: z.number().int().describe('The numeric chat ID (from imessage_list_conversations)'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe('Maximum number of messages to return (1-50, default 50)'),
    },
    async (args) => {
      try {
        const chatDb = openChatDb();
        try {
          const limit = args.limit ?? 50;

          const rows = chatDb
            .query<
              {
                rowid: number;
                text: string | null;
                date: number;
                is_from_me: number;
                handle_id: number;
                id: string | null;
              },
              [number, number]
            >(
              `SELECT
                m.ROWID        AS rowid,
                m.text,
                m.date,
                m.is_from_me,
                m.handle_id,
                h.id
              FROM message m
              INNER JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
              LEFT JOIN handle h ON m.handle_id = h.ROWID
              WHERE cmj.chat_id = ?
              ORDER BY m.date DESC
              LIMIT ?`
            )
            .all(args.chat_id, limit);

          if (rows.length === 0) {
            return {
              content: [{ type: 'text' as const, text: `No messages found for chat ID ${args.chat_id}.` }],
            };
          }

          // Display oldest first
          const sorted = [...rows].reverse();
          const lines: string[] = [`${sorted.length} message${sorted.length !== 1 ? 's' : ''} from chat ${args.chat_id}:`, ''];

          for (const row of sorted) {
            const dateStr = appleTimestampToDate(row.date).toLocaleString();
            const sender = row.is_from_me ? 'Me' : (row.id ?? `Handle ${row.handle_id}`);
            const text = row.text ?? '(attachment or empty message)';
            lines.push(
              `[${dateStr}] ${fenceUntrustedContent(sender, 'iMessage')}: ${fenceUntrustedContent(text, 'iMessage')}`
            );
          }

          return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
        } finally {
          chatDb.close();
        }
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting messages: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get iMessages',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// imessage_search
// ---------------------------------------------------------------------------

function createSearchTool(_db: Database) {
  return tool(
    'imessage_search',
    'Search through iMessage history for messages containing a specific text string. Returns matching messages with sender and date context.',
    {
      query: z.string().min(1).describe('Text to search for in message content'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Maximum number of results to return (1-100, default 25)'),
    },
    async (args) => {
      try {
        const chatDb = openChatDb();
        try {
          const limit = args.limit ?? 25;

          const rows = chatDb
            .query<
              {
                rowid: number;
                text: string | null;
                date: number;
                is_from_me: number;
                chat_id: number;
                sender_id: string | null;
              },
              [string, number]
            >(
              `SELECT
                m.ROWID          AS rowid,
                m.text,
                m.date,
                m.is_from_me,
                cmj.chat_id,
                h.id             AS sender_id
              FROM message m
              INNER JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
              LEFT JOIN handle h ON m.handle_id = h.ROWID
              WHERE m.text LIKE ?
              ORDER BY m.date DESC
              LIMIT ?`
            )
            .all(`%${args.query}%`, limit);

          if (rows.length === 0) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `No messages found matching: ${fenceUntrustedContent(args.query, 'iMessage.search')}`,
                },
              ],
            };
          }

          const lines: string[] = [
            `Found ${rows.length} message${rows.length !== 1 ? 's' : ''} matching ${fenceUntrustedContent(args.query, 'iMessage.search')}:`,
            '',
          ];

          for (const row of rows) {
            const dateStr = appleTimestampToDate(row.date).toLocaleString();
            const sender = row.is_from_me ? 'Me' : (row.sender_id ?? 'Unknown');
            const text = row.text ?? '(empty)';
            lines.push(
              `Chat ID: ${row.chat_id}`,
              `Date: ${dateStr}`,
              `From: ${fenceUntrustedContent(sender, 'iMessage')}`,
              `Text: ${fenceUntrustedContent(text, 'iMessage')}`,
              ''
            );
          }

          return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
        } finally {
          chatDb.close();
        }
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error searching messages: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Search iMessages',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// imessage_send
// ---------------------------------------------------------------------------

/**
 * Validate phone number / email handle for iMessage.
 * Accepts E.164 phone numbers (+1234567890) and email addresses.
 */
function validateRecipient(recipient: string): boolean {
  // E.164 phone number
  if (/^\+[1-9]\d{6,14}$/.test(recipient)) return true;
  // Email address
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return true;
  return false;
}

function createSendTool(_db: Database) {
  return tool(
    'imessage_send',
    'Send an iMessage to a phone number or email address. This sends a real message — always confirm with the user before calling.',
    {
      recipient: z
        .string()
        .describe(
          'Phone number in E.164 format (e.g. "+15551234567") or email address registered with iMessage'
        ),
      message: z.string().min(1).max(5000).describe('The message text to send'),
    },
    async (args) => {
      // Validate recipient format
      if (!validateRecipient(args.recipient)) {
        return {
          content: [
            {
              type: 'text' as const,
              text:
                `Error: Invalid recipient "${args.recipient}". ` +
                'Please provide a phone number in E.164 format (e.g. "+15551234567") or a valid email address.',
            },
          ],
          isError: true,
        };
      }

      // Escape the message for AppleScript: double any backslashes then escape quotes
      const escapedMessage = args.message.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const escapedRecipient = args.recipient.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

      const script = [
        'tell application "Messages"',
        `  set targetService to 1st service whose service type = iMessage`,
        `  set targetBuddy to buddy "${escapedRecipient}" of targetService`,
        `  send "${escapedMessage}" to targetBuddy`,
        'end tell',
      ].join('\n');

      try {
        await execFileAsync('osascript', ['-e', script]);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Message sent successfully to ${args.recipient}.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error sending message: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Send iMessage',
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createIMessageTools(db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'imessage_list_conversations',
      description: 'List recent iMessage conversations',
      sdkTool: createListConversationsTool(db),
    },
    {
      name: 'imessage_get_messages',
      description: 'Get messages from a specific iMessage chat',
      sdkTool: createGetMessagesTool(db),
    },
    {
      name: 'imessage_search',
      description: 'Search iMessage history for text',
      sdkTool: createSearchTool(db),
    },
    {
      name: 'imessage_send',
      description: 'Send an iMessage',
      sdkTool: createSendTool(db),
    },
  ];
}
