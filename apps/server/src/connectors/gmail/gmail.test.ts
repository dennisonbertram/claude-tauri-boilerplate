import { describe, test, expect, mock, beforeAll } from 'bun:test';
import type { Database } from 'bun:sqlite';
import type { MessageSummary, MessageFull } from '../../services/google/gmail';

// ---------------------------------------------------------------------------
// Mock the gmail service before importing tools
// ---------------------------------------------------------------------------

type ListMessagesResult = { messages: MessageSummary[]; nextPageToken?: string };
type SendMessageResult = { id: string; threadId: string };

const mockListMessages = mock(async (): Promise<ListMessagesResult> => ({
  messages: [
    {
      id: 'msg1',
      threadId: 'thread1',
      from: 'alice@example.com',
      to: 'me@example.com',
      subject: 'Hello World',
      snippet: 'This is a test email...',
      date: 'Mon, 1 Jan 2024 10:00:00 +0000',
      labelIds: ['INBOX', 'UNREAD'],
    },
  ],
  nextPageToken: undefined,
}));

const mockGetMessage = mock(async (): Promise<MessageFull> => ({
  id: 'msg1',
  threadId: 'thread1',
  from: 'alice@example.com',
  to: 'me@example.com',
  subject: 'Hello World',
  snippet: 'This is a test email...',
  date: 'Mon, 1 Jan 2024 10:00:00 +0000',
  labelIds: ['INBOX', 'UNREAD'],
  body: 'This is the full email body.',
}));

const mockSendMessage = mock(async (): Promise<SendMessageResult> => ({
  id: 'sent1',
  threadId: 'thread1',
}));

mock.module('../../services/google/gmail', () => ({
  listMessages: mockListMessages,
  getMessage: mockGetMessage,
  sendMessage: mockSendMessage,
}));

// ---------------------------------------------------------------------------
// Import tools after mocking
// ---------------------------------------------------------------------------

const { createGmailTools } = await import('./tools');

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const fakeDb = {} as Database;

async function callTool(tools: ReturnType<typeof createGmailTools>, name: string, args: Record<string, unknown>) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool.sdkTool.handler(args);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Gmail Connector Tools', () => {
  let tools: ReturnType<typeof createGmailTools>;

  beforeAll(() => {
    tools = createGmailTools(fakeDb);
  });

  // ---------- Tool registration ----------

  describe('createGmailTools', () => {
    test('returns 3 tools', () => {
      expect(tools).toHaveLength(3);
    });

    test('has expected tool names', () => {
      const names = tools.map((t) => t.name);
      expect(names).toContain('gmail_list_messages');
      expect(names).toContain('gmail_get_message');
      expect(names).toContain('gmail_send_message');
    });

    test('each tool has required fields', () => {
      for (const t of tools) {
        expect(t.name).toBeTruthy();
        expect(t.description).toBeTruthy();
        expect(t.sdkTool).toBeDefined();
        expect(t.sdkTool.name).toBe(t.name);
        expect(typeof t.sdkTool.handler).toBe('function');
      }
    });
  });

  // ---------- gmail_list_messages ----------

  describe('gmail_list_messages', () => {
    test('returns formatted message list', async () => {
      mockListMessages.mockResolvedValueOnce({
        messages: [
          {
            id: 'msg1',
            threadId: 'thread1',
            from: 'alice@example.com',
            to: 'me@example.com',
            subject: 'Hello World',
            snippet: 'This is a test email...',
            date: 'Mon, 1 Jan 2024 10:00:00 +0000',
            labelIds: ['INBOX', 'UNREAD'],
          },
        ],
        nextPageToken: undefined,
      });

      const result = await callTool(tools, 'gmail_list_messages', {});

      expect(result.content[0].type).toBe('text');
      const text = result.content[0].text;
      expect(text).toContain('msg1');
      expect(text).toContain('alice@example.com');
      expect(text).toContain('Hello World');
    });

    test('passes query parameter to listMessages', async () => {
      mockListMessages.mockResolvedValueOnce({ messages: [], nextPageToken: undefined });

      await callTool(tools, 'gmail_list_messages', { query: 'is:unread', maxResults: 10 });

      expect(mockListMessages).toHaveBeenCalledWith(fakeDb, 'is:unread', undefined, 10);
    });

    test('returns empty message when no results found', async () => {
      mockListMessages.mockResolvedValueOnce({ messages: [], nextPageToken: undefined });

      const result = await callTool(tools, 'gmail_list_messages', { query: 'subject:nonexistent' });

      expect(result.content[0].text).toContain('No messages found');
    });

    test('includes next page token when present', async () => {
      mockListMessages.mockResolvedValueOnce({
        messages: [
          {
            id: 'msg2',
            threadId: 'thread2',
            from: 'bob@example.com',
            to: 'me@example.com',
            subject: 'Page 1',
            snippet: 'First page...',
            date: 'Tue, 2 Jan 2024 10:00:00 +0000',
            labelIds: ['INBOX'],
          },
        ],
        nextPageToken: 'next-page-abc123',
      });

      const result = await callTool(tools, 'gmail_list_messages', {});

      expect(result.content[0].text).toContain('next-page-abc123');
    });

    test('returns error result on service failure', async () => {
      mockListMessages.mockRejectedValueOnce(new Error('Gmail API error'));

      const result = await callTool(tools, 'gmail_list_messages', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Gmail API error');
    });
  });

  // ---------- gmail_get_message ----------

  describe('gmail_get_message', () => {
    test('returns full message content', async () => {
      mockGetMessage.mockResolvedValueOnce({
        id: 'msg1',
        threadId: 'thread1',
        from: 'alice@example.com',
        to: 'me@example.com',
        subject: 'Hello World',
        snippet: 'This is a test email...',
        date: 'Mon, 1 Jan 2024 10:00:00 +0000',
        labelIds: ['INBOX', 'UNREAD'],
        body: 'This is the full email body.',
      });

      const result = await callTool(tools, 'gmail_get_message', { messageId: 'msg1' });

      expect(result.content[0].type).toBe('text');
      const text = result.content[0].text;
      expect(text).toContain('msg1');
      expect(text).toContain('alice@example.com');
      expect(text).toContain('Hello World');
      expect(text).toContain('This is the full email body.');
    });

    test('passes messageId to getMessage service', async () => {
      mockGetMessage.mockResolvedValueOnce({
        id: 'msg99',
        threadId: 'thread99',
        from: 'sender@example.com',
        to: 'me@example.com',
        subject: 'Test',
        snippet: '',
        date: '',
        labelIds: [],
        body: '',
      });

      await callTool(tools, 'gmail_get_message', { messageId: 'msg99' });

      expect(mockGetMessage).toHaveBeenCalledWith(fakeDb, 'msg99');
    });

    test('shows "(no body)" when body is empty', async () => {
      mockGetMessage.mockResolvedValueOnce({
        id: 'msg1',
        threadId: 'thread1',
        from: 'alice@example.com',
        to: 'me@example.com',
        subject: 'Empty',
        snippet: '',
        date: '',
        labelIds: [],
        body: '',
      });

      const result = await callTool(tools, 'gmail_get_message', { messageId: 'msg1' });

      expect(result.content[0].text).toContain('(no body)');
    });

    test('returns error result on service failure', async () => {
      mockGetMessage.mockRejectedValueOnce(new Error('Message not found'));

      const result = await callTool(tools, 'gmail_get_message', { messageId: 'badid' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Message not found');
    });

    test('truncates email body exceeding 50KB', async () => {
      const longBody = 'x'.repeat(60_000);
      mockGetMessage.mockResolvedValueOnce({
        id: 'msg-long',
        threadId: 'thread1',
        from: 'sender@example.com',
        to: 'me@example.com',
        subject: 'Big Email',
        snippet: '',
        date: '',
        labelIds: [],
        body: longBody,
      });

      const result = await callTool(tools, 'gmail_get_message', { messageId: 'msg-long' });

      const text: string = result.content[0].text;
      expect(text).toContain('[Email body truncated');
      // Should not contain the full 60K body
      expect(text.length).toBeLessThan(60_000 + 500); // header + truncation notice, not full body
    });

    test('does not truncate email body under 50KB', async () => {
      const shortBody = 'Short email body.';
      mockGetMessage.mockResolvedValueOnce({
        id: 'msg-short',
        threadId: 'thread1',
        from: 'sender@example.com',
        to: 'me@example.com',
        subject: 'Small Email',
        snippet: '',
        date: '',
        labelIds: [],
        body: shortBody,
      });

      const result = await callTool(tools, 'gmail_get_message', { messageId: 'msg-short' });

      const text: string = result.content[0].text;
      expect(text).not.toContain('[Email body truncated');
      expect(text).toContain(shortBody);
    });
  });

  // ---------- gmail_send_message ----------

  describe('gmail_send_message', () => {
    test('returns success with message id and thread id', async () => {
      mockSendMessage.mockResolvedValueOnce({ id: 'sent123', threadId: 'thread456' });

      const result = await callTool(tools, 'gmail_send_message', {
        to: 'bob@example.com',
        subject: 'Test Subject',
        body: 'Test body text.',
      });

      expect(result.content[0].type).toBe('text');
      const text = result.content[0].text;
      expect(text).toContain('sent successfully');
      expect(text).toContain('sent123');
      expect(text).toContain('thread456');
    });

    test('passes all params to sendMessage service', async () => {
      mockSendMessage.mockResolvedValueOnce({ id: 'sent1', threadId: 'thread1' });

      await callTool(tools, 'gmail_send_message', {
        to: 'carol@example.com',
        subject: 'Re: Your message',
        body: 'Thanks for your email.',
        threadId: 'existingThread',
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        fakeDb,
        'carol@example.com',
        'Re: Your message',
        'Thanks for your email.',
        'existingThread'
      );
    });

    test('sends without threadId when omitted', async () => {
      mockSendMessage.mockResolvedValueOnce({ id: 'new1', threadId: 'newThread' });

      await callTool(tools, 'gmail_send_message', {
        to: 'dave@example.com',
        subject: 'New Thread',
        body: 'Starting a new conversation.',
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        fakeDb,
        'dave@example.com',
        'New Thread',
        'Starting a new conversation.',
        undefined
      );
    });

    test('returns error result on service failure', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('Auth token expired'));

      const result = await callTool(tools, 'gmail_send_message', {
        to: 'bob@example.com',
        subject: 'Subject',
        body: 'Body',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Auth token expired');
    });

    test('rejects invalid email address without calling sendMessage', async () => {
      mockSendMessage.mockClear();

      const result = await callTool(tools, 'gmail_send_message', {
        to: 'not-an-email',
        subject: 'Test',
        body: 'Body',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid email address');
      expect(result.content[0].text).toContain('not-an-email');
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    test('rejects email missing @ symbol', async () => {
      const result = await callTool(tools, 'gmail_send_message', {
        to: 'noatsign.com',
        subject: 'Test',
        body: 'Body',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid email address');
    });

    test('accepts valid email address', async () => {
      mockSendMessage.mockResolvedValueOnce({ id: 'sent1', threadId: 'thread1' });

      const result = await callTool(tools, 'gmail_send_message', {
        to: 'valid@example.com',
        subject: 'Test',
        body: 'Body',
      });

      expect(result.isError).toBeFalsy();
      expect(mockSendMessage).toHaveBeenCalled();
    });
  });
});
