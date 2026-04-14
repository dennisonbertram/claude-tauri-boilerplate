## Verification of previously found issues (are they FIXED?)

1) **CRITICAL: All tools were auto-allowed → now only `readOnlyHint` tools should be auto-allowed**  
**Fixed (per `src/services/mcp-resolver.ts`)**: resolver now builds `connectorAllowedTools` only when `(t.sdkTool as any).annotations?.readOnlyHint === true`.

2) **CRITICAL: All connectors enabled by default**  
**Unchanged / Accepted** (per your note): `DEFAULT_ENABLED_CONNECTORS = ['weather','gmail','calendar','drive','plaid']` in `mcp-resolver.ts`.

3) **HIGH: No content size limits**  
**Fixed for the two called out tools**:  
- `drive_read_file` truncates to **100,000 characters** (`src/connectors/drive/tools.ts`)  
- `gmail_get_message` truncates body to **50,000 characters** (`src/connectors/gmail/tools.ts`)

4) **HIGH: No email validation**  
**Fixed (basic validation)**: `gmail_send_message` validates `to` with a regex and rejects invalid emails before calling the service (`src/connectors/gmail/tools.ts`).

5) **HIGH: Plaid naming**  
**Fixed**: tools are `plaid_*` (`src/connectors/plaid/tools.ts` + tests).

---

## Remaining security issues (by severity)

### CRITICAL

1) **Silent data exfiltration risk via auto-allowed “read-only” tools (Gmail/Drive/Plaid are highly sensitive)**  
**Where**: `src/services/mcp-resolver.ts` auto-allows *all* connector tools that set `readOnlyHint: true`.  
**Why it’s critical**: “Read-only” is not the same as “low-risk.” These tools can pull extremely sensitive data (email content, Drive documents, banking transactions/balances) and send it to the model context without a user permission prompt. This is a classic prompt-injection/exfil path: any untrusted content the assistant processes (email, doc text, etc.) could induce the model to call additional read tools and disclose the results.  
**Recommendation**:
- Do **not** auto-allow any tools that access private user data by default. Consider an additional annotation like `sensitiveDataHint: true` and require explicit user confirmation even for read-only tools.
- Alternatively, only auto-allow truly low-risk read tools (e.g., weather) and require prompts for Gmail/Drive/Plaid reads.

---

### HIGH

1) **Potential header injection / MIME injection in `gmail_send_message` (subject/to not hardened against CRLF)**  
**Where**: `src/connectors/gmail/tools.ts` validates only `to` format; `subject` and `to` are not explicitly blocked from containing `\r`/`\n`.  
**Why**: If the underlying `sendMessage` service constructs a raw RFC822 message by concatenating headers (common for Gmail APIs), then allowing CRLF in `subject` (or even `to` if validation is bypassed elsewhere) can enable header injection (adding Bcc/CC/Reply-To, altering content-type, etc.).  
**Recommendation**:
- Reject or sanitize `\r` and `\n` in header fields (`to`, `subject`, and any future `cc/bcc/from`).  
- Consider stronger address parsing (or a library) and explicit RFC822 header encoding.

2) **Size limits only truncate *returned text*, not necessarily what is fetched/processed**  
**Where**: `drive_read_file` and `gmail_get_message` truncate after `getFileContent()` / `getMessage()` returns full content.  
**Why**: If the service downloads/decodes large files/emails fully in memory first, an attacker-controlled large doc/email can cause memory/CPU spikes (local DoS).  
**Recommendation**:
- Enforce limits at the service/API layer (streaming, max bytes, early abort) rather than only truncating the final string.

3) **No size limits on write tools (`drive_upload_file`, `gmail_send_message`, calendar create/update)**  
**Where**:
- `drive_upload_file` accepts arbitrary `content` string
- `gmail_send_message` accepts arbitrary `body`
- calendar tools accept large `description`, etc.  
**Why**: Even with permission prompts, this is an easy DoS/quota-burn vector (very large payloads), and can create unexpected billing/API throttling issues.  
**Recommendation**: Add reasonable maximums (and ideally show the size to the user at confirmation time).

---

### MEDIUM

1) **Error message leakage to model/UI (may include sensitive details from upstream errors)**  
**Where**: across tools, errors are returned as `Error: ${message}` / `Error ...: ${message}` (e.g., Gmail/Drive/Calendar/Plaid tools).  
**Why**: Upstream errors sometimes include request IDs, endpoint URLs, raw response bodies, or misconfigured libraries that accidentally include secrets in error strings. This can leak into the model transcript.  
**Recommendation**:
- Return a generic user-safe message and log the detailed error locally (or behind a debug flag).
- If you must show details, scrub obvious secrets/tokens.

2) **Plaid “single-user default” userId hardcoding is fragile if multi-profile is added later**  
**Where**: `src/connectors/plaid/tools.ts` uses `DEFAULT_USER_ID = 'default'`.  
**Why**: Not an immediate vulnerability in a strictly single-user app, but it becomes a cross-user data exposure bug the moment multiple profiles/sessions are introduced.  
**Recommendation**: Thread a profile/user identifier into tool calls (or clearly assert single-user at a higher layer and prevent multi-user DB state).

---

### LOW

1) **Output injection / UI rendering assumptions**  
Tools embed user-controlled strings into tool output (e.g., Drive `query`, Gmail `subject/snippet/body`, Plaid merchant names). If the frontend renders tool output as HTML/Markdown unsafely, this could become an injection issue.  
**Recommendation**: Ensure outputs are rendered as plain text or properly escaped/sanitized.

2) **Auto-allow implementation depends on SDK tool shape (`(t.sdkTool as any).annotations`)**  
If the SDK stores annotations elsewhere, this will fail closed (no auto-allow). That’s not a security flaw, but it can cause unexpected permission prompting behavior.  
**Recommendation**: Confirm the canonical property path in the SDK type.

---

## Counts
- **CRITICAL:** 1  
- **HIGH:** 3  
- **MEDIUM:** 2  
- **LOW:** 2  

**APPROVED: NO** (due to the CRITICAL silent-exfiltration risk from auto-allowing read access to highly sensitive connectors, plus high-risk input-hardening gaps in Gmail send and missing service-layer size enforcement).
