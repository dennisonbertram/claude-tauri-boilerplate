# Connector Research: Contacts (Apple + Google)

## Research Date: 2026-03-25
## Issue: #397

---

## 1. Executive Summary

A Contacts connector for the Claude Tauri desktop app should support two backends: **Apple Contacts** (macOS native, zero-auth for local contacts) and **Google Contacts** (via People API, OAuth required). Both sources feed into a unified tool interface following the existing `ConnectorDefinition` pattern. Apple Contacts access is best achieved via JXA/osascript (proven by multiple existing MCP servers), while Google Contacts uses the People API v1 REST endpoints with OAuth 2.0. The connector should be read-first with optional write capabilities gated behind explicit user confirmation.

---

## 2. Existing MCP Server Implementations

### Apple Contacts MCP Servers (Community)

| Project | Approach | Features |
|---------|----------|----------|
| [macos-contacts-mcp](https://github.com/jcontini/macos-contacts-mcp) | AppleScript via osascript | Search, view, manage contacts via Claude Desktop/Cursor |
| [mac-contacts-mcp-server](https://github.com/wjgilmore/mac-contacts-mcp-server) | AppleScript (read-only) | Search and retrieve, no native dependencies |
| [iMCP](https://github.com/mattt/iMCP) | Native Swift macOS app | Messages, Contacts, Reminders, and more |
| [macos-automator-mcp](https://github.com/steipete/macos-automator-mcp) | General AppleScript/JXA runner | Contacts access through custom scripts |
| [apple-native-tools](https://www.pulsemcp.com/servers/dhravya-apple-native-tools) | JXA-first patterns | Calendar, Notes, Messages, Contacts, UI automation |

### Google Contacts MCP Servers

Google launched official managed MCP servers (Dec 2025) for Maps, BigQuery, Compute, and Kubernetes. **Contacts/People API is NOT yet in Google's official MCP lineup** but is expected in future rollouts. No widely-adopted community Google Contacts MCP server was found.

### Key Takeaway

Apple Contacts MCP is a solved problem with multiple implementations. The JXA/osascript approach is the community standard. Google Contacts via MCP remains greenfield and requires custom implementation against the People API.

---

## 3. Google People API Deep Dive

### API Structure

The People API v1 provides these key resource collections:

| Collection | Endpoint | Purpose |
|-----------|----------|---------|
| `people.connections` | `GET /v1/people/me/connections` | List user's contacts |
| `people.searchContacts` | `GET /v1/people:searchContacts` | Full-text search across contacts |
| `people.get` | `GET /v1/people/{resourceName}` | Get a single contact |
| `people.createContact` | `POST /v1/people:createContact` | Create a new contact |
| `people.updateContact` | `PATCH /v1/people/{resourceName}:updateContact` | Update existing contact |
| `people.deleteContact` | `DELETE /v1/people/{resourceName}:deleteContact` | Delete a contact |
| `people.batchCreateContacts` | `POST /v1/people:batchCreateContacts` | Batch create (up to 200) |
| `people.batchUpdateContacts` | `POST /v1/people:batchUpdateContacts` | Batch update (up to 200) |
| `people.batchDeleteContacts` | `POST /v1/people:batchDeleteContacts` | Batch delete |
| `otherContacts.list` | `GET /v1/otherContacts` | "Other contacts" (auto-created) |
| `otherContacts.search` | `GET /v1/otherContacts:search` | Search other contacts |
| `contactGroups.list` | `GET /v1/contactGroups` | List contact groups/labels |
| `contactGroups.batchGet` | `GET /v1/contactGroups:batchGet` | Batch get groups |

### personFields / readMask

Both `personFields` (connections.list) and `readMask` (most other methods) accept comma-separated field names:

```
addresses, ageRanges, biographies, birthdays, calendarUrls, clientData,
coverPhotos, emailAddresses, events, externalIds, genders, imClients,
interests, locales, locations, memberships, metadata, miscKeywords, names,
nicknames, occupations, organizations, phoneNumbers, photos, relations,
sipAddresses, skills, urls, userDefined
```

**Recommended default readMask:** `names,emailAddresses,phoneNumbers,organizations,addresses,photos,memberships,biographies,birthdays,relations`

### Search Behavior

- `people.searchContacts` requires a **warmup request** (empty query) to update the cache before first use
- Searches across names, nicknames, email addresses, phone numbers, and organizations
- Results are paginated (default page size varies; use `pageSize` param)

### Batch Operations

- Maximum 200 contacts per batch operation
- **Critical:** Mutate requests for the same user must be sent sequentially (not parallel) to prevent latency and failures
- Batch operations require the full `contacts` scope (not `readonly`)

### Rate Limits

- Default quota is approximately 90 requests/minute per user for read operations
- Write operations have lower quotas (exact numbers vary by project)
- Quotas are viewable/adjustable in Google Cloud Console under IAM & Admin > Quotas

---

## 4. Apple Contacts Access Methods

### Method 1: JXA via osascript (Recommended)

```javascript
// JXA - Search contacts by name
const app = Application('Contacts');
const people = app.people.whose({ name: { _contains: 'John' } });

people().forEach(person => {
  const name = person.name();
  const emails = person.emails().map(e => ({ value: e.value(), label: e.label() }));
  const phones = person.phones().map(p => ({ value: p.value(), label: p.label() }));
  // ... process contact
});
```

**Execution from Node/Bun:**
```typescript
import { execFile } from 'child_process';

function runJXA(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-l', 'JavaScript', '-e', script],
      { timeout: 10000 },
      (err, stdout) => err ? reject(err) : resolve(stdout.trim())
    );
  });
}
```

**Pros:**
- No native dependencies, works on any macOS
- Apple's sanctioned automation interface
- Read and write support
- Handles iCloud-synced contacts automatically

**Cons:**
- Performance degrades with large contact lists (1000+)
- Each `osascript` invocation spawns a new process
- JXA Object Specifiers must be converted to plain JS objects before processing

### Method 2: AppleScript via osascript

```applescript
tell application "Contacts"
    set matchingPeople to every person whose name contains "John"
    repeat with p in matchingPeople
        set personName to name of p
        set personEmails to value of every email of p
    end repeat
end tell
```

Functionally equivalent to JXA but less ergonomic for JSON serialization. JXA is preferred for MCP/connector use.

### Method 3: Direct SQLite Access

**Database location:** `~/Library/Application Support/AddressBook/AddressBook-v22.abcddb`

The database contains 34 tables. Key tables include:
- `ZABCDRECORD` - Main contact records
- `ZABCDEMAILADDRESS` - Email addresses
- `ZABCDPHONENUMBER` - Phone numbers
- `ZABCDPOSTALADDRESS` - Physical addresses

**Pros:** Fastest read access, full SQL query capability
**Cons:**
- Undocumented schema (Apple doesn't publish specs)
- Schema changes between macOS versions
- Read-only (writes would corrupt sync state)
- Requires Full Disk Access or specific entitlements
- Bypasses Contacts permission dialog

**Verdict:** Not recommended for production. Use only as a fallback for batch read operations if JXA performance is insufficient.

### Method 4: Contacts Framework (Swift/Objective-C via native bridge)

Requires a compiled Swift binary or Tauri plugin. Provides the most robust API (`CNContactStore`, `CNContact`, `CNSaveRequest`) but adds significant complexity.

**Verdict:** Overkill for an MCP tool connector. Consider only if JXA proves too slow for production workloads.

### Recommended Approach

**JXA via osascript** is the clear winner for this project:
1. It's what every successful macOS Contacts MCP server uses
2. Zero native dependencies
3. Handles permission dialogs natively (macOS prompts on first access)
4. Supports both read and write operations
5. JSON output is natural from JavaScript

---

## 5. Authentication

### Google OAuth 2.0

**Required Scopes:**

| Scope | Purpose | Sensitivity |
|-------|---------|-------------|
| `https://www.googleapis.com/auth/contacts.readonly` | Read contacts | Sensitive (requires Google review) |
| `https://www.googleapis.com/auth/contacts` | Read + write contacts | Sensitive |
| `https://www.googleapis.com/auth/contacts.other.readonly` | Read "Other contacts" | Sensitive |
| `https://www.googleapis.com/auth/directory.readonly` | Read domain directory | Restricted (Workspace only) |

**Recommended minimum:** `contacts.readonly` for read-only mode; `contacts` for full CRUD.

**OAuth Flow:**
1. App redirects to Google consent screen with requested scopes
2. User grants access
3. Google returns authorization code
4. App exchanges code for access + refresh tokens
5. Tokens stored securely (reuse existing Google OAuth infrastructure from Calendar connector)

**Important:** The app already has Google OAuth infrastructure for Google Calendar (`connector-research-google-calendar.md`). Contacts should reuse the same OAuth client, adding the contacts scope incrementally.

### Apple Contacts Permissions

- macOS shows a system permission dialog on first `osascript` access to Contacts
- User must grant "Contacts" access in System Settings > Privacy & Security > Contacts
- No OAuth flow needed — it's a one-time system permission
- The Tauri app (or its parent process) will be the entity requesting permission
- Permission can be pre-requested via `tccutil` in development but requires user action in production

---

## 6. Proposed Tool Definitions

### Tool: `contacts_search`
```typescript
{
  name: 'contacts_search',
  description: 'Search contacts by name, email, phone number, or organization across Apple and/or Google contacts',
  schema: {
    query: z.string().describe('Search query (name, email, phone, or company)'),
    source: z.enum(['apple', 'google', 'all']).default('all')
      .describe('Which contact source to search'),
    limit: z.number().min(1).max(50).default(10)
      .describe('Maximum number of results'),
  }
}
```

### Tool: `contacts_get`
```typescript
{
  name: 'contacts_get',
  description: 'Get full details for a specific contact by ID',
  schema: {
    contactId: z.string().describe('Contact ID (Apple or Google resource name)'),
    source: z.enum(['apple', 'google']).describe('Contact source'),
  }
}
```

### Tool: `contacts_list_groups`
```typescript
{
  name: 'contacts_list_groups',
  description: 'List contact groups/labels',
  schema: {
    source: z.enum(['apple', 'google', 'all']).default('all'),
  }
}
```

### Tool: `contacts_create`
```typescript
{
  name: 'contacts_create',
  description: 'Create a new contact (requires user confirmation)',
  schema: {
    source: z.enum(['apple', 'google']).describe('Where to create the contact'),
    name: z.string().describe('Full name'),
    email: z.string().optional().describe('Email address'),
    phone: z.string().optional().describe('Phone number'),
    organization: z.string().optional().describe('Company/organization'),
    notes: z.string().optional().describe('Notes about the contact'),
  }
}
```

### Tool: `contacts_find_duplicates`
```typescript
{
  name: 'contacts_find_duplicates',
  description: 'Find potential duplicate contacts across sources using fuzzy matching',
  schema: {
    source: z.enum(['apple', 'google', 'all']).default('all'),
    threshold: z.number().min(0.5).max(1.0).default(0.85)
      .describe('Similarity threshold (0.5-1.0, higher = stricter)'),
  }
}
```

### Tool: `contacts_relationship_context`
```typescript
{
  name: 'contacts_relationship_context',
  description: 'Get relationship context for a contact including last interaction dates, notes, and connection graph',
  schema: {
    query: z.string().describe('Contact name or identifier'),
    includeInteractions: z.boolean().default(true)
      .describe('Include last interaction dates from email/calendar if available'),
  }
}
```

---

## 7. Contact Deduplication and Merge Strategy

### Detection Algorithms

| Algorithm | Best For | Threshold |
|-----------|----------|-----------|
| **Levenshtein distance** | General string similarity | 85-90% for names |
| **Jaro-Winkler** | Short strings (names) — weights prefix matches higher | 0.85+ |
| **Soundex/Metaphone** | Phonetic matching (Smith vs Smyth) | Exact phonetic match |
| **Exact match** | Email addresses, phone numbers | 100% after normalization |

### Multi-field Scoring

```typescript
interface DeduplicationScore {
  nameScore: number;        // Jaro-Winkler on normalized name
  emailScore: number;       // Exact match after lowercasing
  phoneScore: number;       // Exact match after digit-only normalization
  orgScore: number;         // Fuzzy match on organization
  compositeScore: number;   // Weighted average
}

// Recommended weights:
// email: 0.35, phone: 0.30, name: 0.25, org: 0.10
```

### Merge Strategy (Survivorship Rules)

1. **Master record selection:** Prefer the record with the most complete information
2. **Field-level merge:** For each field, prefer non-empty values; if both populated, prefer the most recently updated
3. **Multi-value fields** (emails, phones): Union all values, deduplicate
4. **Source tracking:** Tag merged fields with their origin (Apple vs Google)
5. **Never auto-merge:** Always present duplicates to user for confirmation

### Cross-Source Deduplication

When contacts exist in both Apple and Google:
- Normalize phone numbers to E.164 format before comparison
- Lowercase and trim emails
- Use Jaro-Winkler on `firstName + lastName` with threshold 0.85
- A match on any two of {email, phone, name} with score > 0.85 flags as potential duplicate

---

## 8. CRM Features: Data Model Design

### Relationship Metadata (stored in local SQLite)

```sql
CREATE TABLE contact_relationships (
  id TEXT PRIMARY KEY,
  -- Links to external contact
  apple_contact_id TEXT,
  google_resource_name TEXT,

  -- Cached display info
  display_name TEXT NOT NULL,
  primary_email TEXT,
  primary_phone TEXT,
  organization TEXT,

  -- CRM fields
  relationship_type TEXT DEFAULT 'contact', -- contact, friend, family, colleague, client
  last_contact_date TEXT,                   -- ISO 8601
  last_contact_method TEXT,                 -- email, phone, in-person, message
  next_followup_date TEXT,                  -- ISO 8601
  contact_frequency TEXT,                   -- daily, weekly, monthly, quarterly

  -- Notes and context
  relationship_notes TEXT,                  -- Free-form notes
  tags TEXT,                                -- JSON array of tags

  -- Metadata
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  UNIQUE(apple_contact_id),
  UNIQUE(google_resource_name)
);

CREATE TABLE contact_interactions (
  id TEXT PRIMARY KEY,
  contact_relationship_id TEXT NOT NULL REFERENCES contact_relationships(id),
  interaction_date TEXT NOT NULL,           -- ISO 8601
  interaction_type TEXT NOT NULL,           -- email, call, meeting, message, note
  summary TEXT,                             -- Brief description
  sentiment TEXT,                           -- positive, neutral, negative
  source TEXT,                              -- manual, gmail, calendar
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_interactions_contact ON contact_interactions(contact_relationship_id);
CREATE INDEX idx_interactions_date ON contact_interactions(interaction_date);
CREATE INDEX idx_relationships_followup ON contact_relationships(next_followup_date);
```

### Integration with Other Connectors

- **Gmail connector:** Auto-populate `last_contact_date` from recent email threads
- **Google Calendar connector:** Detect meetings with contacts, log as interactions
- **Todoist connector:** Create follow-up tasks linked to contacts

---

## 9. Connector Definition

```typescript
import type { ConnectorDefinition } from '../types';
import { contactsTools } from './tools';

export const contactsConnector: ConnectorDefinition = {
  name: 'contacts',
  displayName: 'Contacts',
  description: 'Search, view, and manage contacts from Apple Contacts and Google People. Find duplicates, track relationships, and get context for your connections.',
  icon: '👥',
  category: 'communication',
  requiresAuth: true, // Google requires OAuth; Apple requires system permission
  tools: contactsTools,
};
```

### File Structure

```
apps/server/src/connectors/contacts/
├── index.ts              # ConnectorDefinition export
├── tools.ts              # Tool definitions (contacts_search, contacts_get, etc.)
├── apple.ts              # Apple Contacts backend (JXA via osascript)
├── google.ts             # Google People API backend
├── dedup.ts              # Deduplication algorithms
├── crm.ts                # CRM/relationship tracking (SQLite)
├── types.ts              # Unified contact types
└── __tests__/
    ├── apple.test.ts
    ├── google.test.ts
    ├── dedup.test.ts
    ├── crm.test.ts
    └── tools.test.ts
```

### Unified Contact Type

```typescript
interface UnifiedContact {
  id: string;
  source: 'apple' | 'google';
  sourceId: string;               // Apple contact ID or Google resourceName

  // Core fields
  displayName: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;

  // Multi-value fields
  emails: Array<{ value: string; label?: string; primary?: boolean }>;
  phones: Array<{ value: string; label?: string; primary?: boolean }>;
  addresses: Array<{
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    label?: string;
  }>;

  // Professional
  organization?: string;
  jobTitle?: string;
  department?: string;

  // Personal
  birthday?: string;              // ISO date
  notes?: string;
  photoUrl?: string;

  // Relationships
  relations?: Array<{ name: string; type: string }>;

  // Groups
  groups: string[];

  // Metadata
  lastModified?: string;          // ISO 8601
}
```

---

## 10. Testing Strategy

### Mock Contact Data

```typescript
export const MOCK_CONTACTS: UnifiedContact[] = [
  {
    id: 'apple-1',
    source: 'apple',
    sourceId: 'ABC123',
    displayName: 'John Smith',
    firstName: 'John',
    lastName: 'Smith',
    emails: [{ value: 'john@example.com', label: 'work', primary: true }],
    phones: [{ value: '+14155551234', label: 'mobile', primary: true }],
    addresses: [{ city: 'San Francisco', state: 'CA', country: 'US', label: 'home' }],
    organization: 'Acme Corp',
    jobTitle: 'Engineer',
    groups: ['Friends', 'Colleagues'],
    birthday: '1990-06-15',
    notes: 'Met at conference 2024',
  },
  {
    id: 'google-1',
    source: 'google',
    sourceId: 'people/c123456',
    displayName: 'Jon Smyth',           // Fuzzy duplicate of John Smith
    firstName: 'Jon',
    lastName: 'Smyth',
    emails: [{ value: 'john@example.com', label: 'work', primary: true }],
    phones: [{ value: '415-555-1234', label: 'mobile' }],
    addresses: [],
    organization: 'Acme Corporation',
    groups: ['myContacts'],
  },
  {
    id: 'apple-2',
    source: 'apple',
    sourceId: 'DEF456',
    displayName: 'Jane Doe',
    firstName: 'Jane',
    lastName: 'Doe',
    emails: [
      { value: 'jane@company.com', label: 'work', primary: true },
      { value: 'jane.doe@gmail.com', label: 'personal' },
    ],
    phones: [{ value: '+12125559876', label: 'work' }],
    addresses: [{ city: 'New York', state: 'NY', country: 'US', label: 'work' }],
    organization: 'BigCo Inc',
    jobTitle: 'VP Engineering',
    groups: ['Work'],
  },
];
```

### Test Scenarios

**Search Tests:**
- Search by exact name returns correct contact
- Search by partial name returns fuzzy matches
- Search by email returns correct contact
- Search by phone (various formats) normalizes and matches
- Search with `source: 'apple'` only returns Apple contacts
- Search with empty query returns error
- Search with limit=1 returns exactly one result

**Deduplication Tests:**
- "John Smith" and "Jon Smyth" with same email flagged as duplicates
- Phone numbers `+14155551234` and `415-555-1234` match after normalization
- Contacts with different names but same email flagged
- Contacts with same name but different email/phone NOT flagged (below threshold)
- Composite score calculation matches expected weights

**Apple Backend Tests (mocked osascript):**
- Mock `execFile` to return JXA JSON output
- Test parsing of multi-value fields (emails, phones)
- Test handling of contacts with missing fields
- Test timeout handling for slow osascript responses
- Test permission denied error handling

**Google Backend Tests (mocked fetch):**
- Mock People API responses for connections.list
- Mock searchContacts with pagination
- Test warmup request is sent before first search
- Test OAuth token refresh on 401
- Test rate limit (429) retry with exponential backoff
- Test batch operations respect 200-contact limit

**CRM Tests:**
- Create relationship record and retrieve it
- Log interaction and verify last_contact_date updates
- Query contacts by followup_date range
- Tags stored and retrieved as JSON array correctly

**Integration Tests:**
- Search across both sources returns unified results
- Duplicate detection across Apple + Google sources works
- Creating a contact in Google shows up in subsequent search

---

## Implementation Priority

### Phase 1: Read-Only (MVP)
1. `contacts_search` with Apple backend (JXA)
2. `contacts_get` with Apple backend
3. `contacts_list_groups` with Apple backend
4. Basic unified contact type

### Phase 2: Google Integration
5. Google OAuth setup (reuse Calendar OAuth client, add contacts scope)
6. `contacts_search` with Google backend
7. `contacts_get` with Google backend
8. Cross-source search (`source: 'all'`)

### Phase 3: Intelligence
9. `contacts_find_duplicates` with fuzzy matching
10. `contacts_relationship_context` with CRM data model
11. Interaction tracking (manual)

### Phase 4: Write + CRM
12. `contacts_create` with confirmation flow
13. Auto-populate interactions from Gmail/Calendar connectors
14. Follow-up reminders

---

## Key Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| JXA performance with 5000+ contacts | Cache contact list in memory; paginate osascript calls; fall back to SQLite for bulk reads |
| macOS permission denied silently | Detect permission status before operations; guide user to System Settings |
| Google OAuth scope creep (sensitive scope review) | Start with `contacts.readonly`; use incremental authorization for write scope |
| Contact schema differences between sources | Unified type abstracts differences; source-specific adapters handle mapping |
| AppleScript/JXA deprecation risk | JXA is still supported as of macOS 15 (Sequoia); Swift bridge is the backup plan |
| Rate limiting on Google API | Implement exponential backoff; cache search results for 60s; batch reads where possible |
