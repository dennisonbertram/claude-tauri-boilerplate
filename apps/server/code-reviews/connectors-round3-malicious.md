Reviewed with an adversarial lens.

Verified solid from prior rounds:
- Auto-allow regression looks fixed in `src/services/mcp-resolver.ts`: only read-only `weather` tools are auto-allowed.
- Drive export bypass looks fixed in `src/connectors/drive/tools.ts`: `exportMimeType` is constrained by a strict enum.

Not fully solid from prior rounds:
- “All string fields have `.max()`” is not true in this subset.
- `sanitizeError()` is better, but still incomplete.
- Plaid still hardcodes `DEFAULT_USER_ID = 'default'` by design.

## CRITICAL
- None.

## HIGH
- None.

## MEDIUM

### 1) Incomplete input size limits across many tool fields
Affected:
- `src/connectors/gmail/tools.ts`
- `src/connectors/calendar/tools.ts`
- `src/connectors/drive/tools.ts`
- `src/connectors/plaid/tools.ts`

Examples still unbounded:
- Gmail: `query`, `pageToken`, `messageId`, `to`, `threadId`
- Calendar: `calendarId`, `timeMin`, `timeMax`, `pageToken`, `start`, `end`, `eventId`, attendee strings
- Drive: `query`, `pageToken`, `fileId`, `name`, `mimeType`, `parentId`
- Plaid: essentially all string filters/IDs

Impact:
- Large attacker-controlled strings can still be sent downstream to services or reflected back into model context.
- This leaves room for memory/context bloat, oversized API requests, and validation/error amplification.

Why prior fix is not solid:
- Some high-risk write fields got caps, but not “all string fields.”

Recommended fix:
- Add `.max()` to every string field, including IDs/query/pagination/date strings.
- Add array bounds too, e.g. attendee list length and per-item `.email().max(...)`.

### 2) Raw untrusted connector data is passed straight into the model context
Affected:
- Gmail message bodies/snippets/subjects
- Drive file contents/file names
- Calendar descriptions/locations/titles
- Plaid merchant/category text

Files:
- `src/connectors/gmail/tools.ts`
- `src/connectors/drive/tools.ts`
- `src/connectors/calendar/tools.ts`
- `src/connectors/plaid/tools.ts`

Impact:
- Prompt-injection via email/file/event content is still possible.
- A malicious email/doc can instruct the assistant to take follow-on actions or retrieve additional data.
- The earlier auto-allow fix reduces silent exfil risk, but does not remove tool-output prompt injection risk.

Recommended fix:
- Treat connector output as untrusted data, not instructions.
- Return structured fields where possible instead of freeform concatenated text.
- Wrap large external content in strong delimiters and add explicit system guidance to ignore instructions found inside tool data.

### 3) `sanitizeError()` is incomplete and can still leak sensitive internals
Affected:
- `src/connectors/utils.ts`

Current redaction catches:
- `Bearer ...`
- `token=...` / `token: ...`
- credentialed URLs

Still likely to leak:
- `apiKey=...`, `secret=...`, `client_secret=...`
- `Authorization: Basic ...`
- cookies / session IDs
- file paths, SQL snippets, stack-ish multiline text
- arbitrary sensitive values in structured error bodies

Impact:
- Service/library errors can still expose secrets or internal details back to the model/user.

Why prior fix is not solid:
- It is pattern-based and narrow, not deny-by-default.

Recommended fix:
- Prefer generic user-facing errors and log full details only locally.
- If surfacing details is necessary, redact a much broader set of secret patterns and strip/control newlines.

## LOW

### 4) Plaid user scoping is still hardcoded
Affected:
- `src/connectors/plaid/tools.ts`

Issue:
- `DEFAULT_USER_ID = 'default'` is still used for all Plaid reads.

Impact:
- Under the stated single-user desktop assumption, this is acceptable.
- But it remains a latent cross-user/cross-profile data isolation problem if the app ever supports multiple local identities/profiles/accounts.

Recommendation:
- Derive user scope from actual authenticated session/profile state, not a constant.

### 5) Truncation happens after content is fetched/materialized
Affected:
- `gmail_get_message` in `src/connectors/gmail/tools.ts`
- `drive_read_file` in `src/connectors/drive/tools.ts`

Impact:
- The handler truncates output, but only after the full email/file content has already been returned by the service.
- Large messages/files can still cause memory/latency problems upstream.

Recommendation:
- Enforce content-size limits in the service layer before full download/materialization.

### 6) Calendar attendee input is weakly constrained
Affected:
- `src/connectors/calendar/tools.ts`

Issue:
- `attendees: z.array(z.string()).optional()`
- No `.email()` validation
- No max attendee count
- No per-item length cap

Impact:
- If a user approves the tool, this can be abused for spammy/mass invite behavior or oversized requests.

Recommendation:
- Use `z.array(z.string().email().max(...)).max(...)`.

---

## Summary
- CRITICAL: 0
- HIGH: 0
- MEDIUM: 3
- LOW: 3

APPROVED: YES
