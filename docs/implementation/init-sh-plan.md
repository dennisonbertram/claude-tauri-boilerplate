# `init.sh` — Zero-Effort Dev Environment Bootstrap

## Goal
A single script any agent (subagent, worktree, cloud VM) runs to get a fully working dev environment — backend + frontend — with zero manual intervention.

## Project Context
- **Monorepo**: pnpm workspaces — `apps/desktop` (Vite+React, port 1420), `apps/server` (Hono+Bun, port 3131), `packages/shared` (raw TS)
- **Backend runtime**: Bun (uses `bun:sqlite` — embedded, no external DB)
- **No external services** required — SQLite auto-creates on first run
- **No Tauri/Rust needed** for dev mode (only desktop builds)

---

## Phases

### Phase 1: Preamble
```bash
#!/usr/bin/env bash
set -euo pipefail
```
- `SCRIPT_DIR` via `$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)` — works in worktrees
- Default ports: `SERVER_PORT=3131`, `VITE_PORT=1420`
- Accept overrides: `INIT_SERVER_PORT`, `INIT_VITE_PORT`
- Cleanup trap: `trap cleanup EXIT` kills background processes on failure

### Phase 2: Prerequisite Checks
Check for and report missing tools with install commands:

| Tool | Min Version | Install Command |
|------|------------|----------------|
| Node.js | >=18 | `curl -fsSL https://fnm.vercel.app/install \| bash && fnm install 22` |
| Bun | >=1.0 | `curl -fsSL https://bun.sh/install \| bash` |
| pnpm | >=8 | `npm install -g pnpm` or `corepack enable` |

Exit code 1 if any missing.

### Phase 3: Port Conflict Resolution
Follow the existing convention from the per-app `dev` scripts:
```bash
lsof -ti :$PORT | xargs kill 2>/dev/null || true
```
- Kill existing processes on 3131 and 1420 (matches existing `dev:server` / `dev` patterns)
- Vite has `strictPort: true` — can't just pick another port without config changes

### Phase 4: Environment Setup
1. Copy `.env.example` → `.env` if `.env` doesn't exist
2. If `.env.example` also missing (worktree edge case), create minimal `.env` with `PORT=<SERVER_PORT>`
3. Do NOT set `SIDECAR_BEARER_TOKEN` — dev mode skips auth intentionally
4. Warn if `ANTHROPIC_API_KEY` is set in environment (it overrides subscription auth)

### Phase 5: Dependency Installation
```bash
cd "$SCRIPT_DIR"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
```
- Try frozen-lockfile first (fast), fall back to regular install
- `packages/shared` needs no build (raw TS exports)

### Phase 6: Start Backend
```bash
PORT=$SERVER_PORT bun --watch apps/server/src/index.ts &
SERVER_PID=$!
```
- Health check: poll `http://localhost:$SERVER_PORT/api/health` every 0.5s, timeout 15s
- Exit code 2 on failure

### Phase 7: Start Frontend
```bash
cd "$SCRIPT_DIR/apps/desktop"
npx vite --port "$VITE_PORT" &
VITE_PID=$!
```
- Poll `http://localhost:$VITE_PORT` until ready, timeout 20s
- Exit code 3 on failure

### Phase 8: Output Summary (Machine-Readable)
Print structured block for agents to parse:
```
========================================
  CLAUDE-TAURI DEV ENVIRONMENT READY
========================================
SERVER_URL=http://localhost:3131
SERVER_PID=12345
FRONTEND_URL=http://localhost:1420
FRONTEND_PID=12346
HEALTH_CHECK=http://localhost:3131/api/health
========================================
```
Write to `.init-state` file (gitignored) so other scripts can `source .init-state`.

### Phase 9: Cleanup Trap
```bash
cleanup() {
  if [ "${INIT_KEEP_RUNNING:-}" != "1" ]; then
    kill $SERVER_PID 2>/dev/null || true
    kill $VITE_PID 2>/dev/null || true
  fi
}
```
Set `INIT_KEEP_RUNNING=1` to leave processes running after script exits.

### Phase 10: Wait or Daemonize
```bash
if [ "${INIT_DAEMONIZE:-}" = "1" ]; then
  disown $SERVER_PID $VITE_PID
  exit 0
fi
wait  # Default: foreground, Ctrl+C to stop
```

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `INIT_SERVER_PORT` | 3131 | Override backend port |
| `INIT_VITE_PORT` | 1420 | Override frontend port |
| `INIT_DAEMONIZE` | 0 | `1` = background processes and exit |
| `INIT_KEEP_RUNNING` | 0 | `1` = don't kill processes on script exit |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Missing prerequisites |
| 2 | Server failed to start |
| 3 | Frontend failed to start |

## Worktree Handling
- Detect worktree: `.git` is a file (not directory)
- `pnpm install` handles missing `node_modules`
- All paths use `$SCRIPT_DIR`, never assume cwd

## Cloud/Remote Handling
- Phase 2 prerequisite check gives clear install commands
- No macOS-specific deps needed for dev mode
- SQLite embedded in Bun — no DB install
- No Docker required

## Files to Create/Modify
1. **Create** `init.sh` at repo root
2. **Add** `.init-state` to `.gitignore`
