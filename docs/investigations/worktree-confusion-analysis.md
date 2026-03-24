# Worktree Confusion Analysis

Investigation date: 2026-03-23

## How Worktrees Are Set Up in This Project

This project uses two separate worktree systems:

1. **Claude Code agent worktrees** (`isolation: "worktree"` in Task tool) — placed at `.claude/worktrees/<name>/` inside the main repo directory. These are used by subagents for code-writing tasks.

2. **Application-level workspace worktrees** — the app itself manages git worktrees for "workspaces" via `WorktreeOrchestrator`. These are stored at `~/.claude-tauri/worktrees/<projectId>/<workspaceId>/`.

The golden `node_modules` cache lives at `~/.claude-tauri/golden/` and worktrees symlink their `node_modules` to it.

Currently 11+ agent worktrees exist under `.claude/worktrees/`.

---

## Issue 1: `process.cwd()` Is Wrong in Worktrees (CRITICAL)

**Affected files:**
- `apps/server/src/routes/instructions.ts` (lines 52, 77, 146) — uses `process.cwd()` as `projectRoot`
- `apps/server/src/routes/hooks.ts` (lines 67, 83) — uses `process.cwd()` for settings.json path
- `apps/server/src/routes/mcp.ts` (lines 54, 72) — uses `process.cwd()` for MCP config discovery
- `apps/server/src/routes/git.ts` (line 14) — uses `process.cwd()` as default git cwd
- `apps/server/src/routes/chat-helpers.ts` (line 137) — uses `process.cwd()` as fallback workspace root

**The problem:** When `init.sh` starts the server with `bun --watch apps/server/src/index.ts`, the server's `process.cwd()` is the repo root (set by `cd "$SCRIPT_DIR"` on line 19 of init.sh). In a worktree, the repo root is something like `.claude/worktrees/priceless-morse/`, which is correct.

However, `instructions.ts` uses `process.cwd()` to find `CLAUDE.md`, `.claude/CLAUDE.md`, and `.claude/rules/`. In a worktree, the `.claude/` directory may not exist or may have different content than the main repo. The `hooks.ts` similarly looks for `.claude/settings.json` relative to `process.cwd()`.

**Impact on agents:** An agent running in a worktree may not see the project's CLAUDE.md instructions, hook configurations, or MCP server configs. This could cause agents to behave differently or miss critical project rules.

---

## Issue 2: `import.meta.dir` Path Resolution Assumes Repo Structure (HIGH)

**Affected files:**
- `apps/server/src/routes/memory.ts` (line 11) — `resolve(import.meta.dir, '../../../..')`
- `apps/server/src/routes/plan.ts` (line 31) — same pattern

**The problem:** `import.meta.dir` resolves to the actual source file location. With golden symlinked `node_modules`, this works because source files are in the worktree. But if the server binary is compiled (`build:sidecar` in package.json), or if the source files are somehow resolved through the symlink chain, the 4-level parent traversal (`../../../..`) could land in the wrong directory.

In normal worktree usage (running from source with `bun --watch`), this is fine because the source files live in the worktree. But it's fragile.

---

## Issue 3: `.env` File Has Hardcoded PORT=3131 (HIGH)

**File:** `.env.example` (copied to `.env` on first run)

**The problem:** The `.env` file contains `PORT=3131`. When `init.sh` runs, it selects a random port (lines 56-57) and passes it via the `PORT` environment variable to the server process. However, the `.env` file is also copied into worktrees (line 156-162 of init.sh) with the hardcoded `PORT=3131`.

If a tool or process reads `.env` directly (e.g., `dotenv`), it could pick up `PORT=3131` instead of the dynamically assigned port. The `.init-state` file in the `priceless-morse` worktree confirms this mismatch:
- `.init-state` says `SERVER_URL=http://localhost:3366`
- `.env` says `PORT=3131`

**Impact:** If any code reads `.env` directly, it will get the wrong port.

---

## Issue 4: Stale `.init-state` Files in Worktrees (HIGH)

**File:** `.init-state` in each worktree

**The problem:** The `priceless-morse` worktree has an `.init-state` file pointing to `SERVER_PID=41402` and `FRONTEND_PID=41407`. These PIDs are almost certainly dead. There is no mechanism to detect stale `.init-state` files.

When an agent runs `source .init-state` to discover service URLs, it will get URLs pointing to dead processes. The agent will then make HTTP calls that fail silently or timeout.

**Cleanup gap:** The `cleanup-worktrees.sh` script only removes entire worktree directories older than 7 days. It does not clean up stale `.init-state` files in still-valid worktrees.

---

## Issue 5: Vite Config Has Hardcoded Port 1420 with strictPort: true (MEDIUM)

**File:** `apps/desktop/vite.config.ts` (lines 24-25)

```typescript
port: 1420,
strictPort: true,
```

**The problem:** The Vite config hardcodes port 1420 with `strictPort: true`, meaning Vite will fail to start if port 1420 is occupied. However, `init.sh` overrides this by passing `--port "$VITE_PORT" --strictPort false` (line 233), so in practice the random port is used.

But if someone runs `pnpm dev` directly (without `init.sh`), or if Tauri's `beforeDevCommand` runs `pnpm dev`, it will try port 1420 and fail if another worktree already took it. The Tauri config (`tauri.conf.json` line 8) also hardcodes `"devUrl": "http://localhost:1420"`.

---

## Issue 6: Tauri CSP Hardcodes localhost:3131 (MEDIUM)

**File:** `apps/desktop/src-tauri/tauri.conf.json` (line 23)

```
connect-src ipc: http://ipc.localhost http://localhost:3131
```

**The problem:** The Content Security Policy hardcodes `http://localhost:3131` as the only allowed connection target. When running in a worktree with a dynamic server port (e.g., 3366), Tauri's webview will block connections to the actual server.

This only matters for Tauri desktop builds, not web-only dev mode, but it means worktrees cannot run the full Tauri desktop app with dynamic ports.

---

## Issue 7: Post-Merge Hook Fails in Worktrees (MEDIUM)

**File:** `init.sh` lines 263-275

```bash
HOOK_PATH="$SCRIPT_DIR/.git/hooks/post-merge"
if [ -d "$SCRIPT_DIR/.git/hooks" ] && [ ! -f "$HOOK_PATH" ]; then
```

**The problem:** In a git worktree, `.git` is a file (not a directory), containing `gitdir: /path/to/main/.git/worktrees/<name>`. The check `[ -d "$SCRIPT_DIR/.git/hooks" ]` will fail because `.git` is a file, so the post-merge hook is never installed in worktrees.

This is actually benign (the golden cache is shared, so the main repo's hook handles it), but it could confuse agents that expect hooks to be present.

---

## Issue 8: Worktrees Are Inside `.claude/worktrees/` Which Is Inside the Repo (MEDIUM)

**The problem:** Claude Code agent worktrees are created at `.claude/worktrees/<name>/` which is *inside* the main repository directory. While `.claude/worktrees/` is in `.gitignore`, this nesting means:

1. **File watchers** (Vite, bun --watch) from the main repo may pick up changes in worktree directories, causing unnecessary rebuilds or confusion.
2. **Glob searches** from the main repo will traverse into worktree directories, finding duplicate files. The `golden-sync.sh` glob results showed 12 copies of the file across worktrees.
3. **Disk usage** is amplified since each worktree contains a full copy of the source tree.

---

## Issue 9: Shared SQLite Database Across All Worktrees (LOW-MEDIUM)

**File:** `apps/server/src/db/index.ts` (lines 6-7)

```typescript
const DB_DIR = process.env.DB_DIR || join(process.env.HOME || '~', '.claude-tauri');
const DB_PATH = process.env.DB_PATH || join(DB_DIR, 'data.db');
```

**The problem:** By default, all worktrees share the same SQLite database at `~/.claude-tauri/data.db`. This means:
- Multiple server instances from different worktrees will write to the same DB
- SQLite WAL mode handles concurrent reads but concurrent writes from multiple Bun processes can cause `SQLITE_BUSY` errors
- State from one worktree's agent session leaks into another's view

---

## Issue 10: `cleanup-worktrees.sh` Only Knows About Git Worktrees, Not Agent Worktrees (LOW)

**File:** `scripts/cleanup-worktrees.sh`

The cleanup script uses `git worktree list` which lists git worktrees registered with the main repo. However, Claude Code's agent worktrees (created via the Task tool with `isolation: "worktree"`) are also git worktrees and will show up in this list. The cleanup script could remove an active agent's worktree if it appears old based on directory modification time.

---

## Summary of Root Causes

| Issue | Root Cause | Severity |
|-------|-----------|----------|
| `process.cwd()` confusion | Server code assumes cwd = project root; correct in worktrees but `.claude/` config may not exist | CRITICAL |
| Stale `.init-state` | No liveness check on PID/port before trusting .init-state | HIGH |
| `.env` hardcoded PORT | Static .env conflicts with dynamic port allocation | HIGH |
| Vite/Tauri hardcoded ports | Config files assume fixed ports that conflict across worktrees | MEDIUM |
| Post-merge hook | `.git` is a file in worktrees, not a directory | MEDIUM |
| Nested worktree location | Worktrees inside main repo cause watcher/search interference | MEDIUM |
| Shared SQLite | All worktrees hit same DB, risking contention and data leaks | LOW-MEDIUM |

## Recommendations

1. **Add a liveness check to `.init-state` consumers.** Before trusting `.init-state`, check if the PIDs are alive and the ports respond. Add a `validate-init-state.sh` helper.

2. **Fix the `.env` PORT mismatch.** Either remove PORT from `.env.example` entirely (it's overridden by init.sh anyway), or have init.sh update `.env` with the dynamic port.

3. **Make `instructions.ts` and `hooks.ts` use `PROJECT_ROOT`** (like `memory.ts` already does) instead of `process.cwd()`. The `memory.ts` pattern of `process.env.PROJECT_ROOT ?? resolve(import.meta.dir, '../../../..')` is the right approach.

4. **Have `init.sh` set `PROJECT_ROOT` as an environment variable** when starting the server, so all server code has a consistent reference.

5. **Add PID/port validation to `init.sh stop`** and the cleanup script to handle stale state.

6. **Consider moving agent worktrees outside the repo** (e.g., to `~/.claude-tauri/agent-worktrees/`) to avoid file watcher and search interference.

7. **Consider per-worktree SQLite databases** for development isolation by setting `DB_PATH` to a worktree-specific path in init.sh.
