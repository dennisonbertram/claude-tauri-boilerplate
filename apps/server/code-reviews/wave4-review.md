Here’s a security/code-quality review of the 4 macOS-native MCP connectors.

## Apple Reminders

**What looks good**
- User-controlled values embedded into JXA are consistently wrapped with `JSON.stringify(...)`, which is the right basic defense against JXA injection.
- Read/write annotations are present and look semantically correct.
- Functional test coverage is broad.

### MEDIUM
1. **Untrusted JXA error payloads are surfaced with `sanitizeError` instead of `fenceUntrustedContent`**
   - In `src/connectors/apple-reminders/tools.ts`, these tools parse `{ error: ... }` from JXA and return it via:
     - `reminders_list_reminders`
     - `reminders_get_reminder`
     - `reminders_create_reminder`
     - `reminders_complete_reminder`
   - Example pattern:
     - `text: \`Error: ${sanitizeError(new Error(parsed.error))}\``
   - `parsed.error` is **data returned from the script**, not a trusted local exception. It can include untrusted reminder/list names and should be fenced or replaced with fixed error text.
   - **Fix:** return fixed messages or use `fenceUntrustedContent(parsed.error, 'apple-reminders')`.

### LOW
1. **Zod schemas are somewhat loose**
   - `query`, `listName`, and `name` allow empty strings.
   - `dueDate` is any string, not validated as ISO-ish input.
   - This is mainly robustness/behavioral risk, not a direct exploit.

2. **Tests miss annotation/schema validation checks**
   - Unlike some of the other connectors, tests do not assert `readOnlyHint` / `openWorldHint`, and they do not exercise bad-schema inputs.

**Counts — Apple Reminders**
- CRITICAL: 0
- HIGH: 0
- MEDIUM: 1
- LOW: 2

**APPROVED: YES**

---

## Apple Notes

**What looks good**
- JXA interpolation is consistently done with `JSON.stringify(...)`; I did not find a direct JXA injection issue.
- `fenceUntrustedContent` usage is generally strong and consistent for note titles, folder names, snippets, content, and queries.
- Error handling is reasonable.
- Test coverage is very good, including fencing behavior and annotations.

### LOW
1. **Some input schemas are overly permissive**
   - In `src/connectors/apple-notes/tools.ts`:
     - `notes_create_note.title` / `body` have no non-empty or max-length bounds.
     - `notes_search.query` has no `.min(1)`.
     - `folderName`, `id`, `name` are plain strings with no max bounds.
   - Main impact: empty searches and very large `osascript -e` payloads can cause poor behavior or command-size failures.

**Counts — Apple Notes**
- CRITICAL: 0
- HIGH: 0
- MEDIUM: 0
- LOW: 1

**APPROVED: YES**

---

## Obsidian

**What looks good**
- There is explicit lexical path traversal protection via `safePath(...)`.
- The existing `../` traversal checks are well tested.
- Read/write annotations are present and sensible.

### HIGH
1. **Path traversal prevention is bypassable via symlinks**
   - `src/connectors/obsidian/tools.ts` uses:
     - `path.resolve(...)`
     - prefix check in `safePath(...)`
   - That only prevents **lexical** traversal. It does **not** prevent escaping the vault through symlinks inside the vault.
   - Example:
     - If `/vault/notes/link.md` is a symlink to `/etc/passwd` or some other external file, `safePath('/vault', 'notes/link.md')` passes, and `fs.stat/readFile/writeFile` follow the symlink.
   - Affects at least:
     - `obsidian_read_note`
     - `obsidian_create_note` / overwrite cases
     - `obsidian_update_note`
     - `obsidian_daily_note` if folder path resolves through symlinked directories
   - **Fix:** canonicalize with `fs.realpath`, validate against the real vault root, and reject symlink path components via `lstat` where needed.

### MEDIUM
1. **Read/create/update tools are not limited to Markdown files**
   - Despite connector/tool descriptions saying Markdown notes, these tools accept arbitrary paths inside the vault:
     - `obsidian_read_note`
     - `obsidian_create_note`
     - `obsidian_update_note`
   - This allows reading/writing non-note files like `.obsidian/*`, plugin state, or other vault-local config.
   - **Fix:** enforce `.md` extension and consider blocking `.obsidian/` by default.

### LOW
1. **Tests miss the highest-risk filesystem case**
   - `src/connectors/obsidian/obsidian.test.ts` covers `../` traversal, but not symlink escapes or non-`.md` rejection.

**Counts — Obsidian**
- CRITICAL: 0
- HIGH: 1
- MEDIUM: 1
- LOW: 1

**APPROVED: NO**

---

## iMessage

**What looks good**
- SQLite query construction is good: all dynamic values are passed as query parameters (`?`), so I did **not** find SQL injection issues.
- Read-only tool outputs generally fence untrusted message text/senders/query strings correctly.
- Annotation coverage is solid, including `destructiveHint` on send.
- Tests are strong overall.

### MEDIUM
1. **`imessage_send` uses hand-escaped AppleScript interpolation instead of a more robust argument-passing strategy**
   - In `src/connectors/imessage/tools.ts`, the tool manually escapes `\` and `"` and interpolates into AppleScript source.
   - That is better than raw interpolation, but still brittle for control characters/newlines and easier to regress than structured serialization.
   - **Fix:** prefer a safer argument passing pattern or move this to JXA with `JSON.stringify(...)`-style embedding.

### LOW
1. **Invalid-recipient errors reflect raw untrusted input without fencing**
   - `imessage_send` returns:
     - `Error: Invalid recipient "${args.recipient}"...`
   - This is a reflected-input path and should be fenced or omitted.

2. **No timeout on `osascript` send**
   - `execFileAsync('osascript', ['-e', script])` has no timeout, unlike the JXA runners elsewhere.
   - A hung Messages/osascript process could stall the assistant.

3. **Injected DB dependency is ignored**
   - `createIMessageTools(db)` accepts a `db` argument, but the implementation always opens the hard-coded `chat.db`.
   - Mostly a design/testability issue, not a direct security bug.

**Counts — iMessage**
- CRITICAL: 0
- HIGH: 0
- MEDIUM: 1
- LOW: 3

**APPROVED: YES**

---

## Final Summary

| Connector | CRITICAL | HIGH | MEDIUM | LOW | APPROVED |
|---|---:|---:|---:|---:|---|
| Apple Reminders | 0 | 0 | 1 | 2 | YES |
| Apple Notes | 0 | 0 | 0 | 1 | YES |
| Obsidian | 0 | 1 | 1 | 1 | NO |
| iMessage | 0 | 0 | 1 | 3 | YES |

### Total counts
- **CRITICAL:** 0
- **HIGH:** 1
- **MEDIUM:** 3
- **LOW:** 7
