# Plaid Phase 4 — Frontend UI Implementation

## Summary

Implemented the complete frontend UI for Plaid financial data integration, including API client layer, React hooks, UI components, routing, navigation, and deep link handler integration.

## Files Created

### API Client
- `apps/desktop/src/lib/api/plaid-api.ts` — Low-level API functions for all Plaid server endpoints (link flow, items CRUD, accounts, transactions, sync). Follows the same pattern as `documents-api.ts`, using `apiFetch` from `api-config.ts`.

### React Hooks
- `apps/desktop/src/hooks/usePlaid.ts` — Eight hooks:
  - `usePlaidItems()` — Fetch connected institutions
  - `usePlaidAccounts(filters?)` — Fetch accounts with optional filtering
  - `usePlaidTransactions(filters?)` — Fetch transactions with full pagination/filter support
  - `useConnectBank()` — Initiate Plaid Hosted Link flow, opens URL via Tauri shell
  - `useReauthBank()` — Initiate update-mode reauth for broken connections
  - `useDisconnectBank()` — Remove an institution
  - `useSyncStatus(pollInterval?)` — Poll sync job status with auto-polling when active
  - `useRefreshBalances()` — Trigger balance refresh
  - `useTriggerSync()` — Trigger transaction sync

- `apps/desktop/src/hooks/usePlaidDeepLink.ts` — Deep link handler that:
  - Checks for pending deep links on mount (cold start) via `invoke('get_pending_deep_link')`
  - Listens for `plaid-callback` events from Tauri backend (warm start)
  - Deduplicates callbacks by state nonce
  - Calls `finalizeLinkSession` when a valid callback is received

### UI Components
All in `apps/desktop/src/components/finance/`:

- **`FinanceDashboard.tsx`** — Main page with Overview/Transactions tabs, connected institutions grid, accounts list, transaction preview. Handles empty state (no banks connected), loading, and error states.
- **`ConnectBankButton.tsx`** — Button that initiates Plaid Hosted Link flow via Tauri `shell.open` (falls back to `window.open` in dev).
- **`AccountsList.tsx`** — Account cards grouped by type (depository, credit, loan, investment) with balance display.
- **`InstitutionCard.tsx`** — Card showing institution logo/color, accounts, health badge (healthy/reauth_required/error/consent_expiring), sync status, and disconnect menu.
- **`TransactionList.tsx`** — Full transaction table with search, date range filters, sortable columns (date, amount), pagination, loading skeletons, and empty states.
- **`DisconnectDialog.tsx`** — Confirmation modal for removing an institution, shows affected accounts.
- **`ReauthBanner.tsx`** — Amber warning banner for items needing re-authentication with "Reconnect" button.
- **`SyncStatusIndicator.tsx`** — Compact indicator showing sync state (spinning for active, checkmark for complete, warning for failed, relative timestamps).
- **`LinkFlowFallback.tsx`** — "Complete Connection" UI that polls session status every 3s, for when the deep link fails to trigger.
- **`index.ts`** — Barrel exports for all components.

### Files Modified

- `apps/desktop/src/lib/routes.ts` — Added `finance` route and `'finance'` to `ActiveView` union type
- `apps/desktop/src/components/AppSidebar.tsx` — Added `CurrencyDollar` icon import and "Finance" entry to `navItems` array
- `apps/desktop/src/App.tsx` — Added `FinanceDashboard` import, `usePlaidDeepLink` hook call, and `finance` view in the render conditional
- `apps/desktop/src/components/__tests__/AppSidebar.test.tsx` — Updated `ActiveView` type in test to include `'finance'`

## Architecture Decisions

- **API layer separation**: `plaid-api.ts` handles all HTTP concerns; hooks handle state management. This matches the existing `documents-api.ts` / `useDocuments.ts` pattern.
- **Tauri shell.open**: Used for opening Plaid Hosted Link in the system browser, with `window.open` fallback for browser dev mode.
- **Auto-polling**: `useSyncStatus` automatically starts/stops polling when sync jobs are active, avoiding unnecessary network requests.
- **Deep link deduplication**: `usePlaidDeepLink` tracks processed state nonces to prevent double-finalization.
- **Types from shared package**: All Plaid types imported from `@claude-tauri/shared` (which re-exports from `packages/shared/src/plaid.ts`).

## Type Safety

All new files pass `tsc --noEmit` with zero errors. The `ActiveView` union type was updated in routes, sidebar, and test files to include `'finance'`.

## What's NOT Included (Needs Backend)

- Server API routes (Phase 2) must be implemented for these hooks to work
- Tauri deep-link plugin registration (Phase 3) must be configured in `tauri.conf.json` and Rust backend
- The `get_pending_deep_link` Tauri command must be implemented in Rust
