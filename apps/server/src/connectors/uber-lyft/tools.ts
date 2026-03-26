import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { listMessages, getMessage } from '../../services/google/gmail';
import { sanitizeError, fenceUntrustedContent } from '../utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UBER_SENDER = 'from:uber.us@uber.com';
const LYFT_SENDER = 'from:no-reply@lyftmail.com';

// Matches dollar amounts like $12.34 or $1,234.56
const AMOUNT_REGEX = /\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/g;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse all dollar amounts found in a string and return their sum.
 * We pick the largest single amount in the email as the ride total —
 * smaller amounts are likely line items (base fare, service fee, etc.).
 * Falls back to 0 if no amount found.
 */
function parseLargestAmount(text: string): number {
  const matches = [...text.matchAll(AMOUNT_REGEX)];
  if (matches.length === 0) return 0;
  const amounts = matches.map((m) => parseFloat(m[1].replace(/,/g, '')));
  return Math.max(...amounts);
}

/**
 * Parse all dollar amounts from a text and return their sum.
 * Used for tallying totals across emails.
 */
function parseFirstAmount(text: string): number {
  const match = text.match(AMOUNT_REGEX);
  if (!match) return 0;
  return parseFloat(match[0].replace('$', '').replace(/,/g, ''));
}

type RideSource = 'uber' | 'lyft';

function detectSource(from: string, subject: string): RideSource {
  if (from.toLowerCase().includes('uber') || subject.toLowerCase().includes('uber')) {
    return 'uber';
  }
  return 'lyft';
}

/**
 * Parse a date from an email Date header into YYYY-MM-DD.
 * Returns the raw string if parsing fails.
 */
function parseDateString(dateHeader: string): string {
  if (!dateHeader) return '';
  try {
    const d = new Date(dateHeader);
    if (isNaN(d.getTime())) return dateHeader;
    return d.toISOString().slice(0, 10);
  } catch {
    return dateHeader;
  }
}

/**
 * Check if a ride date falls within [startDate, endDate] (inclusive, YYYY-MM-DD).
 */
function isInDateRange(rideDate: string, startDate?: string, endDate?: string): boolean {
  if (!startDate && !endDate) return true;
  const d = rideDate.slice(0, 10);
  if (startDate && d < startDate) return false;
  if (endDate && d > endDate) return false;
  return true;
}

// ---------------------------------------------------------------------------
// rides_list_rides
// ---------------------------------------------------------------------------

function createListRidesTool(db: Database) {
  return tool(
    'rides_list_rides',
    'Search Gmail for Uber and Lyft receipt emails and return a summary of recent rides. Parses subject lines for ride details.',
    {
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe('Maximum number of rides to return (1-50, default 20)'),
      startDate: z
        .string()
        .optional()
        .describe('Filter rides on or after this date (YYYY-MM-DD)'),
      endDate: z
        .string()
        .optional()
        .describe('Filter rides on or before this date (YYYY-MM-DD)'),
      source: z
        .enum(['uber', 'lyft', 'both'])
        .optional()
        .describe('Which ride service to query (default: both)'),
    },
    async (args) => {
      try {
        const maxResults = args.maxResults ?? 20;
        const src = args.source ?? 'both';

        // Build Gmail queries
        const queries: string[] = [];
        if (src === 'uber' || src === 'both') queries.push(UBER_SENDER);
        if (src === 'lyft' || src === 'both') queries.push(LYFT_SENDER);

        // Fetch results for each query
        const allMessages: Array<{
          id: string;
          from: string;
          subject: string;
          date: string;
          snippet: string;
          source: RideSource;
          rideDate: string;
        }> = [];

        for (const query of queries) {
          const { messages } = await listMessages(db, query, undefined, maxResults);
          for (const msg of messages) {
            const rideDate = parseDateString(msg.date);
            if (!isInDateRange(rideDate, args.startDate, args.endDate)) continue;
            allMessages.push({
              id: msg.id,
              from: msg.from,
              subject: msg.subject,
              date: msg.date,
              snippet: msg.snippet,
              source: detectSource(msg.from, msg.subject),
              rideDate,
            });
          }
        }

        // Sort by date descending (most recent first)
        allMessages.sort((a, b) => b.rideDate.localeCompare(a.rideDate));

        // Trim to maxResults
        const trimmed = allMessages.slice(0, maxResults);

        if (trimmed.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No ride receipts found matching the specified criteria.',
              },
            ],
          };
        }

        const lines: string[] = [
          `Found ${trimmed.length} ride receipt${trimmed.length !== 1 ? 's' : ''}:`,
          '',
        ];

        for (const msg of trimmed) {
          lines.push(
            `ID: ${msg.id}`,
            `Service: ${msg.source === 'uber' ? 'Uber' : 'Lyft'}`,
            `Date: ${fenceUntrustedContent(msg.rideDate || msg.date, 'uber-lyft')}`,
            `Subject: ${fenceUntrustedContent(msg.subject, 'uber-lyft')}`,
            `Snippet: ${fenceUntrustedContent(msg.snippet, 'uber-lyft')}`,
            ''
          );
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error listing rides: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Uber/Lyft Rides',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// rides_get_ride
// ---------------------------------------------------------------------------

function createGetRideTool(db: Database) {
  return tool(
    'rides_get_ride',
    'Get full details of a specific ride receipt by its Gmail message ID. Parses the email body for route, fare breakdown, and tip.',
    {
      messageId: z.string().describe('The Gmail message ID of the ride receipt email'),
    },
    async (args) => {
      try {
        const msg = await getMessage(db, args.messageId);

        // Attempt to extract amounts from body
        const body = msg.body || msg.snippet || '';
        const amountMatches = [...body.matchAll(AMOUNT_REGEX)];
        const amounts = amountMatches.map((m) => ({
          raw: m[0],
          value: parseFloat(m[1].replace(/,/g, '')),
        }));

        // Infer the total as the largest amount
        const total = amounts.length > 0 ? Math.max(...amounts.map((a) => a.value)) : null;

        const MAX_BODY = 50_000;
        let bodyText = body;
        if (bodyText.length > MAX_BODY) {
          bodyText = bodyText.slice(0, MAX_BODY) + '\n\n[Body truncated]';
        }

        const source = detectSource(msg.from, msg.subject);

        const lines = [
          `Message ID: ${msg.id}`,
          `Service: ${source === 'uber' ? 'Uber' : 'Lyft'}`,
          `Date: ${fenceUntrustedContent(msg.date, 'uber-lyft')}`,
          `Subject: ${fenceUntrustedContent(msg.subject, 'uber-lyft')}`,
          `From: ${fenceUntrustedContent(msg.from, 'uber-lyft')}`,
          total !== null ? `Detected Total: $${total.toFixed(2)}` : 'Detected Total: (not found)',
          '',
          '--- Receipt Body ---',
          fenceUntrustedContent(bodyText || '(no body)', 'uber-lyft'),
        ];

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error retrieving ride: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Ride Details',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// rides_spending_summary
// ---------------------------------------------------------------------------

function createSpendingSummaryTool(db: Database) {
  return tool(
    'rides_spending_summary',
    'Aggregate ride costs over a date range. Parses dollar amounts from receipt emails and returns separate Uber vs Lyft totals.',
    {
      startDate: z
        .string()
        .describe('Start of date range (YYYY-MM-DD)'),
      endDate: z
        .string()
        .describe('End of date range (YYYY-MM-DD)'),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Maximum emails to scan per service (default 50)'),
    },
    async (args) => {
      try {
        const maxResults = args.maxResults ?? 50;

        let uberTotal = 0;
        let uberCount = 0;
        let lyftTotal = 0;
        let lyftCount = 0;

        const queries: Array<{ query: string; source: RideSource }> = [
          { query: UBER_SENDER, source: 'uber' },
          { query: LYFT_SENDER, source: 'lyft' },
        ];

        for (const { query, source } of queries) {
          const { messages } = await listMessages(db, query, undefined, maxResults);

          for (const msg of messages) {
            const rideDate = parseDateString(msg.date);
            if (!isInDateRange(rideDate, args.startDate, args.endDate)) continue;

            // Use snippet for fast amount extraction; fall back to 0 if not found
            const amount = parseFirstAmount(msg.snippet) || parseFirstAmount(msg.subject);
            if (source === 'uber') {
              uberTotal += amount;
              uberCount++;
            } else {
              lyftTotal += amount;
              lyftCount++;
            }
          }
        }

        const grandTotal = uberTotal + lyftTotal;
        const totalRides = uberCount + lyftCount;

        const lines = [
          `Ride Spending Summary (${fenceUntrustedContent(args.startDate, 'uber-lyft')} to ${fenceUntrustedContent(args.endDate, 'uber-lyft')}):`,
          '',
          `Uber:  ${uberCount} ride${uberCount !== 1 ? 's' : ''}  —  $${uberTotal.toFixed(2)}`,
          `Lyft:  ${lyftCount} ride${lyftCount !== 1 ? 's' : ''}  —  $${lyftTotal.toFixed(2)}`,
          '',
          `Total: ${totalRides} ride${totalRides !== 1 ? 's' : ''}  —  $${grandTotal.toFixed(2)}`,
          '',
          'Note: Amounts are parsed from email snippets/subjects. Open individual receipts for exact breakdowns.',
        ];

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error computing spending summary: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Ride Spending Summary',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// rides_export_for_tax
// ---------------------------------------------------------------------------

function createExportForTaxTool(db: Database) {
  return tool(
    'rides_export_for_tax',
    'List all rides in a date range with amounts formatted for tax reporting. Returns a CSV-style table of date, service, amount, and subject.',
    {
      startDate: z
        .string()
        .describe('Start of date range for tax export (YYYY-MM-DD)'),
      endDate: z
        .string()
        .describe('End of date range for tax export (YYYY-MM-DD)'),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe('Maximum emails to scan per service (default 100)'),
    },
    async (args) => {
      try {
        const maxResults = args.maxResults ?? 100;

        const rows: Array<{
          date: string;
          source: RideSource;
          amount: number;
          subject: string;
          messageId: string;
        }> = [];

        const queries: Array<{ query: string; source: RideSource }> = [
          { query: UBER_SENDER, source: 'uber' },
          { query: LYFT_SENDER, source: 'lyft' },
        ];

        for (const { query, source } of queries) {
          const { messages } = await listMessages(db, query, undefined, maxResults);

          for (const msg of messages) {
            const rideDate = parseDateString(msg.date);
            if (!isInDateRange(rideDate, args.startDate, args.endDate)) continue;

            const amount = parseFirstAmount(msg.snippet) || parseFirstAmount(msg.subject);
            rows.push({
              date: rideDate,
              source,
              amount,
              subject: msg.subject,
              messageId: msg.id,
            });
          }
        }

        // Sort by date ascending for tax reporting
        rows.sort((a, b) => a.date.localeCompare(b.date));

        if (rows.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No ride receipts found between ${args.startDate} and ${args.endDate}.`,
              },
            ],
          };
        }

        const lines: string[] = [
          `Tax Export: Ride Receipts (${fenceUntrustedContent(args.startDate, 'uber-lyft')} to ${fenceUntrustedContent(args.endDate, 'uber-lyft')})`,
          '',
          'Date,Service,Amount,Subject,MessageID',
        ];

        let runningTotal = 0;
        for (const row of rows) {
          runningTotal += row.amount;
          // CSV-escape the subject
          const safeSubject = row.subject.replace(/"/g, '""');
          lines.push(
            `${fenceUntrustedContent(row.date, 'uber-lyft')},${row.source === 'uber' ? 'Uber' : 'Lyft'},$${row.amount.toFixed(2)},"${fenceUntrustedContent(safeSubject, 'uber-lyft')}",${row.messageId}`
          );
        }

        lines.push('');
        lines.push(`Total rides: ${rows.length}`);
        lines.push(`Total amount: $${runningTotal.toFixed(2)}`);

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error exporting rides for tax: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Export Rides for Tax',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createUberLyftTools(db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'rides_list_rides',
      description: 'Search Gmail for Uber/Lyft receipt emails and list recent rides',
      sdkTool: createListRidesTool(db),
    },
    {
      name: 'rides_get_ride',
      description: 'Get full details of a specific ride receipt by Gmail message ID',
      sdkTool: createGetRideTool(db),
    },
    {
      name: 'rides_spending_summary',
      description: 'Aggregate Uber and Lyft ride costs over a date range',
      sdkTool: createSpendingSummaryTool(db),
    },
    {
      name: 'rides_export_for_tax',
      description: 'Export all rides in a date range formatted for tax reporting',
      sdkTool: createExportForTaxTool(db),
    },
  ];
}
