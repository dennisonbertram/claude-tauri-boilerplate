# Phase 7: Tauri Sidecar Integration

## Summary

Wired the Hono server as a Tauri sidecar so it starts automatically when the desktop app launches and stops when it closes. During development, the server runs separately via `pnpm dev:server`.

## What Changed

### Tauri Configuration
- **`apps/desktop/src-tauri/tauri.conf.json`**: Added `externalBin: ["binaries/server"]` to bundle section
- **`apps/desktop/src-tauri/capabilities/default.json`**: Added shell plugin permissions (`shell:allow-spawn`, `shell:allow-kill`, `shell:allow-stdin-write`)
- **`apps/desktop/src-tauri/Cargo.toml`**: Added `tauri-plugin-shell = "2"` dependency

### Rust Code
- **`apps/desktop/src-tauri/src/lib.rs`**: Registered `tauri_plugin_shell::init()`, removed unused `greet` command

### Frontend
- **`apps/desktop/src/lib/platform.ts`**: `isTauri()` helper that checks for `__TAURI__` global
- **`apps/desktop/src/lib/sidecar.ts`**: `startSidecar()`, `stopSidecar()`, `waitForServer()` functions using `@tauri-apps/plugin-shell`
- **`apps/desktop/src/App.tsx`**: On mount in Tauri mode, starts sidecar, waits for health check, shows loading/error states
- **`apps/desktop/package.json`**: Added `@tauri-apps/plugin-shell` dependency

### Build & Dev Scripts
- **`package.json`** (root):
  - `build:sidecar`: Compiles server to `apps/desktop/src-tauri/binaries/server-{target-triple}` using `bun build --compile`
  - `dev:all`: Runs server and desktop in parallel via `concurrently`

### Git
- **`.gitignore`**: Added `apps/desktop/src-tauri/binaries/` (compiled binaries should not be committed)

## How It Works

### Production (Tauri app)
1. `pnpm build:sidecar` compiles the Hono server into a standalone Bun binary
2. Binary is placed at `apps/desktop/src-tauri/binaries/server-{target-triple}`
3. Tauri bundles this binary via `externalBin`
4. On app launch, `App.tsx` detects Tauri environment and spawns the sidecar
5. `waitForServer()` polls `http://localhost:3131/api/health` until ready
6. On app close, the sidecar process is killed

### Development
1. Run `pnpm dev:all` (or `pnpm dev:server` + `pnpm dev` separately)
2. `isTauri()` returns false in the browser, so sidecar logic is skipped
3. Server runs independently on port 3131

## Naming Convention

Tauri v2 requires sidecar binaries to end with `-{target-triple}`:
- macOS ARM: `server-aarch64-apple-darwin`
- macOS Intel: `server-x86_64-apple-darwin`
- Linux: `server-x86_64-unknown-linux-gnu`
- Windows: `server-x86_64-pc-windows-msvc.exe`

The `externalBin` path in config does NOT include the suffix -- Tauri appends it automatically.
