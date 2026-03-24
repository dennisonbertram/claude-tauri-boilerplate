import { google } from 'googleapis';
import type { Database } from 'bun:sqlite';
import { getAuthenticatedClient, classifyGoogleError } from './auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MessageSummary {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  labelIds: string[];
}

export interface MessageFull extends MessageSummary {
  body: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHeader(
  headers: Array<{ name?: string | null; value?: string | null }> | undefined,
  name: string,
): string {
  if (!headers) return '';
  const h = headers.find(
    (hdr) => hdr.name?.toLowerCase() === name.toLowerCase(),
  );
  return h?.value ?? '';
}

/**
 * Decode a base64url-encoded string to UTF-8 text.
 */
function decodeBase64Url(data: string): string {
  // Replace URL-safe chars and add padding
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf-8');
}

/**
 * Walk a MIME message tree and extract the first text/plain body.
 * Falls back to text/html if no text/plain is found (stripped of tags).
 */
function extractPlainText(payload: any): string {
  if (!payload) return '';

  // Leaf node with body data
  if (payload.body?.data) {
    const mime = (payload.mimeType ?? '').toLowerCase();
    if (mime === 'text/plain') {
      return decodeBase64Url(payload.body.data);
    }
  }

  // Recurse into parts (multipart/alternative, multipart/mixed, etc.)
  if (Array.isArray(payload.parts)) {
    // Prefer text/plain
    for (const part of payload.parts) {
      if ((part.mimeType ?? '').toLowerCase() === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    // Recurse deeper
    for (const part of payload.parts) {
      const result = extractPlainText(part);
      if (result) return result;
    }
  }

  // Last resort: decode whatever body data exists
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  return '';
}

function parseMessageHeaders(msg: any): Omit<MessageSummary, 'body'> {
  const headers = msg.payload?.headers ?? [];
  return {
    id: msg.id ?? '',
    threadId: msg.threadId ?? '',
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    subject: getHeader(headers, 'Subject'),
    snippet: msg.snippet ?? '',
    date: getHeader(headers, 'Date'),
    labelIds: msg.labelIds ?? [],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listMessages(
  db: Database,
  query?: string,
  pageToken?: string,
  maxResults: number = 20,
): Promise<{ messages: MessageSummary[]; nextPageToken?: string }> {
  const client = getAuthenticatedClient(db);
  const gmail = google.gmail({ version: 'v1', auth: client });

  try {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query ?? undefined,
      pageToken: pageToken ?? undefined,
      maxResults,
    });

    const ids = listRes.data.messages ?? [];
    if (ids.length === 0) {
      return { messages: [] };
    }

    // Fetch metadata for each message in parallel
    const messages = await Promise.all(
      ids.map(async (ref) => {
        const msgRes = await gmail.users.messages.get({
          userId: 'me',
          id: ref.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date'],
        });
        return parseMessageHeaders(msgRes.data);
      }),
    );

    return {
      messages,
      nextPageToken: listRes.data.nextPageToken ?? undefined,
    };
  } catch (err) {
    throw Object.assign(new Error('Gmail listMessages failed'), {
      cause: err,
      classified: classifyGoogleError(err),
    });
  }
}

export async function getMessage(
  db: Database,
  messageId: string,
): Promise<MessageFull> {
  const client = getAuthenticatedClient(db);
  const gmail = google.gmail({ version: 'v1', auth: client });

  try {
    const res = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const summary = parseMessageHeaders(res.data);
    const body = extractPlainText(res.data.payload);

    return { ...summary, body };
  } catch (err) {
    throw Object.assign(new Error('Gmail getMessage failed'), {
      cause: err,
      classified: classifyGoogleError(err),
    });
  }
}

export async function sendMessage(
  db: Database,
  to: string,
  subject: string,
  body: string,
  threadId?: string,
): Promise<{ id: string; threadId: string }> {
  const client = getAuthenticatedClient(db);
  const gmail = google.gmail({ version: 'v1', auth: client });

  // Construct RFC 2822 message
  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    body,
  ];
  const rawMessage = messageParts.join('\r\n');

  // base64url encode
  const encoded = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encoded,
        threadId: threadId ?? undefined,
      },
    });

    return {
      id: res.data.id ?? '',
      threadId: res.data.threadId ?? '',
    };
  } catch (err) {
    throw Object.assign(new Error('Gmail sendMessage failed'), {
      cause: err,
      classified: classifyGoogleError(err),
    });
  }
}
