Reviewed against: `fenceUntrustedContent` / `sanitizeError`, Zod schemas, error handling, annotations, security, API correctness, and tests.

## Discord

### HIGH
1. **Raw path/query interpolation with unconstrained IDs**
   - **Where:** `src/connectors/discord/tools.ts`
   - `guild_id`, `channel_id`, `user_id`, and `before` are plain `z.string()` values and are interpolated directly into request paths/query strings.
   - Examples:
     - `/guilds/${args.guild_id}/channels`
     - `/channels/${args.channel_id}/messages?limit=${limit}&before=${args.before}`
     - `/users/${args.user_id}`
   - This allows path/query manipulation against the Discord API under the bot token if a malicious or malformed value is passed.
   - **Fix:** validate Discord snowflakes with regex, and `encodeURIComponent` every path segment / query value.

### LOW
1. **Test coverage misses malformed-input and annotation checks**
   - Tests are otherwise strong, but they do not verify:
     - rejection of invalid IDs
     - encoding of path segments/query values beyond emoji
     - annotation presence/values on all tools

### Notes
- Good use of `sanitizeError`.
- Good use of `fenceUntrustedContent` on most externally sourced display fields.
- Annotations look correct for read vs write tools.

**Counts — Discord:** CRITICAL 0, HIGH 1, MEDIUM 0, LOW 1  
**APPROVED: NO**

---

## YNAB

### MEDIUM
1. **Untrusted external fields returned without fencing**
   - **Where:** `ynab_get_transactions` in `src/connectors/ynab/tools.ts`
   - `category_name` and `account_name` are rendered raw:
     - `Category: ${tx.category_name ?? 'Uncategorized'}`
     - `Account: ${tx.account_name}`
   - These are API-sourced strings and should be fenced like `payee_name` and `memo`.

2. **Schemas are too weak for path/query inputs**
   - **Where:** multiple tools in `src/connectors/ynab/tools.ts`
   - `budget_id`, `month`, and `since_date` are unconstrained strings.
   - They are inserted directly into URL paths/query strings without encoding.
   - **Fix:** validate:
     - `budget_id` against UUID or `last-used`
     - `month` against `YYYY-MM-DD` or explicitly translate `current`
     - `since_date` against `YYYY-MM-DD`
     - encode path/query components

3. **`month: "current"` is documented but not implemented safely**
   - **Where:** `ynab_get_month_budget`
   - Description says to use `"current"`, but the implementation just sends `/months/current`.
   - If YNAB does not support that literal, this will fail at runtime.
   - **Fix:** translate `"current"` to the first day of the current month before calling the API, or remove that claim.

### LOW
1. **Coverage gap for the above security/schema cases**
   - Tests are good overall and even check annotations, but they do not catch:
     - unfenced `account_name` / `category_name`
     - invalid `month` / `since_date`
     - `"current"` behavior

### Notes
- Consistent `sanitizeError` use.
- Most external strings are fenced correctly.
- Annotation coverage is better here than in the other connectors.

**Counts — YNAB:** CRITICAL 0, HIGH 0, MEDIUM 3, LOW 1  
**APPROVED: YES**

---

## Dropbox

### MEDIUM
1. **`mode: "update"` is exposed but not implemented correctly**
   - **Where:** `dropbox_upload_file` in `src/connectors/dropbox/tools.ts`
   - Schema allows `mode: 'update'`, but Dropbox upload update mode requires revision-specific data, not just the literal string `"update"`.
   - Calls using this option will fail.
   - **Fix:** either remove `"update"` from the schema or add the required revision input and correct payload shape.

2. **Opaque Dropbox cursors are surfaced unfenced**
   - **Where:**
     - `dropbox_list_folder`
     - `dropbox_search`
   - `data.cursor` is external data and is returned raw in:
     - `More entries available. Cursor: ${data.cursor}`
     - `More results available. Cursor: ${data.cursor}`
   - Should be fenced as untrusted content.

### LOW
1. **Binary files are decoded as UTF-8 text**
   - **Where:** `dropbox_read_file`
   - Arbitrary bytes are decoded as text. For PDFs/images/etc., output will be misleading or garbled.
   - **Fix:** detect likely binary content and return a metadata notice instead of decoded text.

2. **Test coverage is broad but misses key security/API gaps**
   - No tests for:
     - fencing filenames/paths/cursors/content
     - the broken `"update"` upload mode

### Notes
- Good use of `sanitizeError`.
- Good fencing for filenames, paths, and file contents in the main flows.
- Annotation usage looks appropriate.

**Counts — Dropbox:** CRITICAL 0, HIGH 0, MEDIUM 2, LOW 2  
**APPROVED: YES**

---

## Telegram

### MEDIUM
1. **Token redaction gap for Telegram URL-based auth**
   - **Where:** `src/connectors/telegram/tools.ts` + `src/connectors/utils.ts`
   - Telegram requires the bot token in the URL path (`/bot<TOKEN>/...`).
   - `sanitizeError` does **not** redact that pattern.
   - If any surfaced error ever includes the full request URL, the bot token can leak to the model/output.
   - **Fix:** add redaction for Telegram bot-token URL patterns before returning errors.

2. **HTML parse mode is always enabled without escaping**
   - **Where:**
     - `telegram_send_message`
     - `telegram_send_photo`
   - `parse_mode: 'HTML'` is always set, but `text` / `caption` are passed through raw.
   - Unescaped `<`, `>`, `&`, or forwarded external content can alter message rendering or create unintended links/formatting.
   - **Fix:** either escape content by default or only enable HTML when explicitly requested.

3. **Schema/behavior mismatch for photo URLs**
   - **Where:** `telegram_send_photo`
   - Description says “HTTPS URL”, but schema only uses `z.string().url()`.
   - That does not enforce `https:`.
   - **Fix:** refine the schema to require `url.protocol === 'https:'`.

4. **`telegram_get_chat` assumes `member_count` comes from `getChat`**
   - **Where:** `telegram_get_chat`
   - Telegram Bot API provides member count via `getChatMemberCount`, not the `getChat` response.
   - Current code/test behavior suggests an API misunderstanding.
   - **Fix:** remove `member_count` from `getChat` expectations or make a second API call.

### LOW
1. **Tests miss several important edge/security cases**
   - No tests for:
     - annotation values
     - HTML escaping behavior
     - token redaction when a network/fetch error includes a Telegram URL

### Notes
- Good use of `fenceUntrustedContent` on most returned message/chat fields.
- Error handling is consistent, but Telegram’s URL-token auth needs extra sanitization care.

**Counts — Telegram:** CRITICAL 0, HIGH 0, MEDIUM 4, LOW 1  
**APPROVED: YES**

---

## Summary

| Connector | CRITICAL | HIGH | MEDIUM | LOW | APPROVED |
|---|---:|---:|---:|---:|---|
| Discord | 0 | 1 | 0 | 1 | NO |
| YNAB | 0 | 0 | 3 | 1 | YES |
| Dropbox | 0 | 0 | 2 | 2 | YES |
| Telegram | 0 | 0 | 4 | 1 | YES |

### Overall counts
- **CRITICAL:** 0
- **HIGH:** 1
- **MEDIUM:** 9
- **LOW:** 5
