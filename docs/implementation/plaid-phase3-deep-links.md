# Plaid Phase 3: Tauri Deep Link Setup

## Summary

Implemented the `claudetauri://` custom URI scheme deep link handler for the Plaid Hosted Link callback flow. This enables the Tauri desktop app to intercept `claudetauri://plaid-callback?state=...&public_token=...` URLs after the user completes bank authentication in their browser.

## Changes

### 1. `apps/desktop/src-tauri/Cargo.toml`
- Added `tauri-plugin-deep-link = "2"` (matches existing plugin version pattern)
- Added `url = "2"` for URL parsing in the deep link handler

### 2. `apps/desktop/src-tauri/tauri.conf.json`
- Added `plugins.deep-link.desktop.schemes` config registering the `claudetauri` URI scheme
- On macOS this registers the URL type in Info.plist; on Windows it creates a protocol handler registry entry; on Linux it adds the MimeType to the .desktop file

### 3. `apps/desktop/src-tauri/capabilities/default.json`
- Added `deep-link:default` permission so the frontend can receive deep link events
- Added `core:event:allow-listen` permission so the frontend can listen for custom events (`plaid-callback`)

### 4. `apps/desktop/src-tauri/src/lib.rs`
- Registered `tauri_plugin_deep_link::init()` in the plugin chain
- Added `DeepLinkState` struct with `Mutex<Option<String>>` to hold pending deep link URLs
- Added `get_pending_deep_link` Tauri command that returns-and-clears the pending URL (for cold-start handling where the deep link arrives before React mounts)
- Set up `deep-link://new-url` event listener in `setup()` that:
  - Parses the incoming URL(s) from the JSON payload
  - Validates each URL with the `url` crate
  - Stores the URL in `DeepLinkState` (for cold start retrieval)
  - Emits a `plaid-callback` event to the frontend (for warm start)

## Architecture

### Warm start (app already running)
1. User completes Plaid auth in browser
2. Browser redirects to `claudetauri://plaid-callback?state=...&public_token=...`
3. OS routes URL to the running Tauri app
4. Deep link plugin fires `deep-link://new-url` event
5. Our handler emits `plaid-callback` event to frontend
6. Frontend `listen("plaid-callback", ...)` receives it and calls `/api/plaid/link/finalize`

### Cold start (app not running)
1. OS launches the Tauri app with the deep link URL
2. Deep link plugin fires `deep-link://new-url` event during startup
3. Our handler stores URL in `DeepLinkState`
4. React mounts, calls `invoke("get_pending_deep_link")`
5. Gets the stored URL, calls `/api/plaid/link/finalize`

## Verification

- Rust code compiles cleanly with `cargo check --lib` (the sidecar binary missing error is a pre-existing worktree issue unrelated to these changes)
- All existing plugins remain registered and functional
- Version patterns match existing conventions (`"2"` for all Tauri plugins)

## Next Steps (Phase 4)

- Frontend deep link listener using `@tauri-apps/api/event` (`listen`) and `@tauri-apps/api/core` (`invoke`)
- `usePlaidCallback` hook that handles both warm and cold start scenarios
- `handlePlaidCallback()` function that extracts `state` and `public_token` from the URL and calls the finalize endpoint
