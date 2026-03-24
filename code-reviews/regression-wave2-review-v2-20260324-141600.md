## CRITICAL

- None found.

## HIGH

### TeamWorkspace.agents.test.tsx
1) **Cancel-remove test uses brittle DOM traversal / selector**
- **Test:** `cancel remove dismisses confirmation...`
- **Problem:** Locates the cancel button via:
  ```ts
  const confirmRow = screen.getByTestId('confirm-remove-agent-researcher').parentElement!;
  const cancelBtn = confirmRow.querySelector('button:last-child')!;
  ```
  This is highly coupled to markup/order. A small refactor (wrapping elements, reordering buttons, adding another button) will break the test or click the wrong control.
- **Fix:** Query the Cancel button by role/name (or add a stable testid):
  - `within(confirmRow).getByRole('button', { name: /cancel/i })`
  - or `getByTestId('cancel-remove-agent-researcher')`

## MEDIUM

### TeamWorkspace.agents.test.tsx
1) **Overly strict `toHaveBeenCalledWith` agent payload**
- **Test:** `successful add calls onAddAgent with agent definition`
- **Problem:** Asserts the *entire* object including defaults:
  ```ts
  { name, description, model: undefined, tools: [], permissionMode: 'normal' }
  ```
  This is brittle if the implementation:
  - omits `model` instead of setting `undefined`
  - changes defaults (e.g., tools default `undefined`)
  - adds new fields
- **Fix:** Use partial matching:
  ```ts
  expect(mockOnAddAgent).toHaveBeenCalledWith('team-1', expect.objectContaining({
    name: 'new-agent',
    description: 'Does new things',
  }));
  ```

2) **Async remove test doesn’t await effects**
- **Test:** `confirm remove calls onRemoveAgent`
- **Problem:** If the component invokes `onRemoveAgent` after state updates/microtasks, the assertion can become flaky.
- **Fix:** `await waitFor(() => expect(mockOnRemoveAgent)... )` and prefer `userEvent`.

3) **Interaction realism: heavy use of `fireEvent` for user flows**
- **Problem:** `fireEvent` skips important user semantics (focus management, keyboard interactions closer to real usage). For dialogs/forms, this can mask issues.
- **Fix:** Prefer `userEvent` (`user.click`, `user.type`, `user.keyboard`).

4) **Missing negative-path coverage for regression intent**
- Not covered: `onAddAgent` resolves `false`/throws → dialog should remain open and show error; same for `onRemoveAgent` failure. For a regression suite, these are common edge cases worth pinning down.

### WorkspacePanelHeader.rename.test.tsx
5) **Keyboard simulation may not match real behavior**
- **Tests:** `Enter key saves...`, `Escape cancels...`
- **Problem:** Uses `fireEvent.keyDown`. If the component logic is on `keyUp`/`onKeyPress` (or relies on composed events), tests may be misleading/flaky across refactors.
- **Fix:** Use `userEvent.keyboard('{Enter}')` / `userEvent.keyboard('{Escape}')` with focused input.

6) **“Empty or unchanged” test doesn’t assert edit mode actually exited**
- **Test:** `empty or unchanged name is discarded...`
- **Problem:** It waits for the original text, but doesn’t assert the textbox is gone in that test (unlike the Escape test). A bug where both are visible could slip through.
- **Fix:** Also assert input removal:
  ```ts
  expect(screen.queryByRole('textbox', { name: 'Rename workspace' })).not.toBeInTheDocument();
  ```

7) **Styling-coupled assertion**
- **Test:** `workspace name is clickable...` checks `cursor-pointer` class.
- **Problem:** Clickability is behavioral; classnames are implementation details and can cause unnecessary failures.
- **Fix:** Prefer asserting that click enters edit mode (which you already do) and drop the classname check, or assert `role="button"` semantics if applicable.

### WelcomeScreen.profiles.test.tsx
8) **Visual selection test tightly coupled to Tailwind classnames**
- **Test:** `visually indicates the selected profile`
- **Problem:** Asserting exact classes like `border-primary` / `bg-primary/10` is brittle to styling refactors.
- **Fix:** Prefer accessible state (`aria-pressed`, `aria-selected`), `data-state="active"`, or a single stable class/data-attr meant for tests.

## LOW

### WelcomeScreen.profiles.test.tsx
1) **Assertions use `toBeDefined()` / `toBeNull()` instead of jest-dom matchers**
- `getByText` already throws if missing, so `toBeDefined()` is redundant.
- Prefer `toBeInTheDocument()` / `not.toBeInTheDocument()` for clarity and consistency.

2) **Shared `defaultProps` contains `vi.fn()` not reset**
- Currently not asserted against, so low risk, but can surprise later if tests start checking calls. Consider recreating per test or resetting mocks.

---

CRITICAL: 0  
HIGH: 1  
MEDIUM: 8  
APPROVED: NO
