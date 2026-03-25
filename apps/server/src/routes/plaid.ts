import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { z } from 'zod';
import { PlaidApi, CountryCode, Products } from 'plaid';
import {
  createLinkSession,
  getLinkSessionByState,
  updateLinkSessionStatus,
  insertPlaidItem,
  getPlaidItemsByUser,
  getPlaidItemByItemId,
  updatePlaidItemError,
  updatePlaidItemSyncCursor,
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
} from '../db/db-plaid';
import { encrypt, decrypt } from '../services/plaid-encryption';
import { plaidRedaction } from '../middleware/plaid-redaction';

// ─── Constants ──────────────────────────────────────────────────────────────────

/** Single-user desktop app — use a deterministic user ID for all Plaid data. */
const DEFAULT_USER_ID = 'local-user';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const LINK_SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─── Validation Schemas ─────────────────────────────────────────────────────────

const linkStartSchema = z.object({
  /** Optional: products to request (defaults to transactions) */
  products: z.array(z.string()).optional(),
});

const linkFinalizeSchema = z.object({
  state: z.string().min(1, 'state is required'),
  public_token: z.string().min(1, 'public_token is required'),
});

const syncSchema = z.object({
  itemId: z.string().min(1, 'itemId is required'),
});

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// ─── Helpers ────────────────────────────────────────────────────────────────────

function validationError(parsed: z.SafeParseError<unknown>) {
  const err = new Error('Invalid data');
  (err as any).status = 400;
  (err as any).code = 'VALIDATION_ERROR';
  (err as any).details = parsed.error.flatten();
  throw err;
}

function plaidApiError(message: string, status: number, code: string) {
  const err = new Error(message);
  (err as any).status = status;
  (err as any).code = code;
  throw err;
}

function paginated<T>(items: T[], total: number, limit: number, offset: number) {
  return {
    items,
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  };
}

/**
 * Run a full cursor-based transaction sync for a single Plaid item.
 * Called internally by POST /sync and after link finalization.
 */
async function runTransactionSync(
  db: Database,
  plaidClient: PlaidApi,
  itemId: string,
  userId: string,
) {
  const item = getPlaidItemByItemId(db, itemId, userId);
  if (!item) return;

  // Prevent duplicate syncs
  if (hasPendingSyncJob(db, itemId)) {
    return { status: 'already_syncing' as const };
  }

  const job = createSyncJob(db, itemId);
  let added = 0;
  let modified = 0;
  let removed = 0;

  try {
    let hasMore = true;
    const accessToken = decrypt(item.accessToken);

    while (hasMore) {
      // Re-read item each loop iteration to get the latest cursor
      const currentItem = getPlaidItemByItemId(db, itemId, userId);
      const cursor = currentItem?.syncCursor || undefined;

      const response = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor,
      });

      const data = response.data;

      // Upsert added + modified transactions
      const toUpsert = [
        ...data.added.map((t) => ({
          id: t.transaction_id,
          accountId: t.account_id,
          amount: t.amount,
          date: t.date,
          authorizedDate: t.authorized_date ?? undefined,
          name: t.name,
          merchantName: t.merchant_name ?? undefined,
          merchantEntityId: t.merchant_entity_id ?? undefined,
          category: t.category ? JSON.stringify(t.category) : undefined,
          personalFinanceCategory: t.personal_finance_category?.primary ?? undefined,
          pending: t.pending,
          pendingTransactionId: t.pending_transaction_id ?? undefined,
          paymentChannel: t.payment_channel ?? undefined,
          rawJson: JSON.stringify(t),
        })),
        ...data.modified.map((t) => ({
          id: t.transaction_id,
          accountId: t.account_id,
          amount: t.amount,
          date: t.date,
          authorizedDate: t.authorized_date ?? undefined,
          name: t.name,
          merchantName: t.merchant_name ?? undefined,
          merchantEntityId: t.merchant_entity_id ?? undefined,
          category: t.category ? JSON.stringify(t.category) : undefined,
          personalFinanceCategory: t.personal_finance_category?.primary ?? undefined,
          pending: t.pending,
          pendingTransactionId: t.pending_transaction_id ?? undefined,
          paymentChannel: t.payment_channel ?? undefined,
          rawJson: JSON.stringify(t),
        })),
      ];

      if (toUpsert.length > 0) {
        upsertPlaidTransactions(db, userId, toUpsert);
      }

      added += data.added.length;
      modified += data.modified.length;

      // Soft-delete removed transactions
      const removedIds = data.removed.map((t) => t.transaction_id);
      if (removedIds.length > 0) {
        markTransactionsRemoved(db, removedIds);
      }
      removed += removedIds.length;

      // Advance cursor
      updatePlaidItemSyncCursor(db, itemId, data.next_cursor, new Date().toISOString());
      hasMore = data.has_more;
    }

    updateSyncJob(db, job.id, 'completed', { added, modified, removed });
    return { status: 'completed' as const, added, modified, removed };
  } catch (syncErr) {
    const message = syncErr instanceof Error ? syncErr.message : 'Unknown sync error';
    updateSyncJob(db, job.id, 'failed', { errorMessage: message });
    console.error('Transaction sync failed:', message);
    return { status: 'failed' as const, error: message };
  }
}

// ─── Router ─────────────────────────────────────────────────────────────────────

export function createPlaidRouter(db: Database, plaidClient: PlaidApi) {
  const router = new Hono();

  // Apply log redaction to all Plaid routes
  router.use('*', plaidRedaction());

  const userId = DEFAULT_USER_ID;

  // ── Link: Start ─────────────────────────────────────────────────────────────

  // POST /link/start — Create link token + link session with state nonce
  router.post('/link/start', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = linkStartSchema.safeParse(body);
    if (!parsed.success) validationError(parsed);

    const state = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + LINK_SESSION_TTL_MS).toISOString();

    try {
      const response = await plaidClient.linkTokenCreate({
        user: { client_user_id: userId },
        client_name: 'Claude Tauri',
        products: (parsed.data!.products ?? ['transactions']) as Products[],
        country_codes: [CountryCode.Us],
        language: 'en',
        hosted_link: {
          delivery_method: 'DELIVERY_METHOD_HOSTED' as any,
          url_lifetime_seconds: 600,
          completion_redirect_uri: `claudetauri://plaid-callback?state=${state}`,
        },
      });

      const data = response.data;
      const session = createLinkSession(db, {
        userId,
        state,
        linkToken: data.link_token,
        hostedLinkUrl: data.hosted_link_url ?? undefined,
        expiresAt,
      });

      return c.json({
        hosted_link_url: data.hosted_link_url,
        session_id: session.id,
        state,
      });
    } catch (err: any) {
      const plaidErr = err?.response?.data;
      console.error('Plaid linkTokenCreate failed:', plaidErr || err);
      plaidApiError(
        plaidErr?.error_message || 'Failed to create link token',
        plaidErr?.status_code || 502,
        plaidErr?.error_code || 'PLAID_ERROR',
      );
    }
  });

  // ── Link: Finalize ──────────────────────────────────────────────────────────

  // POST /link/finalize — Exchange token with state validation + anti-replay
  router.post('/link/finalize', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = linkFinalizeSchema.safeParse(body);
    if (!parsed.success) validationError(parsed);

    const { state, public_token } = parsed.data!;

    // 1. Validate state matches a pending session owned by this user
    const session = getLinkSessionByState(db, state);
    if (!session) {
      return c.json({ error: 'Invalid or expired link session', code: 'INVALID_SESSION' }, 400);
    }
    if (session.userId !== userId) {
      // Return 404 to prevent enumeration
      return c.json({ error: 'Invalid or expired link session', code: 'INVALID_SESSION' }, 404);
    }
    if (session.status !== 'initiated' && session.status !== 'callback_received') {
      return c.json({ error: 'Session already finalized', code: 'SESSION_ALREADY_FINALIZED' }, 409);
    }
    if (new Date(session.expiresAt) < new Date()) {
      updateLinkSessionStatus(db, session.id, 'expired');
      return c.json({ error: 'Link session expired. Please try again.', code: 'SESSION_EXPIRED' }, 410);
    }

    try {
      // 2. Exchange public_token → access_token
      const exchangeResponse = await plaidClient.itemPublicTokenExchange({
        public_token,
      });
      const { access_token, item_id } = exchangeResponse.data;

      // 3. Check for duplicate item
      const existing = getPlaidItemByItemId(db, item_id, userId);
      if (existing) {
        updateLinkSessionStatus(db, session.id, 'failed', {
          errorCode: 'DUPLICATE_ITEM',
          errorMessage: 'This institution is already connected',
        });
        return c.json({ error: 'This institution is already connected', code: 'DUPLICATE_ITEM' }, 409);
      }

      // 4. Get institution info
      let institutionName: string | undefined;
      let institutionId: string | undefined;
      let institutionLogoUrl: string | undefined;
      let institutionColor: string | undefined;

      try {
        const itemResponse = await plaidClient.itemGet({ access_token });
        const itemData = itemResponse.data.item;
        institutionId = itemData.institution_id ?? undefined;

        if (institutionId) {
          const instResponse = await plaidClient.institutionsGetById({
            institution_id: institutionId,
            country_codes: [CountryCode.Us],
          });
          const inst = instResponse.data.institution;
          institutionName = inst.name;
          institutionLogoUrl = inst.logo ?? undefined;
          institutionColor = inst.primary_color ?? undefined;
        }
      } catch {
        // Non-fatal — institution info is nice-to-have
        console.warn('Failed to fetch institution details for item', item_id);
      }

      // 5. Encrypt and store
      const encryptedToken = encrypt(access_token);
      const newItem = insertPlaidItem(db, {
        userId,
        accessToken: encryptedToken,
        itemId: item_id,
        institutionId,
        institutionName,
        institutionLogoUrl,
        institutionColor,
      });

      // 6. Mark session finalized
      updateLinkSessionStatus(db, session.id, 'finalized');

      // 7. Fetch initial accounts
      try {
        const accountsResponse = await plaidClient.accountsGet({ access_token });
        const accounts = accountsResponse.data.accounts.map((a) => ({
          id: a.account_id,
          itemId: item_id,
          name: a.name,
          officialName: a.official_name ?? undefined,
          type: a.type,
          subtype: a.subtype ?? undefined,
          mask: a.mask ?? undefined,
          currentBalance: a.balances.current ?? undefined,
          availableBalance: a.balances.available ?? undefined,
          currencyCode: a.balances.iso_currency_code ?? 'USD',
        }));
        upsertPlaidAccounts(db, userId, accounts);
      } catch {
        console.warn('Failed to fetch initial accounts for item', item_id);
      }

      // 8. Trigger initial sync (non-blocking)
      runTransactionSync(db, plaidClient, item_id, userId).catch((err) => {
        console.error('Initial transaction sync failed:', err);
      });

      // Return the item (without access token)
      return c.json({
        item: {
          id: newItem.id,
          itemId: newItem.itemId,
          institutionId: newItem.institutionId,
          institutionName: newItem.institutionName,
          institutionLogoUrl: newItem.institutionLogoUrl,
          institutionColor: newItem.institutionColor,
          createdAt: newItem.createdAt,
        },
      });
    } catch (err: any) {
      const plaidErr = err?.response?.data;
      console.error('Plaid token exchange failed:', plaidErr || err);

      updateLinkSessionStatus(db, session.id, 'failed', {
        errorCode: plaidErr?.error_code || 'EXCHANGE_FAILED',
        errorMessage: plaidErr?.error_message || 'Failed to exchange token',
      });

      plaidApiError(
        plaidErr?.error_message || 'Failed to exchange public token',
        plaidErr?.status_code || 502,
        plaidErr?.error_code || 'PLAID_ERROR',
      );
    }
  });

  // ── Link: Session Status ────────────────────────────────────────────────────

  // GET /link/session/:id/status — Poll session status (deep-link fallback)
  router.get('/link/session/:id/status', async (c) => {
    const sessionId = c.req.param('id');

    // We look up by session ID — getLinkSessionByState won't work here.
    // Use a direct DB query since db-plaid doesn't expose getById.
    const stmt = db.prepare('SELECT * FROM plaid_link_sessions WHERE id = ? AND user_id = ?');
    const row = stmt.get(sessionId, userId) as any;
    if (!row) {
      return c.json({ error: 'Session not found', code: 'NOT_FOUND' }, 404);
    }

    return c.json({
      id: row.id,
      status: row.status,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    });
  });

  // ── Items ───────────────────────────────────────────────────────────────────

  // GET /items — List user's connected institutions
  router.get('/items', async (c) => {
    const items = getPlaidItemsByUser(db, userId);
    // Strip access tokens from response
    const safeItems = items.map(({ accessToken, ...rest }) => rest);
    return c.json(safeItems);
  });

  // GET /items/:itemId/status — Detailed item health
  router.get('/items/:itemId/status', async (c) => {
    const itemId = c.req.param('itemId');
    const item = getPlaidItemByItemId(db, itemId, userId);
    if (!item) {
      return c.json({ error: 'Item not found', code: 'NOT_FOUND' }, 404);
    }

    const latestSync = getLatestSyncJob(db, itemId);
    const accounts = getAccountsByItemId(db, itemId, userId);

    // Determine health status
    let health: string = 'healthy';
    if (item.errorCode) {
      health = item.errorCode === 'ITEM_LOGIN_REQUIRED' ? 'reauth_required' : 'error';
    } else if (
      item.consentExpiration &&
      new Date(item.consentExpiration).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
    ) {
      health = 'consent_expiring';
    }

    return c.json({
      id: item.id,
      itemId: item.itemId,
      institutionId: item.institutionId,
      institutionName: item.institutionName,
      institutionLogoUrl: item.institutionLogoUrl,
      institutionColor: item.institutionColor,
      health,
      error: item.errorCode ? { code: item.errorCode, message: item.errorMessage } : null,
      consentExpiration: item.consentExpiration,
      lastSyncedAt: item.lastSyncedAt,
      lastSuccessfulSyncAt: item.lastSuccessfulSyncAt,
      lastSyncError: item.lastSyncError,
      latestSync: latestSync
        ? {
            status: latestSync.status,
            addedCount: latestSync.addedCount,
            modifiedCount: latestSync.modifiedCount,
            removedCount: latestSync.removedCount,
            completedAt: latestSync.completedAt,
          }
        : null,
      accountCount: accounts.length,
      createdAt: item.createdAt,
    });
  });

  // POST /items/:itemId/reauth — Update-mode link token for broken connections
  router.post('/items/:itemId/reauth', async (c) => {
    const itemId = c.req.param('itemId');
    const item = getPlaidItemByItemId(db, itemId, userId);
    if (!item) {
      return c.json({ error: 'Item not found', code: 'NOT_FOUND' }, 404);
    }

    const state = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + LINK_SESSION_TTL_MS).toISOString();

    try {
      const accessToken = decrypt(item.accessToken);
      const response = await plaidClient.linkTokenCreate({
        user: { client_user_id: userId },
        client_name: 'Claude Tauri',
        access_token: accessToken, // update mode — uses existing access_token
        country_codes: [CountryCode.Us],
        language: 'en',
        hosted_link: {
          delivery_method: 'DELIVERY_METHOD_HOSTED' as any,
          url_lifetime_seconds: 600,
          completion_redirect_uri: `claudetauri://plaid-callback?state=${state}`,
        },
      });

      const data = response.data;
      const session = createLinkSession(db, {
        userId,
        state,
        linkToken: data.link_token,
        hostedLinkUrl: data.hosted_link_url ?? undefined,
        expiresAt,
      });

      return c.json({
        hosted_link_url: data.hosted_link_url,
        session_id: session.id,
        state,
      });
    } catch (err: any) {
      const plaidErr = err?.response?.data;
      console.error('Plaid reauth linkTokenCreate failed:', plaidErr || err);
      plaidApiError(
        plaidErr?.error_message || 'Failed to create reauth link token',
        plaidErr?.status_code || 502,
        plaidErr?.error_code || 'PLAID_ERROR',
      );
    }
  });

  // DELETE /items/:itemId — Call Plaid /item/remove + delete locally
  router.delete('/items/:itemId', async (c) => {
    const itemId = c.req.param('itemId');
    const item = getPlaidItemByItemId(db, itemId, userId);
    if (!item) {
      return c.json({ error: 'Item not found', code: 'NOT_FOUND' }, 404);
    }

    // 1. Remove from Plaid first
    try {
      const accessToken = decrypt(item.accessToken);
      await plaidClient.itemRemove({ access_token: accessToken });
    } catch (err: any) {
      // Log but continue — item may already be removed on Plaid's side
      console.warn('Plaid item/remove failed, continuing local cleanup:', err?.message);
    }

    // 2. Delete locally (cascades to accounts + transactions via FK)
    deletePlaidItem(db, itemId, userId);
    return c.json({ ok: true });
  });

  // ── Accounts ────────────────────────────────────────────────────────────────

  // GET /accounts — List accounts (filterable by itemId, type)
  router.get('/accounts', async (c) => {
    const itemId = c.req.query('itemId') || undefined;
    const type = c.req.query('type') || undefined;

    // If itemId provided, verify ownership
    if (itemId) {
      const item = getPlaidItemByItemId(db, itemId, userId);
      if (!item) {
        return c.json({ error: 'Item not found', code: 'NOT_FOUND' }, 404);
      }
    }

    const accounts = getAccountsByUser(db, userId, { itemId, type });
    return c.json(accounts);
  });

  // POST /accounts/refresh-balances — Refresh balances for all items
  router.post('/accounts/refresh-balances', async (c) => {
    const items = getPlaidItemsByUser(db, userId);
    if (items.length === 0) {
      return c.json({ refreshed: 0 });
    }

    let refreshed = 0;
    const errors: Array<{ itemId: string; error: string }> = [];

    for (const item of items) {
      try {
        const accessToken = decrypt(item.accessToken);
        const response = await plaidClient.accountsGet({ access_token: accessToken });
        const accounts = response.data.accounts.map((a) => ({
          id: a.account_id,
          itemId: item.itemId,
          name: a.name,
          officialName: a.official_name ?? undefined,
          type: a.type,
          subtype: a.subtype ?? undefined,
          mask: a.mask ?? undefined,
          currentBalance: a.balances.current ?? undefined,
          availableBalance: a.balances.available ?? undefined,
          currencyCode: a.balances.iso_currency_code ?? 'USD',
        }));
        upsertPlaidAccounts(db, userId, accounts);

        // Clear any error state on successful refresh
        if (item.errorCode) {
          updatePlaidItemError(db, item.itemId, null, null);
        }
        refreshed++;
      } catch (err: any) {
        const plaidErr = err?.response?.data;
        const errorCode = plaidErr?.error_code || 'REFRESH_FAILED';
        const errorMessage = plaidErr?.error_message || err?.message || 'Unknown error';
        console.warn(`Balance refresh failed for item ${item.itemId}:`, errorMessage);
        errors.push({ itemId: item.itemId, error: errorMessage });

        // Update item error state if Plaid reports an error
        if (plaidErr?.error_code) {
          updatePlaidItemError(db, item.itemId, plaidErr.error_code, plaidErr.error_message);
        }
      }
    }

    return c.json({ refreshed, errors: errors.length > 0 ? errors : undefined });
  });

  // ── Transactions ────────────────────────────────────────────────────────────

  // GET /transactions — All transactions with pagination + filters
  router.get('/transactions', async (c) => {
    const limit = Math.min(
      Math.max(parseInt(c.req.query('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const offset = Math.max(parseInt(c.req.query('offset') || '0', 10) || 0, 0);

    const filters = {
      startDate: c.req.query('startDate') || undefined,
      endDate: c.req.query('endDate') || undefined,
      accountIds: c.req.query('accountIds')?.split(',').filter(Boolean) || undefined,
      pending: c.req.query('pending') !== undefined ? c.req.query('pending') === 'true' : undefined,
      search: c.req.query('search') || undefined,
      category: c.req.query('category') || undefined,
      minAmount:
        c.req.query('minAmount') !== undefined
          ? parseFloat(c.req.query('minAmount')!)
          : undefined,
      maxAmount:
        c.req.query('maxAmount') !== undefined
          ? parseFloat(c.req.query('maxAmount')!)
          : undefined,
      sort: (c.req.query('sort') as any) || undefined,
      limit,
      offset,
    };

    const transactions = getTransactionsByUser(db, userId, filters);
    const total = getTransactionCountByUser(db, userId, filters);

    return c.json(paginated(transactions, total, limit, offset));
  });

  // GET /accounts/:accountId/transactions — Transactions for one account
  router.get('/accounts/:accountId/transactions', async (c) => {
    const accountId = c.req.param('accountId');

    // Verify account ownership by checking user_id on the account
    const accounts = getAccountsByUser(db, userId, {});
    const account = accounts.find((a) => a.id === accountId);
    if (!account) {
      return c.json({ error: 'Account not found', code: 'NOT_FOUND' }, 404);
    }

    const limit = Math.min(
      Math.max(parseInt(c.req.query('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const offset = Math.max(parseInt(c.req.query('offset') || '0', 10) || 0, 0);
    const startDate = c.req.query('startDate') || undefined;
    const endDate = c.req.query('endDate') || undefined;

    const transactions = getTransactionsByAccount(db, accountId, userId, {
      startDate,
      endDate,
      limit,
      offset,
    });

    // Get total count for this account
    const countStmt = db.prepare(
      'SELECT COUNT(*) as count FROM plaid_transactions WHERE account_id = ? AND user_id = ? AND removed = 0',
    );
    const { count: total } = countStmt.get(accountId, userId) as { count: number };

    return c.json(paginated(transactions, total, limit, offset));
  });

  // ── Sync ────────────────────────────────────────────────────────────────────

  // POST /sync — Trigger transaction sync (idempotent)
  router.post('/sync', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = syncSchema.safeParse(body);
    if (!parsed.success) validationError(parsed);

    const { itemId } = parsed.data!;

    // Verify ownership
    const item = getPlaidItemByItemId(db, itemId, userId);
    if (!item) {
      return c.json({ error: 'Item not found', code: 'NOT_FOUND' }, 404);
    }

    // Check for already running sync
    if (hasPendingSyncJob(db, itemId)) {
      return c.json({ status: 'already_syncing' });
    }

    const result = await runTransactionSync(db, plaidClient, itemId, userId);
    return c.json(result);
  });

  // GET /sync/status — Latest sync job status per item
  router.get('/sync/status', async (c) => {
    const items = getPlaidItemsByUser(db, userId);
    const statuses = items.map((item) => {
      const latestJob = getLatestSyncJob(db, item.itemId);
      return {
        itemId: item.itemId,
        institutionName: item.institutionName,
        status: latestJob?.status ?? 'never_synced',
        addedCount: latestJob?.addedCount ?? 0,
        modifiedCount: latestJob?.modifiedCount ?? 0,
        removedCount: latestJob?.removedCount ?? 0,
        lastSyncedAt: item.lastSyncedAt,
        error: latestJob?.errorMessage ?? undefined,
        completedAt: latestJob?.completedAt ?? undefined,
      };
    });

    return c.json(statuses);
  });

  return router;
}
