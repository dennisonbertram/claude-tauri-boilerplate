# Claude Tauri Boilerplate

## CRITICAL: Dev Server Rules (MANDATORY — NO EXCEPTIONS)

**`init.sh` is the ONLY way to start dev servers. There are NO alternatives. A PreToolUse hook enforces this — violations are automatically blocked.**

### FORBIDDEN commands (will be blocked by hook):
- `pnpm dev` — KILLS other worktrees' frontends and uses hardcoded ports
- `pnpm dev:server` — uses hardcoded port, collides with other worktrees
- `bun run apps/server/...` or `bun --watch apps/server/...` — bypasses port allocation
- `npx vite` / `pnpm exec vite` — bypasses port allocation
- `lsof -ti :1420 | xargs kill` or `:3131` — kills other worktrees' processes
- `pnpm add`, `pnpm install`, `npm install`, `yarn` — use init.sh for deps
- Hardcoding fixed ports in normal workflows (including 1420, 3131) defeats worktree isolation; use `init.sh` + `.init-state` instead (or set explicit `INIT_*` ports intentionally)
- Manually editing `.env` to set PORT or VITE_PORT

### REQUIRED startup procedure (the ONLY correct way):
```bash
# In worktrees/subagents:
INIT_DAEMONIZE=1 ./init.sh && source .init-state

# Then use ONLY these variables:
$SERVER_URL      # e.g. http://localhost:3847
$FRONTEND_URL    # e.g. http://localhost:1623
$HEALTH_CHECK    # e.g. http://localhost:3847/api/health

# To stop:
./init.sh stop
```

### Worktree bootstrap rule
- If you create a worktree manually, run `./init.sh` immediately after checkout before any tests or browser work.
- Do not rely on a separate install step; `init.sh` is the bootstrap entrypoint for every worktree.

### Before starting, ALWAYS check if services are already running:
```bash
if [ -f .init-state ]; then
    source .init-state
    if curl -sf "$HEALTH_CHECK" > /dev/null 2>&1; then
        echo "Services already running at $SERVER_URL"
        # USE the existing services — do NOT start new ones
    fi
fi
```

### Why:
- Ports are RANDOM by default so each worktree gets unique ports and avoids collisions
- `.env` is updated by init.sh with real ports — never edit it manually
- `.init-state` is the single source of truth for URLs and PIDs
- `PROJECT_ROOT` env var is set by init.sh so the server finds config files in worktrees

### Stable ports (optional):
Random ports are what enables concurrent worktree runs by default. Use stable ports only when your automation or toolchain requires fixed URLs (for example, if a script hardcodes `localhost:3131`/`localhost:1420`), by explicitly setting:

```bash
INIT_SERVER_PORT=3131 INIT_VITE_PORT=1420 INIT_DAEMONIZE=1 ./init.sh
```

## CRITICAL: Dependency Management (MANDATORY — NO EXCEPTIONS)

**Never install packages directly.** Dependencies are managed exclusively through init.sh.
- `pnpm install --frozen-lockfile` runs automatically via init.sh
- pnpm's content-addressable store makes installs fast (~2-3s with warm cache)
- If you need a new dependency, edit `package.json` and `pnpm-lock.yaml`, then run `./init.sh`

## Git Staging Rules (MANDATORY)

**NEVER use `git add -A` or `git add .`** — always stage specific files by name to avoid accidentally committing `node_modules` or other untracked artifacts.

## Monorepo Structure

- Package manager: **pnpm** workspaces
- Server runtime: **Bun** (required — uses `bun:sqlite`)

## Key Commands

```bash
./init.sh                                          # Start everything (blocks until killed)
INIT_DAEMONIZE=1 ./init.sh && source .init-state   # Start in background (for agents)
./init.sh stop                                     # Stop running services
pnpm test                                          # Run tests (no init.sh needed)
pnpm -r build                                      # Build all packages (no init.sh needed)
```

## Testing Requirements (MANDATORY — NO EXCEPTIONS)

**Work is NOT complete until tests exist and pass. Code without tests will not be merged.**

### CRITICAL: Regression Tests Are Required

**Every bug fix MUST include a regression test.** The test must:
1. **Fail** when the bug is reintroduced (revert the fix, run the test, confirm it fails)
2. **Pass** with the fix applied
3. **Be specific** — test the exact scenario that triggered the bug, not just general behavior

**Every feature MUST include tests before the task is considered done.** No "I'll add tests later" — tests are part of the implementation, not a follow-up.

### TDD Workflow (Required Order)
1. **Write a failing test first** that captures the expected behavior or reproduces the bug
2. **Implement the code** to make the test pass
3. **Run the full test suite** — if anything fails, fix it before moving on:
   - `pnpm --filter @claude-tauri/desktop test -- --run` for frontend changes
   - `cd apps/server && bun test` for backend changes
   - `pnpm --filter @claude-tauri/desktop exec tsc --noEmit` for type safety

### What requires tests
- **Bug fixes**: Regression test (MANDATORY — this is how we prevent the same bug twice)
- **New features**: Unit tests for logic + integration tests for API endpoints
- **Refactors**: Existing tests must still pass; add tests for any newly uncovered paths
- **Type changes** (shared types, interfaces): Update ALL test mocks to match new types

### Test locations
- Frontend tests: colocated as `__tests__/ComponentName.test.tsx` or `hookName.test.ts`
- Server tests: colocated as `routeName.test.ts` next to the route file
- Follow existing test patterns in each directory

### Definition of Done (ALL must be true)
- [ ] Regression tests exist for every bug fix
- [ ] All new code has corresponding tests
- [ ] `tsc --noEmit` passes with 0 errors
- [ ] All tests pass (desktop + server)
- [ ] No skipped tests were added to hide failures
- [ ] If the task touched the UI, browser verification in `agent-browser` or `claude-chrome` was completed and passed before considering the work done

### UI Verification Rule

If a task changes anything visible, clickable, navigable, or otherwise user-facing in the app, you must verify it in `agent-browser` or `claude-chrome` before you consider the task complete. Do not skip the browser pass because the change seems small or because tests already passed.
When using `agent-browser`, include screenshot artifacts inline in the response (before/after states) so the verification is directly visible in-thread.

## Important Notes

- `.env` is created from `.env.example` on first run, then updated with dynamic ports by init.sh
- No external databases — SQLite is embedded in Bun at `~/.claude-tauri/data.db`
- Auth is skipped in dev mode (no `SIDECAR_BEARER_TOKEN` set)
- Do NOT set `ANTHROPIC_API_KEY` unless intentional — it overrides subscription auth
- Clean stale worktrees: `./scripts/cleanup-worktrees.sh`
