## Verification of previously found HIGH issue (Plaid naming inconsistency)

**Status: FIXED.**  
All Plaid tools are consistently named with the `plaid_*` prefix:

- `plaid_list_accounts`
- `plaid_get_balance`
- `plaid_search_transactions`
- `plaid_get_spending_summary`
- `plaid_list_institutions`

And the connector itself is consistently registered under `name: "plaid"` and enabled via `DEFAULT_ENABLED_CONNECTORS` as `"plaid"` (not `"finance"`). No remaining `finance_*` tool naming appears in the provided subset.

---

## Remaining protocol/correctness issues (by severity)

### CRITICAL (0)
None found.

---

### HIGH (0)
None found.

---

### MEDIUM (3)

1) **`calendar_update_event` may pass `undefined` fields through as updates**
- **File:** `src/connectors/calendar/tools.ts` (`createUpdateEventTool`)
- **Problem:** `const { eventId, calendarId, ...updates } = args;` can yield an `updates` object containing keys whose values are `undefined` (depending on how the SDK/Zod materializes optional properties).
- **Why it matters:** Many downstream APIs interpret explicit `undefined`/null-ish fields differently than “field absent”, potentially clearing fields or causing validation errors.
- **Fix:** Sanitize updates before calling the service, e.g.:
  - `const updates = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));`

2) **`calendar_update_event` allows “no-op” updates (only `eventId`)**
- **File:** `src/connectors/calendar/tools.ts` (`createUpdateEventTool`)
- **Problem:** The schema permits calling with just `{ eventId }`, producing an empty update set.
- **Why it matters:** This is an input-contract footgun; service may error, silently no-op, or behave unexpectedly.
- **Fix:** Add a schema refinement requiring at least one mutable field:
  - e.g. `.refine(args => !!(args.summary || args.start || args.end || args.description || args.location), { message: "At least one field must be provided to update." })`
  - and return `isError: true` for this validation failure (the SDK may already surface schema errors, but refinement keeps it explicit and consistent).

3) **`plaid_get_balance` “account not found” does not set `isError: true`**
- **File:** `src/connectors/plaid/tools.ts` (`createGetBalanceTool`)
- **Problem:** When `accountId` is provided but not found, it returns a normal (non-error) tool result.
- **Why it matters:** This is an invalid-input case and should be marked as an error for consistent MCP tool semantics (similar to `gmail_send_message` invalid email).
- **Fix:** Add `isError: true` in the “Account not found” branch.

---

### LOW (5)

1) **Numeric schemas should generally be `.int()` where appropriate**
- **Files:** `calendar_list_events.maxResults` uses `z.number()` (not `.int()`), etc.
- **Impact:** Minor; floats could slip through to services expecting integers.

2) **Calendar time formatting try/catch doesn’t catch “Invalid Date”**
- **File:** `src/connectors/calendar/tools.ts` (`formatEventTime`)
- **Problem:** `new Date(bad).toLocaleString()` typically returns `"Invalid Date"` rather than throwing.
- **Impact:** Minor formatting correctness.

3) **Plaid total balance formatting assumes USD even if accounts have different currencies**
- **File:** `src/connectors/plaid/tools.ts` (`createGetBalanceTool`)
- **Problem:** `formatCurrency(totalBalance)` defaults to USD.
- **Impact:** Minor, but can mislead if multi-currency exists.

4) **`resolveSessionMcpServers` swallows connector-load errors silently**
- **File:** `src/services/mcp-resolver.ts`
- **Impact:** Debuggability issue; consider logging.

5) **Write tools don’t consistently include explicit “confirm” guidance beyond description**
- **Examples:** `calendar_create_event`, `drive_upload_file` (whereas `gmail_send_message` explicitly warns).
- **Impact:** Not a protocol break, but helpful for safety/consent alignment.

---

## Summary / Decision

- CRITICAL: **0**
- HIGH: **0**
- MEDIUM: **3**
- LOW: **5**

**APPROVED: NO** (MEDIUM issues remain that can affect tool correctness and update semantics).
