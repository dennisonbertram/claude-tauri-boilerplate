# UX Bug Fixes Plan Review

**Reviewer:** GPT-5.4 (reasoning_effort: high)
**Date:** 2026-03-23
**Plan reviewed:** `docs/plans/ux-bug-fixes-plan.md`

---

## Overall Assessment

The plan is directionally good, and the prioritization is mostly sensible. The biggest weaknesses are:

1. **#348 root cause is still speculative**
2. **#344 overestimates how much state a layout route will preserve**
3. There are **naming/model inconsistencies** (`workspaces` vs `/projects`, `agents` vs `/profiles`) that could create avoidable bugs during migration

---

## 1. Risks and Gaps

### A. #348: Permission mode crash plan is too hypothesis-driven

The diagnosis is plausible, but the fix candidates are still guesses (portal/z-index, event propagation, outside-click timing, unmount during selection). Before changing code you should **capture the actual runtime error/stack** in the browser/Tauri WebView.

**Actionable feedback:**
- Reproduce in a real browser/WebView and get: console error, React component stack, whether it's an exception, blank screen, or stuck UI
- Check whether `updateSettings()` is synchronous, async, or capable of rejecting
- If `updateSettings` is async and called without `await`/`catch`, an **unhandled rejection** may be the real crash

**Additional likely causes not listed:**
- Invalid settings value: persisted permission mode might not match available options
- StrictMode double effects causing document listeners to register oddly
- Ref/outside click logic not accounting for portaled content
- Focus/blur ordering: clicking an option may trigger blur/outside-close before the option handler runs

**Recommendation:** Add a real interaction regression test, but also add at least one **browser-level integration test**. JSDOM unit tests won't reliably catch focus/portal issues.

### B. #344: State preservation gap

The plan says "AppLayout stays mounted (layout route) -- no state loss." That's only partially true. A layout route preserves **layout-level state**, but **child route elements still unmount/remount** when you switch views.

**Actionable feedback:** Before the routing refactor, make a state audit:

| State | Current owner | Must survive route changes? | Strategy |
|---|---|---|---|
| `settingsOpen` | AppLayout | Yes | keep in layout |
| `openSessionIds` | AppLayout | Probably yes | stays in layout (safe) |
| `pendingMessage` | AppLayout | Decide explicitly | stays in layout (safe) |
| workspace filters/search | route component | Maybe | decide per UX |
| scroll position | route component | usually no | accept reset or preserve manually |
| team/workspace selection | state | yes | URL source of truth |

### C. Path naming is inconsistent

Current views are: `chat`, `teams`, `workspaces`, `agents`, `documents`, `tracker`. But proposed routes include: `/projects`, `/profiles`, `/search`. That mismatch will create unnecessary mapping logic.

**Actionable feedback:** Use canonical route names that match the app's user-facing terminology, or introduce explicit route alias redirects and document why.

### D. #354 and #350 need explicit async/error UX

The plans focus on happy-path functionality, but not enough on mutation UX: loading state, disable controls while saving, error toast/inline error, optimistic update vs refetch, rollback on failure.

### E. Testing strategy is too unit-test-heavy

For dropdown crashes, routing/back-forward, dialogs and focus traps, keyboard shortcuts -- you'll want some **integration/e2e coverage**, not just component tests.

---

## 2. Implementation Order

**Verdict: Mostly correct.**

The proposed order (348 -> 354 -> 350 -> 344) is sensible from a risk perspective.

**One caveat:** Both #354 and #350 mention wiring through `App.tsx`, and #344 is a large `App.tsx` refactor. If multiple engineers work in parallel, routing-last is still fine, but it will create **merge/rebase friction**.

**Optional improvement:** Split #344 into smaller commits:
1. Introduce route constants/helpers
2. Extract view outlet components
3. Switch to router
4. Add deep-link/history tests

---

## 3. Edge Cases Not Covered

### #348 dropdown edge cases
- Selecting a mode when `updateSettings` rejects
- Current `permissionMode` is invalid/unknown
- Rapid double-click on the trigger
- Keyboard navigation (Enter/Space opens, Arrow keys move, Enter selects, Escape closes)
- Focus restoration to trigger after close
- Dropdown clipped by parent overflow
- Component unmount while dropdown is open
- Don't use `flushSync` unless confirmed necessary

### #354 workspace rename edge cases
- Click name -> edit -> click outside: save or cancel? Define behavior
- Unchanged name -> should no-op, no API call
- Whitespace-only name -> reject after trim
- Backend validation failure -> show error and restore edit state
- Network failure -> don't silently revert without feedback
- Very long names / overflow handling
- Touch devices / no-hover environments
- Keyboard-only accessibility

### #350 add/remove agents edge cases
- Team has no agents yet
- Add dialog opened/closed repeatedly without stale state
- Duplicate name case sensitivity (`Agent` vs `agent`)
- Remove confirmation to prevent accidental deletion
- Remove last agent from team
- Add agent while another add/remove is in flight

**Bigger product question:** Are team agents supposed to be newly created inline, or selected from existing agents/profiles? Verify the intended domain model before building `AddAgentDialog`.

### #344 routing edge cases
- Invalid IDs in URL (`/chat/bad-id`, `/teams/missing`)
- Entity deleted while selected via URL
- Browser history spam from tab/session switching
- Navigation while settings overlay is open
- Hash router behavior if auth flow also uses `location.hash`
- Redirect loops from `<Navigate>` -- use `replace` on default/wildcard redirects

---

## 4. HashRouter Migration Strategy

**Verdict: Sound, with 3 caveats.**

1. **HashRouter is the right default for Tauri** -- no server-side fallback needed, works in dev and bundled app
2. **Verify auth does not depend on `location.hash`** -- if auth or OAuth callback handling uses URL fragments, HashRouter can conflict
3. **Prefer cleaner nested route structure:**

```tsx
<Route element={<AppLayout />}>
  <Route index element={<Navigate to="chat" replace />} />
  <Route path="chat">
    <Route index element={<ChatOutlet />} />
    <Route path=":sessionId" element={<ChatOutlet />} />
  </Route>
  <Route path="workspaces">
    <Route index element={<WorkspacesOutlet />} />
    <Route path=":workspaceId" element={<WorkspacesOutlet />} />
  </Route>
  {/* ... etc */}
  <Route path="*" element={<Navigate to="chat" replace />} />
</Route>
```

---

## 5. State Preservation During Routing Migration

**This is the biggest thing to tighten up before implementation.**

### What the layout route *will* preserve
- `settingsOpen`, global providers, top-level app shell state, keyboard shortcut registration

### What it will *not* preserve automatically
- Drafts, selected tabs within a view, local filters/sorts, internal scroll positions, ephemeral form state, open dialogs inside a route

### Specific concerns
- `openSessionIds` -- safe only if it stays in layout (it does currently in AppLayout)
- `pendingMessage` -- safe only if it stays in layout (it does currently)
- `activeSessionId` synced to URL -- good, but avoid dual state. URL should be source of truth
- `selectedWorkspace` synced to URL -- same rule: avoid dual state

### Strong recommendation
Create a routing/navigation abstraction instead of pushing `useNavigate()` everywhere:

```ts
// routes.ts
export const routes = {
  chat: (sessionId?: string) => sessionId ? `/chat/${sessionId}` : '/chat',
  workspaces: (id?: string) => id ? `/workspaces/${id}` : '/workspaces',
  teams: (id?: string) => id ? `/teams/${id}` : '/teams',
  agents: (id?: string) => id ? `/agents/${id}` : '/agents',
  documents: '/documents',
  tracker: '/tracker',
}
```

Also use `NavLink` for shell navigation (sidebar/header tabs) for easier active state and better accessibility.

---

## 6. Per-Bug-Fix Assessment

### #348 -- Permission mode crash
**Verdict: Directionally correct, but too speculative.**
- Do runtime repro and stack capture before fixing
- Verify `updateSettings` signature (sync/async)
- Prefer using existing dropdown/menu primitive if one exists
- If using portal, ensure outside-click logic accounts for both trigger and menu refs

### #354 -- Workspace rename UI
**Verdict: Good fix location.**
- Adding rename to `WorkspacePanelHeader` is the right UX surface
- Decide blur behavior now (save or cancel?)
- Handle async save state and errors
- Consider removing/deprecating unused rename code in `ProjectSidebar.tsx`
- Suggested simpler prop: `onRenameWorkspace?: (id: string, name: string) => Promise<void> | void`

### #350 -- Add agents to existing team
**Verdict: Correct general direction, verify product model first.**
- Don't duplicate the form from `TeamCreationDialog` -- extract shared fields
- Decide whether the dialog creates new agents or links existing ones
- Missing: remove-agent UX details, confirmation behavior, refetch strategy

### #344 -- URL-based routing
**Verdict: Architecture is sound, details need tightening.**
- Use canonical path names (resolve `workspaces` vs `projects`, `agents` vs `profiles`)
- Use route builders/helpers
- Use `NavLink` where possible
- Handle invalid/deleted IDs
- Be deliberate about push vs replace history behavior
- Answer explicitly: should top-level view switches create history entries?

---

## Recommended Implementation Adjustments

1. **Add a pre-step for #348:** Reproduce in runtime, capture stack, inspect `updateSettings` signature, then decide fix
2. **Add a route/state audit before #344:** Checklist of all relevant UI state, where it lives, whether it must survive route changes
3. **Standardize route naming before migration:** Choose one vocabulary (`workspaces` or `projects`, `agents` or `profiles`)
4. **Introduce route helpers:** Centralized `routes.ts` with path builders
5. **Prefer `NavLink` for shell navigation**
6. **Treat async mutation UX as part of each fix:** pending state, error handling, disable duplicate actions, test failure cases
7. **Add at least one integration/e2e test for #348 and #344**

---

## Bottom Line

**What's strong:** Good issue prioritization, good scoping of #354 and #350, good high-level router direction, good instinct to add regression tests up front.

**What needs tightening:** #348 needs real repro evidence before choosing the fix, #344 needs explicit state ownership/preservation audit, route naming should be standardized, async/error/loading states need to be part of all mutation features, some important edge cases and history semantics are not yet defined.
