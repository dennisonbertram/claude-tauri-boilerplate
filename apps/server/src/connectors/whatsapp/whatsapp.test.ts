import { describe, test, expect, beforeAll } from 'bun:test';
import type { Database } from 'bun:sqlite';

// ---------------------------------------------------------------------------
// Import tools and connector factory
// ---------------------------------------------------------------------------

const { createWhatsAppTools, SETUP_MESSAGE } = await import('./tools');
const { whatsappConnectorFactory } = await import('./index');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fakeDb = {} as Database;

async function callTool(
  tools: ReturnType<typeof createWhatsAppTools>,
  name: string,
  args: Record<string, unknown>
) {
  const t = tools.find((x) => x.name === name);
  if (!t) throw new Error(`Tool "${name}" not found`);
  return t.sdkTool.handler(args);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WhatsApp Connector', () => {
  let tools: ReturnType<typeof createWhatsAppTools>;

  beforeAll(() => {
    tools = createWhatsAppTools(fakeDb);
  });

  // ---------- Connector definition ----------

  describe('whatsappConnectorFactory', () => {
    test('produces connector with name "whatsapp"', () => {
      const connector = whatsappConnectorFactory(fakeDb);
      expect(connector.name).toBe('whatsapp');
    });

    test('has displayName "WhatsApp"', () => {
      const connector = whatsappConnectorFactory(fakeDb);
      expect(connector.displayName).toBe('WhatsApp');
    });

    test('has category "communication"', () => {
      const connector = whatsappConnectorFactory(fakeDb);
      expect(connector.category).toBe('communication');
    });

    test('has icon "📱"', () => {
      const connector = whatsappConnectorFactory(fakeDb);
      expect(connector.icon).toBe('📱');
    });

    test('requiresAuth is true', () => {
      const connector = whatsappConnectorFactory(fakeDb);
      expect(connector.requiresAuth).toBe(true);
    });

    test('has a non-empty description', () => {
      const connector = whatsappConnectorFactory(fakeDb);
      expect(connector.description).toBeTruthy();
      expect(connector.description.length).toBeGreaterThan(0);
    });

    test('produces 5 tools', () => {
      const connector = whatsappConnectorFactory(fakeDb);
      expect(connector.tools).toHaveLength(5);
    });
  });

  // ---------- Tool registration ----------

  describe('createWhatsAppTools', () => {
    test('returns 5 tools', () => {
      expect(tools).toHaveLength(5);
    });

    test('has all expected tool names', () => {
      const names = tools.map((t) => t.name);
      expect(names).toContain('whatsapp_list_chats');
      expect(names).toContain('whatsapp_get_messages');
      expect(names).toContain('whatsapp_send_message');
      expect(names).toContain('whatsapp_search_contacts');
      expect(names).toContain('whatsapp_get_chat_info');
    });

    test('each tool has required fields (name, description, sdkTool)', () => {
      for (const t of tools) {
        expect(t.name).toBeTruthy();
        expect(t.description).toBeTruthy();
        expect(t.sdkTool).toBeDefined();
        expect(t.sdkTool.name).toBe(t.name);
        expect(typeof t.sdkTool.handler).toBe('function');
      }
    });

    test('each tool has openWorldHint: true', () => {
      for (const t of tools) {
        expect(t.sdkTool.annotations?.openWorldHint).toBe(true);
      }
    });

    test('read-only tools have readOnlyHint: true', () => {
      const readOnlyTools = ['whatsapp_list_chats', 'whatsapp_get_messages', 'whatsapp_search_contacts', 'whatsapp_get_chat_info'];
      for (const name of readOnlyTools) {
        const t = tools.find((x) => x.name === name);
        expect(t?.sdkTool.annotations?.readOnlyHint).toBe(true);
      }
    });

    test('whatsapp_send_message has readOnlyHint: false', () => {
      const t = tools.find((x) => x.name === 'whatsapp_send_message');
      expect(t?.sdkTool.annotations?.readOnlyHint).toBe(false);
    });
  });

  // ---------- whatsapp_list_chats ----------

  describe('whatsapp_list_chats', () => {
    test('returns not-configured message', async () => {
      const result = await callTool(tools, 'whatsapp_list_chats', {});
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain(SETUP_MESSAGE);
    });

    test('returns isError: true', async () => {
      const result = await callTool(tools, 'whatsapp_list_chats', {});
      expect(result.isError).toBe(true);
    });

    test('accepts limit parameter without throwing', async () => {
      const result = await callTool(tools, 'whatsapp_list_chats', { limit: 10 });
      expect(result.content[0].text).toContain(SETUP_MESSAGE);
    });

    test('accepts cursor parameter without throwing', async () => {
      const result = await callTool(tools, 'whatsapp_list_chats', { cursor: 'some-cursor' });
      expect(result.content[0].text).toContain(SETUP_MESSAGE);
    });
  });

  // ---------- whatsapp_get_messages ----------

  describe('whatsapp_get_messages', () => {
    test('returns not-configured message', async () => {
      const result = await callTool(tools, 'whatsapp_get_messages', {
        jid: '1234567890@s.whatsapp.net',
      });
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain(SETUP_MESSAGE);
    });

    test('returns isError: true', async () => {
      const result = await callTool(tools, 'whatsapp_get_messages', {
        jid: '1234567890@s.whatsapp.net',
      });
      expect(result.isError).toBe(true);
    });

    test('accepts limit parameter without throwing', async () => {
      const result = await callTool(tools, 'whatsapp_get_messages', {
        jid: '1234567890@s.whatsapp.net',
        limit: 50,
      });
      expect(result.content[0].text).toContain(SETUP_MESSAGE);
    });
  });

  // ---------- whatsapp_send_message ----------

  describe('whatsapp_send_message', () => {
    test('returns not-configured message', async () => {
      const result = await callTool(tools, 'whatsapp_send_message', {
        jid: '1234567890@s.whatsapp.net',
        message: 'Hello!',
      });
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain(SETUP_MESSAGE);
    });

    test('returns isError: true', async () => {
      const result = await callTool(tools, 'whatsapp_send_message', {
        jid: '1234567890@s.whatsapp.net',
        message: 'Hello!',
      });
      expect(result.isError).toBe(true);
    });

    test('setup message mentions Baileys', async () => {
      const result = await callTool(tools, 'whatsapp_send_message', {
        jid: '1234567890@s.whatsapp.net',
        message: 'Hello!',
      });
      expect(result.content[0].text).toContain('Baileys');
    });

    test('setup message mentions QR code auth', async () => {
      const result = await callTool(tools, 'whatsapp_send_message', {
        jid: '1234567890@s.whatsapp.net',
        message: 'Hello!',
      });
      expect(result.content[0].text).toContain('QR code auth');
    });
  });

  // ---------- whatsapp_search_contacts ----------

  describe('whatsapp_search_contacts', () => {
    test('returns not-configured message', async () => {
      const result = await callTool(tools, 'whatsapp_search_contacts', {
        query: 'Alice',
      });
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain(SETUP_MESSAGE);
    });

    test('returns isError: true', async () => {
      const result = await callTool(tools, 'whatsapp_search_contacts', {
        query: 'Alice',
      });
      expect(result.isError).toBe(true);
    });
  });

  // ---------- whatsapp_get_chat_info ----------

  describe('whatsapp_get_chat_info', () => {
    test('returns not-configured message', async () => {
      const result = await callTool(tools, 'whatsapp_get_chat_info', {
        jid: '1234567890@s.whatsapp.net',
      });
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain(SETUP_MESSAGE);
    });

    test('returns isError: true', async () => {
      const result = await callTool(tools, 'whatsapp_get_chat_info', {
        jid: '1234567890-1234567890@g.us',
      });
      expect(result.isError).toBe(true);
    });

    test('works for group JID format', async () => {
      const result = await callTool(tools, 'whatsapp_get_chat_info', {
        jid: '1234567890-1234567890@g.us',
      });
      expect(result.content[0].text).toContain(SETUP_MESSAGE);
    });
  });

  // ---------- Setup message content verification ----------

  describe('SETUP_MESSAGE content', () => {
    test('mentions pnpm add @whiskeysockets/baileys', () => {
      expect(SETUP_MESSAGE).toContain('pnpm add @whiskeysockets/baileys');
    });

    test('mentions QR code auth', () => {
      expect(SETUP_MESSAGE).toContain('QR code auth');
    });
  });
});
