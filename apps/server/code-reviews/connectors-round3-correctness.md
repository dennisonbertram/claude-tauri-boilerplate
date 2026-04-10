Verified previous fixes:

- Calendar undefined-field update fix: VERIFIED in `src/connectors/calendar/tools.ts` via filtering `undefined` values before calling `updateEvent`.
- Calendar no-op update fix: VERIFIED in `src/connectors/calendar/tools.ts` via explicit `isError: true` response when no mutable fields are provided.
- Plaid missing `isError` fix: VERIFIED in `src/connectors/plaid/tools.ts`; Plaid error paths now consistently return `isError: true`.

## HIGH

1. **Incorrect Plaid total balance currency handling**
   - File: `src/connectors/plaid/tools.ts` (`createGetBalanceTool`)
   - Issue: The aggregate total is built as a raw numeric sum and then formatted with `formatCurrency(totalBalance)`, which defaults to USD. This is wrong for:
     - any non-USD account set, and
     - any mixed-currency account set.
   - Impact: The finance connector can return materially incorrect totals.
   - Fix: Only compute a total when all included accounts share the same `currencyCode`, and format using that currency. Otherwise either:
     - group totals by currency, or
     - omit the cross-account total.

## MEDIUM

1. **Calendar regression test is stale and no longer validates the fixed no-op behavior**
   - File: `src/connectors/calendar/calendar.test.ts`
   - Issue: The test `returns error response when service throws` calls `calendar_update_event` with only `eventId`. The implementation now correctly short-circuits with the new “at least one field must be provided” error, so this test will fail and does not verify the intended service-throw path.
   - Fix: Update that test to include at least one mutable field, and add a dedicated no-op update test asserting the new validation error.

2. **`openWorldHint` annotations are incorrect for all live external-service tools**
   - Files: `src/connectors/gmail/tools.ts`, `src/connectors/calendar/tools.ts`, `src/connectors/drive/tools.ts`, `src/connectors/plaid/tools.ts`
   - Issue: All tools set `openWorldHint: false`, but these tools read/write live email, calendar, drive, and financial data.
   - Impact: Metadata is misleading for MCP/tooling semantics.
   - Fix: Set `openWorldHint: true` for these connectors' tools.

3. **Several numeric inputs that should be integers are not enforced as integers**
   - Files:
     - `src/connectors/calendar/tools.ts` → `calendar_list_events.maxResults`
     - `src/connectors/gmail/tools.ts` → `gmail_list_messages.maxResults`
     - `src/connectors/plaid/tools.ts` → `plaid_search_transactions.limit`
   - Issue: Schemas use `z.number()` with bounds but not `.int()`.
   - Impact: Decimal values can pass schema validation despite downstream APIs expecting integer counts.
   - Fix: Add `.int()` to those fields.

## LOW

1. **Connector registry has a hidden initialization-order dependency**
   - File: `src/connectors/index.ts`
   - Issue: `getAllConnectors()` and `getConnectorTools()` only include factory connectors after `initConnectors(db)` is called, but that dependency is implicit.
   - Impact: Easy to get incomplete connector lists outside `mcp-resolver`.
   - Fix: Make initialization explicit in API shape, or lazily initialize with injected deps at call site.

2. **Date/time inputs are documented but not actually validated**
   - Files: `src/connectors/calendar/tools.ts`, `src/connectors/plaid/tools.ts`
   - Issue: Fields described as ISO timestamps or `YYYY-MM-DD` dates are plain `z.string()`.
   - Impact: Bad inputs reach service/db layers unnecessarily.
   - Fix: Add `refine()`/regex validation for documented date formats.

3. **Silent connector import failure can mask production issues**
   - File: `src/services/mcp-resolver.ts`
   - Issue: The connector import/init block is wrapped in a blanket `catch {}`.
   - Impact: Real connector registration failures degrade silently.
   - Fix: Log the error or emit a diagnostic while still allowing graceful fallback.

## Counts

- CRITICAL: 0
- HIGH: 1
- MEDIUM: 3
- LOW: 3

APPROVED: NO
