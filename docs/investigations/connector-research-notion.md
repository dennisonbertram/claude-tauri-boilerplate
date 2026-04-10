# Notion Connector Research

Created: 2026-03-25
Issue: [#383](https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/383)

---

## 1. Executive Summary

Notion has a mature REST API and an **official MCP server** (`makenotion/notion-mcp-server`) that already covers the core CRUD surface. For this desktop app, the recommended approach is to build an **in-process Notion connector** using `@notionhq/client` (official SDK) wrapped in the `ConnectorDefinition` pattern, rather than shelling out to the external MCP server. This gives us full control over tool design, rate-limit handling, rich-text normalization, and token-efficient output formatting -- all critical for personal management use cases like reading lists, habit trackers, and CRM databases.

**Priority**: High | **Complexity**: Low-Medium | **Auth**: OAuth 2.0 (public integration) or Internal Integration Token

---

## 2. Notion API Overview

### Core Resources

| Resource | Description | Key Endpoints |
|----------|-------------|---------------|
| **Pages** | Content containers; can live inside other pages or databases | Create, Retrieve, Update, Archive |
| **Databases** | Structured collections with typed properties (schema) | Create, Retrieve, Query, Update |
| **Blocks** | Content units within pages (paragraphs, headings, lists, code, etc.) | Retrieve, List Children, Append Children, Update, Delete |
| **Users** | Workspace members and bots | List, Retrieve |
| **Comments** | Discussion threads on pages/blocks | Create, List |
| **Search** | Full-text search across pages and databases | POST /v1/search |
| **Data Sources** | (API 2025-09-03+) Primary abstraction for databases; supports multi-source databases | Retrieve, Query |

### API Versioning

- **Current**: `2026-03-11` (latest)
- **Major change**: `2025-09-03` introduced "data sources" as primary database abstraction, replacing direct database query for multi-source databases
- The official SDK handles version headers automatically

### Rate Limits

| Limit | Value | Notes |
|-------|-------|-------|
| Requests per integration | **3 req/sec average** (180/min) | Per-integration, not per-user |
| HTTP 429 handling | `Retry-After` header (seconds) | Must respect; exponential backoff recommended |
| Pagination page size | Max **100** items | Default 100; use `start_cursor` for continuation |
| Rich text per block | Max **2,000 characters** | Split longer content across multiple blocks |
| Block array per request | Max **100 blocks** | Batch appends accordingly |

### Content Limits

| Limit | Value |
|-------|-------|
| Rich text property max | 200,000 characters (100 blocks x 2,000 chars) |
| Nested block depth | Unlimited (but recursive fetch needed) |
| Database property types | 20+ types (title, rich_text, number, select, multi_select, date, people, files, checkbox, url, email, phone, formula, relation, rollup, created_time, last_edited_time, created_by, last_edited_by, status, unique_id) |

---

## 3. Existing MCP Implementations

### Official: `makenotion/notion-mcp-server`

**Repository**: https://github.com/makenotion/notion-mcp-server

| Aspect | Details |
|--------|---------|
| Maintainer | Notion (official) |
| Version | 2.0.0+ (migrated to API 2025-09-03) |
| Transport | stdio (default), Streamable HTTP |
| Auth | Internal integration token via env var |
| Language | TypeScript |

**Tools provided** (v2.0.0):

| Tool | Description |
|------|-------------|
| `notion-search` | Search across workspace (pages, databases) |
| `notion-retrieve-a-page` | Get page by ID |
| `notion-create-a-page` | Create page with Markdown body |
| `notion-update-page-properties` | Update page properties |
| `notion-archive-a-page` | Soft-delete a page |
| `notion-retrieve-a-database` | Get database metadata + data source IDs |
| `notion-retrieve-a-data-source` | Get data source schema |
| `notion-query-a-data-source` | Query with filters/sorts |
| `notion-create-a-data-source-item` | Add row to database |
| `notion-update-a-data-source-item` | Update database row |
| `notion-retrieve-block-children` | Get child blocks of a block/page |
| `notion-append-block-children` | Add blocks to a page (Markdown input) |
| `notion-delete-a-block` | Delete a specific block |
| `notion-retrieve-comments` | List comments on a page/block |
| `notion-create-a-comment` | Add a comment |
| `notion-retrieve-a-user` | Get user by ID |
| `notion-list-all-users` | List workspace members |
| `notion-create-view` | Create database view (table, board, calendar, etc.) |

**Key design decisions in official server**:
- Accepts **Markdown** for page content creation/updates (converts to blocks internally)
- Optimized for **token consumption** (AI-friendly output formatting)
- Automatic tool discovery at startup

### Community: `awkoy/notion-mcp-server`

- More feature-complete than early official versions
- Adds batch operations and template support
- TypeScript, production-ready

### Community: `suekou/mcp-notion-server`

- Lighter implementation
- Good for reference on minimal Notion MCP patterns

### Gap Analysis vs. Official MCP Server

The official MCP server covers the core surface well, but has limitations for personal management:

| Gap | Impact | Our Connector Can Fix |
|-----|--------|-----------------------|
| No batch operations (multi-page create/update) | Slow for bulk habit tracking entries | Yes -- batch tool with rate limiting |
| No recursive block fetching | Cannot get full page content in one call | Yes -- recursive fetch with depth limit |
| No database template instantiation | Cannot create from templates via API | Partial -- create page with pre-defined properties |
| No smart property type detection | LLM must know exact property schemas | Yes -- schema-aware tools with property introspection |
| No cross-database relation traversal | Cannot follow relations automatically | Yes -- relation-aware query tool |
| Limited search filtering | No property-based search refinement | Yes -- combine search + database query |
| No date-range shortcuts | "This week's habits" requires manual date math | Yes -- relative date helpers |
| No rollup/formula value access in queries | Computed values not queryable | Notion API limitation -- cannot fix |

---

## 4. Authentication

### Option A: Internal Integration Token (Recommended for MVP)

1. User creates an integration at https://www.notion.so/my-integrations
2. User shares specific pages/databases with the integration
3. Token stored securely in app's encrypted credential store
4. **Pros**: Simple, no OAuth flow, no server-side callback needed
5. **Cons**: User must manually share pages; token has workspace-wide read/write

**Implementation**:
```typescript
// Stored in app's credential store (encrypted SQLite or OS keychain)
const notion = new Client({ auth: storedToken });
```

### Option B: OAuth 2.0 Public Integration (Production)

**Flow**:
1. App opens browser to `https://api.notion.com/v1/oauth/authorize?client_id=...&redirect_uri=...&response_type=code`
2. User selects workspace and pages to share
3. Notion redirects to app's callback URI with `code` parameter
4. App exchanges code for access token via `POST https://api.notion.com/v1/oauth/token`
5. Access tokens **do not expire** -- single auth flow per workspace

**Tauri-specific considerations**:
- Use deep link (`claude-tauri://notion-callback`) or localhost redirect
- Token exchange must happen server-side (client_secret required)
- Store token in Bun sidecar's encrypted credential store
- Notion requires **security review** before public integration publishing

**Implementation**:
```typescript
// Server-side token exchange (Hono route)
app.get('/api/auth/notion/callback', async (c) => {
  const code = c.req.query('code');
  const response = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI }),
  });
  const { access_token, workspace_id, workspace_name } = await response.json();
  // Store encrypted in DB
});
```

### Recommended Approach

Start with **Internal Integration Token** for MVP (simpler, no OAuth review needed), then add OAuth 2.0 for production release.

---

## 5. Proposed Tool Design

### Tool Naming Convention

Following the existing `weather_*` pattern: `notion_*` prefix for all tools.

### Core Tools (Phase 1 -- MVP)

#### `notion_search`
Search across workspace pages and databases.
```typescript
{
  query: z.string().describe('Search query text'),
  filter_type: z.enum(['page', 'database']).optional().describe('Filter to pages or databases only'),
  page_size: z.number().min(1).max(100).optional().describe('Results per page (default 10)'),
}
```
**Annotations**: `readOnlyHint: true, openWorldHint: true`

#### `notion_get_page`
Retrieve a page with its properties and optionally its content blocks.
```typescript
{
  page_id: z.string().describe('Notion page ID or URL'),
  include_content: z.boolean().optional().describe('Also fetch page content blocks (default false)'),
  max_depth: z.number().min(1).max(5).optional().describe('Max block nesting depth (default 2)'),
}
```
**Annotations**: `readOnlyHint: true`

#### `notion_create_page`
Create a new page in a parent page or database.
```typescript
{
  parent_id: z.string().describe('Parent page ID or database ID'),
  parent_type: z.enum(['page', 'database']).describe('Whether parent is a page or database'),
  title: z.string().describe('Page title'),
  properties: z.record(z.any()).optional().describe('Database properties (for database parents)'),
  content_markdown: z.string().optional().describe('Page body in Markdown'),
}
```

#### `notion_update_page`
Update page properties or archive/unarchive.
```typescript
{
  page_id: z.string().describe('Notion page ID'),
  properties: z.record(z.any()).optional().describe('Properties to update'),
  archived: z.boolean().optional().describe('Archive or unarchive the page'),
}
```

#### `notion_query_database`
Query a database with filters and sorts.
```typescript
{
  database_id: z.string().describe('Database ID'),
  filter: z.any().optional().describe('Notion filter object'),
  sorts: z.array(z.any()).optional().describe('Sort conditions'),
  page_size: z.number().min(1).max(100).optional().describe('Results per page (default 25)'),
  start_cursor: z.string().optional().describe('Pagination cursor'),
}
```
**Annotations**: `readOnlyHint: true`

#### `notion_get_database_schema`
Get database properties/schema for understanding structure before querying.
```typescript
{
  database_id: z.string().describe('Database ID'),
}
```
**Annotations**: `readOnlyHint: true`

### Enhanced Tools (Phase 2 -- Personal Management)

#### `notion_append_content`
Append content blocks to an existing page.
```typescript
{
  page_id: z.string().describe('Page or block ID to append to'),
  content_markdown: z.string().describe('Content in Markdown to append'),
}
```

#### `notion_manage_comments`
Create or list comments on a page.
```typescript
{
  page_id: z.string().describe('Page ID'),
  action: z.enum(['list', 'create']).describe('List or create comments'),
  body: z.string().optional().describe('Comment text (for create)'),
}
```

#### `notion_quick_entry`
Smart shortcut for common personal management operations.
```typescript
{
  database_id: z.string().describe('Target database ID'),
  template: z.enum(['reading_list', 'habit_check', 'crm_contact', 'task', 'journal']).describe('Entry type'),
  data: z.record(z.any()).describe('Template-specific data'),
}
```
This tool auto-maps simple input to the correct database property types, handling date parsing, select/multi-select matching, and relation lookups.

### Advanced Tools (Phase 3 -- Power User)

#### `notion_batch_update`
Update multiple database entries in one operation (with rate limiting).
```typescript
{
  database_id: z.string().describe('Database ID'),
  updates: z.array(z.object({
    page_id: z.string(),
    properties: z.record(z.any()),
  })).max(20).describe('Up to 20 updates'),
}
```

#### `notion_database_summary`
Aggregate/summarize database contents (counts, date ranges, status distribution).
```typescript
{
  database_id: z.string().describe('Database ID'),
  group_by: z.string().optional().describe('Property to group by'),
  date_range: z.enum(['today', 'this_week', 'this_month', 'last_30_days', 'all']).optional(),
}
```
**Annotations**: `readOnlyHint: true`

---

## 6. Implementation Architecture

### File Structure

```
apps/server/src/connectors/notion/
  index.ts          -- ConnectorDefinition export
  tools.ts          -- Tool definitions using SDK tool() helper
  api.ts            -- Notion API wrapper (thin layer over @notionhq/client)
  auth.ts           -- Token management (internal token + OAuth)
  markdown.ts       -- Markdown <-> Notion blocks conversion
  rate-limiter.ts   -- Token-bucket rate limiter (3 req/sec)
  types.ts          -- Notion-specific TypeScript types
  notion.test.ts    -- Unit tests with mocked API responses
```

### ConnectorDefinition

```typescript
// apps/server/src/connectors/notion/index.ts
import type { ConnectorDefinition } from '../types';
import { notionTools } from './tools';

export const notionConnector: ConnectorDefinition = {
  name: 'notion',
  displayName: 'Notion',
  description: 'Search, read, create, and manage Notion pages, databases, and content. Supports personal management workflows like reading lists, habit trackers, and CRM databases.',
  icon: '📝',
  category: 'productivity',
  requiresAuth: true,
  tools: notionTools,
};
```

### Registration

```typescript
// apps/server/src/connectors/index.ts (add to CONNECTORS array)
import { notionConnector } from './notion';

const CONNECTORS: ConnectorDefinition[] = [weatherConnector, notionConnector];
```

### Rate Limiter

```typescript
// Simple token-bucket for 3 req/sec
class NotionRateLimiter {
  private tokens = 3;
  private lastRefill = Date.now();
  private readonly maxTokens = 3;
  private readonly refillRate = 1000; // 1 second

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + (elapsed / this.refillRate) * this.maxTokens);
    this.lastRefill = now;

    if (this.tokens < 1) {
      const waitMs = ((1 - this.tokens) / this.maxTokens) * this.refillRate;
      await new Promise(resolve => setTimeout(resolve, waitMs));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}
```

### Markdown Conversion

Key challenge: Notion uses a block-based content model, not Markdown. Need bidirectional conversion.

**Notion blocks to Markdown** (for reading):
- `paragraph` -> plain text
- `heading_1/2/3` -> `# / ## / ###`
- `bulleted_list_item` -> `- item`
- `numbered_list_item` -> `1. item`
- `to_do` -> `- [ ] / - [x]`
- `code` -> fenced code blocks with language
- `quote` -> `> text`
- `callout` -> `> emoji text`
- `toggle` -> `<details>` or custom format
- `image/file/pdf` -> `![alt](url)`
- `table` -> Markdown table
- `divider` -> `---`
- Rich text annotations -> `**bold**`, `*italic*`, `~~strikethrough~~`, `` `code` ``

**Markdown to Notion blocks** (for writing):
- Parse Markdown AST (use `marked` or `markdown-it`)
- Convert to Notion block objects
- Handle 2,000-char limit per rich text segment
- Handle 100-block limit per append request

### Recursive Block Fetching

```typescript
async function fetchBlocksRecursive(
  blockId: string,
  depth: number = 0,
  maxDepth: number = 3
): Promise<NotionBlock[]> {
  if (depth >= maxDepth) return [];

  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;

  do {
    const response = await rateLimiter.wrap(() =>
      notion.blocks.children.list({ block_id: blockId, start_cursor: cursor, page_size: 100 })
    );
    for (const block of response.results) {
      blocks.push(block);
      if (block.has_children) {
        block._children = await fetchBlocksRecursive(block.id, depth + 1, maxDepth);
      }
    }
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return blocks;
}
```

---

## 7. Personal Management Use Cases

### Reading List Database

**Typical schema**:
| Property | Type | Usage |
|----------|------|-------|
| Title | title | Book/article name |
| Author | rich_text | Author name |
| Status | select | To Read, Reading, Finished, Abandoned |
| Rating | number | 1-5 stars |
| Genre | multi_select | Fiction, Non-Fiction, Tech, etc. |
| Date Added | date | When added to list |
| Date Finished | date | Completion date |
| Notes | rich_text | Brief review/notes |
| URL | url | Link to book/article |

**AI interactions**: "Add 'Designing Data-Intensive Applications' to my reading list", "What books am I currently reading?", "Mark 'Atomic Habits' as finished with 5 stars", "Show me all unfinished non-fiction books"

### Habit Tracker Database

**Typical schema**:
| Property | Type | Usage |
|----------|------|-------|
| Date | date | Tracking date |
| Habit | select or relation | Which habit |
| Completed | checkbox | Done or not |
| Streak | formula/number | Consecutive days |
| Notes | rich_text | Optional context |

**AI interactions**: "Log that I meditated and exercised today", "How's my meditation streak?", "Show my habit completion for this week", "Which habits am I falling behind on?"

### Personal CRM Database

**Typical schema**:
| Property | Type | Usage |
|----------|------|-------|
| Name | title | Contact name |
| Company | rich_text | Organization |
| Email | email | Contact email |
| Phone | phone_number | Contact phone |
| Last Contact | date | Last interaction date |
| Relationship | select | Friend, Colleague, Client, Family |
| Tags | multi_select | Categorization |
| Birthday | date | Birthday |
| Notes | rich_text | Context about the person |

**AI interactions**: "Add a new contact: John Smith from Acme Corp", "Who haven't I contacted in over 30 days?", "Show me all contacts tagged 'investor'", "When is Sarah's birthday?"

### Task/Project Database

**Typical schema**:
| Property | Type | Usage |
|----------|------|-------|
| Task | title | Task name |
| Status | status | Not Started, In Progress, Done |
| Priority | select | High, Medium, Low |
| Due Date | date | Deadline |
| Assignee | people | Who's responsible |
| Project | relation | Related project |
| Tags | multi_select | Labels |

**AI interactions**: "What's due this week?", "Create a task to review Q4 budget by Friday", "Show all high-priority incomplete tasks", "Move 'API redesign' to In Progress"

### Journal/Daily Notes

**AI interactions**: "Create today's journal entry", "What did I write about last Monday?", "Search my journal for entries about 'startup ideas'"

---

## 8. Testing Strategy

### Unit Tests (mocked API)

```typescript
// apps/server/src/connectors/notion/notion.test.ts

import { describe, it, expect, mock } from 'bun:test';

// Mock @notionhq/client
const mockSearch = mock(() => Promise.resolve({
  results: [
    { id: 'page-1', object: 'page', properties: { title: { title: [{ plain_text: 'Test Page' }] } } }
  ],
  has_more: false,
  next_cursor: null,
}));

// Test search tool
describe('notion_search', () => {
  it('returns formatted results for a query', async () => { /* ... */ });
  it('handles empty results gracefully', async () => { /* ... */ });
  it('respects page_size parameter', async () => { /* ... */ });
  it('paginates when has_more is true', async () => { /* ... */ });
});

// Test database query tool
describe('notion_query_database', () => {
  it('passes filter and sort to API correctly', async () => { /* ... */ });
  it('handles all property types in response', async () => { /* ... */ });
  it('returns pagination cursor when more results exist', async () => { /* ... */ });
});

// Test rate limiter
describe('NotionRateLimiter', () => {
  it('allows 3 immediate requests', async () => { /* ... */ });
  it('delays 4th request appropriately', async () => { /* ... */ });
  it('recovers after waiting', async () => { /* ... */ });
});

// Test Markdown conversion
describe('markdown conversion', () => {
  it('converts heading blocks to markdown', () => { /* ... */ });
  it('converts todo blocks with checkbox state', () => { /* ... */ });
  it('handles nested blocks with indentation', () => { /* ... */ });
  it('splits long text across multiple blocks', () => { /* ... */ });
  it('preserves rich text annotations', () => { /* ... */ });
});

// Test recursive block fetching
describe('fetchBlocksRecursive', () => {
  it('fetches nested blocks up to maxDepth', async () => { /* ... */ });
  it('respects rate limits during recursive fetch', async () => { /* ... */ });
  it('handles pagination within block children', async () => { /* ... */ });
});
```

### Integration Test Scenarios (with real API, guarded by env var)

1. Create a test page, verify it appears in search
2. Create a database, add items, query with filters
3. Append content blocks, read them back
4. Update properties, verify changes
5. Create and list comments
6. Verify rate limiter handles burst correctly

---

## 9. Dependencies

| Package | Version | Purpose | Size Impact |
|---------|---------|---------|-------------|
| `@notionhq/client` | ^2.x | Official Notion SDK | ~50KB (minimal deps) |
| `marked` or `markdown-it` | Latest | Markdown parsing for content conversion | ~30-50KB |
| `zod` | Already in project | Input validation for tools | 0 (already bundled) |
| `@anthropic-ai/claude-agent-sdk` | Already in project | `tool()` helper and `createSdkMcpServer` | 0 (already bundled) |

**No additional heavy dependencies required.** The Notion SDK is lightweight and the Markdown parser is the only new addition.

---

## 10. Implementation Phases & Recommendations

### Phase 1: Core CRUD (1-2 days)

- [ ] Set up `apps/server/src/connectors/notion/` directory structure
- [ ] Implement `api.ts` with `@notionhq/client` wrapper + rate limiter
- [ ] Implement 6 core tools: `notion_search`, `notion_get_page`, `notion_create_page`, `notion_update_page`, `notion_query_database`, `notion_get_database_schema`
- [ ] Basic Markdown-to-blocks conversion (paragraphs, headings, lists, code)
- [ ] Register in connector index
- [ ] Internal Integration Token auth (env var `NOTION_API_KEY`)
- [ ] Unit tests with mocked API responses

### Phase 2: Content & Personal Management (1-2 days)

- [ ] Full bidirectional Markdown conversion (all block types)
- [ ] Recursive block fetching with depth control
- [ ] `notion_append_content` and `notion_manage_comments` tools
- [ ] `notion_quick_entry` smart shortcut tool
- [ ] Property type introspection for LLM-friendly schema descriptions
- [ ] Date-range helpers ("this week", "last 30 days")

### Phase 3: Power Features (1 day)

- [ ] `notion_batch_update` with rate-limited queue
- [ ] `notion_database_summary` aggregation tool
- [ ] OAuth 2.0 flow (Tauri deep link callback)
- [ ] Credential encryption in DB
- [ ] Cross-database relation traversal

### Key Recommendations

1. **Use `@notionhq/client` directly** rather than wrapping the official MCP server. The in-process pattern (`createSdkMcpServer`) gives better control over output formatting, rate limiting, and error handling.

2. **Token-efficient output formatting** is critical. Notion API responses are verbose (deep nested objects). Tools should extract and flatten relevant data before returning to the LLM.

3. **Schema-aware tools** dramatically improve LLM accuracy. The `notion_get_database_schema` tool should return property names, types, and valid select/status options so the LLM can construct correct filters and property values.

4. **Markdown as the interface language**. Accept Markdown input for content creation (convert to blocks internally) and return Markdown for content reading (convert from blocks). This is what the official MCP server does and it works well.

5. **Rate limiting must be global per-connector**, not per-tool. A shared rate limiter instance ensures that parallel tool calls from the LLM don't exceed 3 req/sec.

6. **Page ID extraction from URLs**. Users will paste Notion URLs; tools should accept both raw IDs and full URLs, extracting the ID automatically.

7. **Start with Internal Integration Token**. OAuth 2.0 adds significant complexity (callback handling, security review) and can be added later. For a personal desktop app, the internal token is sufficient.

---

## Sources

- [Notion MCP Official Docs](https://developers.notion.com/docs/mcp)
- [Notion MCP Supported Tools](https://developers.notion.com/docs/mcp-supported-tools)
- [Official Notion MCP Server (GitHub)](https://github.com/makenotion/notion-mcp-server)
- [Notion API Authorization Guide](https://developers.notion.com/guides/get-started/authorization)
- [Notion API Rate Limits](https://developers.notion.com/reference/request-limits)
- [Notion API Block Reference](https://developers.notion.com/reference/block)
- [@notionhq/client SDK (npm)](https://www.npmjs.com/package/@notionhq/client)
- [notion-sdk-js (GitHub)](https://github.com/makenotion/notion-sdk-js)
- [Working with Page Content](https://developers.notion.com/docs/working-with-page-content)
- [Notion's Hosted MCP Server Blog Post](https://www.notion.com/blog/notions-hosted-mcp-server-an-inside-look)
- [Solving the Notion 25-Reference Limit in MCP](https://www.mymcpshelf.com/blog/solving-notion-25-reference-limit-mcp/)
- [Notion API Rate Limit Handling Guide](https://thomasjfrank.com/how-to-handle-notion-api-request-limits/)
- [Community Notion MCP Server (awkoy)](https://github.com/awkoy/notion-mcp-server)
- [Community Notion MCP Server (suekou)](https://github.com/suekou/mcp-notion-server)
