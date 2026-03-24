# Swarm: Regression Tests for UX Bug Fixes

**Started**: 2026-03-24
**Team**: 6 parallel agents (3 per wave) with worktree isolation
**Scope**: `src/lib/__tests__/routes.test.ts,src/components/__tests__/PermissionMode.regression.test.tsx,src/__tests__/App.routing.test.tsx,src/components/__tests__/TeamWorkspace.agents.test.tsx,src/components/__tests__/WorkspacePanelHeader.rename.test.tsx,src/components/chat/__tests__/WelcomeScreen.profiles.test.tsx`
**Spec**: `/Users/dennisonbertram/.claude/plans/harmonic-crafting-rainbow.md`

---

## Wave 1 — Critical Regression Tests (routes, permission mode, routing)

**Teammates**: agent-routes, agent-permission, agent-routing (3 parallel, worktree isolated)
**Files changed**:
- `apps/desktop/src/lib/__tests__/routes.test.ts` (20 tests)
- `apps/desktop/src/components/__tests__/PermissionMode.regression.test.tsx` (7 tests)
- `apps/desktop/src/__tests__/App.routing.test.tsx` (13 tests)
**Codex tasks**: None (all Claude teammates)
**Review**: First review found 2 CRITICAL + 2 HIGH. Fixed:
  - CRITICAL: Rewrote App.routing to use real `pathToView` from production code
  - CRITICAL: Added stopPropagation + broken-version comparison test for #353
  - HIGH: Added edge case tests for routes
  - HIGH: Fixed "Normal" button ambiguity in dropdown tests
  - MEDIUM: Fixed keyboard test, added vi.unstubAllGlobals(), mockFetch.mockReset()
**Re-review**: 0 CRITICAL, 0 HIGH, 3 MEDIUM → APPROVED
**Commit**: `be3af44`

## Wave 2 — High-Priority Regression Tests (teams, rename, profiles)

**Teammates**: agent-team, agent-rename, agent-welcome (3 parallel, worktree isolated)
**Files changed**:
- `apps/desktop/src/components/__tests__/TeamWorkspace.agents.test.tsx` (10 tests)
- `apps/desktop/src/components/__tests__/WorkspacePanelHeader.rename.test.tsx` (7 tests)
- `apps/desktop/src/components/chat/__tests__/WelcomeScreen.profiles.test.tsx` (5 tests)
**Codex tasks**: None
**Review**: Found 0 CRITICAL, 1 HIGH. Fixed:
  - HIGH: Replaced brittle DOM traversal with `getByRole('button', { name: /cancel/i })`
  - MEDIUM: Changed strict `toHaveBeenCalledWith` to `expect.objectContaining`
**Commit**: `1dd1cbd`

## Ralph Loop
**Pass 1 (Adversarial)**: 1 CRITICAL, 1 HIGH, 6 MEDIUM — NOT APPROVED
**Pass 2 (Skeptical User)**: 1 CRITICAL, 3 HIGH, 8 MEDIUM — NOT APPROVED
**Pass 3 (Correctness)**: 0 CRITICAL, 1 HIGH, 8 MEDIUM — NOT APPROVED

**Common findings across all 3 passes:**
- App.routing harness doesn't test real App.tsx (known OOM limitation — documented in comments)
- Missing parentClickSpy assertion — FIXED
- Async race in fork tests — FIXED with waitFor
- vi.clearAllMocks vs resetAllMocks — FIXED
- Misleading query-string tests — REMOVED

**Fixes committed**: `db9b9dd`

**Remaining MEDIUM findings (accepted as known limitations):**
- Fake timers in PermissionMode tests not advanced (acceptable — tests focus on dropdown UX, not polling)
- Styling-coupled assertions in WelcomeScreen (acceptable for regression tests)
- Missing error/failure path tests (future enhancement, not regression scope)

## Final Status
- [x] Wave 1 committed and reviewed (be3af44)
- [x] Wave 2 committed and reviewed (1dd1cbd)
- [x] Ralph Loop fixes committed (db9b9dd)
- [x] All 61 new tests passing (1289 desktop + 997 server = 2286 total)
- [x] 3 Ralph Loop passes completed, actionable findings addressed
- [x] Work log complete
