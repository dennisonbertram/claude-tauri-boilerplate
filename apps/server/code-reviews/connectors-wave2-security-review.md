## CRITICAL

### 1) Tool permission/auth bypass via `connectorAllowedTools` auto-allow (silent tool invocation)
**Where:** `src/services/mcp-resolver.ts`  
**What:** `resolveSessionMcpServers()` populates `connectorAllowedTools` with **every tool** from the in-process connector server:

```ts
for (const t of tools) {
  connectorAllowedTools.push(`mcp__${CONNECTOR_SERVER_NAME}__${t.name}`);
}
```

The comment explicitly says these tools will be “auto-allowed without permission prompts”. This effectively defeats any “ask user before accessing Gmail/Drive/Plaid” control implemented via the SDK permission system. It also makes `destructiveHint`/`readOnlyHint` largely meaningless if the permission layer is bypassed.

**Exploit impact:**
- **Silent data exfiltration**: prompt-injection from an email/Drive doc can cause the assistant to call `drive_read_file`, `gmail_get_message`, `finance_get_balance`, `finance_search_transactions`, etc. with no user awareness.
- **Silent destructive actions**: prompt-injection can cause `gmail_send_message` / `calendar_delete_event` / `calendar_create_event` / `drive_upload_file` to run without confirmation, enabling outbound exfiltration (send email to attacker, upload to attacker-controlled Drive folder if accessible, delete events, etc.).

**Recommendation:**
- Do **not** auto-allow all connector tools. At minimum:
  - Only auto-allow clearly safe tools (or none).
  - Require explicit per-tool user consent, especially for:
    - Gmail read body (`gmail_get_message`)
    - Drive read content (`drive_read_file`)
    - Any Plaid tools
    - Any destructive tools (`gmail_send_message`, `calendar_*`, `drive_upload_file`)
- Consider adding a “confirmation required” gate for destructive tools regardless of SDK hints.

---

### 2) Default enablement of all sensitive connectors for all sessions
**Where:** `src/services/mcp-resolver.ts`  
**What:** By default, every session gets:  
```ts
const DEFAULT_ENABLED_CONNECTORS = ['weather', 'gmail', 'calendar', 'drive', 'plaid'];
```
and the resolver instantiates the in-process server with these enabled.

**Exploit impact:**
- Even if a user never explicitly enabled Finance/Gmail/Drive for a given session/conversation, the tools exist and are callable.
- Combined with the auto-allow above, this is a “loaded gun”: any prompt-injection content the model sees can trigger immediate access to emails/files/banking data.

**Recommendation:**
- Default to **no sensitive connectors enabled**; require explicit user opt-in per connector.
- Persist and enforce connector enablement per-session (similar to external MCP overrides), not a global hardcoded default.

---

## HIGH

### 3) No explicit authentication/token presence checks at tool entry points (tools can be invoked regardless)
**Where:** All connector tool implementations (`src/connectors/gmail/tools.ts`, `calendar/tools.ts`, `drive/tools.ts`, `plaid/tools.ts`) and connector registry (`src/connectors/index.ts`)  
**What:**
- `requiresAuth: true` is only metadata in connector definitions; there is **no enforcement** in `getConnectorTools()`, `createConnectorMcpServer()`, or within each tool handler.
- Tools directly call service/db functions (`listMessages`, `getFileContent`, `getAccountsByUser`, etc.) with `db` only; no check that OAuth/Plaid auth is present/valid before proceeding.

**Exploit impact:**
- If any tokens exist in the DB/keychain, any session can attempt to use them.
- If tokens are missing/expired, errors may leak details (see below).
- The security boundary becomes “whatever the downstream service function does”, not the tool layer. That’s fragile and easy to regress.

**Recommendation:**
- Enforce auth at tool invocation time:
  - Check token existence + expiry before calling Google APIs.
  - For Plaid, ensure an explicit “connected & unlocked” state before returning any data.
- Gate tools by connector enablement and an explicit “authorized” state (not just `requiresAuth`).

---

### 4) Plaid connector has no per-user/session authorization (hardcoded user id = global data access)
**Where:** `src/connectors/plaid/tools.ts`  
**What:**
```ts
const DEFAULT_USER_ID = 'default';
```
Every Plaid tool reads from the DB for the same hardcoded userId. There is no session binding, no OS-user binding, no “unlock” step, no consent step.

**Exploit impact:**
- Any chat/session in the app can read the same Plaid dataset.
- On shared machines or if “profiles” exist in the app, this becomes cross-context data exposure.
- Combined with resolver auto-allow: prompt-injection can immediately dump balances/transactions.

**Recommendation:**
- Bind Plaid data access to a real user/profile identity and require an explicit “finance unlocked” gate per session.
- If you truly are single-user, still add a local “sensitive data access” confirmation step and/or OS-level secure storage gating.

---

## MEDIUM

### 5) Error message leakage (raw downstream error strings returned to model/user)
**Where:** All tools return `error.message` directly (e.g., `Error listing messages: ${message}`)  
**What:** Tool handlers consistently do:
```ts
const message = error instanceof Error ? error.message : String(error);
return { ... text: `Error ...: ${message}`, isError: true };
```

**Exploit impact:**
- Downstream Google/Plaid/HTTP libraries sometimes include sensitive details in error messages (request IDs, URLs with query params, stack fragments, occasionally misconfigured logging that includes headers).
- This can leak implementation details useful for targeted exploitation, and in worst cases leak credentials/tokens if any error object accidentally contains them in `.message`.

**Recommendation:**
- Return generic user-safe errors; log full details only to a protected local log.
- Add structured error mapping (auth expired vs quota vs not found) without echoing raw strings.

---

### 6) Unbounded sensitive content return (DoS + “bulk exfil”)
**Where:**
- `drive_read_file` returns full content as a string.
- `gmail_get_message` returns full body.
- `drive_upload_file` accepts arbitrary-size `content` string.
- `finance_get_spending_summary` requests all transactions (no limit) for aggregation.

**Exploit impact:**
- A malicious prompt can cause reading very large files/emails, potentially blowing token limits, causing UI lockups, or enabling bulk extraction.
- Upload tool can be used to write large data to Drive (storage abuse / cost / quota).

**Recommendation:**
- Enforce size limits and truncation with explicit “show more” pagination.
- Add a “sensitive data budget” per session and require confirmation to exceed.

---

### 7) Parameter-driven “query languages” enable broad enumeration (policy bypass risk)
**Where:** `drive_search_files` accepts raw Drive query syntax; `gmail_list_messages` accepts raw Gmail search query.  
**Exploit impact:**
- If the product intent is “help with a user-selected file/email”, these tools allow unrestricted search across the entire mailbox/drive.
- Not an API injection in the classic sense, but it is an *authorization/policy bypass surface* when the model is tricked (prompt injection) into searching for secrets (“search for password”, “search for bank statement”, etc.).

**Recommendation:**
- Add optional policy constraints (e.g., restrict to user-selected folders/labels; restrict to recent; restrict to allowlisted query patterns).
- Require user confirmation for broad searches or queries matching sensitive patterns.

---

## LOW

### 8) Global mutable connector registry (`initConnectors`) may create cross-session confusion
**Where:** `src/connectors/index.ts`  
**What:** `allConnectors`/`connectorMap` are module-level mutable globals overwritten by `initConnectors(db)`.

**Exploit impact:**
- In multi-window or multi-session contexts, a race could cause tools to reference an unexpected DB handle/state.
- Mostly stability/consistency, but can become a security issue if different DBs/profiles exist.

**Recommendation:**
- Make connector registry instance-scoped per app profile/session rather than global mutation.

---

### 9) No explicit user-awareness/consent hooks in tool implementations
**Where:** All tool handlers  
**What:** Tools do not implement confirmation flows themselves; they rely on SDK annotations (`destructiveHint`, etc.). But resolver auto-allows tools anyway (CRITICAL).

**Recommendation:**
- Add explicit confirmation parameters (e.g., `confirm: true`) for destructive/sensitive tools, enforced server-side.

---

## Notes on “Authorization scope creep”
OAuth scope requests are not present in the provided subset (Google/Plaid auth setup not included), so I can’t confirm if you request overly broad scopes. However, based on tool capability:
- **Drive**: reading arbitrary files typically requires `drive.readonly` or broader; uploading requires `drive.file` or `drive`.
- **Gmail**: reading message bodies requires `gmail.readonly` or `gmail.modify`; sending requires `gmail.send`.
- **Calendar**: create/update/delete requires `calendar` scope (not readonly).
If you currently request a single broad scope bundle for convenience, that’s scope creep; split scopes per connector/tool and request minimum needed.

---

CRITICAL: 2  
HIGH: 2  
APPROVED: NO
