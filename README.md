# Claude Tauri Boilerplate

A desktop app boilerplate for building Claude-powered coding tools. Ships with multi-session chat, git worktree workspaces, and a full streaming backend.

## Stack

| Layer | Tech |
|-------|------|
| Desktop shell | Tauri v2 (Rust) |
| Frontend | React 19 + Vite + Tailwind v4 |
| Backend | Hono + Bun |
| AI | `@anthropic-ai/claude-agent-sdk` |
| DB | SQLite (via `bun:sqlite`) |
| Monorepo | pnpm workspaces |

## Prerequisites

- [pnpm](https://pnpm.io) — package manager (`npm i -g pnpm`)
- [Bun](https://bun.sh) v1.3+ — server runtime and test runner
- [Rust](https://rustup.rs) — required for Tauri (`rustup install stable`)
- A Claude subscription (Max or Pro) — the app uses subscription auth, not an API key

> **Important:** Do not set `ANTHROPIC_API_KEY` in your environment. The app authenticates via your Claude subscription through the SDK. If the env var is set it will bill against your API key balance instead.

## Setup

```bash
git clone https://github.com/dennisonbertram/claude-tauri-boilerplate
cd claude-tauri-boilerplate
./init.sh
```

`./init.sh` is the supported bootstrap entrypoint. It checks prerequisites, installs workspace dependencies with `pnpm install --frozen-lockfile`, creates `.env` if needed, starts the backend and frontend, and writes `.init-state` with the live URLs.

Never run `bun install` inside a sub-package — it will corrupt the pnpm workspace hoisting.

## Running (web dev mode)

The supported way to run the web app is through `init.sh`:

```bash
./init.sh
```

This starts both services, health-checks them, and prints the assigned URLs. By default it picks free ports so multiple worktrees can run at once without colliding.

For background/worktree usage:

```bash
INIT_DAEMONIZE=1 ./init.sh
source .init-state

echo "$SERVER_URL"
echo "$FRONTEND_URL"
```

To stop a daemonized environment:

```bash
./init.sh stop
```

If you need fixed ports for a tool that cannot read `.init-state`:

```bash
INIT_SERVER_PORT=3131 INIT_VITE_PORT=1420 ./init.sh
```

## Running (Tauri desktop app)

```bash
pnpm --filter @claude-tauri/desktop tauri dev
```

This builds the Rust shell and launches the native window. Requires Rust installed. For browser-based iteration and worktree-safe startup, prefer `./init.sh`.

## Tests

```bash
pnpm test
```

Runs all test suites across the monorepo using Bun's test runner.

## Building

**Web build:**
```bash
pnpm build
```

**Tauri desktop app:**
```bash
pnpm --filter @claude-tauri/desktop tauri build
```

**Sidecar binary** (embeds the server inside the Tauri app):
```bash
pnpm build:sidecar
```

## Project Structure

```
apps/
  desktop/          # React frontend (Vite + Tailwind)
    src/
      components/   # UI components
      hooks/        # React hooks
      contexts/     # React context providers
      lib/          # Utilities (platform detection, sidecar mgmt)
    src-tauri/      # Rust/Tauri shell
  server/           # Hono/Bun backend
    src/
      routes/       # API route handlers
      services/     # Business logic (claude, auth, auto-namer)
      db/           # SQLite schema and queries
packages/
  shared/           # Shared TypeScript types
```

## Auth

Authentication is handled automatically via `@anthropic-ai/claude-agent-sdk`. On first run, the SDK will prompt you to authenticate via your Claude account (same as `claude` CLI auth). No API key needed.
