# Plaid Server Tests

## Summary

Added 73 tests across 3 test files covering the Plaid integration server code.

## Test Files

### `apps/server/src/db/db-plaid.test.ts` (41 tests)
Tests all database functions against a real in-memory SQLite DB with the Plaid schema.

- **Link Sessions** (7 tests): create, getByState, updateStatus (with payload and error fields), expire old sessions (respects finalized status)
- **Items** (6 tests): insert, getByUser, getByItemId (ownership check), delete (ownership-scoped)
- **Accounts** (5 tests): upsert (insert + update), getByUser with itemId/type filters, getByItemId
- **Transactions** (14 tests): upsert (insert + update with removed reset), markRemoved, getByAccount with date/limit/offset filters, getByUser with search/sort/date/accountIds/pending filters, getTransactionCountByUser
- **Sync Jobs** (9 tests): create, update (completed + failed with error), getLatest (null + existing), hasPending (true/false/after completion)

### `apps/server/src/services/plaid-encryption.test.ts` (13 tests)
Tests the AES-256-GCM encryption module.

- Encrypt/decrypt roundtrip (ASCII + unicode)
- Different plaintexts produce different ciphertexts
- Same plaintext produces different ciphertexts (random IV)
- Correct v1 format verification
- Tampered ciphertext/authTag/IV all throw
- Invalid format and unsupported version throw
- Empty string handling
- Missing/invalid encryption key errors

### `apps/server/src/routes/plaid.test.ts` (19 tests)
Integration tests with a real Hono app and mocked PlaidApi.

- **POST /link/start**: creates session + returns hosted URL, accepts custom products
- **POST /link/finalize**: happy path (validates state, exchanges token, stores item), expired session (410), already-finalized (409), invalid state (400), missing fields (400)
- **DELETE /items/:itemId**: calls Plaid removal + local delete, 404 for unknown, still cleans up locally if Plaid API fails
- **GET /items**: returns items without access tokens, empty array
- **GET /transactions**: paginated results, limit/offset, search filter, date range filter
- **POST /sync**: triggers sync, prevents duplicates, 404 for unknown, validates input

## Pre-existing Failures

2 pre-existing failures in `auth.test.ts` are unrelated to these changes.
