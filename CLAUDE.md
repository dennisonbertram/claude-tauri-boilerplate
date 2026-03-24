# Claude Tauri Boilerplate

## Dev Environment Setup

**Run `./init.sh` to get a fully working environment.** See [docs/runbook.md](docs/runbook.md) for full details.

- Ports are **random** by default — multiple worktrees run safely in parallel
- For subagents/worktrees: `INIT_DAEMONIZE=1 ./init.sh && source .init-state`
- Use `$SERVER_URL`, `$FRONTEND_URL`, `$HEALTH_CHECK` from `.init-state` — never hardcode ports
- Golden cache at `~/.claude-tauri/golden/` makes worktree installs <0.5s
- **`node_modules` are symlinks** — `init.sh` symlinks `node_modules` to the golden cache. Never use `git add -A` or `git add .` as this will commit the symlinks and break CI. Always stage specific files by name.
- Clean stale worktrees: `./scripts/cleanup-worktrees.sh`
- **Credentials are auto-detected**: local uses subscription auth (no keys), cloud requires `ANTHROPIC_API_KEY` from platform secrets. Never put secrets in `.env`.

## Monorepo Structure

- `apps/desktop` — Vite + React + Tauri frontend (port 1420, strictPort)
- `apps/server` — Hono + Bun backend with embedded SQLite (port 3131)
- `packages/shared` — Shared TypeScript types (raw TS, no build step)
- Package manager: **pnpm** workspaces
- Server runtime: **Bun** (required — uses `bun:sqlite`)

## Key Commands

```bash
pnpm dev:server          # Start backend only
pnpm dev                 # Start frontend only (Vite)
pnpm test                # Run all tests
pnpm -r build            # Build all packages
```

## Important Notes

- `.env` is created from `.env.example` on first `init.sh` run
- No external databases — SQLite is embedded in Bun at `~/.claude-tauri/data.db`
- Auth is skipped in dev mode (no `SIDECAR_BEARER_TOKEN` set)
- Do NOT set `ANTHROPIC_API_KEY` unless intentional — it overrides subscription auth
