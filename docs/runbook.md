# Runbook — Claude Tauri Boilerplate

## Quick Start

```bash
./init.sh
```

This single command checks prerequisites, installs dependencies, starts backend + frontend, health-checks both, and prints the URLs. Works in the main repo, worktrees, and fresh clones.

## Port Allocation

**Ports are random by default.** Each `init.sh` invocation picks free ports automatically, so multiple worktrees/agents can run simultaneously without killing each other's processes.

- Server port: random in range 3100–3999
- Frontend port: random in range 1400–1999
- The frontend is told the server port via `VITE_API_PORT` env var

After startup, read `.init-state` to get the actual URLs:
```bash
source .init-state
echo $SERVER_URL    # http://localhost:3247
echo $FRONTEND_URL  # http://localhost:1583
```

## init.sh Modes

| Mode | Command | Behavior |
|------|---------|----------|
| **Foreground** (default) | `./init.sh` | Runs until Ctrl+C, kills services on exit |
| **Daemonize** | `INIT_DAEMONIZE=1 ./init.sh` | Starts services, writes `.init-state`, exits |
| **Keep running** | `INIT_KEEP_RUNNING=1 ./init.sh` | Services survive script exit |
| **Pin ports** | `INIT_SERVER_PORT=3131 INIT_VITE_PORT=1420 ./init.sh` | Use specific ports (kills existing if occupied) |

### For Subagents / Worktrees

```bash
INIT_DAEMONIZE=1 ./init.sh
source .init-state
# Now use $SERVER_URL, $FRONTEND_URL, $SERVER_PID, $FRONTEND_PID
```

### .init-state File

After `init.sh` runs, `.init-state` contains:
```
SERVER_URL=http://localhost:3131
SERVER_PID=12345
FRONTEND_URL=http://localhost:1420
FRONTEND_PID=12346
HEALTH_CHECK=http://localhost:3131/api/health
```

Source it to get variables: `source .init-state`

## Golden Directory (Fast Installs)

The golden directory at `~/.claude-tauri/golden/` caches a fully-installed `node_modules` tree. New worktrees symlink from it instead of running `pnpm install` (~0.3s vs ~4.5s).

### How It Works

1. `init.sh` hashes `pnpm-lock.yaml` and compares to `~/.claude-tauri/golden/.lockfile-hash`
2. If stale: runs `scripts/golden-sync.sh` to rebuild (~4s, rare)
3. If fresh: creates 3 symlinks (instant)

### Manual Rebuild

```bash
./scripts/golden-sync.sh
```

### Disable Golden (Use Direct Install)

Delete or rename `scripts/golden-sync.sh` — `init.sh` falls back to `pnpm install`.

## Environment Detection & Credentials

`init.sh` auto-detects whether it's running locally or in the cloud and handles credentials accordingly. **You never set secrets in `.env` or `.env.example`.**

### How It Works

| Environment | Detection | Auth Method |
|-------------|-----------|-------------|
| **Local** | `~/.claude` exists | Subscription auth (no key needed) |
| **Cloud** | `RAILWAY_ENVIRONMENT`, `FLY_APP_NAME`, `CODESPACE`, `GITPOD_WORKSPACE_ID`, `RENDER_SERVICE_ID`, or `CI` is set | `ANTHROPIC_API_KEY` from platform secrets |

### Local (Your Machine, Worktrees, Subagents)
- Uses Claude subscription auth — no API key needed
- If `ANTHROPIC_API_KEY` happens to be set (e.g. from `~/.zshrc`), `init.sh` **unsets it** for the app process to avoid overriding subscription auth
- All other env vars from your shell (`~/.zshrc`) are inherited automatically

### Cloud (Railway, Fly, Codespaces, etc.)
- `ANTHROPIC_API_KEY` is **required** — set it in your platform's secrets dashboard
- `init.sh` fails fast with a clear error if it's missing
- `.env.example` only contains non-secret defaults (`PORT`, `DB_DIR`)

### Adding Future Required Keys
In `init.sh`, add validation after the existing `ANTHROPIC_API_KEY` check:
```bash
if [ -z "${SOME_NEW_KEY:-}" ]; then
  err "SOME_NEW_KEY is required. Set it in your platform secrets."
  KEYS_MISSING=1
fi
```

## Prerequisites

| Tool | Min Version | Install |
|------|------------|---------|
| Node.js | 18+ | `curl -fsSL https://fnm.vercel.app/install \| bash && fnm install 22` |
| Bun | 1.0+ | `curl -fsSL https://bun.sh/install \| bash` |
| pnpm | 8+ | `npm install -g pnpm` |

## Worktree Cleanup

Stale worktrees accumulate disk space. Clean them up:

```bash
# Preview what would be removed
./scripts/cleanup-worktrees.sh --dry-run

# Remove worktrees older than 7 days (default)
./scripts/cleanup-worktrees.sh

# Remove worktrees older than 3 days
./scripts/cleanup-worktrees.sh --max-age-days 3
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Missing prerequisites (node, bun, or pnpm) |
| 2 | Server failed to start (timeout 15s) |
| 3 | Frontend failed to start (timeout 20s) |

## Troubleshooting

### Port Already in Use
`init.sh` auto-kills processes on ports 3131 and 1420. If it still fails, manually check:
```bash
lsof -i :3131
lsof -i :1420
```

### ANTHROPIC_API_KEY Warning
If set in your environment (even to an invalid value), it overrides subscription auth. Clear it:
```bash
unset ANTHROPIC_API_KEY
```

### Golden Directory Issues
If symlinked `node_modules` cause problems, delete and reinstall directly:
```bash
rm -f node_modules apps/desktop/node_modules apps/server/node_modules
pnpm install
```

### Server Starts but Health Check Fails
Check if the server port was overridden:
```bash
grep PORT .env
```
The health endpoint is `GET /api/health` — it returns `{"status":"ok"}`.

## Architecture

```
claude-tauri-boilerplate/
├── init.sh                        # Entry point — run this
├── scripts/
│   ├── golden-sync.sh             # Maintains golden node_modules cache
│   └── cleanup-worktrees.sh       # Prunes stale worktrees
├── apps/
│   ├── desktop/                   # Vite + React frontend (port 1420)
│   └── server/                    # Hono + Bun backend (port 3131)
├── packages/
│   └── shared/                    # Shared TypeScript types (no build step)
├── .init-state                    # Written by init.sh (gitignored)
└── .env                           # Created from .env.example if missing
```
