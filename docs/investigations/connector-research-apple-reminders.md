# Apple Reminders Connector Research

**Issue**: #380
**Date**: 2026-03-25
**Status**: Research Complete

---

## 1. Executive Summary

An Apple Reminders connector for the Tauri desktop app is feasible using AppleScript/JXA executed via `osascript` CLI from the Bun server process. This is the approach used by all major existing MCP server implementations (FradSer, dbmcco, shadowfax92, karlhepler). The connector would be macOS-only with graceful degradation on other platforms. The recommended architecture uses `child_process.execFile("osascript", ...)` with JXA scripts for CRUD operations on reminders and lists, matching the existing ConnectorDefinition pattern established by the weather connector. Estimated complexity is medium -- the AppleScript/JXA interface is well-documented but TCC permissions and error handling add non-trivial edge cases.

---

## 2. API Reference: Apple Reminders Access Methods

### Method A: AppleScript via osascript (Recommended)

The most battle-tested approach. All major MCP implementations use this.

**Reminder Properties Available via AppleScript:**
| Property | Type | Notes |
|---|---|---|
| `name` | string | Reminder title |
| `body` | string | Notes field |
| `due date` | date | Due date/time |
| `allday due date` | date | All-day due date |
| `remind me date` | date | Alert trigger date |
| `priority` | integer | 0=none, 1=high, 5=medium, 9=low |
| `completed` | boolean | Completion status |
| `completion date` | date | When completed |
| `flagged` | boolean | Flag status |
| `id` | string | Unique identifier (read-only) |
| `creation date` | date | When created (read-only) |
| `modification date` | date | When last modified (read-only) |

**List Properties:**
| Property | Type | Notes |
|---|---|---|
| `name` | string | List name |
| `id` | string | Unique identifier (read-only) |
| `color` | string | List color (read-only via AS) |

**Example JXA Script (create reminder):**
```javascript
const Reminders = Application("Reminders");
const list = Reminders.lists.byName("My List");
const reminder = Reminders.Reminder({
  name: "Buy groceries",
  body: "Milk, eggs, bread",
  dueDate: new Date("2026-04-01T09:00:00"),
  priority: 1
});
list.reminders.push(reminder);
reminder.id();  // returns the created ID
```

**Example JXA Script (fetch reminders):**
```javascript
const Reminders = Application("Reminders");
const list = Reminders.lists.byName("My List");
const reminders = list.reminders.whose({completed: false})();
reminders.map(r => ({
  id: r.id(),
  name: r.name(),
  body: r.body(),
  dueDate: r.dueDate(),
  priority: r.priority(),
  completed: r.completed(),
  flagged: r.flagged()
}));
```

**Execution from Node/Bun:**
```typescript
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

async function runJxa(script: string): Promise<string> {
  const { stdout } = await execFileAsync("osascript", ["-l", "JavaScript", "-e", script]);
  return stdout.trim();
}
```

### Method B: EventKit via Native Swift Binary

Used by FradSer/mcp-server-apple-events. Compiles a Swift CLI that links EventKit, called from TypeScript. Provides access to location-based reminders, recurrence rules, and tags -- features not available via AppleScript.

**Pros:** Full EventKit API, location reminders, recurrence, tags, faster execution.
**Cons:** Requires Swift toolchain at build time, compiled binary per architecture, more complex build pipeline.

### Method C: node-reminders npm Package

A TypeScript wrapper around JXA scripts by caroso1222. Provides `createList()`, `createReminder()`, `getReminders()`, etc.

**Pros:** Ready-made API, TypeScript types.
**Cons:** Last updated 2021, limited maintenance, doesn't support all properties (no priority, no flagged), can't delete lists (JXA limitation). Not recommended for production use.

### Method D: eventkit-node (Native Addon)

Node.js native addon (N-API) providing direct EventKit bindings.

**Pros:** Direct API access, no osascript overhead.
**Cons:** Native compilation required, may not work with Bun runtime, architecture-specific binaries needed.

---

## 3. Existing MCP Server Implementations

### FradSer/mcp-server-apple-reminders (later: mcp-server-apple-events)
- **URL:** https://github.com/FradSer/mcp-server-apple-events
- **Approach:** TypeScript + compiled Swift CLI using EventKit
- **Tools:** Full CRUD, list management, priority, recurrence, location triggers, tags
- **Build:** `pnpm build:swift` compiles the Swift helper binary
- **Permission handling:** Node.js layer auto-runs AppleScript to trigger TCC dialog on permission failure, then retries Swift CLI
- **Stars/Activity:** Most feature-complete implementation

### dbmcco/apple-reminders-mcp
- **URL:** https://github.com/dbmcco/apple-reminders-mcp
- **Approach:** TypeScript + AppleScript (osascript)
- **Tools:** Create, read, update, delete reminders; list management; filtering
- **Key design:** Zero external dependencies, direct osascript calls
- **Metadata:** Due dates, priorities, notes, creation/modification timestamps

### shadowfax92/apple-reminders-mcp
- **URL:** https://github.com/shadowfax92/apple-reminders-mcp
- **Approach:** TypeScript + AppleScript
- **Tools:** List management, reminder retrieval, creation with titles/dates/notes
- **Simpler scope:** Fewer tools, more focused

### karlhepler/apple-mcp
- **URL:** https://github.com/karlhepler/apple-mcp
- **Approach:** TypeScript + AppleScript
- **Scope:** Apple Notes AND Reminders, full CRUD, folder/list management, search
- **Notable:** Combined connector for multiple Apple apps

### mggrim/apple-reminders-mcp-server
- **URL:** https://github.com/mggrim/apple-reminders-mcp-server
- **Notable:** Natural language date parsing, 18 comprehensive tools

### snarris/apple-eventkit-mcp
- **URL:** https://github.com/snarris/apple-eventkit-mcp
- **Approach:** Python + PyObjC (direct EventKit bindings)
- **Notable:** Full read/write Calendar + Reminders, fastest approach via native bindings

---

## 4. Recommended Implementation

### Architecture: AppleScript/JXA via osascript

**Rationale:** This approach is the best fit for the existing connector architecture because:
1. No build-time compilation needed (unlike Swift binary approach)
2. Works with Bun runtime without native addon issues
3. Battle-tested by multiple MCP implementations
4. Sufficient API surface for core reminder operations
5. Matches the pattern of shelling out to system tools (similar to how other connectors call external APIs)

### File Structure
```
apps/server/src/connectors/reminders/
  index.ts          # ConnectorDefinition export
  tools.ts          # Tool definitions (tool() calls with zod schemas)
  api.ts            # JXA script execution, AppleScript wrappers
  scripts.ts        # JXA script templates (string literals)
  reminders.test.ts # Tests with mocked execFile
```

### api.ts Design

```typescript
// Core execution layer
async function runJxa<T>(script: string): Promise<T> {
  const { stdout } = await execFileAsync("osascript", [
    "-l", "JavaScript", "-e",
    `JSON.stringify((function() { ${script} })())`
  ]);
  return JSON.parse(stdout.trim());
}

// Platform check
function assertMacOS(): void {
  if (process.platform !== "darwin") {
    throw new Error("Apple Reminders is only available on macOS.");
  }
}

// Public API functions
export async function getLists(): Promise<ReminderList[]>
export async function getReminders(listName: string, filter?: ReminderFilter): Promise<Reminder[]>
export async function createReminder(listName: string, reminder: CreateReminderInput): Promise<Reminder>
export async function updateReminder(listName: string, reminderId: string, updates: UpdateReminderInput): Promise<Reminder>
export async function completeReminder(listName: string, reminderId: string): Promise<void>
export async function deleteReminder(listName: string, reminderId: string): Promise<void>
export async function searchReminders(query: string): Promise<Reminder[]>
```

### Key Types

```typescript
interface ReminderList {
  id: string;
  name: string;
}

interface Reminder {
  id: string;
  name: string;
  body: string | null;
  dueDate: string | null;    // ISO 8601
  priority: 0 | 1 | 5 | 9;  // none, high, medium, low
  completed: boolean;
  completionDate: string | null;
  flagged: boolean;
  creationDate: string;
  modificationDate: string;
  listName: string;
}

interface ReminderFilter {
  completed?: boolean;
  dueBefore?: string;  // ISO 8601
  dueAfter?: string;   // ISO 8601
  searchText?: string;
}

interface CreateReminderInput {
  name: string;
  body?: string;
  dueDate?: string;
  priority?: 0 | 1 | 5 | 9;
  flagged?: boolean;
}

interface UpdateReminderInput {
  name?: string;
  body?: string;
  dueDate?: string;
  priority?: 0 | 1 | 5 | 9;
  flagged?: boolean;
}
```

---

## 5. Tool Definitions

Six tools recommended, following the `tool()` pattern from the weather connector:

### reminders_list_lists
- **Description:** List all reminder lists (folders) in Apple Reminders
- **Input:** None
- **Output:** Array of list names and IDs
- **Annotations:** `readOnlyHint: true`

### reminders_get
- **Description:** Get reminders from a specific list, with optional filters
- **Input:** `listName` (required), `completed` (optional bool), `dueBefore`/`dueAfter` (optional ISO dates)
- **Output:** Array of reminder objects
- **Annotations:** `readOnlyHint: true`

### reminders_create
- **Description:** Create a new reminder in a specified list
- **Input:** `listName`, `name` (required), `body`, `dueDate`, `priority`, `flagged` (optional)
- **Output:** Created reminder object with ID
- **Annotations:** `readOnlyHint: false`

### reminders_update
- **Description:** Update an existing reminder's properties
- **Input:** `listName`, `reminderId` (required), plus optional fields to update
- **Output:** Updated reminder object
- **Annotations:** `readOnlyHint: false`

### reminders_complete
- **Description:** Mark a reminder as completed (or uncomplete it)
- **Input:** `listName`, `reminderId`, `completed` (default true)
- **Output:** Success confirmation
- **Annotations:** `readOnlyHint: false`

### reminders_search
- **Description:** Search across all lists for reminders matching a query
- **Input:** `query` (required string), `includeCompleted` (optional, default false)
- **Output:** Array of matching reminders with their list names
- **Annotations:** `readOnlyHint: true`

---

## 6. Testing Plan

### Unit Test Strategy

Mock `child_process.execFile` (or Bun's equivalent) to avoid hitting the real Reminders app. This matches the weather connector's pattern of mocking `fetch`.

```typescript
// reminders.test.ts pattern
import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import * as childProcess from "child_process";

// Mock execFile to return canned JXA output
function mockExecFile(handler: (cmd: string, args: string[]) => string) {
  spyOn(childProcess, "execFile").mockImplementation(
    (cmd, args, callback) => {
      const result = handler(cmd as string, args as string[]);
      callback(null, result, "");
    }
  );
}

// Test data factories
function makeReminderJson(overrides = {}) {
  return JSON.stringify({
    id: "x-apple-reminder://ABC123",
    name: "Test Reminder",
    body: null,
    dueDate: "2026-04-01T09:00:00.000Z",
    priority: 0,
    completed: false,
    flagged: false,
    ...overrides
  });
}
```

### Test Cases

1. **getLists** -- returns parsed list of reminder lists
2. **getReminders** -- returns reminders for a list, respects filters
3. **createReminder** -- passes correct properties to JXA script
4. **updateReminder** -- only updates specified fields
5. **completeReminder** -- sets completed=true
6. **deleteReminder** -- calls correct JXA delete script
7. **searchReminders** -- searches across all lists
8. **Platform check** -- throws on non-macOS platforms
9. **Permission error** -- handles TCC denial gracefully with descriptive error
10. **osascript timeout** -- handles hung/slow osascript process
11. **Invalid list name** -- returns clear error for non-existent list
12. **Empty results** -- handles no reminders found gracefully
13. **Special characters** -- handles quotes, newlines in reminder names/notes

### Integration Testing (Manual)

For local development, a manual test script that creates/reads/completes/deletes a test reminder in a dedicated "Claude Test" list.

---

## 7. Security & Privacy

### TCC (Transparency, Consent, and Control)

- **First access:** macOS will show a permission dialog: "{App} wants to access your Reminders." The user must approve.
- **Where it appears:** System Settings > Privacy & Security > Reminders
- **Terminal vs Tauri:** When running via Tauri, the TCC prompt targets the Tauri app bundle. When running via terminal (dev mode), it targets Terminal.app or the shell.
- **Known issue:** `osascript` invoked from some contexts may fail silently with `kTCCServiceReminders` refusal. The FradSer implementation handles this by detecting permission failures and retrying after triggering the AppleScript dialog.

### Permission Detection Strategy

```typescript
async function checkRemindersAccess(): Promise<boolean> {
  try {
    await runJxa(`
      const app = Application("Reminders");
      app.lists.length;  // triggers TCC check
    `);
    return true;
  } catch (e) {
    return false;
  }
}
```

### Data Sensitivity

- Reminders may contain personal/sensitive data (medical appointments, financial tasks)
- The connector should never log reminder content at INFO level
- Error messages should not include reminder bodies

---

## 8. Watchouts & Risks

### Critical Risks

1. **TCC Permission Denial:** If the user denies Reminders access, all tools fail. Must detect this and return a clear error message directing the user to System Settings. No programmatic way to request re-permission after denial.

2. **osascript Hangs:** AppleScript can hang if the Reminders app is unresponsive or syncing. Use a timeout (10 seconds recommended) on execFile calls.

3. **iCloud Sync Latency:** Reminders created via AppleScript may take seconds to sync to iCloud. Users may not see changes immediately on other devices.

4. **Large Lists Performance:** Fetching all reminders from a list with hundreds of items can be slow via osascript (each property access is an Apple Event). Consider pagination or limiting results.

### Medium Risks

5. **AppleScript API Stability:** Apple occasionally changes the Reminders AppleScript dictionary between macOS versions. The `body` property (for notes) was added in a later version. Test across macOS 13+.

6. **Special Characters:** Reminder names/notes containing quotes, backslashes, or newlines can break JXA string interpolation. All user input must be JSON-escaped before embedding in JXA scripts.

7. **Concurrent Access:** If the user modifies reminders while the connector is reading, results may be inconsistent. This is inherent to the AppleScript model.

8. **App Not Installed:** On very minimal macOS installs, Reminders.app could theoretically be removed. Check for app existence.

### Low Risks

9. **List Deletion:** Cannot delete lists via AppleScript/JXA. This is a known platform limitation -- do not expose a delete-list tool.

10. **Recurring Reminders:** AppleScript cannot create or modify recurrence rules. Creating recurring reminders requires EventKit (Swift binary approach). Documenting this as a known limitation is sufficient for v1.

11. **Location-Based Reminders:** Not available via AppleScript. Would require EventKit. Out of scope for v1.

---

## 9. Dependencies

### Required (already available)
- `child_process` (Node.js / Bun built-in) -- for execFile
- `zod` (already in project) -- for tool input schemas
- `@anthropic-ai/claude-agent-sdk` (already in project) -- for `tool()` function

### No New Dependencies Required

The AppleScript/osascript approach requires zero npm packages beyond what the project already uses. This is a major advantage -- it keeps the dependency footprint minimal.

### System Requirements
- macOS 12+ (Monterey or later recommended for full AppleScript Reminders support)
- Reminders.app installed (ships with macOS by default)
- TCC approval for Reminders access

### Not Recommended
- `node-reminders` -- unmaintained since 2021, limited API
- `node-osascript` -- unnecessary abstraction over execFile
- `@jxa/run` -- adds dependency for something execFile does natively
- `eventkit-node` -- native addon, may not work with Bun

---

## 10. Estimated Complexity

### Overall: Medium (3-5 days implementation)

| Component | Effort | Notes |
|---|---|---|
| `api.ts` - JXA execution layer | 0.5 day | runJxa helper, platform check, timeout handling |
| `scripts.ts` - JXA script templates | 1 day | 6-8 scripts with proper escaping and error handling |
| `tools.ts` - Tool definitions | 0.5 day | 6 tools with zod schemas, follows weather pattern |
| `index.ts` - ConnectorDefinition | 0.25 day | Boilerplate, same as weather |
| `reminders.test.ts` - Tests | 1 day | Mock execFile, 13+ test cases |
| Error handling & edge cases | 0.5 day | TCC detection, timeout, special chars |
| Platform graceful degradation | 0.25 day | Return clear error on non-macOS |
| **Total** | **~4 days** | |

### Comparison to Weather Connector
- Weather: HTTP fetch calls, JSON parsing, no platform restrictions
- Reminders: osascript child process, JXA scripting, macOS-only, TCC permissions
- Reminders has more moving parts but the ConnectorDefinition pattern is identical

### Future Enhancement Path (v2)
- Swift binary for EventKit access (recurrence, location reminders, tags)
- Real-time change notifications via EventKit observers
- Batch operations for bulk reminder creation
- Smart list support

---

## Sources

- [FradSer/mcp-server-apple-events](https://github.com/FradSer/mcp-server-apple-events) -- Swift EventKit approach
- [FradSer/mcp-server-apple-reminders](https://github.com/FradSer/mcp-server-apple-reminders) -- Original TypeScript version
- [dbmcco/apple-reminders-mcp](https://github.com/dbmcco/apple-reminders-mcp) -- TypeScript + AppleScript approach
- [shadowfax92/apple-reminders-mcp](https://github.com/shadowfax92/apple-reminders-mcp) -- Simpler AppleScript approach
- [karlhepler/apple-mcp](https://github.com/karlhepler/apple-mcp) -- Combined Notes + Reminders
- [mggrim/apple-reminders-mcp-server](https://github.com/mggrim/apple-reminders-mcp-server) -- 18-tool implementation
- [snarris/apple-eventkit-mcp](https://github.com/snarris/apple-eventkit-mcp) -- Python PyObjC approach
- [caroso1222/node-reminders](https://github.com/caroso1222/node-reminders) -- npm JXA wrapper
- [dacay/eventkit-node](https://github.com/dacay/eventkit-node) -- Node.js native EventKit addon
- [n8henrie AppleScript Reminders demo](https://gist.github.com/n8henrie/c3a5bf270b8200e33591) -- AppleScript property reference
- [Apple EventKit Documentation](https://developer.apple.com/documentation/eventkit) -- Official framework docs
- [Scripting OS X - AppleScript Security](https://scriptingosx.com/2020/09/avoiding-applescript-security-and-privacy-requests/) -- TCC handling
