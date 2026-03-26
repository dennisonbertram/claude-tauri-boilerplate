import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { fenceUntrustedContent, sanitizeError } from '../utils';

// ---------------------------------------------------------------------------
// WhatsApp Connector (Stub)
//
// NOTE: This connector requires the Baileys library for WhatsApp Web protocol
// access. Until the library is installed and QR code authentication is
// completed, all tools return a setup guidance message.
//
// To fully enable this connector:
//   1. Run: pnpm add @whiskeysockets/baileys
//   2. Implement QR code auth flow (scan QR with WhatsApp mobile app)
//   3. Replace stub handlers with Baileys session calls
// ---------------------------------------------------------------------------

const SETUP_MESSAGE =
  'WhatsApp connector requires Baileys library — run `pnpm add @whiskeysockets/baileys` and configure QR code auth';

// ---------------------------------------------------------------------------
// whatsapp_list_chats
// ---------------------------------------------------------------------------

function createListChatsTool(_db: Database) {
  return tool(
    'whatsapp_list_chats',
    'List recent WhatsApp chats. Returns a summary of chats ordered by most recent activity.',
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Maximum number of chats to return (1–100, default 20)'),
      cursor: z
        .string()
        .optional()
        .describe('Pagination cursor from a previous response to retrieve the next page of chats'),
    },
    async (_args) => {
      try {
        return {
          content: [{ type: 'text' as const, text: SETUP_MESSAGE }],
          isError: true,
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing chats: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List WhatsApp Chats',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// whatsapp_get_messages
// ---------------------------------------------------------------------------

function createGetMessagesTool(_db: Database) {
  return tool(
    'whatsapp_get_messages',
    'Get messages from a WhatsApp chat by its JID (Jabber ID). Returns messages in chronological order.',
    {
      jid: z
        .string()
        .describe(
          'WhatsApp JID of the chat to retrieve messages from (e.g. "1234567890@s.whatsapp.net" for individual, "1234567890-1234567890@g.us" for group)'
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Maximum number of messages to return (1–100, default 20)'),
    },
    async (_args) => {
      try {
        return {
          content: [{ type: 'text' as const, text: SETUP_MESSAGE }],
          isError: true,
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting messages: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get WhatsApp Messages',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// whatsapp_send_message
// ---------------------------------------------------------------------------

function createSendMessageTool(_db: Database) {
  return tool(
    'whatsapp_send_message',
    'Send a text message to a WhatsApp chat. This action sends a real message — confirm with the user before calling.',
    {
      jid: z
        .string()
        .describe(
          'WhatsApp JID of the recipient or group (e.g. "1234567890@s.whatsapp.net" for individual, "1234567890-1234567890@g.us" for group)'
        ),
      message: z
        .string()
        .max(4096)
        .describe('Text content of the message to send (max 4096 characters)'),
    },
    async (_args) => {
      try {
        return {
          content: [{ type: 'text' as const, text: SETUP_MESSAGE }],
          isError: true,
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
        title: 'Send WhatsApp Message',
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// whatsapp_search_contacts
// ---------------------------------------------------------------------------

function createSearchContactsTool(_db: Database) {
  return tool(
    'whatsapp_search_contacts',
    'Search WhatsApp contacts by name or phone number. Returns matching contacts with their JIDs.',
    {
      query: z
        .string()
        .describe('Search query to match against contact names or phone numbers'),
    },
    async (_args) => {
      try {
        return {
          content: [{ type: 'text' as const, text: SETUP_MESSAGE }],
          isError: true,
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error searching contacts: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Search WhatsApp Contacts',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// whatsapp_get_chat_info
// ---------------------------------------------------------------------------

function createGetChatInfoTool(_db: Database) {
  return tool(
    'whatsapp_get_chat_info',
    'Get details about a WhatsApp chat including name, participants (for groups), and metadata.',
    {
      jid: z
        .string()
        .describe(
          'WhatsApp JID of the chat to retrieve details for (e.g. "1234567890@s.whatsapp.net" for individual, "1234567890-1234567890@g.us" for group)'
        ),
    },
    async (_args) => {
      try {
        return {
          content: [{ type: 'text' as const, text: SETUP_MESSAGE }],
          isError: true,
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting chat info: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get WhatsApp Chat Info',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createWhatsAppTools(_db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'whatsapp_list_chats',
      description: 'List recent WhatsApp chats',
      sdkTool: createListChatsTool(_db),
    },
    {
      name: 'whatsapp_get_messages',
      description: 'Get messages from a WhatsApp chat by JID',
      sdkTool: createGetMessagesTool(_db),
    },
    {
      name: 'whatsapp_send_message',
      description: 'Send a text message to a WhatsApp chat',
      sdkTool: createSendMessageTool(_db),
    },
    {
      name: 'whatsapp_search_contacts',
      description: 'Search WhatsApp contacts by name or phone number',
      sdkTool: createSearchContactsTool(_db),
    },
    {
      name: 'whatsapp_get_chat_info',
      description: 'Get details about a WhatsApp chat',
      sdkTool: createGetChatInfoTool(_db),
    },
  ];
}

// Export the setup message for use in tests
export { SETUP_MESSAGE };
