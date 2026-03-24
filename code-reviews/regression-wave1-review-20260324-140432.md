## CRITICAL

### 1) `App.routing.test.tsx` does **not** test the real app routing (high false-confidence)
**Problem:** The tests are against `TestAppLayout`, an in-test “faithful reproduction” of AppLayout logic. If the real `AppLayout`/`App.tsx` regresses (#344/#352/#353) these tests can still pass, because they don’t import/execute the production routing code at all.

**Why this matters:** As “regression” tests, their core value is to fail when the regression returns. Copying logic into a harness breaks that guarantee.

**What to do instead:**
- Extract the production routing logic into a small module/hook (e.g. `useActiveViewRouting` or pure reducers/handlers) and test **that** directly (imported from production code).
- Or mount a smaller real component boundary that still uses the real handlers (even if `App.tsx` is too heavy). For example: export `AppLayout` routing subcomponent, or conditionally mock the deep tree imports.

---

### 2) #353 regression tests don’t actually model the bug mechanism (event bubbling/navigation)
**Problem:** The “Add Project” regression is described as: “button navigates instead of firing callback” (often caused by parent container `onClick` capturing the click). In the harness:
- There is **no parent clickable container** whose `onClick` would navigate.
- There is **no navigation** mechanism at all.
- There is **no callback** like `onAddProject` being asserted—only internal state `setAddProjectOpen(true)`.

So even if the real regression returns (button click bubbles to a parent and triggers navigation), this test could still pass.

**Fix ideas:**
- Add a parent wrapper with an `onClick` that simulates navigation (e.g. `setActiveView('chat')`), then assert that clicking the **button** does *not* trigger it (verifies `stopPropagation()` is doing real work).
- Assert a real callback is invoked (preferably a prop like `onAddProject`) rather than only internal state.

---

## HIGH

### 3) `routes.test.ts` does not cover #344 HashRouter path/hash behavior
**Problem:** The file claims coverage for the “#344 HashRouter fix”, but all `pathToView` tests pass plain pathnames like `"/workspaces/proj-1"`. HashRouter often yields values like:
- `"#/workspaces/proj-1"` (from `location.hash`)
- or pathname is `"/"` while the route is in `hash`

These tests won’t fail if HashRouter parsing regresses, because they never include `#` inputs.

**Add tests such as:**
- `pathToView('#/workspaces/proj-1') === 'workspaces'`
- `pathToView('/#/teams/team-abc') === 'teams'` (depending on actual format you handle)
- `pathToView('')` and `pathToView('#/')` fallback behavior (if applicable)

(And ensure production `pathToView` normalizes hash prefixes if that’s the intended fix.)

---

### 4) `PermissionMode.regression.test.tsx`: “Normal” option selection is ambiguous and can be a false-positive
**Problem:** In `selecting each mode updates localStorage...`, the loop includes `{ label: /^Normal$/, value: 'default' }`. But “Normal” likely appears on:
- the toggle button itself, and
- the dropdown option

`screen.getByRole('button', { name: /^Normal$/ })` can select the toggle (not the dropdown option). If the default permission mode is already `"default"`, the assertion can pass even if the dropdown option was never actually clicked—making it a weak regression check.

**Fix:**
- Scope the option lookup to the dropdown container (e.g. `within(segment)` and/or a dedicated dropdown testid/role).
- Or disambiguate by selecting the *second* “Normal” button when open, or by querying options by a unique attribute.

---

## MEDIUM

### 5) Keyboard navigation test doesn’t actually test keyboard navigation
Test name: `supports keyboard navigation with ArrowDown and Enter`

**Problem:**
- It never sends `ArrowDown`.
- It sends `keyDown(planButton, Enter)` but then immediately does `fireEvent.click(planButton)`, so selection is still validated via click, not keyboard activation.

**Fix:**
- Use `userEvent.keyboard('{ArrowDown}{Enter}')` starting from a focused toggle.
- Assert focus moves as expected and that selection happens without a click.

---

### 6) Global `fetch` stubbing teardown may be incomplete (`vi.restoreAllMocks()` may not undo `vi.stubGlobal`)
**Problem:** The tests use `vi.stubGlobal('fetch', mockFetch)` but teardown uses `vi.restoreAllMocks()`. In Vitest, `stubGlobal` is typically undone via `vi.unstubAllGlobals()` (or storing/restoring manually). If `fetch` remains stubbed beyond this file, other tests may be impacted.

**Fix:**
- Add `vi.unstubAllGlobals()` in `afterEach` (or `afterAll`) in addition to `restoreAllMocks()`.

---

### 7) Shared `mockFetch` instance is not reset between tests
`mockFetch` is defined once and reused; `beforeEach` sets an implementation but does not `mockFetch.mockReset()`/`mockClear()`. While you currently don’t assert call counts, this is still shared mutable state and can become a source of confusion/flakiness as tests evolve.

**Fix:** In `beforeEach`, do `mockFetch.mockReset()` then set the implementation.

---

## LOW

### 8) Minor test hygiene / clarity issues
- `App.routing.test.tsx` imports `beforeEach` but doesn’t use it.
- Multiple `waitFor()` calls after synchronous `setState` updates add noise (not wrong, but reduces signal).
- Heavy reliance on `data-testid` in routing tests is acceptable, but for interaction-driven behavior, prefer role/name queries where practical (already done well in PermissionMode tests).

---

## Summary
CRITICAL: 2  
HIGH: 2  
MEDIUM: 3  
APPROVED: NO
