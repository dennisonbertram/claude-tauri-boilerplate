import { Database, type SQLQueryBindings } from 'bun:sqlite';

// ─── Row Types ──────────────────────────────────────────────────────────────────

interface PlaidLinkSessionRow {
  id: string;
  user_id: string;
  state: string;
  link_token: string;
  status: string;
  hosted_link_url: string | null;
  callback_payload: string | null;
  error_code: string | null;
  error_message: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

interface PlaidItemRow {
  id: string;
  user_id: string;
  access_token: string;
  item_id: string;
  institution_id: string | null;
  institution_name: string | null;
  institution_logo_url: string | null;
  institution_color: string | null;
  consent_expiration: string | null;
  error_code: string | null;
  error_message: string | null;
  sync_cursor: string | null;
  last_synced_at: string | null;
  last_successful_sync_at: string | null;
  last_sync_error: string | null;
  created_at: string;
  updated_at: string;
}

interface PlaidAccountRow {
  id: string;
  item_id: string;
  user_id: string;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  current_balance: number | null;
  available_balance: number | null;
  currency_code: string;
  updated_at: string;
}

interface PlaidTransactionRow {
  id: string;
  account_id: string;
  user_id: string;
  amount: number;
  date: string;
  authorized_date: string | null;
  name: string;
  merchant_name: string | null;
  merchant_entity_id: string | null;
  category: string | null;
  personal_finance_category: string | null;
  pending: number;
  pending_transaction_id: string | null;
  payment_channel: string | null;
  removed: number;
  raw_json: string | null;
  created_at: string;
  updated_at: string;
}

interface PlaidSyncJobRow {
  id: string;
  item_id: string;
  status: string;
  added_count: number;
  modified_count: number;
  removed_count: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// ─── Mappers ────────────────────────────────────────────────────────────────────

export function mapLinkSession(row: PlaidLinkSessionRow) {
  return {
    id: row.id,
    userId: row.user_id,
    state: row.state,
    linkToken: row.link_token,
    status: row.status,
    hostedLinkUrl: row.hosted_link_url,
    callbackPayload: row.callback_payload,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPlaidItem(row: PlaidItemRow) {
  return {
    id: row.id,
    userId: row.user_id,
    accessToken: row.access_token,
    itemId: row.item_id,
    institutionId: row.institution_id,
    institutionName: row.institution_name,
    institutionLogoUrl: row.institution_logo_url,
    institutionColor: row.institution_color,
    consentExpiration: row.consent_expiration,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    syncCursor: row.sync_cursor,
    lastSyncedAt: row.last_synced_at,
    lastSuccessfulSyncAt: row.last_successful_sync_at,
    lastSyncError: row.last_sync_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPlaidAccount(row: PlaidAccountRow) {
  return {
    id: row.id,
    itemId: row.item_id,
    userId: row.user_id,
    name: row.name,
    officialName: row.official_name,
    type: row.type,
    subtype: row.subtype,
    mask: row.mask,
    currentBalance: row.current_balance,
    availableBalance: row.available_balance,
    currencyCode: row.currency_code,
    updatedAt: row.updated_at,
  };
}

export function mapPlaidTransaction(row: PlaidTransactionRow) {
  return {
    id: row.id,
    accountId: row.account_id,
    userId: row.user_id,
    amount: row.amount,
    date: row.date,
    authorizedDate: row.authorized_date,
    name: row.name,
    merchantName: row.merchant_name,
    merchantEntityId: row.merchant_entity_id,
    category: row.category,
    personalFinanceCategory: row.personal_finance_category,
    pending: row.pending === 1,
    pendingTransactionId: row.pending_transaction_id,
    paymentChannel: row.payment_channel,
    removed: row.removed === 1,
    rawJson: row.raw_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSyncJob(row: PlaidSyncJobRow) {
  return {
    id: row.id,
    itemId: row.item_id,
    status: row.status,
    addedCount: row.added_count,
    modifiedCount: row.modified_count,
    removedCount: row.removed_count,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

// ─── Link Sessions ──────────────────────────────────────────────────────────────

export function createLinkSession(
  db: Database,
  params: {
    userId: string;
    state: string;
    linkToken: string;
    hostedLinkUrl?: string;
    expiresAt: string;
  },
) {
  const stmt = db.prepare(`
    INSERT INTO plaid_link_sessions (user_id, state, link_token, hosted_link_url, expires_at)
    VALUES (?, ?, ?, ?, ?)
    RETURNING *
  `);
  const row = stmt.get(
    params.userId,
    params.state,
    params.linkToken,
    params.hostedLinkUrl ?? null,
    params.expiresAt,
  ) as PlaidLinkSessionRow;
  return mapLinkSession(row);
}

export function getLinkSessionByState(db: Database, state: string) {
  const stmt = db.prepare(`
    SELECT * FROM plaid_link_sessions WHERE state = ?
  `);
  const row = stmt.get(state) as PlaidLinkSessionRow | undefined;
  return row ? mapLinkSession(row) : null;
}

export function updateLinkSessionStatus(
  db: Database,
  sessionId: string,
  status: string,
  payload?: { callbackPayload?: string; errorCode?: string; errorMessage?: string },
) {
  const stmt = db.prepare(`
    UPDATE plaid_link_sessions
    SET status = ?,
        callback_payload = COALESCE(?, callback_payload),
        error_code = COALESCE(?, error_code),
        error_message = COALESCE(?, error_message),
        updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(
    status,
    payload?.callbackPayload ?? null,
    payload?.errorCode ?? null,
    payload?.errorMessage ?? null,
    sessionId,
  );
}

export function expireOldLinkSessions(db: Database) {
  const stmt = db.prepare(`
    UPDATE plaid_link_sessions
    SET status = 'expired', updated_at = datetime('now')
    WHERE status IN ('initiated', 'callback_received')
      AND expires_at < datetime('now')
  `);
  return stmt.run();
}

// ─── Items ──────────────────────────────────────────────────────────────────────

export function insertPlaidItem(
  db: Database,
  params: {
    userId: string;
    accessToken: string;
    itemId: string;
    institutionId?: string;
    institutionName?: string;
    institutionLogoUrl?: string;
    institutionColor?: string;
    consentExpiration?: string;
  },
) {
  const stmt = db.prepare(`
    INSERT INTO plaid_items (
      user_id, access_token, item_id, institution_id, institution_name,
      institution_logo_url, institution_color, consent_expiration
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `);
  const row = stmt.get(
    params.userId,
    params.accessToken,
    params.itemId,
    params.institutionId ?? null,
    params.institutionName ?? null,
    params.institutionLogoUrl ?? null,
    params.institutionColor ?? null,
    params.consentExpiration ?? null,
  ) as PlaidItemRow;
  return mapPlaidItem(row);
}

export function getPlaidItemsByUser(db: Database, userId: string) {
  const stmt = db.prepare(`
    SELECT * FROM plaid_items WHERE user_id = ? ORDER BY created_at DESC
  `);
  return (stmt.all(userId) as PlaidItemRow[]).map(mapPlaidItem);
}

export function getPlaidItemByItemId(db: Database, itemId: string, userId: string) {
  const stmt = db.prepare(`
    SELECT * FROM plaid_items WHERE item_id = ? AND user_id = ?
  `);
  const row = stmt.get(itemId, userId) as PlaidItemRow | undefined;
  return row ? mapPlaidItem(row) : null;
}

export function updatePlaidItemError(
  db: Database,
  itemId: string,
  errorCode: string | null,
  errorMessage: string | null,
) {
  const stmt = db.prepare(`
    UPDATE plaid_items
    SET error_code = ?, error_message = ?, updated_at = datetime('now')
    WHERE item_id = ?
  `);
  stmt.run(errorCode, errorMessage, itemId);
}

export function updatePlaidItemSyncCursor(
  db: Database,
  itemId: string,
  cursor: string,
  syncTimestamp: string,
) {
  const stmt = db.prepare(`
    UPDATE plaid_items
    SET sync_cursor = ?,
        last_synced_at = ?,
        last_successful_sync_at = ?,
        last_sync_error = NULL,
        updated_at = datetime('now')
    WHERE item_id = ?
  `);
  stmt.run(cursor, syncTimestamp, syncTimestamp, itemId);
}

export function deletePlaidItem(db: Database, itemId: string, userId: string) {
  const stmt = db.prepare(`
    DELETE FROM plaid_items WHERE item_id = ? AND user_id = ?
  `);
  return stmt.run(itemId, userId);
}

// ─── Accounts ───────────────────────────────────────────────────────────────────

export function upsertPlaidAccounts(
  db: Database,
  userId: string,
  accounts: Array<{
    id: string;
    itemId: string;
    name: string;
    officialName?: string;
    type: string;
    subtype?: string;
    mask?: string;
    currentBalance?: number;
    availableBalance?: number;
    currencyCode?: string;
  }>,
) {
  const stmt = db.prepare(`
    INSERT INTO plaid_accounts (
      id, item_id, user_id, name, official_name, type, subtype,
      mask, current_balance, available_balance, currency_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      official_name = excluded.official_name,
      type = excluded.type,
      subtype = excluded.subtype,
      mask = excluded.mask,
      current_balance = excluded.current_balance,
      available_balance = excluded.available_balance,
      currency_code = excluded.currency_code,
      updated_at = datetime('now')
  `);

  const upsertMany = db.transaction((accts: typeof accounts) => {
    for (const a of accts) {
      stmt.run(
        a.id,
        a.itemId,
        userId,
        a.name,
        a.officialName ?? null,
        a.type,
        a.subtype ?? null,
        a.mask ?? null,
        a.currentBalance ?? null,
        a.availableBalance ?? null,
        a.currencyCode ?? 'USD',
      );
    }
  });

  upsertMany(accounts);
}

export function getAccountsByUser(
  db: Database,
  userId: string,
  filters?: { itemId?: string; type?: string },
) {
  let query = 'SELECT * FROM plaid_accounts WHERE user_id = ?';
  const params: SQLQueryBindings[] = [userId];

  if (filters?.itemId) {
    query += ' AND item_id = ?';
    params.push(filters.itemId);
  }
  if (filters?.type) {
    query += ' AND type = ?';
    params.push(filters.type);
  }

  query += ' ORDER BY name ASC';

  const stmt = db.prepare(query);
  return (stmt.all(...params) as PlaidAccountRow[]).map(mapPlaidAccount);
}

export function getAccountsByItemId(db: Database, itemId: string, userId: string) {
  const stmt = db.prepare(`
    SELECT * FROM plaid_accounts WHERE item_id = ? AND user_id = ? ORDER BY name ASC
  `);
  return (stmt.all(itemId, userId) as PlaidAccountRow[]).map(mapPlaidAccount);
}

// ─── Transactions ───────────────────────────────────────────────────────────────

export function upsertPlaidTransactions(
  db: Database,
  userId: string,
  transactions: Array<{
    id: string;
    accountId: string;
    amount: number;
    date: string;
    authorizedDate?: string;
    name: string;
    merchantName?: string;
    merchantEntityId?: string;
    category?: string;
    personalFinanceCategory?: string;
    pending?: boolean;
    pendingTransactionId?: string;
    paymentChannel?: string;
    rawJson?: string;
  }>,
) {
  const stmt = db.prepare(`
    INSERT INTO plaid_transactions (
      id, account_id, user_id, amount, date, authorized_date, name,
      merchant_name, merchant_entity_id, category, personal_finance_category,
      pending, pending_transaction_id, payment_channel, raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      amount = excluded.amount,
      date = excluded.date,
      authorized_date = excluded.authorized_date,
      name = excluded.name,
      merchant_name = excluded.merchant_name,
      merchant_entity_id = excluded.merchant_entity_id,
      category = excluded.category,
      personal_finance_category = excluded.personal_finance_category,
      pending = excluded.pending,
      pending_transaction_id = excluded.pending_transaction_id,
      payment_channel = excluded.payment_channel,
      raw_json = excluded.raw_json,
      removed = 0,
      updated_at = datetime('now')
  `);

  const upsertMany = db.transaction((txns: typeof transactions) => {
    for (const t of txns) {
      stmt.run(
        t.id,
        t.accountId,
        userId,
        t.amount,
        t.date,
        t.authorizedDate ?? null,
        t.name,
        t.merchantName ?? null,
        t.merchantEntityId ?? null,
        t.category ?? null,
        t.personalFinanceCategory ?? null,
        t.pending ? 1 : 0,
        t.pendingTransactionId ?? null,
        t.paymentChannel ?? null,
        t.rawJson ?? null,
      );
    }
  });

  upsertMany(transactions);
}

export function markTransactionsRemoved(db: Database, transactionIds: string[]) {
  if (transactionIds.length === 0) return;

  const placeholders = transactionIds.map(() => '?').join(',');
  const stmt = db.prepare(`
    UPDATE plaid_transactions
    SET removed = 1, updated_at = datetime('now')
    WHERE id IN (${placeholders})
  `);
  stmt.run(...transactionIds);
}

export function getTransactionsByAccount(
  db: Database,
  accountId: string,
  userId: string,
  options?: { startDate?: string; endDate?: string; limit?: number; offset?: number },
) {
  let query = 'SELECT * FROM plaid_transactions WHERE account_id = ? AND user_id = ? AND removed = 0';
  const params: SQLQueryBindings[] = [accountId, userId];

  if (options?.startDate) {
    query += ' AND date >= ?';
    params.push(options.startDate);
  }
  if (options?.endDate) {
    query += ' AND date <= ?';
    params.push(options.endDate);
  }

  query += ' ORDER BY date DESC';

  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }
  if (options?.offset) {
    query += ' OFFSET ?';
    params.push(options.offset);
  }

  const stmt = db.prepare(query);
  return (stmt.all(...params) as PlaidTransactionRow[]).map(mapPlaidTransaction);
}

export type TransactionFilters = {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  accountIds?: string[];
  pending?: boolean;
  search?: string;
  merchantName?: string;
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  sort?: 'date_asc' | 'date_desc' | 'amount_asc' | 'amount_desc';
};

export function getTransactionsByUser(
  db: Database,
  userId: string,
  filters?: TransactionFilters,
) {
  let query = 'SELECT * FROM plaid_transactions WHERE user_id = ? AND removed = 0';
  const params: SQLQueryBindings[] = [userId];

  if (filters?.startDate) {
    query += ' AND date >= ?';
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    query += ' AND date <= ?';
    params.push(filters.endDate);
  }
  if (filters?.accountIds && filters.accountIds.length > 0) {
    const placeholders = filters.accountIds.map(() => '?').join(',');
    query += ` AND account_id IN (${placeholders})`;
    params.push(...filters.accountIds);
  }
  if (filters?.pending !== undefined) {
    query += ' AND pending = ?';
    params.push(filters.pending ? 1 : 0);
  }
  if (filters?.search) {
    query += ' AND (name LIKE ? OR merchant_name LIKE ?)';
    const pattern = `%${filters.search}%`;
    params.push(pattern, pattern);
  }
  if (filters?.merchantName) {
    query += ' AND merchant_name = ?';
    params.push(filters.merchantName);
  }
  if (filters?.category) {
    query += ' AND category LIKE ?';
    params.push(`%${filters.category}%`);
  }
  if (filters?.minAmount !== undefined) {
    query += ' AND amount >= ?';
    params.push(filters.minAmount);
  }
  if (filters?.maxAmount !== undefined) {
    query += ' AND amount <= ?';
    params.push(filters.maxAmount);
  }

  // Sorting
  const sortMap: Record<string, string> = {
    date_asc: 'date ASC',
    date_desc: 'date DESC',
    amount_asc: 'amount ASC',
    amount_desc: 'amount DESC',
  };
  const orderBy = sortMap[filters?.sort ?? 'date_desc'] ?? 'date DESC';
  query += ` ORDER BY ${orderBy}`;

  if (filters?.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }
  if (filters?.offset) {
    query += ' OFFSET ?';
    params.push(filters.offset);
  }

  const stmt = db.prepare(query);
  return (stmt.all(...params) as PlaidTransactionRow[]).map(mapPlaidTransaction);
}

export function getTransactionCountByUser(
  db: Database,
  userId: string,
  filters?: Omit<TransactionFilters, 'limit' | 'offset' | 'sort'>,
) {
  let query = 'SELECT COUNT(*) as count FROM plaid_transactions WHERE user_id = ? AND removed = 0';
  const params: SQLQueryBindings[] = [userId];

  if (filters?.startDate) {
    query += ' AND date >= ?';
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    query += ' AND date <= ?';
    params.push(filters.endDate);
  }
  if (filters?.accountIds && filters.accountIds.length > 0) {
    const placeholders = filters.accountIds.map(() => '?').join(',');
    query += ` AND account_id IN (${placeholders})`;
    params.push(...filters.accountIds);
  }
  if (filters?.pending !== undefined) {
    query += ' AND pending = ?';
    params.push(filters.pending ? 1 : 0);
  }
  if (filters?.search) {
    query += ' AND (name LIKE ? OR merchant_name LIKE ?)';
    const pattern = `%${filters.search}%`;
    params.push(pattern, pattern);
  }
  if (filters?.merchantName) {
    query += ' AND merchant_name = ?';
    params.push(filters.merchantName);
  }
  if (filters?.category) {
    query += ' AND category LIKE ?';
    params.push(`%${filters.category}%`);
  }
  if (filters?.minAmount !== undefined) {
    query += ' AND amount >= ?';
    params.push(filters.minAmount);
  }
  if (filters?.maxAmount !== undefined) {
    query += ' AND amount <= ?';
    params.push(filters.maxAmount);
  }

  const stmt = db.prepare(query);
  const row = stmt.get(...params) as { count: number };
  return row.count;
}

// ─── Sync Jobs ──────────────────────────────────────────────────────────────────

export function createSyncJob(db: Database, itemId: string) {
  const stmt = db.prepare(`
    INSERT INTO plaid_sync_jobs (item_id, status, started_at)
    VALUES (?, 'running', datetime('now'))
    RETURNING *
  `);
  const row = stmt.get(itemId) as PlaidSyncJobRow;
  return mapSyncJob(row);
}

export function updateSyncJob(
  db: Database,
  jobId: string,
  status: string,
  counts?: { added?: number; modified?: number; removed?: number; errorMessage?: string },
) {
  const stmt = db.prepare(`
    UPDATE plaid_sync_jobs
    SET status = ?,
        added_count = COALESCE(?, added_count),
        modified_count = COALESCE(?, modified_count),
        removed_count = COALESCE(?, removed_count),
        error_message = COALESCE(?, error_message),
        completed_at = CASE WHEN ? IN ('completed', 'failed') THEN datetime('now') ELSE completed_at END
    WHERE id = ?
  `);
  stmt.run(
    status,
    counts?.added ?? null,
    counts?.modified ?? null,
    counts?.removed ?? null,
    counts?.errorMessage ?? null,
    status,
    jobId,
  );
}

export function getLatestSyncJob(db: Database, itemId: string) {
  const stmt = db.prepare(`
    SELECT * FROM plaid_sync_jobs
    WHERE item_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const row = stmt.get(itemId) as PlaidSyncJobRow | undefined;
  return row ? mapSyncJob(row) : null;
}

export function hasPendingSyncJob(db: Database, itemId: string): boolean {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM plaid_sync_jobs
    WHERE item_id = ? AND status IN ('pending', 'running')
  `);
  const row = stmt.get(itemId) as { count: number };
  return row.count > 0;
}
