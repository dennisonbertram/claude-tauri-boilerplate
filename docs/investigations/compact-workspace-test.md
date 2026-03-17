# Browser Automation Test Results: /compact, Workspace Chat, Shortcuts, Layout

**Date:** 2026-03-17
**Tester:** Claude (automated browser testing via mcp__claude-in-chrome)
**App URL:** http://localhost:1420/

---

## Test 1: /compact Command

### Steps
1. Opened Chat tab, selected "Test Rename Session" (has a "Hello world!" message)
2. Typed `/` in chat input — command palette appeared showing: `/clear`, `/new`, `/help`, `/compact`, `/settings`
3. Typed `compact` to filter, pressed Enter
4. Waited 3 seconds, checked for toast notification at bottom-right

### Result: BUG — Toast not appearing

The `/compact` command is **registered** in `useCommands.ts` and its `execute` handler calls:
```ts
toast.info('Context compaction is automatic', {
  description: 'Configure Auto-Compact in Settings → Advanced',
  duration: 6000,
  action: { label: 'Open Settings', onClick: () => context.showSettings?.() },
});
```

The `Toaster` component **is** present in `App.tsx` (line 357, `position="bottom-right"`, `theme="dark"`). However, the toast does **not appear** when the command fires. No error is logged in the console.

**Observed behavior:** Command palette closes, nothing else happens. No toast, no confirmation, no visual feedback of any kind.

**Severity:** Medium — The command runs silently. Users get no feedback and have no idea it did anything.

**Likely cause:** The `Toaster` component is placed outside the `SettingsProvider` wrapper in `App.tsx` (after the closing `</SettingsProvider>` tag, line 357). This may cause a context or rendering order issue, but needs further investigation since Sonner's `toast()` is a global singleton that should not require provider proximity.

---

## Test 2: Workspace Chat Integration

### Steps
1. Switched to Workspaces tab — "ui-test-ws" workspace was pre-selected
2. Workspace shows: name "ui-test-ws", path "workspace/ui-test-ws", status "Ready"
3. Typed "what files are in this repo?" and pressed Enter
4. Waited for response

### Result: PARTIAL BUG — Stream drops with "network error Reconnecting..."

**First attempt:**
- User message sent, "Claude is thinking..." appeared with timer
- Status bar showed "Bash" (Claude was running a bash command to explore the repo)
- At ~0:19 seconds, a "network error Reconnecting..." banner appeared at bottom
- The banner offered "Retry" and a dismiss (×) button
- Stream never recovered — no text appeared in the chat
- The "Bash" indicator remained in the status bar

**After clicking Retry:**
- Retry sent a **duplicate message** ("what files are in this repo?" appeared twice in the chat)
- Claude was re-invoked fresh, not resuming the dropped stream
- Second attempt succeeded — response streamed in fully within ~15 seconds
- Response was well-formatted markdown with repo structure breakdown (Root, apps/desktop, apps/server, packages/shared, docs/ sections)
- Cost indicator "$0.05" and suggested reply chips appeared correctly

**Issues found:**
1. **Stream drops under load** — workspace chat SSE connection dropped when Claude was running a bash tool. This may be a timeout or keepalive issue in the Hono SSE route for workspaces.
2. **Retry sends duplicate message** — The Retry button should reconnect to the existing in-flight agent session, not send a new message. This causes context duplication.
3. **No partial text streaming** — Before the network error, zero text had been rendered. The "Claude is thinking..." spinner showed the entire time without any tokens arriving. This suggests the SSE stream for workspace chat may buffer until tool calls complete.

**Working correctly:**
- Workspace chat uses the worktree path as cwd (confirmed by Claude being able to list the repo files)
- Response rendered with proper markdown formatting
- Cost tracking worked ($0.05 shown in status bar)
- Suggested reply chips generated correctly

---

## Test 3: Keyboard Shortcuts

| Shortcut | Expected | Result | Notes |
|----------|----------|--------|-------|
| Cmd+/ | Toggle sidebar hide/show | WORKS | Sidebar toggled off, then back on with second press |
| Cmd+K | Open command palette | PARTIAL | Shows slash-command popup in chat input, not a full overlay palette. Cmd+K is handled in `useCommandPalette.ts` line 121 but appears to interact with chat input focus behavior |
| Cmd+N | Create new session | DOES NOT WORK | No new session created. Shortcut registered in `ChatPage.tsx` (key: 'n', meta: true) calling `onCreateSession?.()`. Likely intercepted by macOS/browser as "New Window" before reaching the app |
| Cmd+, | Open Settings | NOT TESTED (tested separately) | Registered in App.tsx global handler |

### Cmd+N Analysis
The shortcut is defined in `ChatPage.tsx`:
```ts
{
  id: 'new-session',
  key: 'n',
  meta: true,
  label: 'New Session',
  category: 'chat',
  handler: () => onCreateSession?.(),
}
```
`useKeyboardShortcuts` calls `e.preventDefault()` before `shortcut.handler()`, so preventDefault should stop browser default. However, on macOS, Cmd+N is a system-level shortcut for "New Window" that may be intercepted before the browser keydown event fires. This is a known macOS limitation. Consider using a different key combination or only relying on the `/new` command.

### Cmd+K Analysis
Cmd+K is handled in `useCommandPalette.ts` with a global `window.addEventListener('keydown', ...)` handler. When triggered, `isOpen` is false so it should call `openPalette()`. However, what was observed was the slash-command dropdown appearing in the chat input, suggesting the Cmd+K may be focusing the text input first (browser default behavior for Cmd+K in some contexts), and then the `"/"` character detection on the input is being triggered. The palette opened as the slash-command dropdown rather than a modal overlay — this may be by design or may be a confusion between two interaction patterns.

---

## Test 4: Window/Layout Edge Cases

### At 600px width
- Sidebar (280px fixed) and chat area (remaining ~320px) still show side-by-side
- Chat input and send button mostly visible, send button slightly tight
- Suggested reply chips wrap to multiple lines (good responsive behavior)
- Functional but cramped

### At 450px width — LAYOUT BREAKAGE
- Sidebar takes ~280px, chat area only ~170px
- "Hello world!" message text wraps awkwardly to 2 lines in a tiny bubble
- Send button nearly entirely hidden (only icon tip visible)
- Chat input text "Tell me more" truncated
- The persistent tooltip ("Say 'hello world' in exactly 3 words") expands to 4 lines and occupies a large portion of the visible chat area
- Layout is technically rendered but barely usable

**Recommendation:** The 280px fixed sidebar has no minimum window width guard. Consider adding `min-width: 600px` on the root container or hiding the sidebar automatically below a threshold.

---

## Additional Finding: Persistent Tooltip "Say 'hello world' in exactly 3 words"

A tooltip/popover with text "Say 'hello world' in exactly 3 words" appeared in the top-right of the chat area and **persisted across all tests**. It did not dismiss on click, page navigation, or tab switching.

**Source:** This comes from the `Agentation` component (`import { Agentation } from 'agentation'` in App.tsx line 23), which is rendered in dev mode only (`{import.meta.env.DEV && <Agentation />}`). This is the agentation visual feedback tool added in the most recent commit. The tooltip represents a pending agentation task/annotation that was not dismissed.

This is **dev-only** and will not appear in production builds. Not a bug in the production app.

---

## Summary of Bugs Found

| # | Severity | Description |
|---|----------|-------------|
| 1 | Medium | `/compact` toast notification never appears — `toast.info()` fires silently |
| 2 | High | Workspace chat SSE stream drops under load (network error at ~20s) |
| 3 | High | Retry button sends a duplicate message instead of reconnecting existing stream |
| 4 | Low | No partial token streaming in workspace chat during tool calls (all-or-nothing) |
| 5 | Low | Cmd+N shortcut does not create a new session (likely OS-level interception on macOS) |
| 6 | Low | Layout breaks at narrow widths (<500px) — sidebar has no min-width guard |
