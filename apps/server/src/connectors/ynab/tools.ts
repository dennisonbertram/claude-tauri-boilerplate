import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { fenceUntrustedContent, sanitizeError } from '../utils';

// ---------------------------------------------------------------------------
// YNAB API helpers
// ---------------------------------------------------------------------------

const YNAB_BASE_URL = 'https://api.ynab.com/v1';

function getToken(): string {
  const token = process.env.YNAB_ACCESS_TOKEN;
  if (!token) {
    throw new Error('YNAB_ACCESS_TOKEN environment variable is not set');
  }
  return token;
}

async function ynabFetch(path: string): Promise<unknown> {
  const token = getToken();
  const url = `${YNAB_BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`YNAB API error ${response.status}: ${body.substring(0, 200)}`);
  }

  return response.json();
}

/**
 * Format YNAB milliunits to a dollar string.
 * YNAB stores amounts as milliunits (1000 = $1.00).
 */
function formatMilliunits(milliunits: number): string {
  return (milliunits / 1000).toFixed(2);
}

// ---------------------------------------------------------------------------
// ynab_list_budgets
// ---------------------------------------------------------------------------

function createListBudgetsTool(_db: Database) {
  return tool(
    'ynab_list_budgets',
    'List all YNAB budgets accessible with the current access token.',
    {},
    async (_args) => {
      try {
        const data = (await ynabFetch('/budgets')) as {
          data: { budgets: Array<{ id: string; name: string; last_modified_on: string; currency_format?: { iso_code: string } }> };
        };

        const budgets = data.data.budgets;

        if (budgets.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No budgets found.' }] };
        }

        const lines: string[] = [`Found ${budgets.length} budget${budgets.length !== 1 ? 's' : ''}:`, ''];

        for (const budget of budgets) {
          lines.push(
            `ID: ${budget.id}`,
            `Name: ${fenceUntrustedContent(budget.name, 'ynab')}`,
            `Last Modified: ${budget.last_modified_on}`,
            `Currency: ${budget.currency_format?.iso_code ?? 'N/A'}`,
            ''
          );
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing budgets: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List YNAB Budgets',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// ynab_get_budget
// ---------------------------------------------------------------------------

function createGetBudgetTool(_db: Database) {
  return tool(
    'ynab_get_budget',
    'Get details for a specific YNAB budget by ID, including accounts summary.',
    {
      budget_id: z.string().describe('The YNAB budget ID (use "last-used" for the last used budget)'),
    },
    async (args) => {
      try {
        const data = (await ynabFetch(`/budgets/${args.budget_id}`)) as {
          data: {
            budget: {
              id: string;
              name: string;
              last_modified_on: string;
              currency_format?: { iso_code: string };
              accounts?: Array<{ id: string; name: string; balance: number; type: string; on_budget: boolean; closed: boolean }>;
            };
          };
        };

        const budget = data.data.budget;
        const accounts = budget.accounts ?? [];
        const activeAccounts = accounts.filter((a) => !a.closed);

        const lines: string[] = [
          `Budget ID: ${budget.id}`,
          `Name: ${fenceUntrustedContent(budget.name, 'ynab')}`,
          `Last Modified: ${budget.last_modified_on}`,
          `Currency: ${budget.currency_format?.iso_code ?? 'N/A'}`,
          `Accounts: ${activeAccounts.length} active`,
          '',
        ];

        if (activeAccounts.length > 0) {
          lines.push('Accounts:', '');
          for (const account of activeAccounts) {
            lines.push(
              `  ID: ${account.id}`,
              `  Name: ${fenceUntrustedContent(account.name, 'ynab')}`,
              `  Type: ${account.type}`,
              `  Balance: $${formatMilliunits(account.balance)}`,
              `  On Budget: ${account.on_budget}`,
              ''
            );
          }
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting budget: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get YNAB Budget',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// ynab_list_accounts
// ---------------------------------------------------------------------------

function createListAccountsTool(_db: Database) {
  return tool(
    'ynab_list_accounts',
    'List all accounts in a YNAB budget with balances.',
    {
      budget_id: z.string().describe('The YNAB budget ID (use "last-used" for the last used budget)'),
    },
    async (args) => {
      try {
        const data = (await ynabFetch(`/budgets/${args.budget_id}/accounts`)) as {
          data: {
            accounts: Array<{
              id: string;
              name: string;
              type: string;
              on_budget: boolean;
              closed: boolean;
              balance: number;
              cleared_balance: number;
              uncleared_balance: number;
            }>;
          };
        };

        const accounts = data.data.accounts;
        const activeAccounts = accounts.filter((a) => !a.closed);

        if (activeAccounts.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No active accounts found.' }] };
        }

        const lines: string[] = [`Found ${activeAccounts.length} active account${activeAccounts.length !== 1 ? 's' : ''}:`, ''];

        for (const account of activeAccounts) {
          lines.push(
            `ID: ${account.id}`,
            `Name: ${fenceUntrustedContent(account.name, 'ynab')}`,
            `Type: ${account.type}`,
            `On Budget: ${account.on_budget}`,
            `Balance: $${formatMilliunits(account.balance)}`,
            `Cleared Balance: $${formatMilliunits(account.cleared_balance)}`,
            `Uncleared Balance: $${formatMilliunits(account.uncleared_balance)}`,
            ''
          );
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing accounts: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List YNAB Accounts',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// ynab_list_categories
// ---------------------------------------------------------------------------

function createListCategoriesTool(_db: Database) {
  return tool(
    'ynab_list_categories',
    'List all budget categories in a YNAB budget, grouped by category group, with budgeted and activity amounts.',
    {
      budget_id: z.string().describe('The YNAB budget ID (use "last-used" for the last used budget)'),
    },
    async (args) => {
      try {
        const data = (await ynabFetch(`/budgets/${args.budget_id}/categories`)) as {
          data: {
            category_groups: Array<{
              id: string;
              name: string;
              hidden: boolean;
              categories: Array<{
                id: string;
                name: string;
                hidden: boolean;
                budgeted: number;
                activity: number;
                balance: number;
              }>;
            }>;
          };
        };

        const groups = data.data.category_groups.filter((g) => !g.hidden);

        if (groups.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No categories found.' }] };
        }

        const lines: string[] = [`Found ${groups.length} category group${groups.length !== 1 ? 's' : ''}:`, ''];

        for (const group of groups) {
          lines.push(`Group: ${fenceUntrustedContent(group.name, 'ynab')}`, '');

          const visibleCategories = group.categories.filter((c) => !c.hidden);
          for (const cat of visibleCategories) {
            lines.push(
              `  ID: ${cat.id}`,
              `  Name: ${fenceUntrustedContent(cat.name, 'ynab')}`,
              `  Budgeted: $${formatMilliunits(cat.budgeted)}`,
              `  Activity: $${formatMilliunits(cat.activity)}`,
              `  Balance: $${formatMilliunits(cat.balance)}`,
              ''
            );
          }
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing categories: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List YNAB Categories',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// ynab_get_transactions
// ---------------------------------------------------------------------------

function createGetTransactionsTool(_db: Database) {
  return tool(
    'ynab_get_transactions',
    'Get transactions from a YNAB budget, optionally filtered by date.',
    {
      budget_id: z.string().describe('The YNAB budget ID (use "last-used" for the last used budget)'),
      since_date: z
        .string()
        .optional()
        .describe('ISO date string (YYYY-MM-DD) to filter transactions on or after this date'),
      account_id: z
        .string()
        .optional()
        .describe('Filter transactions to a specific account ID'),
    },
    async (args) => {
      try {
        let path = `/budgets/${args.budget_id}/transactions`;
        const params = new URLSearchParams();
        if (args.since_date) {
          params.set('since_date', args.since_date);
        }
        const queryString = params.toString();
        if (queryString) {
          path += `?${queryString}`;
        }

        const data = (await ynabFetch(path)) as {
          data: {
            transactions: Array<{
              id: string;
              date: string;
              amount: number;
              memo: string | null;
              cleared: string;
              approved: boolean;
              account_id: string;
              account_name: string;
              payee_name: string | null;
              category_name: string | null;
            }>;
          };
        };

        let transactions = data.data.transactions;

        if (args.account_id) {
          transactions = transactions.filter((t) => t.account_id === args.account_id);
        }

        if (transactions.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No transactions found.' }] };
        }

        const lines: string[] = [`Found ${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}:`, ''];

        for (const tx of transactions) {
          lines.push(
            `ID: ${tx.id}`,
            `Date: ${tx.date}`,
            `Amount: $${formatMilliunits(tx.amount)}`,
            `Payee: ${tx.payee_name ? fenceUntrustedContent(tx.payee_name, 'ynab') : 'N/A'}`,
            `Memo: ${tx.memo ? fenceUntrustedContent(tx.memo, 'ynab') : 'N/A'}`,
            `Category: ${tx.category_name ?? 'Uncategorized'}`,
            `Account: ${tx.account_name}`,
            `Cleared: ${tx.cleared}`,
            `Approved: ${tx.approved}`,
            ''
          );
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting transactions: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get YNAB Transactions',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// ynab_get_month_budget
// ---------------------------------------------------------------------------

function createGetMonthBudgetTool(_db: Database) {
  return tool(
    'ynab_get_month_budget',
    'Get the budget summary for a specific month in a YNAB budget, including category spending.',
    {
      budget_id: z.string().describe('The YNAB budget ID (use "last-used" for the last used budget)'),
      month: z.string().describe('Month in ISO format (YYYY-MM-DD, e.g. "2024-01-01"). Use "current" for the current month.'),
    },
    async (args) => {
      try {
        const data = (await ynabFetch(`/budgets/${args.budget_id}/months/${args.month}`)) as {
          data: {
            month: {
              month: string;
              note: string | null;
              income: number;
              budgeted: number;
              activity: number;
              to_be_budgeted: number;
              categories: Array<{
                id: string;
                name: string;
                hidden: boolean;
                budgeted: number;
                activity: number;
                balance: number;
              }>;
            };
          };
        };

        const monthData = data.data.month;
        const visibleCategories = monthData.categories.filter((c) => !c.hidden);

        const lines: string[] = [
          `Month: ${monthData.month}`,
          `Income: $${formatMilliunits(monthData.income)}`,
          `Budgeted: $${formatMilliunits(monthData.budgeted)}`,
          `Activity: $${formatMilliunits(monthData.activity)}`,
          `To Be Budgeted: $${formatMilliunits(monthData.to_be_budgeted)}`,
          '',
          `Categories (${visibleCategories.length}):`,
          '',
        ];

        for (const cat of visibleCategories) {
          lines.push(
            `  ID: ${cat.id}`,
            `  Name: ${fenceUntrustedContent(cat.name, 'ynab')}`,
            `  Budgeted: $${formatMilliunits(cat.budgeted)}`,
            `  Activity: $${formatMilliunits(cat.activity)}`,
            `  Balance: $${formatMilliunits(cat.balance)}`,
            ''
          );
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting month budget: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get YNAB Month Budget',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createYnabTools(db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'ynab_list_budgets',
      description: 'List all YNAB budgets',
      sdkTool: createListBudgetsTool(db),
    },
    {
      name: 'ynab_get_budget',
      description: 'Get details for a specific YNAB budget',
      sdkTool: createGetBudgetTool(db),
    },
    {
      name: 'ynab_list_accounts',
      description: 'List all accounts in a YNAB budget',
      sdkTool: createListAccountsTool(db),
    },
    {
      name: 'ynab_list_categories',
      description: 'List all categories in a YNAB budget',
      sdkTool: createListCategoriesTool(db),
    },
    {
      name: 'ynab_get_transactions',
      description: 'Get transactions from a YNAB budget',
      sdkTool: createGetTransactionsTool(db),
    },
    {
      name: 'ynab_get_month_budget',
      description: 'Get the budget summary for a specific month',
      sdkTool: createGetMonthBudgetTool(db),
    },
  ];
}
