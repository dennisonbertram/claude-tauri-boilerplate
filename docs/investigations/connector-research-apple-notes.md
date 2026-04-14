# Apple Notes Connector Research

**Date:** 2026-03-25
**Issue:** #381
**Purpose:** Evaluate approaches for building an Apple Notes connector as an in-process MCP server using the ConnectorDefinition pattern.

---

## 1. Executive Summary

Apple Notes can be accessed programmatically on macOS through two primary methods: AppleScript/JXA (high-level, permission-friendly, limited fidelity) and direct SQLite database access (low-level, requires Full Disk Access, full fidelity). Multiple open-source Apple Notes MCP servers already exist and validate the feasibility of both approaches. The recommended strategy for this project is **JXA as the primary access layer** with optional SQLite-based enrichment for advanced features like attachment extraction. The connector should be **read-heavy by default** with carefully gated write operations given the sensitivity of personal notes.

---

## 2. Existing Implementations (Prior Art)

At least 8 Apple Notes MCP servers exist on GitHub. Key ones:

| Repository | Approach | Runtime | Features |
|---|---|---|---|
| [RafalWilinski/mcp-apple-notes](https://github.com/RafalWilinski/mcp-apple-notes) | SQLite + embeddings | Bun | Semantic search (all-MiniLM-L6-v2), RAG over notes |
| [sirmews/apple-notes-mcp](https://github.com/sirmews/apple-notes-mcp) | AppleScript via osascript | Python (uv) | Read/write, simple CRUD |
| [Siddhant-K-code/mcp-apple-notes](https://github.com/Siddhant-K-code/mcp-apple-notes) | AppleScript | Node.js | Create, search, retrieve |
| [sweetrb/apple-notes-mcp](https://github.com/sweetrb/apple-notes-mcp) | AppleScript | Node.js | Full CRUD, folder management |
| [disco-trooper/apple-notes-mcp](https://github.com/disco-trooper/apple-notes-mcp) | Hybrid (JXA + SQLite) | Node.js | Semantic search, CRUD |
| [peerasak-u/apple-notes-skill](https://github.com/peerasak-u/apple-notes-skill) | JXA | Claude Code skill | Search, read, create, delete, HTML-to-markdown |
| [willer/apple-mcp](https://github.com/willer/apple-mcp) | AppleScript | Python | Notes + Reminders combined |
| [henilcalagiya/mcp-apple-notes](https://github.com/henilcalagiya/mcp-apple-notes) | AppleScript | Node.js | Full automation via AppleScript API layer |

**Key takeaway:** Every production implementation uses AppleScript/JXA as the primary or sole access method. SQLite is used only as a supplement for semantic search or attachment extraction.

---

## 3. Access Methods Comparison

### 3a. AppleScript / JXA (JavaScript for Automation)

**How it works:** macOS includes a scripting bridge that exposes Notes.app's object model: `Application > Account > Folder > Note`. JXA is the JavaScript variant of AppleScript and can be invoked via `osascript -l JavaScript`.

**Object model hierarchy:**
```
Application("Notes")
  .accounts[]            // iCloud, On My Mac, Gmail, etc.
    .folders[]           // User folders + system folders
      .notes[]           // Individual notes
        .name()          // Title
        .body()          // HTML content
        .plaintext()     // Plain text content
        .creationDate()
        .modificationDate()
        .id()            // Persistent identifier
```

**Capabilities:**
- List accounts, folders, notes with metadata
- Read note body as HTML or plain text
- Create new notes (with HTML body)
- Move notes between folders
- Delete notes (moves to Recently Deleted)
- Search notes by name (via `whose` clause)

**Limitations:**
- **Attachments are invisible:** `note.body()` returns HTML where images/attachments are represented as empty `<div>` elements with no image data or file references
- **No table content:** Tables render as empty structures in the HTML output
- **No drawing/scan data:** Handwritten notes and scanned documents are not accessible
- **Performance:** Each osascript invocation is a subprocess; listing thousands of notes is slow (~2-5 seconds for 500+ notes)
- **"Half-baked" scripting support:** Community reports numerous quirks and inconsistent behavior across macOS versions
- **No password-protected notes:** Locked notes cannot be read via scripting

**Permissions:** Requires Automation permission (TCC). On first use, macOS shows a dialog: "Terminal.app wants to control Notes.app." User must approve. For a Tauri app, the parent app binary needs the approval.

### 3b. Direct SQLite Database Access

**Database location:**
```
~/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite
```

**Key tables:**

| Table | Purpose |
|---|---|
| `ZICCLOUDSYNCINGOBJECT` | Master table for notes, folders, accounts, attachments |
| `ZICNOTEDATA` | Note content (protobuf blobs in `ZDATA` column) |
| `Z_PRIMARYKEY` | Maps entity types to Z_ENT integer keys |

**Note body format:** The `ZICNOTEDATA.ZDATA` column contains a **gzip-compressed Protocol Buffer** blob. The protobuf schema includes:
- Note text as a single string
- "Attribute Runs" - formatting metadata with lengths indicating which portion of text they apply to
- Attachment references - Unicode replacement characters in the text with corresponding UUIDs in attribute runs
- Style information (paragraph styles, fonts, etc.)

**Protobuf schema** (reverse-engineered, see [apple_cloud_notes_parser proto](https://github.com/threeplanetssoftware/apple_cloud_notes_parser/blob/master/proto/notestore.proto)):
```protobuf
message NoteStoreProto {
  message AttributeRun {
    required int32 length = 1;
    optional ParagraphStyle paragraph_style = 2;
    optional Font font = 3;
    optional int32 font_weight = 5;
    optional bool underlined = 6;
    optional bool strikethrough = 7;
    optional int32 superscript = 8;
    optional string link = 9;
    optional Color color = 10;
    optional AttachmentInfo attachment_info = 12;
  }
  required string text = 2;
  repeated AttributeRun attribute_run = 5;
}
```

**Capabilities beyond JXA:**
- Read attachment metadata and binary data
- Access table cell contents
- Read checklist state
- Access drawing/scan data references
- Full-text search via SQL
- Much faster bulk reads (direct SQL vs. subprocess per note)

**Limitations:**
- **Requires Full Disk Access (FDA):** The `group.com.apple.notes` container is TCC-protected. The Tauri app binary must be granted FDA in System Settings > Privacy > Full Disk Access.
- **Protobuf parsing complexity:** Must decompress gzip, then parse the proprietary protobuf. No official schema; relies on reverse-engineered definitions.
- **Schema changes across macOS versions:** Apple modifies the database schema without notice. The parser must handle differences between macOS Catalina, Big Sur, Monterey, Ventura, Sonoma, and Sequoia.
- **Read-only in practice:** Writing to the database directly risks corruption, sync conflicts, and data loss. Apple does not support external writes.
- **WAL mode locking:** The database uses WAL (Write-Ahead Logging); concurrent access from Notes.app and external readers is generally safe for reads.

### 3c. Shortcuts / URL Schemes

**mobilenotes:// URL scheme** can open specific notes but cannot read content programmatically. **Shortcuts.app** can automate Notes actions but requires user interaction and cannot be called headlessly from a background process. Not viable as a primary access method.

### Recommendation: Hybrid JXA-Primary Approach

```
                  +------------------+
                  |  Apple Notes     |
                  |  Connector       |
                  +--------+---------+
                           |
              +------------+------------+
              |                         |
     +--------v--------+     +---------v---------+
     |  JXA Layer       |     |  SQLite Layer     |
     |  (Primary)       |     |  (Optional)       |
     +------------------+     +-------------------+
     | - List notes     |     | - Attachment data |
     | - Read content   |     | - Table contents  |
     | - Create notes   |     | - Bulk search     |
     | - Search         |     | - Checklist state |
     | - Move/delete    |     +-------------------+
     +------------------+        Requires FDA
       Requires Automation
       permission only
```

**Rationale:** JXA works with just Automation permission (lower friction), handles the 90% use case (read/search/create text notes), and all existing MCP servers validate this approach. SQLite access can be added later as an opt-in "enhanced mode" for users who grant FDA and want attachment/table support.

---

## 4. Proposed Tool Definitions

Based on the ConnectorDefinition pattern and analysis of existing implementations:

```typescript
// Connector: apple_notes
// Category: 'productivity'
// requiresAuth: false (uses macOS system permissions)

const tools: ConnectorToolDefinition[] = [
  {
    name: 'apple_notes_list',
    description: 'List notes with titles, dates, and folder info. Supports filtering by folder and account.',
    // params: { folder?: string, account?: string, limit?: number }
  },
  {
    name: 'apple_notes_read',
    description: 'Read the full content of a specific note by title or ID. Returns markdown-converted text.',
    // params: { title?: string, id?: string }
  },
  {
    name: 'apple_notes_search',
    description: 'Search notes by keyword. Returns matching note titles and snippets.',
    // params: { query: string, limit?: number }
  },
  {
    name: 'apple_notes_create',
    description: 'Create a new note in Apple Notes with a title and body (markdown or plain text).',
    // params: { title: string, body: string, folder?: string, account?: string }
  },
  {
    name: 'apple_notes_folders',
    description: 'List all folders and accounts in Apple Notes.',
    // params: { account?: string }
  },
];
```

**Deferred (v2, requires SQLite layer):**
- `apple_notes_attachments` - List/extract attachments from a note
- `apple_notes_tables` - Read table data from notes
- `apple_notes_checklists` - Read checklist items and their checked state

---

## 5. Implementation Architecture

### File Structure

```
apps/server/src/connectors/apple-notes/
  index.ts          # ConnectorDefinition export
  tools.ts          # Tool definitions using SDK tool()
  api.ts            # JXA execution layer
  jxa-scripts.ts    # JXA script templates
  html-to-markdown.ts  # Convert Notes HTML to clean markdown
  __tests__/
    api.test.ts
    tools.test.ts
    html-to-markdown.test.ts
    fixtures/
      sample-note.html
      sample-list.json
```

### JXA Execution Pattern

```typescript
// api.ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function runJxa(script: string): Promise<string> {
  const { stdout } = await execFileAsync('osascript', ['-l', 'JavaScript', '-e', script], {
    timeout: 15000, // 15s timeout for large note collections
    maxBuffer: 10 * 1024 * 1024, // 10MB for large results
  });
  return stdout.trim();
}

export async function listNotes(folder?: string, account?: string, limit = 100): Promise<NoteMetadata[]> {
  const script = `
    const Notes = Application("Notes");
    let container = Notes;
    ${account ? `container = Notes.accounts.byName("${account}");` : ''}
    ${folder ? `const folder = container.folders.byName("${folder}");` : 'const folder = container;'}
    const notes = folder.notes().slice(0, ${limit});
    JSON.stringify(notes.map(n => ({
      id: n.id(),
      name: n.name(),
      created: n.creationDate().toISOString(),
      modified: n.modificationDate().toISOString(),
      folder: n.container().name(),
      account: n.container().container().name(),
    })));
  `;
  return JSON.parse(await runJxa(script));
}

export async function readNote(title: string): Promise<{ title: string; body: string; html: string }> {
  const script = `
    const Notes = Application("Notes");
    const matches = Notes.notes.whose({ name: "${title.replace(/"/g, '\\"')}" })();
    if (matches.length === 0) throw new Error("Note not found: ${title}");
    const n = matches[0];
    JSON.stringify({
      title: n.name(),
      html: n.body(),
      plaintext: n.plaintext(),
    });
  `;
  const result = JSON.parse(await runJxa(script));
  return {
    title: result.title,
    body: htmlToMarkdown(result.html), // Convert HTML to readable markdown
    html: result.html,
  };
}
```

### HTML-to-Markdown Conversion

Notes.app returns note bodies as HTML. Converting to markdown is important because:
1. LLMs process markdown more efficiently than HTML
2. Token count is significantly lower
3. Formatting is preserved in a readable way

Recommended approach: Use a lightweight HTML-to-markdown converter (e.g., `turndown` or a custom regex-based converter for the limited HTML subset Notes uses). The HTML from Notes is a constrained subset:
- `<div>`, `<br>` for line breaks
- `<b>`, `<i>`, `<u>`, `<strike>` for inline formatting
- `<ul>`, `<ol>`, `<li>` for lists
- `<h1>`-`<h6>` for headings
- `<a href="...">` for links
- `<table>`, `<tr>`, `<td>` for tables (content may be empty via JXA)
- Empty `<div>` placeholders for attachments

A custom converter (~100 lines) is preferable to a full dependency to keep the connector lightweight.

---

## 6. Database Deep Dive (SQLite Layer - Future Enhancement)

### Location and Access

```bash
# Database path
~/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite

# Companion files (WAL mode)
NoteStore.sqlite-wal
NoteStore.sqlite-shm
```

### Reading Notes via SQL

```sql
-- Get all notes with metadata
SELECT
  n.Z_PK as id,
  n.ZTITLE1 as title,
  n.ZCREATIONDATE1 as created,  -- Core Data timestamp (seconds since 2001-01-01)
  n.ZMODIFICATIONDATE1 as modified,
  n.ZFOLDER as folder_id,
  nd.ZDATA as body_data  -- gzip'd protobuf
FROM ZICCLOUDSYNCINGOBJECT n
JOIN ZICNOTEDATA nd ON nd.ZNOTE = n.Z_PK
WHERE n.ZMARKEDFORDELETION != 1
  AND n.ZFOLDER IS NOT NULL;
```

**Date conversion:** Core Data uses seconds since 2001-01-01 00:00:00 UTC. Convert: `new Date((coreDataTimestamp + 978307200) * 1000)`.

### Protobuf Parsing

Available parsers:
- **[apple_cloud_notes_parser](https://github.com/threeplanetssoftware/apple_cloud_notes_parser)** (Ruby) - Most complete, handles all embedded object types, maintained by forensics researchers
- **[apple-notes-parser](https://github.com/RhetTbull/apple-notes-parser)** (Python) - Includes pre-generated `notestore_pb2.py` protobuf files
- **[notes-import](https://github.com/ChrLipp/notes-import)** (Kotlin) - Parses SQLite databases

For our Bun/TypeScript stack, we would need to:
1. Use the reverse-engineered `.proto` file from apple_cloud_notes_parser
2. Compile it to TypeScript using `protobufjs` or `@bufbuild/protobuf`
3. Implement gzip decompression + protobuf decode pipeline

```typescript
import { gunzipSync } from 'node:zlib';
import { NoteStoreProto } from './generated/notestore';

function parseNoteBody(zdataBlob: Buffer): string {
  const decompressed = gunzipSync(zdataBlob);
  const note = NoteStoreProto.decode(decompressed);
  return note.text; // Plain text; attribute_runs has formatting
}
```

### macOS Version Differences

The database schema has evolved across macOS versions. Key changes:
- **macOS 10.15 (Catalina):** Added shared notes support, new columns in ZICCLOUDSYNCINGOBJECT
- **macOS 11 (Big Sur):** Hashtag/tag support added
- **macOS 12 (Monterey):** Quick Notes feature, new folder types
- **macOS 13 (Ventura):** Smart Folders, enhanced collaboration fields
- **macOS 14 (Sonoma):** PDF annotation support, link previews
- **macOS 15 (Sequoia):** Math notation, recording transcription fields

The JXA approach is **version-agnostic** -- Apple maintains scripting compatibility. SQLite access requires version detection and schema adaptation.

---

## 7. Privacy and Security Considerations

### Sensitivity Level: HIGH

Apple Notes is one of the most personal data stores on macOS. Users store:
- Passwords and credentials (despite better tools existing)
- Medical information
- Financial details (account numbers, PINs)
- Personal journal entries
- Legal documents
- Photos of sensitive documents (IDs, passports)

### Required Safeguards

1. **Explicit opt-in:** The connector must not be enabled by default. User must consciously activate it.
2. **Permission transparency:** Clearly explain what data the connector can access before requesting Automation permission.
3. **No caching of note content:** Note bodies should not be persisted in the app's database or logs. Read on-demand only.
4. **No indexing without consent:** If implementing search embeddings (like RafalWilinski's approach), this must be a separate opt-in with clear explanation.
5. **Password-protected notes:** JXA cannot read locked notes (they throw an error). This is actually a good safety feature -- do not attempt to circumvent it.
6. **Audit logging:** Log which notes were accessed (by title/ID, not content) so users can review what the AI has read.
7. **Scope limiting:** Consider allowing users to restrict the connector to specific folders/accounts (e.g., only "Work" folder).

### TCC Permissions Required

| Access Method | Permission | User Action Required |
|---|---|---|
| JXA/AppleScript | Automation (kTCCServiceAppleEvents) | Approve dialog on first use |
| SQLite direct | Full Disk Access (kTCCServiceSystemPolicyAllFiles) | Manual toggle in System Settings |

**Automation permission** is lower friction -- a one-time dialog. **Full Disk Access** requires the user to navigate to System Settings > Privacy & Security > Full Disk Access and manually add the app. This is a significant UX barrier.

---

## 8. Testing Strategy

### Unit Tests (bun:test)

**JXA layer mocking:** Since JXA scripts run via `osascript` subprocess, mock the `execFile` call:

```typescript
// __tests__/api.test.ts
import { describe, it, expect, mock } from 'bun:test';
import { listNotes, readNote } from '../api';

// Mock child_process.execFile
const mockExecFile = mock(() => {});
mock.module('node:child_process', () => ({
  execFile: mockExecFile,
}));

describe('listNotes', () => {
  it('returns parsed note metadata', async () => {
    mockExecFile.mockImplementation((cmd, args, opts, cb) => {
      cb(null, { stdout: JSON.stringify([
        { id: 'x-coredata://123', name: 'Test Note', created: '2026-01-01T00:00:00Z',
          modified: '2026-03-25T00:00:00Z', folder: 'Notes', account: 'iCloud' }
      ]) });
    });

    const notes = await listNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0].name).toBe('Test Note');
  });

  it('handles empty Notes app', async () => {
    mockExecFile.mockImplementation((cmd, args, opts, cb) => {
      cb(null, { stdout: '[]' });
    });

    const notes = await listNotes();
    expect(notes).toHaveLength(0);
  });

  it('handles osascript errors gracefully', async () => {
    mockExecFile.mockImplementation((cmd, args, opts, cb) => {
      cb(new Error('execution error: Notes got an error: Application isn\'t running.'));
    });

    await expect(listNotes()).rejects.toThrow();
  });
});
```

**HTML-to-markdown tests:** Use fixture HTML files captured from real Notes output:

```typescript
// __tests__/html-to-markdown.test.ts
describe('htmlToMarkdown', () => {
  it('converts headings', () => {
    expect(htmlToMarkdown('<h1>Title</h1>')).toBe('# Title');
  });

  it('converts bold and italic', () => {
    expect(htmlToMarkdown('<b>bold</b> and <i>italic</i>'))
      .toBe('**bold** and *italic*');
  });

  it('converts lists', () => {
    const html = '<ul><li>one</li><li>two</li></ul>';
    expect(htmlToMarkdown(html)).toBe('- one\n- two');
  });

  it('handles attachment placeholders gracefully', () => {
    const html = '<div><object></object></div>';
    expect(htmlToMarkdown(html)).toContain('[attachment]');
  });
});
```

### Fixture Data

Create fixtures from real Notes HTML output (sanitized):
- `fixtures/sample-note.html` - Basic formatted note
- `fixtures/sample-list.json` - listNotes() output shape
- `fixtures/note-with-checklist.html` - Checklist formatting
- `fixtures/note-with-table.html` - Table formatting (empty cells via JXA)
- `fixtures/note-with-links.html` - Hyperlinks

### Integration Tests (requires macOS with Notes.app)

These tests should be skipped in CI and only run locally:

```typescript
import { describe, it, expect } from 'bun:test';

const isCI = process.env.CI === 'true';

describe.skipIf(isCI)('Apple Notes integration', () => {
  it('can list notes without error', async () => {
    const notes = await listNotes(undefined, undefined, 5);
    expect(Array.isArray(notes)).toBe(true);
  });
});
```

---

## 9. Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **User has no notes** | Low | Return empty arrays, not errors. Tool should handle gracefully. |
| **Notes.app not running** | Medium | JXA will launch Notes.app automatically (osascript activates the app). Document this behavior. |
| **Automation permission denied** | High | Detect the error (`-1743` / "not allowed assistive access") and return a user-friendly message with instructions to grant permission. |
| **Large note collections (10k+)** | Medium | Paginate with `limit` parameter. Default to 100 notes. Warn in tool description. |
| **JXA script injection** | High | Never interpolate user input directly into JXA strings. Sanitize all parameters (escape quotes, limit character set). Use parameterized patterns. |
| **Password-protected notes** | Low | JXA throws an error for locked notes. Catch and return "Note is locked" message. |
| **macOS version incompatibility** | Medium | JXA is stable across versions. SQLite schema changes only affect the optional SQLite layer. |
| **Notes.app hangs/slow response** | Medium | 15-second timeout on osascript execution. Return timeout error to LLM. |
| **Sensitive data exposure** | High | No caching, audit logging, folder-scoping option, explicit opt-in activation. |

---

## 10. Recommended Implementation Plan

### Phase 1: Core Read-Only (MVP)

**Tools:** `apple_notes_list`, `apple_notes_read`, `apple_notes_search`, `apple_notes_folders`

**Files to create:**
- `apps/server/src/connectors/apple-notes/index.ts`
- `apps/server/src/connectors/apple-notes/tools.ts`
- `apps/server/src/connectors/apple-notes/api.ts`
- `apps/server/src/connectors/apple-notes/jxa-scripts.ts`
- `apps/server/src/connectors/apple-notes/html-to-markdown.ts`
- `apps/server/src/connectors/apple-notes/__tests__/api.test.ts`
- `apps/server/src/connectors/apple-notes/__tests__/html-to-markdown.test.ts`
- `apps/server/src/connectors/apple-notes/__tests__/fixtures/` (HTML samples)

**Estimated effort:** 1-2 days

### Phase 2: Write Operations

**Add:** `apple_notes_create` tool

Write operations need extra care:
- Confirm note creation succeeded by re-reading
- Support markdown-to-HTML conversion for input (reverse of read)
- Consider `destructiveHint: true` annotation for create/delete

**Estimated effort:** 0.5 day

### Phase 3: Enhanced Access (SQLite Layer)

**Add:** `apple_notes_attachments`, `apple_notes_tables`, `apple_notes_checklists`

Requires:
- Protobuf schema compilation (`notestore.proto` -> TypeScript)
- Database version detection and schema adaptation
- Full Disk Access detection and graceful fallback

**Estimated effort:** 2-3 days

### Phase 4: Semantic Search (Optional)

Following RafalWilinski's approach:
- On-device embeddings (all-MiniLM-L6-v2 via `@xenova/transformers`)
- Background indexing of note content
- Vector similarity search
- Requires explicit user consent for indexing

**Estimated effort:** 2-3 days

---

## Sources

- [RafalWilinski/mcp-apple-notes](https://github.com/RafalWilinski/mcp-apple-notes) - Semantic search MCP server
- [sirmews/apple-notes-mcp](https://github.com/sirmews/apple-notes-mcp) - Python AppleScript MCP server
- [Siddhant-K-code/mcp-apple-notes](https://github.com/Siddhant-K-code/mcp-apple-notes) - Node.js MCP server
- [sweetrb/apple-notes-mcp](https://github.com/sweetrb/apple-notes-mcp) - Full CRUD MCP server
- [disco-trooper/apple-notes-mcp](https://github.com/disco-trooper/apple-notes-mcp) - Hybrid semantic search MCP
- [peerasak-u/apple-notes-skill](https://github.com/peerasak-u/apple-notes-skill) - JXA-based Claude Code skill
- [willer/apple-mcp](https://github.com/willer/apple-mcp) - Notes + Reminders combined
- [apple_cloud_notes_parser](https://github.com/threeplanetssoftware/apple_cloud_notes_parser) - Forensic parser with protobuf schema
- [RhetTbull/apple-notes-parser](https://github.com/RhetTbull/apple-notes-parser) - Python SQLite/protobuf parser
- [macOS Automation - Notes](https://www.macosxautomation.com/applescript/notes/index.html) - AppleScript reference
- [JXA Notes reference](https://bru6.de/jxa/automating-applications/notes/) - JXA API documentation
- [Ciofeca Forensics - Apple Notes Revisited](https://www.ciofecaforensics.com/2020/01/10/apple-notes-revisited/) - Protobuf format deep dive
- [Swift Forensics - Reading Notes database](http://www.swiftforensics.com/2018/02/reading-notes-database-on-macos.html) - SQLite schema reference
- [Simon Willison - Notes on Notes.app](https://simonwillison.net/2021/Dec/9/notes-on-notesapp/) - Practical observations
