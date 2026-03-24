## CRITICAL

1) **`src/__tests__/App.routing.test.tsx` does not test production routing; it tests a re-implemented harness**
- The “regression tests” for **#352 fork session** and **#353 Add Project bubbling** are validating behavior of `RoutingHarness` (local `useState` + copied callbacks), not the real `App.tsx` wiring, React Router/HashRouter integration, or the actual components that regressed.
- This can easily **pass while the real app is broken** (e.g., App reintroduces `navigate('/workspaces')` after fork, or loses `stopPropagation` in the real button). The test suite would still be green because the harness still contains the “fixed” behavior.
- Net: **false confidence on the exact regressions the file claims to cover**.

**Fix direction:** render the actual `App` (or the real sidebar/header component that contains the fork/add-project click targets) inside a real `HashRouter`, and assert against `window.location.hash` / router location + rendered view.

---

## HIGH

1) **Async race in fork-session tests (`App.routing.test.tsx`)**
- The click handler is invoked as `onClick={() => void handleForkSession('sess-1')}` which **intentionally discards the promise**.
- Tests wrap `fireEvent.click` in `act(async () => { ... })`, but since the promise is swallowed, React Testing Library/vitest are not guaranteed to wait for:
  - `await forkSession(id)` to resolve
  - the subsequent state update `setCurrentPath('/chat')`
- Assertions immediately after can be **flaky** (timing-dependent) and can also **miss intermediate navigation** if the real code becomes more complex.

**Fix direction:** don’t discard the promise in the test harness; or `await waitFor(() => expect(...path...).toBe('/chat'))` after the click.

2) **`PermissionMode.regression.test.tsx`: fake timers enabled but never advanced → timer-driven logic can be completely untested**
- `vi.useFakeTimers()` is enabled for every test, but there is **no `runAllTimers/advanceTimersByTime`** anywhere.
- If `StatusBar`/dropdown logic uses `setTimeout`/`setInterval` (polling diagnostics/health, debounced settings persistence, delayed close, etc.), those code paths will **never execute**, so tests can pass while real users hit crashes from timer callbacks.

**Fix direction:** avoid fake timers unless necessary; otherwise explicitly advance timers and flush promises. If you need fake timers for polling, add assertions that polling ran.

3) **`WorkspacePanelHeader.rename.test.tsx`: missing “double-submit”/duplicate-save protection (data integrity risk)**
- Common real-world sequence: press **Enter** to submit → component exits edit mode → input unmount/blur fires → blur handler submits again.
- Current tests assert “Enter calls onRename” and “blur calls onRename” separately, but never assert **only one call** happens when both events occur in one user flow.
- This can cause duplicate API calls and inconsistent workspace names (esp. if backend is not idempotent).

**Fix direction:** add a test that simulates Enter then blur/unmount and asserts `onRename` called **exactly once**.

---

## MEDIUM

1) **`App.routing.test.tsx`: the “fixed bubbling” test doesn’t actually assert non-bubbling**
- In `fixed Add Project button prevents parent event bubbling`, `parentClickSpy` is never asserted (`expect(parentClickSpy).not.toHaveBeenCalled()` is missing).
- You only assert `current-path` stayed `/workspaces`, but the outer spy is the direct contract for `stopPropagation`.

2) **`App.routing.test.tsx`: no error/reject path for forkSession**
- Real users hit failures (network, filesystem, backend errors). There’s no test for:
  - `forkSession` rejects
  - expected behavior (stay on current view? show error? still navigate to `/chat`?)
- Current tests only cover the happy-path and can hide “failed fork navigates anyway” regressions.

3) **`App.routing.test.tsx`: “broken version” test asserts buggy behavior**
- The test that expects the broken button to navigate to chat is not a regression guard; it’s a *demonstration*.
- This can confuse future maintainers and provides no protection for production code.

4) **`PermissionMode.regression.test.tsx`: keyboard test doesn’t verify selection actually happened**
- “supports keyboard interaction” only checks `tagName === 'BUTTON'`.
- It does not assert mode changed, dropdown closed, label updated, or localStorage updated—so it can pass even if Enter does nothing.

5) **`PermissionMode.regression.test.tsx`: persistence test may not reflect real persistence timing**
- The localStorage assertion assumes immediate synchronous write. If `SettingsProvider` persists asynchronously/debounced, this test either becomes flaky or starts asserting the wrong contract.
- With fake timers, debounced persistence may never run at all (compounds with HIGH timer issue).

6) **`TeamWorkspace.agents.test.tsx`: remove confirm test is not awaited + no failure-state coverage**
- `confirm remove calls onRemoveAgent` does not `await waitFor(...)`. If the component awaits confirmation UI updates / async handler scheduling, this can race.
- No tests for:
  - `onAddAgent` resolves `false` / throws → dialog should remain open and show error
  - `onRemoveAgent` resolves `false` / throws → confirmation should remain and show error
  - pending state disables buttons (double-submit/double-remove)

7) **`routes.test.ts`: missing very common path shapes**
- `pathToView` is not tested for `/chat/<sessionId>` (even though routes support it).
- No trailing slash (`/chat/`), hash-fragment input (`#/chat`) defensive handling, or weird-but-real inputs.
- The “query-like suffixes” test is arguably mismatched to React Router behavior (`pathname` won’t include `?`), so it may encode an unnecessary contract.

8) **`WelcomeScreen.profiles.test.tsx`: important interactions not covered**
- No test that clicking **Default** calls `onSelectProfile(null)` (or whatever the intended behavior is).
- The “selected profile styling” test is tightly coupled to class strings; it doesn’t verify accessibility state (`aria-pressed`, `aria-selected`) or even role semantics.

---

CRITICAL: 1  
HIGH: 3  
MEDIUM: 8  
APPROVED: NO
