# App Run Test — 2026-03-24

## Summary

Successfully started the Claude Tauri boilerplate app using the prescribed `init.sh` workflow from the worktree at `hopeful-stonebraker`.

## Results

| Check | Result |
|---|---|
| `init.sh` exists and is executable | Yes (`-rwxr-xr-x`, 11504 bytes) |
| Backend started | Yes |
| Frontend started | Yes |
| Health check passes | Yes (`{"status":"ok"}`) |
| Frontend responds | Yes (HTTP 200) |

## Allocated Ports

| Service | Port | URL |
|---|---|---|
| Server (Hono + Bun) | **3457** | http://localhost:3457 |
| Frontend (Vite + React) | **1749** | http://localhost:1749 |
| Health check | — | http://localhost:3457/api/health |

## Startup Sequence

1. **Port allocation**: Random ports assigned (server=3457, frontend=1749)
2. **Prerequisites check**: node v22.21.1, bun 1.3.5, pnpm 10.18.1 — all passed
3. **Auth mode**: Local/subscription auth (no `SIDECAR_BEARER_TOKEN` set)
4. **Dependency install**: pnpm install completed in ~5.3s
5. **Server start**: Hono server ready on port 3457 (pipeline worker polling every 15s)
6. **Frontend start**: Vite v7.3.1 ready in ~893ms
7. **Daemonized**: State written to `.init-state`

## Approximate Startup Time

~8-10 seconds total (5.3s for deps + ~1s server + ~1s frontend + overhead).

## Errors / Issues

**None.** Clean startup with no warnings or errors. Both services verified healthy via HTTP checks.

## Process Details

- `SERVER_PID=29691`
- `FRONTEND_PID=29698`
- State file: `.init-state` (sourced for env vars)

## Notes

- The golden cache at `~/.claude-tauri/golden` was stale and was automatically removed during startup.
- Ports are randomized per worktree to avoid collisions — this is working as designed.
- To stop services: `./init.sh stop`
