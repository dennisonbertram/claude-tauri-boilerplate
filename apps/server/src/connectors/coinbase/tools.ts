import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { createHmac } from 'crypto';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { fenceUntrustedContent, sanitizeError } from '../utils';

// ---------------------------------------------------------------------------
// Coinbase API helpers
// ---------------------------------------------------------------------------

const COINBASE_BASE_URL = 'https://api.coinbase.com/v2';

function getCoinbaseCredentials(): { apiKey: string; apiSecret: string } {
  const apiKey = process.env.COINBASE_API_KEY;
  const apiSecret = process.env.COINBASE_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('COINBASE_API_KEY and COINBASE_API_SECRET environment variables are required');
  }

  return { apiKey, apiSecret };
}

function buildCoinbaseHeaders(
  method: string,
  path: string,
  body: string,
  apiKey: string,
  apiSecret: string
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = timestamp + method.toUpperCase() + path + body;
  const signature = createHmac('sha256', apiSecret).update(message).digest('hex');

  return {
    'CB-ACCESS-KEY': apiKey,
    'CB-ACCESS-SIGN': signature,
    'CB-ACCESS-TIMESTAMP': timestamp,
    'CB-VERSION': '2024-01-01',
    'Content-Type': 'application/json',
  };
}

async function coinbaseFetch(method: string, path: string, body = ''): Promise<unknown> {
  const { apiKey, apiSecret } = getCoinbaseCredentials();
  const headers = buildCoinbaseHeaders(method, path, body, apiKey, apiSecret);

  const url = `${COINBASE_BASE_URL}${path}`;
  const response = await fetch(url, {
    method,
    headers,
    body: body || undefined,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Coinbase API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// coinbase_list_accounts
// ---------------------------------------------------------------------------

function createListAccountsTool(_db: Database) {
  return tool(
    'coinbase_list_accounts',
    'List all Coinbase wallets and accounts with their balances. Shows crypto and fiat accounts.',
    {},
    async (_args) => {
      try {
        const data = (await coinbaseFetch('GET', '/accounts')) as {
          data: Array<{
            id: string;
            name: string;
            type: string;
            currency: { code: string; name: string };
            balance: { amount: string; currency: string };
            native_balance: { amount: string; currency: string };
          }>;
          pagination?: { next_uri: string | null };
        };

        const accounts = data.data;

        if (!accounts || accounts.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No Coinbase accounts found.' }],
          };
        }

        const lines: string[] = [
          `Found ${accounts.length} account${accounts.length !== 1 ? 's' : ''}:`,
          '',
        ];

        for (const acct of accounts) {
          lines.push(
            `ID: ${acct.id}`,
            `Name: ${fenceUntrustedContent(acct.name, 'Coinbase')}`,
            `Type: ${acct.type}`,
            `Currency: ${acct.currency?.code ?? 'N/A'} (${acct.currency?.name ?? 'N/A'})`,
            `Balance: ${acct.balance?.amount ?? 'N/A'} ${acct.balance?.currency ?? ''}`,
            `Native Balance: ${acct.native_balance?.amount ?? 'N/A'} ${acct.native_balance?.currency ?? ''}`,
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
        title: 'List Coinbase Accounts',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// coinbase_get_account
// ---------------------------------------------------------------------------

function createGetAccountTool(_db: Database) {
  return tool(
    'coinbase_get_account',
    'Get details of a specific Coinbase account by its ID, including balance and currency info.',
    {
      accountId: z.string().describe('The Coinbase account ID to retrieve'),
    },
    async (args) => {
      try {
        const data = (await coinbaseFetch('GET', `/accounts/${args.accountId}`)) as {
          data: {
            id: string;
            name: string;
            type: string;
            currency: { code: string; name: string };
            balance: { amount: string; currency: string };
            native_balance: { amount: string; currency: string };
            created_at: string;
            updated_at: string;
          };
        };

        const acct = data.data;

        const lines = [
          `ID: ${acct.id}`,
          `Name: ${fenceUntrustedContent(acct.name, 'Coinbase')}`,
          `Type: ${acct.type}`,
          `Currency: ${acct.currency?.code ?? 'N/A'} (${acct.currency?.name ?? 'N/A'})`,
          `Balance: ${acct.balance?.amount ?? 'N/A'} ${acct.balance?.currency ?? ''}`,
          `Native Balance: ${acct.native_balance?.amount ?? 'N/A'} ${acct.native_balance?.currency ?? ''}`,
          `Created: ${acct.created_at}`,
          `Updated: ${acct.updated_at}`,
        ];

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error retrieving account: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Coinbase Account',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// coinbase_get_transactions
// ---------------------------------------------------------------------------

function createGetTransactionsTool(_db: Database) {
  return tool(
    'coinbase_get_transactions',
    'Get transaction history for a specific Coinbase account. Returns recent buys, sells, sends, and receives.',
    {
      accountId: z.string().describe('The Coinbase account ID to fetch transactions for'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Maximum number of transactions to return (1-100, default 25)'),
    },
    async (args) => {
      try {
        const limitParam = args.limit ?? 25;
        const data = (await coinbaseFetch(
          'GET',
          `/accounts/${args.accountId}/transactions?limit=${limitParam}`
        )) as {
          data: Array<{
            id: string;
            type: string;
            status: string;
            amount: { amount: string; currency: string };
            native_amount: { amount: string; currency: string };
            description: string | null;
            created_at: string;
            details: {
              title?: string;
              subtitle?: string;
              header?: string;
              health?: string;
            };
            to?: { resource: string; address?: string; currency?: { code: string } };
            from?: { resource: string; address?: string; currency?: { code: string } };
          }>;
          pagination?: { next_uri: string | null };
        };

        const transactions = data.data;

        if (!transactions || transactions.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No transactions found for account ${args.accountId}.`,
              },
            ],
          };
        }

        const lines: string[] = [
          `Found ${transactions.length} transaction${transactions.length !== 1 ? 's' : ''} for account ${args.accountId}:`,
          '',
        ];

        for (const txn of transactions) {
          lines.push(
            `ID: ${txn.id}`,
            `Type: ${txn.type}`,
            `Status: ${txn.status}`,
            `Amount: ${txn.amount?.amount ?? 'N/A'} ${txn.amount?.currency ?? ''}`,
            `Native Amount: ${txn.native_amount?.amount ?? 'N/A'} ${txn.native_amount?.currency ?? ''}`,
            `Created: ${txn.created_at}`
          );

          if (txn.description) {
            lines.push(`Description: ${fenceUntrustedContent(txn.description, 'Coinbase')}`);
          }

          if (txn.details?.title) {
            lines.push(
              `Details: ${fenceUntrustedContent(txn.details.title, 'Coinbase')}${txn.details.subtitle ? ' — ' + fenceUntrustedContent(txn.details.subtitle, 'Coinbase') : ''}`
            );
          }

          lines.push('');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error retrieving transactions: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Coinbase Transactions',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// coinbase_get_prices
// ---------------------------------------------------------------------------

function createGetPricesTool(_db: Database) {
  return tool(
    'coinbase_get_prices',
    'Get the current spot price for a currency pair (e.g., BTC-USD, ETH-USD, SOL-USD).',
    {
      currencyPair: z
        .string()
        .describe(
          'Currency pair to get the price for (e.g., "BTC-USD", "ETH-USD", "SOL-EUR"). Format: BASE-QUOTE.'
        ),
    },
    async (args) => {
      try {
        const pair = args.currencyPair.toUpperCase();
        const data = (await coinbaseFetch('GET', `/prices/${pair}/spot`)) as {
          data: {
            amount: string;
            base: string;
            currency: string;
          };
        };

        const price = data.data;

        const text = [
          `Spot Price for ${price.base}/${price.currency}:`,
          `Price: ${price.amount} ${price.currency}`,
        ].join('\n');

        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error retrieving price: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Coinbase Spot Price',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// coinbase_get_portfolio
// ---------------------------------------------------------------------------

function createGetPortfolioTool(_db: Database) {
  return tool(
    'coinbase_get_portfolio',
    'Get an aggregated portfolio view across all Coinbase accounts, showing total USD value and per-account breakdown.',
    {},
    async (_args) => {
      try {
        const data = (await coinbaseFetch('GET', '/accounts')) as {
          data: Array<{
            id: string;
            name: string;
            type: string;
            currency: { code: string; name: string };
            balance: { amount: string; currency: string };
            native_balance: { amount: string; currency: string };
          }>;
        };

        const accounts = data.data;

        if (!accounts || accounts.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No Coinbase accounts found.' }],
          };
        }

        // Filter to accounts with non-zero balance
        const nonZeroAccounts = accounts.filter(
          (a) => parseFloat(a.balance?.amount ?? '0') !== 0
        );

        // Aggregate USD equivalent totals
        let totalNative = 0;
        let nativeCurrency = 'USD';
        const breakdown: string[] = [];

        for (const acct of nonZeroAccounts) {
          const nativeAmount = parseFloat(acct.native_balance?.amount ?? '0');
          if (!isNaN(nativeAmount)) {
            totalNative += nativeAmount;
            nativeCurrency = acct.native_balance?.currency ?? nativeCurrency;
          }

          breakdown.push(
            `  ${fenceUntrustedContent(acct.name, 'Coinbase')}: ${acct.balance?.amount ?? '0'} ${acct.balance?.currency ?? ''} ≈ ${acct.native_balance?.amount ?? '0'} ${acct.native_balance?.currency ?? ''}`
          );
        }

        const lines: string[] = [
          `Coinbase Portfolio Summary`,
          `Total: ${totalNative.toFixed(2)} ${nativeCurrency}`,
          `Active accounts: ${nonZeroAccounts.length} of ${accounts.length} total`,
          '',
          'Breakdown:',
          ...breakdown,
        ];

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error retrieving portfolio: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Coinbase Portfolio',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createCoinbaseTools(db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'coinbase_list_accounts',
      description: 'List all Coinbase wallets and accounts with balances',
      sdkTool: createListAccountsTool(db),
    },
    {
      name: 'coinbase_get_account',
      description: 'Get details of a specific Coinbase account by ID',
      sdkTool: createGetAccountTool(db),
    },
    {
      name: 'coinbase_get_transactions',
      description: 'Get transaction history for a specific Coinbase account',
      sdkTool: createGetTransactionsTool(db),
    },
    {
      name: 'coinbase_get_prices',
      description: 'Get the current spot price for a currency pair',
      sdkTool: createGetPricesTool(db),
    },
    {
      name: 'coinbase_get_portfolio',
      description: 'Get an aggregated portfolio view across all Coinbase accounts',
      sdkTool: createGetPortfolioTool(db),
    },
  ];
}
