# Session Learnings

## 2026-03-22: Walk-the-Issues (33 issues → 32 PRs)

### What Worked
- **Parallel grooming agents** (batches of 4-6) dramatically sped up issue triage
- **Worktree isolation** for implementation agents prevented branch conflicts between parallel workers
- **Cherry-pick strategy** when worktree branches drifted — more reliable than merge in contested repos
- **Batch merging via `gh pr merge`** — fast for non-conflicting PRs, then rebase pass for conflicts

### Gotchas
- **Worktree CWD resets** between bash calls — agents need to `cd` explicitly every command
- **Branch checkout conflicts** when multiple worktrees exist — `git worktree remove` before checkout
- **Overlapping refactors cause merge conflicts** — merge in dependency order (infrastructure first, then consumers)
- **Late-finishing grooming agents** are noise if implementation already completed — track agent lifecycle
- **`git add -A` is dangerous in shared worktrees** — always stage specific files

### Patterns for Future Runs
- Merge security/infra PRs first (#264-268), then server-side splits, then frontend splits
- PRs that touch shared files (types.ts, workspace-api.ts) should merge before PRs that consume them
- When >10 PRs conflict, rebase in PR-number order — earlier PRs are typically lower-risk

## 2026-03-23: UX Bug Fixes (#344, #348, #354, #350)

### What Worked
- **GPT-5.4 plan review** caught real gaps: state preservation audit for routing, speculative crash diagnosis, naming inconsistencies
- **Parallel research agents** (4 simultaneous) for investigation phase — all completed within ~2 minutes
- **Parallel implementation agents with worktree isolation** for #348, #354, #350 — all three completed independently
- **Cherry-pick from agent worktrees** to main branch — clean workflow for consolidating parallel agent work
- **Browser verification via Chrome MCP** before implementing #348 confirmed the crash wasn't reproducible, saving wasted effort

### Gotchas
- **Golden cache symlinks break when new deps added** — `react-router-dom` installed by agent in worktree but not in golden cache; needed `CI=true pnpm install` in golden dir
- **`init.sh` needs both `bun` and `pnpm` in PATH** — different shell sessions lose PATH; always export explicitly
- **Agent-browser headless can't reach cross-origin localhost** — app at :1800 can't fetch :3131 in headless Chromium (CORS); use real Chrome for cross-origin verification
- **Cherry-pick of empty commits** — when two agents modify the same file, later cherry-pick may be empty; use `--skip` and verify changes are present
- **`CI=true` triggers cloud mode in init.sh** — requires `ANTHROPIC_API_KEY`; don't set CI when running init.sh locally

### Patterns for Future Runs
- Always reproduce crashes in browser BEFORE implementing a fix — avoids wasted effort on already-fixed issues
- For routing migrations: use "derive from URL" pattern (minimal diff) rather than full outlet refactor
- Create `routes.ts` helper with path builders before touching components — centralizes route strings
- When agent-browser can't reach the backend, fall back to Chrome MCP or manual verification

### Non-Obvious Technical Insights
- **Test coverage gaps with wrapper elements** — StatusBar tests clicked the container `div` (via `getByTestId`) instead of the actual `button` inside it, so dropdown open/close flow was never tested despite appearing covered
- **`init.sh` random ports are by design** — don't fight it with hardcoded ports in `launch.json` or preview tools; always `source .init-state` and use `$FRONTEND_URL`/`$SERVER_URL`
- **Cherry-pick order matters when agents modify overlapping files** — if agent A modifies App.tsx for #354 and agent B also modifies App.tsx for #350, cherry-picking B after A may silently include A's changes, making A's cherry-pick empty

## 2026-03-24: CLAUDE.md as Instruction Source for Agents

### Key Insight: Agent Behavior is Determined by CLAUDE.md, Not External Assumptions
- **Root cause of missing tests**: CLAUDE.md contained no mention of TDD or testing requirements, so agents never wrote tests despite knowing *how* to write them
- **CI failures were direct consequence**: Features merged without tests or with outdated mocks because agents had no instruction to run the test suite
- **Solution**: Added comprehensive testing section to CLAUDE.md with mandatory TDD workflow — this becomes the single source of truth for all agents/worktrees

### Why This Matters
- Agents follow the project's primary instruction document religiously
- Absence of an instruction is interpreted as "not required"
- This applies to any workflow requirement: if it's not in CLAUDE.md, agents won't do it
- Updated CLAUDE.md with explicit testing requirements: write test first, implement, run suite before marking done

### Gotchas & Patterns
- **Don't assume implicit understanding** — agents won't infer testing requirements from CI failures or merge comments
- **CLAUDE.md is hierarchical**: Global instruction, user instruction, workspace instruction, system prompt — workspace instruction (in project root) takes precedence
- **Type changes require test updates** — when shared types change, test mocks must be updated or tests fail; this needs explicit instruction

## 2026-03-18: Golden Cache Symlink Architecture Analysis

### Critical Discovery: Symlink-Based node_modules Caching is Fundamentally Broken
- **Root problem**: Symlinking entire `node_modules` directories breaks Node.js path resolution, pnpm's workspace bookkeeping, and Vite's caching — all expect `node_modules` to be a real co-located directory
- **Concrete failures caused by symlinks**:
  1. `workspace:*` symlinks for `@claude-tauri/shared` point to stale worktree code — importing from shared types could pull outdated implementations
  2. Packages with worker bundles/WASM (e.g., `unpdf`) can't resolve assets because paths land outside the dev server root
  3. All worktrees share one Vite `.vite/deps` cache → invalidation races and cache corruption

### Non-Obvious Insight: pnpm Already Solves the "Warm Cache" Problem
- **What the golden cache was solving**: Speed up `pnpm install` across multiple worktrees by maintaining a shared source of truth
- **Why it's unnecessary**: pnpm already has a content-addressable store (`~/Library/pnpm/store/v10`) and hardlinks from it — a warm store makes `pnpm install` ~2-3 seconds per worktree (negligible)
- **Net result**: Golden symlink architecture creates 8 new symlink bugs to solve a problem that doesn't exist (pnpm is already fast)

### Architecture Decision
- Replace golden symlink cache with plain `pnpm install` — each worktree gets real `node_modules`, pnpm's store handles speed
- Makes `init.sh` faster *and* more correct (no symlink path resolution bugs)
- Golden-sync becomes a "warm the store" optimization, not a symlink source

### Gotchas
- **Symlink debugging is cryptic** — failures appear as "module not found" errors in completely unrelated packages, making root cause hard to trace
- **pnpm's internal bookkeeping relies on `node_modules` structure** — symlinks break this silently; changes appear to work locally but fail in CI

## 2026-03-24: Stale Symlinks Block Architecture Refactors

### Critical Pattern: Old Symlinks Persist Through Refactors
- **Discovery**: When refactoring away from symlink-based caching (golden cache), old `node_modules` symlinks remain in the working tree even after `init.sh` changes
- **Why it breaks**: New `init.sh` tries to run `pnpm install` to create a real `node_modules`, but the symlink is in the way — writes go to the old golden directory instead of the project
- **Signal**: Stale symlink is discovered by checking `ls -la node_modules` — will show `node_modules -> ~/.claude-tauri/golden/./node_modules` if present
- **Fix**: Always remove stale symlinks manually (`rm -rf node_modules`) before testing a refactored build system

### Why This Matters
- Symlink refactors can silently fail without obvious error messages
- Testing a new architecture without cleaning up old symlinks will never show the true state
- This is especially dangerous in monorepos where symlinks exist at workspace root and are easy to forget about

### Gotcha: Root Cause is Hidden
- Errors from init.sh with a stale symlink appear to be lockfile/dependency issues, not symlink issues
- The actual problem (wrong write path) is only visible by checking filesystem structure directly
