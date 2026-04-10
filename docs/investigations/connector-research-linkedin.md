# Connector Research: LinkedIn (Social Media)

**Date:** 2026-03-25
**Issue:** [#392](https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/392)
**Category:** Social Media
**Priority:** Low
**Complexity:** High

---

## 1. Overview

LinkedIn is a professional networking platform owned by Microsoft with 1B+ members. A LinkedIn connector could enable an AI assistant to read a user's feed, manage connections, post content, search jobs, and track professional networking activity. However, LinkedIn is one of the most restrictive major platforms for API access -- the vast majority of useful API endpoints require partner-level approval that is realistically unavailable to individual developers or small desktop apps.

**Honest assessment:** A fully-featured LinkedIn connector is not practically achievable through official APIs alone. The official API surface accessible without partner approval is limited to basic OpenID Connect sign-in (name, email, profile picture). Everything else -- reading feeds, posting content, searching profiles, messaging, job data -- requires closed permissions or partner program membership that LinkedIn is not granting to new applicants.

---

## 2. API Surface

### Official LinkedIn APIs

LinkedIn organizes its APIs into several product families, each with different access requirements:

| API Family | Key Endpoints | Access Level | Status for This App |
|------------|--------------|--------------|---------------------|
| **Sign In with LinkedIn (OpenID Connect)** | `/oauth/v2/authorization`, `/oauth/v2/accessToken`, `/oauth/v2/userinfo` | Open (any developer) | Available |
| **Profile API** | `/v2/me`, `/v2/userinfo` | Open (basic only) | Available (name, email, picture only) |
| **Community Management API** | Posts, Comments, Reactions, Social Metadata | Restricted (partner approval) | Not available |
| **Marketing API** | Ad Accounts, Campaigns, Analytics | Restricted (partner approval) | Not available |
| **Consumer Solutions** | Share API (deprecated), Profile API (full) | Closed | Not available |
| **Jobs API** | Job Postings, Applications | Restricted (partner approval) | Not available |
| **Messaging API** | Conversations, Messages | Closed | Not available |

### Permission Scopes Breakdown

| Scope | Description | Access |
|-------|-------------|--------|
| `openid` | OpenID Connect authentication | Open |
| `profile` | Basic profile (name, picture) | Open |
| `email` | Email address | Open |
| `w_member_social` | Post content as member | Requires Community Management API approval |
| `r_member_social` | Read member's social content | **Closed -- LinkedIn not accepting requests** |
| `r_organization_social` | Read org social content | Requires partner approval |
| `w_organization_social` | Post as organization | Requires partner approval |
| `r_1st_connections_size` | Connection count | Requires partner approval |
| `r_ads` | Read ad accounts | Marketing Developer Platform only |
| `r_liteprofile` | Lite profile data | Deprecated (use OpenID) |
| `r_fullprofile` | Full profile data | **Closed -- LinkedIn not accepting requests** |

### What You Actually Get Without Approval

With a standard LinkedIn Developer App (no partner approval), you can access:

1. **OpenID Connect Sign-In**: Authenticate users and get basic identity
2. **UserInfo endpoint**: `sub`, `name`, `given_name`, `family_name`, `picture`, `email`, `email_verified`, `locale`
3. **That's it.** No feed, no posts, no connections, no jobs, no messages.

### Community Management API (If Approved)

If somehow approved, this API provides:
- Create/read/delete posts (text, images, video, carousels, polls)
- Comments and reactions management
- Social metadata (likes, comments counts)
- Organization page management

**Development tier:** API call restrictions, 12-month window to complete integration
**Standard tier:** Full access after vetting process approval

Key limitation: `r_member_social` (reading a member's own posts/feed) is a **closed permission** -- LinkedIn is explicitly not accepting access requests due to "resource constraints."

---

## 3. Auth Flow

### OAuth 2.0 with OpenID Connect (3-Legged Flow)

This is the only auth flow available to unapproved developers.

**Flow for Tauri desktop app:**

1. User clicks "Connect LinkedIn" in the app
2. App opens system browser to LinkedIn authorization URL:
   ```
   https://www.linkedin.com/oauth/v2/authorization?
     response_type=code&
     client_id={CLIENT_ID}&
     redirect_uri={REDIRECT_URI}&
     state={RANDOM_STATE}&
     scope=openid%20profile%20email
   ```
3. User authenticates on LinkedIn and grants consent
4. LinkedIn redirects to callback URL with authorization code
5. Server exchanges code for access token:
   ```
   POST https://www.linkedin.com/oauth/v2/accessToken
   grant_type=authorization_code&
   code={AUTH_CODE}&
   client_id={CLIENT_ID}&
   client_secret={CLIENT_SECRET}&
   redirect_uri={REDIRECT_URI}
   ```
6. Server receives `access_token` (60-day TTL), `id_token` (JWT)
7. Server calls `/v2/userinfo` to get basic profile data

**Callback handling options:**
- Deep link: `claudetauri://linkedin-callback?code=...&state=...`
- Browser dev mode: `http://localhost:<port>/#/linkedin/callback?code=...&state=...`

**Token details:**
- Access tokens expire after 60 days
- Refresh tokens available (365-day TTL) if approved for refresh token flow
- No automatic refresh for standard apps -- user must re-authenticate

### App Registration Requirements

1. Create app at [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
2. Must associate with a LinkedIn Company Page
3. Add "Sign In with LinkedIn using OpenID Connect" product
4. Configure OAuth 2.0 redirect URIs
5. Get Client ID and Client Secret

---

## 4. Existing MCP Server Implementations

### Community Projects

| Project | Author | Approach | Tools Provided |
|---------|--------|----------|----------------|
| [mcp-linkedin](https://github.com/adhikasp/mcp-linkedin) | adhikasp | **Unofficial API** (linkedin-api Python lib) | Feed retrieval, job search, job match analysis |
| [linkedin-mcpserver](https://github.com/felipfr/linkedin-mcpserver) | felipfr | TypeScript, unofficial API | Profile search, job search, messaging |
| [linkedin-mcp-server](https://github.com/Dishant27/linkedin-mcp-server) | Dishant27 | LinkedIn API integration | Data retrieval framework |
| [linkedin-mcp-server](https://github.com/stickerdaniel/linkedin-mcp-server) | stickerdaniel | Scraping-based | Profile scraping, company scraping, job search |

### Key Observations

1. **Every community MCP server uses unofficial/scraped APIs** -- none use the official LinkedIn API for meaningful functionality because the official API doesn't provide it.
2. The most popular (adhikasp/mcp-linkedin) uses the `linkedin-api` Python library which reverse-engineers LinkedIn's internal APIs by authenticating with email/password.
3. All of these approaches violate LinkedIn's Terms of Service and risk account bans.

---

## 5. Rate Limits and Quotas

### Official API (If Approved)

| Tier | Daily API Calls | Throttle |
|------|----------------|----------|
| Development | Limited (exact numbers undisclosed, ~100/day estimated) | Per-app |
| Standard | No restrictions documented | Per-app |

### Unofficial API Considerations

- LinkedIn actively detects and blocks automated access
- Rate limits enforced aggressively (exact thresholds unknown, change frequently)
- CAPTCHA challenges triggered by unusual patterns
- Account restrictions or permanent bans possible
- IP-based throttling in addition to account-based

---

## 6. Data Model and Storage

### What Could Be Stored (If Data Were Accessible)

```typescript
interface LinkedInProfile {
  linkedinId: string;         // Member URN (from OpenID 'sub')
  name: string;               // Display name
  givenName: string;
  familyName: string;
  email: string;
  emailVerified: boolean;
  pictureUrl: string;
  locale: string;
  accessToken: string;        // Encrypted, 60-day TTL
  refreshToken?: string;      // If available, 365-day TTL
  tokenExpiresAt: number;
  connectedAt: number;
}

// These would require closed permissions:
interface LinkedInPost {
  id: string;
  authorUrn: string;
  text: string;
  mediaUrls: string[];
  createdAt: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
}

interface LinkedInConnection {
  profileUrn: string;
  name: string;
  headline: string;
  connectedAt: number;
}
```

### LinkedIn Data Export (GDPR) -- Alternative Data Source

Users can download their LinkedIn data archive, which includes:
- **Connections.csv** -- all connections with name, URL, company, position, connected date
- **Messages.csv** -- complete message history
- **Profile.csv** -- full profile data
- **Invitations.csv** -- sent/received invitations
- **Endorsements.csv** -- skill endorsements

Format: ZIP file containing CSV files. Available within ~10 minutes (partial) or ~24 hours (full archive).

This could be parsed and imported into the app as a practical alternative to API access.

---

## 7. Alternative Approaches

Given the severe API restrictions, here are the realistic options ranked by viability:

### Approach A: LinkedIn Data Export Import (Recommended)

**How:** User downloads their LinkedIn data archive (Settings > Data Privacy > Get a copy of your data), then imports the ZIP into the app.

**Pros:**
- Completely ToS-compliant
- Rich data: connections, messages, profile, endorsements, positions
- No API keys or partner approval needed
- User controls exactly what data is shared

**Cons:**
- Manual process (not real-time)
- Data becomes stale
- No write capabilities (can't post or message)
- User must repeat export for updates

**Implementation:** Parse CSV files from the ZIP archive, store in SQLite, provide tools for querying connections, analyzing network, searching messages.

### Approach B: OpenID Connect Only (Minimal)

**How:** Use the official Sign In with LinkedIn for identity, plus data export for everything else.

**Pros:**
- Fully official API usage
- Establishes LinkedIn identity link
- Could trigger periodic data export reminders

**Cons:**
- Only gets name, email, picture from API
- Everything else requires manual data export

### Approach C: Email Notification Parsing

**How:** Parse LinkedIn notification emails (via Gmail connector) to extract activity data.

**Pros:**
- Leverages existing Gmail connector
- No LinkedIn API needed
- Captures: new connections, messages, profile views, job alerts, post engagement
- Real-time-ish (as fast as email delivery)

**Cons:**
- Depends on user having LinkedIn email notifications enabled
- Parsing HTML emails is fragile
- Limited data compared to direct API access
- Can break when LinkedIn changes email templates

### Approach D: Unofficial API (Not Recommended)

**How:** Use reverse-engineered LinkedIn internal API (like linkedin-api Python library or equivalent JS implementation).

**Pros:**
- Full access to feed, profiles, jobs, messaging, connections
- Feature-rich -- matches what community MCP servers do

**Cons:**
- **Violates LinkedIn Terms of Service**
- Account ban risk (temporary or permanent)
- Requires storing user's LinkedIn credentials (severe security liability)
- API changes without notice (no stability guarantee)
- No legal recourse if it breaks
- LinkedIn actively detects and blocks automated access
- Not appropriate for a distributed desktop app

### Approach E: Hybrid (Data Export + Email Parsing + OpenID)

**How:** Combine approaches A, B, and C for maximum coverage.

**Pros:**
- ToS-compliant
- Rich initial data from export
- Ongoing updates from email parsing
- Official identity from OpenID
- No risk of account bans

**Cons:**
- More complex to implement
- Still no write capabilities
- Data export refresh is manual

---

## 8. Connector Architecture

### Recommended: Hybrid Connector (Approach E)

```typescript
// apps/server/src/connectors/linkedin/index.ts
import type { ConnectorDefinition } from '../types';
import { linkedinTools } from './tools';

export const linkedinConnector: ConnectorDefinition = {
  name: 'linkedin',
  displayName: 'LinkedIn',
  description:
    'Professional network insights from your LinkedIn data export, email notifications, and profile.',
  icon: '💼',
  category: 'communication',  // or add 'social-media' category
  requiresAuth: true,  // OpenID Connect for identity
  tools: linkedinTools,
};
```

### Proposed Tools

```typescript
// Tools from LinkedIn Data Export (import once, query anytime)
const linkedinTools: ConnectorToolDefinition[] = [
  {
    name: 'linkedin_import_archive',
    description: 'Import a LinkedIn data export ZIP file to populate connection and message data',
    // Parses Connections.csv, Messages.csv, Profile.csv, etc.
  },
  {
    name: 'linkedin_search_connections',
    description: 'Search your LinkedIn connections by name, company, or position',
    // Queries imported Connections.csv data
  },
  {
    name: 'linkedin_get_profile',
    description: 'Get your LinkedIn profile information',
    // From OpenID Connect + imported Profile.csv
  },
  {
    name: 'linkedin_search_messages',
    description: 'Search your LinkedIn message history',
    // Queries imported Messages.csv data
  },
  {
    name: 'linkedin_network_stats',
    description: 'Get statistics about your LinkedIn network (connection count, top companies, industries)',
    // Aggregates from imported data
  },
  {
    name: 'linkedin_recent_activity',
    description: 'Get recent LinkedIn activity from email notifications (requires Gmail connector)',
    // Parses LinkedIn notification emails via Gmail connector
  },
];
```

### Data Flow

```
LinkedIn Data Export (ZIP) ──> Parse CSVs ──> SQLite tables
                                                  │
OpenID Connect (identity) ──> Basic profile ──────┤
                                                  │
Gmail Connector (emails) ──> Parse LinkedIn ──────┤
                              notifications       │
                                                  ▼
                                          linkedin_* tools
                                          (query local data)
```

---

## 9. Testing Strategy

### Unit Tests

```typescript
// CSV parsing tests
describe('LinkedIn CSV Parser', () => {
  it('should parse Connections.csv with standard columns', () => {
    const csv = 'First Name,Last Name,URL,Email Address,Company,Position,Connected On\n'
      + 'John,Doe,https://linkedin.com/in/johndoe,john@example.com,Acme Corp,Engineer,01 Jan 2025';
    const connections = parseConnectionsCsv(csv);
    expect(connections).toHaveLength(1);
    expect(connections[0].company).toBe('Acme Corp');
  });

  it('should handle Messages.csv with multi-line content', () => { /* ... */ });
  it('should handle missing/optional columns gracefully', () => { /* ... */ });
  it('should parse date formats consistently', () => { /* ... */ });
});

// Email notification parsing tests
describe('LinkedIn Email Parser', () => {
  it('should extract new connection notifications', () => { /* ... */ });
  it('should extract message received notifications', () => { /* ... */ });
  it('should extract profile view notifications', () => { /* ... */ });
  it('should handle changed email templates gracefully', () => { /* ... */ });
});

// Tool execution tests
describe('LinkedIn Tools', () => {
  it('should search connections by company name', () => { /* ... */ });
  it('should return network statistics', () => { /* ... */ });
  it('should return empty results when no data imported', () => { /* ... */ });
});
```

### Mock Data

Create mock LinkedIn data export files based on the documented CSV format:
- `test/fixtures/linkedin/Connections.csv` -- 50 fake connections
- `test/fixtures/linkedin/Messages.csv` -- 20 fake message threads
- `test/fixtures/linkedin/Profile.csv` -- single profile row

### Integration Tests

- Test ZIP file extraction and full import pipeline
- Test OpenID Connect token exchange with mocked LinkedIn OAuth endpoints
- Test email notification parsing with sample LinkedIn email HTML
- Test that tools return appropriate errors when no data is imported

---

## 10. Recommendation and Next Steps

### Verdict: Implement with Data Export + Email Parsing (Low Priority)

LinkedIn's API restrictions make a traditional API connector impractical. The recommended approach is a **hybrid connector** that:

1. **Imports LinkedIn data exports** for rich, static data (connections, messages, profile)
2. **Parses LinkedIn email notifications** (via Gmail connector) for ongoing activity
3. **Uses OpenID Connect** for identity verification only

This is honest about what's achievable and avoids ToS-violating unofficial APIs.

### Why Low Priority (Confirmed)

- No real-time API access available through official channels
- Data export import is manual and one-directional
- No write capabilities (can't post, message, or connect)
- The email parsing approach depends on Gmail connector being built first
- Other connectors (Gmail, Calendar, Todoist) provide more immediate value

### Implementation Order

1. **Phase 1:** OpenID Connect sign-in (establishes identity) -- ~1 day
2. **Phase 2:** Data export import and CSV parsing -- ~2-3 days
3. **Phase 3:** Connection/message search tools -- ~1-2 days
4. **Phase 4:** Email notification parsing (after Gmail connector exists) -- ~2-3 days
5. **Phase 5:** Network analytics tools -- ~1 day

**Total estimate:** ~7-10 days of implementation

### Prerequisites

- Gmail connector (#370) should be built first (for email notification parsing)
- Need to create a LinkedIn Developer App and Company Page
- Need to add `social-media` to `ConnectorCategory` type or use `communication`

### Open Questions

1. Should we add a `social-media` category to `ConnectorCategory` or reuse `communication`?
2. How frequently should we prompt users to re-export their LinkedIn data?
3. Should the data export import happen through a file picker in the UI or drag-and-drop?
4. Is it worth implementing the unofficial API as an opt-in "power user" feature with explicit risk warnings?

---

## Sources

- [LinkedIn Developer Portal - Community Management API](https://developer.linkedin.com/product-catalog/marketing/community-management-api)
- [Getting Access to LinkedIn APIs](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access)
- [Sign In with LinkedIn using OpenID Connect](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2)
- [LinkedIn 3-Legged OAuth Flow](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow)
- [LinkedIn API Restricted Use Cases](https://learn.microsoft.com/en-us/linkedin/marketing/restricted-use-cases?view=li-lms-2026-01)
- [Community Management API Overview](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview?view=li-lms-2025-11)
- [Increasing Access (API Tiers)](https://learn.microsoft.com/en-us/linkedin/marketing/increasing-access?view=li-lms-2026-01)
- [Download Your LinkedIn Data](https://www.linkedin.com/help/linkedin/answer/a1339364/downloading-your-account-data)
- [adhikasp/mcp-linkedin (Community MCP Server)](https://github.com/adhikasp/mcp-linkedin)
- [felipfr/linkedin-mcpserver (Community MCP Server)](https://github.com/felipfr/linkedin-mcpserver)
- [LinkedIn API Guide 2026 - Outx](https://www.outx.ai/blog/linkedin-api-guide)
- [How to Scrape LinkedIn in 2026 - Scrapfly](https://scrapfly.io/blog/posts/how-to-scrape-linkedin)
