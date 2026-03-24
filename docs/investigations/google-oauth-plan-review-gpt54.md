# Google OAuth Implementation Plan — GPT-5.4 Architecture Review

**Reviewer**: GPT-5.4 (reasoning_effort: xhigh)
**Date**: 2026-03-23
**Input**: `/Users/dennisonbertram/.claude/plans/delightful-sleeping-pony.md`

---

Overall: the direction is good, but I would **not implement this plan as written**.
The backend-first model, loopback redirect, PKCE, and state are the right primitives. The weak spots are mostly around:

- **Google-specific scope behavior**
- **refresh-token lifecycle**
- **desktop-local security assumptions**
- **Docs/Drive semantics**
- **UX/error-state handling**

## What's solid

- **Backend-first** is the right default here for consistency and maintainability.
- **Loopback redirect + PKCE + state** is the correct native-app OAuth pattern.
- **System browser** is correct for Google native auth.
- **Singleton DB row** is acceptable for a single-account desktop app.

---

# CRITICAL — must fix before implementation

## 1) `drive.file` does **not** match the planned Drive/Docs feature set
**Issue:**
Your planned routes imply broad Drive/Docs access:

- list/search files
- get arbitrary file metadata/content
- read/update Docs

But `https://www.googleapis.com/auth/drive.file` is **not** general Drive access. It is limited to files the app created or files the user explicitly opened/shared with the app. In a **backend-only** architecture, you are **not using Google Picker**, so users have no standard Google UX to grant per-file access to arbitrary existing files.

**Why this matters:**
As written, `/drive/files`, `/drive/files/:id`, `/drive/files/:id/content`, `/docs/:id`, `/docs/:id` will likely behave much more narrowly than you expect, or appear "broken" for normal user files.

**Recommendation:** decide now which model you want:

- **Option A: Keep least privilege**
  - Keep `drive.file`
  - Limit features to app-created/app-opened files only
  - Remove "general Drive browse/search arbitrary file" expectations

- **Option B: Support arbitrary Drive/Docs access**
  - Request broader scopes, likely some combination of:
    - `drive.readonly` or `drive.metadata.readonly` for browse/search
    - `drive` if you need arbitrary write/update
    - `documents.readonly` / `documents` for Docs content
  - Accept broader consent and verification implications

- **Option C: Use Google Picker**
  - Best for least-privilege per-file access
  - But that conflicts with your "frontend never talks to Google" purity

**Bottom line:** current scopes and current route plan are misaligned.

---

## 2) Refresh-token acquisition/reacquisition is underspecified and likely to fail
**Issue:**
The plan does not explicitly call out:

- `access_type=offline`
- when to use `prompt=consent`
- what to do if Google returns **no refresh token**

Google often only returns a refresh token on the **first consent** for a user/client/scope set. If the user disconnects locally and reconnects, you may get only an access token unless you force re-consent or revoke remotely first.

**Why this matters:**
Without a refresh token, the integration silently becomes short-lived and breaks after access-token expiry.

**Recommendation:**

- Always include:
  - `access_type=offline`
- On first connect, reconnect after local disconnect, or scope upgrade:
  - use `prompt=consent`
- Consider `prompt=select_account consent` when reconnecting/switching account
- If callback succeeds but no `refresh_token` is returned when one is required:
  - treat that as a failure state, not "connected"
- On disconnect:
  - **revoke the token at Google**, then clear local DB
  - this helps ensure a new refresh token can be issued next time

Also: when token refresh events occur, **never overwrite a stored refresh token with null/undefined**.

---

## 3) Callback exemption is only safe if the backend is bound to loopback only
**Issue:**
Exempting `/api/google/oauth/callback` from bearer auth is fine **only** if the server is reachable **only on 127.0.0.1 / ::1**.

**Why this matters:**
If Bun/Hono binds `0.0.0.0`, or is exposed by a proxy, you've created a public unauthenticated endpoint in your app API.

**Recommendation:**

- Ensure the backend listens on **127.0.0.1 only** for desktop mode
- Exempt the **exact callback path + method only**
- Ideally place the callback route outside generic authenticated `/api/*` middleware if possible
- Add:
  - `Cache-Control: no-store`
  - `Referrer-Policy: no-referrer`
  - no external assets/scripts on callback HTML
- Disable/redact callback query logging:
  - the URL contains the auth `code` and `state`

---

## 4) Gmail scope choice may be a release blocker, not just an implementation detail
**Issue:**
`gmail.modify` is a heavy Gmail scope. For external/public distribution, Gmail scopes can trigger Google verification and possibly significant compliance/security-review overhead.

**Why this matters:**
This can block shipping far longer than the engineering work.

**Recommendation:**

- Decide now whether the app is:
  - **personal/test-user only**
  - **internal to one Google Workspace**
  - **publicly distributed**
- If public, plan for Google OAuth verification early
- If you only need list/read/send, consider whether you can reduce from `gmail.modify` to a narrower combination like:
  - `gmail.readonly`
  - `gmail.send`
- Even if verification burden remains, narrower scopes are still better for user trust

If Gmail verification is likely to slow launch, consider shipping Calendar/Drive first and Gmail later.

---

# HIGH — should fix

## 5) Don't treat the local backend as a real confidential client
**Issue:**
This is a desktop app. The Bun/Hono backend ships with the app, so it is **not** a true trusted server boundary. A `GOOGLE_CLIENT_SECRET` in the app is not really secret.

**Recommendation:**
Rely on **PKCE** as the real defense. Treat the app as a **public native client**. If you use a client secret because Google gives you one, fine — but don't assume it provides meaningful protection.

---

## 6) Use the system browser explicitly, not `window.open()` if that can hit a webview
**Issue:**
Google OAuth for native apps should use an **external user-agent**, not an embedded webview.

**Recommendation:**
Use the Tauri shell/opener API explicitly to launch the default browser.
Do not rely on `window.open()` unless you are certain it opens the system browser in all packaged environments.

---

## 7) Token revocation handling is too aggressive as described
**Issue:**
"Catch 401/403 → attempt refresh → if fails, clear tokens" is too broad.

Many Google API `403`s are **not** auth failures:

- quota/rate-limit errors
- insufficientPermissions
- file not accessible via `drive.file`
- calendar/resource policy errors

If you clear tokens on any 403, you'll disconnect users incorrectly.

**Recommendation:**

Only clear stored tokens when you have a real auth failure, e.g.:

- refresh token exchange fails with `invalid_grant`
- token revoked/expired in a known OAuth sense

For Google API errors:

- `429` / `5xx` → retry/backoff
- `403 insufficientPermissions` → return a scope/permission error
- `403 rateLimitExceeded` / `userRateLimitExceeded` → retry/backoff
- `404` / access denied on resource → return resource error, do not disconnect

---

## 8) Verify identity properly; don't just decode/store `id_token`
**Issue:**
The plan says to store `user_email`, `user_name`, and `id_token` from the ID token.

**Problems:**

- If you use the ID token, you should **verify** it
- Storing `id_token` long-term is usually unnecessary
- Email is not the best stable identifier

**Recommendation:**

After token exchange, either:

- `verifyIdToken()` and extract claims, or
- call Google userinfo once

Store:

- `sub` (stable Google user ID)
- `email`
- `email_verified`
- `name`
- maybe `picture`

Avoid persisting `id_token` unless you have a real need.

---

## 9) Plain SQLite token storage is risky for these scopes
**Issue:**
These tokens can grant access to Gmail, Calendar, Drive, Docs. Plaintext storage in SQLite on disk is a meaningful local security risk.

**Recommendation:**

Best:
- store refresh token in OS keychain / platform secure storage / Tauri stronghold-like mechanism

At minimum:
- restrict DB file permissions to the current user
- redact tokens from logs
- avoid storing unnecessary token material
- consider encrypting sensitive columns if feasible

For a personal/local-only app this may be acceptable temporarily, but I would not call it ideal.

---

## 10) The current polling UX can't distinguish "waiting" from "denied" or "failed"
**Issue:**
Polling only `/api/google/status` every 3s means the frontend can detect "connected", but not:

- user denied consent
- callback failed
- state expired
- server restarted and lost state
- no refresh token returned
- wrong account selected

The UI will just time out.

**Recommendation:**

Introduce an **auth attempt ID**:

- `/oauth/authorize-url` returns `{ url, attemptId }`
- backend tracks attempt state: `pending | success | denied | expired | error`
- frontend polls `/oauth/attempt-status/:attemptId`

This also solves multi-window/race issues and gives much better UX.

At minimum, expose a temporary `lastAuthError`.

---

## 11) Docs API is not a simple `GET/PUT content` API
**Issue:**
`getDocContent` / `updateDocContent` is overly simplistic.

Google Docs content is structured; updates are done via **batchUpdate requests**, not simple full-document replacement. Also write concurrency matters.

**Recommendation:**

Define Docs support explicitly before coding routes. For example:

- read document structure
- flatten to plain text for display
- support only specific mutations:
  - append text
  - replace all text
  - insert text at index
  - batchUpdate passthrough (advanced)

If you want safe writes, consider using `writeControl.requiredRevisionId`.

I would not ship `PUT /docs/:id` until the semantics are nailed down.

---

## 12) Drive content download needs Google Workspace export logic
**Issue:**
`GET /drive/files/:id/content` is not one thing.

- Binary files → `files.get(..., alt=media)`
- Google Docs/Sheets/Slides → must use `files.export()`

**Recommendation:**

Define this route behavior up front:

- for native Google files, require `exportMimeType`
- stream downloads instead of buffering large files into memory
- support proper content type / content disposition

Also decide whether shared drives matter (`supportsAllDrives`, etc.).

---

## 13) Gmail message handling is more complex than the plan suggests
**Issue:**
`getMessage` is not just a JSON fetch if you need useful content.

You'll need to handle:

- MIME multipart parsing
- base64url decoding
- plain text vs HTML bodies
- attachments
- thread metadata

**Security angle:** if the frontend renders Gmail HTML, that is untrusted HTML. In a Tauri app, that can become an XSS problem.

**Recommendation:**

- Decide whether the backend returns:
  - plain text only
  - sanitized HTML
  - raw MIME/body parts
- If HTML is ever rendered in the desktop UI, sanitize aggressively

---

## 14) API routes need stronger contracts
**Issue:**
The route list is plausible, but too underspecified for implementation quality.

Missing details:

- pagination (`pageToken`, `nextPageToken`)
- result limits
- query validation
- default field projections
- upload format
- download streaming
- calendar IDs
- normalized error format

**Recommendation:**

Add explicit request/response contracts now. Example:

- `/gmail/messages?q=&pageToken=&maxResults=`
- `/calendar/events?calendarId=primary&timeMin=&timeMax=`
- `/drive/files?q=&pageToken=&pageSize=`
- standard error envelope:
  - `code`
  - `message`
  - `provider`
  - `retryable`
  - `needsReconnect`

Also use runtime validation, not TS types alone.

---

## 15) `/status` should be richer than "connected true/false"
**Issue:**
You need more than a boolean.

**Recommendation:**
Return something like:

- `configured`
- `connected`
- `account`
- `grantedScopes`
- `missingScopes`
- `expiresAt`
- `needsReauth`
- `lastError`

That becomes critical once scopes change or refresh tokens are lost/revoked.

---

## 16) Disconnect should revoke remotely, not only clear local DB
**Issue:**
A local "disconnect" that only deletes SQLite state leaves the app still authorized in Google.

**Recommendation:**
On disconnect:

1. call Google revoke endpoint with refresh token if available
2. clear DB
3. clear any cached auth clients/in-memory state

If remote revoke fails, still clear locally but surface that revoke was partial.

---

## 17) Code organization will get messy fast
**Issue:**
A single `routes/google.ts` plus single `services/google-api.ts` will become large and brittle.

**Recommendation:**

Split immediately into modules like:

- `routes/google-oauth.ts`
- `routes/google-gmail.ts`
- `routes/google-calendar.ts`
- `routes/google-drive.ts`
- `routes/google-docs.ts`

and

- `services/google/auth.ts`
- `services/google/gmail.ts`
- `services/google/calendar.ts`
- `services/google/drive.ts`
- `services/google/docs.ts`

Google is too broad to keep in one file cleanly.

---

## 18) Automated testing is missing
**Issue:**
The plan has only manual verification.

**Recommendation:** add tests for:

- PKCE generation
- callback rejects invalid/expired state
- refresh-token preservation on upsert
- missing refresh token on callback
- token revocation path
- error mapping (`invalid_grant` vs quota/403)
- `/status` with missing scopes
- Drive export behavior for Google-native files
- Docs mutation semantics

Mock Google endpoints; don't rely only on manual testing.

---

# LOW — nice to have, but worth doing

## 19) Add `include_granted_scopes=true` and consider `prompt=select_account`
Useful for scope evolution and account switching.

## 20) People API may be unnecessary
If you only need profile/email, verified ID token or userinfo is probably enough.

## 21) Consider moving callback outside `/api`
Not required, but it avoids special-case auth exemptions inside your main API namespace.

## 22) Store `sub` even if you keep singleton row
Even if you only support one connected account, stable provider identity is useful.

## 23) Consider removing auth code from browser history
A small inline callback script can `history.replaceState()` after success. Nice hardening/cleanup.

---

# Suggested plan changes

If I were revising the implementation plan, I'd change it like this:

## DB
Add fields:

- `google_sub`
- `email`
- `email_verified`
- `name`
- `picture` (optional)
- `access_token`
- `refresh_token`
- `expiry_date`
- `granted_scopes`
- `last_error`
- `updated_at`

I would **not** store `id_token` unless there is a real need.

## OAuth route
`GET /oauth/authorize-url` should:

- generate `state`
- generate PKCE verifier/challenge
- create `attemptId`
- store pending attempt with TTL
- use:
  - `access_type=offline`
  - conditional `prompt=consent`
  - maybe `prompt=select_account consent`
  - `include_granted_scopes=true`

`GET /oauth/callback` should:

- handle `error` explicitly
- validate `state`
- exchange code
- verify identity
- require/preserve refresh token correctly
- store granted scopes
- mark auth attempt success/failure
- return hardened HTML page

## Status / UX
Replace blind `/status` polling with attempt polling.

## Service layer
Split by API domain. Add robust error mapping and retry policy.

## Scopes
Revisit scopes before implementation. This is the biggest design issue.

---

# Final verdict

**Good architecture, incomplete plan.**
The main blockers are:

1. **Drive/Docs scope mismatch**
2. **refresh-token lifecycle**
3. **callback hardening on loopback**
4. **Google verification reality for Gmail scopes**

Fix those first, then the rest becomes normal implementation work.
