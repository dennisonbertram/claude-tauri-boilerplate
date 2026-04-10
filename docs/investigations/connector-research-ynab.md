# YNAB Connector Research — Issue #377

## 1. Executive Summary

YNAB (You Need A Budget) has a well-documented, stable REST API (v1) with an official TypeScript SDK (`ynab` on npm, v4.0.0). The API supports budgets, accounts, categories, transactions, scheduled transactions, payees, and budget months. It uses personal access tokens or OAuth 2.0 for auth, has a 200 req/hour rate limit, and offers delta requests via `server_knowledge` for efficient incremental sync. Multiple community MCP servers already exist, providing proven patterns to draw from. YNAB is the strongest candidate for a budgeting connector due to its official public API; alternatives like Monarch Money and Copilot Money lack official APIs.

---

## 2. Existing MCP Server Implementations

Several YNAB MCP servers exist in the community:

| Project | Language | Notes |
|---------|----------|-------|
| [calebl/ynab-mcp-server](https://github.com/calebl/ynab-mcp-server) | TypeScript | Most mature. Tools in `src/tools/*.ts`, uses official SDK. Has approve/unapprove transactions, budget selection workflow. |
| [EthanKang1/ynab-mcp](https://github.com/EthanKang1/ynab-mcp) | TypeScript | Claude Desktop focused. get_transactions, create_transaction, update_transaction. |
| [mattweg/ynab-mcp](https://github.com/mattweg/ynab-mcp) | TypeScript | Claude Code integration focused. |
| [Jtewen/ynab-mcp](https://mcpservers.org/servers/Jtewen/ynab-mcp) | Python | PyPI package `ynab-mcp` (v0.1.4, Feb 2026). |
| [roeeyn/ynab-mcp-server](https://github.com/roeeyn/ynab-mcp-server) | Python | FastMCP based on OpenAPI spec. |

### Key Patterns from Existing Implementations
- All use personal access tokens (no OAuth needed for single-user desktop apps)
- Tools are modular: one file per tool or grouped by resource
- Budget selection is typically the first interaction (user has multiple budgets)
- The `calebl` implementation has the most sophisticated tool set including transaction approval workflows

### What Our Implementation Can Improve
- **In-process MCP server** via `createSdkMcpServer()` — no subprocess overhead
- **Delta sync** with `server_knowledge` caching — most existing servers don't implement this
- **Budget month tools** — none of the existing servers expose budget month data well
- **Milliunit formatting** — consistent currency display using budget's currency settings

---

## 3. YNAB API Overview

**Base URL**: `https://api.ynab.com/v1`

### Resource Endpoints

| Resource | Endpoints | Delta Support |
|----------|-----------|---------------|
| **User** | `GET /user` | No |
| **Budgets** | `GET /budgets`, `GET /budgets/{id}`, `GET /budgets/{id}/settings` | Yes (full budget) |
| **Accounts** | `GET /budgets/{id}/accounts`, `GET /budgets/{id}/accounts/{id}` | Yes |
| **Categories** | `GET /budgets/{id}/categories`, `GET /budgets/{id}/months/{month}/categories/{id}` | Yes |
| **Payees** | `GET /budgets/{id}/payees`, `GET /budgets/{id}/payees/{id}` | Yes |
| **Transactions** | `GET/POST/PUT /budgets/{id}/transactions`, filter by account/category/payee/date | Yes |
| **Scheduled Transactions** | `GET/PUT/DELETE /budgets/{id}/scheduled_transactions` | Yes |
| **Budget Months** | `GET /budgets/{id}/months`, `GET /budgets/{id}/months/{month}` | No |

### Rate Limits
- **200 requests per access token per hour** (rolling window)
- 429 response when exceeded
- Delta requests are strongly recommended to reduce API calls
- Caching is encouraged

### Milliunits Currency Format
All monetary amounts are in **milliunits** (1/1000 of a currency unit):
- `$1.00` = `1000` milliunits
- `-$25.50` = `-25500` milliunits
- The official SDK provides `utils.convertMilliUnitsToCurrencyAmount(milliunits, currencyDecimalDigits)`

### Budget Settings
Each budget has currency format settings (`currency_format`) that include:
- `iso_code` (e.g., "USD")
- `decimal_digits` (e.g., 2)
- `decimal_separator` (".")
- `symbol_first` (boolean)
- `currency_symbol` ("$")
- `display_symbol` (boolean)
- `group_separator` (",")

---

## 4. Delta Requests (Incremental Sync)

The most important optimization for staying within rate limits.

### How It Works
1. First request to a delta-capable endpoint returns `server_knowledge: N` in the response
2. Subsequent requests pass `?last_knowledge_of_server=N` as a query parameter
3. API returns **only entities that changed** since that knowledge number
4. Deleted entities are returned with a `deleted: true` flag

### Endpoints Supporting Delta
- `GET /budgets/{id}` — full budget delta
- `GET /budgets/{id}/accounts`
- `GET /budgets/{id}/categories`
- `GET /budgets/{id}/payees`
- `GET /budgets/{id}/transactions`
- `GET /budgets/{id}/scheduled_transactions`

### Implementation Strategy
```typescript
// Store server_knowledge per budget per endpoint in SQLite
interface DeltaCache {
  budgetId: string;
  endpoint: string;       // e.g., 'transactions', 'categories'
  serverKnowledge: number;
  lastFetched: string;    // ISO timestamp
}

// On each request, check cache and pass last_knowledge_of_server
async function fetchWithDelta(budgetId: string, endpoint: string) {
  const cached = getDeltaCache(budgetId, endpoint);
  const params = cached ? `?last_knowledge_of_server=${cached.serverKnowledge}` : '';
  const response = await ynabApi.get(`/budgets/${budgetId}/${endpoint}${params}`);
  // Update cache with new server_knowledge
  setDeltaCache(budgetId, endpoint, response.data.server_knowledge);
  return response;
}
```

---

## 5. Authentication

### Personal Access Tokens (Recommended for Desktop App)
- Created at: YNAB Account Settings > Developer Settings
- Sent as: `Authorization: Bearer <token>`
- Best for: individual users accessing their own data
- No expiration (until manually revoked)
- **This is what we should use** — matches our single-user desktop app model

### OAuth 2.0 (For Multi-User Apps)
- Two grant types: Authorization Code (server-side) and Implicit (client-side)
- Authorization Code supports refresh tokens
- Requires registering an OAuth Application in YNAB settings
- More complex but needed for apps serving multiple users
- **Not needed for our use case** but could be added later

### Storage
The token should be stored encrypted in the app's credential store (similar to how other connectors handle API keys). The existing `ConnectorDefinition.requiresAuth: true` flag triggers the auth flow in the UI.

---

## 6. Proposed Tool Set

Based on the API capabilities and what's most useful for AI-assisted budgeting:

### Core Tools (Phase 1)

| Tool Name | Description | Read/Write |
|-----------|-------------|------------|
| `ynab_list_budgets` | List all budgets for the user | Read |
| `ynab_get_budget_summary` | Get budget overview: accounts, age of money, TBB | Read |
| `ynab_list_accounts` | List accounts with balances for a budget | Read |
| `ynab_list_categories` | List category groups and categories with balances | Read |
| `ynab_get_budget_month` | Get category balances for a specific month | Read |
| `ynab_list_transactions` | List transactions with filters (date, account, category, payee) | Read |
| `ynab_create_transaction` | Create a single transaction | Write |
| `ynab_search_payees` | Search payees by name | Read |

### Extended Tools (Phase 2)

| Tool Name | Description | Read/Write |
|-----------|-------------|------------|
| `ynab_update_transaction` | Update an existing transaction (amount, category, memo, etc.) | Write |
| `ynab_approve_transaction` | Approve/unapprove imported transactions | Write |
| `ynab_list_scheduled` | List scheduled/recurring transactions | Read |
| `ynab_create_scheduled` | Create a scheduled transaction | Write |
| `ynab_update_category_budget` | Update budgeted amount for a category in a month | Write |
| `ynab_spending_by_category` | Aggregate spending by category for date range | Read |

### Tool Annotations
All read tools should have `readOnlyHint: true`. Write tools should have `destructiveHint: false` (transactions can be updated/deleted). All tools need `openWorldHint: true` since they call external APIs.

---

## 7. Connector Definition

```typescript
// apps/server/src/connectors/ynab/index.ts
import type { ConnectorDefinition } from '../types';
import { ynabTools } from './tools';

export const ynabConnector: ConnectorDefinition = {
  name: 'ynab',
  displayName: 'YNAB',
  description: 'Access your YNAB budgets, accounts, categories, and transactions. Track spending, create transactions, and analyze your budget.',
  icon: '💰',
  category: 'finance',
  requiresAuth: true,
  tools: ynabTools,
};
```

### File Structure
```
apps/server/src/connectors/ynab/
├── index.ts          # ConnectorDefinition
├── api.ts            # YNAB API client (wraps official SDK or raw fetch)
├── tools.ts          # Tool definitions using sdk tool() helper
├── types.ts          # YNAB-specific types (if needed beyond SDK types)
├── utils.ts          # Milliunit conversion, date helpers
├── delta.ts          # Delta sync / server_knowledge caching
└── ynab.test.ts      # Tests with mocked API responses
```

---

## 8. Official SDK vs. Raw Fetch

### Option A: Official `ynab` npm Package (Recommended)
```bash
# Add to package.json, then run init.sh
"ynab": "^4.0.0"
```

**Pros:**
- Full TypeScript types for all API responses
- Built-in delta request support via `last_knowledge_of_server` parameter
- `utils.convertMilliUnitsToCurrencyAmount()` helper
- Maintained by YNAB team
- Handles auth header automatically

**Cons:**
- Additional dependency (~150KB)
- May have Bun compatibility concerns (uses fetch internally — should be fine)

### Option B: Raw Fetch
**Pros:** No extra dependency, full control
**Cons:** Must maintain types manually, more boilerplate

**Recommendation:** Use the official SDK. It's well-typed, actively maintained, and the milliunit utility alone justifies the dependency.

### SDK Usage Pattern
```typescript
import * as ynab from 'ynab';

const api = new ynab.API(accessToken);

// List budgets
const budgets = await api.budgets.getBudgets();

// Get transactions with delta
const txns = await api.transactions.getTransactions(
  budgetId,
  undefined, // sinceDate
  undefined, // type
  lastKnowledgeOfServer // delta
);
// txns.data.server_knowledge -> store for next call
```

---

## 9. Testing Strategy

### Mock API Responses
```typescript
// ynab.test.ts
import { describe, test, expect, mock } from 'bun:test';

// Mock the ynab SDK
const mockGetBudgets = mock(() => Promise.resolve({
  data: {
    budgets: [
      {
        id: 'budget-1',
        name: 'My Budget',
        last_modified_on: '2026-03-01T00:00:00+00:00',
        currency_format: {
          iso_code: 'USD',
          decimal_digits: 2,
          currency_symbol: '$',
          symbol_first: true,
        },
      },
    ],
  },
}));
```

### Test Scenarios
1. **Budget listing** — multiple budgets, currency formats
2. **Account balances** — checking, savings, credit card, closed accounts
3. **Category listing** — groups with nested categories, hidden categories
4. **Transaction queries** — date filtering, pagination, different transaction types (split, transfer)
5. **Transaction creation** — valid transaction, missing required fields, milliunit conversion
6. **Delta sync** — initial fetch (no knowledge), incremental fetch, handling deleted entities
7. **Budget months** — current month, historical month, To Be Budgeted calculation
8. **Error handling** — 401 (bad token), 404 (bad budget ID), 429 (rate limited), network errors
9. **Milliunit utilities** — conversion to/from display amounts, negative amounts, zero

### Budget Test Scenarios
- Budget with all account types (checking, savings, credit, cash, tracking)
- Budget with overspent categories (negative balances)
- Budget months showing age of money, income vs expense
- Split transactions across multiple categories

---

## 10. Alternative Budgeting Tools Comparison

| Feature | YNAB | Monarch Money | Copilot Money |
|---------|------|---------------|---------------|
| **Official Public API** | Yes (REST v1) | No | No |
| **Official SDK** | Yes (JS, Ruby, Python community) | No | No |
| **Auth Method** | PAT + OAuth 2.0 | Unofficial (email/pass) | Unofficial |
| **Rate Limit** | 200/hr per token | N/A (unofficial) | N/A |
| **Delta Sync** | Yes (server_knowledge) | No | No |
| **Documentation** | Excellent (api.ynab.com) | None (reverse-engineered) | None |
| **Community Libraries** | Many (official + community) | Python only (hammem/monarchmoney) | Swift CLI only |
| **Pricing** | $14.99/mo or $99/yr | $9.99/mo or $99.99/yr | $13/mo or $95/yr |
| **MCP Servers Exist** | 5+ implementations | 1 (robcerda/monarch-mcp-server) | 0 |
| **Stability Risk** | Low (official API) | High (unofficial, can break) | High |

### Monarch Money
- **No official API** — all access is through reverse-engineered GraphQL endpoints
- Community Python library `monarchmoney` (hammem/monarchmoney on GitHub) provides access
- Requires email/password auth (no API tokens)
- Multiple forks exist due to breaking changes from Monarch's domain migration
- **Not recommended** for a production connector due to instability

### Copilot Money
- **No official public API** — only an unofficial Swift CLI (`JaviSoto/copilot-money-cli`)
- No JavaScript/TypeScript library exists
- Apple-platform focused (iOS/macOS only)
- **Not viable** for a connector at this time

### Recommendation
YNAB is the clear winner for a budgeting connector. It is the only service with an official, documented, stable API with an official TypeScript SDK. Monarch Money could be a future Phase 2 addition if they release a public API.

---

## Sources

- [YNAB API Documentation](https://api.ynab.com/)
- [YNAB API Endpoints (v1)](https://api.ynab.com/v1)
- [YNAB JavaScript SDK (ynab on npm)](https://www.npmjs.com/package/ynab)
- [ynab-sdk-js GitHub](https://github.com/ynab/ynab-sdk-js)
- [YNAB API Overview (Support)](https://support.ynab.com/en_us/the-ynab-api-an-overview-BJMgQ3zAq)
- [calebl/ynab-mcp-server](https://github.com/calebl/ynab-mcp-server)
- [EthanKang1/ynab-mcp](https://github.com/EthanKang1/ynab-mcp)
- [mattweg/ynab-mcp](https://github.com/mattweg/ynab-mcp)
- [YNAB MCP Server (PyPI)](https://pypi.org/project/ynab-mcp/)
- [hammem/monarchmoney (Python)](https://github.com/hammem/monarchmoney)
- [JaviSoto/copilot-money-cli](https://github.com/JaviSoto/copilot-money-cli)
- [Marathon Consulting — Building a YNAB MCP Server with .NET 9](https://marathonus.com/about/blog/building-a-ynab-mcp-server-with-ai-and-net-9/)
