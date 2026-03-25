import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { migratePlaidTables } from './migrations';
import {
  createLinkSession,
  getLinkSessionByState,
  updateLinkSessionStatus,
  expireOldLinkSessions,
  insertPlaidItem,
  getPlaidItemsByUser,
  getPlaidItemByItemId,
  deletePlaidItem,
  upsertPlaidAccounts,
  getAccountsByUser,
  getAccountsByItemId,
  upsertPlaidTransactions,
  markTransactionsRemoved,
  getTransactionsByAccount,
  getTransactionsByUser,
  getTransactionCountByUser,
  createSyncJob,
  updateSyncJob,
  getLatestSyncJob,
  hasPendingSyncJob,
} from './db-plaid';

let db: Database;

beforeEach(() => {
  db = new Database(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  migratePlaidTables(db);
});

afterEach(() => {
  db.close();
});

// ─── Link Sessions ──────────────────────────────────────────────────────────────

describe('Link Sessions', () => {
  test('createLinkSession returns mapped session', () => {
    const session = createLinkSession(db, {
      userId: 'user-1',
      state: 'state-abc',
      linkToken: 'link-token-123',
      hostedLinkUrl: 'https://hosted.plaid.com/link',
      expiresAt: '2099-01-01T00:00:00Z',
    });

    expect(session.userId).toBe('user-1');
    expect(session.state).toBe('state-abc');
    expect(session.linkToken).toBe('link-token-123');
    expect(session.hostedLinkUrl).toBe('https://hosted.plaid.com/link');
    expect(session.status).toBe('initiated');
    expect(session.id).toBeTruthy();
    expect(session.createdAt).toBeTruthy();
  });

  test('createLinkSession works without optional hostedLinkUrl', () => {
    const session = createLinkSession(db, {
      userId: 'user-1',
      state: 'state-xyz',
      linkToken: 'link-token-456',
      expiresAt: '2099-01-01T00:00:00Z',
    });

    expect(session.hostedLinkUrl).toBeNull();
  });

  test('getLinkSessionByState returns session when found', () => {
    createLinkSession(db, {
      userId: 'user-1',
      state: 'unique-state',
      linkToken: 'tok-1',
      expiresAt: '2099-01-01T00:00:00Z',
    });

    const found = getLinkSessionByState(db, 'unique-state');
    expect(found).not.toBeNull();
    expect(found!.state).toBe('unique-state');
  });

  test('getLinkSessionByState returns null for unknown state', () => {
    const found = getLinkSessionByState(db, 'nonexistent');
    expect(found).toBeNull();
  });

  test('updateLinkSessionStatus updates status and payload fields', () => {
    const session = createLinkSession(db, {
      userId: 'user-1',
      state: 'state-upd',
      linkToken: 'tok-1',
      expiresAt: '2099-01-01T00:00:00Z',
    });

    updateLinkSessionStatus(db, session.id, 'finalized', {
      callbackPayload: '{"foo":"bar"}',
    });

    const updated = getLinkSessionByState(db, 'state-upd');
    expect(updated!.status).toBe('finalized');
    expect(updated!.callbackPayload).toBe('{"foo":"bar"}');
  });

  test('updateLinkSessionStatus can set error fields', () => {
    const session = createLinkSession(db, {
      userId: 'user-1',
      state: 'state-err',
      linkToken: 'tok-1',
      expiresAt: '2099-01-01T00:00:00Z',
    });

    updateLinkSessionStatus(db, session.id, 'failed', {
      errorCode: 'TOKEN_EXCHANGE_FAILED',
      errorMessage: 'Something went wrong',
    });

    const updated = getLinkSessionByState(db, 'state-err');
    expect(updated!.status).toBe('failed');
    expect(updated!.errorCode).toBe('TOKEN_EXCHANGE_FAILED');
    expect(updated!.errorMessage).toBe('Something went wrong');
  });

  test('expireOldLinkSessions expires sessions past their expiration', () => {
    // Create an already-expired session
    createLinkSession(db, {
      userId: 'user-1',
      state: 'state-old',
      linkToken: 'tok-old',
      expiresAt: '2000-01-01T00:00:00Z', // far in the past
    });

    // Create a still-valid session
    createLinkSession(db, {
      userId: 'user-1',
      state: 'state-fresh',
      linkToken: 'tok-fresh',
      expiresAt: '2099-01-01T00:00:00Z',
    });

    expireOldLinkSessions(db);

    const expired = getLinkSessionByState(db, 'state-old');
    expect(expired!.status).toBe('expired');

    const fresh = getLinkSessionByState(db, 'state-fresh');
    expect(fresh!.status).toBe('initiated');
  });

  test('expireOldLinkSessions does not expire finalized sessions', () => {
    const session = createLinkSession(db, {
      userId: 'user-1',
      state: 'state-done',
      linkToken: 'tok-done',
      expiresAt: '2000-01-01T00:00:00Z',
    });
    updateLinkSessionStatus(db, session.id, 'finalized');

    expireOldLinkSessions(db);

    const found = getLinkSessionByState(db, 'state-done');
    expect(found!.status).toBe('finalized');
  });
});

// ─── Items ──────────────────────────────────────────────────────────────────────

describe('Plaid Items', () => {
  test('insertPlaidItem and getPlaidItemsByUser', () => {
    const item = insertPlaidItem(db, {
      userId: 'user-1',
      accessToken: 'encrypted-token-abc',
      itemId: 'item-1',
      institutionId: 'ins_1',
      institutionName: 'Chase',
    });

    expect(item.userId).toBe('user-1');
    expect(item.accessToken).toBe('encrypted-token-abc');
    expect(item.itemId).toBe('item-1');
    expect(item.institutionName).toBe('Chase');
    expect(item.id).toBeTruthy();

    const items = getPlaidItemsByUser(db, 'user-1');
    expect(items).toHaveLength(1);
    expect(items[0].itemId).toBe('item-1');
  });

  test('getPlaidItemsByUser returns empty for unknown user', () => {
    const items = getPlaidItemsByUser(db, 'unknown-user');
    expect(items).toHaveLength(0);
  });

  test('getPlaidItemByItemId returns item owned by user', () => {
    insertPlaidItem(db, {
      userId: 'user-1',
      accessToken: 'tok',
      itemId: 'item-owned',
    });

    const found = getPlaidItemByItemId(db, 'item-owned', 'user-1');
    expect(found).not.toBeNull();
    expect(found!.itemId).toBe('item-owned');
  });

  test('getPlaidItemByItemId returns null for wrong user', () => {
    insertPlaidItem(db, {
      userId: 'user-1',
      accessToken: 'tok',
      itemId: 'item-private',
    });

    const found = getPlaidItemByItemId(db, 'item-private', 'user-2');
    expect(found).toBeNull();
  });

  test('deletePlaidItem removes item', () => {
    insertPlaidItem(db, {
      userId: 'user-1',
      accessToken: 'tok',
      itemId: 'item-del',
    });

    deletePlaidItem(db, 'item-del', 'user-1');
    const found = getPlaidItemByItemId(db, 'item-del', 'user-1');
    expect(found).toBeNull();
  });

  test('deletePlaidItem does not delete item of different user', () => {
    insertPlaidItem(db, {
      userId: 'user-1',
      accessToken: 'tok',
      itemId: 'item-safe',
    });

    deletePlaidItem(db, 'item-safe', 'user-2');
    const found = getPlaidItemByItemId(db, 'item-safe', 'user-1');
    expect(found).not.toBeNull();
  });
});

// ─── Accounts ───────────────────────────────────────────────────────────────────

describe('Plaid Accounts', () => {
  const userId = 'user-1';

  beforeEach(() => {
    insertPlaidItem(db, {
      userId,
      accessToken: 'tok',
      itemId: 'item-acct',
    });
  });

  test('upsertPlaidAccounts inserts and getAccountsByUser retrieves', () => {
    upsertPlaidAccounts(db, userId, [
      {
        id: 'acct-1',
        itemId: 'item-acct',
        name: 'Checking',
        type: 'depository',
        subtype: 'checking',
        currentBalance: 1000,
        availableBalance: 900,
      },
    ]);

    const accounts = getAccountsByUser(db, userId);
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe('Checking');
    expect(accounts[0].currentBalance).toBe(1000);
    expect(accounts[0].currencyCode).toBe('USD');
  });

  test('upsertPlaidAccounts updates existing account', () => {
    upsertPlaidAccounts(db, userId, [
      { id: 'acct-upd', itemId: 'item-acct', name: 'Old Name', type: 'depository' },
    ]);
    upsertPlaidAccounts(db, userId, [
      { id: 'acct-upd', itemId: 'item-acct', name: 'New Name', type: 'depository', currentBalance: 500 },
    ]);

    const accounts = getAccountsByUser(db, userId);
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe('New Name');
    expect(accounts[0].currentBalance).toBe(500);
  });

  test('getAccountsByUser filters by itemId', () => {
    insertPlaidItem(db, { userId, accessToken: 'tok2', itemId: 'item-other' });
    upsertPlaidAccounts(db, userId, [
      { id: 'acct-a', itemId: 'item-acct', name: 'A', type: 'depository' },
      { id: 'acct-b', itemId: 'item-other', name: 'B', type: 'credit' },
    ]);

    const filtered = getAccountsByUser(db, userId, { itemId: 'item-acct' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('acct-a');
  });

  test('getAccountsByUser filters by type', () => {
    upsertPlaidAccounts(db, userId, [
      { id: 'acct-dep', itemId: 'item-acct', name: 'Checking', type: 'depository' },
      { id: 'acct-cred', itemId: 'item-acct', name: 'Credit Card', type: 'credit' },
    ]);

    const creditOnly = getAccountsByUser(db, userId, { type: 'credit' });
    expect(creditOnly).toHaveLength(1);
    expect(creditOnly[0].type).toBe('credit');
  });

  test('getAccountsByItemId returns accounts for specific item', () => {
    upsertPlaidAccounts(db, userId, [
      { id: 'acct-x', itemId: 'item-acct', name: 'X', type: 'depository' },
    ]);

    const accounts = getAccountsByItemId(db, 'item-acct', userId);
    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe('acct-x');
  });
});

// ─── Transactions ───────────────────────────────────────────────────────────────

describe('Plaid Transactions', () => {
  const userId = 'user-1';

  beforeEach(() => {
    insertPlaidItem(db, { userId, accessToken: 'tok', itemId: 'item-tx' });
    upsertPlaidAccounts(db, userId, [
      { id: 'acct-tx', itemId: 'item-tx', name: 'Checking', type: 'depository' },
    ]);
  });

  test('upsertPlaidTransactions inserts and retrieves by account', () => {
    upsertPlaidTransactions(db, userId, [
      {
        id: 'tx-1',
        accountId: 'acct-tx',
        amount: 42.5,
        date: '2024-06-15',
        name: 'Coffee Shop',
        merchantName: 'Starbucks',
        pending: false,
      },
    ]);

    const txns = getTransactionsByAccount(db, 'acct-tx', userId);
    expect(txns).toHaveLength(1);
    expect(txns[0].amount).toBe(42.5);
    expect(txns[0].name).toBe('Coffee Shop');
    expect(txns[0].pending).toBe(false);
    expect(txns[0].removed).toBe(false);
  });

  test('upsertPlaidTransactions updates existing transaction and clears removed', () => {
    upsertPlaidTransactions(db, userId, [
      { id: 'tx-upd', accountId: 'acct-tx', amount: 10, date: '2024-01-01', name: 'Old' },
    ]);
    // Mark removed
    markTransactionsRemoved(db, ['tx-upd']);

    // Upsert again — should reset removed=0
    upsertPlaidTransactions(db, userId, [
      { id: 'tx-upd', accountId: 'acct-tx', amount: 20, date: '2024-01-01', name: 'Updated' },
    ]);

    const txns = getTransactionsByAccount(db, 'acct-tx', userId);
    expect(txns).toHaveLength(1);
    expect(txns[0].amount).toBe(20);
    expect(txns[0].name).toBe('Updated');
    expect(txns[0].removed).toBe(false);
  });

  test('markTransactionsRemoved soft-deletes transactions', () => {
    upsertPlaidTransactions(db, userId, [
      { id: 'tx-rm', accountId: 'acct-tx', amount: 5, date: '2024-03-01', name: 'Removed' },
    ]);

    markTransactionsRemoved(db, ['tx-rm']);

    // removed=0 filter means it won't appear
    const txns = getTransactionsByAccount(db, 'acct-tx', userId);
    expect(txns).toHaveLength(0);
  });

  test('markTransactionsRemoved with empty array is a no-op', () => {
    // Should not throw
    markTransactionsRemoved(db, []);
  });

  test('getTransactionsByAccount with date range filter', () => {
    upsertPlaidTransactions(db, userId, [
      { id: 'tx-jan', accountId: 'acct-tx', amount: 10, date: '2024-01-15', name: 'Jan' },
      { id: 'tx-mar', accountId: 'acct-tx', amount: 20, date: '2024-03-15', name: 'Mar' },
      { id: 'tx-jun', accountId: 'acct-tx', amount: 30, date: '2024-06-15', name: 'Jun' },
    ]);

    const filtered = getTransactionsByAccount(db, 'acct-tx', userId, {
      startDate: '2024-02-01',
      endDate: '2024-04-30',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('tx-mar');
  });

  test('getTransactionsByAccount with limit and offset', () => {
    upsertPlaidTransactions(db, userId, [
      { id: 'tx-a', accountId: 'acct-tx', amount: 1, date: '2024-01-01', name: 'A' },
      { id: 'tx-b', accountId: 'acct-tx', amount: 2, date: '2024-02-01', name: 'B' },
      { id: 'tx-c', accountId: 'acct-tx', amount: 3, date: '2024-03-01', name: 'C' },
    ]);

    const page = getTransactionsByAccount(db, 'acct-tx', userId, { limit: 1, offset: 1 });
    expect(page).toHaveLength(1);
    // Ordered by date DESC: C(Mar), B(Feb), A(Jan) — offset=1 => B
    expect(page[0].id).toBe('tx-b');
  });

  test('getTransactionsByUser with search filter', () => {
    upsertPlaidTransactions(db, userId, [
      { id: 'tx-s1', accountId: 'acct-tx', amount: 5, date: '2024-01-01', name: 'Amazon Purchase', merchantName: 'Amazon' },
      { id: 'tx-s2', accountId: 'acct-tx', amount: 10, date: '2024-01-02', name: 'Grocery Store' },
    ]);

    const results = getTransactionsByUser(db, userId, { search: 'Amazon' });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('tx-s1');
  });

  test('getTransactionsByUser with pagination and sort', () => {
    upsertPlaidTransactions(db, userId, [
      { id: 'tx-lo', accountId: 'acct-tx', amount: 1, date: '2024-01-01', name: 'Low' },
      { id: 'tx-hi', accountId: 'acct-tx', amount: 100, date: '2024-01-02', name: 'High' },
      { id: 'tx-mid', accountId: 'acct-tx', amount: 50, date: '2024-01-03', name: 'Mid' },
    ]);

    const asc = getTransactionsByUser(db, userId, { sort: 'amount_asc' });
    expect(asc[0].amount).toBe(1);
    expect(asc[2].amount).toBe(100);

    const desc = getTransactionsByUser(db, userId, { sort: 'amount_desc' });
    expect(desc[0].amount).toBe(100);
  });

  test('getTransactionsByUser with date range filter', () => {
    upsertPlaidTransactions(db, userId, [
      { id: 'tx-d1', accountId: 'acct-tx', amount: 5, date: '2024-01-10', name: 'Early' },
      { id: 'tx-d2', accountId: 'acct-tx', amount: 10, date: '2024-06-15', name: 'Mid' },
      { id: 'tx-d3', accountId: 'acct-tx', amount: 15, date: '2024-12-01', name: 'Late' },
    ]);

    const results = getTransactionsByUser(db, userId, {
      startDate: '2024-03-01',
      endDate: '2024-09-01',
    });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('tx-d2');
  });

  test('getTransactionsByUser with accountIds filter', () => {
    upsertPlaidAccounts(db, userId, [
      { id: 'acct-tx2', itemId: 'item-tx', name: 'Savings', type: 'depository' },
    ]);
    upsertPlaidTransactions(db, userId, [
      { id: 'tx-f1', accountId: 'acct-tx', amount: 5, date: '2024-01-01', name: 'Checking TX' },
      { id: 'tx-f2', accountId: 'acct-tx2', amount: 10, date: '2024-01-01', name: 'Savings TX' },
    ]);

    const results = getTransactionsByUser(db, userId, { accountIds: ['acct-tx2'] });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('tx-f2');
  });

  test('getTransactionCountByUser returns correct count', () => {
    upsertPlaidTransactions(db, userId, [
      { id: 'tx-c1', accountId: 'acct-tx', amount: 5, date: '2024-01-01', name: 'One' },
      { id: 'tx-c2', accountId: 'acct-tx', amount: 10, date: '2024-01-02', name: 'Two' },
    ]);

    const count = getTransactionCountByUser(db, userId);
    expect(count).toBe(2);
  });

  test('getTransactionCountByUser with filters', () => {
    upsertPlaidTransactions(db, userId, [
      { id: 'tx-cf1', accountId: 'acct-tx', amount: 5, date: '2024-01-01', name: 'One', pending: true },
      { id: 'tx-cf2', accountId: 'acct-tx', amount: 10, date: '2024-01-02', name: 'Two', pending: false },
    ]);

    const count = getTransactionCountByUser(db, userId, { pending: true });
    expect(count).toBe(1);
  });
});

// ─── Sync Jobs ──────────────────────────────────────────────────────────────────

describe('Sync Jobs', () => {
  const userId = 'user-1';

  beforeEach(() => {
    insertPlaidItem(db, { userId, accessToken: 'tok', itemId: 'item-sync' });
  });

  test('createSyncJob creates a running job', () => {
    const job = createSyncJob(db, 'item-sync');
    expect(job.itemId).toBe('item-sync');
    expect(job.status).toBe('running');
    expect(job.startedAt).toBeTruthy();
    expect(job.id).toBeTruthy();
  });

  test('updateSyncJob updates status and counts', () => {
    const job = createSyncJob(db, 'item-sync');
    updateSyncJob(db, job.id, 'completed', { added: 5, modified: 2, removed: 1 });

    const latest = getLatestSyncJob(db, 'item-sync');
    expect(latest!.status).toBe('completed');
    expect(latest!.addedCount).toBe(5);
    expect(latest!.modifiedCount).toBe(2);
    expect(latest!.removedCount).toBe(1);
    expect(latest!.completedAt).toBeTruthy();
  });

  test('updateSyncJob with failed status sets error message', () => {
    const job = createSyncJob(db, 'item-sync');
    updateSyncJob(db, job.id, 'failed', { errorMessage: 'API timeout' });

    const latest = getLatestSyncJob(db, 'item-sync');
    expect(latest!.status).toBe('failed');
    expect(latest!.errorMessage).toBe('API timeout');
    expect(latest!.completedAt).toBeTruthy();
  });

  test('getLatestSyncJob returns null when no jobs exist', () => {
    const latest = getLatestSyncJob(db, 'item-sync');
    expect(latest).toBeNull();
  });

  test('getLatestSyncJob returns a job when multiple exist', () => {
    const first = createSyncJob(db, 'item-sync');
    const second = createSyncJob(db, 'item-sync');

    const latest = getLatestSyncJob(db, 'item-sync');
    expect(latest).not.toBeNull();
    // Should return one of the two jobs
    expect([first.id, second.id]).toContain(latest!.id);
  });

  test('hasPendingSyncJob returns true when running job exists', () => {
    createSyncJob(db, 'item-sync');
    expect(hasPendingSyncJob(db, 'item-sync')).toBe(true);
  });

  test('hasPendingSyncJob returns false when no pending jobs', () => {
    expect(hasPendingSyncJob(db, 'item-sync')).toBe(false);
  });

  test('hasPendingSyncJob returns false after job completes', () => {
    const job = createSyncJob(db, 'item-sync');
    updateSyncJob(db, job.id, 'completed');

    expect(hasPendingSyncJob(db, 'item-sync')).toBe(false);
  });
});
