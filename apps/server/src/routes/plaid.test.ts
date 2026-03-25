import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, mock } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { migratePlaidTables } from '../db/migrations';
import { createPlaidRouter } from './plaid';
import { errorHandler } from '../middleware/error-handler';
import {
  insertPlaidItem,
  createLinkSession,
  updateLinkSessionStatus,
  upsertPlaidAccounts,
  upsertPlaidTransactions,
  createSyncJob,
  getPlaidItemByItemId,
  hasPendingSyncJob,
} from '../db/db-plaid';
import { encrypt } from '../services/plaid-encryption';
import type { PlaidApi } from 'plaid';

// ─── Test Encryption Key ────────────────────────────────────────────────────────

const TEST_KEY = 'b'.repeat(64);

beforeAll(() => {
  process.env.PLAID_ENCRYPTION_KEY = TEST_KEY;
  process.env.PLAID_ENCRYPTION_KEY_ID = 'test-v1';
  delete process.env.PLAID_ENCRYPTION_KEY_LEGACY;
});

afterAll(() => {
  delete process.env.PLAID_ENCRYPTION_KEY;
  delete process.env.PLAID_ENCRYPTION_KEY_ID;
});

// ─── Helpers ────────────────────────────────────────────────────────────────────

let db: Database;
let app: Hono;
let mockPlaid: Record<string, ReturnType<typeof mock>>;

function createMockPlaidClient(): PlaidApi {
  mockPlaid = {
    linkTokenCreate: mock(() =>
      Promise.resolve({
        data: {
          link_token: 'link-sandbox-test-token',
          hosted_link_url: 'https://hosted.plaid.com/link/test',
          expiration: '2099-01-01T00:00:00Z',
        },
      }),
    ),
    itemPublicTokenExchange: mock(() =>
      Promise.resolve({
        data: {
          access_token: 'access-sandbox-test-token',
          item_id: 'item-new-123',
        },
      }),
    ),
    itemGet: mock(() =>
      Promise.resolve({
        data: {
          item: {
            institution_id: 'ins_1',
          },
        },
      }),
    ),
    institutionsGetById: mock(() =>
      Promise.resolve({
        data: {
          institution: {
            name: 'Test Bank',
            logo: 'https://logo.example.com/bank.png',
            primary_color: '#0066cc',
          },
        },
      }),
    ),
    accountsGet: mock(() =>
      Promise.resolve({
        data: {
          accounts: [
            {
              account_id: 'acct-new-1',
              name: 'Checking',
              official_name: 'Primary Checking',
              type: 'depository',
              subtype: 'checking',
              mask: '1234',
              balances: { current: 5000, available: 4500, iso_currency_code: 'USD' },
            },
          ],
        },
      }),
    ),
    itemRemove: mock(() => Promise.resolve({ data: {} })),
    transactionsSync: mock(() =>
      Promise.resolve({
        data: {
          added: [],
          modified: [],
          removed: [],
          next_cursor: 'cursor-1',
          has_more: false,
        },
      }),
    ),
  };

  return mockPlaid as unknown as PlaidApi;
}

const USER_ID = 'local-user';

beforeEach(() => {
  db = new Database(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  migratePlaidTables(db);

  const plaidClient = createMockPlaidClient();
  app = new Hono();
  app.onError(errorHandler);
  app.route('/plaid', createPlaidRouter(db, plaidClient));
});

afterEach(() => {
  db.close();
});

// ─── Helpers for seeding ────────────────────────────────────────────────────────

function seedItem(overrides?: { itemId?: string; institutionName?: string }) {
  return insertPlaidItem(db, {
    userId: USER_ID,
    accessToken: encrypt('access-sandbox-seed-token'),
    itemId: overrides?.itemId ?? 'item-seed-1',
    institutionId: 'ins_1',
    institutionName: overrides?.institutionName ?? 'Seed Bank',
  });
}

function seedSession(overrides?: { state?: string; status?: string; expiresAt?: string }) {
  const session = createLinkSession(db, {
    userId: USER_ID,
    state: overrides?.state ?? 'test-state-' + crypto.randomUUID(),
    linkToken: 'link-sandbox-test',
    expiresAt: overrides?.expiresAt ?? '2099-01-01T00:00:00Z',
  });
  if (overrides?.status && overrides.status !== 'initiated') {
    updateLinkSessionStatus(db, session.id, overrides.status);
  }
  return session;
}

// ─── POST /plaid/link/start ─────────────────────────────────────────────────────

describe('POST /plaid/link/start', () => {
  test('creates session and returns hosted link URL', async () => {
    const res = await app.request('/plaid/link/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hosted_link_url).toBe('https://hosted.plaid.com/link/test');
    expect(body.session_id).toBeTruthy();
    expect(body.state).toBeTruthy();
    expect(mockPlaid.linkTokenCreate).toHaveBeenCalledTimes(1);
  });

  test('accepts custom products list', async () => {
    const res = await app.request('/plaid/link/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: ['transactions', 'auth'] }),
    });

    expect(res.status).toBe(200);
    const callArgs = (mockPlaid.linkTokenCreate as any).mock.calls[0][0];
    expect(callArgs.products).toEqual(['transactions', 'auth']);
  });
});

// ─── POST /plaid/link/finalize ──────────────────────────────────────────────────

describe('POST /plaid/link/finalize', () => {
  test('validates state, exchanges token, and stores item', async () => {
    const session = seedSession({ state: 'finalize-state-1' });

    const res = await app.request('/plaid/link/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: 'finalize-state-1',
        public_token: 'public-sandbox-test-token',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item).toBeTruthy();
    expect(body.item.itemId).toBe('item-new-123');
    expect(body.item.institutionName).toBe('Test Bank');
    expect(mockPlaid.itemPublicTokenExchange).toHaveBeenCalledTimes(1);
  });

  test('rejects expired session with 410', async () => {
    const session = seedSession({
      state: 'expired-state',
      expiresAt: '2000-01-01T00:00:00Z',
    });

    const res = await app.request('/plaid/link/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: 'expired-state',
        public_token: 'public-sandbox-test',
      }),
    });

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.code).toBe('SESSION_EXPIRED');
  });

  test('rejects already-finalized session with 409', async () => {
    const session = seedSession({ state: 'done-state', status: 'finalized' });

    const res = await app.request('/plaid/link/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: 'done-state',
        public_token: 'public-sandbox-test',
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('SESSION_ALREADY_FINALIZED');
  });

  test('rejects invalid state with 400', async () => {
    const res = await app.request('/plaid/link/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: 'nonexistent-state',
        public_token: 'public-sandbox-test',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_SESSION');
  });

  test('rejects missing required fields with 400', async () => {
    const res = await app.request('/plaid/link/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    // Validation error from zod — thrown as error with status 400
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /plaid/items/:itemId ────────────────────────────────────────────────

describe('DELETE /plaid/items/:itemId', () => {
  test('calls Plaid removal and deletes locally', async () => {
    seedItem({ itemId: 'item-to-delete' });

    const res = await app.request('/plaid/items/item-to-delete', { method: 'DELETE' });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockPlaid.itemRemove).toHaveBeenCalledTimes(1);

    // Item should be gone
    const found = getPlaidItemByItemId(db, 'item-to-delete', USER_ID);
    expect(found).toBeNull();
  });

  test('returns 404 for unknown item', async () => {
    const res = await app.request('/plaid/items/nonexistent', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  test('still deletes locally even if Plaid API fails', async () => {
    seedItem({ itemId: 'item-plaid-fail' });
    (mockPlaid.itemRemove as any).mockImplementationOnce(() =>
      Promise.reject(new Error('Plaid API down')),
    );

    const res = await app.request('/plaid/items/item-plaid-fail', { method: 'DELETE' });
    expect(res.status).toBe(200);

    const found = getPlaidItemByItemId(db, 'item-plaid-fail', USER_ID);
    expect(found).toBeNull();
  });
});

// ─── GET /plaid/items ───────────────────────────────────────────────────────────

describe('GET /plaid/items', () => {
  test('returns user items without access tokens', async () => {
    seedItem({ itemId: 'item-list-1', institutionName: 'Bank A' });
    seedItem({ itemId: 'item-list-2', institutionName: 'Bank B' });

    const res = await app.request('/plaid/items');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveLength(2);
    // Should NOT include accessToken
    for (const item of body) {
      expect(item.accessToken).toBeUndefined();
    }
  });

  test('returns empty array when no items', async () => {
    const res = await app.request('/plaid/items');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });
});

// ─── GET /plaid/transactions ────────────────────────────────────────────────────

describe('GET /plaid/transactions', () => {
  beforeEach(() => {
    seedItem({ itemId: 'item-tx' });
    upsertPlaidAccounts(db, USER_ID, [
      { id: 'acct-tx-1', itemId: 'item-tx', name: 'Checking', type: 'depository' },
    ]);
    upsertPlaidTransactions(db, USER_ID, [
      { id: 'tx-1', accountId: 'acct-tx-1', amount: 25.5, date: '2024-06-01', name: 'Coffee' },
      { id: 'tx-2', accountId: 'acct-tx-1', amount: 100, date: '2024-06-02', name: 'Groceries' },
      { id: 'tx-3', accountId: 'acct-tx-1', amount: 50, date: '2024-06-03', name: 'Gas' },
    ]);
  });

  test('returns paginated results with default limit', async () => {
    const res = await app.request('/plaid/transactions');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.items).toHaveLength(3);
    expect(body.total).toBe(3);
    expect(body.hasMore).toBe(false);
  });

  test('respects limit and offset parameters', async () => {
    const res = await app.request('/plaid/transactions?limit=1&offset=1');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(3);
    expect(body.hasMore).toBe(true);
    expect(body.limit).toBe(1);
    expect(body.offset).toBe(1);
  });

  test('supports search filter', async () => {
    const res = await app.request('/plaid/transactions?search=Coffee');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe('Coffee');
  });

  test('supports date range filter', async () => {
    const res = await app.request('/plaid/transactions?startDate=2024-06-02&endDate=2024-06-02');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe('Groceries');
  });
});

// ─── POST /plaid/sync ───────────────────────────────────────────────────────────

describe('POST /plaid/sync', () => {
  test('triggers sync and returns completed result', async () => {
    seedItem({ itemId: 'item-sync-1' });

    const res = await app.request('/plaid/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: 'item-sync-1' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('completed');
    expect(mockPlaid.transactionsSync).toHaveBeenCalled();
  });

  test('prevents duplicate syncs', async () => {
    seedItem({ itemId: 'item-sync-dup' });
    // Create a pending job manually
    createSyncJob(db, 'item-sync-dup');

    const res = await app.request('/plaid/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: 'item-sync-dup' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('already_syncing');
  });

  test('returns 404 for unknown item', async () => {
    const res = await app.request('/plaid/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: 'nonexistent-item' }),
    });

    expect(res.status).toBe(404);
  });

  test('rejects missing itemId', async () => {
    const res = await app.request('/plaid/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});
