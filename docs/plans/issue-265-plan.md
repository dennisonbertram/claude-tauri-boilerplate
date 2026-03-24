# Issue #265: Sidecar Transport Security — Random Port + Bearer Token

## Current Architecture

### How the sidecar starts
`apps/desktop/src/lib/sidecar.ts` spawns the server binary with a **hardcoded** `--port 3131` argument (line 20). The `waitForServer()` function polls `http://localhost:3131/api/health` (line 59) until the server responds.

### How the server reads port config
`apps/server/src/index.ts` (line 3): `const port = parseInt(process.env.PORT || '3131')` — already supports dynamic port via `PORT` env var or CLI arg.

### How the server accepts requests
`apps/server/src/app.ts` applies CORS with `origin: ['http://localhost:1420', 'tauri://localhost']` (line 44). There is **no authentication middleware** — any process on the machine can hit the sidecar API.

### How the frontend talks to the server
Every file defines its own `const API_BASE = 'http://localhost:3131'` — there is **no centralized API client or base URL module**.

---

## Files Referencing Port 3131 or Base URL

### Source files (require changes)

| File | Line(s) | Pattern |
|------|---------|---------|
| `apps/desktop/src/lib/sidecar.ts` | 20, 59 | `'--port', '3131'` and `fetch('http://localhost:3131/api/health')` |
| `apps/desktop/src/hooks/useAuth.ts` | 4 | `const API_BASE = 'http://localhost:3131'` |
| `apps/desktop/src/hooks/useSessions.ts` | 6 | `const API_BASE = 'http://localhost:3131'` |
| `apps/desktop/src/hooks/useTeams.ts` | 10 | `const API_BASE = 'http://localhost:3131'` |
| `apps/desktop/src/hooks/useMcpServers.ts` | 3 | `const API_BASE = 'http://localhost:3131'` |
| `apps/desktop/src/hooks/useCheckpoints.ts` | 5 | `const API_BASE = 'http://localhost:3131'` |
| `apps/desktop/src/hooks/useContextSummary.ts` | 4 | `const API_BASE = 'http://localhost:3131'` |
| `apps/desktop/src/components/chat/ChatPage.tsx` | 59 | `const API_BASE = 'http://localhost:3131'` |
| `apps/desktop/src/components/StatusBar.tsx` | 7 | `const API_BASE = 'http://localhost:3131'` |
| `apps/desktop/src/components/GitStatusBar.tsx` | 4 | `const API_BASE = 'http://localhost:3131'` |
| `apps/desktop/src/components/settings/HooksPanel.tsx` | 4 | `const API_BASE = 'http://localhost:3131'` |
| `apps/desktop/src/components/settings/MemoryPanel.tsx` | 5 | `const API_BASE = 'http://localhost:3131'` |
| `apps/desktop/src/components/settings/McpPanel.tsx` | 4 | `const API_BASE = 'http://localhost:3131'` |
| `apps/desktop/src/components/settings/InstructionsPanel.tsx` | 4 | `const API_BASE = 'http://localhost:3131'` |
| `apps/desktop/src/lib/workspace-api.ts` | 21 | `const API_BASE = 'http://localhost:3131'` |
| `apps/desktop/src/lib/agent-profile-api.ts` | 7 | `const API_BASE = 'http://localhost:3131'` |
| `apps/desktop/src/lib/linear-api.ts` | 1 | `const API_BASE = 'http://localhost:3131'` |
| `apps/desktop/src/lib/workflowPrompts.ts` | 20 | `const API_BASE = 'http://localhost:3131'` |
| `apps/server/src/index.ts` | 3 | `process.env.PORT \|\| '3131'` |
| `apps/server/src/app.ts` | 44 | CORS origin list (needs dynamic port) |

### Test files (require updates to match new patterns)

| File | Lines |
|------|-------|
| `apps/desktop/src/lib/workflowPrompts.test.ts` | 85, 99, 154, 156, 159, 162, 237, 247, 251, 255, 265 |
| `apps/desktop/src/hooks/useSessions.test.ts` | 82, 143, 163, 171, 196 |
| `apps/desktop/src/hooks/useSettings.test.ts` | 367 |
| `apps/desktop/src/components/chat/__tests__/ChatPage.chat-transport.test.tsx` | 259 |
| `apps/desktop/src/components/chat/__tests__/ChatPageTransport.test.tsx` | 283 |
| `apps/desktop/src/components/__tests__/MemoryPanel.test.tsx` | 23, 42, 43 (content strings, not URLs) |
| `apps/server/src/routes/linear.test.ts` | 22, 43 |

### Existing API client modules (all define their own `API_BASE`)

- `apps/desktop/src/lib/workspace-api.ts` — workspace CRUD
- `apps/desktop/src/lib/agent-profile-api.ts` — agent profile CRUD
- `apps/desktop/src/lib/linear-api.ts` — Linear integration
- `apps/desktop/src/lib/workflowPrompts.ts` — workflow/memory helpers

None of these share a base URL module. Each redeclares `const API_BASE = 'http://localhost:3131'`.

---

## Recommended Implementation Plan

### Phase 1: Centralized API config module (frontend)

**New file:** `apps/desktop/src/lib/api-config.ts`

```ts
// Singleton — port and token are set once by sidecar.ts at startup
let _baseUrl = 'http://localhost:3131'; // fallback for dev
let _bearerToken = '';

export function setSidecarConfig(port: number, token: string) {
  _baseUrl = `http://localhost:${port}`;
  _bearerToken = token;
}

export function getApiBase(): string {
  return _baseUrl;
}

export function getAuthHeaders(): Record<string, string> {
  return _bearerToken
    ? { Authorization: `Bearer ${_bearerToken}` }
    : {};
}

/** Convenience: fetch with auth headers pre-applied */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith('http') ? path : `${_baseUrl}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...init?.headers,
    },
  });
}
```

### Phase 2: Random port selection in sidecar.ts

Modify `apps/desktop/src/lib/sidecar.ts`:

1. **Generate a random port** (e.g., 49152-65535 range) and a crypto-random bearer token at startup.
2. Pass both to the sidecar binary: `Command.sidecar('binaries/server', ['--port', String(port), '--token', token])`.
3. Call `setSidecarConfig(port, token)` before `waitForServer()`.
4. Update `waitForServer()` to use `getApiBase()` + auth headers.

### Phase 3: Server-side bearer token middleware

**New file:** `apps/server/src/middleware/bearer-auth.ts`

1. Server reads `--token` from CLI args (or `SIDECAR_TOKEN` env var).
2. If a token is configured, middleware checks `Authorization: Bearer <token>` on every request.
3. Health endpoint (`/api/health`) can optionally remain open for the startup poll, OR the poll can include the token.
4. Mount as global middleware in `apps/server/src/app.ts` before route registration.

Also update `apps/server/src/index.ts` to parse `--token` from args.

### Phase 4: Replace all hardcoded API_BASE declarations

For each of the **18 source files** listed above:
1. Remove the local `const API_BASE = 'http://localhost:3131'` declaration.
2. Import `{ getApiBase }` or `{ apiFetch }` from `../lib/api-config`.
3. Replace `fetch(\`${API_BASE}/...\`)` calls with `apiFetch('/api/...')` or use `getApiBase()`.

Special cases:
- **ChatPage.tsx** uses Vercel AI SDK's `useChat({ api: ... })` — pass `getApiBase() + '/api/chat'` and add `headers: getAuthHeaders()` to the config.
- **workflowPrompts.ts** has many fetch calls — convert all to `apiFetch()`.

### Phase 5: CORS update

In `apps/server/src/app.ts`, the CORS origin list currently hardcodes `http://localhost:1420`. With a random port, the sidecar server's CORS config needs to also accept the dynamic origin. Since the desktop app connects from `localhost:1420` (Vite dev) or `tauri://localhost` (production), CORS origins don't need the server port — they need the **frontend** origin. This should remain as-is; the bearer token provides the actual security.

### Phase 6: Update tests

All test files referencing `http://localhost:3131` need to either:
- Import from `api-config.ts` and use `getApiBase()`.
- Mock the config module in test setup.

---

## Risk Areas

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Port collision** | Medium | Use OS ephemeral port range (49152-65535) with retry on EADDRINUSE. Or let the OS pick port 0 and read back the actual port. |
| **Token leak in logs** | Medium | `sidecar.ts` already redacts `Bearer [REDACTED]` in log output (line 10). Ensure token is also redacted if passed as CLI arg (visible in process list). Consider passing via env var instead of CLI arg. |
| **Race condition on startup** | Low | `setSidecarConfig()` must be called before any component renders and fires fetch calls. Currently `startSidecar()` is called early in app init — ensure config is set synchronously in the same flow. |
| **SSE/streaming connections** | Medium | `ChatPage.tsx` uses Vercel AI SDK streaming. Verify the SDK passes custom headers on the initial POST and any subsequent requests. |
| **Dev mode convenience** | Low | In `pnpm dev` (server started separately), devs need a way to specify port/token. Fallback: if no token is set, skip auth (dev-only). |
| **Multiple Tauri windows** | Low | If multiple windows share the same sidecar, they all need the same port+token. Since `sidecar.ts` is a singleton module, this should work naturally. |
| **Process list exposure** | High | `--token <secret>` in CLI args is visible via `ps aux`. **Strongly recommend passing token via env var** (`SIDECAR_BEARER_TOKEN`) instead of CLI arg. Tauri's `Command.sidecar()` supports setting env vars. |

---

## File Change Summary

| Category | Count | Files |
|----------|-------|-------|
| New files | 2 | `api-config.ts`, `bearer-auth.ts` |
| Source files modified | 18 | All `API_BASE` declarations + `sidecar.ts` + `app.ts` + `index.ts` |
| Test files modified | ~7 | All test files referencing `localhost:3131` |
| **Total** | **~27** | |
