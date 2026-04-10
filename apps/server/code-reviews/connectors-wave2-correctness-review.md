## Overall assessment (protocol correctness)
- **MCP response format:** All connector tools shown return the expected shape:  
  `{ content: [{ type: 'text', text: string }] }` (and include `isError: true` on error paths).
- **Error handling:** All tool handlers use `try/catch` and return `{ ..., isError: true }` instead of throwing.
- **Schemas:** Zod raw-shape usage is consistent with the SDK `tool()` style, but a few schema details/defaults don’t match descriptions or downstream expectations.

---

## CRITICAL
None found.

---

## HIGH

### 1) Tool naming convention inconsistency (Plaid connector)
**Files:** `src/connectors/plaid/tools.ts`, `src/connectors/plaid/index.ts`, `src/services/mcp-resolver.ts`  
**Issue:** Plaid connector tools are named with the prefix `finance_...` while the connector itself is named `plaid`. All other connectors follow `connectorPrefix_action` (e.g., `gmail_*`, `drive_*`, `calendar_*`).  
**Why this matters:**  
- Breaks naming consistency expectations and increases collision risk if another finance connector is added later.  
- Makes it harder to reason about tool provenance from the name alone.

**Fix options:**
- **Option A (recommended):** Rename tools to `plaid_list_accounts`, `plaid_get_balance`, etc.
- **Option B:** Rename the connector from `plaid` → `finance` (and update `DEFAULT_ENABLED_CONNECTORS`, UI labels, etc.).

---

## MEDIUM

### 2) Calendar list default `maxResults` described but not applied; integer constraint missing
**File:** `src/connectors/calendar/tools.ts` (`calendar_list_events`)  
**Issue(s):**
- Schema description says “default 50” but handler passes `args.maxResults` through as-is (can be `undefined`).
- `maxResults` is `z.number()` but not constrained to integer (`.int()`), even though APIs typically expect an integer count.

**Suggested change:**
- Enforce and apply default in the tool:
  - `maxResults: z.number().int().min(1).max(100).optional()`
  - call service with `args.maxResults ?? 50`

---

### 3) Plaid balance/available balance handling assumes `null`, not `undefined`
**File:** `src/connectors/plaid/tools.ts` (`finance_list_accounts`, `finance_get_balance`)  
**Issue:** Code checks `!== null` and sums when `!== null`, but if DB layer returns `undefined` for balances (common when a column is missing or optional), you can get:
- misleading output (`$NaN` formatting),
- incorrect totals (`totalBalance += undefined` → `NaN`).

**Suggested change:**
- Treat non-numbers as missing:
  - `if (typeof acct.availableBalance === 'number') ...`
  - `if (typeof acct.currentBalance === 'number') { totalBalance += acct.currentBalance; hasTotal = true; }`
- Update `formatCurrency` to handle `undefined` safely (`amount == null`).

---

### 4) Spending summary claims “no limit” but doesn’t enforce it
**File:** `src/connectors/plaid/tools.ts` (`finance_get_spending_summary`)  
**Issue:** Comment says “No limit — we need all transactions”, but it calls `getTransactionsByUser` without an explicit `limit`. If the DB function applies a default limit internally, the aggregation can be wrong while appearing correct.

**Suggested change:** Align the tool with the DB API contract, e.g.:
- pass an explicit “no limit” signal supported by the DB layer (`limit: null`), or
- set a high limit and/or paginate internally, or
- create a dedicated DB function for aggregation.

---

### 5) `initConnectors` global reinitialization can cause cross-call inconsistency
**File:** `src/connectors/index.ts`  
**Issue:** `initConnectors(db)` mutates module-global `allConnectors` and `connectorMap` every call. It’s “idempotent” in a loose sense, but:
- repeated calls rebuild tool instances each time (potentially expensive),
- if different `db` instances are ever passed (tests, multi-profile, future multi-user), tools may unexpectedly switch DB backing,
- concurrent access patterns can observe different connector maps across microtasks.

**Suggested change:**
- Cache per-DB (or ensure a single DB instance is used and guard with a boolean “initialized” flag).
- If multi-DB is possible, make the connector registry instance-scoped rather than module-global.

---

## LOW

### 6) Silent failure hides connector load/init issues
**File:** `src/services/mcp-resolver.ts`  
**Issue:** The `catch {}` around connector import/init swallows all errors, making it hard to diagnose missing connector tools.

**Suggested change:** At least log (or return a diagnostic) in non-test environments.

---

### 7) Date formatting helpers don’t handle invalid dates reliably
**Files:** `src/connectors/calendar/tools.ts`, `src/connectors/drive/tools.ts`  
**Issue:** `new Date(invalid).toLocaleString()` returns `"Invalid Date"` (doesn’t throw), so the `try/catch` won’t help. Output may look broken.

**Suggested change:** Check `isNaN(date.getTime())` and fall back to the raw string.

---

### 8) Annotation semantics: `destructiveHint` on `gmail_send_message`
**File:** `src/connectors/gmail/tools.ts`  
**Issue:** Sending email is a side effect, but not “destructive” in the same sense as delete. Depending on how the host uses `destructiveHint`, this may over-trigger confirmations.

**Suggested change:** Consider a separate “write/side-effect” hint if supported; otherwise leave as-is if your permission UX intentionally treats outbound messages as destructive.

---

CRITICAL: 0  
HIGH: 1  
APPROVED: NO
