Verdict: **APPROVED: NO**

Counts:
- **CRITICAL:** 0
- **HIGH:** 1
- **MEDIUM:** 2
- **LOW:** 2

## Fix verification

- **Weather-only auto-allow:** **Verified**
  - `src/services/mcp-resolver.ts` only auto-allows read-only tools from `weather`.
- **CRLF sanitization:** **Verified**
  - `src/connectors/gmail/tools.ts` strips `\r`/`\n` from `to` and `subject` before `sendMessage()`.
- **Size limits:** **Verified**
  - Gmail body input capped at 50k.
  - Drive read truncates at 100k chars.
  - Drive upload content capped at 1,000,000 chars.
  - Calendar/Gmail inputs have reasonable caps.
- **Error sanitization:** **Partially verified**
  - `sanitizeError()` is now used, but remains incomplete; see Medium finding.
- **`exportMimeType` allowlist:** **Verified**
  - `drive_read_file` uses `z.enum(ALLOWED_EXPORT_TYPES)`.
- **Multi-currency grouping:** **Verified**
  - `plaid_get_balance` totals by currency.
- **UNTRUSTED DATA fencing + sentinel escape:** **Partially verified**
  - `fenceUntrustedContent()` does escape sentinels.
  - Many external fields are fenced.
  - But some important external fields are still emitted raw; see findings.

## Remaining findings

### HIGH — Drive connector still exposes attacker-controlled metadata outside UNTRUSTED DATA fences
**Where**
- `src/connectors/drive/tools.ts`
  - `formatMimeType()` returns raw unknown MIME types.
  - `drive_search_files`: raw `Type: ${formatMimeType(file.mimeType)}`
  - `drive_get_file`: raw `(${file.mimeType})`
  - `drive_read_file`: raw `[Content-Type: ${fileContent.mimeType}]`
  - `drive_upload_file`: raw `Name: ${file.name}`, raw `Link: ${file.webViewLink}`, raw MIME type

**Why this matters**
A malicious/shared Drive file can carry attacker-controlled metadata, especially MIME type and filename. That metadata is then injected directly into model context outside the UNTRUSTED DATA fence. This undermines the main prompt-injection mitigation you were trying to add.

**Fix**
Fence all external Drive metadata fields before rendering, including:
- `file.name`
- `file.webViewLink`
- `file.mimeType`
- `fileContent.mimeType`

Also avoid echoing unknown MIME types raw; map known values, otherwise fence them.

---

### MEDIUM — Error handling is improved but still not safe enough for hostile error text
**Where**
- `src/connectors/utils.ts` → `sanitizeError()`
- All connectors interpolate `sanitizeError(error)` directly into tool output.

**Problems**
- No control-char / newline stripping
- No sentinel escaping
- Not fenced as untrusted data
- Redaction is narrow (`Bearer`, `token=`, credential URLs only)

**Impact**
Upstream API/DB errors can still inject prompt-like content or leak secrets such as `access_token`, `refresh_token`, `api_key`, query-string credentials, JSON blobs, etc.

**Fix**
Either:
- fence sanitized errors with `fenceUntrustedContent(...)`, or
- normalize to a single safe line and broaden redaction:
  - strip `\r`, `\n`, control chars
  - escape UNTRUSTED DATA sentinels
  - redact `access_token`, `refresh_token`, `api_key`, `client_secret`, JWT-like blobs, credential query params

---

### MEDIUM — Some other external fields remain raw, so the “all external fields fenced” claim is not yet true
**Where**
- `src/connectors/plaid/tools.ts`
  - `plaid_list_institutions`: raw `item.errorCode`, raw `item.errorMessage`
- Pagination tokens emitted raw:
  - Gmail `nextPageToken`
  - Calendar `nextPageToken`
  - Drive `nextPageToken`

**Impact**
These are smaller residual prompt-injection surfaces. They are generally less attacker-controlled than Drive metadata, but they still break the stated rule of fencing all external fields.

**Fix**
Fence or strictly normalize these values before returning them.

---

### LOW — Sensitive connectors are enabled by default for every session
**Where**
- `src/services/mcp-resolver.ts`
  - `DEFAULT_ENABLED_CONNECTORS = ['weather', 'gmail', 'calendar', 'drive', 'plaid']`

**Impact**
Even though only weather gets auto-allow, all sensitive connector schemas/capabilities are still exposed to the model in every session. That’s broader-than-necessary attack surface.

**Fix**
Move to explicit per-user/per-session connector enablement, default-minimal if possible.

---

### LOW — Security regression coverage is incomplete
**Where**
- Tests do not appear to cover:
  - weather-only auto-allow behavior
  - raw Drive MIME type handling
  - fencing of `drive_upload_file` response fields
  - hostile error-message sanitization/fencing

**Impact**
The current gaps make these regressions easy to reintroduce.

**Fix**
Add unit tests for those cases.

## Bottom line

Most of the requested fixes are in place, but **the core prompt-injection hardening is still incomplete in Drive**, and that is serious enough to keep this at **NO**.

**APPROVED: NO**
