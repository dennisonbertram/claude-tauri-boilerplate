# Amazon Order Tracking Connector Research

**Date:** 2026-03-25
**Issue:** #389
**Category:** Shopping & Delivery
**Priority:** Medium | **Complexity:** High

---

## 1. Problem Statement

Users want to ask their AI assistant "Where's my Amazon package?" or "What did I order recently?" without switching to the Amazon app/website. An Amazon Order Tracking connector would surface order history, shipment status, and delivery ETAs directly through the Claude desktop app's MCP tool interface.

Amazon does not provide a consumer-facing API for personal order data, making this one of the more complex connectors to implement. The challenge is finding a reliable, legal, privacy-respecting approach to extract and track order data.

---

## 2. Approach Comparison

| Approach | Viability | Auth Complexity | Legal Risk | Data Quality | Maintenance |
|----------|-----------|-----------------|------------|--------------|-------------|
| **A. Gmail email parsing** | High | Medium (OAuth) | None | Good | Medium |
| **B. Amazon SP-API** | None | N/A | N/A | N/A | N/A |
| **C. Web scraping Amazon.com** | Low | High | **Very High** | High | Very High |
| **D. rigwild/mcp-server-amazon** | Medium | High (cookies) | Medium | High | High |
| **E. Hybrid: Gmail + tracking API** | **High** | Medium | **None** | **Best** | Medium |

### Approach A: Gmail Email Parsing (Recommended Primary)

Parse Amazon order confirmation and shipping notification emails from the user's Gmail. Amazon sends structured emails for: order confirmations, shipping notifications (with tracking numbers), delivery confirmations, and return/refund updates.

**Pros:**
- Legally clean -- user explicitly grants Gmail read access via OAuth
- Already have Gmail MCP integration in the project (claude_ai_Gmail tools)
- Amazon email format is relatively stable
- Works for all Amazon marketplaces (.com, .co.uk, .de, etc.)

**Cons:**
- Delayed data (depends on when Amazon sends emails)
- Missing data if user has email filters/deletions
- Email format can change without notice
- Does not capture items within multi-item orders as granularly

### Approach B: Amazon SP-API (Not Viable)

The Selling Partner API is exclusively for Amazon sellers and vendors. It requires seller credentials, a registered developer application approved by Amazon, and is designed for managing business operations -- not consumer order tracking. There is no consumer-facing Amazon API for personal order history.

### Approach C: Web Scraping (Not Recommended)

Amazon's Conditions of Use explicitly prohibit "the use of any robot, spider, scraper, or other automated means to access Amazon Services for any purpose." Scraping login-protected order data carries the highest legal risk:
- Violates Amazon ToS and potentially the Computer Fraud and Abuse Act (CFAA)
- Amazon actively detects and blocks automated access
- Requires storing Amazon credentials (severe security liability)
- Amazon has pursued legal action against scrapers

### Approach D: rigwild/mcp-server-amazon (Reference Only)

An existing open-source MCP server (github.com/rigwild/mcp-server-amazon) provides product search, cart management, and order history access. However, it operates by using browser cookies/session tokens, which is essentially automated access to Amazon's authenticated pages -- the same ToS concerns as scraping. Useful as an architectural reference but not suitable for production use.

### Approach E: Hybrid Gmail + Tracking API (Recommended)

Combine Gmail email parsing for order extraction with a dedicated package tracking API (AfterShip, Ship24, or 17track) for real-time shipment status. This gives the best of both worlds: order history from email, live tracking from carrier APIs.

---

## 3. Recommended Architecture: Gmail + Tracking API

### Data Flow

```
User's Gmail  --(Gmail API)-->  Email Parser  --(extract)-->  Order Records (SQLite)
                                                                    |
                                                                    v
                                                            Tracking Numbers
                                                                    |
                                                            Tracking API (AfterShip/Ship24)
                                                                    |
                                                                    v
                                                            Live Shipment Status
```

### MCP Tools to Expose

Following the existing ConnectorDefinition pattern (`apps/server/src/connectors/types.ts`):

```typescript
// Connector definition
const amazonOrdersConnector: ConnectorDefinition = {
  name: 'amazon-orders',
  displayName: 'Amazon Orders',
  description: 'Track Amazon orders and deliveries via Gmail email parsing',
  icon: '📦',
  category: 'lifestyle',  // or add 'shopping' to ConnectorCategory
  requiresAuth: true,      // requires Gmail OAuth
  tools: amazonOrderTools,
};
```

**Tool 1: `amazon_orders_list`**
- List recent Amazon orders (parsed from Gmail)
- Parameters: `{ days?: number, status?: 'all' | 'shipped' | 'delivered' | 'pending' }`
- Returns: order number, items, total, order date, current status

**Tool 2: `amazon_orders_track`**
- Get tracking status for a specific order or tracking number
- Parameters: `{ orderId?: string, trackingNumber?: string }`
- Returns: carrier, tracking number, current status, location, ETA

**Tool 3: `amazon_orders_search`**
- Search order history by item name, date range, or price
- Parameters: `{ query?: string, dateFrom?: string, dateTo?: string, minPrice?: number, maxPrice?: number }`
- Returns: matching orders with details

**Tool 4: `amazon_orders_sync`**
- Trigger a manual sync of orders from Gmail
- Parameters: `{ days?: number }` (default: 90 days)
- Returns: count of new/updated orders found

---

## 4. Email Parsing Strategy

### Amazon Email Types to Parse

| Email Type | Gmail Search Query | Key Data |
|------------|-------------------|----------|
| Order confirmation | `from:auto-confirm@amazon.com subject:"Your Amazon.com order"` | Order ID, items, prices, total |
| Shipping notification | `from:shipment-tracking@amazon.com subject:"shipped"` | Order ID, tracking number, carrier, ETA |
| Delivery confirmation | `from:shipment-tracking@amazon.com subject:"delivered"` | Order ID, delivery date/time |
| Refund notification | `from:auto-confirm@amazon.com subject:"refund"` | Order ID, refund amount |

### Amazon Order ID Format

Format: `XXX-XXXXXXX-XXXXXXX` (3-7-7 digits)
Regex: `/\d{3}-\d{7}-\d{7}/g`
Example: `112-9876543-7654321`

### Amazon Tracking Number Formats

| Carrier | Pattern | Example |
|---------|---------|---------|
| Amazon Logistics | `TB[ABC]\d{12,15}` | `TBA619632698000` |
| UPS | `1Z[A-Z0-9]{16}` | `1Z999AA10123456784` |
| FedEx | `\d{12,22}` | `123456789012` |
| USPS | `\d{20,22}` or `[A-Z]{2}\d{9}US` | `92748927005500000006` |

### Email Parsing Implementation

```typescript
interface ParsedAmazonOrder {
  orderId: string;           // e.g. "112-9876543-7654321"
  orderDate: Date;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  currency: string;
  status: 'ordered' | 'shipped' | 'out_for_delivery' | 'delivered' | 'returned' | 'refunded';
  trackingNumbers: Array<{
    number: string;
    carrier: string;
  }>;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
}
```

### Gmail API Usage

The project already has Gmail MCP tools (`mcp__claude_ai_Gmail__gmail_search_messages`, `gmail_read_message`). The connector should use the Gmail API directly (via googleapis npm package already in the project) rather than going through MCP-over-MCP:

```typescript
// Search for Amazon order emails
const query = 'from:auto-confirm@amazon.com OR from:shipment-tracking@amazon.com newer_than:90d';
// Use gmail.users.messages.list() and gmail.users.messages.get()
```

Required OAuth scope: `https://www.googleapis.com/auth/gmail.readonly` (already granted for the Gmail connector).

### Schema.org Structured Data in Emails

Gmail supports schema.org Order markup in emails. Some Amazon emails include JSON-LD structured data with order details. When present, this is the most reliable extraction method:

```json
{
  "@context": "http://schema.org",
  "@type": "Order",
  "orderNumber": "112-9876543-7654321",
  "orderStatus": "http://schema.org/OrderDelivered",
  "merchant": { "@type": "Organization", "name": "Amazon.com" }
}
```

**Parsing priority:**
1. Extract schema.org JSON-LD from email HTML (most reliable)
2. Parse HTML structure with known CSS selectors/patterns
3. Regex extraction from plain text as fallback

---

## 5. Package Tracking API Comparison

| Feature | AfterShip | Ship24 | 17track |
|---------|-----------|--------|---------|
| Carriers supported | 1,293+ | 900+ | 3,200+ |
| Auto-detect courier | Yes | Yes | Yes |
| Free tier | No (removed from free plan) | 10 shipments/month | Limited |
| Cheapest paid plan | ~$11/mo (Essentials) | Pay-per-call available | Free tier exists |
| Webhook support | Yes | Yes | Limited |
| API quality | Excellent docs | Good docs | Adequate |
| npm SDK | `aftership` | REST only | REST only |

### Recommendation: Ship24 for MVP, AfterShip for Production

**Ship24** offers a free tier (10 shipments/month) and per-call pricing, making it ideal for an MVP or personal-use desktop app. Their auto-detect courier feature eliminates the need to identify the carrier from the tracking number.

**AfterShip** has the best API documentation and SDK (`aftership` npm package), but requires a paid plan ($11+/month minimum) for API access. Better for production at scale.

**Fallback: Direct carrier APIs** -- For a zero-cost approach, query carrier APIs directly (USPS, UPS, FedEx each have free tracking APIs). This requires carrier detection logic but avoids third-party API costs.

### Carrier Detection Without External API

```typescript
function detectCarrier(trackingNumber: string): string {
  if (/^TB[ABC]\d{12,15}$/.test(trackingNumber)) return 'amazon';
  if (/^1Z[A-Z0-9]{16}$/.test(trackingNumber)) return 'ups';
  if (/^\d{12,22}$/.test(trackingNumber)) {
    if (trackingNumber.length <= 15) return 'fedex';
    return 'usps';
  }
  if (/^[A-Z]{2}\d{9}US$/.test(trackingNumber)) return 'usps';
  return 'unknown';
}
```

---

## 6. Data Model (SQLite)

```sql
CREATE TABLE amazon_orders (
  id TEXT PRIMARY KEY,                    -- UUID
  order_id TEXT NOT NULL UNIQUE,          -- Amazon order ID (XXX-XXXXXXX-XXXXXXX)
  order_date TEXT NOT NULL,               -- ISO 8601
  total_amount REAL,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'ordered', -- ordered|shipped|delivered|returned|refunded
  email_message_id TEXT,                  -- Gmail message ID for source tracking
  raw_email_snippet TEXT,                 -- Cached email snippet for re-parsing
  estimated_delivery TEXT,                -- ISO 8601
  actual_delivery TEXT,                   -- ISO 8601
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE amazon_order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES amazon_orders(order_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  price REAL,
  image_url TEXT
);

CREATE TABLE amazon_tracking (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES amazon_orders(order_id) ON DELETE CASCADE,
  tracking_number TEXT NOT NULL,
  carrier TEXT,                           -- amazon|ups|fedex|usps|dhl|other
  status TEXT DEFAULT 'unknown',          -- in_transit|out_for_delivery|delivered|exception
  last_location TEXT,
  last_update TEXT,                       -- ISO 8601
  eta TEXT,                               -- ISO 8601
  tracking_url TEXT,
  raw_tracking_data TEXT                  -- JSON blob from tracking API
);

CREATE INDEX idx_amazon_orders_date ON amazon_orders(order_date);
CREATE INDEX idx_amazon_orders_status ON amazon_orders(status);
CREATE INDEX idx_amazon_tracking_number ON amazon_tracking(tracking_number);
```

---

## 7. Privacy Considerations

Order history is **highly sensitive purchasing data**. The connector must implement strong privacy controls:

### Data Minimization
- Only store order metadata needed for the tools (order ID, items, prices, tracking)
- Do not store full email bodies -- extract and discard
- Do not store payment method details, billing addresses, or gift messages
- Respect the app's existing privacy mode (used by auto-name feature)

### Local-Only Storage
- All data stays in the local SQLite database (`~/.claude-tauri/data.db`)
- No order data is sent to external servers except tracking numbers to the tracking API
- Tracking API queries contain only tracking numbers, not order details or user identity

### User Consent
- Require explicit opt-in to enable the Amazon Orders connector
- Show clear explanation: "This connector reads Amazon emails from your Gmail to extract order and shipping information"
- Provide a "Clear all order data" button in connector settings
- Allow per-order deletion

### Data Retention
- Default retention: 12 months of order history
- Configurable by user
- Auto-purge old orders on a schedule

### Gmail Scope
- Use `gmail.readonly` -- never modify or delete emails
- Search is scoped to Amazon sender addresses only, not reading all email

---

## 8. Testing Strategy

### Unit Tests (Colocated)

**Email parsing tests** (`apps/server/src/connectors/amazon-orders/__tests__/parser.test.ts`):
- Parse order confirmation email (single item)
- Parse order confirmation email (multi-item)
- Parse shipping notification with Amazon Logistics tracking
- Parse shipping notification with UPS/FedEx/USPS tracking
- Parse delivery confirmation
- Parse refund notification
- Handle malformed/missing data gracefully
- Handle international Amazon emails (.co.uk, .de, .co.jp format variations)
- Extract schema.org JSON-LD when present

**Tracking number detection tests**:
- Detect Amazon Logistics (TBA/TBM/TBC prefixes)
- Detect UPS (1Z prefix)
- Detect FedEx (12-22 digit)
- Detect USPS (20-22 digit, AA123456789US format)
- Return 'unknown' for unrecognized formats

**Data model tests**:
- Insert and query orders
- Update order status
- Cascade delete (order -> items, tracking)

### Mock Data

Create fixture emails from real Amazon email templates (sanitized):
```
tests/fixtures/amazon-emails/
  order-confirmation-single.html
  order-confirmation-multi.html
  shipping-notification-amazon-logistics.html
  shipping-notification-ups.html
  delivery-confirmation.html
  refund-notification.html
  international-uk-order.html
```

### Integration Tests

- Gmail API search returns Amazon emails
- Full pipeline: email -> parse -> store -> query via MCP tool
- Tracking API returns normalized status (mock external API)

---

## 9. Implementation Plan

### Phase 1: Email Parsing Core (3-4 days)
1. Create `apps/server/src/connectors/amazon-orders/` directory structure
2. Implement email parser with regex + HTML parsing (cheerio or similar)
3. Add schema.org JSON-LD extraction as primary parser
4. Write comprehensive parser tests with fixture emails
5. Add SQLite schema migration for order tables

### Phase 2: MCP Tools (2-3 days)
1. Implement `amazon_orders_sync` tool (Gmail search + parse + store)
2. Implement `amazon_orders_list` tool (query local DB)
3. Implement `amazon_orders_search` tool (full-text search on items)
4. Register connector in `apps/server/src/connectors/index.ts`
5. Add connector tests

### Phase 3: Package Tracking (2-3 days)
1. Integrate Ship24 or AfterShip API for tracking
2. Implement `amazon_orders_track` tool
3. Add carrier detection fallback for direct carrier API queries
4. Background refresh of active tracking numbers
5. Webhook or polling for status updates

### Phase 4: UI & Polish (1-2 days)
1. Add connector toggle in settings UI
2. Show sync status and last sync time
3. Privacy controls (data retention, clear data)
4. Browser verification of order display

### Total Estimated Effort: 8-12 days

---

## 10. Open Questions & Risks

### Open Questions
1. **ConnectorCategory expansion** -- Should we add `'shopping'` to the `ConnectorCategory` union type, or keep Amazon Orders under `'lifestyle'`?
2. **Gmail dependency** -- What if the user doesn't use Gmail? Consider supporting Outlook/IMAP in the future.
3. **Tracking API selection** -- Ship24 free tier (10/month) may be too low for active Amazon shoppers. Should we bundle an API key or require user to provide one?
4. **Multi-marketplace** -- How much effort to support amazon.co.uk, .de, .co.jp email formats from day one?
5. **Incremental sync** -- Gmail API supports `historyId` for incremental sync. Worth implementing in Phase 1 or defer?

### Risks
1. **Amazon email format changes** -- Amazon can change their email HTML at any time. Mitigation: use schema.org JSON-LD as primary parser, HTML regex as fallback, and alert on parse failures.
2. **Gmail OAuth scope sensitivity** -- Users may be reluctant to grant email read access. Mitigation: clear consent UI, scope-limited queries (only Amazon sender addresses).
3. **Tracking API costs** -- If usage exceeds free tier, need a paid plan or direct carrier API fallback. Mitigation: implement carrier detection + direct APIs as zero-cost fallback.
4. **International email variation** -- Amazon emails differ by marketplace (language, format, currency). Mitigation: start with .com only, add marketplaces incrementally.
5. **Rate limiting** -- Gmail API has quotas (250 units/second per user). Mitigation: batch requests, cache results, incremental sync.

---

## References

- [rigwild/mcp-server-amazon](https://github.com/rigwild/mcp-server-amazon) -- Existing Amazon MCP server (product search, cart, order history via cookies)
- [jay-trivedi/amazon_sp_mcp](https://github.com/jay-trivedi/amazon_sp_mcp) -- Amazon Seller Central MCP server (SP-API, sellers only)
- [Amazon SP-API Orders Reference](https://developer-docs.amazon.com/sp-api/docs/orders-api-v0-reference) -- Seller-only API documentation
- [AfterShip Tracking API Docs](https://www.aftership.com/docs/tracking/quickstart/api-quick-start) -- Package tracking API
- [AfterShip Pricing](https://www.aftership.com/pricing/tracking) -- Paid plans only for API access
- [Ship24 Tracking API Docs](https://docs.ship24.com/getting-started) -- Free tier available (10/month)
- [Ship24 Pricing](https://www.ship24.com/pricing) -- Per-call pricing available
- [Gmail API Scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) -- OAuth scope reference
- [Gmail Schema.org Order Markup](https://developers.google.com/workspace/gmail/markup/reference/order) -- Structured data in emails
- [Amazon Scraping Legality (ScrapeHero)](https://www.scrapehero.com/is-scraping-amazon-legal/) -- Legal analysis of scraping risks
- [Amazon Scraping Legality (Octoparse)](https://www.octoparse.com/blog/is-it-legal-to-scrape-amazon-data) -- ToS and CFAA considerations
- [emailparser.com - Amazon Dispatch](https://www.emailparser.com/d/e/parsing-amazon-dispatch-notifications) -- Example email parsing patterns
- [Existing Weather Connector](../../../apps/server/src/connectors/weather/) -- Reference ConnectorDefinition pattern
