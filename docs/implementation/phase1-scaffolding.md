# Phase 1: Monorepo Scaffolding

**Date:** 2026-03-14
**Status:** Complete

## What Was Created

### Root workspace
- `pnpm-workspace.yaml` - defines `apps/*` and `packages/*` as workspace packages
- `package.json` - root workspace scripts (dev, dev:server, test, build)
- `tsconfig.base.json` - shared TypeScript config (ES2022, strict, bundler resolution)
- `.gitignore` - updated with node_modules, dist, target, Tauri gen, IDE files

### packages/shared
- Shared TypeScript types package (`@claude-tauri/shared`)
- Types: `AuthStatus`, `Session`, `Message`, `ChatRequest`
- No build step needed - consumed directly as `.ts` by bundlers

### apps/server (Hono + Bun)
- `@claude-tauri/server` package running on Bun
- Hono app with CORS configured for localhost:1420 and tauri://localhost
- Health endpoint at `GET /api/health` returning `{ status: 'ok' }`
- Port: 3131 (configurable via PORT env var)
- Empty placeholder directories for routes/, services/, db/
- Dependencies: hono, @anthropic-ai/claude-agent-sdk, @ai-sdk/provider-utils, zod

### apps/desktop (Tauri v2 + React + Vite)
- `@claude-tauri/desktop` package scaffolded with `create-tauri-app` (react-ts template)
- Tailwind CSS v4 integrated via `@tailwindcss/vite` plugin
- Simple Hello World App.tsx with Tailwind styling
- Window: 1200x800, identifier: `com.claude-tauri.app`
- Vite dev server on port 1420
- Empty component directories: chat/, auth/, sessions/, hooks/
- Tauri v2 with Rust backend (src-tauri/)

## Decisions Made

1. **Tailwind v4** (CSS-based, not config-based) - uses `@import "tailwindcss"` in CSS and the `@tailwindcss/vite` plugin. No `tailwind.config.ts` needed.
2. **No shadcn/ui yet** - deferred to a later phase when UI components are actually needed.
3. **Zod v3** added to server - both `@ai-sdk/provider-utils` and `claude-agent-sdk` need zod. The SDK wants v4 but v3 works at runtime. This is a known peer dep conflict that doesn't affect functionality.
4. **Bun for server runtime**, pnpm for workspace management - as specified.
5. **.gitkeep files** used for empty directories instead of placeholder .ts files to keep the tree clean.

## Verification

- `pnpm install` - succeeds (peer dep warnings for zod only)
- `bun run apps/server/src/index.ts` - starts on port 3131, `/api/health` returns `{"status":"ok"}`
- `tsc --noEmit` in desktop - passes with no errors
- `vite build` in desktop - builds successfully (193KB JS, 5.5KB CSS)
