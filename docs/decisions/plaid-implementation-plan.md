# Plaid Integration — Implementation Plan

## Overview

Add Plaid financial data integration to the Claude Tauri Boilerplate app, enabling users to connect bank accounts and view transactions, balances, and account details. Uses Plaid's **Hosted Link** flow (browser-based auth) with a **custom URI scheme** redirect back to the Tauri app.

---

## Architecture

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────┐
│  Tauri Desktop   │──────▶│  Bun/Hono Server │──────▶│  Plaid API  │
│  (React 19)      │◀──────│  (localhost)      │◀──────│             │
└────────┬─────────┘       └──────────────────┘       └─────────────┘
         │                                                    │
         │  1. User clicks "Connect Bank"                     │
         │  2. Frontend requests link_token from server        │
         │  3. Server creates link_token via Plaid SDK         │
         │  4. Frontend opens Hosted Link URL in system browser│
         │  5. User authenticates at bank (in browser)         │
         │  6. Plaid redirects to myapp://plaid-callback       │
         │  7. Tauri intercepts deep link, extracts public_token│
         │  8. Frontend sends public_token to server           │
         │  9. Server exchanges for access_token via Plaid SDK │
         │ 10. Server stores access_token in SQLite            │
         │ 11. Server fetches financial data on demand         │
         └────────────────────────────────────────────────────┘
```

---

## Phase 1: Server-Side Plaid Foundation

### 1.1 Add Plaid SDK dependency

- Add `plaid` npm package to `apps/server/package.json`
- Run `./init.sh` to install

### 1.2 Database schema

New migration in `apps/server/src/db/migrations.ts`:

```sql
-- Plaid linked accounts (one per institution connection)
CREATE TABLE IF NOT EXISTS plaid_items (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,          -- encrypted at rest
  item_id TEXT NOT NULL UNIQUE,        -- Plaid's item identifier
  institution_id TEXT,
  institution_name TEXT,
  consent_expiration TEXT,             -- ISO date, nullable
  error_code TEXT,                     -- null if healthy
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Cached account metadata
CREATE TABLE IF NOT EXISTS plaid_accounts (
  id TEXT PRIMARY KEY,                 -- Plaid account_id
  item_id TEXT NOT NULL REFERENCES plaid_items(item_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  official_name TEXT,
  type TEXT NOT NULL,                  -- depository, credit, loan, investment, etc.
  subtype TEXT,
  mask TEXT,                           -- last 4 digits
  current_balance REAL,
  available_balance REAL,
  currency_code TEXT DEFAULT 'USD',
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Transaction cache
CREATE TABLE IF NOT EXISTS plaid_transactions (
  id TEXT PRIMARY KEY,                 -- Plaid transaction_id
  account_id TEXT NOT NULL REFERENCES plaid_accounts(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  merchant_name TEXT,
  category TEXT,                       -- JSON array as string
  pending INTEGER DEFAULT 0,
  payment_channel TEXT,                -- online, in store, other
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_plaid_transactions_account_date
  ON plaid_transactions(account_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_plaid_items_user
  ON plaid_items(user_id);
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
- `insertPlaidItem(db, { userId, accessToken, itemId, institutionId, institutionName })`
- `getPlaidItemsByUser(db, userId)`
- `getPlaidItemByItemId(db, itemId)`
- `deletePlaidItem(db, itemId)`
- `upsertPlaidAccounts(db, accounts[])`
- `getAccountsByItemId(db, itemId)`
- `upsertPlaidTransactions(db, transactions[])`
- `getTransactionsByAccount(db, accountId, { startDate, endDate, limit, offset })`
- `getTransactionsByUser(db, userId, { startDate, endDate, limit, offset })`

### 1.5 Access token encryption

New file: `apps/server/src/services/plaid-encryption.ts`

- Use Node.js `crypto.createCipheriv` with AES-256-GCM
- Key derived from `process.env.PLAID_ENCRYPTION_KEY` (32-byte hex)
- Encrypt before storing, decrypt when making API calls
- Store as `iv:authTag:ciphertext` in the `access_token` column

---

## Phase 2: Server API Routes

New file: `apps/server/src/routes/plaid.ts`

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/plaid/link-token` | Create a Plaid Link token for the user |
| `POST` | `/api/plaid/exchange-token` | Exchange public_token for access_token, store item |
| `GET` | `/api/plaid/items` | List user's connected institutions |
| `DELETE` | `/api/plaid/items/:itemId` | Disconnect an institution |
| `GET` | `/api/plaid/accounts` | List all accounts across institutions |
| `GET` | `/api/plaid/accounts/:accountId/transactions` | Get transactions for one account |
| `POST` | `/api/plaid/sync` | Trigger a sync of balances + transactions |
| `GET` | `/api/plaid/transactions` | Get all transactions (with filters) |

### Link token creation

```typescript
// POST /api/plaid/link-token
const response = await plaidClient.linkTokenCreate({
  user: { client_user_id: userId },
  client_name: 'Claude Tauri',
  products: ['transactions'],
  country_codes: ['US'],
  language: 'en',
  hosted_link: {
    delivery_method: 'hosted',           // Use Hosted Link
    url_lifetime_seconds: 600,
    completion_redirect_uri: 'claudetauri://plaid-callback',
  },
});
// Return { link_token, hosted_link_url } to frontend
```

### Token exchange

```typescript
// POST /api/plaid/exchange-token  { public_token }
const { access_token, item_id } = await plaidClient.itemPublicTokenExchange({
  public_token: req.body.public_token,
});
// Encrypt access_token, store in plaid_items, fetch initial account data
```

### Transaction sync

Use Plaid's `transactions/sync` cursor-based API:
- Store cursor per item in `plaid_items.sync_cursor` column
- Fetch added/modified/removed transactions incrementally
- Upsert into `plaid_transactions` table

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

In the Tauri Rust setup:

```rust
app.handle().plugin(tauri_plugin_deep_link::init())?;
// Listen for deep link events
app.listen("deep-link://new-url", |event| {
    // Parse URL, extract public_token from query params
    // Send to frontend via event system
});
```

### 3.3 Frontend deep link listener

```typescript
// In React app initialization
import { listen } from '@tauri-apps/api/event';

listen('deep-link://new-url', (event) => {
  const url = new URL(event.payload);
  if (url.pathname === '/plaid-callback') {
    const publicToken = url.searchParams.get('public_token');
    // Send to server for exchange
  }
});
```

---

## Phase 4: Frontend UI

### 4.1 New shared types

In `packages/shared/src/types/`:

```typescript
// plaid.ts
export interface PlaidItem {
  id: string;
  institutionId: string;
  institutionName: string;
  accounts: PlaidAccount[];
  error?: string;
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
  name: string;
  merchantName?: string;
  category?: string[];
  pending: boolean;
  paymentChannel: string;
}
```

### 4.2 API client hooks

New file: `apps/desktop/src/hooks/usePlaid.ts`

- `usePlaidItems()` — fetch connected institutions
- `usePlaidAccounts()` — fetch all accounts
- `usePlaidTransactions(accountId?, filters?)` — fetch transactions
- `useConnectBank()` — initiate Link flow
- `useDisconnectBank(itemId)` — remove institution

### 4.3 UI Components

New directory: `apps/desktop/src/components/finance/`

- **`ConnectBankButton.tsx`** — opens Plaid Hosted Link in system browser
- **`AccountsList.tsx`** — card grid showing connected accounts with balances
- **`TransactionList.tsx`** — sortable/filterable table of transactions
- **`InstitutionCard.tsx`** — shows institution logo, accounts, connection status
- **`FinanceDashboard.tsx`** — main page composing all finance components
- **`DisconnectDialog.tsx`** — confirmation dialog for removing an institution

### 4.4 Navigation

Add "Finance" entry to the app's sidebar/navigation, linking to the FinanceDashboard page.

---

## Phase 5: Webhooks (Future Enhancement)

For production, Plaid sends webhooks for:
- `TRANSACTIONS.SYNC_UPDATES_AVAILABLE` — new transactions ready
- `ITEM.ERROR` — connection issues (needs re-auth)
- `ITEM.PENDING_EXPIRATION` — consent expiring

This requires a publicly accessible endpoint (tunnel or deployed server). Defer to production deployment phase.

---

## Environment Variables

Add to `.env.example`:

```env
# Plaid Configuration
PLAID_CLIENT_ID=           # From Plaid dashboard
PLAID_SECRET=              # From Plaid dashboard (sandbox/development/production)
PLAID_ENV=sandbox          # sandbox | development | production
PLAID_ENCRYPTION_KEY=      # 32-byte hex string for encrypting access tokens
```

---

## Testing Strategy

### Server tests (`apps/server/`)

- **Unit tests** for `db-plaid.ts` — CRUD operations against test SQLite DB
- **Unit tests** for `plaid-encryption.ts` — encrypt/decrypt roundtrip, tampering detection
- **Integration tests** for Plaid routes — mock Plaid SDK, test full request/response cycle
- **Test Plaid sandbox** — use Plaid's sandbox credentials for end-to-end flow in dev

### Frontend tests (`apps/desktop/`)

- **Component tests** for each finance component — render, interaction, empty/error states
- **Hook tests** for `usePlaid*` hooks — mock API responses, loading/error states

### Manual test checklist

- [ ] Connect sandbox institution via Hosted Link
- [ ] Verify deep link callback works on macOS
- [ ] View accounts and balances after connection
- [ ] View transactions with date filtering
- [ ] Disconnect institution, verify cleanup
- [ ] Reconnect after disconnect
- [ ] Error state: simulate Plaid item error

---

## Implementation Order

1. **Phase 1** — Server foundation (Plaid client, DB schema, encryption) — ~2 hours
2. **Phase 2** — Server API routes — ~2 hours
3. **Phase 3** — Tauri deep link setup — ~1 hour
4. **Phase 4** — Frontend UI — ~3 hours
5. **Phase 5** — Webhooks — deferred to production

Total estimated implementation: ~8 hours of agent work across 4 phases.

---

## Security Considerations

- Access tokens encrypted at rest with AES-256-GCM
- Never log or expose access tokens in API responses
- Bearer auth middleware protects all Plaid endpoints
- Public token has 30-minute expiry — exchange immediately
- Rate limit token exchange endpoint to prevent abuse
- Plaid handles all bank credential storage (never touches our system)
- Transaction data stored locally in SQLite — no cloud exposure
