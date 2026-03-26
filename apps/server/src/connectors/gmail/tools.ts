import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { listMessages, getMessage, sendMessage } from '../../services/google/gmail';

// ---------------------------------------------------------------------------
// gmail_list_messages
// ---------------------------------------------------------------------------

function createListMessagesTool(db: Database) {
  return tool(
    'gmail_list_messages',
    'List or search Gmail messages. Returns a summary of recent messages matching the optional query.',
    {
      query: z
        .string()
        .optional()
        .describe(
          'Gmail search query (e.g. "from:someone@example.com", "subject:invoice", "is:unread"). Omit to list recent inbox messages.'
        ),
      maxResults: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe('Maximum number of messages to return (1-50, default 20)'),
      pageToken: z
        .string()
        .optional()
        .describe('Page token from a previous response to retrieve the next page'),
    },
    async (args) => {
      try {
        const { messages, nextPageToken } = await listMessages(
          db,
          args.query,
          args.pageToken,
          args.maxResults ?? 20
        );

        if (messages.length === 0) {
          const text = args.query
            ? `No messages found matching query: "${args.query}"`
            : 'No messages found.';
          return { content: [{ type: 'text' as const, text }] };
        }

        const lines: string[] = [
          `Found ${messages.length} message${messages.length !== 1 ? 's' : ''}${args.query ? ` matching "${args.query}"` : ''}:`,
          '',
        ];

        for (const msg of messages) {
          lines.push(
            `ID: ${msg.id}`,
            `From: ${msg.from}`,
            `Subject: ${msg.subject}`,
            `Date: ${msg.date}`,
            `Snippet: ${msg.snippet}`,
            ''
          );
        }

        if (nextPageToken) {
          lines.push(`Next page token: ${nextPageToken}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error listing messages: ${message}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Gmail Messages',
        readOnlyHint: true,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// gmail_get_message
// ---------------------------------------------------------------------------

function createGetMessageTool(db: Database) {
  return tool(
    'gmail_get_message',
    'Get the full content of a Gmail message by its ID, including the message body.',
    {
      messageId: z.string().describe('The Gmail message ID to retrieve'),
    },
    async (args) => {
      try {
        const msg = await getMessage(db, args.messageId);

        const lines = [
          `Message ID: ${msg.id}`,
          `Thread ID: ${msg.threadId}`,
          `From: ${msg.from}`,
          `To: ${msg.to}`,
          `Subject: ${msg.subject}`,
          `Date: ${msg.date}`,
          `Labels: ${msg.labelIds.join(', ') || 'none'}`,
          '',
          '--- Body ---',
          msg.body || '(no body)',
        ];

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error retrieving message: ${message}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Gmail Message',
        readOnlyHint: true,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// gmail_send_message
// ---------------------------------------------------------------------------

function createSendMessageTool(db: Database) {
  return tool(
    'gmail_send_message',
    'Send an email via Gmail. This action sends a real email — use with care and always confirm with the user before calling.',
    {
      to: z.string().describe('Recipient email address (e.g. "someone@example.com")'),
      subject: z.string().describe('Email subject line'),
      body: z.string().describe('Plain-text email body'),
      threadId: z
        .string()
        .optional()
        .describe('Thread ID to reply within an existing thread. Omit to start a new thread.'),
    },
    async (args) => {
      try {
        const result = await sendMessage(db, args.to, args.subject, args.body, args.threadId);

        const text = [
          'Email sent successfully.',
          `Message ID: ${result.id}`,
          `Thread ID: ${result.threadId}`,
        ].join('\n');

        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error sending email: ${message}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Send Gmail Message',
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createGmailTools(db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'gmail_list_messages',
      description: 'List or search Gmail messages',
      sdkTool: createListMessagesTool(db),
    },
    {
      name: 'gmail_get_message',
      description: 'Get the full content of a Gmail message by ID',
      sdkTool: createGetMessageTool(db),
    },
    {
      name: 'gmail_send_message',
      description: 'Send an email via Gmail',
      sdkTool: createSendMessageTool(db),
    },
  ];
}
