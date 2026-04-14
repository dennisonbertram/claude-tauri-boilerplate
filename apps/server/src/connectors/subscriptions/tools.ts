import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { fenceUntrustedContent, sanitizeError } from '../utils';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  billing_cycle TEXT DEFAULT 'monthly',
  next_billing_date TEXT,
  category TEXT,
  notes TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
`;

function ensureTable(db: Database): void {
  db.run(CREATE_TABLE_SQL);
}

// ---------------------------------------------------------------------------
// Helper: normalize amount to monthly equivalent
// ---------------------------------------------------------------------------

function toMonthlyAmount(amount: number, cycle: string): number {
  switch (cycle) {
    case 'yearly':
      return amount / 12;
    case 'weekly':
      return amount * 52 / 12;
    case 'monthly':
    default:
      return amount;
  }
}

// ---------------------------------------------------------------------------
// subscriptions_list
// ---------------------------------------------------------------------------

function createListTool(db: Database) {
  return tool(
    'subscriptions_list',
    'List all active subscriptions with their billing details. Shows a total monthly cost estimate.',
    {},
    async (_args) => {
      try {
        ensureTable(db);

        const rows = db
          .query(
            `SELECT id, name, amount, currency, billing_cycle, next_billing_date, category, notes, created_at
             FROM subscriptions
             WHERE active = 1
             ORDER BY name ASC`
          )
          .all() as Array<{
          id: number;
          name: string;
          amount: number;
          currency: string;
          billing_cycle: string;
          next_billing_date: string | null;
          category: string | null;
          notes: string | null;
          created_at: string;
        }>;

        if (rows.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No active subscriptions found.' }],
          };
        }

        let totalMonthly = 0;
        const lines: string[] = [`Active subscriptions (${rows.length}):`, ''];

        for (const row of rows) {
          const monthly = toMonthlyAmount(row.amount, row.billing_cycle);
          totalMonthly += monthly;

          lines.push(
            `ID: ${row.id}`,
            `Name: ${fenceUntrustedContent(row.name, 'subscriptions')}`,
            `Amount: ${row.amount} ${row.currency} / ${row.billing_cycle}`,
            `Next billing: ${row.next_billing_date ?? 'not set'}`,
            `Category: ${row.category ? fenceUntrustedContent(row.category, 'subscriptions') : 'none'}`,
            row.notes ? `Notes: ${fenceUntrustedContent(row.notes, 'subscriptions')}` : '',
            ''
          );
        }

        lines.push(`--- Total estimated monthly cost: ${totalMonthly.toFixed(2)} (primary currency) ---`);

        return {
          content: [{ type: 'text' as const, text: lines.filter((l) => l !== '').join('\n') }],
        };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error listing subscriptions: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Subscriptions',
        readOnlyHint: true,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// subscriptions_add
// ---------------------------------------------------------------------------

function createAddTool(db: Database) {
  return tool(
    'subscriptions_add',
    'Add a new subscription to track.',
    {
      name: z.string().min(1).max(200).describe('Subscription service name (e.g. "Netflix", "Spotify")'),
      amount: z.number().positive().describe('Billing amount in the specified currency'),
      currency: z
        .string()
        .length(3)
        .optional()
        .describe('ISO 4217 currency code (default: USD)'),
      billing_cycle: z
        .enum(['monthly', 'yearly', 'weekly'])
        .optional()
        .describe('How often you are billed (default: monthly)'),
      next_billing_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('Next billing date in YYYY-MM-DD format'),
      category: z
        .string()
        .max(100)
        .optional()
        .describe('Category (e.g. "Entertainment", "Productivity", "Health")'),
      notes: z.string().max(1000).optional().describe('Optional notes about this subscription'),
    },
    async (args) => {
      try {
        ensureTable(db);

        const result = db
          .query(
            `INSERT INTO subscriptions (name, amount, currency, billing_cycle, next_billing_date, category, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             RETURNING id`
          )
          .get(
            args.name,
            args.amount,
            args.currency ?? 'USD',
            args.billing_cycle ?? 'monthly',
            args.next_billing_date ?? null,
            args.category ?? null,
            args.notes ?? null
          ) as { id: number } | null;

        if (!result) {
          return {
            content: [{ type: 'text' as const, text: 'Error: Failed to insert subscription.' }],
            isError: true,
          };
        }

        const text = [
          'Subscription added successfully.',
          `ID: ${result.id}`,
          `Name: ${fenceUntrustedContent(args.name, 'subscriptions')}`,
          `Amount: ${args.amount} ${args.currency ?? 'USD'} / ${args.billing_cycle ?? 'monthly'}`,
        ].join('\n');

        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error adding subscription: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Add Subscription',
        readOnlyHint: false,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// subscriptions_update
// ---------------------------------------------------------------------------

function createUpdateTool(db: Database) {
  return tool(
    'subscriptions_update',
    'Update one or more fields of an existing subscription by its ID.',
    {
      id: z.number().int().positive().describe('Subscription ID to update'),
      name: z.string().min(1).max(200).optional().describe('New subscription name'),
      amount: z.number().positive().optional().describe('New billing amount'),
      currency: z.string().length(3).optional().describe('New currency code'),
      billing_cycle: z
        .enum(['monthly', 'yearly', 'weekly'])
        .optional()
        .describe('New billing cycle'),
      next_billing_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('New next billing date (YYYY-MM-DD)'),
      category: z.string().max(100).optional().describe('New category'),
      notes: z.string().max(1000).optional().describe('New notes'),
    },
    async (args) => {
      try {
        ensureTable(db);

        // Build SET clause dynamically from provided fields
        const fields: string[] = [];
        const values: unknown[] = [];

        if (args.name !== undefined) { fields.push('name = ?'); values.push(args.name); }
        if (args.amount !== undefined) { fields.push('amount = ?'); values.push(args.amount); }
        if (args.currency !== undefined) { fields.push('currency = ?'); values.push(args.currency); }
        if (args.billing_cycle !== undefined) { fields.push('billing_cycle = ?'); values.push(args.billing_cycle); }
        if (args.next_billing_date !== undefined) { fields.push('next_billing_date = ?'); values.push(args.next_billing_date); }
        if (args.category !== undefined) { fields.push('category = ?'); values.push(args.category); }
        if (args.notes !== undefined) { fields.push('notes = ?'); values.push(args.notes); }

        if (fields.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'Error: No fields provided to update.' }],
            isError: true,
          };
        }

        values.push(args.id);
        const sql = `UPDATE subscriptions SET ${fields.join(', ')} WHERE id = ? AND active = 1`;
        const stmt = db.prepare(sql);
        const info = stmt.run(...(values as Parameters<typeof stmt.run>));

        if (info.changes === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No active subscription found with ID ${args.id}.`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: `Subscription ${args.id} updated successfully (${fields.length} field${fields.length !== 1 ? 's' : ''} changed).`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error updating subscription: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Update Subscription',
        readOnlyHint: false,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// subscriptions_cancel
// ---------------------------------------------------------------------------

function createCancelTool(db: Database) {
  return tool(
    'subscriptions_cancel',
    'Mark a subscription as cancelled (soft delete — sets active to false). The subscription remains in the database for historical reference.',
    {
      id: z.number().int().positive().describe('Subscription ID to cancel'),
    },
    async (args) => {
      try {
        ensureTable(db);

        const info = db
          .prepare(`UPDATE subscriptions SET active = 0 WHERE id = ? AND active = 1`)
          .run(args.id);

        if (info.changes === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No active subscription found with ID ${args.id}.`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: `Subscription ${args.id} cancelled successfully.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error cancelling subscription: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Cancel Subscription',
        readOnlyHint: false,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// subscriptions_get_summary
// ---------------------------------------------------------------------------

function createGetSummaryTool(db: Database) {
  return tool(
    'subscriptions_get_summary',
    'Get a spending summary of active subscriptions broken down by category, showing monthly and yearly cost estimates.',
    {},
    async (_args) => {
      try {
        ensureTable(db);

        const rows = db
          .query(
            `SELECT category, billing_cycle, SUM(amount) as total_amount, COUNT(*) as count
             FROM subscriptions
             WHERE active = 1
             GROUP BY category, billing_cycle
             ORDER BY category ASC`
          )
          .all() as Array<{
          category: string | null;
          billing_cycle: string;
          total_amount: number;
          count: number;
        }>;

        if (rows.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No active subscriptions to summarize.' }],
          };
        }

        // Aggregate by category
        const byCategory = new Map<string, number>();
        let grandMonthly = 0;

        for (const row of rows) {
          const cat = row.category ?? 'Uncategorized';
          const monthly = toMonthlyAmount(row.total_amount, row.billing_cycle);
          byCategory.set(cat, (byCategory.get(cat) ?? 0) + monthly);
          grandMonthly += monthly;
        }

        const lines: string[] = ['Subscription Spending Summary', ''];

        for (const [cat, monthly] of [...byCategory.entries()].sort()) {
          lines.push(
            `${fenceUntrustedContent(cat, 'subscriptions')}: $${monthly.toFixed(2)}/mo ($${(monthly * 12).toFixed(2)}/yr)`
          );
        }

        lines.push(
          '',
          `Total: $${grandMonthly.toFixed(2)}/mo ($${(grandMonthly * 12).toFixed(2)}/yr)`
        );

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error getting summary: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Subscription Summary',
        readOnlyHint: true,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// subscriptions_upcoming
// ---------------------------------------------------------------------------

function createUpcomingTool(db: Database) {
  return tool(
    'subscriptions_upcoming',
    'List active subscriptions with billing dates within the next N days.',
    {
      days: z
        .number()
        .int()
        .min(1)
        .max(365)
        .optional()
        .describe('Number of days to look ahead (default: 30)'),
    },
    async (args) => {
      try {
        ensureTable(db);

        const lookAhead = args.days ?? 30;

        const rows = db
          .query(
            `SELECT id, name, amount, currency, billing_cycle, next_billing_date, category
             FROM subscriptions
             WHERE active = 1
               AND next_billing_date IS NOT NULL
               AND next_billing_date <= date('now', '+' || ? || ' days')
               AND next_billing_date >= date('now')
             ORDER BY next_billing_date ASC`
          )
          .all(lookAhead) as Array<{
          id: number;
          name: string;
          amount: number;
          currency: string;
          billing_cycle: string;
          next_billing_date: string;
          category: string | null;
        }>;

        if (rows.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No subscriptions billing in the next ${lookAhead} days.`,
              },
            ],
          };
        }

        const lines: string[] = [
          `Subscriptions billing in the next ${lookAhead} days (${rows.length}):`,
          '',
        ];

        for (const row of rows) {
          lines.push(
            `ID: ${row.id}`,
            `Name: ${fenceUntrustedContent(row.name, 'subscriptions')}`,
            `Date: ${row.next_billing_date}`,
            `Amount: ${row.amount} ${row.currency} / ${row.billing_cycle}`,
            `Category: ${row.category ? fenceUntrustedContent(row.category, 'subscriptions') : 'none'}`,
            ''
          );
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error fetching upcoming subscriptions: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Upcoming Subscriptions',
        readOnlyHint: true,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createSubscriptionsTools(db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'subscriptions_list',
      description: 'List all active subscriptions with monthly cost total',
      sdkTool: createListTool(db),
    },
    {
      name: 'subscriptions_add',
      description: 'Add a new subscription to track',
      sdkTool: createAddTool(db),
    },
    {
      name: 'subscriptions_update',
      description: 'Update subscription fields by ID',
      sdkTool: createUpdateTool(db),
    },
    {
      name: 'subscriptions_cancel',
      description: 'Cancel (soft-delete) a subscription by ID',
      sdkTool: createCancelTool(db),
    },
    {
      name: 'subscriptions_get_summary',
      description: 'Monthly/yearly spending breakdown by category',
      sdkTool: createGetSummaryTool(db),
    },
    {
      name: 'subscriptions_upcoming',
      description: 'List subscriptions billing in the next N days',
      sdkTool: createUpcomingTool(db),
    },
  ];
}
