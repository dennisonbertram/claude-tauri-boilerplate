# MPP Marketplace Integration Plan

**Status:** Deferred — awaiting review and prioritization

## Context

**Problem:** AI agents in the claude-tauri desktop app currently can't pay for external services. The MPP (Machine Payments Protocol) and x402 ecosystems offer 300+ paid API services (Alchemy, Dune, Anthropic, OpenAI, Shopify, etc.) that agents could use autonomously — but there's no wallet, no service discovery, and no payment flow in the app.

**Goal:** Add a native marketplace experience: users browse available services, fund a wallet, set spending limits, and agents automatically pay for tool calls during chat. Users get full visibility into what their agents spend.

**Outcome:** The app becomes a hub for agent commerce — not just a chat client, but a platform where agents can access any MPP/x402-compatible service with user-controlled spending.

---

## Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Wallet key storage** | **macOS Keychain** via `tauri-plugin-keyring` | OS-level secure storage. Keys never touch disk or SQLite. Rust shell manages keychain, sidecar receives keys only in-memory for signing. |
| Primary network | Tempo (MPP native) | MPP is the Stripe-backed protocol; Tempo is its native settlement layer |
| Secondary network | Base/USDC (x402) | x402 has 200+ services; added in Phase 6 |
| Service registry | Server-side SQLite cache, synced from MPP directory | Instant browsing, works offline, mirrors existing McpPanel pattern |
| Payment flow | Server-side interception in Hono sidecar | Agent tool calls that return 402 are auto-handled; frontend sees payment stream events |
| Approval model | Auto-approve under configurable threshold (default $0.10) | Balances agent speed with user safety. Over-threshold payments show approval banner. |
| New UI entry point | Top-level "Marketplace" view + "Payments" settings tab | Follows existing `activeView` pattern in App.tsx |

### Wallet Architecture (Keychain Bridge)

The wallet private key lives in the **macOS Keychain**, managed by the Tauri Rust shell. The Bun sidecar never accesses the keychain directly. When the sidecar needs to sign a payment, it calls back to the Rust shell via a local HTTP endpoint or Tauri command bridge.

```
┌─────────────────────────────────────────────────┐
│  Tauri Rust Shell                               │
│  ├─ tauri-plugin-keyring → macOS Keychain       │
│  ├─ #[tauri::command] wallet_create             │
│  ├─ #[tauri::command] wallet_sign               │
│  └─ #[tauri::command] wallet_get_address        │
└──────────────┬──────────────────────────────────┘
               │ invoke() from frontend
               │ OR HTTP from sidecar
┌──────────────┴──────────────────────────────────┐
│  React Frontend                                  │
│  invoke('wallet_create', { ... })               │
│  invoke('wallet_sign', { message })             │
└──────────────┬──────────────────────────────────┘
               │ HTTP API calls
┌──────────────┴──────────────────────────────────┐
│  Hono/Bun Sidecar (port 3131)                   │
│  ├─ /api/wallet/* — balance, transactions, etc  │
│  ├─ /api/services/* — registry browsing          │
│  └─ payment-interceptor → calls Rust for signing│
└─────────────────────────────────────────────────┘
```

**Key flow for payments:**
1. Sidecar detects 402 response from an external service
2. Sidecar parses payment challenge (amount, recipient, token)
3. Sidecar calls frontend bridge → `invoke('wallet_sign', { challenge })` → Rust reads key from Keychain → signs → returns signature
4. Sidecar retries request with payment proof
5. Transaction recorded in SQLite

**Alternative flow (simpler MVP):** The Rust shell exposes a tiny HTTP endpoint (e.g., `localhost:3132/sign`) that the sidecar calls directly. This avoids routing through the frontend for server-initiated payments.

---

## Phase 1: Foundation (Types, DB, Keychain Bridge)

### Issue 1.1 — Shared MPP types
**Title:** `feat(shared): Add MPP wallet, transaction, service registry, and spend limit types`

Add to `packages/shared/src/types.ts`:
- `WalletInfo`, `WalletStatus` (`uninitialized | locked | active | error`), `PaymentNetwork` (`tempo | base | polygon`), `PaymentProtocol` (`mpp | x402`)
- `Transaction`, `TransactionStatus` (`pending | confirmed | failed | refunded`), `TransactionType` (`fund | payment | refund`)
- `MppService`, `ServiceCategory` (`data | ai | compute | storage | search | blockchain | other`)
- `SpendLimit` (scope: `global | session | service`, period: `per_session | daily | monthly | total`)
- Payment stream event types: `StreamPaymentRequested`, `StreamPaymentCompleted`, `StreamPaymentFailed`, `StreamPaymentApprovalRequired`
- Wallet API request/response types for all endpoints

---

### Issue 1.2 — Database tables
**Title:** `feat(db): Add wallets, transactions, service_registry, and spend_limits tables`

Add to `apps/server/src/db/schema.ts`:
- `wallets` — id, address, network, status, balance_usd, balance_raw, last_synced_at, created_at, updated_at
  - Note: NO encrypted_key column — keys live in macOS Keychain only
- `transactions` — id, wallet_id, session_id (FK), workspace_id (FK), service_id, service_name, protocol, type, amount_usd, amount_raw, status, tx_hash, error_message, metadata (JSON), created_at, confirmed_at
  - Indexes: wallet_id, session_id, status, created_at
- `service_registry` — id, name, description, provider, protocol, base_url, category, pricing_tier, pricing_details (JSON), logo_url, docs_url, is_active, supported_networks (JSON array), last_synced_at, created_at
  - Indexes: category, protocol
- `spend_limits` — id, scope, scope_id, max_amount_usd, period_type, current_spend_usd, is_active, created_at, updated_at

Add migration function `migrateMppTables(db)` + CRUD helpers.

**Depends on:** 1.1

---

### Issue 1.3 — Tauri Keychain bridge for wallet keys
**Title:** `feat(tauri): Add wallet key management via macOS Keychain using tauri-plugin-keyring`

**Rust changes (`apps/desktop/src-tauri/`):**
1. Add `tauri-plugin-keyring` to `Cargo.toml`
2. Add `reqwest` and `tokio` (for HTTP to sidecar) to `Cargo.toml`
3. Initialize keyring plugin in `src/lib.rs`
4. Add Tauri commands:
   - `wallet_create(network)` — generate Tempo keypair, store private key in Keychain under `service: "claude-tauri-wallet"`, return public address
   - `wallet_get_address()` — read address from Keychain metadata
   - `wallet_sign(challenge: String)` — read key from Keychain, sign the MPP payment challenge, return signature
   - `wallet_exists()` — check if a wallet key exists in Keychain
   - `wallet_delete()` — remove wallet key from Keychain
5. Optionally: expose a tiny signing HTTP endpoint on `localhost:3132` so the sidecar can request signatures without routing through the frontend

**Frontend changes:**
- Add `apps/desktop/src/lib/wallet-bridge.ts` — TypeScript wrapper around `invoke()` calls

**Depends on:** 1.1

---

### Issue 1.4 — Wallet service (sidecar side)
**Title:** `feat(services): Create wallet service for balance sync, transaction recording, and spend limits`

Create `apps/server/src/services/wallet.ts`:
- `syncBalance(walletAddress)` — fetch balance from Tempo RPC, update `wallets` table
- `recordTransaction(tx)` — insert into `transactions` table
- `checkSpendLimit(amount, sessionId?, serviceId?)` — check against `spend_limits` table
- `getSpendForPeriod(scope, scopeId, period)` — sum transactions for spend limit tracking
- `getWalletInfo()` — return wallet status, address, balance from DB

**Depends on:** 1.2, 1.3

---

## Phase 2: Wallet API & UI

### Issue 2.1 — Wallet API routes
**Title:** `feat(routes): Add /api/wallet routes for wallet management`

Create `apps/server/src/routes/wallet.ts`:
- `GET /api/wallet` — wallet info
- `POST /api/wallet` — create wallet
- `GET /api/wallet/balance` — force sync from Tempo RPC
- `GET /api/wallet/transactions` — list with filters
- `GET /api/wallet/transactions/:id` — single transaction
- `POST /api/wallet/approve-payment` — approve pending payment
- `DELETE /api/wallet` — delete wallet

**Depends on:** 1.4

---

### Issue 2.2 — Payments settings panel
**Title:** `feat(ui): Add Payments tab to SettingsPanel with wallet setup and management`

Create `apps/desktop/src/components/settings/PaymentsPanel.tsx` with wallet creation, balance display, spend limits, and transaction history.

New hook: `apps/desktop/src/hooks/useWallet.ts`

**Depends on:** 2.1

---

### Issue 2.3 — Wallet balance in StatusBar
**Title:** `feat(ui): Show wallet balance indicator in StatusBar`

Add `WalletBalanceSegment` polling `GET /api/wallet` every 30s. Color-coded balance display. Click opens payments settings.

**Depends on:** 2.1

---

## Phase 3: Service Registry & Marketplace View

### Issue 3.1 — Service registry sync service
**Title:** `feat(services): Create service registry sync from MPP directory`

Create `apps/server/src/services/service-registry.ts` with sync from MPP directory, startup sync, periodic refresh, and service lookup.

**Depends on:** 1.2

---

### Issue 3.2 — Service registry API routes
**Title:** `feat(routes): Add /api/services routes for browsing the service catalog`

Create `apps/server/src/routes/services.ts` with list, detail, sync trigger, categories, and stats endpoints.

**Depends on:** 3.1

---

### Issue 3.3 — Marketplace view
**Title:** `feat(ui): Add Marketplace view with service browsing, search, and filtering`

Add `'marketplace'` to `activeView` type. Create marketplace components: `MarketplaceView`, `MarketplaceSidebar`, `ServiceGrid`, `ServiceCard`, `ServiceDetail`.

New hook: `apps/desktop/src/hooks/useServices.ts`

**Depends on:** 3.2

---

## Phase 4: Payment Integration with Chat

### Issue 4.1 — Payment interceptor service
**Title:** `feat(services): Create MPP payment interceptor for automatic 402 handling`

Create `apps/server/src/services/payment-interceptor.ts` with `paidFetch()`, challenge parsing, spend limit checking, signing via Keychain bridge, and transaction recording.

**Depends on:** 1.3, 1.4

---

### Issue 4.2 — Wire payments into chat streaming
**Title:** `feat(chat): Integrate payment interceptor into Claude Agent SDK streaming`

Modify chat routes and claude service to intercept tool call HTTP requests with `paidFetch()`. Add payment stream event types to SSE.

**Depends on:** 4.1

---

### Issue 4.3 — Payment approval UI in chat
**Title:** `feat(ui): Add payment approval banner and real-time payment indicators in chat`

Create `PaymentApproval.tsx` (approval banner) and `PaymentIndicator.tsx` (inline payment pills).

**Depends on:** 4.2

---

## Phase 5: Spend Tracking Dashboard

### Issue 5.1 — Spend analytics API
**Title:** `feat(routes): Add /api/wallet/analytics routes for spend tracking`

Add summary, by-service, by-session, and timeline analytics endpoints.

**Depends on:** 1.2

---

### Issue 5.2 — Spend tracking dashboard
**Title:** `feat(ui): Add spend tracking dashboard to Payments settings panel`

Create `SpendSummaryCards`, `SpendByServiceChart`, `SpendTimeline`, `TransactionTable`, and `SpendLimitsManager` components.

**Depends on:** 5.1

---

### Issue 5.3 — Per-session spend in StatusBar
**Title:** `feat(ui): Show per-session MPP spend alongside API cost in StatusBar`

Add `MppSpendSegment` showing "API: $0.12 | Services: $0.03".

**Depends on:** 4.2, 5.1

---

## Phase 6: x402 Compatibility

### Issue 6.1 — x402 protocol handler
**Title:** `feat(services): Add x402 protocol support to payment interceptor`

Extend payment interceptor with x402 challenge parsing, EVM signing, and auto-detection.

**Depends on:** 4.1

---

### Issue 6.2 — x402 service catalog sync
**Title:** `feat(services): Sync x402 service catalog alongside MPP directory`

Extend service registry with x402 source, deduplication, and protocol marking.

**Depends on:** 3.1, 6.1

---

### Issue 6.3 — Multi-network wallet (EVM for x402)
**Title:** `feat(services): Support EVM wallets for x402 alongside Tempo`

Extend Tauri keychain bridge with EVM keypair generation and signing. Multi-wallet UI.

**Depends on:** 1.3, 6.1

---

## Dependency Graph

```
Phase 1:  1.1 → 1.2 → 1.4
          1.1 → 1.3 → 1.4

Phase 2:  1.4 → 2.1 → 2.2, 2.3

Phase 3:  1.2 → 3.1 → 3.2 → 3.3        (parallel with Phase 2)

Phase 4:  1.3 + 1.4 → 4.1 → 4.2 → 4.3  (requires Phase 2 for approval endpoint)

Phase 5:  1.2 → 5.1 → 5.2, 5.3          (parallel with Phase 4)

Phase 6:  4.1 → 6.1 → 6.2, 6.3          (after Phase 4)
```

## MVP Cut Line

**Ship first (Phases 1-4):** Wallet with Keychain storage, service browsing, and automatic payments in chat — 13 issues.

**Fast-follow (Phase 5):** Spend dashboard — 3 issues.

**Later (Phase 6):** x402 compatibility — 3 issues.

---

## Sources

- [Machine Payments Protocol](https://mpp.dev/)
- [Stripe MPP Blog Post](https://stripe.com/blog/machine-payments-protocol)
- [Stripe MPP Docs](https://docs.stripe.com/payments/machine/mpp)
- [x402 Protocol](https://www.x402.org/)
- [x402 Ecosystem](https://www.x402.org/ecosystem)
- [awesome-x402](https://github.com/xpaysh/awesome-x402)
- [tauri-plugin-keyring](https://github.com/HuakunShen/tauri-plugin-keyring)
- [keyring-rs](https://docs.rs/keyring)
