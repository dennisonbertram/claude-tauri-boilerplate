# Uber/Lyft Ride Tracking Connector Research

**Issue**: #390
**Date**: 2026-03-25
**Status**: Research complete -- recommending Gmail-based receipt parsing approach

---

## 1. Problem Statement

Users want to track ride-sharing expenses (Uber, Lyft) within the desktop app for budgeting, expense categorization, and tax deduction tracking. This requires accessing ride history data including dates, pickup/dropoff locations, fares, tips, fees, and payment methods.

---

## 2. Existing MCP Server Implementations

### Uber MCP Servers Found
- **199-biotechnologies/mcp-uber** (LobeHub registry): An MCP server for booking Uber rides through AI assistants. Requires Uber API credentials. Focused on ride *requesting*, not history retrieval.
- **skudskud/uber-eats-mcp-server**: Python-based, uses browser automation to control Uber Eats website. Not relevant to ride history.

### Lyft MCP Servers Found
- **n8n Lyft MCP workflow**: An n8n workflow template with 16 Lyft API operations exposed via MCP. Uses n8n's MCP node, not a standalone server.
- No standalone Lyft MCP server implementations found.

### Assessment
No existing MCP servers solve the ride history/receipt tracking use case. The Uber MCP server is for booking, not retrospective data. We would need to build this from scratch.

---

## 3. Uber API Analysis

### Available Endpoints (developer.uber.com)
| Endpoint | Access Level | Notes |
|----------|-------------|-------|
| Ride Requests API | Privileged scopes | Can request rides, get receipts |
| `GET /v1.2/history` | OAuth (rider scope) | Trip history for authenticated user |
| `GET /v1.2/requests/{id}/receipt` | Privileged scope | Receipt for a specific trip |
| Receipts API (`/v1/business/receipts`) | Enterprise only | Only Uber for Business clients |
| Estimates API | Public (migrating to OAuth) | Price/time estimates only |

### Critical Access Restrictions
- **Personal rider API access is effectively deprecated for third-party apps.** Uber has progressively restricted API scopes since 2018.
- The `ride_receipts` scope requires privileged access -- Uber must manually approve your app, and approval is essentially limited to business partners.
- The Receipts API is exclusively for Uber for Business Enterprise clients. Personal trips are excluded even if you have business API access.
- Server tokens are being fully deprecated in favor of OAuth Bearer Tokens.
- **Verdict: Direct Uber API integration is not viable for a personal desktop app.**

### Alternative Data Access
1. **Privacy Data Export**: Users can request a full data download at uber.com/account/data/ (GDPR/CCPA right). Returns CSV/JSON with trip logs, timestamps, routes, fares, metadata. Delivered within 30 days.
2. **Manual Trip History**: Visible at riders.uber.com/trips but no built-in export. Third-party bookmarklets exist (e.g., uber-data-extractor) but are fragile.

---

## 4. Lyft API Analysis

### Available Endpoints (developer.lyft.com)
| Endpoint | Access Level | Notes |
|----------|-------------|-------|
| `GET /v1/rides` | OAuth (rides.read) | Rides within past 30 days only |
| `GET /v1/rides/{id}/receipt` | OAuth (rides.read) | Receipt for specific ride |
| `GET /v1/profile` | OAuth (public) | User profile info |
| Cost Estimates | Public | Price estimates only |

### Access Restrictions
- Lyft's public API documentation is available but developer access requires contacting a Lyft Business representative.
- The `rides.read` scope is restricted -- not available for general third-party app registration.
- **Past 30 days only** -- the API does not expose historical rides beyond that window.
- Lyft has SDKs (Go, Node, Python) but they are unmaintained (last commits 2017-2018).
- **Verdict: Lyft API is similarly restricted. The 30-day limit alone makes it inadequate for expense tracking.**

---

## 5. Recommended Approach: Gmail Receipt Parsing

Given that both Uber and Lyft APIs are inaccessible for personal use, the most practical approach is **parsing ride receipts from email**.

### Why Email Parsing Works
- Both Uber and Lyft send detailed receipt emails for every ride.
- Users already have this data in their inbox -- no API approval needed.
- The app already has Gmail integration infrastructure (MCP tools for Gmail are available).
- Historical data goes back to the user's first ride (no 30-day limit).
- Works for any ride-sharing service that sends email receipts.

### Existing Open-Source Prior Art
| Project | Approach | Status |
|---------|----------|--------|
| [ridereceipts](https://github.com/hello-efficiency-inc/ridereceipts) | Electron desktop app, Gmail API, downloads PDFs | Active, has Pro version |
| [giaquino/uber-receipts](https://github.com/giaquino/uber-receipts) | Gmail API, sums Uber expenses | Small utility |
| [swjain/gmail-receipt-scrapper](https://github.com/swjain/gmail-receipt-scrapper) | Google Apps Script, parses receipt HTML | Extensible pattern |
| [joshhunt/uber](https://github.com/joshhunt/uber) | Scrapes riders.uber.com, outputs JSON + map | Fragile, breaks on UI changes |
| [twisty7867/uber-data-extractor](https://github.com/twisty7867/uber-data-extractor) | Bookmarklet for riders.uber.com CSV export | Simple but manual |

### Receipt Email Content (Extractable Fields)

**Uber receipts contain:**
- Trip date and time (with timezone)
- Pickup and dropoff addresses
- Trip distance and duration
- Base fare, time/distance charges, surge multiplier
- Service fees, booking fees, tolls
- Tip amount
- Total charged
- Payment method (last 4 digits)
- Trip ID / confirmation number
- Driver name and vehicle info
- Map image of route

**Lyft receipts contain:**
- Ride date and time
- Pickup and dropoff locations
- Distance and duration
- Base fare breakdown (time, distance)
- Service fee, platform fee
- Tip amount
- Total charged
- Payment method
- Ride type (Standard, XL, etc.)

---

## 6. Proposed Connector Architecture

### Connector Definition
```typescript
// apps/server/src/connectors/rides/index.ts
export const ridesConnector: ConnectorDefinition = {
  name: 'rides',
  displayName: 'Ride History',
  description: 'Track Uber and Lyft ride expenses from email receipts',
  icon: '🚗',
  category: 'finance',
  requiresAuth: true,  // Requires Gmail OAuth
  tools: ridesTools,
};
```

### Proposed Tools
| Tool Name | Description |
|-----------|-------------|
| `rides_scan_receipts` | Scan Gmail for Uber/Lyft receipts in a date range |
| `rides_list` | List parsed rides with filtering (date, service, amount range) |
| `rides_summary` | Expense summary by period (weekly/monthly/yearly) |
| `rides_categorize` | Tag rides as business/personal for tax purposes |
| `rides_export` | Export ride data as CSV for expense reports |

### File Structure
```
apps/server/src/connectors/rides/
  index.ts          -- ConnectorDefinition
  tools.ts          -- Tool definitions (5 tools above)
  api.ts            -- Gmail query + receipt parsing logic
  parsers/
    uber.ts         -- Uber receipt HTML parser
    lyft.ts         -- Lyft receipt HTML parser
    types.ts        -- Shared RideReceipt interface
  rides.test.ts     -- Tests with mock receipt HTML
```

### Data Model
```typescript
interface RideReceipt {
  id: string;                    // Generated hash of trip details
  service: 'uber' | 'lyft';
  tripId: string;                // Service's trip/ride ID
  date: string;                  // ISO 8601
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat?: number;            // If extractable from map link
  pickupLon?: number;
  dropoffLat?: number;
  dropoffLon?: number;
  distance?: string;             // e.g., "4.2 miles"
  duration?: string;             // e.g., "18 min"
  rideType?: string;             // e.g., "UberX", "Lyft XL"
  baseFare: number;
  fees: number;                  // Service fee + booking fee + tolls
  tip: number;
  total: number;
  currency: string;              // e.g., "USD"
  paymentMethod?: string;        // e.g., "Visa ****1234"
  category?: 'business' | 'personal';
  rawEmailId: string;            // Gmail message ID for reference
}
```

### Gmail Query Strategy
```typescript
// Uber receipts
const uberQuery = `from:(uber.com OR uber-us@uber.com) subject:("trip with uber" OR "your receipt" OR "trip receipt") after:${startDate} before:${endDate}`;

// Lyft receipts
const lyftQuery = `from:(no-reply@lyftmail.com OR lyft.com) subject:("ride receipt" OR "your ride with") after:${startDate} before:${endDate}`;
```

### Parsing Strategy
1. Use Gmail API `messages.get` with `format: 'full'` to get HTML body
2. Parse HTML with a lightweight parser (e.g., `node-html-parser` or regex for known patterns)
3. Extract structured fields from known CSS class names / HTML structure
4. Cache parsed results in SQLite to avoid re-parsing
5. Handle format changes gracefully -- log unparseable receipts for user review

---

## 7. Privacy and Security Considerations

### Location Data Sensitivity
Ride history contains precise location data revealing home addresses, workplaces, medical facilities, and personal patterns. This is among the most sensitive personal data categories.

**Required safeguards:**
- **Local-only storage**: All ride data stays in the local SQLite database (`~/.claude-tauri/data.db`). Never transmitted to external services.
- **Encryption at rest**: Consider encrypting the rides table or using SQLite encryption extensions.
- **Data minimization**: Only store what is needed. Avoid caching raw email HTML after parsing.
- **Explicit consent**: Require user opt-in before scanning email. Show exactly what data will be extracted.
- **Deletion**: Provide a "delete all ride data" action. When a user disconnects the connector, purge stored rides.
- **No coordinates by default**: Store addresses as text. Only extract lat/lon if the user explicitly enables map features.

### Regulatory Compliance
- **CCPA/CPRA**: Precise geolocation is classified as "sensitive personal information" under California law. Users must be able to limit its use and request deletion.
- **GDPR**: Location data is personal data under GDPR. Processing requires a lawful basis (consent). Right to erasure applies.
- Since this is a local desktop app with no server-side data collection, compliance is simpler -- but the principles should still guide the design.

### Gmail Access Scope
- Use the narrowest Gmail OAuth scope possible: `gmail.readonly` is sufficient.
- Consider using `gmail.metadata` + targeted `messages.get` rather than broad inbox access.
- Clearly communicate to users that only ride receipt emails are read.

---

## 8. Testing Strategy

### Mock Receipt Data
Create realistic mock HTML for both services based on known receipt structures:

```typescript
// apps/server/src/connectors/rides/parsers/__tests__/uber-parser.test.ts
const MOCK_UBER_RECEIPT_HTML = `
<html>
  <!-- Simplified mock based on real Uber receipt structure -->
  <div class="trip-details">
    <span class="date">March 15, 2026</span>
    <span class="pickup">123 Main St, San Francisco, CA</span>
    <span class="dropoff">456 Market St, San Francisco, CA</span>
    <span class="distance">2.3 mi</span>
    <span class="duration">12 min</span>
  </div>
  <div class="fare-breakdown">
    <span class="base-fare">$8.50</span>
    <span class="service-fee">$2.75</span>
    <span class="tip">$2.00</span>
    <span class="total">$13.25</span>
  </div>
</html>`;
```

### Test Cases Required
1. **Parser tests**: Parse Uber receipt HTML -> RideReceipt object
2. **Parser tests**: Parse Lyft receipt HTML -> RideReceipt object
3. **Edge cases**: Missing fields, changed HTML format, non-English receipts
4. **Currency handling**: Different currency formats ($, EUR, GBP)
5. **Date parsing**: Various date/time formats across regions
6. **Gmail query construction**: Correct search queries for date ranges
7. **Deduplication**: Same receipt scanned twice should not create duplicates
8. **Summary aggregation**: Correct totals by period, service, category
9. **Export format**: CSV output matches expected columns
10. **Privacy**: Verify raw HTML is not persisted after parsing

---

## 9. Implementation Phases

### Phase 1: Core Parsing (MVP)
- Uber receipt HTML parser with test coverage
- Lyft receipt HTML parser with test coverage
- `rides_scan_receipts` tool using Gmail MCP
- Local SQLite storage for parsed rides
- `rides_list` tool with basic filtering

### Phase 2: Analytics
- `rides_summary` tool with period aggregation
- `rides_export` CSV export
- Basic expense categorization (business/personal)

### Phase 3: Enhanced Features
- Recurring route detection ("commute" auto-tagging)
- Spending trend analysis
- Map visualization of ride routes (if coordinates available)
- Support for additional services (Via, Curb, etc.)
- Privacy data export import (parse Uber/Lyft CSV data dumps)

---

## 10. Risks and Open Questions

### Risks
| Risk | Severity | Mitigation |
|------|----------|------------|
| Receipt HTML format changes break parsers | High | Versioned parsers, graceful fallback, log unparseable receipts |
| Gmail OAuth scope concerns from users | Medium | Clear privacy messaging, minimal scope, local-only storage |
| No Gmail account / uses other email provider | Medium | Phase 2: add IMAP support for Outlook, Yahoo, etc. |
| Uber/Lyft receipts vary by country | Medium | Start with US receipts, expand based on user feedback |
| Rate limiting on Gmail API | Low | Batch queries, cache results, incremental sync |

### Open Questions
1. **Should we support CSV import from Uber/Lyft privacy data exports?** This would complement email parsing and provide historical data without Gmail access. Recommended for Phase 3.
2. **Should ride data be stored in the existing SQLite DB or a separate file?** Recommend same DB with a dedicated `rides` table for simplicity.
3. **How to handle shared rides?** Uber Pool / Lyft Shared rides may have different receipt formats. Need test data.
4. **Should we integrate with the existing finance/Plaid connector?** Ride expenses could correlate with bank transaction data for reconciliation. Deferred to Phase 3.
5. **Gmail MCP vs direct Gmail API?** The app already has Gmail MCP tools available. Using MCP keeps the architecture consistent but adds a layer of indirection. Recommend using Gmail MCP tools directly from the rides connector tools.

---

## Sources

- [Uber Developer Documentation](https://developer.uber.com/docs)
- [Uber Receipts API (Business only)](https://developer.uber.com/docs/businesses/receipts/introduction)
- [Uber Privacy Data Download](https://help.uber.com/riders/article/whats-in-your-data-download?nodeId=3d476006-87a4-4404-ac1e-216825414e05)
- [Lyft Developer Documentation](https://developer.lyft.com/docs/overview)
- [Lyft Emails and Receipts Help](https://help.lyft.com/hc/en-us/all/articles/115012925627-Lyft-emails-and-receipts)
- [Ride Receipts (open source)](https://github.com/hello-efficiency-inc/ridereceipts)
- [MCP Uber Server (LobeHub)](https://lobehub.com/mcp/199-biotechnologies-mcp-uber)
- [n8n Lyft MCP Workflow](https://n8n.io/workflows/5606-complete-lyft-api-integration-for-ai-agents-with-16-operations-using-mcp/)
- [Uber Data Extractor Bookmarklet](https://github.com/twisty7867/uber-data-extractor)
- [OrderPro - Download Uber Transaction History (2026)](https://www.orderproanalytics.com/blog/why-download-uber-transaction-history)
- [Ride-Sharing Data Privacy Best Practices](https://onde.app/blog/6-data-privacy-practices-to-enhance-your-ride-sharing-business)
- [Barracuda - Data Privacy in Ridesharing](https://blog.barracuda.com/2024/01/22/data-privacy-concerns-in-ridesharing-what-you-need-to-know)
