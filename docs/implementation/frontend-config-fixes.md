# Frontend Config: Remove Hardcoded Ports

**Date**: 2026-03-23

## Changes Made

### 1. `apps/desktop/vite.config.ts`
- **Port**: Changed from hardcoded `1420` to `parseInt(process.env.VITE_PORT || '1420')`
- **strictPort**: Changed from `true` to `false` so Vite falls back to the next available port if busy (init.sh already passes `--strictPort false` via CLI, now the config file matches)
- **HMR port**: Changed from hardcoded `1421` to `parseInt(process.env.VITE_HMR_PORT || '1421')`

### 2. `apps/desktop/src-tauri/tauri.conf.json`
- **CSP connect-src**: Changed `http://localhost:3131` to `http://localhost:*` to allow connections to any localhost port (needed when init.sh assigns random server ports)

### 3. `apps/desktop/src-tauri/tauri.conf.json` — devUrl
- `devUrl` remains `http://localhost:1420` as a default. Tauri's JSON config does not support env var interpolation. This is acceptable because:
  - `init.sh` runs Vite directly (not via `tauri dev`), so `devUrl` is unused in the init.sh flow
  - When running `tauri dev` directly, port 1420 is the expected default

### 4. `apps/desktop/src/lib/api-config.ts` — No changes needed
- Already reads `VITE_API_PORT` from environment: `import.meta.env.VITE_API_PORT || '3131'`
- Falls back to 3131 only if no env var is set
- `setSidecarConfig()` overrides at runtime when the Tauri sidecar starts

## Summary
All hardcoded ports in frontend config files now read from environment variables with sensible defaults. The `init.sh` script already sets `VITE_PORT` and `VITE_API_PORT`, so random-port workflows work correctly.
