CRITICAL: 0  
HIGH: 1  
MEDIUM: 3  
LOW: 0  

APPROVED: NO

Findings:

1. HIGH — `fenceUntrustedContent()` is bypassable with near-sentinel variants  
   File: `src/connectors/utils.ts`  
   The escape only replaces exact ASCII matches of:
   - `[END UNTRUSTED DATA]`
   - `[BEGIN UNTRUSTED DATA`
   
   That means an attacker can use semantically similar variants the model may still treat as fence markers, e.g.:
   - non-breaking spaces: `[END UNTRUSTED DATA]`
   - doubled spaces/tabs: `[END  UNTRUSTED DATA]`
   - homoglyph brackets/dashes/letters

   Since the defense relies on the model interpreting the fence correctly, exact-string escaping is not enough. A malicious email/document/calendar description can likely make the model believe the fenced block ended early and then follow injected instructions.

   Why this matters: this breaks the primary prompt-injection mitigation across Gmail/Drive/Calendar/Plaid read paths.

2. MEDIUM — Several external fields are still emitted outside the fence  
   Files:
   - `src/connectors/gmail/tools.ts`
   - `src/connectors/drive/tools.ts`
   - `src/connectors/plaid/tools.ts`

   Examples:
   - Gmail: `Date: ${msg.date}` in both list/get message
   - Drive: raw `file.mimeType` in `drive_get_file` / `drive_upload_file`
   - Drive: raw `[Content-Type: ${fileContent.mimeType}]` in `drive_read_file`
   - Plaid: raw `errorCode` / `errorMessage` in `plaid_list_institutions`
   - Plaid: raw `paymentChannel` in `plaid_search_transactions`

   Some of these are plausibly attacker-controlled:
   - email Date headers can contain comments/text
   - Drive MIME types for uploaded files can be uploader-controlled
   - provider error text is untrusted external text

   So the “all external fields fenced” claim is not true yet.

3. MEDIUM — Raw reflection of tool arguments into tool output reopens prompt injection through the tool-result channel  
   Files:
   - `src/connectors/gmail/tools.ts`
   - `src/connectors/drive/tools.ts`
   - `src/connectors/calendar/tools.ts`
   - `src/connectors/plaid/tools.ts`

   Examples:
   - Gmail invalid-email path echoes raw `args.to`
   - Gmail/Drive no-results messages echo raw `args.query`
   - Calendar delete success echoes raw `args.eventId`
   - Plaid errors echo raw `args.accountId` / `args.type`

   This matters even though the attacker is “the user”: tool results are often treated by the model as higher-trust than user text. A malicious user can intentionally cause a tool call with a payload that comes back as assistant tool output and may influence later behavior.

   Notably, in `gmail_send_message`, CRLF stripping happens only on the success path; the invalid-email error path reflects raw input first.

4. MEDIUM — Error text is sanitized for secrets, but still unfenced untrusted content  
   File: all connector tools using `sanitizeError()`  
   Pattern:
   - ``Error ... ${sanitizeError(error)}``

   `sanitizeError()` removes some secrets, but it does not convert the message into a trusted-safe format or fence it. If an upstream API error includes attacker-controlled text, file names, headers, query echoes, or instruction-like content, the error path becomes an unfenced injection path.

What looks fixed/good:
- Weather-only auto-allow in `mcp-resolver` is good.
- Drive export MIME allowlist is good.
- Body/content truncation helps.
- Basic Gmail CRLF stripping on successful send is good, but incomplete on error/reflection paths.

Recommended fixes:
- Replace fence-based freeform text with structured serialization for untrusted content:
  - JSON field/value output, or
  - base64/quoted blob, or
  - separate `data` field not mixed with natural-language wrapper text.
- If keeping sentinels, normalize Unicode/whitespace and escape broad variants, not just exact strings.
- Fence or encode every external field, including headers/metadata/error strings.
- Treat echoed tool args as untrusted too.
- Fence sanitized errors or replace with fixed canned messages plus opaque error codes.
