# Issue #72: Export files download with hardcoded name

## Root Cause

`apps/server/src/app.ts` was missing `exposeHeaders: ['Content-Disposition']` in the
Hono `cors()` middleware config.  Without this, the browser silently blocks JavaScript
from reading the `Content-Disposition` response header via
`response.headers.get('content-disposition')`, which returns `null`.  The frontend fell
back to a hardcoded filename (`session-export.json` / `session-export.md`).

## Fix Applied

### `apps/server/src/app.ts`

Added `exposeHeaders: ['Content-Disposition']` to the cors options:

```diff
 app.use(
   '*',
   cors({
     origin: ['http://localhost:1420', 'tauri://localhost'],
     credentials: true,
+    exposeHeaders: ['Content-Disposition'],
   })
 );
```

### `apps/server/src/routes/sessions.ts`

No change needed.  Both export formats already set the header correctly:

- JSON: `attachment; filename="${safeTitle}.json"`
- Markdown: `attachment; filename="${safeTitle}.md"`

The `safeTitle` is derived from `session.title` with non-alphanumeric characters
replaced by `_` and truncated to 50 characters.

## Regression Tests Added

File: `apps/server/src/routes/sessions-management.test.ts`

Three new tests in the `CORS exposeHeaders regression (issue #72)` describe block:

1. **JSON export cross-origin** — sends `Origin: http://localhost:1420`, asserts that
   `Access-Control-Expose-Headers` contains `content-disposition`.

2. **Markdown export cross-origin** — same as above for `?format=md`.

3. **Session-specific filename** — asserts `Content-Disposition` contains the
   session-title-derived name (`My_Special_Session`) and does NOT contain the old
   hardcoded fallback `session-export`.

## Test Results

```
26 pass
0 fail
79 expect() calls
Ran 26 tests across 1 file. [57ms]
```

All 26 tests pass (23 pre-existing + 3 new).
