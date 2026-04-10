# Coinbase / Crypto Wallets Connector Research

## Research Date: 2026-03-25
## Issue: #376

---

## 1. Executive Summary

This investigation covers the design of a Coinbase / Crypto Wallets connector for the desktop app. The connector will aggregate Coinbase account data (balances, portfolio, transaction history) alongside on-chain wallet data (EVM token balances, NFTs, transaction history) into a unified portfolio view exposed as MCP tools. The recommended approach uses the existing `ConnectorDefinition` pattern with `@coinbase/coinbase-sdk` for Coinbase API access, `viem` for on-chain reads, CoinGecko for price feeds, and the Alchemy/Etherscan APIs for multi-chain transaction history.

Key distinction: **This connector is for portfolio visibility and read operations**, complementing (not replacing) the existing Tally Agentic Wallet MCP integration which handles on-chain write operations (sends, swaps, deployments).

---

## 2. Existing Ecosystem: Coinbase MCP Servers

### 2.1 Official Coinbase MCP Projects

Three official Coinbase MCP implementations exist:

| Project | npm Package | Purpose | Write Ops? |
|---------|------------|---------|------------|
| **Payments MCP** | `@coinbase/payments-mcp` | Wallet creation, onramp, stablecoin payments via x402 | Yes |
| **Base MCP** | `base-mcp` | On-chain tools for Base network (transfers, NFTs, lending) | Yes |
| **AgentKit MCP Extension** | `@coinbase/agentkit` | Full on-chain agent framework (deploy, swap, transfer) | Yes |

**Why we should NOT use these directly:**
- All three are focused on **write operations** (sending funds, trading, deploying contracts) -- our connector needs **read-only portfolio visibility**
- They run as external stdio MCP servers, not in-process -- incompatible with our `createSdkMcpServer()` architecture
- They overlap with the existing Tally Agentic Wallet integration for on-chain writes
- They require their own wallet/key management, adding unnecessary complexity

**What we can learn from them:**
- Tool naming conventions (e.g., `get_wallet_balance`, `get_token_balance`)
- Error handling patterns for blockchain RPC failures
- Multi-chain address resolution patterns

### 2.2 AgentKit & CDP SDK

The Coinbase Developer Platform (CDP) SDK (`@coinbase/cdp-sdk`) provides:
- Smart Wallet API for gasless transactions
- EVM and Solana account creation
- Policy APIs for transaction governance
- Full viem compatibility via `walletClient`

AgentKit builds on CDP SDK to provide model-agnostic AI agent capabilities. It supports OpenAI Agents SDK, LangChain, and MCP natively.

**Relevance to our connector:** The CDP SDK's read-only account/balance APIs could be useful, but for portfolio reads the simpler `@coinbase/coinbase-sdk` (Advanced Trade API wrapper) is more appropriate.

---

## 3. Coinbase APIs

### 3.1 Advanced Trade API (v3)

Base URL: `https://api.coinbase.com/api/v3/brokerage/{resource}`

Key endpoints for portfolio:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/accounts` | GET | List all accounts with balances |
| `/accounts/{id}` | GET | Single account details |
| `/portfolios` | GET | List portfolios |
| `/portfolios/{id}` | GET | Portfolio breakdown |
| `/orders/historical` | GET | Order/trade history |
| `/products` | GET | Available trading pairs |
| `/products/{id}/candles` | GET | Price history (OHLCV) |
| `/products/{id}/ticker` | GET | Current price/volume |
| `/transactions` | GET | Transaction history |

**Rate limits:** 10 requests/second per API key. 1s cache on public endpoints (bypass with `Cache-Control: no-cache`).

**Authentication:** ES256 (ECDSA) JWT signed with API key + secret. Ed25519 keys are NOT supported with the SDK.

### 3.2 Coinbase App API (v2)

Legacy but still available for user-facing account data:
- `GET /v2/accounts` -- List user's wallets/vaults
- `GET /v2/accounts/{id}/transactions` -- Transaction history
- `GET /v2/exchange-rates` -- Exchange rates
- `GET /v2/prices/{pair}/spot` -- Spot prices

### 3.3 SDK Packages

| Package | Purpose | Recommendation |
|---------|---------|---------------|
| `@coinbase/coinbase-sdk` | Node.js SDK for wallet/transfer/trade APIs | **Use for Coinbase account data** |
| `@coinbase/cdp-sdk` | CDP platform SDK (viem-compatible) | Skip -- overkill for reads |
| `@coinbase/wallet-sdk` | DApp browser connection SDK | Skip -- for web3 dApps |
| `coinbase-advanced-sdk-ts` | TypeScript Advanced Trade SDK (sample) | Reference for API patterns |

---

## 4. On-Chain Data APIs

### 4.1 Alchemy API

Best-in-class for multi-chain token and transaction data:

| Feature | Endpoint | Coverage |
|---------|----------|----------|
| Token balances | `alchemy_getTokenBalances` | All EVM chains |
| Token metadata | `alchemy_getTokenMetadata` | All EVM chains |
| NFT ownership | `getNFTsForOwner` | Ethereum, Polygon, Base, Arbitrum, Optimism |
| Transaction history | `alchemy_getAssetTransfers` | Multi-chain, single request |
| Native balance | `eth_getBalance` | All EVM chains |

**Pricing:** Free tier: 300M compute units/month. Sufficient for portfolio reads.

**Multi-chain:** Single API key works across Ethereum, Polygon, Arbitrum, Optimism, Base, and more. Chain is specified via the RPC URL subdomain.

### 4.2 Etherscan API v2

Unified multi-chain API with a single key across 60+ chains:

| Feature | Endpoint |
|---------|----------|
| ETH balance | `?module=account&action=balance` |
| Token balances | `?module=account&action=tokenbalance` |
| Transaction list | `?module=account&action=txlist` |
| Token transfers | `?module=account&action=tokentx` |
| NFT transfers | `?module=account&action=tokennfttx` |

**Multi-chain:** Add `chainid` parameter to query any supported chain. Single API key works across all Etherscan-supported networks.

**Rate limits:** 5 calls/sec (free), 10 calls/sec (standard), 30 calls/sec (pro).

### 4.3 Recommendation

**Use Alchemy as primary** for token balances and transaction history -- better aggregation, single-request multi-asset queries, and structured response format. Use Etherscan as fallback for chains Alchemy doesn't cover.

---

## 5. Price Feeds

### 5.1 CoinGecko API

The gold standard for aggregated crypto pricing:

| Endpoint | Purpose | Rate |
|----------|---------|------|
| `/simple/price` | Current price for multiple tokens | Free: 10-30 req/min |
| `/simple/token_price/{platform}` | Price by contract address | Free: 10-30 req/min |
| `/coins/markets` | Market data with sorting/pagination | Free: 10-30 req/min |
| `/coins/{id}/market_chart` | Historical price data | Free: 10-30 req/min |

**Key features:**
- 18,000+ coins, 1,000+ exchanges
- Contract-address-based lookup (essential for on-chain tokens)
- Aggregated pricing methodology for accuracy
- Free tier sufficient for portfolio reads (30 calls/min)

### 5.2 Coinbase Price Endpoints

For assets traded on Coinbase, use their native price endpoints:
- `GET /api/v3/brokerage/products/{id}/ticker` -- Real-time price
- `GET /v2/prices/{pair}/spot` -- Spot price (simpler)

### 5.3 Caching Strategy

```
Price data TTL hierarchy:
- Spot prices: 30-60 seconds (portfolio display)
- Market cap/volume: 5 minutes
- Historical charts: 1 hour
- Token metadata: 24 hours
- Supported token list: 24 hours
```

Use in-memory cache (Map with TTL) for the Bun process. No need for Redis -- the app is single-user desktop.

---

## 6. Authentication

### 6.1 Coinbase Auth Options

| Method | Use Case | Our Recommendation |
|--------|----------|-------------------|
| **API Key + Secret** | Access own account only | **Primary -- simplest for desktop** |
| **OAuth 2.0** | Access other users' accounts | Not needed (single user) |
| **CDP API Key (ES256)** | Platform/developer features | Only if using CDP SDK |

**API Key setup:**
1. User creates API key at `coinbase.com/settings/api`
2. Key + secret stored encrypted in SQLite (same pattern as Plaid credentials in `plaid-encryption.ts`)
3. JWT signed per-request with ES256 algorithm
4. Permissions: `wallet:accounts:read`, `wallet:transactions:read`, `wallet:buys:read`

**Security requirements:**
- Store API secret encrypted at rest (follow existing `plaid-encryption.ts` pattern)
- Validate Coinbase SSL certificates
- Never log or expose API secrets
- Support key regeneration flow

### 6.2 On-Chain Wallet Auth

No auth needed -- wallet addresses are public. User provides:
- One or more EVM addresses (validated with `viem.isAddress()`)
- Optional ENS names (resolved via `viem` public client)
- Addresses stored in SQLite alongside connector config

### 6.3 API Key Auth for Data Providers

| Provider | Auth Method | Storage |
|----------|------------|---------|
| Alchemy | API key in RPC URL | Env var `ALCHEMY_API_KEY` (already in `~/.zshrc`) |
| Etherscan | API key query param | Env var `ETHERSCAN_API_KEY` (already in `~/.zshrc`) |
| CoinGecko | API key header (optional) | Env var or free tier (no key) |

---

## 7. Proposed Connector Architecture

### 7.1 Connector Definition

```typescript
// apps/server/src/connectors/crypto/index.ts
export const cryptoConnector: ConnectorDefinition = {
  name: 'crypto',
  displayName: 'Crypto Wallets',
  description: 'View Coinbase portfolio and on-chain wallet balances, transactions, and token holdings.',
  icon: '💰',
  category: 'finance',
  requiresAuth: true, // Coinbase API key required; on-chain addresses are optional
  tools: cryptoTools,
};
```

### 7.2 Tool Definitions

Nine tools organized into three groups:

**Portfolio Overview:**

| Tool | Description |
|------|-------------|
| `crypto_portfolio_summary` | Aggregated portfolio value across Coinbase + on-chain wallets |
| `crypto_coinbase_accounts` | List Coinbase account balances and holdings |
| `crypto_onchain_balances` | ERC-20 token balances for tracked wallet addresses |

**Transaction History:**

| Tool | Description |
|------|-------------|
| `crypto_coinbase_transactions` | Recent Coinbase trades, sends, receives |
| `crypto_onchain_transactions` | On-chain transaction history for tracked addresses |
| `crypto_transaction_search` | Search transactions by token, date range, or amount |

**Market Data:**

| Tool | Description |
|------|-------------|
| `crypto_price` | Current price for a token (by symbol or contract address) |
| `crypto_price_history` | Historical price chart data |
| `crypto_market_overview` | Top tokens by market cap with 24h changes |

### 7.3 Service Layer

```
connectors/crypto/
  index.ts              # ConnectorDefinition
  tools.ts              # Tool definitions using SDK tool() helper
  services/
    coinbase-client.ts  # Coinbase API wrapper (Advanced Trade v3)
    onchain-client.ts   # Alchemy/viem for on-chain reads
    price-service.ts    # CoinGecko + Coinbase price aggregation
    cache.ts            # In-memory TTL cache
  types.ts              # Shared types (TokenBalance, Transaction, etc.)
  crypto.test.ts        # Unit tests
```

### 7.4 Multi-Chain Support

Supported chains for on-chain reads:

| Chain | Chain ID | Alchemy Support | Etherscan Support |
|-------|----------|-----------------|-------------------|
| Ethereum | 1 | Yes | Yes |
| Base | 8453 | Yes | Yes (Basescan) |
| Polygon | 137 | Yes | Yes (Polygonscan) |
| Arbitrum | 42161 | Yes | Yes (Arbiscan) |
| Optimism | 10 | Yes | Yes (Optimistic) |
| Solana | -- | No (use Helius) | No |

Start with Ethereum + Base (most Coinbase users), expand to others based on user demand.

---

## 8. Relationship to Tally Agentic Wallet

Clear separation of concerns:

| Capability | Tally Wallet MCP | Crypto Connector |
|-----------|------------------|-----------------|
| Send tokens | Yes | No (read-only) |
| Swap tokens | Yes | No |
| Deploy contracts | Yes | No |
| View balances | Limited | **Comprehensive** |
| Transaction history | No | **Yes** |
| Coinbase account data | No | **Yes** |
| Price feeds | No | **Yes** |
| Portfolio aggregation | No | **Yes** |
| Multi-chain overview | Limited | **Yes** |

The connector answers "What do I have?" while Tally answers "What can I do?"

---

## 9. Testing Strategy

### 9.1 Coinbase Sandbox

- Sandbox URL: `https://public.sandbox.pro.coinbase.com`
- Separate API keys required (generated on sandbox site)
- Uses Bitcoin testnet3 -- no real funds
- Mirrors production API behavior
- Simulated market data for order/trade testing

### 9.2 On-Chain Testing

- Use known public addresses with diverse token holdings for integration tests
- Alchemy/Etherscan free tiers sufficient for test queries
- Vitalik's address (`0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`) is a good multi-token test case
- Base Sepolia testnet for Base-specific testing

### 9.3 Unit Test Approach

```typescript
// Mock the service layer, test tool handlers
// Follow existing weather connector test pattern

// 1. Mock Coinbase API responses
const mockAccounts = [
  { uuid: '...', name: 'BTC Wallet', currency: 'BTC', available_balance: { value: '1.5', currency: 'BTC' } },
  { uuid: '...', name: 'ETH Wallet', currency: 'ETH', available_balance: { value: '10.0', currency: 'ETH' } },
];

// 2. Mock Alchemy token balance responses
const mockTokenBalances = [
  { contractAddress: '0xA0b8...', tokenBalance: '0x...', symbol: 'USDC', decimals: 6 },
];

// 3. Mock CoinGecko price responses
const mockPrices = { bitcoin: { usd: 67000 }, ethereum: { usd: 3500 } };
```

### 9.4 Test Matrix

| Test | Type | What It Verifies |
|------|------|-----------------|
| Portfolio aggregation math | Unit | Correct USD totals across sources |
| Coinbase API key validation | Unit | Graceful error on invalid/missing keys |
| Address validation | Unit | `viem.isAddress()` + ENS resolution |
| Multi-chain balance merge | Unit | Deduplication across chains |
| Price cache TTL | Unit | Cache expiry and refresh behavior |
| Coinbase sandbox integration | Integration | Real API call to sandbox |
| Alchemy balance fetch | Integration | Real API call with test address |
| Tool error handling | Unit | Network failures return `isError: true` |

---

## 10. Implementation Plan

### Phase 1: Core Read-Only Portfolio (MVP)
1. Create `connectors/crypto/` directory structure
2. Implement `coinbase-client.ts` with Advanced Trade API v3 wrapper
3. Implement `crypto_coinbase_accounts` tool
4. Implement `crypto_price` tool (CoinGecko)
5. Implement `crypto_portfolio_summary` tool
6. Add encrypted credential storage (extend `plaid-encryption.ts` pattern)
7. Register connector in `connectors/index.ts`
8. Write unit tests for all tools
9. Sandbox integration test

### Phase 2: On-Chain Wallets
1. Implement `onchain-client.ts` with Alchemy + viem
2. Implement `crypto_onchain_balances` tool
3. Implement `crypto_onchain_transactions` tool
4. Add multi-chain support (Ethereum + Base initially)
5. Wallet address management in SQLite
6. Integration tests with known public addresses

### Phase 3: Advanced Features
1. `crypto_transaction_search` with filtering
2. `crypto_price_history` with charting data
3. `crypto_market_overview` for market context
4. Portfolio performance tracking (daily P&L)
5. NFT holdings via Alchemy NFT API
6. Additional chains (Polygon, Arbitrum, Optimism)

### Dependencies to Install

```json
{
  "@coinbase/coinbase-sdk": "^0.12.x",
  "viem": "^2.x"
}
```

Note: `zod` and `@anthropic-ai/claude-agent-sdk` are already in the monorepo. CoinGecko, Alchemy, and Etherscan APIs are REST-based -- no SDK packages needed (use native `fetch()`).

### Estimated Effort
- Phase 1: 3-4 hours (6 files, ~800 LOC)
- Phase 2: 3-4 hours (4 files, ~600 LOC)
- Phase 3: 4-6 hours (extensions to existing files)

---

## Sources

- [Coinbase Payments MCP](https://github.com/coinbase/payments-mcp)
- [Base MCP Server](https://github.com/base/base-mcp)
- [AgentKit MCP Extension Docs](https://docs.cdp.coinbase.com/agent-kit/core-concepts/model-context-protocol)
- [Coinbase AgentKit GitHub](https://github.com/coinbase/agentkit)
- [Coinbase Advanced Trade API Docs](https://docs.cdp.coinbase.com/coinbase-app/advanced-trade-apis/rest-api)
- [Coinbase API Key Authentication](https://docs.cdp.coinbase.com/coinbase-app/authentication-authorization/api-key-authentication)
- [Coinbase OAuth2 Docs](https://docs.cdp.coinbase.com/coinbase-app/docs/coinbase-app)
- [Coinbase Sandbox Environment](https://docs.cdp.coinbase.com/coinbase-business/checkout-apis/sandbox)
- [@coinbase/coinbase-sdk npm](https://www.npmjs.com/package/@coinbase/coinbase-sdk)
- [@coinbase/cdp-sdk npm](https://www.npmjs.com/package/@coinbase/cdp-sdk)
- [Alchemy Token API](https://www.alchemy.com/token-api)
- [Alchemy Transaction History](https://www.alchemy.com/docs/transaction-history)
- [Etherscan API v2 Multichain](https://info.etherscan.com/etherscan-api-v2-multichain/)
- [CoinGecko API Docs](https://docs.coingecko.com/reference/introduction)
- [Viem - TypeScript Ethereum Interface](https://viem.sh/)
- [Coinbase Developer Platform](https://www.coinbase.com/developer-platform)
