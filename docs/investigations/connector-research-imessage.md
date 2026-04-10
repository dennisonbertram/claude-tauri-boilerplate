# iMessage / SMS Connector Research

**Date:** 2026-03-25
**Issue:** #398
**Status:** Research Complete

---

## 1. Problem Statement

The app needs an iMessage/SMS connector that lets Claude read conversations, search messages, and (optionally) send messages through the macOS Messages app. This must integrate as a `ConnectorDefinition` registered in the connector registry (`apps/server/src/connectors/index.ts`), exposing tools via `createSdkMcpServer()`.

Key challenges: macOS privacy permissions, the undocumented and evolving chat.db schema, binary `attributedBody` decoding on Ventura+, and the extreme sensitivity of private message data.

---

## 2. Existing Implementations (Prior Art)

Multiple iMessage MCP servers already exist in the ecosystem:

| Project | Language | Approach | Read/Write | Notable |
|---------|----------|----------|------------|---------|
| [wyattjoh/imessage-mcp](https://github.com/wyattjoh/imessage-mcp) | TypeScript/Deno | Direct chat.db + AddressBook | Read-only | Clean 6-tool design, pagination, contact search |
| [anipotts/imessage-mcp](https://github.com/anipotts/imessage-mcp) | Python | Direct chat.db | Read-only | 26 tools, analytics, streaks, heatmaps, safe mode |
| [carterlasalle/mac_messages_mcp](https://github.com/carterlasalle/mac_messages_mcp) | TypeScript | chat.db + AppleScript | Read + Write | Phone validation, iMessage detection, SMS fallback |
| [marissamarym/imessage-mcp-server](https://github.com/marissamarym/imessage-mcp-server) | TypeScript | AppleScript only | Write + Contacts | send_message + search_contacts, no DB read |
| [davidgreigqc/imessage-mcp-server](https://lobehub.com/mcp/davidgreigqc-imessage-mcp-server) | TypeScript | chat.db | Read-only | SMS/RCS/iMessage mixed group support |

**Key takeaway:** The community consensus is read-only-first with chat.db for reading and AppleScript for sending. Every implementation opens chat.db in read-only mode. The wyattjoh and anipotts projects are the most mature references.

---

## 3. Database Access: chat.db

### Location
```
~/Library/Messages/chat.db
```

This is an SQLite database maintained by the Messages app. It contains all iMessage, SMS, and RCS conversations.

### Core Tables

#### `handle` — Contact identifiers
| Column | Type | Description |
|--------|------|-------------|
| ROWID | INTEGER | Primary key |
| id | TEXT | Phone number (+1XXXXXXXXXX) or email |
| country | TEXT | Country code (e.g. "us") |
| service | TEXT | "iMessage" or "SMS" |
| uncanonicalized_id | TEXT | Original format before normalization |

#### `chat` — Conversations
| Column | Type | Description |
|--------|------|-------------|
| ROWID | INTEGER | Primary key |
| guid | TEXT | Globally unique chat identifier (e.g. "iMessage;-;+1234567890") |
| chat_identifier | TEXT | Phone number, email, or group ID |
| display_name | TEXT | Human-readable name (group chats only) |
| style | INTEGER | 43 = group chat, 45 = DM |
| service_name | TEXT | "iMessage" or "SMS" |
| group_id | TEXT | Group chat identifier |

#### `message` — Individual messages
| Column | Type | Description |
|--------|------|-------------|
| ROWID | INTEGER | Primary key |
| guid | TEXT | Globally unique message ID |
| text | TEXT | Message body (may be NULL on Ventura+) |
| attributedBody | BLOB | Binary-encoded message body (Ventura+) |
| handle_id | INTEGER | FK to handle.ROWID (0 if is_from_me) |
| is_from_me | INTEGER | 1 = sent by user, 0 = received |
| date | INTEGER | Apple epoch nanoseconds since 2001-01-01 |
| date_read | INTEGER | When message was read |
| date_delivered | INTEGER | When message was delivered |
| is_read | INTEGER | Whether message has been read |
| service | TEXT | "iMessage" or "SMS" |
| cache_has_attachments | INTEGER | 1 if message has attachments |
| associated_message_type | INTEGER | Reaction type (2000-2005 for tapbacks) |
| associated_message_guid | TEXT | Parent message GUID for reactions |
| thread_originator_guid | TEXT | Thread/reply parent |
| thread_originator_part | TEXT | Which part of parent being replied to |
| is_audio_message | INTEGER | Voice message flag |
| expire_state | INTEGER | Message expiry state |
| was_edited | INTEGER | Whether message was edited (macOS 13+) |

#### `attachment` — File attachments
| Column | Type | Description |
|--------|------|-------------|
| ROWID | INTEGER | Primary key |
| guid | TEXT | Unique attachment ID |
| filename | TEXT | Local file path (~/Library/Messages/Attachments/...) |
| mime_type | TEXT | MIME type (image/jpeg, etc.) |
| transfer_name | TEXT | Original filename |
| total_bytes | INTEGER | File size |
| created_date | INTEGER | Apple epoch timestamp |

#### Join Tables
| Table | Links |
|-------|-------|
| `chat_handle_join` | chat.ROWID <-> handle.ROWID (group membership) |
| `chat_message_join` | chat.ROWID <-> message.ROWID |
| `message_attachment_join` | message.ROWID <-> attachment.ROWID |

### Date Conversion

Apple uses "Mac Absolute Time" — nanoseconds since 2001-01-01 00:00:00 UTC:

```sql
-- Convert Apple epoch to human-readable datetime
datetime(message.date / 1000000000 + strftime("%s", "2001-01-01"),
  "unixepoch", "localtime") AS message_date
```

In JavaScript/TypeScript:
```typescript
const APPLE_EPOCH_OFFSET = 978307200; // seconds between 1970-01-01 and 2001-01-01
function appleTimestampToDate(nanoseconds: number): Date {
  return new Date((nanoseconds / 1_000_000_000 + APPLE_EPOCH_OFFSET) * 1000);
}
```

### attributedBody Decoding (macOS Ventura / 13+)

Starting with macOS Ventura, many messages have `text = NULL` and the actual content is stored in the `attributedBody` BLOB column as an NSKeyedArchiver-serialized NSAttributedString.

**Decoding approach in TypeScript:**
```typescript
function decodeAttributedBody(blob: Buffer): string | null {
  if (!blob || blob.length === 0) return null;

  // The text is embedded after a known marker in the binary data.
  // Look for "NSString" marker followed by the actual text content.
  // Common pattern: find the text between specific byte sequences.

  const str = blob.toString('latin1');

  // Strategy 1: Look for the streamtyped marker
  // The text typically appears after a specific byte pattern
  const markers = [
    'NSString',
    'NSDictionary',
    'NSNumber',
  ];

  // Extract text between markers — search for the content after
  // the first occurrence of a length-prefixed string
  // This is a simplified version; production code should use
  // a proper NSKeyedUnarchiver or binary plist parser.

  // Practical approach used by imessage_tools:
  // 1. Try to parse as binary plist
  // 2. Extract the string value from the NSAttributedString

  return extractTextFromBlob(blob);
}

// Recommended: use a library like 'bplist-parser' for robust decoding
```

**Recommended approach:** Use the `text` column when available, fall back to `attributedBody` decoding:
```sql
SELECT
  ROWID,
  COALESCE(text, '[attributedBody]') as display_text,
  attributedBody,
  is_from_me,
  date
FROM message
```

Then decode `attributedBody` in application code when `text` is NULL.

---

## 4. Key SQL Queries

### List recent conversations
```sql
SELECT
  c.ROWID as chat_id,
  c.guid,
  c.chat_identifier,
  c.display_name,
  c.style,
  c.service_name,
  MAX(m.date) as last_message_date,
  COUNT(m.ROWID) as message_count
FROM chat c
JOIN chat_message_join cmj ON c.ROWID = cmj.chat_id
JOIN message m ON cmj.message_id = m.ROWID
GROUP BY c.ROWID
ORDER BY last_message_date DESC
LIMIT ? OFFSET ?
```

### Get messages from a conversation
```sql
SELECT
  m.ROWID,
  m.guid,
  m.text,
  m.attributedBody,
  m.is_from_me,
  m.date,
  m.date_read,
  m.cache_has_attachments,
  m.associated_message_type,
  m.associated_message_guid,
  h.id as sender_id,
  h.service as sender_service
FROM message m
JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
LEFT JOIN handle h ON m.handle_id = h.ROWID
WHERE cmj.chat_id = ?
ORDER BY m.date DESC
LIMIT ? OFFSET ?
```

### Search messages by text
```sql
SELECT
  m.ROWID,
  m.text,
  m.is_from_me,
  m.date,
  c.chat_identifier,
  c.display_name,
  h.id as sender_id
FROM message m
JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
JOIN chat c ON cmj.chat_id = c.ROWID
LEFT JOIN handle h ON m.handle_id = h.ROWID
WHERE m.text LIKE '%' || ? || '%'
ORDER BY m.date DESC
LIMIT ? OFFSET ?
```

### Get group chat members
```sql
SELECT
  h.id,
  h.service,
  h.country
FROM handle h
JOIN chat_handle_join chj ON h.ROWID = chj.handle_id
WHERE chj.chat_id = ?
```

### Get attachments for a message
```sql
SELECT
  a.ROWID,
  a.guid,
  a.filename,
  a.mime_type,
  a.transfer_name,
  a.total_bytes,
  a.created_date
FROM attachment a
JOIN message_attachment_join maj ON a.ROWID = maj.attachment_id
WHERE maj.message_id = ?
```

### Identify group vs DM chats
```sql
-- style = 43 means group chat, style = 45 means DM
SELECT * FROM chat WHERE style = 43;  -- group chats
SELECT * FROM chat WHERE style = 45;  -- direct messages
```

---

## 5. Sending Messages via AppleScript

### Basic send
```applescript
tell application "Messages"
  send "Hello from Claude!" to buddy "+15551234567" of (service 1 whose service type is iMessage)
end tell
```

### Execute from Node.js/Bun
```typescript
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function sendMessage(recipient: string, text: string): Promise<void> {
  // Escape the message for AppleScript
  const escapedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const escapedRecipient = recipient.replace(/"/g, '\\"');

  const script = `
    tell application "Messages"
      send "${escapedText}" to buddy "${escapedRecipient}" of (service 1 whose service type is iMessage)
    end tell
  `;

  await execFileAsync('osascript', ['-e', script]);
}
```

### Group chat send
```applescript
tell application "Messages"
  set targetChat to chat id "iMessage;+;chat123456789"
  send "Hello group!" to targetChat
end tell
```

### Important caveats
- AppleScript requires the Messages app to be running (it will launch it if not)
- macOS will prompt for Automation permission on first use
- Sending to SMS recipients requires an active iPhone relay or SMS forwarding
- The `buddy` identifier must match exactly (phone number with country code or email)
- Group chat IDs can be obtained from the `chat.guid` column in chat.db

---

## 6. macOS Permissions

### Full Disk Access (FDA) — Required for reading chat.db

The Messages database is protected by macOS TCC (Transparency, Consent, and Control). To read `~/Library/Messages/chat.db`, the application (or the terminal/process running the server) must have **Full Disk Access** granted in:

**System Settings > Privacy & Security > Full Disk Access**

For a Tauri app, this means the **Tauri app itself** (or its sidecar Bun process) must be granted FDA. Since our architecture runs Bun as a sidecar:
- The Bun binary (or the sidecar executable) needs FDA
- Users must manually enable this in System Settings
- There is no way to programmatically request FDA — the app can only detect if it lacks access (by trying to open chat.db and catching the permission error)

### Automation Permission — Required for sending messages

Sending via AppleScript requires **Automation** permission:

**System Settings > Privacy & Security > Automation > [App] > Messages**

macOS will prompt the user on first `osascript` invocation that targets Messages. The user must click "Allow."

### Contacts Access — Optional, for name resolution

Reading `~/Library/Application Support/AddressBook/` also requires FDA or specific Contacts permission.

### Detection strategy
```typescript
import { Database } from 'bun:sqlite';

function checkMessagesDatabaseAccess(): { accessible: boolean; error?: string } {
  try {
    const dbPath = `${process.env.HOME}/Library/Messages/chat.db`;
    const db = new Database(dbPath, { readonly: true });
    // Try a simple query
    db.query('SELECT COUNT(*) FROM message').get();
    db.close();
    return { accessible: true };
  } catch (error) {
    return {
      accessible: false,
      error: error instanceof Error ? error.message : 'Unknown error — likely missing Full Disk Access',
    };
  }
}
```

### Tauri entitlements

For a production Tauri build, the `entitlements.plist` should include:
```xml
<key>com.apple.security.personal-information.addressbook</key>
<true/>
<key>com.apple.security.automation.apple-events</key>
<true/>
```

However, FDA cannot be declared via entitlements — it must be manually granted by the user.

---

## 7. Proposed Connector Design

### Architecture

```
apps/server/src/connectors/imessage/
  index.ts          — ConnectorDefinition (registered in connectors/index.ts)
  tools.ts          — Tool definitions using SDK tool() helper
  db.ts             — chat.db read-only access layer
  applescript.ts    — Message sending via osascript
  decode.ts         — attributedBody binary decoder
  contacts.ts       — AddressBook name resolution
  types.ts          — Internal types (ChatRow, MessageRow, etc.)
  __tests__/
    db.test.ts          — Tests with fixture database
    decode.test.ts      — attributedBody decoding tests
    applescript.test.ts — Mocked send tests
```

### Phase 1: Read-Only Tools (MVP)

| Tool Name | Description | Annotations |
|-----------|-------------|-------------|
| `imessage_list_conversations` | List recent conversations with pagination | readOnlyHint: true |
| `imessage_get_messages` | Get messages from a specific conversation | readOnlyHint: true |
| `imessage_search` | Full-text search across all messages | readOnlyHint: true |
| `imessage_get_contacts` | List contacts/handles with message counts | readOnlyHint: true |
| `imessage_get_attachments` | List attachments for a conversation or message | readOnlyHint: true |
| `imessage_check_access` | Verify FDA permission and report status | readOnlyHint: true |

### Phase 2: Write Tools (Opt-in, with confirmation)

| Tool Name | Description | Annotations |
|-----------|-------------|-------------|
| `imessage_send` | Send a message to a contact or group | readOnlyHint: false, destructiveHint: true |

### ConnectorDefinition

```typescript
import type { ConnectorDefinition } from '../types';
import { imessageTools } from './tools';

export const imessageConnector: ConnectorDefinition = {
  name: 'imessage',
  displayName: 'iMessage',
  description: 'Read and search your iMessage and SMS conversations. Requires Full Disk Access on macOS.',
  icon: '💬',
  category: 'communication',
  requiresAuth: false, // No OAuth — uses local macOS permissions
  tools: imessageTools,
};
```

### Database Layer

```typescript
// db.ts — thin wrapper around bun:sqlite for chat.db
import { Database } from 'bun:sqlite';
import { appleTimestampToDate } from './decode';

const DB_PATH = `${process.env.HOME}/Library/Messages/chat.db`;

let db: Database | null = null;

export function getMessagesDb(): Database {
  if (!db) {
    db = new Database(DB_PATH, { readonly: true });
    db.exec('PRAGMA journal_mode=WAL');  // safe for concurrent reads
  }
  return db;
}
```

### Pagination Pattern

All list/search tools should follow the existing MCP convention:
```typescript
{
  data: MessageRow[],
  pagination: {
    total: number,
    limit: number,
    offset: number,
    hasMore: boolean,
  }
}
```

Default limit: 50 messages. Max limit: 200.

---

## 8. Privacy & Security Considerations

This connector accesses the most sensitive data on a user's computer. The following principles are non-negotiable:

### Local-only processing
- All data stays on the user's machine
- No message content is sent to external servers (beyond what the user explicitly sends to Claude via the chat)
- No telemetry, analytics, or logging of message content

### Explicit user consent
- The connector must be **explicitly enabled** by the user (not on by default)
- First-time activation should show a clear warning about what data will be accessible
- Sending messages should require **per-message confirmation** in the permission flow (the SDK's `permissionMode` handles this)

### Read-only by default
- Phase 1 ships with read-only tools only
- All read tools are annotated with `readOnlyHint: true` for auto-approval
- The send tool (Phase 2) uses `destructiveHint: true` so the SDK prompts for permission

### Safe mode option
- Following anipotts/imessage-mcp's pattern, support a `IMESSAGE_SAFE_MODE` flag
- When enabled, redact all message bodies and return metadata only (counts, dates, contact names)
- This allows analytics use cases without exposing actual message content to the LLM

### Data minimization
- Never return more data than requested (enforce pagination limits)
- Attachment content is referenced by path, not loaded into memory
- Binary attachments (images, videos) are described by metadata only — not base64-encoded

---

## 9. Testing Strategy

### Fixture Database

Create a test fixture `chat.db` with known data:

```typescript
// __tests__/fixtures/create-test-db.ts
import { Database } from 'bun:sqlite';

export function createTestMessagesDb(path: string): Database {
  const db = new Database(path);

  db.exec(`
    CREATE TABLE handle (
      ROWID INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT UNIQUE NOT NULL,
      country TEXT DEFAULT 'us',
      service TEXT DEFAULT 'iMessage',
      uncanonicalized_id TEXT
    );

    CREATE TABLE chat (
      ROWID INTEGER PRIMARY KEY AUTOINCREMENT,
      guid TEXT UNIQUE NOT NULL,
      chat_identifier TEXT,
      display_name TEXT,
      style INTEGER DEFAULT 45,
      service_name TEXT DEFAULT 'iMessage',
      group_id TEXT
    );

    CREATE TABLE message (
      ROWID INTEGER PRIMARY KEY AUTOINCREMENT,
      guid TEXT UNIQUE NOT NULL,
      text TEXT,
      attributedBody BLOB,
      handle_id INTEGER DEFAULT 0,
      is_from_me INTEGER DEFAULT 0,
      date INTEGER NOT NULL,
      date_read INTEGER,
      date_delivered INTEGER,
      is_read INTEGER DEFAULT 0,
      service TEXT DEFAULT 'iMessage',
      cache_has_attachments INTEGER DEFAULT 0,
      associated_message_type INTEGER DEFAULT 0,
      associated_message_guid TEXT,
      thread_originator_guid TEXT,
      thread_originator_part TEXT,
      is_audio_message INTEGER DEFAULT 0,
      was_edited INTEGER DEFAULT 0
    );

    CREATE TABLE attachment (
      ROWID INTEGER PRIMARY KEY AUTOINCREMENT,
      guid TEXT UNIQUE NOT NULL,
      filename TEXT,
      mime_type TEXT,
      transfer_name TEXT,
      total_bytes INTEGER DEFAULT 0,
      created_date INTEGER DEFAULT 0
    );

    CREATE TABLE chat_handle_join (
      chat_id INTEGER NOT NULL,
      handle_id INTEGER NOT NULL
    );

    CREATE TABLE chat_message_join (
      chat_id INTEGER NOT NULL,
      message_id INTEGER NOT NULL
    );

    CREATE TABLE message_attachment_join (
      message_id INTEGER NOT NULL,
      attachment_id INTEGER NOT NULL
    );
  `);

  // Seed test data
  db.exec(`
    INSERT INTO handle (id, service) VALUES ('+15551234567', 'iMessage');
    INSERT INTO handle (id, service) VALUES ('+15559876543', 'SMS');
    INSERT INTO handle (id, service) VALUES ('alice@example.com', 'iMessage');

    INSERT INTO chat (guid, chat_identifier, display_name, style, service_name)
    VALUES ('iMessage;-;+15551234567', '+15551234567', NULL, 45, 'iMessage');

    INSERT INTO chat (guid, chat_identifier, display_name, style, service_name)
    VALUES ('iMessage;+;chat123', 'chat123', 'Family Group', 43, 'iMessage');

    -- Nanosecond timestamps for 2025-01-15 12:00:00 UTC
    -- (seconds since 2001-01-01: 758,894,400) * 1e9
    INSERT INTO message (guid, text, handle_id, is_from_me, date, service)
    VALUES ('msg-001', 'Hey, how are you?', 1, 0, 758894400000000000, 'iMessage');

    INSERT INTO message (guid, text, handle_id, is_from_me, date, service)
    VALUES ('msg-002', 'I am doing great!', 0, 1, 758894460000000000, 'iMessage');

    INSERT INTO message (guid, text, handle_id, is_from_me, date, service)
    VALUES ('msg-003', 'Want to grab lunch?', 1, 0, 758894520000000000, 'iMessage');

    INSERT INTO chat_handle_join (chat_id, handle_id) VALUES (1, 1);
    INSERT INTO chat_handle_join (chat_id, handle_id) VALUES (2, 1);
    INSERT INTO chat_handle_join (chat_id, handle_id) VALUES (2, 2);
    INSERT INTO chat_handle_join (chat_id, handle_id) VALUES (2, 3);

    INSERT INTO chat_message_join (chat_id, message_id) VALUES (1, 1);
    INSERT INTO chat_message_join (chat_id, message_id) VALUES (1, 2);
    INSERT INTO chat_message_join (chat_id, message_id) VALUES (1, 3);
  `);

  return db;
}
```

### Test Categories

1. **Database layer tests** — Use fixture DB, test all queries, pagination, edge cases
2. **attributedBody decoder tests** — Known binary blobs with expected text output
3. **AppleScript tests** — Mock `execFile`, verify script generation and escaping
4. **Permission detection tests** — Mock file system access failures
5. **Tool integration tests** — Full tool invocation with fixture DB

### What NOT to test in CI
- Actual chat.db access (requires FDA, CI won't have it)
- Actual AppleScript execution (requires Messages app)
- Contact name resolution (requires AddressBook access)

Use dependency injection: the DB path and AppleScript executor should be injectable for testing.

---

## 10. Implementation Recommendations

### Priority order
1. **Permission check tool** (`imessage_check_access`) — ship first so the UI can guide users through FDA setup
2. **List conversations** — the "home screen" of the connector
3. **Get messages** — view a conversation
4. **Search messages** — full-text search
5. **Get contacts/handles** — contact resolution
6. **Attachments** — metadata only (Phase 1)
7. **Send message** — Phase 2, behind explicit opt-in

### macOS version handling
- Test on macOS Sonoma (14) and Sequoia (15) — these are the current targets
- Always check `text` column first, fall back to `attributedBody`
- The date format (nanoseconds since 2001) has been stable since at least macOS 10.15

### Performance
- Open chat.db once and keep the connection (read-only is safe for concurrent access)
- Use WAL mode for best read performance while Messages app is writing
- Index-based pagination (`WHERE ROWID > ?`) is faster than `OFFSET` for large databases
- Chat.db can be 1GB+ for heavy users — never `SELECT *` without LIMIT

### Error handling
- If chat.db is locked (Messages is writing), retry after a short delay
- If FDA is missing, return a clear error message with instructions
- If attributedBody decoding fails, return `[message content unavailable]` rather than crashing

### Compatibility with existing architecture
- Follow the weather connector pattern exactly: `ConnectorDefinition` + `tool()` helper + `ConnectorToolDefinition[]`
- Register in `CONNECTORS` array in `apps/server/src/connectors/index.ts`
- Use `bun:sqlite` (already a project dependency) for database access
- Use Bun's built-in `Bun.spawn` or Node.js `child_process` for AppleScript execution

---

## Sources

- [wyattjoh/imessage-mcp](https://github.com/wyattjoh/imessage-mcp) — TypeScript/Deno read-only MCP server
- [anipotts/imessage-mcp](https://github.com/anipotts/imessage-mcp) — 26-tool read-only MCP server with analytics
- [carterlasalle/mac_messages_mcp](https://github.com/carterlasalle/mac_messages_mcp) — Read+write MCP server
- [marissamarym/imessage-mcp-server](https://github.com/marissamarym/imessage-mcp-server) — AppleScript-based send+contacts
- [Searching Your iMessage Database with SQL](https://spin.atomicobject.com/search-imessage-sql/) — Schema walkthrough
- [Analyzing iMessage with SQL](https://dev.to/arctype/analyzing-imessage-with-sql-f42) — Query patterns and reactions
- [imessage_tools (Ventura attributedBody)](https://github.com/my-other-github-account/imessage_tools) — Binary blob decoder
- [macOS TCC Deep Dive](https://www.rainforestqa.com/blog/macos-tcc-db-deep-dive) — Permission framework internals
- [Send iMessage With AppleScript](https://chrispennington.blog/blog/send-imessage-with-applescript/) — AppleScript patterns
- [Apple's chat.db schema discussion](https://news.ycombinator.com/item?id=27320833) — Community insights on schema evolution
