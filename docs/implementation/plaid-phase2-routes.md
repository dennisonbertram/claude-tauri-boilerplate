# Plaid Phase 2: Server API Routes

## Summary

Implemented all 13 Plaid API endpoints as specified in the v2 plan, created in `apps/server/src/routes/plaid.ts` and registered in `apps/server/src/app.ts`.

## Endpoints Implemented

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/link/start` | Create link token + link session with state nonce |
| `POST` | `/link/finalize` | Exchange token with state validation + anti-replay |
| `GET` | `/link/session/:id/status` | Poll session status (deep-link fallback) |
| `GET` | `/items` | List user's connected institutions |
| `GET` | `/items/:itemId/status` | Detailed item health (healthy/error/reauth_required/consent_expiring) |
| `POST` | `/items/:itemId/reauth` | Update-mode link token for broken connections |
| `DELETE` | `/items/:itemId` | Call Plaid `/item/remove` + delete locally |
| `GET` | `/accounts` | List accounts (filterable by itemId, type) |
| `POST` | `/accounts/refresh-balances` | Refresh balances for all connected items |
| `GET` | `/transactions` | All transactions with pagination + filters |
| `GET` | `/accounts/:accountId/transactions` | Transactions for one account |
| `POST` | `/sync` | Trigger transaction sync (idempotent) |
| `GET` | `/sync/status` | Latest sync job status per item |

## Key Design Decisions

- **User ID**: Uses `DEFAULT_USER_ID = 'local-user'` since this is a single-user desktop app with bearer token auth (no multi-user system).
- **Router factory**: `createPlaidRouter(db, plaidClient)` accepts both the DB and a pre-configured Plaid API client, following the existing pattern but adding the Plaid client dependency.
- **Conditional registration**: In `app.ts`, Plaid routes are only registered if `PLAID_CLIENT_ID` and `PLAID_SECRET` env vars are set. Otherwise, all `/api/plaid/*` requests return 503 with an explanation.
- **Log redaction**: The `plaidRedaction()` middleware is applied to all Plaid routes via `router.use('*', ...)`.
- **Ownership enforcement**: Every endpoint that takes an `itemId` or `accountId` verifies the resource belongs to the user via the DB query's WHERE clause, returning 404 (not 403) if not found.

## Transaction Filters

`GET /transactions` supports:
- `startDate`, `endDate` -- date range
- `accountIds` -- comma-separated account IDs
- `pending` -- boolean filter (`true`/`false`)
- `search` -- text search on name/merchantName
- `category` -- category filter
- `minAmount`, `maxAmount` -- amount range
- `sort` -- `date_asc | date_desc | amount_asc | amount_desc`
- `limit`, `offset` -- pagination (default 50, max 200)

## Pagination Response Format

All list endpoints return:
```json
{
  "items": [],
  "total": 100,
  "limit": 50,
  "offset": 0,
  "hasMore": true
}
```

## Sync Implementation

The `runTransactionSync()` helper implements cursor-based pagination:
1. Checks for already-running sync jobs (idempotent)
2. Creates a sync job record
3. Loops through Plaid's `transactionsSync` pages
4. Upserts added/modified transactions, soft-deletes removed
5. Advances the cursor after each page
6. Updates the sync job with final counts or error

## Files Changed

- **Created**: `apps/server/src/routes/plaid.ts` -- All 13 Plaid API route handlers
- **Modified**: `apps/server/src/app.ts` -- Imported and conditionally registered the Plaid router

## Type Check

`tsc --noEmit` passes with 0 errors in the new/modified files. Pre-existing errors in other files are unchanged.
