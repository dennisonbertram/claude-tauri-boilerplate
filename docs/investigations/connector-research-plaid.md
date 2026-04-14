# Connector Research: Plaid (Finance)

**Date:** 2026-03-25
**Issue:** [#375](https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/375)
**Category:** Finance
**Priority:** High
**Complexity:** Medium (already partially implemented)

---

## 1. Overview

Plaid is a financial data aggregation service connecting apps to 12,000+ financial institutions. It provides normalized access to bank accounts, transactions, balances, investments, and identity data. For this app, Plaid enables an AI assistant to answer questions about a user's finances -- account balances, spending patterns, transaction history, and budgeting insights.

**Current state in the codebase:** Plaid is already partially implemented with dedicated Hono routes (`apps/server/src/routes/plaid.ts`), a full database layer (`apps/server/src/db/db-plaid.ts`), encryption for access tokens (`apps/server/src/services/plaid-encryption.ts`), shared types (`packages/shared/src/plaid.ts`), frontend components (`apps/desktop/src/components/finance/`), and a deep-link callback flow. However, it is NOT yet integrated into the standard `ConnectorDefinition` pattern used by the connector registry (`apps/server/src/connectors/`).

---

## 2. API Surface

### Core Products Relevant to This App

| Product | Endpoint | Description | Billing |
|---------|----------|-------------|---------|
| **Transactions** | `/transactions/sync` | Incremental transaction sync with cursor | Subscription (per item/month) |
| **Accounts** | `/accounts/get`, `/accounts/balance/get` | Account metadata and real-time balances | Per-request (balance) |
| **Identity** | `/identity/get` | Account holder name, email, phone, address | One-time per item |
| **Investments** | `/investments/holdings/get`, `/investments/transactions/get` | Holdings, securities, investment transactions | Subscription |
| **Liabilities** | `/liabilities/get` | Student loans, credit cards, mortgages | Subscription |
| **Auth** | `/auth/get` | Account and routing numbers (ACH) | One-time per item |

### Key API Methods Already Used

The existing implementation uses:
- `linkTokenCreate` -- create Plaid Link session (with hosted_link support)
- `itemPublicTokenExchange` -- exchange public token for access token
- `itemGet` -- fetch item metadata
- `institutionsGetById` -- institution details (name, logo, color)
- `accountsGet` -- fetch accounts and balances
- `transactionsSync` -- cursor-based incremental transaction sync
- `itemRemove` -- disconnect an item
- `linkTokenGet` -- resolve hosted link public token post-callback

### Environments

| Environment | Base URL | Data | Cost | Use Case |
|-------------|----------|------|------|----------|
| **Sandbox** | `sandbox.plaid.com` | Fake, deterministic | Free | Development and testing |
| **Development** | `development.plaid.com` | Real institutions | 200 free API calls/product | Validation with real banks |
| **Production** | `production.plaid.com` | Real, live | Paid per use | Live users |

The app configures this via `PLAID_ENV` environment variable (default: `sandbox`).

---

## 3. Auth Flow

### Plaid Link (Hosted Link for Desktop)

The app uses **Hosted Link**, which is the correct approach for Tauri desktop apps since Plaid's JS SDK is designed for browsers.

**Current flow (already implemented):**

1. Frontend calls `POST /api/plaid/link/start` with optional `completion_redirect_uri`
2. Server creates a `link_token` with `hosted_link` config and a `state` nonce
3. Server stores a `plaid_link_sessions` row tracking the state
4. Frontend opens the returned `hosted_link_url` in the system browser (Tauri) or a new tab (browser dev mode)
5. User completes bank authentication on Plaid's hosted page
6. Plaid redirects to either:
   - `claudetauri://plaid-callback?state=<nonce>` (Tauri deep link)
   - `http://localhost:<port>/#/finance/callback?state=<nonce>` (browser dev mode)
7. App calls `POST /api/plaid/link/finalize` with the state (and optionally public_token)
8. Server resolves public_token (from request body or via `linkTokenGet` for hosted flow)
9. Server exchanges public_token for permanent access_token
10. Access token is encrypted with AES-256-GCM and stored in SQLite

**Token security:**
- Access tokens encrypted at rest using `PLAID_ENCRYPTION_KEY` (AES-256-GCM with key rotation support)
- Token redaction middleware strips tokens from all console output on Plaid routes
- Access tokens never sent to the frontend

### Re-authentication

The app already supports update-mode Link for broken connections via `POST /api/plaid/items/:itemId/reauth`, which creates a link token with the existing access_token (Plaid's update mode).

---

## 4. Transaction Sync (Incremental)

The app already implements Plaid's recommended cursor-based `/transactions/sync` approach (NOT the deprecated `/transactions/get`).

**How it works:**
1. First call: no cursor, Plaid returns all historical transactions
2. Subsequent calls: pass the last `next_cursor`, get only changes since then
3. Response includes `added`, `modified`, and `removed` arrays plus `has_more` flag
4. Loop until `has_more === false`
5. Store the `next_cursor` for next sync

**Current implementation details:**
- `runTransactionSync()` in `plaid.ts` handles the full sync loop
- Re-reads the item each iteration to get the latest cursor
- Upserts added/modified transactions, soft-deletes removed ones
- Creates sync job records for tracking status
- Deduplication via `hasPendingSyncJob()` prevents concurrent syncs
- Initial sync triggered automatically after link finalization (non-blocking)

### Best Practices for Transaction Sync

1. **Always use /transactions/sync over /transactions/get** -- already done
2. **Store the cursor persistently** -- already done in `plaid_items.sync_cursor`
3. **Handle pending transactions** -- already tracked with `pending` column
4. **Idempotent upserts** -- already using `ON CONFLICT DO UPDATE`
5. **Soft deletes** -- already using `removed` flag instead of hard deletes
6. **Rate limiting** -- Plaid allows 15 requests/minute per item in production; the sync loop should respect this for large initial syncs

### Missing: Webhook-Driven Sync

The current implementation relies on manual sync triggers. In production, Plaid recommends webhook-driven sync:

- `SYNC_UPDATES_AVAILABLE` -- new transactions ready
- `INITIAL_UPDATE` -- first batch of historical transactions available
- `HISTORICAL_UPDATE` -- all historical transactions available
- `DEFAULT_UPDATE` -- (legacy) new transactions posted

For a desktop app without a persistent public server, webhook handling requires either:
- A tunnel service (ngrok) during development
- Polling on app launch instead of webhooks
- A lightweight cloud relay that stores webhook events for the desktop app to poll

**Recommendation:** For the desktop use case, poll on app launch + manual sync is sufficient. Webhooks are optional and add deployment complexity.

---

## 5. Error Handling and Item Health

### Error Categories (from Plaid docs)

| Error Type | Description | Action |
|------------|-------------|--------|
| `ITEM_LOGIN_REQUIRED` | Credentials changed or MFA required | Show reauth banner, trigger update-mode Link |
| `ITEM_NOT_SUPPORTED` | Institution no longer supported | Inform user, suggest removal |
| `INSTITUTION_DOWN` | Bank's systems are unavailable | Retry later, show status |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Exponential backoff |
| `PRODUCTS_NOT_SUPPORTED` | Requested product unavailable at this institution | Graceful degradation |

### Current Implementation

The app already has:
- Item health status endpoint (`GET /items/:itemId/status`) with states: `healthy`, `reauth_required`, `error`, `consent_expiring`
- Error code/message storage on items (`error_code`, `error_message` columns)
- Consent expiration tracking with 7-day warning threshold
- Reauth banner component (`ReauthBanner.tsx`)
- Sync job error tracking

### Recommended Additions for Connector Migration

1. **Automatic item health check on app launch** -- poll all items, update error states
2. **Exponential backoff on transient errors** -- not currently implemented
3. **Consent expiration notifications** -- surface to the AI assistant context

---

## 6. Connector Migration Plan

### Current Architecture (Standalone Routes)

```
apps/server/src/
  routes/plaid.ts          -- Hono router with all endpoints
  services/plaid-client.ts -- PlaidApi factory
  services/plaid-encryption.ts -- AES-256-GCM encryption
  db/db-plaid.ts           -- All DB operations
  middleware/plaid-redaction.ts -- Log redaction
```

### Target Architecture (ConnectorDefinition)

The Plaid connector needs to be registered in `apps/server/src/connectors/` following the existing pattern:

```
apps/server/src/connectors/
  plaid/
    index.ts               -- PlaidConnectorDefinition (name, tools, category)
    tools.ts               -- MCP tool definitions (finance_get_accounts, etc.)
```

### Key Difference from Weather Connector

The weather connector is stateless -- it calls an external API and returns results. Plaid is **stateful** -- it requires:
- Database access for stored items, accounts, transactions
- Encrypted access token management
- Session management for the Link flow

This means the Plaid connector tools need access to the `Database` instance and `PlaidApi` client. The `ConnectorDefinition` interface may need to be extended to support dependency injection, or the tools can capture these dependencies via closure.

### Proposed MCP Tools

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `finance_list_accounts` | List all connected bank accounts with balances | `type?` (filter by account type) |
| `finance_get_balance` | Get current balance for a specific account | `accountId` |
| `finance_search_transactions` | Search transactions with filters | `search?`, `startDate?`, `endDate?`, `accountId?`, `category?`, `minAmount?`, `maxAmount?`, `limit?` |
| `finance_get_spending_summary` | Aggregate spending by category for a date range | `startDate`, `endDate`, `accountIds?` |
| `finance_list_institutions` | List connected financial institutions with health status | (none) |
| `finance_sync_transactions` | Trigger a transaction sync for an institution | `itemId` |

### What Should Stay as REST Routes

The Link flow (start, finalize, reauth) and item management (connect, disconnect) are UI-driven operations that should remain as REST endpoints. MCP tools expose the **read-oriented** financial data to the AI assistant.

### Migration Steps

1. Create `apps/server/src/connectors/plaid/index.ts` with the ConnectorDefinition
2. Create `apps/server/src/connectors/plaid/tools.ts` with MCP tool implementations
3. Register the plaid connector in `apps/server/src/connectors/index.ts`
4. Keep existing REST routes for Link flow and item management
5. The MCP tools query the same DB tables the REST routes use
6. The connector `requiresAuth` should be `true` (Plaid credentials needed)

### Dependency Injection Consideration

The current `ConnectorDefinition` interface is static -- tools are defined at module load time. For Plaid, tools need runtime access to `db` and `plaidClient`. Options:

**Option A: Factory function** -- Change ConnectorDefinition to allow a factory:
```typescript
export function createPlaidConnector(db: Database, plaidClient: PlaidApi): ConnectorDefinition
```

**Option B: Module-level singletons** -- Tools capture db/plaidClient from a module-level init function.

**Option C: Extend the type** -- Add an optional `init(deps)` lifecycle method to ConnectorDefinition.

Option A is simplest and aligns with how the weather connector already works (it just happens to not need deps).

---

## 7. Testing with Plaid Sandbox

### Sandbox Credentials

| Credential | Value |
|------------|-------|
| Test username | `user_good` |
| Test password | `pass_good` |
| Sandbox phone | `415-555-0011` |
| Verification code | `123456` |
| Error username | `user_error` (triggers ITEM_LOGIN_REQUIRED) |
| No accounts username | `user_custom` (with custom config) |

### Sandbox Institutions

- **First Platypus Bank** (`ins_109508`) -- default sandbox institution
- **Houndstooth Bank** (`ins_109512`) -- another sandbox institution
- **Tattersall Federal Credit Union** (`ins_109511`)

### Sandbox Transaction Behavior

- Returns approximately 500 transactions spanning the last 2 years
- New transactions are added automatically to sandbox items (simulating real activity)
- `/sandbox/item/fire_webhook` can simulate webhook events
- `/sandbox/item/reset_login` forces an item into `ITEM_LOGIN_REQUIRED` state for testing reauth

### Sandbox-Specific Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /sandbox/item/fire_webhook` | Simulate webhook delivery |
| `POST /sandbox/item/reset_login` | Force item into error state |
| `POST /sandbox/public_token/create` | Create public token without Link UI |
| `POST /sandbox/item/set_verification_status` | Set micro-deposit verification status |

### Existing Test Infrastructure

The codebase already has comprehensive tests:
- `apps/server/src/routes/plaid.test.ts` -- Route-level integration tests
- `apps/server/src/db/db-plaid.test.ts` -- Database layer tests
- `apps/server/src/services/plaid-encryption.test.ts` -- Encryption tests
- `apps/desktop/src/lib/api/plaid-api.test.ts` -- Frontend API client tests
- `apps/desktop/src/lib/__tests__/plaid-link.test.ts` -- Link flow tests
- `apps/desktop/src/components/finance/__tests__/*.test.tsx` -- Component tests
- `docs/testing/plaid-sandbox-testing.md` -- Manual testing guide with agent-browser workflows

### Testing the Connector Migration

New tests needed:
1. **MCP tool unit tests** -- Each tool returns correct data format
2. **Integration tests** -- Tools query the DB correctly with filters
3. **Connector registration test** -- Plaid connector appears in `getAllConnectors()`
4. **Spending summary aggregation test** -- Correct category rollups

---

## 8. Plaid-Node SDK

### Package

```json
{
  "plaid": "^28.0.0"
}
```

The app already has `plaid` installed (visible in `apps/server/package.json`).

### Key SDK Classes

- `PlaidApi` -- Main API client (all endpoint methods)
- `Configuration` -- Client configuration (basePath, headers)
- `PlaidEnvironments` -- Environment URL map (sandbox, development, production)
- Type exports: `Products`, `CountryCode`, `AccountType`, `TransactionsSyncResponse`, etc.

### SDK Usage Pattern (Already Established)

```typescript
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const config = new Configuration({
  basePath: PlaidEnvironments[env],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': clientId,
      'PLAID-SECRET': secret,
    },
  },
});

const client = new PlaidApi(config);
```

### Error Handling Pattern

Plaid SDK errors include `response.data` with structured error info:
```typescript
try {
  await client.transactionsSync({ access_token, cursor });
} catch (err) {
  const plaidErr = err?.response?.data;
  // plaidErr.error_type, plaidErr.error_code, plaidErr.error_message
}
```

---

## 9. Pricing and Cost Considerations

### Free Tier

- **Sandbox**: Unlimited, fake data -- no cost
- **Development**: 200 API calls per product -- real banks, no cost

### Production Pricing (Pay As You Go)

| Product | Model | Approximate Cost |
|---------|-------|-----------------|
| Transactions | Per-item subscription | ~$0.30-0.50/item/month |
| Balance | Per-request | ~$0.10-0.30/call |
| Identity | One-time per item | ~$1.50-2.00/connection |
| Investments | Per-item subscription | ~$0.30-0.50/item/month |
| Auth | One-time per item | ~$1.50-2.00/connection |

Prices are approximate and depend on contract negotiation. Plaid does not publish exact pricing publicly.

### Cost Optimization for Desktop App

1. **Cache aggressively** -- The app already stores transactions locally in SQLite; only sync deltas
2. **Minimize balance checks** -- Use cached balances from last sync; only call `/accounts/balance/get` when user explicitly requests refresh
3. **Batch operations** -- The transaction sync API is already batched (cursor-based)
4. **Single-user model** -- Desktop app has one user, so per-user costs are minimal

---

## 10. Existing MCP Server Implementations (External Research)

### Known Plaid MCP Servers

There are no widely-adopted, official Plaid MCP server implementations in the public ecosystem as of March 2026. The MCP protocol is still relatively new. However:

1. **Community patterns**: Several GitHub repos demonstrate wrapping financial APIs as MCP tools, but none specifically for Plaid with the `@anthropic-ai/claude-agent-sdk` `tool()` function.

2. **Generic financial MCP patterns**: The emerging pattern is to expose read-only financial data as MCP tools (list accounts, search transactions, get balances) while keeping mutation operations (connect, disconnect, reauth) as standard REST endpoints driven by the UI.

3. **This app's approach is ahead of the curve**: The existing Plaid integration is more complete than most community MCP examples, with proper encryption, session management, and incremental sync already in place.

### Recommended Tool Design (from MCP Best Practices)

- **Read-only tools** for the AI: `finance_list_accounts`, `finance_search_transactions`, `finance_get_spending_summary`
- **Annotations**: Mark all finance tools with `readOnlyHint: true` since they only read data
- **Structured output**: Return formatted text (not raw JSON) so the AI can present it naturally
- **Error handling**: Return `{ isError: true }` with human-readable messages, not Plaid error codes
- **No access tokens in tool responses**: Never expose raw financial credentials to the LLM context

---

## Summary

### What Already Exists
- Full Plaid integration with Hosted Link flow, token exchange, encrypted storage
- Cursor-based transaction sync with deduplication
- Item health monitoring and reauth support
- Comprehensive test suite (server routes, DB layer, encryption, frontend)
- Frontend finance dashboard with institution cards, account lists, transaction views

### What Needs to Be Done for Connector Migration
1. Create `ConnectorDefinition` for Plaid with MCP tool definitions
2. Implement 5-6 read-only MCP tools that query existing DB tables
3. Handle dependency injection (db + plaidClient) -- likely via factory function
4. Register connector in the connector registry
5. Add tests for new MCP tools
6. Keep existing REST routes for Link flow and item management (no changes needed)

### Key Risks
- **ConnectorDefinition may need extension** for stateful connectors (dependency injection)
- **Spending summary** requires new aggregation queries not in the current DB layer
- **No webhook support** for real-time sync (acceptable for desktop app, poll on launch instead)

### Estimated Effort
- Connector definition + tools: 4-6 hours
- DB aggregation queries: 2-3 hours
- Tests: 2-3 hours
- **Total: ~1-2 days**
