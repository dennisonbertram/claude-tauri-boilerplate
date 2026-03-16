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
pnpm install
```

Always use `pnpm install` from the root. Never run `bun install` inside a sub-package — it will corrupt the pnpm workspace hoisting.

## Running (web dev mode)

The fastest way to iterate — runs the app in your browser without building the Tauri shell:

```bash
# Terminal 1 — backend
pnpm dev:server

# Terminal 2 — frontend
pnpm dev

# Or both at once
pnpm dev:all
```

- Frontend: http://localhost:1420
- Backend API: http://localhost:3131

## Running (Tauri desktop app)

```bash
pnpm --filter @claude-tauri/desktop tauri dev
```

This builds the Rust shell and launches the native window. Requires Rust installed.

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
