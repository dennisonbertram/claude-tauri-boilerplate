# Plaid Phase 1: Server Foundation — Implementation Summary

## Date: 2026-03-24

## What was implemented

Phase 1 of the Plaid integration plan (v2), establishing the server-side foundation for financial data integration. No routes or frontend — just the building blocks.

## Files created

### 1. `apps/server/src/services/plaid-client.ts`
- Initializes `PlaidApi` from env vars (`PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`)
- Validates environment and key presence at construction time
- Validates `PLAID_ENV` against known Plaid environments

### 2. `apps/server/src/services/plaid-encryption.ts`
- AES-256-GCM encryption/decryption for Plaid access tokens
- Versioned storage format: `v1:<keyId>:<iv>:<authTag>:<ciphertext>` (all base64)
- Key rotation support: primary key from `PLAID_ENCRYPTION_KEY` + legacy keys from `PLAID_ENCRYPTION_KEY_LEGACY` (comma-separated `keyId:hexKey` pairs)
- Decrypt tries matching key ID first, then brute-forces all available keys
- Input validation on key length (must be 32 bytes / 64 hex chars)

### 3. `apps/server/src/db/db-plaid.ts`
Full database query module with typed row interfaces and camelCase mappers:

**Link sessions:** `createLinkSession`, `getLinkSessionByState`, `updateLinkSessionStatus`, `expireOldLinkSessions`

**Items:** `insertPlaidItem`, `getPlaidItemsByUser`, `getPlaidItemByItemId` (requires userId), `updatePlaidItemError`, `updatePlaidItemSyncCursor`, `deletePlaidItem` (requires userId)

**Accounts:** `upsertPlaidAccounts` (batch, transactional), `getAccountsByUser` (with optional itemId/type filters), `getAccountsByItemId`

**Transactions:** `upsertPlaidTransactions` (batch, transactional), `markTransactionsRemoved` (soft-delete), `getTransactionsByAccount`, `getTransactionsByUser` (full filter support: date range, accountIds, pending, search, merchantName, category, amount range, sort), `getTransactionCountByUser` (for pagination)

**Sync jobs:** `createSyncJob`, `updateSyncJob`, `getLatestSyncJob`, `hasPendingSyncJob`

### 4. `apps/server/src/middleware/plaid-redaction.ts`
- Middleware for `/api/plaid/*` routes
- Redacts `access_token`, `public_token`, `link_token` field values from logged bodies
- Regex-based pattern matching for Plaid token formats in arbitrary strings
- Also catches encrypted token format (`v1:keyId:...`)
- Wraps console.log/warn/error during request processing, restores in `finally`

## Files modified

### 5. `apps/server/package.json`
- Added `"plaid": "^28.0.0"` to dependencies

### 6. `apps/server/src/db/migrations.ts`
- Added `migratePlaidTables()` function creating 5 tables:
  - `plaid_link_sessions` — state nonce correlation, session lifecycle tracking
  - `plaid_items` — encrypted access tokens, institution metadata, sync cursors, error tracking
  - `plaid_accounts` — denormalized with user_id for query safety
  - `plaid_transactions` — full Plaid transaction fields, soft-delete via `removed` column, raw JSON storage
  - `plaid_sync_jobs` — idempotency and retry tracking
- All tables use `CREATE TABLE IF NOT EXISTS` (idempotent)
- 10 indexes created for query performance

### 7. `apps/server/src/db/schema.ts`
- Re-exports `migratePlaidTables` from migrations module

### 8. `apps/server/src/db/index.ts`
- Calls `migratePlaidTables(db)` during database initialization
- Re-exports all 22 Plaid query functions + `TransactionFilters` type

### 9. `.env.example`
- Added Plaid environment variables: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `PLAID_ENCRYPTION_KEY`, `PLAID_ENCRYPTION_KEY_ID`, `PLAID_ENCRYPTION_KEY_LEGACY`

## Design decisions

- **User ownership on every query**: All item/account/transaction queries require `userId` in the WHERE clause. Returns null/empty (not 403) to prevent enumeration.
- **Soft-delete for transactions**: `markTransactionsRemoved` sets `removed=1` rather than deleting rows, matching Plaid's sync protocol for transaction removals.
- **Batch upserts in transactions**: Both `upsertPlaidAccounts` and `upsertPlaidTransactions` use SQLite transactions for atomicity.
- **Encryption key rotation**: Decrypt attempts current key first, then legacy keys. No re-encryption on read — that can be a separate migration step.
- **Redaction as middleware**: Console methods are wrapped per-request scope, not globally, to avoid interfering with non-Plaid logging.

## What's next (Phase 2)

- Server API routes (`apps/server/src/routes/plaid.ts`) — link start/finalize, CRUD, sync, reauth
- Integration with the encryption and redaction modules
- Tests for all Phase 1 modules
