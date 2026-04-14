Security review of the provided connector subset:

## Previous findings verification

1. **Sensitive read tools auto-allowed** — **FIXED**
   - In `src/services/mcp-resolver.ts`, auto-allow is now restricted to:
     - `annotations?.readOnlyHint === true`
     - connector name in `AUTO_ALLOW_CONNECTORS = new Set(['weather'])`
   - Gmail / Calendar / Drive / Plaid read tools are no longer auto-allowed.

2. **CRLF injection in email headers** — **FIXED**
   - In `src/connectors/gmail/tools.ts`, `gmail_send_message` strips `\r` and `\n` from:
     - `to`
     - `subject`
   - This addresses header injection in the email send path.

3. **Raw error passthrough** — **FIXED**
   - Connector catch blocks now consistently use `sanitizeError(...)`.
   - `src/connectors/utils.ts` redacts common token patterns and truncates to 500 chars.

4. **Unrestricted Drive export types** — **FIXED**
   - In `src/connectors/drive/tools.ts`, `exportMimeType` is now `z.enum(ALLOWED_EXPORT_TYPES)`.
   - Arbitrary export MIME types are no longer accepted.

5. **Missing size limits on writes** — **PARTIALLY FIXED / NOT FULLY RESOLVED**
   - Major payload fields now have caps (`body`, `content`, `summary`, etc.).
   - However, multiple write-path fields remain unbounded. See **MEDIUM-1** below.

---

## Findings by severity

### CRITICAL
- None.

### HIGH
- None.

### MEDIUM

#### MEDIUM-1: Write-input size limits are incomplete
The prior size-limit fix is only partial. Several write-capable tools still accept unbounded strings/arrays.

Examples:
- `src/connectors/gmail/tools.ts`
  - `to: z.string()`
  - `threadId: z.string().optional()`
- `src/connectors/calendar/tools.ts`
  - `start: z.string()`
  - `end: z.string()`
  - `attendees: z.array(z.string()).optional()`
  - `calendarId: z.string().optional()`
  - `eventId: z.string()`
- `src/connectors/drive/tools.ts`
  - `name: z.string()`
  - `mimeType: z.string()`
  - `parentId: z.string().optional()`

**Why it matters:** oversized arguments can still drive excessive memory use, oversized upstream API requests, or noisy/slow failures on write paths.

**Recommendation:** add `.max(...)` to all write-path string fields and bound array length / element length for `attendees`.

---

#### MEDIUM-2: Untrusted-content tools are marked `openWorldHint: false`
Many tools that return attacker-controlled or externally sourced content are annotated as closed-world:

- Gmail:
  - `gmail_list_messages`
  - `gmail_get_message`
- Drive:
  - `drive_search_files`
  - `drive_get_file`
  - `drive_read_file`
- Calendar:
  - `calendar_list_events`
- Plaid:
  - several read tools also use `openWorldHint: false`

These tools return data such as:
- email bodies/snippets/subjects
- Drive file names/content
- calendar descriptions/locations
- merchant/institution names

**Why it matters:** this content is untrusted and can contain prompt-injection instructions. Marking it as closed-world may weaken any SDK/model-side safety behavior that relies on this annotation.

**Recommendation:** set `openWorldHint: true` for tools that surface external/untrusted content, especially Gmail/Drive/Calendar read operations.

---

### LOW

#### LOW-1: `sanitizeError` is better than raw passthrough, but still incomplete
`src/connectors/utils.ts` redacts:
- `Bearer ...`
- `token=...` / `token: ...`
- credential-bearing URLs

But it does **not** cover many other secret forms, e.g.:
- `api_key=...`
- `password=...`
- cookies/session IDs
- other provider-specific secret formats

It also preserves control characters/newlines.

**Why it matters:** downstream error strings may still leak some secrets or inject misleading multi-line content into the tool transcript.

**Recommendation:** expand redaction patterns and normalize control characters/newlines before returning error text.

---

## Summary

- **CRITICAL:** 0
- **HIGH:** 0
- **MEDIUM:** 2
- **LOW:** 1

**APPROVED: YES**
