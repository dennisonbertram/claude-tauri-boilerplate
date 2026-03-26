import { describe, test, expect, mock, beforeEach } from 'bun:test';
import type { Database } from 'bun:sqlite';

// ---------------------------------------------------------------------------
// Mock db-plaid functions before importing tools
// ---------------------------------------------------------------------------

const mockGetAccountsByUser = mock(() => []);
const mockGetPlaidItemsByUser = mock(() => []);
const mockGetTransactionsByUser = mock(() => []);

mock.module('../../db/db-plaid', () => ({
  getAccountsByUser: mockGetAccountsByUser,
  getPlaidItemsByUser: mockGetPlaidItemsByUser,
  getTransactionsByUser: mockGetTransactionsByUser,
}));

// Import after mocking
import { createPlaidTools } from './tools';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal Database stub */
const fakeDb = {} as unknown as Database;

function getTools() {
  return createPlaidTools(fakeDb);
}

function findTool(name: string) {
  const tools = getTools();
  const entry = tools.find((t) => t.name === name);
  if (!entry) throw new Error(`Tool not found: ${name}`);
  return entry.sdkTool;
}

async function invokeTool(toolName: string, args: Record<string, unknown>) {
  const sdkTool = findTool(toolName);
  return sdkTool.handler(args);
}

// ---------------------------------------------------------------------------
// Sample data factories
// ---------------------------------------------------------------------------

function makeAccount(overrides: Partial<ReturnType<typeof defaultAccount>> = {}) {
  return { ...defaultAccount(), ...overrides };
}

function defaultAccount() {
  return {
    id: 'acct-001',
    itemId: 'item-001',
    userId: 'default',
    name: 'Checking',
    officialName: 'Primary Checking Account',
    type: 'depository',
    subtype: 'checking',
    mask: '1234',
    currentBalance: 1500.0,
    availableBalance: 1400.0,
    currencyCode: 'USD',
    updatedAt: '2024-01-15T10:00:00Z',
  };
}

function makeTransaction(overrides: Partial<ReturnType<typeof defaultTransaction>> = {}) {
  return { ...defaultTransaction(), ...overrides };
}

function defaultTransaction() {
  return {
    id: 'txn-001',
    accountId: 'acct-001',
    userId: 'default',
    amount: 42.5,
    date: '2024-01-15',
    authorizedDate: '2024-01-14',
    name: 'Starbucks',
    merchantName: 'Starbucks',
    merchantEntityId: null,
    category: 'Food and Drink',
    personalFinanceCategory: 'FOOD_AND_DRINK',
    pending: false,
    pendingTransactionId: null,
    paymentChannel: 'in store',
    removed: false,
    rawJson: null,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  };
}

function makePlaidItem(overrides: Partial<ReturnType<typeof defaultPlaidItem>> = {}) {
  return { ...defaultPlaidItem(), ...overrides };
}

function defaultPlaidItem() {
  return {
    id: 'item-001',
    userId: 'default',
    accessToken: 'access-sandbox-xxx',
    itemId: 'plaid-item-id-001',
    institutionId: 'ins_001',
    institutionName: 'Chase',
    institutionLogoUrl: null,
    institutionColor: null,
    consentExpiration: null,
    errorCode: null,
    errorMessage: null,
    syncCursor: null,
    lastSyncedAt: '2024-01-15T10:00:00Z',
    lastSuccessfulSyncAt: '2024-01-15T10:00:00Z',
    lastSyncError: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  };
}

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockGetAccountsByUser.mockReset();
  mockGetPlaidItemsByUser.mockReset();
  mockGetTransactionsByUser.mockReset();
  // Reset to default empty returns
  mockGetAccountsByUser.mockReturnValue([]);
  mockGetPlaidItemsByUser.mockReturnValue([]);
  mockGetTransactionsByUser.mockReturnValue([]);
});

// ---------------------------------------------------------------------------
// Tests: plaid_list_accounts
// ---------------------------------------------------------------------------

describe('plaid_list_accounts', () => {
  test('returns formatted account list when accounts exist', async () => {
    const accounts = [
      makeAccount({ id: 'acct-001', name: 'Checking', currentBalance: 1500, mask: '1234' }),
      makeAccount({ id: 'acct-002', name: 'Savings', officialName: 'High Yield Savings', currentBalance: 5000, availableBalance: null, mask: '5678', type: 'depository', subtype: 'savings' }),
    ];
    mockGetAccountsByUser.mockReturnValue(accounts);

    const result = await invokeTool('plaid_list_accounts', {});
    const text = result.content[0].text as string;

    expect(text).toContain('2 accounts');
    expect(text).toContain('••••1234');
    expect(text).toContain('High Yield Savings');
    expect(text).toContain('••••5678');
    expect(text).toContain('$1,500.00');
    expect(text).toContain('$5,000.00');
  });

  test('returns message when no accounts found', async () => {
    mockGetAccountsByUser.mockReturnValue([]);

    const result = await invokeTool('plaid_list_accounts', {});
    const text = result.content[0].text as string;

    expect(text).toContain('No connected bank accounts found');
  });

  test('returns message when type filter yields no results', async () => {
    mockGetAccountsByUser.mockReturnValue([]);

    const result = await invokeTool('plaid_list_accounts', { type: 'investment' });
    const text = result.content[0].text as string;

    // The type filter value is fenced as untrusted content
    expect(text).toContain('investment');
    expect(text).toContain('accounts found');
  });

  test('passes type filter to getAccountsByUser', async () => {
    mockGetAccountsByUser.mockReturnValue([]);

    await invokeTool('plaid_list_accounts', { type: 'credit' });

    expect(mockGetAccountsByUser).toHaveBeenCalledWith(fakeDb, 'default', { type: 'credit' });
  });

  test('shows available balance when present', async () => {
    mockGetAccountsByUser.mockReturnValue([
      makeAccount({ currentBalance: 1000, availableBalance: 900 }),
    ]);

    const result = await invokeTool('plaid_list_accounts', {});
    const text = result.content[0].text as string;

    expect(text).toContain('Available Balance: $900.00');
  });

  test('shows account type and subtype', async () => {
    mockGetAccountsByUser.mockReturnValue([
      makeAccount({ type: 'depository', subtype: 'checking' }),
    ]);

    const result = await invokeTool('plaid_list_accounts', {});
    const text = result.content[0].text as string;

    expect(text).toContain('depository (checking)');
  });

  test('handles error gracefully', async () => {
    mockGetAccountsByUser.mockImplementation(() => {
      throw new Error('DB connection error');
    });

    const result = await invokeTool('plaid_list_accounts', {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('DB connection error');
  });
});

// ---------------------------------------------------------------------------
// Tests: plaid_get_balance
// ---------------------------------------------------------------------------

describe('plaid_get_balance', () => {
  test('returns balance for all accounts when no accountId given', async () => {
    mockGetAccountsByUser.mockReturnValue([
      makeAccount({ id: 'acct-001', name: 'Checking', currentBalance: 1500 }),
      makeAccount({ id: 'acct-002', name: 'Savings', currentBalance: 5000, officialName: 'Savings' }),
    ]);

    const result = await invokeTool('plaid_get_balance', {});
    const text = result.content[0].text as string;

    expect(text).toContain('$1,500.00');
    expect(text).toContain('$5,000.00');
    expect(text).toContain('Total across all accounts');
    expect(text).toContain('$6,500.00');
  });

  test('returns balance for specific account', async () => {
    const accounts = [
      makeAccount({ id: 'acct-001', name: 'Checking', currentBalance: 1500 }),
      makeAccount({ id: 'acct-002', name: 'Savings', currentBalance: 5000 }),
    ];
    mockGetAccountsByUser.mockReturnValue(accounts);

    const result = await invokeTool('plaid_get_balance', { accountId: 'acct-001' });
    const text = result.content[0].text as string;

    expect(text).toContain('$1,500.00');
    expect(text).not.toContain('Total across all accounts');
  });

  test('returns error message when accountId not found', async () => {
    mockGetAccountsByUser.mockReturnValue([
      makeAccount({ id: 'acct-001' }),
    ]);

    const result = await invokeTool('plaid_get_balance', { accountId: 'nonexistent' });
    const text = result.content[0].text as string;

    expect(text).toContain('Account not found');
    expect(text).toContain('nonexistent');
  });

  test('returns message when no accounts found', async () => {
    mockGetAccountsByUser.mockReturnValue([]);

    const result = await invokeTool('plaid_get_balance', {});
    const text = result.content[0].text as string;

    expect(text).toContain('No connected bank accounts found');
  });

  test('does not show total for single account', async () => {
    mockGetAccountsByUser.mockReturnValue([
      makeAccount({ currentBalance: 1500 }),
    ]);

    const result = await invokeTool('plaid_get_balance', {});
    const text = result.content[0].text as string;

    expect(text).not.toContain('Total across all accounts');
  });

  test('handles null currentBalance in total calculation', async () => {
    mockGetAccountsByUser.mockReturnValue([
      makeAccount({ id: 'acct-001', currentBalance: 1000 }),
      makeAccount({ id: 'acct-002', currentBalance: null }),
    ]);

    const result = await invokeTool('plaid_get_balance', {});
    const text = result.content[0].text as string;

    // Total should only count non-null balances
    expect(text).toContain('$1,000.00');
  });
});

// ---------------------------------------------------------------------------
// Tests: plaid_search_transactions
// ---------------------------------------------------------------------------

describe('plaid_search_transactions', () => {
  test('returns formatted transaction list', async () => {
    mockGetTransactionsByUser.mockReturnValue([
      makeTransaction({ id: 'txn-001', name: 'Starbucks', amount: 5.50, date: '2024-01-15', personalFinanceCategory: 'FOOD_AND_DRINK' }),
      makeTransaction({ id: 'txn-002', name: 'Amazon', merchantName: 'Amazon', amount: 29.99, date: '2024-01-14', personalFinanceCategory: 'SHOPPING' }),
    ]);

    const result = await invokeTool('plaid_search_transactions', {});
    const text = result.content[0].text as string;

    expect(text).toContain('2 transaction');
    expect(text).toContain('Starbucks');
    expect(text).toContain('$5.50');
    expect(text).toContain('Amazon');
    expect(text).toContain('$29.99');
    expect(text).toContain('FOOD_AND_DRINK');
    expect(text).toContain('SHOPPING');
  });

  test('returns message when no transactions found', async () => {
    mockGetTransactionsByUser.mockReturnValue([]);

    const result = await invokeTool('plaid_search_transactions', {});
    const text = result.content[0].text as string;

    expect(text).toContain('No transactions found');
  });

  test('passes filters to getTransactionsByUser', async () => {
    mockGetTransactionsByUser.mockReturnValue([]);

    await invokeTool('plaid_search_transactions', {
      search: 'coffee',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      category: 'FOOD_AND_DRINK',
      minAmount: 5,
      maxAmount: 50,
      limit: 10,
      sort: 'amount_desc',
    });

    expect(mockGetTransactionsByUser).toHaveBeenCalledWith(
      fakeDb,
      'default',
      expect.objectContaining({
        search: 'coffee',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        category: 'FOOD_AND_DRINK',
        minAmount: 5,
        maxAmount: 50,
        limit: 10,
        sort: 'amount_desc',
      })
    );
  });

  test('uses default limit of 25 when not specified', async () => {
    mockGetTransactionsByUser.mockReturnValue([]);

    await invokeTool('plaid_search_transactions', {});

    expect(mockGetTransactionsByUser).toHaveBeenCalledWith(
      fakeDb,
      'default',
      expect.objectContaining({ limit: 25, sort: 'date_desc' })
    );
  });

  test('marks pending transactions', async () => {
    mockGetTransactionsByUser.mockReturnValue([
      makeTransaction({ pending: true, name: 'Coffee Shop' }),
    ]);

    const result = await invokeTool('plaid_search_transactions', {});
    const text = result.content[0].text as string;

    expect(text).toContain('(pending)');
  });

  test('uses merchantName over name when available', async () => {
    mockGetTransactionsByUser.mockReturnValue([
      makeTransaction({ name: 'SBUX', merchantName: 'Starbucks' }),
    ]);

    const result = await invokeTool('plaid_search_transactions', {});
    const text = result.content[0].text as string;

    expect(text).toContain('Starbucks');
  });

  test('falls back to category when personalFinanceCategory is null', async () => {
    mockGetTransactionsByUser.mockReturnValue([
      makeTransaction({ personalFinanceCategory: null, category: 'Food and Drink' }),
    ]);

    const result = await invokeTool('plaid_search_transactions', {});
    const text = result.content[0].text as string;

    expect(text).toContain('Food and Drink');
  });

  test('handles error gracefully', async () => {
    mockGetTransactionsByUser.mockImplementation(() => {
      throw new Error('Query failed');
    });

    const result = await invokeTool('plaid_search_transactions', {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Query failed');
  });
});

// ---------------------------------------------------------------------------
// Tests: plaid_get_spending_summary
// ---------------------------------------------------------------------------

describe('plaid_get_spending_summary', () => {
  test('aggregates transactions by personalFinanceCategory', async () => {
    mockGetTransactionsByUser.mockReturnValue([
      makeTransaction({ amount: 10.0, personalFinanceCategory: 'FOOD_AND_DRINK' }),
      makeTransaction({ amount: 15.0, personalFinanceCategory: 'FOOD_AND_DRINK' }),
      makeTransaction({ amount: 50.0, personalFinanceCategory: 'SHOPPING' }),
      makeTransaction({ amount: 20.0, personalFinanceCategory: 'TRANSPORTATION' }),
    ]);

    const result = await invokeTool('plaid_get_spending_summary', {});
    const text = result.content[0].text as string;

    expect(text).toContain('Spending Summary');
    // SHOPPING is the highest amount
    expect(text).toContain('$50.00');
    // FOOD_AND_DRINK total
    expect(text).toContain('$25.00');
    // Total
    expect(text).toContain('Total Spending: $95.00');
  });

  test('sorts categories by amount descending', async () => {
    mockGetTransactionsByUser.mockReturnValue([
      makeTransaction({ amount: 10.0, personalFinanceCategory: 'FOOD_AND_DRINK' }),
      makeTransaction({ amount: 100.0, personalFinanceCategory: 'SHOPPING' }),
      makeTransaction({ amount: 30.0, personalFinanceCategory: 'TRANSPORTATION' }),
    ]);

    const result = await invokeTool('plaid_get_spending_summary', {});
    const text = result.content[0].text as string;
    const lines = text.split('\n').filter((l) => l.trim());

    // SHOPPING should appear before others
    const shoppingIdx = lines.findIndex((l) => l.includes('Shopping'));
    const foodIdx = lines.findIndex((l) => l.includes('Food'));
    const transportIdx = lines.findIndex((l) => l.includes('Transportation'));

    expect(shoppingIdx).toBeLessThan(transportIdx);
    expect(transportIdx).toBeLessThan(foodIdx);
  });

  test('excludes negative amounts (credits/income) from spending', async () => {
    mockGetTransactionsByUser.mockReturnValue([
      makeTransaction({ amount: 50.0, personalFinanceCategory: 'SHOPPING' }),
      makeTransaction({ amount: -1000.0, personalFinanceCategory: 'INCOME' }), // credit/income
    ]);

    const result = await invokeTool('plaid_get_spending_summary', {});
    const text = result.content[0].text as string;

    // Only spending (positive amounts) included
    expect(text).toContain('Total Spending: $50.00');
    expect(text).not.toContain('Income');
  });

  test('falls back to category when personalFinanceCategory is null', async () => {
    mockGetTransactionsByUser.mockReturnValue([
      makeTransaction({ amount: 25.0, personalFinanceCategory: null, category: 'Food' }),
    ]);

    const result = await invokeTool('plaid_get_spending_summary', {});
    const text = result.content[0].text as string;

    expect(text).toContain('Food');
  });

  test('uses UNCATEGORIZED when both category fields are null', async () => {
    mockGetTransactionsByUser.mockReturnValue([
      makeTransaction({ amount: 25.0, personalFinanceCategory: null, category: null }),
    ]);

    const result = await invokeTool('plaid_get_spending_summary', {});
    const text = result.content[0].text as string;

    expect(text).toContain('Uncategorized');
  });

  test('passes date range to getTransactionsByUser', async () => {
    mockGetTransactionsByUser.mockReturnValue([]);

    await invokeTool('plaid_get_spending_summary', {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    });

    expect(mockGetTransactionsByUser).toHaveBeenCalledWith(
      fakeDb,
      'default',
      expect.objectContaining({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      })
    );
  });

  test('passes limit of 10000 to getTransactionsByUser', async () => {
    mockGetTransactionsByUser.mockReturnValue([]);

    await invokeTool('plaid_get_spending_summary', {});

    expect(mockGetTransactionsByUser).toHaveBeenCalledWith(
      fakeDb,
      'default',
      expect.objectContaining({ limit: 10000 })
    );
  });

  test('returns message when no transactions found', async () => {
    mockGetTransactionsByUser.mockReturnValue([]);

    const result = await invokeTool('plaid_get_spending_summary', {});
    const text = result.content[0].text as string;

    expect(text).toContain('No transactions found');
  });

  test('returns message when all transactions are income/credits', async () => {
    mockGetTransactionsByUser.mockReturnValue([
      makeTransaction({ amount: -500.0, personalFinanceCategory: 'INCOME' }),
      makeTransaction({ amount: -200.0, personalFinanceCategory: 'TRANSFER_IN' }),
    ]);

    const result = await invokeTool('plaid_get_spending_summary', {});
    const text = result.content[0].text as string;

    expect(text).toContain('No spending transactions found');
  });

  test('shows percentage breakdown', async () => {
    mockGetTransactionsByUser.mockReturnValue([
      makeTransaction({ amount: 75.0, personalFinanceCategory: 'FOOD_AND_DRINK' }),
      makeTransaction({ amount: 25.0, personalFinanceCategory: 'TRANSPORTATION' }),
    ]);

    const result = await invokeTool('plaid_get_spending_summary', {});
    const text = result.content[0].text as string;

    expect(text).toContain('75.0%');
    expect(text).toContain('25.0%');
  });

  test('handles error gracefully', async () => {
    mockGetTransactionsByUser.mockImplementation(() => {
      throw new Error('Database error');
    });

    const result = await invokeTool('plaid_get_spending_summary', {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Database error');
  });
});

// ---------------------------------------------------------------------------
// Tests: plaid_list_institutions
// ---------------------------------------------------------------------------

describe('plaid_list_institutions', () => {
  test('returns formatted institution list', async () => {
    mockGetPlaidItemsByUser.mockReturnValue([
      makePlaidItem({ institutionName: 'Chase', institutionId: 'ins_001', lastSuccessfulSyncAt: '2024-01-15T10:00:00Z' }),
      makePlaidItem({ id: 'item-002', institutionName: 'Bank of America', institutionId: 'ins_002', lastSuccessfulSyncAt: null }),
    ]);

    const result = await invokeTool('plaid_list_institutions', {});
    const text = result.content[0].text as string;

    expect(text).toContain('2');
    expect(text).toContain('Chase');
    expect(text).toContain('Bank of America');
    expect(text).toContain('ins_001');
    expect(text).toContain('2024-01-15T10:00:00Z');
    expect(text).toContain('Connected');
  });

  test('returns message when no institutions connected', async () => {
    mockGetPlaidItemsByUser.mockReturnValue([]);

    const result = await invokeTool('plaid_list_institutions', {});
    const text = result.content[0].text as string;

    expect(text).toContain('No financial institutions connected');
  });

  test('shows error status when institution has an error', async () => {
    mockGetPlaidItemsByUser.mockReturnValue([
      makePlaidItem({ errorCode: 'ITEM_LOGIN_REQUIRED', errorMessage: 'Login expired' }),
    ]);

    const result = await invokeTool('plaid_list_institutions', {});
    const text = result.content[0].text as string;

    expect(text).toContain('Error');
    expect(text).toContain('ITEM_LOGIN_REQUIRED');
    expect(text).toContain('Login expired');
  });

  test('handles unknown institution name gracefully', async () => {
    mockGetPlaidItemsByUser.mockReturnValue([
      makePlaidItem({ institutionName: null }),
    ]);

    const result = await invokeTool('plaid_list_institutions', {});
    const text = result.content[0].text as string;

    expect(text).toContain('Unknown Institution');
  });

  test('passes correct userId to getPlaidItemsByUser', async () => {
    mockGetPlaidItemsByUser.mockReturnValue([]);

    await invokeTool('plaid_list_institutions', {});

    expect(mockGetPlaidItemsByUser).toHaveBeenCalledWith(fakeDb, 'default');
  });

  test('handles error gracefully', async () => {
    mockGetPlaidItemsByUser.mockImplementation(() => {
      throw new Error('DB error');
    });

    const result = await invokeTool('plaid_list_institutions', {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('DB error');
  });
});

// ---------------------------------------------------------------------------
// Tests: createPlaidTools — structure validation
// ---------------------------------------------------------------------------

describe('createPlaidTools', () => {
  test('returns 5 tools', () => {
    const tools = createPlaidTools(fakeDb);
    expect(tools.length).toBe(5);
  });

  test('each tool has required fields', () => {
    const tools = createPlaidTools(fakeDb);
    for (const t of tools) {
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.sdkTool).toBeDefined();
      expect(t.sdkTool.name).toBe(t.name);
      expect(typeof t.sdkTool.handler).toBe('function');
    }
  });

  test('has correct tool names', () => {
    const tools = createPlaidTools(fakeDb);
    const names = tools.map((t) => t.name);

    expect(names).toContain('plaid_list_accounts');
    expect(names).toContain('plaid_get_balance');
    expect(names).toContain('plaid_search_transactions');
    expect(names).toContain('plaid_get_spending_summary');
    expect(names).toContain('plaid_list_institutions');
  });
});
