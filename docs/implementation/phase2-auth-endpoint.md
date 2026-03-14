# Phase 2: Auth Endpoint

## Overview

Auth status endpoint that detects whether the user has a valid Claude Code subscription by probing the Claude Agent SDK with subscription-based auth.

## Architecture

### Service Layer (`apps/server/src/services/auth.ts`)

`getAuthStatus()` calls `query()` from `@anthropic-ai/claude-agent-sdk` with a minimal prompt (`"OK"`) and `maxTurns: 1`. It listens for the `system/init` event which contains `accountInfo` (email, plan).

Key behaviors:
- **Clears `ANTHROPIC_API_KEY`** before calling `query()` to force subscription auth detection. The key is restored in a `finally` block.
- **10-second timeout** via `Promise.race` — if the SDK hangs, the endpoint returns auth failure rather than blocking forever.
- **Graceful error handling** — if `query()` throws (e.g., CLI not installed), returns `{ authenticated: false, error: "..." }`.

### Route Layer (`apps/server/src/routes/auth.ts`)

Single endpoint: `GET /api/auth/status`

Returns JSON matching the `AuthStatus` type from `@claude-tauri/shared`:
```typescript
interface AuthStatus {
  authenticated: boolean;
  email?: string;
  plan?: string;
  error?: string;
}
```

### Wiring (`apps/server/src/app.ts`)

Route is mounted via `app.route('/api/auth', authRouter)`.

## Test Coverage

8 tests in `apps/server/src/routes/auth.test.ts`:

| Test | What it verifies |
|------|-----------------|
| Authenticated user | Returns `authenticated: true` with email and plan |
| query() throws | Returns `authenticated: false` with error message |
| Async generator throws | Returns `authenticated: false` with error message |
| Missing email | Returns `authenticated: true` with plan only |
| No init event | Returns `authenticated: false` with "No authentication info received" |
| 10s timeout | Returns `authenticated: false` with timeout error, resolves in ~10s not 30s |
| Route 200 (auth) | HTTP 200 with authenticated JSON body |
| Route 200 (unauth) | HTTP 200 with unauthenticated JSON body |

## Files

- `apps/server/src/services/auth.ts` — auth detection service
- `apps/server/src/routes/auth.ts` — Hono route handler
- `apps/server/src/routes/auth.test.ts` — test suite (8 tests)
- `apps/server/src/app.ts` — updated to mount auth route
- `packages/shared/src/types.ts` — `AuthStatus` type (pre-existing)
