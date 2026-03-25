# Plaid Finance Component Frontend Tests

## Summary

Added 5 test files covering all Plaid finance UI components with 15 total test cases.

## Test Files Created

### 1. `apps/desktop/src/components/finance/__tests__/FinanceDashboard.test.tsx`
- Renders loading state (spinner + "Loading financial data...")
- Renders empty state with connect button when no items
- Renders accounts when items exist (shows Finance heading, Connected Institutions, bank name)
- Renders error state with retry button

### 2. `apps/desktop/src/components/finance/__tests__/TransactionList.test.tsx`
- Renders transactions (merchant names visible in table)
- Renders empty state ("No transactions yet")
- Renders loading skeletons (5 rows of animate-pulse elements)
- Renders search input for filtering

### 3. `apps/desktop/src/components/finance/__tests__/InstitutionCard.test.tsx`
- Renders institution name and accounts (name, mask, "Connected" badge)
- Shows error badge when item has generic error
- Shows "Needs Reauth" badge for items with ITEM_LOGIN_REQUIRED error

### 4. `apps/desktop/src/components/finance/__tests__/ConnectBankButton.test.tsx`
- Renders button with "Connect Bank Account" text
- Calls connect handler on click

### 5. `apps/desktop/src/components/finance/__tests__/DisconnectDialog.test.tsx`
- Shows confirmation message ("Disconnect Chase?")
- Calls disconnect with item ID on confirm
- Closes on cancel
- Does not render when isOpen is false

## Mocking Strategy

- All `@/hooks/usePlaid` hooks are mocked per test file with mutable default return objects reset in `beforeEach`
- `@phosphor-icons/react` icons are stubbed as `<svg data-testid="icon" />` components
- No Tauri APIs needed mocking since hooks abstract those away
- FinanceDashboard required mocking all hooks used by child components (usePlaidTransactions, useDisconnectBank, usePlaidAccounts, useConnectBank)

## Test Results

All 15 new tests pass. Pre-existing `AppSidebar.test.tsx` failure (missing `CurrencyDollar` icon mock) is unrelated.
