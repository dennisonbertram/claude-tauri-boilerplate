# Subscription Tracker Connector Research

**Date:** 2026-03-25
**Issue:** #378
**Purpose:** Research best practices for implementing a Subscription Tracker connector in the desktop app

---

## 1. Executive Summary

A Subscription Tracker connector should take a **hybrid approach**: leverage Plaid's built-in `/transactions/recurring/get` API for automatic detection of recurring charges from linked bank accounts, supplement with local heuristic analysis of transaction history for edge cases Plaid misses, and support manual entry for subscriptions paid via methods not connected through Plaid (cash, crypto, gift cards, employer-provided). All subscription data should be stored locally in SQLite (via `bun:sqlite`), following the existing patterns established by `db-plaid.ts` and `db-tracker.ts`. The connector should expose MCP tools following the `ConnectorDefinition` pattern used by the weather connector.

---

## 2. Available APIs and Services

### 2.1 Plaid Recurring Transactions API (Recommended Primary Source)

Plaid provides a first-party `/transactions/recurring/get` endpoint that is **already available** in the installed `plaid` npm package. This is the strongest option because the app already has Plaid integration with access tokens, accounts, and synced transactions.

**Endpoint:** `POST /transactions/recurring/get`

**Request:** Requires `access_token` and `account_ids` array.

**Response structure (`TransactionsRecurringGetResponse`):**
- `inflow_streams: TransactionStream[]` -- recurring income (salary, refunds, dividends)
- `outflow_streams: TransactionStream[]` -- recurring expenses (subscriptions, bills, rent)
- `updated_datetime: string` -- last update timestamp

**`TransactionStream` fields:**
| Field | Type | Description |
|-------|------|-------------|
| `stream_id` | string | Unique identifier for the recurring stream |
| `account_id` | string | Which account the stream belongs to |
| `description` | string | Transaction description |
| `merchant_name` | string/null | Merchant name (e.g., "Netflix", "Spotify") |
| `first_date` | string | Earliest transaction in the stream |
| `last_date` | string | Most recent transaction in the stream |
| `frequency` | enum | UNKNOWN, WEEKLY, BIWEEKLY, SEMI_MONTHLY, MONTHLY, ANNUALLY |
| `average_amount` | TransactionStreamAmount | Average charge amount with currency |
| `last_amount` | TransactionStreamAmount | Most recent charge amount |
| `is_active` | boolean | Whether the stream is still live |
| `status` | TransactionStreamStatus | Stream status |
| `transaction_ids` | string[] | All transaction IDs in the stream |
| `personal_finance_category` | object/null | Category classification |
| `is_user_modified` | boolean | Whether user has modified the stream |

**`RecurringTransactionFrequency` enum values:**
- `UNKNOWN`, `WEEKLY`, `BIWEEKLY`, `SEMI_MONTHLY`, `MONTHLY`, `ANNUALLY`

**Additional Plaid APIs for stream management:**
- `/transactions/recurring/streams/merge` -- merge multiple detected streams into one
- `RECURRING_TRANSACTIONS_UPDATE` webhook -- notifies when streams change

**Advantages:**
- Already integrated -- access tokens and transaction sync are in place
- Plaid handles the hard ML/heuristic work of detecting recurring patterns
- Normalized merchant names and categories
- Active/inactive status tracking built in
- Webhook support for real-time updates

**Limitations:**
- Only detects patterns from linked bank/credit card accounts
- Requires sufficient transaction history (typically 90+ days)
- May miss irregular subscriptions (annual, quarterly)
- No coverage for subscriptions paid outside Plaid-linked accounts
- Sandbox has limited recurring transaction test data

### 2.2 Dedicated Subscription Tracking Services

**Truebill/Rocket Money:** No public API. They are a consumer product, not an API provider. Their subscription detection is built on Plaid + proprietary ML -- the same approach we can build locally.

**Trim:** Acquired by OneMain Financial. No public API. Same consumer-only model.

**Subtrack / Subscription Tracker APIs:** No established, production-quality third-party API exists specifically for subscription detection as a service. This is a feature typically built on top of transaction data, not outsourced.

**Conclusion:** There is no viable third-party subscription detection API. The correct approach is to build detection logic on top of Plaid data locally.

### 2.3 Open-Source Libraries

No mature open-source library exists specifically for recurring transaction detection in JavaScript/TypeScript. The detection logic is straightforward enough to implement directly (see Section 4).

---

## 3. Recommended Architecture: Hybrid Approach

### Three Data Sources, One Unified View

```
                    +---------------------------+
                    |   Subscription Tracker     |
                    |   Connector (MCP Tools)    |
                    +---------------------------+
                           |          |
              +------------+          +-----------+
              |                                   |
   +----------v----------+            +-----------v-----------+
   | Auto-Detected (Plaid)|            | Manual Entry (User)   |
   | /recurring/get API   |            | Add/edit/delete subs  |
   +----------+-----------+            +-----------+-----------+
              |                                   |
              +-----------------------------------+
                              |
                    +---------v---------+
                    | subscriptions     |
                    | (SQLite table)    |
                    +-------------------+
```

**Source 1: Plaid Recurring API** -- Primary auto-detection. Call `/transactions/recurring/get` for each linked Plaid item. Map `TransactionStream` objects to local subscription records.

**Source 2: Local Heuristic Analysis** -- Fallback for edge cases. Analyze raw `plaid_transactions` data to find patterns Plaid missed (e.g., quarterly charges, annual renewals, variable-amount subscriptions).

**Source 3: Manual Entry** -- User adds subscriptions not visible in bank data (employer-paid, gift card, crypto, shared accounts).

---

## 4. Recurring Transaction Detection Algorithm

### 4.1 Plaid-First Strategy

For accounts with Plaid access tokens, always prefer the Plaid Recurring API. It uses ML models trained on billions of transactions and handles edge cases (merchant name normalization, amount variance, date drift) far better than any local heuristic.

### 4.2 Local Heuristic Fallback

For supplemental detection on existing `plaid_transactions` data:

```
Algorithm: DetectRecurringTransactions(transactions[], lookback_days=180)

1. GROUP transactions by normalized_merchant_name
   - Normalize: lowercase, strip trailing numbers/IDs, collapse whitespace
   - Fuzzy match: Levenshtein distance <= 3 for merchant names

2. For each merchant group with >= 3 transactions:
   a. Sort by date ascending
   b. Compute intervals between consecutive transactions (in days)
   c. Compute median interval and standard deviation

   d. Classify frequency:
      - median 6-8 days, stdev < 3   -> WEEKLY
      - median 13-16 days, stdev < 4  -> BIWEEKLY
      - median 14-17 days, stdev < 4  -> SEMI_MONTHLY
      - median 27-35 days, stdev < 5  -> MONTHLY
      - median 85-100 days, stdev < 15 -> QUARTERLY
      - median 350-380 days, stdev < 30 -> ANNUALLY
      - else -> not recurring, skip

   e. Compute amount stability:
      - coefficient of variation (stdev/mean) < 0.15 -> fixed amount
      - coefficient of variation < 0.40 -> variable amount (e.g., usage-based)
      - else -> not a subscription pattern, skip

   f. Compute confidence score (0-1):
      - Base: 0.5
      - +0.1 per transaction beyond 3 (max +0.3)
      - +0.1 if amount CV < 0.10
      - +0.1 if interval stdev < median * 0.10

3. Filter: confidence >= 0.6

4. Predict next renewal date:
   - last_date + median_interval (rounded to nearest likely day)
   - For MONTHLY: same day-of-month as most recent, next month
   - For ANNUALLY: same month-day, next year
```

### 4.3 Known Subscription Merchant Database

Maintain a local lookup table of ~200 common subscription services for immediate classification:

```typescript
const KNOWN_SUBSCRIPTIONS: Record<string, { category: string; typicalFrequency: string }> = {
  'netflix': { category: 'streaming', typicalFrequency: 'MONTHLY' },
  'spotify': { category: 'streaming', typicalFrequency: 'MONTHLY' },
  'apple.com/bill': { category: 'software', typicalFrequency: 'MONTHLY' },
  'amazon prime': { category: 'shopping', typicalFrequency: 'ANNUALLY' },
  'openai': { category: 'software', typicalFrequency: 'MONTHLY' },
  'anthropic': { category: 'software', typicalFrequency: 'MONTHLY' },
  'github': { category: 'developer', typicalFrequency: 'MONTHLY' },
  // ... ~200 entries
};
```

This accelerates detection and improves categorization when merchant names match.

---

## 5. Data Model (SQLite Schema)

Following the existing patterns in `db-plaid.ts` and `db-tracker.ts`:

### 5.1 Tables

```sql
-- Core subscription records (one per detected or manually entered subscription)
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,

  -- Identity
  name TEXT NOT NULL,                          -- Display name (e.g., "Netflix Premium")
  merchant_name TEXT,                          -- Normalized merchant (e.g., "netflix")
  description TEXT,                            -- User notes
  icon TEXT,                                   -- Emoji or URL
  category TEXT NOT NULL DEFAULT 'other',      -- streaming, software, fitness, news, etc.

  -- Billing
  amount REAL NOT NULL,                        -- Current/expected amount
  currency TEXT NOT NULL DEFAULT 'USD',
  frequency TEXT NOT NULL DEFAULT 'MONTHLY',   -- WEEKLY, BIWEEKLY, SEMI_MONTHLY, MONTHLY, QUARTERLY, ANNUALLY
  billing_day INTEGER,                         -- Day of month (1-31) or day of week (1-7)
  next_renewal_date TEXT,                      -- Predicted next charge date

  -- Status
  status TEXT NOT NULL DEFAULT 'active'
    CHECK(status IN ('active', 'paused', 'cancelled', 'trial', 'expired')),
  started_date TEXT,                           -- When subscription began
  cancelled_date TEXT,                         -- When cancelled (if applicable)
  trial_end_date TEXT,                         -- Free trial end date

  -- Source tracking
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK(source IN ('plaid_recurring', 'plaid_heuristic', 'manual')),
  plaid_stream_id TEXT,                        -- Links to Plaid TransactionStream
  plaid_account_id TEXT,                       -- Which Plaid account
  confidence REAL,                             -- Detection confidence (0-1), NULL for manual

  -- Metadata
  url TEXT,                                    -- Service URL
  tags TEXT DEFAULT '[]',                      -- JSON array of user tags
  shared_with TEXT,                            -- Who shares this subscription

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status, user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_renewal ON subscriptions(next_renewal_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plaid_stream ON subscriptions(plaid_stream_id);

-- Price change history (tracks amount changes over time)
CREATE TABLE IF NOT EXISTS subscription_price_history (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  effective_date TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'detected',     -- detected, manual
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sub_price_history_sub ON subscription_price_history(subscription_id);

-- Links subscriptions to Plaid transactions for audit trail
CREATE TABLE IF NOT EXISTS subscription_transactions (
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL,                -- References plaid_transactions.id
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  PRIMARY KEY (subscription_id, transaction_id)
);
```

### 5.2 DB Access Layer (`db-subscriptions.ts`)

Follow the exact pattern from `db-plaid.ts`:
- Row interfaces with snake_case (matching DB columns)
- Mapper functions converting snake_case to camelCase
- Exported CRUD functions: `createSubscription`, `getSubscriptionsByUser`, `updateSubscription`, `deleteSubscription`
- Filter support: by status, category, source, date range, amount range
- Aggregate queries: `getMonthlySpendTotal`, `getSubscriptionCountByCategory`, `getUpcomingRenewals`

---

## 6. Connector Definition and MCP Tools

### 6.1 Connector Registration

```typescript
// apps/server/src/connectors/subscriptions/index.ts
import type { ConnectorDefinition } from '../types';
import { subscriptionTools } from './tools';

export const subscriptionConnector: ConnectorDefinition = {
  name: 'subscriptions',
  displayName: 'Subscription Tracker',
  description: 'Track, analyze, and manage recurring subscriptions and bills. Auto-detects from linked bank accounts.',
  icon: '🔄',
  category: 'finance',
  requiresAuth: false,  // Uses existing Plaid tokens, no separate auth
  tools: subscriptionTools,
};
```

Register in `apps/server/src/connectors/index.ts`:
```typescript
const CONNECTORS: ConnectorDefinition[] = [weatherConnector, subscriptionConnector];
```

### 6.2 MCP Tool Definitions

| Tool Name | Description | Key Parameters |
|-----------|-------------|----------------|
| `subscription_list` | List all tracked subscriptions | `status?`, `category?`, `sort?` |
| `subscription_add` | Manually add a subscription | `name`, `amount`, `frequency`, `category?`, `startedDate?` |
| `subscription_update` | Update subscription details | `id`, `amount?`, `frequency?`, `status?`, `name?` |
| `subscription_delete` | Remove a subscription | `id` |
| `subscription_detect` | Run auto-detection from Plaid data | `forceRefresh?` |
| `subscription_summary` | Get spending summary and analytics | `period?` (monthly/yearly) |
| `subscription_upcoming` | Get upcoming renewals in next N days | `days?` (default 30) |
| `subscription_cancel_check` | Analyze which subs are least used/most expensive | -- |

### 6.3 Tool Implementation Pattern

Following the weather connector pattern with `tool()` from `@anthropic-ai/claude-agent-sdk`:

```typescript
import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';

const listSubscriptionsTool = tool(
  'subscription_list',
  'List all tracked subscriptions with optional filtering by status and category.',
  {
    status: z.enum(['active', 'paused', 'cancelled', 'trial', 'expired']).optional(),
    category: z.string().optional().describe('Filter by category (e.g., streaming, software)'),
    sort: z.enum(['amount_asc', 'amount_desc', 'renewal_date', 'name']).optional(),
  },
  async (args) => {
    // Implementation: query subscriptions table with filters
    // Return formatted text summary
  },
  { annotations: { title: 'List Subscriptions', readOnlyHint: true } }
);
```

---

## 7. Integration with Existing Plaid Infrastructure

### 7.1 Leveraging Existing Code

The app already has:
- **`plaid-client.ts`** -- Configured Plaid API client with environment handling
- **`db-plaid.ts`** -- `getPlaidItemsByUser()`, `getTransactionsByUser()` with rich filtering
- **`plaid_transactions` table** -- Full transaction history with `merchant_name`, `personal_finance_category`, `amount`, `date`
- **`plaid_items` table** -- Access tokens per institution
- **Transaction sync** -- Incremental sync via `/transactions/sync` with cursor tracking

### 7.2 Sync Workflow

```
1. User enables Subscription Tracker connector
2. On first activation:
   a. For each Plaid item with access_token:
      - Call /transactions/recurring/get with all account_ids
      - Map outflow_streams to subscription records (source='plaid_recurring')
   b. Run local heuristic on plaid_transactions (source='plaid_heuristic')
   c. Deduplicate: prefer plaid_recurring over plaid_heuristic
   d. Store all detected subscriptions

3. Ongoing sync (triggered by Plaid transaction sync or manual refresh):
   a. Re-fetch /transactions/recurring/get
   b. Compare with existing subscriptions:
      - New streams -> create subscription records
      - Changed amounts -> update + log in price_history
      - Disappeared streams -> mark as potentially cancelled
      - Status changes (active/inactive) -> update status
   c. Re-run local heuristic for new transactions
   d. Update next_renewal_date predictions

4. Webhook handler for RECURRING_TRANSACTIONS_UPDATE:
   - Triggers automatic re-sync for the affected item
```

### 7.3 Access Token Reuse

The subscription connector does NOT need its own OAuth flow. It reads from `plaid_items` to get existing access tokens:

```typescript
import { getPlaidItemsByUser } from '../../db/db-plaid';
import { getPlaidClient } from '../../services/plaid-client';

async function fetchPlaidRecurringStreams(db: Database, userId: string) {
  const items = getPlaidItemsByUser(db, userId);
  const allStreams = [];

  for (const item of items) {
    const client = getPlaidClient();
    const accounts = getAccountsByItemId(db, item.itemId, userId);
    const response = await client.transactionsRecurringGet({
      access_token: item.accessToken,
      account_ids: accounts.map(a => a.id),
    });
    allStreams.push(...response.data.outflow_streams);
  }

  return allStreams;
}
```

---

## 8. Subscription Categorization

### 8.1 Category Taxonomy

```typescript
type SubscriptionCategory =
  | 'streaming'        // Netflix, Spotify, Disney+, Hulu, YouTube Premium
  | 'software'         // Adobe, Microsoft 365, Notion, 1Password
  | 'cloud'            // AWS, Vercel, Railway, DigitalOcean
  | 'developer'        // GitHub, JetBrains, Copilot, ChatGPT
  | 'news'             // NYT, WSJ, The Athletic, Substack
  | 'fitness'          // Gym, Peloton, Strava, MyFitnessPal
  | 'food'             // Meal kits, DoorDash DashPass
  | 'shopping'         // Amazon Prime, Costco, Walmart+
  | 'gaming'           // Xbox Game Pass, PlayStation Plus, Steam
  | 'education'        // Coursera, Udemy, Skillshare
  | 'storage'          // iCloud, Google One, Dropbox
  | 'communication'    // Phone plan, Zoom, Slack
  | 'insurance'        // Health, auto, renter's
  | 'utilities'        // Electric, water, internet, cell plan
  | 'finance'          // Credit monitoring, budgeting tools
  | 'other';
```

### 8.2 Categorization Strategy

1. **Plaid's `personal_finance_category`** -- Use first if available from the TransactionStream
2. **Known merchant database** -- Match normalized merchant name against ~200 known services
3. **Keyword matching** -- Pattern match on description (e.g., "gym" -> fitness, "premium" -> check merchant)
4. **User override** -- Always allow manual re-categorization

---

## 9. Testing Strategy

### 9.1 Mock Subscription Data

```typescript
const MOCK_SUBSCRIPTIONS = [
  // Standard monthly
  { name: 'Netflix', amount: 15.49, frequency: 'MONTHLY', category: 'streaming', day: 15 },
  { name: 'Spotify Family', amount: 16.99, frequency: 'MONTHLY', category: 'streaming', day: 3 },
  { name: 'GitHub Pro', amount: 4.00, frequency: 'MONTHLY', category: 'developer', day: 21 },

  // Annual
  { name: 'Amazon Prime', amount: 139.00, frequency: 'ANNUALLY', category: 'shopping', day: null },
  { name: '1Password', amount: 35.88, frequency: 'ANNUALLY', category: 'software', day: null },

  // Variable amount
  { name: 'AWS', amount: null, frequency: 'MONTHLY', category: 'cloud', avgAmount: 47.23, variance: 15.00 },

  // Trial
  { name: 'Cursor Pro', amount: 20.00, frequency: 'MONTHLY', category: 'developer', status: 'trial', trialEnd: '2026-04-15' },

  // Cancelled
  { name: 'Hulu', amount: 17.99, frequency: 'MONTHLY', category: 'streaming', status: 'cancelled', cancelledDate: '2026-02-01' },

  // Biweekly (uncommon but real)
  { name: 'HelloFresh', amount: 59.94, frequency: 'BIWEEKLY', category: 'food', day: null },
];
```

### 9.2 Mock Plaid Transaction Streams

Generate fake `plaid_transactions` rows that form detectable recurring patterns:

```typescript
function generateMockRecurringTransactions(
  merchantName: string,
  amount: number,
  frequency: 'MONTHLY' | 'ANNUALLY' | 'WEEKLY',
  monthsBack: number = 6,
): MockTransaction[] {
  const transactions = [];
  const now = new Date();
  const intervalDays = frequency === 'MONTHLY' ? 30 : frequency === 'ANNUALLY' ? 365 : 7;

  for (let i = 0; i < (monthsBack * 30) / intervalDays; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (i * intervalDays) + Math.floor(Math.random() * 3 - 1)); // +/- 1 day jitter
    const jitteredAmount = amount + (Math.random() * 0.02 - 0.01) * amount; // +/- 1% amount jitter

    transactions.push({
      id: `mock-txn-${merchantName}-${i}`,
      accountId: 'mock-account-1',
      userId: 'mock-user',
      amount: Math.round(jitteredAmount * 100) / 100,
      date: date.toISOString().split('T')[0],
      name: `${merchantName} *1234`,
      merchantName,
      category: 'SUBSCRIPTION',
      pending: false,
    });
  }
  return transactions;
}
```

### 9.3 Edge Cases to Test

| Edge Case | Description | Expected Behavior |
|-----------|-------------|-------------------|
| Price increase | Netflix $15.49 -> $17.99 | Detect change, log in price_history, update amount |
| Cancelled sub | No charge for 2+ expected periods | Mark as potentially cancelled, alert user |
| Annual renewal | Single charge once per year | Detect with >= 2 data points, predict next renewal |
| Quarterly billing | Every 3 months | Detect as custom interval, not confused with irregular |
| Shared/split charge | Amount is half normal | Amount variance may prevent detection; require manual |
| Free trial end | New recurring charge appears | Detect as new subscription, backfill started_date |
| Refund + recharge | Refund followed by recharge (same merchant) | Do not double-count; treat refund as cancellation signal |
| Merchant name variants | "NETFLIX.COM", "Netflix Inc", "NETFLIX" | Normalize to single merchant via fuzzy matching |
| Same merchant, different amounts | Multiple subscription tiers (e.g., iCloud 200GB + Apple Music) | Detect as separate streams (Plaid handles this) |
| Weekend/holiday date drift | Charge on Monday instead of Saturday | Allow +/- 3 day tolerance in interval calculation |
| Currency conversion | International subscription billed in EUR | Store original currency, note conversion |
| Prorated charges | First charge is partial month | Exclude outlier amounts from average calculation |

### 9.4 Test File Structure

```
apps/server/src/connectors/subscriptions/
  __tests__/
    detection.test.ts          -- Heuristic detection algorithm
    plaid-integration.test.ts  -- Plaid recurring API mapping
    tools.test.ts              -- MCP tool input/output
apps/server/src/db/
  db-subscriptions.test.ts     -- CRUD operations, filters, aggregates
```

---

## 10. Implementation Plan

### Phase 1: Data Model + Manual Entry (1-2 days)
1. Create migration `migrateSubscriptionTables` in `migrations.ts`
2. Create `db-subscriptions.ts` with full CRUD
3. Create `apps/server/src/connectors/subscriptions/` directory
4. Implement `subscription_list`, `subscription_add`, `subscription_update`, `subscription_delete` tools
5. Register connector in `connectors/index.ts`
6. Write unit tests for DB layer and tools

### Phase 2: Plaid Auto-Detection (1-2 days)
1. Add `transactionsRecurringGet` call to Plaid client wrapper
2. Implement stream-to-subscription mapping logic
3. Implement `subscription_detect` tool
4. Add deduplication (Plaid stream vs existing manual entries)
5. Write integration tests with mock Plaid responses

### Phase 3: Local Heuristic Fallback (1 day)
1. Implement `DetectRecurringTransactions` algorithm
2. Integrate known merchant database (~200 entries)
3. Merge heuristic results with Plaid results (prefer Plaid)
4. Write comprehensive detection tests with edge cases

### Phase 4: Analytics + Sync (1 day)
1. Implement `subscription_summary` tool (monthly/yearly spend breakdown by category)
2. Implement `subscription_upcoming` tool (renewal calendar)
3. Implement `subscription_cancel_check` tool (cost optimization suggestions)
4. Add price history tracking and change detection
5. Wire up Plaid transaction sync to trigger subscription refresh
6. Add webhook handler for `RECURRING_TRANSACTIONS_UPDATE`

### Phase 5: UI Integration (if applicable)
1. Frontend subscription list view with category grouping
2. Monthly spending chart by category
3. Upcoming renewal calendar/timeline
4. Manual add/edit subscription form
5. Price change notifications

---

## Appendix A: Plaid Sandbox Recurring Transaction Support

Plaid's sandbox environment provides limited recurring transaction test data. For robust testing:
- Use `sandbox` environment with test credentials (`user_good` / `pass_good`)
- The sandbox may return empty or minimal recurring streams
- For thorough testing, mock the Plaid API response at the HTTP level using the `TransactionsRecurringGetResponse` type from the installed `plaid` package
- Create synthetic transaction data in the local `plaid_transactions` table to test the heuristic algorithm independently

## Appendix B: Comparison of Approaches

| Approach | Accuracy | Coverage | Maintenance | Cost |
|----------|----------|----------|-------------|------|
| Plaid Recurring API only | High (ML-based) | Bank accounts only | Low (Plaid maintains) | Included with Transactions product |
| Local heuristic only | Medium | Bank accounts only | Medium (tune params) | Free |
| Manual entry only | Perfect (user-entered) | Complete | Low | Free |
| **Hybrid (recommended)** | **High** | **Complete** | **Medium** | **Included** |

## Appendix C: Related Files in Codebase

| File | Relevance |
|------|-----------|
| `apps/server/src/connectors/types.ts` | `ConnectorDefinition`, `ConnectorToolDefinition` interfaces |
| `apps/server/src/connectors/index.ts` | Connector registry, `createConnectorMcpServer()` |
| `apps/server/src/connectors/weather/tools.ts` | Reference implementation for tool definitions |
| `apps/server/src/db/db-plaid.ts` | Plaid data access layer (transactions, accounts, items) |
| `apps/server/src/db/db-tracker.ts` | Tracker data access pattern (similar CRUD style) |
| `apps/server/src/db/schema.ts` | Main schema + migration exports |
| `apps/server/src/db/migrations.ts` | Migration functions (add `migrateSubscriptionTables`) |
| `apps/server/src/services/plaid-client.ts` | Plaid API client configuration |
| `node_modules/plaid/dist/api.d.ts` | Plaid type definitions incl. `TransactionStream`, `RecurringTransactionFrequency` |
