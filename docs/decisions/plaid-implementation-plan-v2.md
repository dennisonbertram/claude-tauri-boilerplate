# Plaid Integration — Implementation Plan v2

> Revised based on GPT-5.4 review. Changes from v1 marked with **[NEW]** or **[REVISED]**.

## Overview

Add Plaid financial data integration to the Claude Tauri Boilerplate app, enabling users to connect bank accounts and view transactions, balances, and account details. Uses Plaid's **Hosted Link** flow (browser-based auth) with a **custom URI scheme** redirect back to the Tauri app, and a **server-mediated finalization flow** for security and reliability.

---

## Architecture

**[REVISED]** — Server-mediated finalization replaces direct public_token passing.

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────┐
│  Tauri Desktop   │──────▶│  Bun/Hono Server │──────▶│  Plaid API  │
│  (React 19)      │◀──────│  (localhost)      │◀──────│             │
└────────┬─────────┘       └──────────────────┘       └─────────────┘
         │
         │  LINK INITIATION:
         │  1. User clicks "Connect Bank"
         │  2. Frontend calls POST /api/plaid/link/start
         │  3. Server creates link_token + link_session row (with state nonce)
         │  4. Server returns { hosted_link_url, session_id, state }
         │  5. Frontend opens hosted_link_url in system browser
         │
         │  BANK AUTH (in browser):
         │  6. User authenticates at their bank via Plaid
         │  7. Plaid redirects to claudetauri://plaid-callback?state=...&public_token=...
         │
         │  FINALIZATION (server-mediated):
         │  8. Tauri intercepts deep link, extracts state + public_token
         │  9. Frontend calls POST /api/plaid/link/finalize { state, public_token }
         │ 10. Server validates: state matches pending session, session not expired,
         │     user matches, session not already finalized
         │ 11. Server exchanges public_token → access_token via Plaid SDK
         │ 12. Server encrypts access_token, stores plaid_item
         │ 13. Server triggers initial account + transaction sync
         │ 14. Server marks session as "finalized", returns item summary
         │
         │  FALLBACK (deep-link failure):
         │ 15. If deep link fails (app not running, etc.), Plaid shows fallback page
         │     instructing user to return to app and click "Complete Connection"
         │ 16. Frontend polls GET /api/plaid/link/session/:id/status
         │     or user manually triggers finalization
         └───────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Server-Side Plaid Foundation

### 1.1 Add Plaid SDK dependency

- Add `plaid` npm package to `apps/server/package.json`
- Run `./init.sh` to install

### 1.2 Database schema

New migration in `apps/server/src/db/migrations.ts`:

```sql
-- [NEW] Link sessions for state correlation and replay protection
CREATE TABLE IF NOT EXISTS plaid_link_sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  state TEXT NOT NULL UNIQUE,            -- CSRF nonce, correlates initiation ↔ callback
  link_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'initiated', -- initiated | callback_received | finalized | failed | expired | abandoned
  hosted_link_url TEXT,
  callback_payload TEXT,                 -- raw callback data for debugging
  error_code TEXT,
  error_message TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_plaid_link_sessions_user ON plaid_link_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_link_sessions_state ON plaid_link_sessions(state);

-- Plaid linked items (one per institution connection)
CREATE TABLE IF NOT EXISTS plaid_items (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,            -- encrypted: v1:keyId:iv:authTag:ciphertext
  item_id TEXT NOT NULL UNIQUE,          -- Plaid's item identifier
  institution_id TEXT,
  institution_name TEXT,
  institution_logo_url TEXT,             -- [NEW] for UI display
  institution_color TEXT,                -- [NEW] primary brand color
  consent_expiration TEXT,               -- ISO date, nullable
  error_code TEXT,                       -- null if healthy
  error_message TEXT,                    -- [NEW] human-readable error
  sync_cursor TEXT,                      -- [NEW] for transactions/sync pagination
  last_synced_at TEXT,                   -- [NEW]
  last_successful_sync_at TEXT,          -- [NEW]
  last_sync_error TEXT,                  -- [NEW]
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_plaid_items_user ON plaid_items(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_item_id_user ON plaid_items(item_id, user_id);

-- Cached account metadata
CREATE TABLE IF NOT EXISTS plaid_accounts (
  id TEXT PRIMARY KEY,                   -- Plaid account_id
  item_id TEXT NOT NULL REFERENCES plaid_items(item_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,                 -- [NEW] denormalized for query safety
  name TEXT NOT NULL,
  official_name TEXT,
  type TEXT NOT NULL,                    -- depository, credit, loan, investment, etc.
  subtype TEXT,
  mask TEXT,                             -- last 4 digits
  current_balance REAL,
  available_balance REAL,
  currency_code TEXT DEFAULT 'USD',
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_plaid_accounts_item_id ON plaid_accounts(item_id);
CREATE INDEX IF NOT EXISTS idx_plaid_accounts_user_id ON plaid_accounts(user_id);

-- Transaction cache
CREATE TABLE IF NOT EXISTS plaid_transactions (
  id TEXT PRIMARY KEY,                   -- Plaid transaction_id
  account_id TEXT NOT NULL REFERENCES plaid_accounts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,                 -- [NEW] denormalized for query safety
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  authorized_date TEXT,                  -- [NEW] when bank authorized
  name TEXT NOT NULL,
  merchant_name TEXT,
  merchant_entity_id TEXT,               -- [NEW] stable merchant identifier
  category TEXT,                         -- JSON array as string
  personal_finance_category TEXT,        -- [NEW] Plaid's newer categorization
  pending INTEGER DEFAULT 0,
  pending_transaction_id TEXT,           -- [NEW] links pending → posted
  payment_channel TEXT,                  -- online, in store, other
  removed INTEGER DEFAULT 0,            -- [NEW] soft-delete for sync removals
  raw_json TEXT,                         -- [NEW] full Plaid payload for future-proofing
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))  -- [NEW]
);
CREATE INDEX IF NOT EXISTS idx_plaid_transactions_account_date
  ON plaid_transactions(account_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_plaid_transactions_user_date
  ON plaid_transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_plaid_transactions_account_pending_date
  ON plaid_transactions(account_id, pending, date DESC);

-- [NEW] Sync job tracking for idempotency and retry
CREATE TABLE IF NOT EXISTS plaid_sync_jobs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  item_id TEXT NOT NULL REFERENCES plaid_items(item_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | running | completed | failed
  added_count INTEGER DEFAULT 0,
  modified_count INTEGER DEFAULT 0,
  removed_count INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_plaid_sync_jobs_item ON plaid_sync_jobs(item_id, created_at DESC);
```

### 1.3 Plaid client initialization

New file: `apps/server/src/services/plaid-client.ts`

```typescript
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

export function createPlaidClient(): PlaidApi {
  const config = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
      },
    },
  });
  return new PlaidApi(config);
}
```

### 1.4 Database query module

New file: `apps/server/src/db/db-plaid.ts`

Functions:

**Link sessions:**
- `createLinkSession(db, { userId, state, linkToken, hostedLinkUrl, expiresAt })`
- `getLinkSessionByState(db, state)` — validates ownership + expiry
- `updateLinkSessionStatus(db, sessionId, status, payload?)`
- `expireOldLinkSessions(db)` — cleanup cron

**Items:**
- `insertPlaidItem(db, { userId, accessToken, itemId, institutionId, institutionName, ... })`
- `getPlaidItemsByUser(db, userId)`
- `getPlaidItemByItemId(db, itemId, userId)` — **[REVISED]** always requires userId for ownership check
- `updatePlaidItemError(db, itemId, errorCode, errorMessage)`
- `updatePlaidItemSyncCursor(db, itemId, cursor, syncTimestamp)`
- `deletePlaidItem(db, itemId, userId)` — **[REVISED]** requires userId

**Accounts:**
- `upsertPlaidAccounts(db, userId, accounts[])`
- `getAccountsByUser(db, userId, filters?)`
- `getAccountsByItemId(db, itemId, userId)`

**Transactions:**
- `upsertPlaidTransactions(db, userId, transactions[])`
- `markTransactionsRemoved(db, transactionIds[])` — **[NEW]** soft-delete
- `getTransactionsByAccount(db, accountId, userId, { startDate, endDate, limit, offset })`
- `getTransactionsByUser(db, userId, { startDate, endDate, limit, offset, accountIds?, pending?, search?, merchantName?, category?, sort? })`

**Sync jobs:**
- `createSyncJob(db, itemId)`
- `updateSyncJob(db, jobId, status, counts?)`
- `getLatestSyncJob(db, itemId)`
- `hasPendingSyncJob(db, itemId)` — prevents duplicate syncs

### 1.5 Access token encryption

**[REVISED]** — Versioned format with key rotation support.

New file: `apps/server/src/services/plaid-encryption.ts`

- Use Node.js `crypto.createCipheriv` with AES-256-GCM
- Key derived from `process.env.PLAID_ENCRYPTION_KEY` (32-byte hex)
- **Storage format**: `v1:<keyId>:<iv>:<authTag>:<ciphertext>`
  - `v1` — version prefix for future migration
  - `keyId` — identifies which key was used (supports rotation)
  - `iv` — 12-byte initialization vector (base64)
  - `authTag` — 16-byte authentication tag (base64)
  - `ciphertext` — encrypted access token (base64)
- Encrypt before storing, decrypt when making API calls
- Decrypt attempts current key first, then legacy keys from `PLAID_ENCRYPTION_KEY_LEGACY` (comma-separated)

### 1.6 **[NEW]** Log redaction middleware

New file: `apps/server/src/middleware/plaid-redaction.ts`

- Middleware applied to all `/api/plaid/*` routes
- Strips `access_token`, `public_token`, `link_token` from any logged request/response bodies
- Redacts token-like patterns from error messages before logging

---

## Phase 2: Server API Routes

New file: `apps/server/src/routes/plaid.ts`

### Endpoints

**[REVISED]** — Expanded endpoint list with session-based flow, reauth, and pagination.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/plaid/link/start` | **[NEW]** Create link token + link session with state nonce |
| `POST` | `/api/plaid/link/finalize` | **[REVISED]** Exchange token with state validation + anti-replay |
| `GET` | `/api/plaid/link/session/:id/status` | **[NEW]** Poll session status (for deep-link failure fallback) |
| `GET` | `/api/plaid/items` | List user's connected institutions with health status |
| `GET` | `/api/plaid/items/:itemId/status` | **[NEW]** Detailed item health: errors, consent, last sync |
| `POST` | `/api/plaid/items/:itemId/reauth` | **[NEW]** Create update-mode link token for broken connections |
| `DELETE` | `/api/plaid/items/:itemId` | **[REVISED]** Call Plaid `/item/remove` first, then delete locally |
| `GET` | `/api/plaid/accounts` | List accounts (filterable by itemId, type, subtype) |
| `POST` | `/api/plaid/accounts/refresh-balances` | **[NEW]** Refresh balances without full transaction sync |
| `GET` | `/api/plaid/transactions` | All transactions with pagination metadata + filters |
| `GET` | `/api/plaid/accounts/:accountId/transactions` | Transactions for one account |
| `POST` | `/api/plaid/sync` | Trigger transaction sync (idempotent, prevents duplicates) |
| `GET` | `/api/plaid/sync/status` | **[NEW]** Latest sync job status per item |

### Link start (replaces old link-token)

```typescript
// POST /api/plaid/link/start
const state = crypto.randomUUID(); // CSRF nonce
const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

const response = await plaidClient.linkTokenCreate({
  user: { client_user_id: userId },
  client_name: 'Claude Tauri',
  products: ['transactions'],
  country_codes: ['US'],
  language: 'en',
  hosted_link: {
    delivery_method: 'hosted',
    url_lifetime_seconds: 600,
    completion_redirect_uri: `claudetauri://plaid-callback?state=${state}`,
  },
});

// Store session for validation
createLinkSession(db, {
  userId, state, linkToken: response.link_token,
  hostedLinkUrl: response.hosted_link_url, expiresAt,
});

return { hosted_link_url: response.hosted_link_url, session_id, state };
```

### Link finalization (replaces old exchange-token)

```typescript
// POST /api/plaid/link/finalize  { state, public_token }
// 1. Validate state matches a pending session owned by this user
const session = getLinkSessionByState(db, body.state);
if (!session) throw new HTTPException(400, { message: 'Invalid or expired link session' });
if (session.user_id !== userId) throw new HTTPException(403, { message: 'Session ownership mismatch' });
if (session.status !== 'initiated' && session.status !== 'callback_received')
  throw new HTTPException(409, { message: 'Session already finalized' });
if (new Date(session.expires_at) < new Date())
  throw new HTTPException(410, { message: 'Link session expired. Please try again.' });

// 2. Check for duplicate item
const existing = getPlaidItemByPlaidItemId(db, /* extracted from exchange */);
if (existing) throw new HTTPException(409, { message: 'This institution is already connected' });

// 3. Exchange public_token → access_token
const { access_token, item_id } = await plaidClient.itemPublicTokenExchange({
  public_token: body.public_token,
});

// 4. Encrypt and store
const encryptedToken = encrypt(access_token);
insertPlaidItem(db, { userId, accessToken: encryptedToken, itemId: item_id, ... });

// 5. Mark session finalized
updateLinkSessionStatus(db, session.id, 'finalized');

// 6. Trigger initial sync (non-blocking)
triggerInitialSync(db, plaidClient, item_id);

return { item: getPlaidItemsByUser(db, userId) };
```

### Disconnect (revised)

```typescript
// DELETE /api/plaid/items/:itemId
// 1. Verify ownership
const item = getPlaidItemByItemId(db, itemId, userId);
if (!item) throw new HTTPException(404);

// 2. Remove from Plaid first
try {
  const accessToken = decrypt(item.access_token);
  await plaidClient.itemRemove({ access_token: accessToken });
} catch (e) {
  // Log but continue — item may already be removed on Plaid's side
  logger.warn('Plaid item/remove failed, continuing local cleanup', { itemId, error: e.message });
}

// 3. Delete locally (cascades to accounts + transactions)
deletePlaidItem(db, itemId, userId);
```

### Transaction sync (revised)

```typescript
// POST /api/plaid/sync
// 1. Prevent duplicate syncs
if (hasPendingSyncJob(db, itemId)) return { status: 'already_syncing' };

// 2. Create sync job
const job = createSyncJob(db, itemId);

// 3. Paginated cursor-based sync
let hasMore = true;
let added = 0, modified = 0, removed = 0;
while (hasMore) {
  const cursor = getPlaidItem(db, itemId).sync_cursor;
  const response = await plaidClient.transactionsSync({
    access_token: decrypt(item.access_token),
    cursor: cursor || undefined,
  });

  // Upsert added + modified
  upsertPlaidTransactions(db, userId, [...response.added, ...response.modified]);
  added += response.added.length;
  modified += response.modified.length;

  // Soft-delete removed
  markTransactionsRemoved(db, response.removed.map(t => t.transaction_id));
  removed += response.removed.length;

  // Advance cursor
  updatePlaidItemSyncCursor(db, itemId, response.next_cursor, new Date().toISOString());
  hasMore = response.has_more;
}

// 4. Update job status
updateSyncJob(db, job.id, 'completed', { added, modified, removed });
```

### **[NEW]** Reauth endpoint

```typescript
// POST /api/plaid/items/:itemId/reauth
const item = getPlaidItemByItemId(db, itemId, userId);
if (!item) throw new HTTPException(404);

const state = crypto.randomUUID();
const response = await plaidClient.linkTokenCreate({
  user: { client_user_id: userId },
  client_name: 'Claude Tauri',
  access_token: decrypt(item.access_token),  // update mode uses existing access_token
  hosted_link: {
    delivery_method: 'hosted',
    url_lifetime_seconds: 600,
    completion_redirect_uri: `claudetauri://plaid-callback?state=${state}`,
  },
});

createLinkSession(db, { userId, state, linkToken: response.link_token,
  hostedLinkUrl: response.hosted_link_url, expiresAt: ... });

return { hosted_link_url: response.hosted_link_url, state };
```

### **[NEW]** Response pagination

All list endpoints return:

```typescript
{
  items: T[],
  total: number,
  limit: number,
  offset: number,
  hasMore: boolean,
}
```

### **[NEW]** Transaction filters

`GET /api/plaid/transactions` supports query params:
- `startDate`, `endDate` — date range
- `accountIds` — comma-separated account IDs
- `pending` — boolean filter
- `search` — text search on name/merchantName
- `category` — filter by category
- `minAmount`, `maxAmount` — amount range
- `sort` — `date_asc | date_desc | amount_asc | amount_desc`
- `limit`, `offset` — pagination

### **[NEW]** User ownership enforcement

Every endpoint that accepts an `itemId` or `accountId`:
1. Loads the resource with `userId` in the WHERE clause
2. Returns 404 (not 403) if not found — prevents enumeration

---

## Phase 3: Tauri Deep Link Setup

### 3.1 Register custom URI scheme

In `apps/desktop/src-tauri/tauri.conf.json`:

```json
{
  "plugins": {
    "deep-link": {
      "desktop": {
        "schemes": ["claudetauri"]
      }
    }
  }
}
```

Add Tauri deep-link plugin:
- `apps/desktop/src-tauri/Cargo.toml`: add `tauri-plugin-deep-link`
- `apps/desktop/src-tauri/src/lib.rs`: register plugin

### 3.2 Deep link handler

**[REVISED]** — Handles cold-start, persists payload before React mounts.

In the Tauri Rust setup:

```rust
// Register deep-link plugin
app.handle().plugin(tauri_plugin_deep_link::init())?;

// Handle deep links — works for both warm and cold start
app.listen("deep-link://new-url", |event| {
    // Parse URL
    let url = Url::parse(&event.payload()).ok();
    if let Some(url) = url {
        // Store in app state (available even before React mounts)
        app.state::<DeepLinkState>().set(url.clone());
        // Also emit to frontend if already running
        app.emit("plaid-callback", url.to_string()).ok();
    }
});
```

### 3.3 Frontend deep link listener

**[REVISED]** — Checks for pending deep links on mount + listens for new ones.

```typescript
// In React app initialization
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

// Check for deep link that arrived before React mounted (cold start)
const pendingDeepLink = await invoke<string | null>('get_pending_deep_link');
if (pendingDeepLink) handlePlaidCallback(pendingDeepLink);

// Listen for deep links while app is running (warm start)
listen('plaid-callback', (event) => {
  handlePlaidCallback(event.payload as string);
});

function handlePlaidCallback(urlString: string) {
  const url = new URL(urlString);
  const state = url.searchParams.get('state');
  const publicToken = url.searchParams.get('public_token');

  if (state) {
    // Send to server for validated finalization
    fetch(`${SERVER_URL}/api/plaid/link/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ state, public_token: publicToken }),
    });
  }
}
```

### 3.4 **[NEW]** Fallback for deep-link failure

If deep link doesn't trigger (app not running, OS registration issue):

1. Plaid's completion page shows a message: "Return to Claude Tauri to complete setup"
2. In the app, the "Connect Bank" flow shows a "Complete Connection" button that:
   - Checks the link session status via `GET /api/plaid/link/session/:id/status`
   - If Plaid has called the webhook/callback on the server side, finalizes from there
   - If not, prompts user to retry

### 3.5 **[NEW]** Cross-platform deep link verification

Must test and document:
- **macOS**: App bundle URL type registration (Info.plist), notarization implications
- **Windows**: Protocol handler registry entry via Tauri installer
- **Linux**: `.desktop` file `MimeType` entry, XDG compliance

---

## Phase 4: Frontend UI

### 4.1 New shared types

**[REVISED]** — Expanded types with error states, sync status, and pagination.

In `packages/shared/src/types/plaid.ts`:

```typescript
export interface PlaidItem {
  id: string;
  itemId: string;
  institutionId: string;
  institutionName: string;
  institutionLogoUrl?: string;
  institutionColor?: string;
  accounts: PlaidAccount[];
  error?: { code: string; message: string };
  consentExpiration?: string;
  lastSyncedAt?: string;
  createdAt: string;
}

export interface PlaidAccount {
  id: string;
  name: string;
  officialName?: string;
  type: 'depository' | 'credit' | 'loan' | 'investment' | 'other';
  subtype?: string;
  mask?: string;
  currentBalance: number;
  availableBalance?: number;
  currencyCode: string;
}

export interface PlaidTransaction {
  id: string;
  accountId: string;
  amount: number;
  date: string;
  authorizedDate?: string;
  name: string;
  merchantName?: string;
  category?: string[];
  personalFinanceCategory?: string;
  pending: boolean;
  paymentChannel: string;
}

// [NEW] Link flow types
export interface PlaidLinkSession {
  sessionId: string;
  state: string;
  hostedLinkUrl: string;
  status: 'initiated' | 'callback_received' | 'finalized' | 'failed' | 'expired';
}

// [NEW] Pagination wrapper
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// [NEW] Sync status
export interface PlaidSyncStatus {
  itemId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  addedCount: number;
  modifiedCount: number;
  removedCount: number;
  lastSyncedAt?: string;
  error?: string;
}

// [NEW] Item health for UI banners
export type PlaidItemHealth = 'healthy' | 'error' | 'reauth_required' | 'consent_expiring';
```

### 4.2 API client hooks

New file: `apps/desktop/src/hooks/usePlaid.ts`

- `usePlaidItems()` — fetch connected institutions with health status
- `usePlaidAccounts(filters?)` — fetch accounts (filterable by itemId, type)
- `usePlaidTransactions(filters?)` — fetch transactions with pagination + filters
- `useConnectBank()` — initiate Link flow via `/link/start`, open browser
- `useReauthBank(itemId)` — **[NEW]** initiate update-mode Link for broken connections
- `useDisconnectBank(itemId)` — remove institution
- `useSyncStatus()` — **[NEW]** poll sync job status
- `useRefreshBalances()` — **[NEW]** trigger balance refresh

### 4.3 UI Components

New directory: `apps/desktop/src/components/finance/`

- **`ConnectBankButton.tsx`** — opens Plaid Hosted Link in system browser
- **`AccountsList.tsx`** — card grid showing connected accounts with balances
- **`TransactionList.tsx`** — sortable/filterable table with pagination
- **`InstitutionCard.tsx`** — shows institution logo, accounts, connection status, **[NEW]** health badge
- **`FinanceDashboard.tsx`** — main page composing all finance components
- **`DisconnectDialog.tsx`** — confirmation dialog for removing an institution
- **`ReauthBanner.tsx`** — **[NEW]** banner shown when an item needs re-authentication
- **`ConsentExpiryWarning.tsx`** — **[NEW]** warning when consent is expiring within 7 days
- **`SyncStatusIndicator.tsx`** — **[NEW]** shows sync progress/last synced time
- **`LinkFlowFallback.tsx`** — **[NEW]** "Complete Connection" UI for deep-link failure recovery

### 4.4 Navigation

Add "Finance" entry to the app's sidebar/navigation, linking to the FinanceDashboard page.

### 4.5 **[NEW]** Error states and empty states

Each component handles:
- **Loading**: skeleton/spinner
- **Empty**: helpful message + CTA ("Connect your first bank account")
- **Error**: retry button + human-readable error message
- **Degraded**: institution-specific errors shown inline on the affected card
- **Reauth needed**: prominent banner with "Reconnect" button

---

## Phase 5: Webhooks (Production Phase)

**[REVISED]** — Promoted from "future enhancement" to defined production phase.

Webhooks are **required for production** — without them, transaction data becomes stale and item errors go undetected.

### 5.1 Webhook endpoint

`POST /api/plaid/webhooks` — publicly accessible, signature-verified.

### 5.2 Webhook types to handle

| Webhook | Action |
|---------|--------|
| `TRANSACTIONS.SYNC_UPDATES_AVAILABLE` | Trigger background sync for the item |
| `ITEM.ERROR` | Update item error status, surface in UI |
| `ITEM.PENDING_EXPIRATION` | Store warning, show ConsentExpiryWarning |
| `ITEM.USER_PERMISSION_REVOKED` | Mark item as disconnected |
| `TRANSACTIONS.INITIAL_UPDATE` | Mark initial sync complete |
| `TRANSACTIONS.HISTORICAL_UPDATE` | Mark historical data available |

### 5.3 Webhook security

- Verify Plaid webhook signature using `plaid.webhookVerificationKeyGet`
- Reject requests with invalid signatures
- Idempotent processing (store webhook ID, skip duplicates)
- Process asynchronously (acknowledge 200 immediately, process in background)

### 5.4 Development approach

- **Local dev**: Use Plaid sandbox webhooks with ngrok/cloudflared tunnel
- **Production**: Deploy webhook endpoint on a public server (Railway/Fly.io), forward events to desktop app via WebSocket or polling

---

## Phase 6: **[NEW]** Background Sync Strategy

Define how financial data stays fresh:

| Trigger | When | Behavior |
|---------|------|----------|
| **Initial sync** | After item creation | Automatic, non-blocking |
| **Manual sync** | User clicks "Refresh" | POST /api/plaid/sync, show progress |
| **App startup sync** | App opens | Sync all items with `lastSyncedAt > 1 hour ago` |
| **Webhook sync** | Webhook received | Automatic background sync (production only) |

Sync is always idempotent — duplicate triggers are harmlessly deduplicated via `plaid_sync_jobs`.

---

## Environment Variables

Add to `.env.example`:

```env
# Plaid Configuration
PLAID_CLIENT_ID=               # From Plaid dashboard
PLAID_SECRET=                  # From Plaid dashboard (sandbox/development/production)
PLAID_ENV=sandbox              # sandbox | development | production
PLAID_ENCRYPTION_KEY=          # 32-byte hex string for encrypting access tokens
PLAID_ENCRYPTION_KEY_ID=v1     # [NEW] Key identifier for rotation
PLAID_ENCRYPTION_KEY_LEGACY=   # [NEW] Comma-separated old keys for rotation
```

---

## Testing Strategy

**[REVISED]** — Significantly expanded per GPT-5.4 feedback.

### Server tests (`apps/server/`)

**Unit tests:**
- `db-plaid.ts` — CRUD operations against test SQLite DB for all tables
- `plaid-encryption.ts`:
  - Encrypt/decrypt roundtrip
  - Tampering detection (modified iv, authTag, ciphertext)
  - Invalid key length rejection
  - Wrong key version handling
  - Key rotation: decrypt with legacy key
  - Empty/null token handling
- `plaid-redaction.ts` — token patterns stripped from logs

**Integration tests (mocked Plaid SDK):**
- Link start → returns session with state
- Link finalize → validates state, exchanges token, stores item
- Link finalize → rejects expired session (410)
- Link finalize → rejects already-finalized session (409)
- Link finalize → rejects wrong user (403 → 404)
- Link finalize → rejects duplicate institution (409)
- Disconnect → calls Plaid `/item/remove`, then deletes locally
- Disconnect → handles Plaid removal failure gracefully
- Sync → processes added/modified/removed transactions
- Sync → handles `has_more` pagination loop
- Sync → idempotent (rejects duplicate in-progress syncs)
- Sync → handles cursor invalidation gracefully
- Reauth → creates update-mode link token
- All endpoints → reject unauthorized requests
- All endpoints → reject cross-user resource access (returns 404)

**Negative tests:**
- Rate limit handling (429 → retry with backoff)
- Plaid 500 → graceful error response
- Network timeout → bounded retry
- Malformed callback → proper error code

### Frontend tests (`apps/desktop/`)

- Component tests for each finance component — render, loading, empty, error states
- Hook tests for `usePlaid*` hooks — mock API responses, loading/error states
- Deep link handler tests — valid URL, malformed URL, missing params, duplicate callback
- ReauthBanner — renders when item has error, triggers reauth flow

### E2E / System tests

- **[NEW]** Full flow: start link → simulate callback → finalize → view accounts/transactions
- **[NEW]** Deep link lifecycle: warm start, cold start (pending deep link), missing app
- **[NEW]** Disconnect flow: confirm dialog → Plaid removal → local cleanup → UI update
- **[NEW]** Reauth flow: broken item → reauth → fixed item

### Contract tests

- **[NEW]** Store Plaid sandbox response fixtures for:
  - `linkTokenCreate`
  - `itemPublicTokenExchange`
  - `transactionsSync`
  - `accountsGet`
  - `itemRemove`
- Validate our parsing against real payloads

### Manual test checklist

- [ ] Connect sandbox institution via Hosted Link
- [ ] Verify deep link callback works on macOS
- [ ] Test cold-start deep link (app not running when callback arrives)
- [ ] Test fallback flow (deep link fails, manual "Complete Connection")
- [ ] View accounts and balances after connection
- [ ] View transactions with date filtering, search, pagination
- [ ] Disconnect institution, verify Plaid removal + local cleanup
- [ ] Reconnect after disconnect
- [ ] Simulate Plaid item error, verify ReauthBanner appears
- [ ] Trigger reauth flow, verify item recovers
- [ ] Duplicate connection attempt → shows "already connected" error
- [ ] Expired link session → shows "session expired, try again"

---

## Implementation Order

1. **Phase 1** — Server foundation (Plaid client, DB schema, encryption, redaction)
2. **Phase 2** — Server API routes (link flow, CRUD, sync, reauth)
3. **Phase 3** — Tauri deep link setup (URI scheme, cold-start handling, fallback)
4. **Phase 4** — Frontend UI (dashboard, components, hooks, error states)
5. **Phase 5** — Webhooks (production deployment phase)
6. **Phase 6** — Background sync strategy

Phases 1-4 are the MVP. Phases 5-6 are required before production deployment.

---

## Security Considerations

- Access tokens encrypted at rest with AES-256-GCM, versioned format with key rotation
- **[NEW]** CSRF state nonce correlates link initiation ↔ callback
- **[NEW]** Anti-replay: sessions can only be finalized once
- **[NEW]** User ownership enforced on every resource query (404 for unauthorized, not 403)
- **[NEW]** Disconnect calls Plaid `/item/remove` before local deletion
- **[NEW]** Log redaction middleware strips tokens from all logs
- Never log or expose access tokens in API responses
- Bearer auth middleware protects all Plaid endpoints
- Public token has 30-minute expiry — exchange immediately
- Plaid handles all bank credential storage (never touches our system)
- Transaction data stored locally in SQLite — no cloud exposure
- **[NEW]** Rate limiting on link/finalize to prevent abuse

---

## Data Governance **[NEW]**

- **Retention**: Transaction data retained indefinitely by default (user's local machine)
- **Deletion**: "Disconnect" removes all data for that institution (cascading delete)
- **Full wipe**: "Delete all financial data" option in settings clears all Plaid tables
- **Privacy**: No financial data leaves the local machine (desktop-only app)
- **Consent**: UI clearly explains what data is imported and how to disconnect
