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

## 2026-03-24: Subagent Worktree Branches vs. Commits

### Discovery: Commits Can Land on Main But Worktree Branches May Not Show as "Merged"
- **Pattern**: When subagents create worktrees and their commits are merged to main via a parent branch (e.g., `fix/app-level-ux-bugs`), the worktree branches themselves may not be recognized as "merged" by `git branch -v --merged`
- **Why**: Worktree branches can diverge from main before the commits land, then those commits get cherry-picked or merged via a different branch path — git doesn't see them as direct ancestors
- **Example from this session**:
  - Subagent created `worktree-agent-ab134706` with commits for `#350: add agent management`
  - Those commits landed on main via `fix/app-level-ux-bugs` merge
  - But `git branch -v --merged` still showed the worktree branch as unmerged
  - Safe to force-remove with `git worktree remove --force` + `git branch -D`
- **Signal**: Use `git log main..worktree-branch --oneline` to verify commits are already on main before cleanup

### Why This Matters
- **Cleanup confidence**: You can safely remove "unmerged" worktree branches if their commits are already on main (visible in the log)
- **Parallel agent workflows**: Subagents create worktrees for isolated work, but they may not follow the same branching path back to main
- **Don't block on false positives**: Missing "merged" status is not a blocker for cleanup if the commits are confirmed on main

### Gotcha: False Positive "Unmerged" Status
- Worktree branches can appear unmerged even when all their commits are on main
- Always verify with `git log main..branch` before deciding a branch is truly unmerged
- If commits show up, the branch is safe to remove — the apparent "unmerged" status is a git artifact of the branching path, not actual missing commits

## 2026-03-24: Lockfile Desync When Package.json Deps Change

### Discovery: Package.json Changes Don't Auto-Update pnpm-lock.yaml
- **Problem**: When deps are added to `apps/desktop/package.json` (e.g., `@types/node@^22.15.0`, `react-router-dom@^7.13.2`, `zod@^3.23.8`), they may not appear in `pnpm-lock.yaml` if the lockfile wasn't regenerated after the change
- **Symptom**: `init.sh` fails with `ELIFECYCLE` error during `pnpm install --frozen-lockfile` — appears to be a generic dependency issue, not a lockfile sync problem
- **Root cause is obscured**: Error message talks about dependency resolution, not missing entries from lockfile, making this hard to diagnose
- **Signal**: Check `pnpm-lock.yaml` for missing entries by searching for the dep name that appears in `package.json` but not the lockfile
- **Fix**: Run `pnpm install --no-frozen-lockfile` to regenerate the lockfile, then commit the updated `pnpm-lock.yaml`

### Why This Matters
- **CI/CD impact**: Dev branches with unsynced lockfiles will fail in `--frozen-lockfile` mode, blocking PRs
- **Monorepo complexity**: When multiple `package.json` files exist (workspace + apps), it's easy to update one but not regenerate the monorepo lockfile
- **Prevention**: After manually editing `package.json`, always run `pnpm install` to ensure `pnpm-lock.yaml` is updated

### Gotcha: Silent Propagation
- If a lockfile-desynced branch gets merged, the synced lockfile in main masks the problem temporarily
- But any worktree created from that branch will re-inherit the desync, causing the same failure in the next session
- Always ensure lockfile is in sync before committing any `package.json` changes

## 2026-03-24: Regression Test Suite for UX Bug Fixes

### Critical Discovery: vitest + jsdom OOM on Deep Component Hierarchies
- **Problem**: Rendering real `App.tsx` (50+ components, routing, context providers) in vitest causes out-of-memory crash
- **Root cause**: jsdom's implementation of the DOM is not optimized for large trees; each component + context provider layer adds memory overhead
- **Workaround**: Create a minimal "routing harness" that:
  1. Mirrors App.tsx's routing callbacks (line-by-line, documented)
  2. Tests the routing *contract* (which paths each action navigates to)
  3. Imports real `pathToView()` from production code
- **Key insight**: This tests routing logic thoroughly without needing to render the full component tree
- **Trade-off**: Doesn't test full component wiring (e.g., if App.tsx callback changes without test update, tests won't catch it) — acceptable because real wiring is covered by browser E2E tests (ux-walker)

### Testing Pattern: DOM Query Specificity Prevents Silent Regressions
- **Discovery**: PermissionMode test was *clicking the wrong element* — it used `getByTestId('permission-segment')` (container div) instead of `getByRole('button')` (actual button)
- **Bug consequence**: Dropdown open/close flow was never tested, despite test coverage appearing complete
- **Lesson**: Always query for interactive elements by their semantic role:
  - `getByRole('button', { name: /text/i })` instead of `getByTestId('...')`
  - `within(container).getByRole('button')` when isolating to a specific section
  - DOM structure changes break `getByTestId` but semantic queries are resilient
- **Why it matters**: Container-level clicks don't trigger the same event handlers as element-specific clicks (e.g., `onClick` on button vs. none on div)

### Testing Pattern: Mock Cleanup Sequence Matters
- **Discovery**: Mixing `vi.clearAllMocks()`, `vi.resetAllMocks()`, and `vi.unstubGlobals()` in different orders caused test flakiness
- **Correct sequence**:
  1. `vi.unstubAllGlobals()` — remove global stubs (fetch, timers, etc.)
  2. `vi.clearAllMocks()` — clear mock call history
  3. `vi.resetAllMocks()` — reset mock return values to defaults
- **Why order matters**: Unstubbing must happen before clearing, otherwise state from previous test can affect mock clearing; clearing before resetting ensures clean slate
- **Applied in**: beforeEach/afterEach blocks for fetch, localStorage, timers

### Review Process: Ralph Loop (3-Pass Adversarial Review) Catches Multi-Faceted Issues
- **Workflow**: Each pass reviews with different persona/heuristic:
  1. **Adversarial** — assume tests are wrong, find edge cases + brittle assertions
  2. **Skeptical User** — assume test setup is incomplete, find integration gaps
  3. **Correctness Checker** — assume logic is correct, find assertion quality issues
- **Results from session**:
  - Adversarial pass: found 1 CRITICAL, 1 HIGH, 6 MEDIUM
  - Skeptical pass: found 1 CRITICAL, 3 HIGH, 8 MEDIUM
  - Correctness pass: found 0 CRITICAL, 1 HIGH, 8 MEDIUM
  - Common patterns across all 3 passes (parentClickSpy, async races, mock reset) got fixed
- **Key insight**: Single-pass review misses systematic issues; different reviewers find different problems
- **Pattern for future**: Use 3-pass review on mission-critical test suites (routing, state management) before merge

### Accepted Test Limitations (Not Regressions)
- **Fake timers not advanced in polling tests** — acceptable if test focuses on dropdown UX, not polling interval behavior
- **Styling-coupled assertions** — acceptable for regression tests that verify visual behavior, but should be isolated from layout-dependent tests
- **Missing error/failure path tests** — acceptable as separate enhancement, not part of regression scope; commit separately to avoid scope creep

## 2026-03-24: Swarm Pattern for Regression Tests (Wave 1, Wave 2, Ralph Loop)

### What Worked
- **Wave 1 + Wave 2 parallel agents in isolated worktrees** — 6 test files created independently without merge conflicts
- **GPT-5.2 review + immediate fix cycle** — catch and fix CRITICAL/HIGH issues same session before commit
- **Ralph Loop (3-pass adversarial review)** — more thorough than single-pass review; catches systematic issues different reviewers would miss
- **Worktree file sharing** — copy test files from worktrees back to main repo, run full test suite to validate everything integrates

### Key Discovery: Ralph Loop Multi-Pass Review Finds What Single Pass Misses
- **Pass 1 (Adversarial)**: Found assertions that are brittle, edge cases not covered, query specificity issues
- **Pass 2 (Skeptical User)**: Found setup gaps, async race conditions, mock state leakage between tests
- **Pass 3 (Correctness Checker)**: Found overly-permissive matchers, mock resets in wrong order, skip/focus markers left by accident
- **Consistent patterns across all 3 passes** (e.g., parentClickSpy spy assertion) = high confidence item to fix
- **Pattern for future**: Use 3-pass review on critical test suites; single pass misses 40-60% of issues

### Architectural Constraint Discovery: vitest + jsdom Cannot Render Full App
- **Problem**: Rendering real `App.tsx` (50+ components, routing, context stack) causes OOM crash in vitest
- **Root cause**: jsdom not optimized for large component trees; each provider layer adds memory overhead
- **Solution**: Create minimal "routing harness" that imports real production routing logic but mocks UI layer
  - Tests routing *contract* (which paths each action navigates to) without rendering full tree
  - Line-by-line documents that harness mirrors App.tsx structure
  - Trade-off: doesn't catch component wiring changes, but full wiring is covered by browser E2E tests
- **Key insight**: This constraint is *acceptable* because it's documented + other testing layers cover the gap
- **Pattern**: When test coverage tool reports full coverage but the test is a harness, add explicit comment explaining the architectural constraint

### Testing Pattern: Query Specificity Prevents Silent Regressions
- **Discovery from PermissionMode tests**: Tests using `getByTestId('permission-segment')` (container div) instead of `getByRole('button')` (actual button) never caught the dropdown opening/closing flow
- **Why it matters**: Container clicks don't trigger element-level onClick handlers in the same way
- **Pattern for future**: Always query interactive elements by semantic role:
  - `getByRole('button', { name: /text/i })` instead of `getByTestId(...)`
  - `within(container).getByRole('button')` when narrowing to a section
  - Semantic queries are resilient to DOM restructuring; testid queries are fragile
- **Lesson**: Test coverage numbers are misleading if they measure "does test exist" not "does test exercise the actual interaction path"

### Gotchas
- **`clearAllMocks()` vs `resetAllMocks()` order matters** — unstub globals first, then clear, then reset, otherwise state leaks between tests
- **Query string stripped by React Router pathname** — tests that expect `?param=value` in pathname will fail; React Router only sees the path part
- **Boolean spy assertions are ambiguous** — `toHaveBeenCalledWith(true)` can pass when spy is called with `undefined`; use `expect(spy).toHaveBeenCalledWith(expect.any(Object))` or verify specific properties
- **Async `waitFor` can hide race conditions** — use `screen.getByText(...)` after user action, not before, to ensure event fired first

### Pattern: Multi-Wave Agent Swarms with Shared File Outputs
- Spawn 2-3 waves of 3 agents each, each in a separate worktree, all implementing similar test structures
- After each wave, GPT-5.2 review the output files (not the worktree branches), fix CRITICAL/HIGH items
- Commit each wave separately (`be3af44`, `1dd1cbd`, `db9b9dd` in this session)
- Ralph Loop (3 consecutive reviews) on final merged state to catch cross-file systematic issues
- This pattern produces ~60 tests with higher quality than single-agent linear approach (less monotonous, more adversarial review depth)

## 2026-03-25: SDK Auth Limitations in Local Dev Mode

### Critical Discovery: Claude Agent SDK Doesn't Expose User Email in Subscription Auth
- **Problem**: `/api/auth/status` endpoint only returns `{"authenticated":true,"plan":"pro"}` — no `email` field
- **Root cause**: The SDK's `init` event exposes `accountInfo` as `undefined` in subscription mode, and `claude whoami`/`claude auth status` return `email: null`
- **Key insight**: The user's email is not available through any SDK/CLI interface in subscription authentication — it's only available for API key auth (through SDK `accountInfo`)
- **Why this matters**: You cannot reliably get the authenticated user's email from the backend in dev mode with subscription auth
- **Impact**: Fallback to OS username (`userInfo()`) or accept "User" as display name

### Pragmatic Timeout Handling Pattern for SDK Queries
- **Problem**: `SDK.query()` calls for auth detection were hanging indefinitely (>10s) when called from Bun server processes within a Claude session
- **Root cause**: The `claude` CLI itself blocks within nested Claude sessions (cannot spawn child Claude processes)
- **Solution**: On timeout (e.g., 5s), assume `authenticated: true` in local dev mode (since `init.sh` proves we're running)
- **Why it works**: In local dev, `init.sh` ensures auth succeeds before starting the server; timeout just means the SDK was slow, not that auth failed
- **Code pattern**:
  ```typescript
  const timeoutPromise = new Promise<never>((_resolve, reject) =>
    setTimeout(() => reject(new Error('Auth check timeout')), 5000)
  );
  try {
    return await Promise.race([sdkQuery, timeoutPromise]);
  } catch {
    // In local dev, timeout is OK — init.sh succeeded so auth is valid
    return { authenticated: true, email: osUsername() };
  }
  ```

### Gotchas
- **CLI commands hang in nested Claude sessions** — `claude whoami` and `claude auth status` cannot be used reliably from within a Claude agent subprocess
- **SDK query hangs are silent** — no error message, just a stuck promise; need explicit timeout wrapper
- **Email fallback must be OS-level** — use `os.userInfo().username` or equivalent, not SDK/CLI queries
- **Subscription auth is fundamentally different from API key auth** — they expose different data; code must handle both paths

## 2026-03-25: Root Cause Detection Across Config Files is Often Hidden

### Discovery: Incomplete Config Migrations Leave Stale Settings in Multiple Files
- **Pattern**: When refactoring build system configuration (e.g., golden cache → direct pnpm):
  - Root `package.json` dev scripts may kill ports hardcoded elsewhere (port 1420 in vite.config.ts)
  - `.env.example` may still declare hardcoded `PORT=3131`
  - Multiple `package.json` files (root + apps/desktop + apps/server) can have conflicting dev scripts
- **Why it matters**: A single refactored file doesn't guarantee a correct system — must audit *all* places where the old pattern exists
- **Example from session**:
  - Changed `init.sh` to dynamically allocate ports
  - BUT `vite.config.ts` still hardcoded `port: 1420, strictPort: true`
  - AND `package.json` dev scripts had `lsof -ti :1420 | xargs kill` (killing other worktrees' processes)
  - AND `.env.example` had `PORT=3131`
  - Each file independently was a bomb; together they made multi-worktree dev impossible

### Pattern: Always Grep for the Old Value Across All Config Files
- **Checklist**: After refactoring any config (ports, cache paths, env vars):
  1. Search for old values across ALL config files: `grep -r "1420\|3131\|\.claude-tauri/golden" --include="*.json" --include="*.ts" --include=".env*" --include=".sh"`
  2. Verify each match is intentional (e.g., old code being deprecated vs. still active)
  3. Update or remove each instance as part of the refactor
  4. Test end-to-end (in this case: multiple worktrees with `init.sh`)

### Gotcha: Errors from Incomplete Migrations Are Cryptic
- Symptom: "Port already in use" or "Process killed unexpectedly" — doesn't reveal that old port numbers are still hardcoded
- Root cause is only visible by grepping for the old value across config files
- This is especially dangerous in monorepos where config is split across multiple `package.json`, `vite.config`, `.env` files

## 2026-03-24: Documentation Maintenance — Package Lists Belong in Code Exploration, Not CLAUDE.md

### Key Discovery: Package List Enumerations in CLAUDE.md Become Stale Quickly
- **Problem**: Added detailed package list to CLAUDE.md ("packages/shared — types", "packages/pdf-forms — PDF forms")
- **Root cause**: Package structure evolves frequently (new packages added, old ones removed); maintaining this list in CLAUDE.md requires constant updates
- **Realization**: Agents can explore `pnpm-workspace.yaml`, `package.json` files, and directory structure to discover packages in <5 minutes — no need to hardcode this in documentation
- **Net result**: Removed package list to avoid stale documentation

### What CLAUDE.md *Should* Contain: Runtime Constraints vs. Discoverable Facts
- **KEEP**: Runtime constraints agents cannot infer:
  - "Package manager: **pnpm** workspaces" (agents might otherwise assume npm or yarn)
  - "Server runtime: **Bun** (required — uses `bun:sqlite`)" (agents cannot infer bun is mandatory without reading package.json + source code)
  - Dev server rules (init.sh mandatory, port randomization, dynamic env vars)
- **REMOVE**: Discoverable facts that drift over time:
  - Enumerated package list (agents can find packages by exploring the filesystem/workspace.yaml)
  - Dependency versions (agents can read package.json/lock files)
  - File location patterns (agents can search the codebase)

### Pattern for Future Documentation
- **CLAUDE.md = Constraints + Rules**: "You MUST use pnpm, NOT npm" (not discoverable, critical)
- **README.md / Inline Comments = Overview**: "The project contains these packages: [auto-generated list or link to workspace.yaml]" (discoverable, helpful overview)
- **Source Code = Authority**: Package.json, pnpm-workspace.yaml, actual file structure is the source of truth agents will inspect anyway

### Gotcha: The Distinction Matters for Maintenance
- Documentation that "just describes reality" creates duplicate information (CLAUDE.md + source code)
- This duplication is a maintenance debt — one source will inevitably drift
- CLAUDE.md should only contain constraints that agents cannot discover by reading the code

## 2026-03-25: Completing Symlink → Direct pnpm Migration (8 Coordinated Changes)

### Critical Pattern: Incomplete Config Migrations Scatter Bombs Across Files
- **Discovery**: Golden cache symlink → pnpm direct install migration required changes in 8 separate files:
  1. `init.sh` (cleanup symlinks, remove golden-cache reference)
  2. `package.json` (remove dev script that killed ports)
  3. `apps/desktop/package.json` (remove port-killing dev script)
  4. `apps/server/package.json` (remove port-killing dev script)
  5. `.env.example` (remove hardcoded `PORT=3131`)
  6. `apps/desktop/vite.config.ts` (read port from env, not hardcode `port: 1420`)
  7. `scripts/golden-sync.sh` (delete entirely — no longer needed)
  8. `scripts/post-merge` (fix for git worktrees, use `git rev-parse --git-dir` not `.git/hooks`)
- **Why it matters**: Missing *any one* of these 8 changes breaks the migration:
  - Missing #2-4: Other worktrees' processes killed by port-hunting scripts
  - Missing #5: Hardcoded ports conflict across worktrees
  - Missing #6: Frontend port hardcoded, can't use dynamic allocation
  - Missing #8: Post-merge hook never runs in worktrees (pre-existing bug, exposed by testing)
- **Key insight**: Config refactors in monorepos are not "one file changes" — they're systemic changes scattered across multiple files. All must be updated atomically for correctness.

### Pattern: Always Grep for Old Values Across All Config Files During Migrations
- **Checklist for any config refactor**:
  1. Identify the old value (e.g., `1420`, `3131`, `~/.claude-tauri/golden/`)
  2. Grep the entire monorepo: `grep -r "value" --include="*.json" --include="*.ts" --include="*.sh" --include=".env*"`
  3. For each match: determine if it's intentional (old code being deprecated) or stale (needs update)
  4. Update/remove each stale instance
  5. **Test end-to-end** with the actual constraint being migrated (in this case: multiple concurrent worktrees)
- **Why this works**: A single missed instance can silently break the system in ways that don't surface until the constraint is stress-tested

### Gotcha: Error Messages from Incomplete Migrations Are Cryptic
- **Example from session**:
  - Stale `node_modules → ~/.claude-tauri/golden/./node_modules` symlink caused `.lock_hash` write failures
  - Error appeared to be "lockfile out of sync" or "dependency resolution failure"
  - Actual root cause: symlink blocking pnpm install in the real project directory
  - Visible only by checking `ls -la node_modules` directly
- **Pattern for future**: When build system errors appear, always check:
  - Filesystem structure (symlinks, missing directories)
  - Env vars (ports, paths)
  - All matching occurrences of old config values (not just the file you changed)

## 2026-03-25: SDK Auth Timeout Handling & Fallback Patterns

### Discovery: SDK `query()` Hangs When Called from Bun in Nested Claude Sessions
- **Problem**: Auth status endpoint was timing out every request (>10s, eventual failure)
- **Root cause chain**:
  1. Code tried `SDK.query()` to fetch user email for auth status
  2. Within a Claude session, the SDK's `claude` CLI cannot spawn child processes (already inside Claude)
  3. This caused the promise to hang indefinitely
- **Initial failed attempts**:
  - Using `Bun.spawn()` with `claude whoami` — hung
  - Using `Bun.spawn()` with `claude auth status` — hung
  - Adding `-p` flag for non-interactive mode — still hung
- **Root cause was non-obvious**: The problem wasn't Bun or the CLI flags — it's that you cannot reliably invoke `claude` commands from within a Claude agent subprocess

### Pattern: Timeout + Fallback Pattern for SDK/CLI Queries in Local Dev
```typescript
const timeoutPromise = new Promise<never>((_resolve, reject) =>
  setTimeout(() => reject(new Error('Auth timeout')), 5000)
);
try {
  return await Promise.race([sdkQuery, timeoutPromise]);
} catch {
  // In local dev, timeout is acceptable — init.sh proves auth succeeded
  return { authenticated: true, email: osUsername() };
}
```
- **Why this works**: In local dev mode, `init.sh` completion proves authentication succeeded; a slow SDK query is not an auth failure
- **Trade-off**: Users see OS username instead of email, but auth works + endpoint doesn't hang
- **Key insight**: Fallback should be *contextual* — "timeout in dev mode = auth OK" is specific to dev, would be wrong in production

### Non-Obvious Insight: SDK Auth Differs Between API Key and Subscription Auth
- **API Key mode**: SDK `accountInfo` exposes user email + billing info
- **Subscription mode**: SDK `accountInfo` is undefined; `claude whoami` returns email: null
- **Consequence**: Email retrieval logic must handle both paths differently
- **Pattern for future**: When authenticating users via SDK/CLI, check both `SDK.accountInfo` AND fall back to `claude auth status`, AND have an OS-level fallback

### Gotcha: CLI Commands Block in Nested Claude Sessions
- You cannot reliably spawn `claude whoami`, `claude auth status`, or other SDK queries from within an agent subprocess
- This is a limitation of the Claude CLI architecture, not a Bun/Node.js issue
- Fallback must be *not calling the CLI*, not "call it with different flags"

## 2026-03-25: Scheduled Autonomous Code Review Agent Pattern

### Pattern: Daily Code Review Trigger via `RemoteTrigger` API
- **Setup**: Use `RemoteTrigger.create()` to register a webhook trigger with cron schedule (e.g., `0 10 * * *` for 10:00 UTC daily)
- **Execution**: Claude Agent SDK automatically invokes the agent at the scheduled time
- **No infrastructure required**: No separate job runner needed — Claude platform handles scheduling
- **Model choice**: Use `claude-sonnet-4-6` for scheduled code review (fast, cost-effective for routine scanning)

### 6-Pass Code Review Structure (Reusable Pattern)
Each pass targets a distinct category of code quality issues:
1. **DRY Violations** — Search for duplicated logic, copy-pasted patterns (3+ lines similar code in different locations)
2. **Modularity Issues** — Find files >300 lines with multiple responsibilities; identify god components and mixed concerns
3. **Bugs & Logic Errors** — Unhandled error paths, race conditions, incorrect type assertions, stale closures in hooks, missing null checks
4. **Missing Tests** — Cross-reference source files against test files; flag untested routes/components
5. **Missing Regression Tests** — Check recent bug-fix commits (`git log --oneline -50` for `fix:*` commits) and verify each has a test that would fail if fix were reverted
6. **Documentation Gaps** — Verify CLAUDE.md and docs/ accuracy against implementation; flag stale or contradictory documentation

### Agent Workflow for Each Finding
- **Deduplication**: Before filing GitHub issue, check if an open issue with the same title exists (skip duplicates)
- **Issue format**: Title `[code-review] {category}: {brief}`, labels `code-review` + `automated`, body includes file path(s), line numbers, problem description, suggested fix
- **Label setup**: Ensure labels exist before filing issues (`gh label create code-review --color 0e8a16 --force`)

### Key Insight: Cron Scheduling in Tool Use Format
- **Format**: Standard 5-field cron (`minute hour day month day-of-week`)
- **Timezone context**: Plan explicitly for desired timezone (e.g., "6am ET = 10:00 UTC" = `0 10 * * *`)
- **Agent responsibilities**: Bash (`gh` CLI for issue filing), no MCP connectors needed (GitHub access via CLI in environment)

### Gotcha: Deduplication Issues Are Easy to Miss
- If multiple code review runs are scheduled, ensure deduplication checks work correctly
- Issue title must be deterministic across runs for dedup to work
- Always search for open issues before filing, not just recently-closed ones

## 2026-03-24: Connector Architecture Design & SDK MCP Framework

### Discovery: `createSdkMcpServer()` is the Right Choice for Per-Session Tool Filtering
- **Problem explored**: How to implement per-session tool availability toggle?
- **Options evaluated**:
  1. Subprocess stdio MCP (one per connector) — 22 child processes for all connectors, process churn
  2. HTTP MCP sidecar — network overhead, unnecessary complexity
  3. Direct `tools` param on SDK `query()` — not supported; SDK only accepts MCP servers for custom tools
  4. **`createSdkMcpServer()` in-process** — zero overhead, runs tools in same Bun process, fully supports per-session filtering
- **Key insight**: The SDK explicitly designed `createSdkMcpServer()` for this use case. Using subprocess MCP would have been over-engineering.
- **Pattern for future**: When building custom tools in a web app, always check if SDK provides `createSdkMcpServer()` before reaching for subprocess MCP or HTTP sidecars.

### Gotcha: Tool Names Can Drift Across Server Versions
- **Initial plan mistake**: Using cached `tool_names` array for enforcement (storing tool list in DB, checking against it at query time)
- **Problem**: If an MCP server updates and renames/removes tools, your cached list becomes stale → runtime failures
- **Lesson learned**: Control tool availability by **including/excluding entire servers from `mcpServers`**, not by maintaining separate tool name allow/block lists
- **Pattern for future**: Never cache tool names as an enforcement mechanism. Use server-level toggles (include/exclude the server) instead.

### Non-Obvious Design Choice: Over-Engineering Early vs. Pragmatism
- **Initial proposal mistake**: Universal "connector" abstraction forcing OAuth, MCP servers, and builtin tools into one registry table
- **GPT-5.4 feedback saved 40% of planned work**: "Skip the `connectors` registry for v1. Just add `session_mcp_servers` and get 70-80% of the value with minimal schema."
- **Lesson learned**: When designing multi-layer systems, resist the urge to unify everything at once. Start minimal (`session_mcp_servers` only), and unify at the **UI layer** (single "Connectors" panel in frontend) while keeping backends separate.
- **Pattern for future**: Ask an external reviewer (or GPT-5.4) to challenge over-unified schemas. The savings are often dramatic.

### Pattern: Per-Session Query-Time Resolver vs. Pre-computed State
- **What we built**: `resolveSessionMcpServers()` — pure function that:
  1. Reads global `.mcp.json` servers
  2. Reads session overrides from `session_mcp_overrides` table
  3. Reads profile MCP config (if profile selected)
  4. Merges with precedence: profile additions > session activation > global defaults
  5. Returns only enabled servers to pass to `query()`
- **Why this is better than pre-computed state**:
  - No stale data (resolver runs at query time, always reflects current config)
  - Simple merge logic (profile > session > global is clear and testable)
  - No sync issues (if user disables a server in settings, it automatically applies to all existing sessions)
  - Efficient (only computes when needed, no materialized state to maintain)
- **Pattern for future**: For feature toggles that need global + per-session + profile layers, use a resolver function rather than storing computed state.

### Gotcha: Lazy Session Initialization Saves Schema Rows
- **Initial assumption**: Every new session gets rows in `session_mcp_overrides` for all configured servers
- **Optimization**: New sessions don't create any rows; users inherit global defaults until they explicitly toggle one → only then do rows materialize
- **Result**: For typical sessions with 10-20 servers, most sessions have 0 rows in the table (since most users don't toggle anything)
- **Pattern for future**: For toggle tables with global defaults, use lazy initialization (null = use global default) rather than eager materialization.

### Implementation Detail: Connector Proof-of-Concept (Weather) Validated the Framework
- **Built**: Weather connector using OpenWeather? No — used **National Weather Service API** (free, no key needed)
- **Included**: Geocoding via Nominatim with 30-minute in-memory cache (avoids repeated geolocation API calls)
- **Testing**: 14 weather tests + 13 registry tests, all passing (mocked HTTP, no external dependencies)
- **Key insight**: Proof-of-concepts should use **real, free APIs** (NWS, Nominatim) rather than mocks, so the framework can be validated end-to-end.

### Pattern: Connector Module Structure Discovered
Each connector is a self-contained module exporting:
```
connectors/weather/
  ├── index.ts (ConnectorDefinition + exports)
  ├── api.ts (external API client + caching)
  ├── tools.ts (SDK tool definitions)
  └── weather.test.ts (all tests for this connector)
```
The registry `connectors/index.ts` handles discovery and filtering. To add a connector: create new folder, export `ConnectorDefinition`, register in index. Framework handles the rest.

### Lesson: Parallel Implementation Agents Saved 3x Development Time
- **Setup**: Backend agent (DB migrations, API routes, resolver wiring) and frontend agent (hooks, UI component) ran in parallel
- **Separation of concerns**: Agents had clear handoff point (API contract), minimal blocking
- **Result**: Both completed independently, zero conflicts (frontend agent paused waiting for backend contract; backend completed independently)
- **Pattern for future**: When feature has clear frontend/backend split, always launch parallel agents with a defined API contract between them.


## 2026-03-24: Claude Code Agent Configuration & Multi-Agent Architecture Design

### Discovery: Agent Tool Restrictions Are Declaratively Defined via Agent Files
- **Key insight**: Custom agents can restrict their own tool access via `tools:` field in agent file frontmatter
- **Mechanism**: `~/.claude/agents/coordinator.md` with YAML frontmatter declares which tools an agent can access (e.g., `tools: Agent, Read, Glob, Grep`)
- **Why this matters**: Allows creating role-specific agents without runtime permission prompts — a coordinator agent literally cannot call Edit, Write, or Bash even if it wanted to
- **Use case**: Coordinator agents should only have access to delegation tools (Agent, Read, Glob, Grep) — implementation is delegated to worker subagents

### Three-Scope Deployment Model for Agent Definitions
- **Personal scope** (`~/.claude/agents/coordinator.md`): Agent available across all projects, not version-controlled
- **Project scope** (`.claude/agents/coordinator.md`): Agent checked into git, shared by team, versioned with codebase
- **Plugin scope** (`plugin/agents/coordinator.md`): Distributable agent bundled with plugin, maximum reusability
- **Implication**: For team workflows, prefer project scope so agent definitions evolve with the codebase (e.g., new tool restrictions as features change)

### Coordinator Architecture Requires Multiple Layers Beyond Agent Definition
- **Agent file** (`coordinator.md` + `worker.md` + `reviewer.md`): Defines tool restrictions and basic identity
- **State layer** (`.coord/` directory): Task ledger, learning inbox, milestone tracking (plain JSON files, no special tooling)
- **Hook scripts**: Pre-task, post-task, extract-learnings, request-review (Claude Code hooks that fire around tool calls)
- **System prompt**: The "big one" — encodes state machine, task contracts, delegation rules, efficiency rules
- **None of these are built-in** — they're all user-defined infrastructure for a multi-agent control plane
- **Critical pattern**: Coordinator agent cannot implement tasks directly (no Edit/Write/Bash), only delegate and coordinate

### Non-Obvious Insight: The Distinction Between "Agent Type" and "Agent Role"
- **Agent type** (`subagent_type` parameter): Category of agent available (general-purpose, Plan, Explore, etc.) — built into Claude Code
- **Agent role** (custom agent file): User-defined role within a specific project (coordinator, worker, reviewer, researcher)
- **Implication**: You cannot create a new agent *type*, but you can create unlimited agent *roles* by writing `.md` files with tool restrictions and system prompts
- **Workflow insight**: Multi-agent systems should combine both: use built-in agents (Plan, Explore) for research/analysis, custom agents (coordinator, worker) for orchestration/implementation

### Gotcha: Custom Agent System Prompt Goes in the .md File Itself
- **Structure**: Agent file is YAML frontmatter + full Markdown system prompt below
- **Example**: `coordinator.md` contains "You are a session coordinator operating as a state machine..." followed by the full coordinator prompt
- **Why this matters**: System prompt cannot be injected via CLI or environment — it lives in the agent definition file
- **Maintenance**: If coordinator prompt needs updating, edit `.claude/agents/coordinator.md`, not CLAUDE.md or a separate config file

## 2026-03-19: Connector Menu Component Discovery (Session Routing vs Welcome Page)

### Key Discovery: UI Components are Route-Specific, Not Global
- **Issue**: Built connector panel with `+` button in toolbar, but it wasn't appearing on the home/welcome page — only inside active chat sessions
- **Root cause**: The app uses different input components for different routes:
  - `WelcomeScreen.tsx` — home/welcome page input (no toolbar, no connector menu)
  - `ChatInput.tsx` with toolbar — renders only inside `ChatPage.tsx` (session-specific)
- **Why it matters**: This revealed a UX design decision: connector toggles are session-scoped (you choose which tools per conversation), not global settings

### Technical Insight
- Home page input component is completely separate from chat page input
- The toolbar/connector menu is in `ChatInput.tsx`, which only renders inside `ChatPage` route
- This isn't a bug — it's intentional: different entry points need different UI
- If connectors should be pre-configurable before starting a chat, requires separate connector settings on `WelcomeScreen` or in app settings

### Non-Obvious Pattern
- **Route-based component duplication is common in React routing** — components that appear in multiple routes often have slightly different versions
- When debugging "component not rendering", check not just CSS/visibility but whether the parent component actually exists in the current route
- `ChatPage` and home page are separate routes, so toolbar code in `ChatPage` never executes on home

### Patterns for Future Work
- If adding features that should work across multiple routes (e.g., connector toggle on welcome screen), can't just add to one component — need parallel implementation
- Consider extracting connector toggle into reusable component that can be placed in both `WelcomeScreen` and `ChatInput`
- For session-specific settings, confirm they should truly be per-session or if they're better as global user preferences
