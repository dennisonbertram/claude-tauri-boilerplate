# Issue 264: Tauri Security Configuration Hardening Plan

## Current State Analysis

### CSP (`tauri.conf.json` > `app.security.csp`)
- **Currently set to `null`** -- CSP is completely disabled. This means the webview has no restrictions on script sources, style sources, connections, or any other content loading. This is the most permissive (and least secure) configuration possible.

### Capabilities (`capabilities/default.json`)
Current permissions:
```json
["core:default", "opener:default", "shell:allow-spawn", "shell:allow-kill", "shell:allow-stdin-write", "dialog:allow-open"]
```

### Shell Plugin Usage (sole consumer: `src/lib/sidecar.ts`)
| API Used | Permission Required | Purpose |
|----------|-------------------|---------|
| `Command.sidecar('binaries/server', ['--port', '3131'])` | `shell:allow-spawn` | Launch the bundled Express server sidecar |
| `sidecarProcess.kill()` | `shell:allow-kill` | Stop the sidecar on app teardown |

**Not used anywhere:**
- `stdin.write()` -- No code in the entire `apps/desktop/src/` tree calls `stdin.write`. The `shell:allow-stdin-write` permission is granted but never exercised.

### Rust Plugins Registered (`lib.rs`)
```rust
tauri_plugin_dialog::init()
tauri_plugin_shell::init()
tauri_plugin_opener::init()
```

### Sidecar Details
- Binary path: `binaries/server` (declared in `tauri.conf.json` > `bundle.externalBin`)
- Args: `['--port', '3131']`
- Communication: HTTP fetch to `http://localhost:3131/api/health` (and presumably other API endpoints)
- Lifecycle: started in `App.tsx` on mount, stopped on unmount

---

## Recommended Changes

### 1. Enable and Configure CSP

**Why:** `"csp": null` disables all content security protections. Any XSS vulnerability in the frontend could load arbitrary remote scripts, exfiltrate data, or inject malicious content.

**Recommended CSP (object form for readability):**
```json
"csp": {
  "default-src": "'self' customprotocol: asset:",
  "script-src": "'self'",
  "style-src": "'self' 'unsafe-inline'",
  "img-src": "'self' asset: http://asset.localhost blob: data:",
  "font-src": "'self' data:",
  "connect-src": "ipc: http://ipc.localhost http://localhost:3131",
  "media-src": "'self' blob:",
  "object-src": "'none'",
  "base-uri": "'self'",
  "form-action": "'self'",
  "frame-ancestors": "'none'"
}
```

**Key decisions:**
- `connect-src` includes `http://localhost:3131` because the frontend fetches from the sidecar server. Also includes `ipc:` and `http://ipc.localhost` for Tauri IPC.
- `script-src: 'self'` -- Tauri automatically injects nonces at compile time for bundled scripts, so no `'unsafe-inline'` or `'unsafe-eval'` needed.
- `style-src: 'unsafe-inline'` -- Required if using CSS-in-JS or inline styles (common in React apps). Could be removed if all styles are in CSS files.
- `object-src: 'none'` and `frame-ancestors: 'none'` -- Standard hardening directives.

**Risk:** If the app loads Google Fonts or other CDN resources, those domains must be added. Grep the codebase for external font/CDN imports before finalizing.

### 2. Remove `shell:allow-stdin-write` Permission

**Why:** This permission is granted but never used. No code in the frontend calls `stdin.write()` on any child process. The sidecar communicates exclusively over HTTP.

**Action:** Remove `"shell:allow-stdin-write"` from `capabilities/default.json`.

### 3. Scope Shell Permissions to the Specific Sidecar Binary

**Why:** The current `shell:allow-spawn` is an unscoped blanket permission that allows spawning *any* configured command. Tauri v2 best practice is to scope shell permissions to specific binaries with specific argument patterns.

**Recommended replacement:**
```json
{
  "identifier": "shell:allow-spawn",
  "allow": [
    {
      "name": "binaries/server",
      "sidecar": true,
      "args": ["--port", "3131"]
    }
  ]
}
```

This locks down spawn to only the `binaries/server` sidecar with the exact args `--port 3131`. If args need to be dynamic, use validators:
```json
"args": ["--port", { "validator": "^\\d{4,5}$" }]
```

### 4. Scope `shell:allow-kill` (Optional, Lower Priority)

The `kill` permission applies to any spawned child process. Since we only spawn one sidecar, this is acceptable as-is. No further scoping is available for `kill` in Tauri v2.

### 5. Review `dialog:allow-open`

**Current state:** Granted, allows opening file dialogs. This is likely needed for file attachment features.

**Action:** Keep as-is. If file dialogs are not used, remove it.

### 6. Review `opener:default`

**Current state:** Grants default opener permissions (opening URLs in system browser, etc.). This is a common and reasonable permission for desktop apps.

**Action:** Keep as-is.

---

## Updated `capabilities/default.json` (Target State)

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    {
      "identifier": "shell:allow-spawn",
      "allow": [
        {
          "name": "binaries/server",
          "sidecar": true,
          "args": ["--port", "3131"]
        }
      ]
    },
    "shell:allow-kill",
    "dialog:allow-open"
  ]
}
```

**Removed:** `shell:allow-stdin-write` (unused)
**Changed:** `shell:allow-spawn` from blanket string to scoped object with sidecar name and fixed args

---

## Tests and Assertions to Add

### 1. Static Configuration Assertions (CI / unit test)
- **CSP not null:** Assert that `tauri.conf.json` > `app.security.csp` is not `null` and is a non-empty object/string.
- **No blanket shell permissions:** Assert that `capabilities/default.json` does not contain bare `"shell:allow-spawn"` or `"shell:allow-execute"` strings (must be scoped objects).
- **No `stdin-write`:** Assert that `shell:allow-stdin-write` does not appear in capabilities.

### 2. Sidecar Smoke Test
- Verify `startSidecar()` still works after scoping the spawn permission to `binaries/server`.
- Verify `stopSidecar()` (kill) still works.
- Verify the health check at `http://localhost:3131/api/health` succeeds.

### 3. CSP Enforcement Test (Manual or E2E)
- Verify inline scripts without nonces are blocked.
- Verify `fetch()` to origins not in `connect-src` is blocked.
- Verify the app loads correctly with CSP enabled (no console CSP violation errors for legitimate resources).

---

## Risk Areas

| Risk | Severity | Mitigation |
|------|----------|------------|
| **CSP breaks app functionality** | Medium | Some React tooling or libraries may rely on `unsafe-eval` or load external resources. Must test thoroughly in dev and prod builds. Tauri auto-adds nonces for bundled scripts, but dynamic `eval()` or `new Function()` would break. |
| **Scoped args prevent future sidecar changes** | Low | If the sidecar port needs to change, the capability must be updated. Using a regex validator (`^\\d{4,5}$`) instead of a fixed string makes this more flexible. |
| **`unsafe-inline` in style-src** | Low | Many React apps need this for CSS-in-JS. Can be tightened later if all styles are extracted to CSS files. |
| **Dev mode CSP differences** | Medium | During `pnpm dev`, the frontend is served from `http://localhost:1420` via Vite. CSP may need to be more relaxed in dev. Tauri handles this somewhat, but test that HMR still works with CSP enabled. |
| **Missing connect-src domains** | Medium | If the app makes API calls to external services (Anthropic API, etc.) from the frontend, those must be added to `connect-src`. The sidecar proxies API calls, so this may not be needed, but verify. |

---

## Implementation Order

1. Remove `shell:allow-stdin-write` from capabilities (safe, no code changes)
2. Scope `shell:allow-spawn` to the sidecar binary (test sidecar still launches)
3. Enable CSP with the recommended directives (test full app functionality)
4. Add CI assertions for configuration integrity
5. Document CSP policy in project README or security docs

---

## Files to Modify

| File | Change |
|------|--------|
| `apps/desktop/src-tauri/tauri.conf.json` | Set `app.security.csp` from `null` to the recommended CSP object |
| `apps/desktop/src-tauri/capabilities/default.json` | Remove `shell:allow-stdin-write`, scope `shell:allow-spawn` |
| New test file (e.g., `apps/desktop/src/__tests__/tauri-security-config.test.ts`) | Add static assertions on config files |
