# Obsidian Connector Research

Issue: [#382](https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/382)
Created: 2026-03-25

---

## 1. Overview

Obsidian is a local-first knowledge management app where vaults are plain folders of Markdown files. Unlike cloud-based services, Obsidian requires **no API keys or OAuth** for basic access -- the vault is just a directory on disk. This makes it one of the simplest connectors to implement: direct filesystem access to `.md` files with YAML frontmatter, wikilinks, and a well-defined folder structure.

**Complexity**: Low
**Priority**: Medium
**Category**: productivity
**Auth required**: No (filesystem access); Optional (Local REST API plugin requires API key)

---

## 2. Access Methods

### 2a. Direct Filesystem Access (Recommended)

Obsidian vaults are plain directories containing `.md` files, attachments, and a `.obsidian/` configuration folder. No running Obsidian instance is required.

**Pros:**
- Zero dependencies -- works whether Obsidian is open or closed
- Full read/write access to all vault content
- No plugin installation required by the user
- Fast: native `fs` operations, no HTTP overhead
- Perfect for a desktop app with filesystem permissions (Tauri)

**Cons:**
- No access to Obsidian's runtime search index
- Must implement wikilink resolution ourselves
- No access to Dataview computed fields (those are runtime-only)

### 2b. Obsidian Local REST API Plugin

Community plugin that exposes Obsidian's internal API over HTTP (default port 27124).

**Endpoints:** `/vault/` (file CRUD), `/search/` (uses Obsidian's index), `/active/` (currently open file), `/periodic/` (daily/weekly notes), `/commands/` (execute Obsidian commands)

**Pros:**
- Access to Obsidian's built-in search index (faster for large vaults)
- Can interact with the active file and UI state
- Access to periodic notes via plugin conventions

**Cons:**
- Requires Obsidian to be running
- Requires user to install and configure the community plugin
- Requires API key management
- HTTP overhead for every operation
- Not available when Obsidian is closed

### 2c. Obsidian URI Scheme

`obsidian://` URIs can open vaults, files, search, and create notes. Limited to what the URI scheme supports -- primarily for launching Obsidian, not for data retrieval.

**Verdict:** Useful as a supplementary "open in Obsidian" feature, not a primary access method.

### Recommendation

**Use direct filesystem access as the primary method.** It aligns with our desktop-app context (Tauri has filesystem access), requires zero user setup, and works offline. Optionally detect and use the Local REST API for search if Obsidian is running.

---

## 3. Existing MCP Server Implementations

### [MarkusPfundstein/mcp-obsidian](https://github.com/MarkusPfundstein/mcp-obsidian) (2,200+ stars)
- **Approach:** Local REST API plugin bridge
- **Language:** Python
- **Tools:** `list_files_in_vault`, `list_files_in_dir`, `get_file_contents`, `search`, `patch_content`, `append_content`, `delete_file`
- **Takeaway:** Most popular implementation. Good tool naming conventions. Relies entirely on REST API (requires Obsidian running).

### [cyanheads/obsidian-mcp-server](https://github.com/cyanheads/obsidian-mcp-server)
- **Approach:** Local REST API with in-memory cache
- **Language:** TypeScript
- **Tools:** File CRUD, search (text/regex), frontmatter/tag management, periodic notes
- **Takeaway:** Most feature-complete. Has intelligent caching, case-insensitive path fallbacks, frontmatter merging. Good reference architecture.

### [bitbonsai/mcpvault](https://github.com/bitbonsai/mcp-obsidian)
- **Approach:** Direct filesystem (no REST API needed)
- **Language:** TypeScript
- **Takeaway:** Lightweight, read-focused. Demonstrates the filesystem-first approach we should use.

### [StevenStavrakis/obsidian-mcp](https://github.com/StevenStavrakis/obsidian-mcp)
- **Approach:** Direct filesystem
- **Language:** TypeScript
- **Takeaway:** Simple implementation, good for understanding minimal viable tool set.

### [aaronsb/obsidian-semantic-mcp](https://github.com/aaronsb/obsidian-semantic-mcp)
- **Approach:** Semantic operations (5 tools instead of 20+)
- **Takeaway:** Interesting UX design -- collapses many operations into fewer, smarter tools with workflow hints. Worth considering for our tool design.

### [jacksteamdev/obsidian-mcp-tools](https://github.com/jacksteamdev/obsidian-mcp-tools)
- **Approach:** Obsidian plugin (runs inside Obsidian)
- **Tools:** Semantic search via local embeddings, Templater integration
- **Takeaway:** Different architecture (plugin, not external server). Semantic search is compelling but requires Obsidian running.

---

## 4. Vault Discovery

### Vault Registry Location

Obsidian maintains a JSON registry of known vaults:

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/obsidian/obsidian.json` |
| Linux | `~/.config/obsidian/obsidian.json` |
| Windows | `%APPDATA%/obsidian/obsidian.json` |

The file contains a `vaults` object mapping vault IDs to `{ path, ts, open }`. Parse this to auto-discover vaults.

### Vault Detection

A directory is an Obsidian vault if it contains a `.obsidian/` subfolder. This folder holds:
- `app.json` -- core settings
- `appearance.json` -- theme settings
- `community-plugins.json` -- installed plugin list
- `plugins/` -- plugin data and settings
- `workspace.json` -- last UI state

### Implementation

```typescript
// Auto-discover vaults from Obsidian's registry
async function discoverVaults(): Promise<VaultInfo[]> {
  const registryPath = getObsidianRegistryPath(); // platform-specific
  const registry = JSON.parse(await fs.readFile(registryPath, 'utf-8'));
  return Object.entries(registry.vaults).map(([id, v]) => ({
    id,
    path: v.path,
    name: path.basename(v.path),
    lastOpened: v.ts,
  }));
}
```

---

## 5. Vault Content Parsing

### Frontmatter (YAML)

Obsidian notes commonly have YAML frontmatter delimited by `---`:

```markdown
---
title: Meeting Notes
tags: [work, project-x]
date: 2026-03-25
aliases: [standup, daily sync]
---

# Meeting Notes
...
```

**Library: `gray-matter`** (battle-tested, used by Gatsby, Astro, Vitepress, etc.)

```typescript
import matter from 'gray-matter';

const { data: frontmatter, content } = matter(fileContent);
// data = { title: 'Meeting Notes', tags: ['work', 'project-x'], ... }
// content = '# Meeting Notes\n...'
```

### Wikilinks

Obsidian uses `[[wikilink]]` syntax with several variants:

| Syntax | Meaning |
|--------|---------|
| `[[Note Name]]` | Link to note by basename |
| `[[Note Name\|Display Text]]` | Link with alias |
| `[[Note Name#Heading]]` | Link to specific heading |
| `[[Note Name#^block-id]]` | Link to specific block |
| `![[Note Name]]` | Transclusion (embed) |
| `![[image.png]]` | Image embed |

**Regex for extraction:**
```typescript
// Matches [[target]] and [[target|alias]] and ![[embeds]]
const WIKILINK_REGEX = /!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
```

**Resolution strategy:** Obsidian uses shortest-path matching -- `[[Meeting Notes]]` resolves to the note named `Meeting Notes.md` anywhere in the vault, preferring shorter paths when duplicates exist.

### Backlink Building

Build an in-memory index of all wikilinks to enable backlink queries:

```typescript
interface BacklinkIndex {
  // Map from target note basename -> set of source file paths
  [targetBasename: string]: Set<string>;
}
```

Scan all `.md` files, extract wikilinks, and populate the index. This enables "what links to this note?" queries.

### Tags

Tags appear in two places:
1. **Frontmatter:** `tags: [tag1, tag2]` or `tags:\n  - tag1\n  - tag2`
2. **Inline:** `#tag-name` anywhere in the body (but not in code blocks)

**Inline tag regex:** `(?:^|\s)#([a-zA-Z][a-zA-Z0-9_/-]*)`

Obsidian supports nested tags like `#project/active` and `#project/archived`.

---

## 6. Special Features

### Daily Notes

Obsidian's Daily Notes plugin stores notes with date-based filenames (default: `YYYY-MM-DD.md`). Configuration lives in `.obsidian/daily-notes.json`:

```json
{
  "folder": "Daily Notes",
  "format": "YYYY-MM-DD",
  "template": "Templates/Daily Note Template"
}
```

Our connector should:
- Read the daily notes config to know the folder and format
- Support `get_daily_note(date?)` that resolves to the right file
- Support `create_daily_note(date?)` using the configured template

### Templates

Template files live in a configurable folder (default: `Templates/`). They contain Templater syntax (`<% ... %>`) and core template variables (`{{date}}`, `{{title}}`). Our connector should support reading and applying templates.

### Canvas Files (`.canvas`)

Obsidian Canvas uses the open [JSON Canvas](https://jsoncanvas.org/) format:

```json
{
  "nodes": [
    { "id": "abc", "type": "text", "x": 0, "y": 0, "width": 400, "height": 200, "text": "..." },
    { "id": "def", "type": "file", "file": "Notes/Idea.md", ... }
  ],
  "edges": [
    { "id": "e1", "fromNode": "abc", "toNode": "def" }
  ]
}
```

Support reading canvas files to understand spatial relationships between notes.

### Dataview Integration

Dataview is a popular plugin that adds query capabilities. Its data lives in `.obsidian/plugins/dataview/data.json`. However, Dataview fields are **runtime-computed** -- we cannot access them without Obsidian running. What we CAN do:
- Parse inline Dataview fields: `[key:: value]` syntax in note bodies
- Parse frontmatter fields that Dataview indexes
- Detect Dataview code blocks (` ```dataview `) to understand query intent

### Folder Notes

Some users use folder-note plugins where a folder has a same-named `.md` file (e.g., `Projects/Projects.md`). Detect this pattern.

---

## 7. Proposed Tool Design

Following the ConnectorDefinition pattern and learning from existing implementations:

### Core Tools (Phase 1)

| Tool | Description | Annotations |
|------|-------------|-------------|
| `obsidian_list_vaults` | Discover and list registered Obsidian vaults | readOnly |
| `obsidian_search` | Full-text search across vault notes (content + frontmatter) | readOnly |
| `obsidian_read_note` | Read a note by path or name, returns frontmatter + content | readOnly |
| `obsidian_list_notes` | List notes in a folder (optionally recursive) with metadata | readOnly |
| `obsidian_get_backlinks` | Find all notes that link to a given note | readOnly |
| `obsidian_create_note` | Create a new note with optional frontmatter and template | destructiveHint |
| `obsidian_update_note` | Update a note (append, prepend, or replace content) | destructiveHint |

### Extended Tools (Phase 2)

| Tool | Description |
|------|-------------|
| `obsidian_get_tags` | List all tags in the vault with note counts |
| `obsidian_get_daily_note` | Read today's (or a specific date's) daily note |
| `obsidian_create_daily_note` | Create a daily note from template |
| `obsidian_read_canvas` | Parse and return canvas node/edge structure |
| `obsidian_get_frontmatter` | Read/update frontmatter properties specifically |

### Tool Parameters Design

```typescript
// obsidian_read_note
{
  vault: z.string().describe('Vault name or path'),
  path: z.string().optional().describe('Relative path within vault (e.g. "Projects/idea.md")'),
  name: z.string().optional().describe('Note name for wikilink-style resolution'),
  includeBacklinks: z.boolean().optional().default(false),
  includeFrontmatter: z.boolean().optional().default(true),
}

// obsidian_search
{
  vault: z.string().describe('Vault name or path'),
  query: z.string().describe('Search query (supports regex)'),
  folder: z.string().optional().describe('Limit search to folder'),
  tags: z.array(z.string()).optional().describe('Filter by tags'),
  limit: z.number().optional().default(20),
}
```

---

## 8. Libraries and Dependencies

| Library | Purpose | Size | Notes |
|---------|---------|------|-------|
| `gray-matter` | YAML frontmatter parsing | 27KB | Industry standard, supports YAML/JSON/TOML |
| `glob` / `fast-glob` | File discovery | -- | Already likely in project deps |
| `chokidar` | File watching (optional) | -- | For live vault change detection |
| *None needed* | Wikilink parsing | -- | Simple regex, no library needed |
| *None needed* | Markdown reading | -- | We read raw markdown; no AST needed |

**Note:** We do NOT need `unified`/`remark` for the connector. We are reading and returning raw markdown content, not transforming it. Frontmatter parsing with `gray-matter` and wikilink extraction with regex covers all our needs.

---

## 9. Testing Strategy

### Fixture Vault

Create a test fixture vault at `apps/server/src/connectors/obsidian/__fixtures__/test-vault/`:

```
test-vault/
  .obsidian/
    app.json
    daily-notes.json
    community-plugins.json
  Notes/
    Welcome.md              # Basic note with frontmatter
    Project Ideas.md        # Note with wikilinks and tags
    Meeting Notes/
      2026-03-25.md         # Nested note
  Daily Notes/
    2026-03-25.md           # Daily note
    2026-03-24.md
  Templates/
    Daily Note Template.md  # Template file
  Canvas/
    Overview.canvas         # JSON Canvas file
  Attachments/
    diagram.png             # Binary attachment (empty file for testing)
```

### Test Cases (bun:test)

```typescript
// Vault discovery
test('discovers vault from fixture path', ...);
test('identifies .obsidian folder presence', ...);

// Note reading
test('reads note with frontmatter and content', ...);
test('reads note by basename (wikilink resolution)', ...);
test('handles notes with no frontmatter', ...);
test('handles notes in nested folders', ...);

// Search
test('full-text search returns matching notes', ...);
test('search respects folder filter', ...);
test('search respects tag filter', ...);
test('regex search works', ...);

// Wikilinks and backlinks
test('extracts wikilinks from note content', ...);
test('extracts aliased wikilinks [[target|alias]]', ...);
test('extracts embed transclusions ![[...]]', ...);
test('builds backlink index correctly', ...);
test('resolves wikilink by shortest path', ...);

// Tags
test('extracts frontmatter tags', ...);
test('extracts inline #tags', ...);
test('handles nested tags #parent/child', ...);

// Daily notes
test('resolves daily note by date', ...);
test('reads daily note config from .obsidian', ...);

// Canvas
test('parses canvas JSON format', ...);
test('extracts file references from canvas nodes', ...);

// Write operations
test('creates note with frontmatter', ...);
test('appends content to existing note', ...);
test('refuses to overwrite without explicit flag', ...);

// Edge cases
test('handles empty vault gracefully', ...);
test('handles missing .obsidian folder', ...);
test('handles files with special characters in names', ...);
test('ignores .obsidian/ folder in search results', ...);
```

### Mock Strategy

Use the fixture vault on disk (real filesystem, no mocking). For vault discovery tests, mock the registry path to point at a test `obsidian.json` fixture.

---

## 10. Implementation Plan

### File Structure

```
apps/server/src/connectors/obsidian/
  index.ts          # ConnectorDefinition export
  tools.ts          # Tool definitions (Phase 1: 7 tools)
  api.ts            # Vault filesystem operations
  parser.ts         # Frontmatter, wikilink, tag extraction
  discovery.ts      # Vault discovery from registry
  types.ts          # Obsidian-specific types
  obsidian.test.ts  # Tests
  __fixtures__/
    test-vault/     # Fixture vault structure
    obsidian.json   # Mock vault registry
```

### ConnectorDefinition

```typescript
export const obsidianConnector: ConnectorDefinition = {
  name: 'obsidian',
  displayName: 'Obsidian',
  description: 'Read, search, and manage notes in your Obsidian vaults. Supports frontmatter, wikilinks, backlinks, daily notes, and canvas files.',
  icon: '????',
  category: 'productivity',
  requiresAuth: false,
  tools: obsidianTools,
};
```

### Phase 1 (Core -- estimated 1-2 days)
1. `discovery.ts` -- vault auto-discovery from `obsidian.json` registry
2. `parser.ts` -- frontmatter parsing (gray-matter), wikilink extraction, tag extraction
3. `api.ts` -- file read/list/search/create/update operations
4. `tools.ts` -- 7 core tools following weather connector pattern
5. `index.ts` -- ConnectorDefinition
6. Tests with fixture vault

### Phase 2 (Extended -- estimated 1 day)
1. Daily notes support (config reading + date resolution)
2. Canvas file parsing
3. Tag aggregation tool
4. Backlink index with caching
5. Additional tests

### Phase 3 (Optional enhancements)
1. File watcher for live vault changes (chokidar)
2. Local REST API detection for enhanced search when Obsidian is running
3. Template application support
4. Inline Dataview field extraction

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary access method | Direct filesystem | Works offline, no plugins needed, aligns with desktop app context |
| Frontmatter parser | gray-matter | Industry standard, battle-tested, small footprint |
| Wikilink parsing | Custom regex | Simple enough that a library is overkill |
| Markdown AST | Not needed | We return raw markdown; LLM interprets it natively |
| Search implementation | Simple string/regex scan | Good enough for Phase 1; can add REST API search later |
| Backlink index | In-memory, built on demand | Vaults are typically <10K files; full scan is fast |
| Auth | None required | Filesystem access only; vault path is the "credential" |
