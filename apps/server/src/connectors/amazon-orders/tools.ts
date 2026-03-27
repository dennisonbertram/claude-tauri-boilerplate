import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { getAuthenticatedClient } from '../../services/google/auth';
import { fenceUntrustedContent, sanitizeError } from '../utils';
import { sanitizeOrderId, sanitizeDateParam } from './sanitize';

// ---------------------------------------------------------------------------
// Gmail API helpers (fetch-based)
// ---------------------------------------------------------------------------

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Get a fresh access token from the authenticated OAuth2 client.
 */
async function getAccessToken(db: Database): Promise<string> {
  const client = getAuthenticatedClient(db);
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;
  if (!token) {
    throw new Error('Failed to obtain Google OAuth access token');
  }
  return token;
}

interface GmailMessageRef {
  id: string;
  threadId: string;
}

interface GmailListResponse {
  messages?: GmailMessageRef[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessagePayload {
  headers?: GmailHeader[];
  body?: { data?: string; size?: number };
  parts?: GmailMessagePayload[];
  mimeType?: string;
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: GmailMessagePayload;
}

/**
 * List Gmail messages matching a query.
 */
async function gmailListMessages(
  accessToken: string,
  query: string,
  maxResults: number = 20,
  pageToken?: string,
): Promise<GmailListResponse> {
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
  if (pageToken) params.set('pageToken', pageToken);

  const res = await fetch(`${GMAIL_API_BASE}/messages?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Gmail API error ${res.status}: ${errText}`);
  }

  return res.json() as Promise<GmailListResponse>;
}

/**
 * Get a single Gmail message by ID (full format).
 */
async function gmailGetMessage(accessToken: string, messageId: string): Promise<GmailMessage> {
  const res = await fetch(`${GMAIL_API_BASE}/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Gmail API error ${res.status}: ${errText}`);
  }

  return res.json() as Promise<GmailMessage>;
}

// ---------------------------------------------------------------------------
// Email parsing helpers
// ---------------------------------------------------------------------------

function getHeader(payload: GmailMessagePayload | undefined, name: string): string {
  if (!payload?.headers) return '';
  const h = payload.headers.find((hdr) => hdr.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? '';
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf-8');
}

function extractPlainText(payload: GmailMessagePayload | undefined): string {
  if (!payload) return '';

  if (payload.body?.data) {
    const mime = (payload.mimeType ?? '').toLowerCase();
    if (mime === 'text/plain') {
      return decodeBase64Url(payload.body.data);
    }
  }

  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if ((part.mimeType ?? '').toLowerCase() === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    for (const part of payload.parts) {
      const result = extractPlainText(part);
      if (result) return result;
    }
  }

  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  return '';
}

/**
 * Extract Amazon order numbers from a subject line.
 * Amazon order numbers follow the pattern: NNN-NNNNNNN-NNNNNNN
 */
function extractOrderNumber(text: string): string | null {
  const match = text.match(/\d{3}-\d{7}-\d{7}/);
  return match ? match[0] : null;
}

/**
 * Extract dollar amounts from text (e.g. "$29.99", "$ 100.00").
 */
function extractAmounts(text: string): number[] {
  const matches = text.matchAll(/\$\s*(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/g);
  const amounts: number[] = [];
  for (const m of matches) {
    const val = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(val)) amounts.push(val);
  }
  return amounts;
}

/**
 * Extract tracking numbers from shipping confirmation emails.
 * Covers common carrier formats (UPS, FedEx, USPS, Amazon Logistics).
 */
function extractTrackingInfo(text: string): Array<{ number: string; carrier: string }> {
  const results: Array<{ number: string; carrier: string }> = [];

  // UPS: 1Z followed by 16 alphanumeric chars
  const upsMatches = text.matchAll(/\b(1Z[A-Z0-9]{16})\b/g);
  for (const m of upsMatches) {
    results.push({ number: m[1], carrier: 'UPS' });
  }

  // FedEx: 12 or 15 or 20 digit numbers
  const fedexMatches = text.matchAll(/\bTracking[^:]*:\s*([0-9]{12,20})\b/gi);
  for (const m of fedexMatches) {
    if (!results.find((r) => r.number === m[1])) {
      results.push({ number: m[1], carrier: 'FedEx' });
    }
  }

  // USPS: 9400 or 9205 or similar 20-22 digit starts
  const uspsMatches = text.matchAll(/\b(9[24][0-9]{18,20})\b/g);
  for (const m of uspsMatches) {
    results.push({ number: m[1], carrier: 'USPS' });
  }

  // Amazon Logistics: TBA followed by 12 digits
  const amznMatches = text.matchAll(/\b(TBA[0-9]{12})\b/g);
  for (const m of amznMatches) {
    results.push({ number: m[1], carrier: 'Amazon Logistics' });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Amazon sender query
// ---------------------------------------------------------------------------

const AMAZON_ORDER_QUERY =
  'from:auto-confirm@amazon.com OR from:ship-confirm@amazon.com';
const AMAZON_SHIPPING_QUERY =
  'from:ship-confirm@amazon.com';

const MAX_BODY_LENGTH = 30_000;

// ---------------------------------------------------------------------------
// Tool: amazon_list_orders
// ---------------------------------------------------------------------------

function createListOrdersTool(db: Database) {
  return tool(
    'amazon_list_orders',
    'Search Gmail for Amazon order confirmation and shipping emails. Returns a list of recent Amazon orders parsed from email subjects and snippets.',
    {
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe('Maximum number of order emails to return (1-50, default 20)'),
      pageToken: z
        .string()
        .optional()
        .describe('Page token from a previous response to retrieve the next page'),
    },
    async (args) => {
      try {
        const accessToken = await getAccessToken(db);
        const { messages, nextPageToken } = await gmailListMessages(
          accessToken,
          AMAZON_ORDER_QUERY,
          args.maxResults ?? 20,
          args.pageToken,
        );

        if (!messages || messages.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No Amazon order emails found.' }],
          };
        }

        const lines: string[] = [
          `Found ${messages.length} Amazon order email${messages.length !== 1 ? 's' : ''}:`,
          '',
        ];

        for (const ref of messages) {
          const msg = await gmailGetMessage(accessToken, ref.id);
          const subject = getHeader(msg.payload, 'Subject');
          const date = getHeader(msg.payload, 'Date');
          const from = getHeader(msg.payload, 'From');
          const orderNumber = extractOrderNumber(subject) ?? extractOrderNumber(msg.snippet ?? '');

          lines.push(
            `Message ID: ${msg.id}`,
            `Date: ${fenceUntrustedContent(date, 'amazon-orders')}`,
            `From: ${fenceUntrustedContent(from, 'amazon-orders')}`,
            `Subject: ${fenceUntrustedContent(subject, 'amazon-orders')}`,
            `Order Number: ${orderNumber ? fenceUntrustedContent(orderNumber, 'amazon-orders') : '(not found in subject)'}`,
            `Snippet: ${fenceUntrustedContent(msg.snippet ?? '', 'amazon-orders')}`,
            '',
          );
        }

        if (nextPageToken) {
          lines.push(`Next page token: ${nextPageToken}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing Amazon orders: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Amazon Orders',
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Tool: amazon_get_order
// ---------------------------------------------------------------------------

function createGetOrderTool(db: Database) {
  return tool(
    'amazon_get_order',
    'Get details of a specific Amazon order by searching Gmail for the order ID. Parses the email body for items, prices, and delivery dates.',
    {
      orderId: z
        .string()
        .describe('Amazon order ID (e.g. "114-1234567-8901234")'),
    },
    async (args) => {
      try {
        const safeOrderId = sanitizeOrderId(args.orderId);
        const accessToken = await getAccessToken(db);
        const query = `(from:auto-confirm@amazon.com OR from:ship-confirm@amazon.com) "${safeOrderId}"`;
        const { messages } = await gmailListMessages(accessToken, query, 10);

        if (!messages || messages.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No emails found for order ID: ${fenceUntrustedContent(args.orderId, 'amazon-orders')}`,
              },
            ],
          };
        }

        const lines: string[] = [
          `Order details for ${fenceUntrustedContent(args.orderId, 'amazon-orders')}:`,
          '',
        ];

        for (const ref of messages) {
          const msg = await gmailGetMessage(accessToken, ref.id);
          const subject = getHeader(msg.payload, 'Subject');
          const date = getHeader(msg.payload, 'Date');
          const from = getHeader(msg.payload, 'From');

          let bodyText = extractPlainText(msg.payload);
          if (bodyText.length > MAX_BODY_LENGTH) {
            bodyText = bodyText.slice(0, MAX_BODY_LENGTH) + '\n\n[Email body truncated]';
          }

          const amounts = extractAmounts(bodyText + ' ' + subject);
          const totalStr = amounts.length > 0
            ? amounts.map((a) => `$${a.toFixed(2)}`).join(', ')
            : '(not found)';

          lines.push(
            `Message ID: ${msg.id}`,
            `Date: ${fenceUntrustedContent(date, 'amazon-orders')}`,
            `From: ${fenceUntrustedContent(from, 'amazon-orders')}`,
            `Subject: ${fenceUntrustedContent(subject, 'amazon-orders')}`,
            `Amounts found: ${fenceUntrustedContent(totalStr, 'amazon-orders')}`,
            '',
            '--- Email Body ---',
            fenceUntrustedContent(bodyText || '(no body)', 'amazon-orders'),
            '',
          );
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error retrieving order: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Amazon Order',
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Tool: amazon_track_delivery
// ---------------------------------------------------------------------------

function createTrackDeliveryTool(db: Database) {
  return tool(
    'amazon_track_delivery',
    'Search Gmail for Amazon shipping confirmation emails and extract tracking numbers and carrier info.',
    {
      orderId: z
        .string()
        .optional()
        .describe('Amazon order ID to filter by (optional). Omit to list all recent shipping emails.'),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe('Maximum number of shipping emails to search (1-20, default 10)'),
    },
    async (args) => {
      try {
        const safeOrderId = args.orderId ? sanitizeOrderId(args.orderId) : undefined;
        const accessToken = await getAccessToken(db);
        const query = safeOrderId
          ? `${AMAZON_SHIPPING_QUERY} "${safeOrderId}"`
          : AMAZON_SHIPPING_QUERY;

        const { messages } = await gmailListMessages(
          accessToken,
          query,
          args.maxResults ?? 10,
        );

        if (!messages || messages.length === 0) {
          const noResultMsg = safeOrderId
            ? `No shipping emails found for order: ${fenceUntrustedContent(safeOrderId, 'amazon-orders')}`
            : 'No Amazon shipping emails found.';
          return { content: [{ type: 'text' as const, text: noResultMsg }] };
        }

        const lines: string[] = [
          `Found ${messages.length} shipping email${messages.length !== 1 ? 's' : ''}:`,
          '',
        ];

        for (const ref of messages) {
          const msg = await gmailGetMessage(accessToken, ref.id);
          const subject = getHeader(msg.payload, 'Subject');
          const date = getHeader(msg.payload, 'Date');
          const orderNumber = extractOrderNumber(subject) ?? extractOrderNumber(msg.snippet ?? '');

          let bodyText = extractPlainText(msg.payload);
          if (bodyText.length > MAX_BODY_LENGTH) {
            bodyText = bodyText.slice(0, MAX_BODY_LENGTH) + '\n\n[Email body truncated]';
          }

          const trackingInfo = extractTrackingInfo(bodyText + ' ' + subject + ' ' + (msg.snippet ?? ''));

          lines.push(
            `Message ID: ${msg.id}`,
            `Date: ${fenceUntrustedContent(date, 'amazon-orders')}`,
            `Subject: ${fenceUntrustedContent(subject, 'amazon-orders')}`,
            `Order Number: ${orderNumber ? fenceUntrustedContent(orderNumber, 'amazon-orders') : '(not found)'}`,
          );

          if (trackingInfo.length > 0) {
            lines.push('Tracking:');
            for (const t of trackingInfo) {
              lines.push(`  ${fenceUntrustedContent(t.carrier, 'amazon-orders')}: ${fenceUntrustedContent(t.number, 'amazon-orders')}`);
            }
          } else {
            lines.push('Tracking: (no tracking numbers found in email)');
          }

          lines.push('');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error tracking delivery: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Track Amazon Delivery',
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Tool: amazon_spending_summary
// ---------------------------------------------------------------------------

function createSpendingSummaryTool(db: Database) {
  return tool(
    'amazon_spending_summary',
    'Aggregate Amazon order amounts from confirmation emails over a date range. Returns total spending and a breakdown by order.',
    {
      after: z
        .string()
        .optional()
        .describe('Start date in YYYY/MM/DD format (Gmail date filter). Omit for all-time.'),
      before: z
        .string()
        .optional()
        .describe('End date in YYYY/MM/DD format (Gmail date filter). Omit for no end limit.'),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe('Maximum number of order emails to aggregate (1-50, default 50)'),
    },
    async (args) => {
      try {
        const safeAfter = args.after ? sanitizeDateParam(args.after) : undefined;
        const safeBefore = args.before ? sanitizeDateParam(args.before) : undefined;
        const accessToken = await getAccessToken(db);

        let query = 'from:auto-confirm@amazon.com subject:"order"';
        if (safeAfter) query += ` after:${safeAfter}`;
        if (safeBefore) query += ` before:${safeBefore}`;

        const { messages } = await gmailListMessages(
          accessToken,
          query,
          args.maxResults ?? 50,
        );

        if (!messages || messages.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No Amazon order emails found for the specified date range.' }],
          };
        }

        let totalSpending = 0;
        const orderLines: string[] = [];

        for (const ref of messages) {
          const msg = await gmailGetMessage(accessToken, ref.id);
          const subject = getHeader(msg.payload, 'Subject');
          const date = getHeader(msg.payload, 'Date');

          let bodyText = extractPlainText(msg.payload);
          if (bodyText.length > MAX_BODY_LENGTH) {
            bodyText = bodyText.slice(0, MAX_BODY_LENGTH);
          }

          const orderNumber = extractOrderNumber(subject) ?? extractOrderNumber(bodyText);
          const amounts = extractAmounts(subject + ' ' + bodyText);

          // Use the largest amount as the order total (heuristic: order total is usually the biggest)
          const orderTotal = amounts.length > 0 ? Math.max(...amounts) : 0;
          totalSpending += orderTotal;

          orderLines.push(
            `  ${fenceUntrustedContent(date, 'amazon-orders')} | ` +
            `Order: ${orderNumber ? fenceUntrustedContent(orderNumber, 'amazon-orders') : 'unknown'} | ` +
            `Amount: $${orderTotal.toFixed(2)}`,
          );
        }

        const dateRange = [
          args.after ? `from ${args.after}` : '',
          args.before ? `to ${args.before}` : '',
        ]
          .filter(Boolean)
          .join(' ');

        const lines = [
          `Amazon spending summary${dateRange ? ` (${dateRange})` : ''}:`,
          `Total orders analyzed: ${messages.length}`,
          `Estimated total spending: $${totalSpending.toFixed(2)}`,
          '',
          'Order breakdown:',
          ...orderLines,
        ];

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error generating spending summary: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Amazon Spending Summary',
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createAmazonOrdersTools(db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'amazon_list_orders',
      description: 'Search Gmail for Amazon order confirmation and shipping emails',
      sdkTool: createListOrdersTool(db),
    },
    {
      name: 'amazon_get_order',
      description: 'Get details of a specific Amazon order by searching Gmail for the order ID',
      sdkTool: createGetOrderTool(db),
    },
    {
      name: 'amazon_track_delivery',
      description: 'Search for Amazon shipping confirmation emails and extract tracking numbers',
      sdkTool: createTrackDeliveryTool(db),
    },
    {
      name: 'amazon_spending_summary',
      description: 'Aggregate Amazon order amounts from confirmation emails over a date range',
      sdkTool: createSpendingSummaryTool(db),
    },
  ];
}
