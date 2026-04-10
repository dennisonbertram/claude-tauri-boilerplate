## Verification of previously reported issues

1) **CRITICAL: Auto-allow bypassed user confirmation → FIXED (for write tools)**
- `src/services/mcp-resolver.ts` now only adds tools to `connectorAllowedTools` when `t.sdkTool.annotations?.readOnlyHint === true`.
- Write/destructive tools in this subset are correctly annotated `readOnlyHint: false` (e.g., `gmail_send_message`, `drive_upload_file`, `calendar_create/update/delete_event`).

2) **CRITICAL: Prompt injection via raw outputs → PARTIALLY FIXED**
- **Implemented truncation**:
  - Gmail body truncated to **50KB** (`src/connectors/gmail/tools.ts`, `MAX_BODY_LENGTH = 50_000`)
  - Drive file content truncated to **100KB** (`src/connectors/drive/tools.ts`, `MAX_CONTENT_LENGTH = 100_000`)
- **Not covered**: other untrusted fields (calendar event descriptions, attendees, Drive filenames, Gmail subjects/snippets, Plaid merchant names, etc.) remain unbounded and can still carry prompt-injection payloads (even if smaller).

3) **HIGH: No email validation → FIXED**
- `gmail_send_message` rejects invalid `to` via regex and does **not** call `sendMessage` on failure.

4) **HIGH: No content limits → PARTIALLY FIXED**
- Limits exist for **gmail_get_message body** and **drive_read_file content**, but **no limits** for:
  - `drive_upload_file` input size
  - calendar event `description/location/attendees` size/count
  - many “summary/list” outputs

5) **HIGH: No transaction limits → FIXED (for spending summary)**
- `plaid_get_spending_summary` enforces `limit: 10000`.

6) **HIGH: Plaid naming → FIXED**
- Tool names are `plaid_*` in `src/connectors/plaid/tools.ts`.

---

## Remaining abuse vectors (by severity)

### CRITICAL

**C1) Silent sensitive-data exfiltration via “read-only auto-allow” + default enablement**
- `DEFAULT_ENABLED_CONNECTORS = ['weather','gmail','calendar','drive','plaid']` enables highly sensitive connectors by default (`src/services/mcp-resolver.ts`).
- Read-only tools are auto-allowed (no permission prompt) if `readOnlyHint: true`.
- Impact: any prompt injection (e.g., in an email body/snippet, Drive doc, calendar description) can coerce the model to call:
  - `gmail_list_messages`, `gmail_get_message`
  - `drive_search_files`, `drive_get_file`, `drive_read_file`
  - `calendar_list_events`
  - all `plaid_*` read tools (balances/transactions)
  and then reveal contents in-chat—**without explicit user confirmation**.
- Why this is still critical: “read-only” is not the same as “non-sensitive.” Banking/email/drive reads are privacy-critical actions.
- Mitigations:
  - Do **not** auto-allow sensitive read tools by default (only auto-allow low-risk tools like weather).
  - Do **not** enable Gmail/Drive/Plaid by default; require explicit user opt-in per connector (and ideally per session).
  - Add a separate annotation like `sensitiveReadHint` and require confirmation for it even if read-only.

---

### HIGH

**H1) No size limits on write-tool inputs (DoS, unexpected data upload, spam payloads)**
- `drive_upload_file`: `content: z.string()` has **no max length**; can be multi-MB, causing memory pressure and large uploads.
- `gmail_send_message`: `subject`/`body` have **no max length**.
- `calendar_create_event`: `description`, `location`, and `attendees` array have **no bounds**.
- Even with confirmation, a single approval could result in huge transfers/costs or operational issues.
- Mitigations: add strict `z.string().max(...)` and `z.array(...).max(...)` caps; consider rate limits.

**H2) Missing output limits beyond Gmail body / Drive content**
- Calendar tools output event `description`, `location`, and attendee lists with no truncation; `maxResults` allows up to 100 events.
- Plaid and Drive listing tools don’t cap per-field length; malicious data in DB/file metadata can bloat context and degrade safety.
- Mitigations: implement a **global response budget** (total chars) per tool, plus per-field truncation.

**H3) Error-message passthrough may leak secrets**
- Tools return `error.message` directly to the model/user across Gmail/Drive/Calendar/Plaid.
- If upstream libraries include tokens, request headers, DB paths, SQL fragments, or PII in error messages, these could be exposed.
- Mitigations:
  - Map errors to user-safe messages; log detailed errors locally.
  - Strip patterns resembling tokens/headers/URLs with credentials.

**H4) `drive_read_file` allows arbitrary `exportMimeType` (binary/huge output risk)**
- The tool permits exporting as e.g. `application/pdf` (or other types) which may produce large/binary-like strings, even if truncated.
- Mitigations:
  - Allowlist text-like export types (`text/plain`, `text/csv`, maybe `application/json`).
  - If PDF export is needed, return metadata/link instead of content unless explicitly confirmed.

**H5) Plaid single-user hardcoding (`DEFAULT_USER_ID = 'default'`) is a multi-user data-leak footgun**
- In any future scenario with multiple OS users, profiles, or remote sessions sharing a DB, all Plaid reads target the same logical user.
- Mitigation: plumb a real user/session identity into Plaid DB queries; enforce per-session authorization.

---

### MEDIUM

**M1) Calendar attendee emails not validated**
- `calendar_create_event` takes arbitrary `attendees: string[]`; invalid values can cause API errors or unexpected behavior.
- Mitigation: validate attendee email format and cap count.

**M2) Tool safety relies on manual annotation correctness**
- Auto-allow is driven by `readOnlyHint`. A future dev mistake (marking a write tool read-only) becomes a security regression.
- Mitigation: enforce read-only classification centrally (e.g., by tool name allowlist) and/or add CI tests that forbid auto-allow for tools with side effects.

**M3) Potential server-name collision / reserved-name risk (depends on `isInternalServer`)**
- Internal connector server name is hardcoded to `"connectors"`.
- If external MCP config could define a server with the same name and slip past `isInternalServer`, it could confuse permissioning/allow-lists.
- Mitigation: explicitly reserve/deny external servers named `connectors` (and other internal names), independent of `isInternalServer`.

---

### LOW

**L1) UI/rendering injection risk if frontend doesn’t escape tool text**
- Tool outputs include untrusted strings (subjects, filenames, descriptions). If rendered as Markdown/HTML without escaping, could lead to UI deception or XSS (frontend-dependent).
- Mitigation: escape/neutralize in UI; consider wrapping untrusted content in code blocks.

---

## Counts & decision
- **Critical:** 1  
- **High:** 5  
- **Medium:** 3  
- **Low:** 1  

**APPROVED: NO** (critical privacy/exfiltration risk remains due to auto-allowed sensitive read tools + default enablement).
