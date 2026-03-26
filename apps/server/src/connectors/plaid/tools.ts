import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import {
  getAccountsByUser,
  getPlaidItemsByUser,
  getTransactionsByUser,
} from '../../db/db-plaid';

// ---------------------------------------------------------------------------
// Single-user desktop assumption
// ---------------------------------------------------------------------------
// This app is a single-user desktop application. All Plaid DB functions
// require a userId. We use 'default' as the hardcoded userId here because
// there is no multi-user authentication layer in this context.
const DEFAULT_USER_ID = 'default';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number | null, currencyCode = 'USD'): string {
  if (amount === null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(amount);
}

function formatAccountType(type: string, subtype: string | null): string {
  if (subtype) {
    return `${type} (${subtype})`;
  }
  return type;
}

// ---------------------------------------------------------------------------
// plaid_list_accounts
// ---------------------------------------------------------------------------

function createListAccountsTool(db: Database) {
  return tool(
    'plaid_list_accounts',
    'List all connected bank accounts with their current balances and account details.',
    {
      type: z
        .string()
        .optional()
        .describe(
          'Filter by account type (e.g. "depository", "credit", "investment", "loan"). Omit to return all accounts.'
        ),
    },
    async (args) => {
      try {
        const accounts = getAccountsByUser(db, DEFAULT_USER_ID, {
          type: args.type,
        });

        if (accounts.length === 0) {
          const text = args.type
            ? `No ${args.type} accounts found.`
            : 'No connected bank accounts found. Connect an account via the Finance settings.';
          return { content: [{ type: 'text' as const, text }] };
        }

        const lines: string[] = [
          `Connected Accounts (${accounts.length} account${accounts.length !== 1 ? 's' : ''}):`,
          '',
        ];

        for (const acct of accounts) {
          const displayName = acct.officialName ?? acct.name;
          const maskStr = acct.mask ? ` ••••${acct.mask}` : '';
          const typeStr = formatAccountType(acct.type, acct.subtype);
          lines.push(`Account: ${displayName}${maskStr}`);
          lines.push(`  Type: ${typeStr}`);
          lines.push(
            `  Current Balance: ${formatCurrency(acct.currentBalance, acct.currencyCode)}`
          );
          if (acct.availableBalance !== null) {
            lines.push(
              `  Available Balance: ${formatCurrency(acct.availableBalance, acct.currencyCode)}`
            );
          }
          lines.push(`  Account ID: ${acct.id}`);
          lines.push('');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error listing accounts: ${message}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Bank Accounts',
        readOnlyHint: true,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// plaid_get_balance
// ---------------------------------------------------------------------------

function createGetBalanceTool(db: Database) {
  return tool(
    'plaid_get_balance',
    'Get the current balance for a specific account or all accounts.',
    {
      accountId: z
        .string()
        .optional()
        .describe('Account ID to get the balance for. Omit to get balances for all accounts.'),
    },
    async (args) => {
      try {
        const accounts = getAccountsByUser(db, DEFAULT_USER_ID);

        if (accounts.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No connected bank accounts found.',
              },
            ],
          };
        }

        const filtered = args.accountId
          ? accounts.filter((a) => a.id === args.accountId)
          : accounts;

        if (filtered.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Account not found: ${args.accountId}`,
              },
            ],
          };
        }

        const lines: string[] = ['Account Balances:', ''];

        let totalBalance = 0;
        let hasTotal = false;

        for (const acct of filtered) {
          const displayName = acct.officialName ?? acct.name;
          const maskStr = acct.mask ? ` ••••${acct.mask}` : '';
          lines.push(`${displayName}${maskStr}`);
          lines.push(
            `  Current Balance: ${formatCurrency(acct.currentBalance, acct.currencyCode)}`
          );
          if (acct.availableBalance !== null) {
            lines.push(
              `  Available Balance: ${formatCurrency(acct.availableBalance, acct.currencyCode)}`
            );
          }
          lines.push(`  Type: ${formatAccountType(acct.type, acct.subtype)}`);
          lines.push('');

          if (acct.currentBalance !== null) {
            totalBalance += acct.currentBalance;
            hasTotal = true;
          }
        }

        if (!args.accountId && filtered.length > 1 && hasTotal) {
          lines.push(`Total across all accounts: ${formatCurrency(totalBalance)}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error getting balance: ${message}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Account Balance',
        readOnlyHint: true,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// plaid_search_transactions
// ---------------------------------------------------------------------------

function createSearchTransactionsTool(db: Database) {
  return tool(
    'plaid_search_transactions',
    'Search and filter transactions across all connected financial accounts.',
    {
      search: z
        .string()
        .optional()
        .describe('Search text to match against transaction name or merchant name'),
      startDate: z
        .string()
        .optional()
        .describe('Start date in YYYY-MM-DD format (inclusive)'),
      endDate: z
        .string()
        .optional()
        .describe('End date in YYYY-MM-DD format (inclusive)'),
      category: z
        .string()
        .optional()
        .describe('Filter by category (partial match, e.g. "FOOD_AND_DRINK", "TRANSPORTATION")'),
      minAmount: z
        .number()
        .optional()
        .describe('Minimum transaction amount (in dollars)'),
      maxAmount: z
        .number()
        .optional()
        .describe('Maximum transaction amount (in dollars)'),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe('Number of transactions to return (1-100, default 25)'),
      sort: z
        .enum(['date_asc', 'date_desc', 'amount_asc', 'amount_desc'])
        .optional()
        .describe('Sort order (default: date_desc — most recent first)'),
    },
    async (args) => {
      try {
        const transactions = getTransactionsByUser(db, DEFAULT_USER_ID, {
          search: args.search,
          startDate: args.startDate,
          endDate: args.endDate,
          category: args.category,
          minAmount: args.minAmount,
          maxAmount: args.maxAmount,
          limit: args.limit ?? 25,
          sort: args.sort ?? 'date_desc',
        });

        if (transactions.length === 0) {
          const text = 'No transactions found matching your criteria.';
          return { content: [{ type: 'text' as const, text }] };
        }

        const lines: string[] = [
          `Found ${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}:`,
          '',
        ];

        for (const txn of transactions) {
          const displayName = txn.merchantName ?? txn.name;
          const pendingStr = txn.pending ? ' (pending)' : '';
          const categoryStr = txn.personalFinanceCategory ?? txn.category ?? 'Uncategorized';
          lines.push(`${txn.date}  ${displayName}${pendingStr}`);
          lines.push(`  Amount: ${formatCurrency(txn.amount)}`);
          lines.push(`  Category: ${categoryStr}`);
          if (txn.paymentChannel) {
            lines.push(`  Channel: ${txn.paymentChannel}`);
          }
          lines.push(`  Transaction ID: ${txn.id}`);
          lines.push('');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            { type: 'text' as const, text: `Error searching transactions: ${message}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Search Transactions',
        readOnlyHint: true,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// plaid_get_spending_summary
// ---------------------------------------------------------------------------

function createGetSpendingSummaryTool(db: Database) {
  return tool(
    'plaid_get_spending_summary',
    'Get a spending summary grouped by category for a date range. Aggregates transaction amounts by personalFinanceCategory.',
    {
      startDate: z
        .string()
        .optional()
        .describe('Start date in YYYY-MM-DD format. Omit for all-time.'),
      endDate: z
        .string()
        .optional()
        .describe('End date in YYYY-MM-DD format. Omit for all-time.'),
    },
    async (args) => {
      try {
        const transactions = getTransactionsByUser(db, DEFAULT_USER_ID, {
          startDate: args.startDate,
          endDate: args.endDate,
          limit: 10000, // Cap at 10K transactions for summary
        });

        if (transactions.length === 0) {
          const text =
            args.startDate || args.endDate
              ? `No transactions found for the specified date range.`
              : 'No transactions found.';
          return { content: [{ type: 'text' as const, text }] };
        }

        // Aggregate by personalFinanceCategory
        const categoryTotals = new Map<string, number>();
        let totalSpending = 0;

        for (const txn of transactions) {
          // Skip negative amounts (income/credits) for spending summary
          if (txn.amount <= 0) continue;

          const category = txn.personalFinanceCategory ?? txn.category ?? 'UNCATEGORIZED';
          const current = categoryTotals.get(category) ?? 0;
          categoryTotals.set(category, current + txn.amount);
          totalSpending += txn.amount;
        }

        if (categoryTotals.size === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No spending transactions found for the specified period.',
              },
            ],
          };
        }

        // Sort by amount descending
        const sorted = Array.from(categoryTotals.entries()).sort((a, b) => b[1] - a[1]);

        const dateRangeStr =
          args.startDate || args.endDate
            ? ` (${args.startDate ?? 'beginning'} to ${args.endDate ?? 'now'})`
            : '';

        const lines: string[] = [
          `Spending Summary by Category${dateRangeStr}:`,
          '',
        ];

        for (const [category, amount] of sorted) {
          const pct = totalSpending > 0 ? ((amount / totalSpending) * 100).toFixed(1) : '0.0';
          const formattedCategory = category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
          lines.push(`${formattedCategory}: ${formatCurrency(amount)} (${pct}%)`);
        }

        lines.push('');
        lines.push(`Total Spending: ${formatCurrency(totalSpending)}`);
        lines.push(`Transactions analyzed: ${transactions.length}`);

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            { type: 'text' as const, text: `Error generating spending summary: ${message}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Spending Summary',
        readOnlyHint: true,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// plaid_list_institutions
// ---------------------------------------------------------------------------

function createListInstitutionsTool(db: Database) {
  return tool(
    'plaid_list_institutions',
    'List all connected financial institutions (banks and other institutions linked via Plaid).',
    {},
    async (_args) => {
      try {
        const items = getPlaidItemsByUser(db, DEFAULT_USER_ID);

        if (items.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No financial institutions connected. Connect an account via the Finance settings.',
              },
            ],
          };
        }

        const lines: string[] = [
          `Connected Financial Institutions (${items.length}):`,
          '',
        ];

        for (const item of items) {
          const name = item.institutionName ?? 'Unknown Institution';
          lines.push(`Institution: ${name}`);
          if (item.institutionId) {
            lines.push(`  Institution ID: ${item.institutionId}`);
          }
          if (item.lastSuccessfulSyncAt) {
            lines.push(`  Last Synced: ${item.lastSuccessfulSyncAt}`);
          }
          if (item.errorCode) {
            lines.push(`  Status: Error — ${item.errorCode}: ${item.errorMessage ?? 'unknown'}`);
          } else {
            lines.push(`  Status: Connected`);
          }
          lines.push(`  Item ID: ${item.id}`);
          lines.push('');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            { type: 'text' as const, text: `Error listing institutions: ${message}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Financial Institutions',
        readOnlyHint: true,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createPlaidTools(db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'plaid_list_accounts',
      description: 'List all connected bank accounts with balances',
      sdkTool: createListAccountsTool(db),
    },
    {
      name: 'plaid_get_balance',
      description: 'Get balance for a specific account or all accounts',
      sdkTool: createGetBalanceTool(db),
    },
    {
      name: 'plaid_search_transactions',
      description: 'Search transactions with filters (date, category, amount, keyword)',
      sdkTool: createSearchTransactionsTool(db),
    },
    {
      name: 'plaid_get_spending_summary',
      description: 'Get spending summary by category for a date range',
      sdkTool: createGetSpendingSummaryTool(db),
    },
    {
      name: 'plaid_list_institutions',
      description: 'List connected financial institutions',
      sdkTool: createListInstitutionsTool(db),
    },
  ];
}
