## CRITICAL

None found.

---

## HIGH

### 1) `src/__tests__/App.routing.test.tsx` — tests don’t exercise real router/App wiring
These “app-level routing” tests render a bespoke `RoutingHarness` that:
- does **not** use React Router (`HashRouter`, `useNavigate`, `useLocation`)
- does **not** render the real `App` (or any production routing components)
- duplicates navigation logic via `useState` (`setCurrentPath`) and comments claiming it’s “line-for-line” copied

This can easily drift from production behavior (e.g., actual `navigate()` semantics, hash routing configuration, pathname/search separation, route params), allowing regressions in real routing to slip through while tests still pass.

**Fix**: Prefer rendering the real `App` (or the production routing subtree) under a `HashRouter`/`MemoryRouter`, and assert on `location` (or visible routed UI) rather than a hand-rolled state variable.

---

## MEDIUM

### 1) `src/__tests__/App.routing.test.tsx` — “prevents parent bubbling” assertion doesn’t assert bubbling
Test: `fixed Add Project button prevents parent event bubbling`
- Creates `parentClickSpy` but **never asserts** `expect(parentClickSpy).not.toHaveBeenCalled()`.
- The test *only* asserts `current-path` stays `/workspaces`, which verifies the **inner** parent container didn’t run, but not that bubbling is prevented beyond that boundary (despite the test description/comment claiming that).

**Fix**: Add `expect(parentClickSpy).not.toHaveBeenCalled()` to validate the stated invariant.

---

### 2) `src/components/__tests__/PermissionMode.regression.test.tsx` — keyboard test doesn’t verify “selects it”
Test: `supports keyboard interaction — Enter on focused option selects it`
- Fires Enter, but the only assertion is `planButton.tagName === 'BUTTON'`.
- This does **not** verify selection occurred (no localStorage update, no UI change, no dropdown close).

**Fix**: Assert the actual outcome (e.g., settings/localStorage updated to `plan`, toggle label changed, dropdown closed, etc.).

---

### 3) `src/components/__tests__/PermissionMode.regression.test.tsx` — weak “all 4 options” verification
Test: `all 4 permission options are accessible as interactive buttons`
- Computes `options` but never asserts their presence/labels.
- Only asserts `allButtons.length === 5`, which is a brittle proxy and can pass even if the wrong buttons appear (or fail if extra buttons are added legitimately).

**Fix**: Assert each option explicitly by accessible name within the opened dropdown region.

---

### 4) `src/components/__tests__/PermissionMode.regression.test.tsx` — `fetch` mock signature may not match production usage
The mock implementation assumes `fetch(input: string | URL)` and ignores:
- `Request` objects (`fetch(new Request(...))`)
- the `init` argument
- other Response fields (`status`, `headers`, etc.)

If `StatusBar` switches to using `Request` or inspects response metadata, tests may break or (worse) miss behavior differences.

**Fix**: Type and implement the mock closer to `typeof fetch` (`(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>`), and return a more complete Response-like object.

---

### 5) `src/components/__tests__/TeamWorkspace.agents.test.tsx` — mock implementations can leak between tests
`beforeEach` uses `vi.clearAllMocks()`, which clears call history but **does not reset implementations**. Tests that set:
- `mockOnAddAgent.mockResolvedValue(true)`
- `mockOnRemoveAgent.mockResolvedValue(true)`
can leak that behavior into later tests in the file.

**Fix**: Use `vi.resetAllMocks()` or call `mockOnAddAgent.mockReset()` / `mockOnRemoveAgent.mockReset()` in `beforeEach`.

---

### 6) `src/components/__tests__/TeamWorkspace.agents.test.tsx` — async callback assertions not awaited
Test: `confirm remove calls onRemoveAgent`
- Does not `await` or `waitFor`.
If the component triggers removal after an async state transition, this can become flaky.

**Fix**: `await waitFor(() => expect(mockOnRemoveAgent).toHaveBeenCalledWith(...))`.

---

### 7) `src/components/__tests__/TeamWorkspace.agents.test.tsx` — unscoped “Cancel” lookup can hit wrong button
Test: `cancel remove dismisses confirmation...`
- Uses `screen.getByRole('button', { name: /cancel/i })` globally.
If the page has multiple Cancel buttons, the test can click the wrong one.

**Fix**: scope with `within(screen.getByTestId('confirm-remove-agent-researcher')).getByRole(...)` (or similar).

---

### 8) `src/components/chat/__tests__/WelcomeScreen.profiles.test.tsx` — assertions don’t verify what they imply
Several assertions use:
- `expect(screen.getByText(...)).toBeDefined()`

Because `getByText` throws if not found, `toBeDefined()` adds no meaningful verification (and doesn’t check visibility).

**Fix**: Use `toBeInTheDocument()` (and `toBeVisible()` if visibility matters).

---

## LOW

### 1) `src/__tests__/App.routing.test.tsx` — unused import
- `waitFor` is imported but not used.

### 2) `src/components/chat/__tests__/WelcomeScreen.profiles.test.tsx` — styling assertions are brittle
- Asserting Tailwind class tokens (`border-primary`, `bg-primary/10`) is sensitive to refactors. Prefer role/state assertions (e.g., `aria-pressed`, `aria-selected`) if available.

### 3) `src/lib/__tests__/routes.test.ts` — query-string tests may not reflect real router inputs
- React Router’s `location.pathname` excludes `?search`, so testing `pathToView('/chat?session=123')` documents a behavior that may never be used in production.

---

CRITICAL: 0  
HIGH: 1  
MEDIUM: 8  
APPROVED: NO
