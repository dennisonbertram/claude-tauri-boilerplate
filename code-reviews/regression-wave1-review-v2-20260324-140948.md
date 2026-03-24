## CRITICAL
- None found.  
  - Verified fix #1: `App.routing.test.tsx` imports and uses **real** `pathToView` from `@/lib/routes` (production code), not a test-only implementation.
  - Verified fix #2: `#353` is now modeled correctly with **(a)** a `stopPropagation` test and **(b)** a “broken version” comparison test.

## HIGH
- None found.  
  - Verified fix #3 (as implemented): `pathToView` now has explicit “HashRouter awareness” edge-case coverage for **deep nested paths** (which is what HashRouter-derived `pathname` looks like in React Router).

## MEDIUM
1. **Keyboard regression test doesn’t assert the keyboard action actually selects/updates state**  
   - In `PermissionMode.regression.test.tsx`, the test *“supports keyboard interaction — Enter on focused option selects it”* only asserts `tagName === 'BUTTON'`. It does **not** verify that pressing Enter triggers the same behavior as clicking (e.g., localStorage `permissionMode` changes, dropdown closes, UI label updates, etc.).  
   - Recommended: after `keyDown/keyUp`, assert the stored setting changed to `"plan"` (or whatever the expected value is) and/or that the dropdown closed.

2. **Potential async flakiness in fork-session tests due to “fire-and-forget” async handler**  
   - In `App.routing.test.tsx`, the click handler is `onClick={() => void handleForkSession('sess-1')}`. Because it’s explicitly not awaited, assertions could race the state update depending on scheduling.  
   - Recommended: `await waitFor(() => expect(...current-path...).toBe('/chat'))` in the “returns to /chat from teams view” test (at least).

3. **`#353` “prevents bubbling” test does not actually assert the spy was not called**  
   - Test creates `parentClickSpy` but never asserts `expect(parentClickSpy).not.toHaveBeenCalled()`.  
   - The test still asserts the important routing outcome (path stays `/workspaces`), but the stated intention (“prevents parent event bubbling”) is only partially verified.

## LOW
1. **“query-like suffixes” test is slightly misleading relative to React Router inputs**  
   - `pathToView('/chat?session=123')` is tested, but React Router provides `pathname` without `search`. This doesn’t break anything, but it documents a scenario that typically shouldn’t occur unless callers pass a non-normalized string.

2. **Some assertions are brittle to UI evolution**
   - Example: expecting exactly `5` buttons in the permission segment (toggle + 4 options). If any new button is added (e.g., help/tooltip), tests may fail even though behavior is correct.

---

### Verification of previously reported issues
- (1) Harness vs real code: **Fixed as requested** (real `pathToView` is used).  
- (2) #353 didn’t model bug mechanism: **Fixed** (stopPropagation + broken-version test).  
- (3) HashRouter hash tests: **Addressed via deep-path edge cases** (no literal `#/` coverage, but consistent with the comment that HashRouter passes clean `pathname`).  
- (4) “Normal” button ambiguity: **Fixed** (scoped to dropdown buttons via `within(segment)` and slicing).  
- (5) Keyboard test didn’t test keyboard: **Partially fixed** (it sends Enter, but doesn’t assert effect) → still **MEDIUM**.  
- (6) Missing `vi.unstubAllGlobals()`: **Fixed**.  
- (7) Missing `mockFetch.mockReset()`: **Fixed**.

---

CRITICAL: 0  
HIGH: 0  
MEDIUM: 3  
APPROVED: YES
