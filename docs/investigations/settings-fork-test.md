# Settings & Fork Session Deep-Dive Test

**Date:** 2026-03-17
**Tester:** Browser automation (Claude Code)
**App URL:** http://localhost:1420/

---

## Summary

Five manual browser automation tests were run on the claude-tauri-boilerplate app. Found **5 bugs** ranging in severity from cosmetic to functional-blocking.

---

## Test 1: Settings → Advanced Tab

**Status: PASS (with caveats — see Bug #1)**

### Findings

The Advanced tab contains exactly 3 settings (no more, no less):

| Setting | Current Value | Description |
|---------|--------------|-------------|
| Permission Mode | Default (dropdown) | How Claude handles actions that need approval |
| Auto-Compact | OFF (toggle) | Automatically compact conversation when context is large |
| Max Turns | 25 (number input) | Maximum agentic round trips per request |

The Auto-Compact toggle is **currently disabled** (OFF), which explains why /compact triggers a toast informing the user that compaction is automatic and directing them to Settings → Advanced.

### Access Issue

Accessing the Advanced tab required JavaScript workarounds during this test because the toast notification banner was physically overlapping the Settings tab row, intercepting clicks. See **Bug #1**.

---

## Test 2: Settings → Model Tab

**Status: PASS**

### Findings

The **Model tab is misnamed** relative to its contents — it does NOT contain the model selector. It contains:

| Setting | Current Value | Description |
|---------|--------------|-------------|
| Temperature | 1.0 (slider) | Controls randomness |
| System Prompt | "You are a helpful assistant..." (textarea) | Custom instructions prepended to every chat |
| Thinking Effort | High (dropdown) | Controls how much effort Claude puts into reasoning |

The **model selector** (AI model to use for conversations) is in the **General tab**, not the Model tab. This is a UX taxonomy bug — users looking to change models would go to "Model" tab first.

### Model Selector Test

Confirmed model options available:
- Sonnet 4.6 (default)
- Opus 4.6
- Haiku 4.5

Changing the model to Haiku 4.5 via JavaScript (required because `<select>` native behavior worked) updated the status bar from "Sonnet 4.6" to "Haiku 4.5" immediately. Model selection **persists in the status bar** correctly.

---

## Test 3: Fork Session Flow

**Status: PARTIAL PASS — Bug found**

### Findings

**Fork creation works correctly:**
- Right-clicking a session shows context menu: Rename, Fork, Export JSON, Export Markdown, Delete
- Clicking "Fork" creates a new session named "[Original Title] (fork)"
- The forked session appears at the top of the sidebar list
- The forked session **displays** the parent's messages in the UI (messages are DB-copied)

**Fork context is NOT passed to Claude (Bug #2):**

When a new message was sent in the forked session ("What was the first message in this conversation?"), Claude responded:

> "The first message in this conversation was your question: 'What was the first message in this conversation?' That is the only message that has been sent in this conversation — there are no prior messages before it."

The fork creates a new Claude SDK session from scratch. The messages displayed in the UI are cosmetic — they are copied from the DB but NOT loaded into the Claude conversation context. A true fork should resume from the copied message history.

**Root cause:** `forkSession` in `useSessions.ts` calls `POST /api/sessions/:id/fork` which creates a new session via `createSession()` (before messages are copied) and returns the bare session object. The fork response does NOT include `claudeSessionId` or `messageCount`. When the frontend later sends a message, it starts a fresh `query()` call with no `resume` option pointing at the original session's context.

---

## Test 4: /compact Command Toast

**Status: PASS (toast works — with a stacking bug)**

### Findings

Typing `/compact` and selecting it from the command palette closes the palette and triggers the toast notification system. The toast content:

```
Context compaction is automatic
Configure Auto-Compact in Settings → Advanced
[Open Settings button]
```

This toast is **correct and expected behavior** — it tells the user that auto-compact is already set to automatic and how to configure it.

**Bug #3 — Toast stacks indefinitely:**

Each invocation of `/compact` (or any action that triggers this toast) adds a new toast instance to the Sonner notification list. After multiple interactions with Settings (clicking "Open Settings" from the toast, navigating tabs), the DOM showed **7 toast instances** stacked:
- 4 × "Context compaction is automatic"
- 3 × "Session exported: [filename].json/md" (from earlier Export JSON/Markdown actions)

Toasts have no auto-dismiss timeout and no close button visible. The user has no way to dismiss them without refreshing the app.

**Secondary observation:** The "Say 'hello world' in exactly 3 words" toast appeared at one point — this is likely a test/demo toast left in the codebase that triggers under certain conditions. Not confirmed.

---

## Test 5: Empty State Welcome Screen

**Status: BLOCKED — New Chat button broken (Bug #4)**

### Findings

Neither the "New Chat" button nor the `/new` slash command created a new session during testing. The app stayed on the active forked session. No new session appeared in the API (`GET /api/sessions` still returned 22 sessions after multiple attempts).

**Root cause confirmed via source code review:**

`handleNewChat` in `App.tsx` (lines 96-109) guards against creating a new session when `isTrulyEmpty`:

```typescript
const isTrulyEmpty = activeSession &&
  (activeSession.messageCount ?? 0) === 0 &&
  !activeSession.claudeSessionId;
if (activeSessionId !== null && isTrulyEmpty) {
  return;  // ← silently blocks
}
```

The forked session in React state has `claudeSessionId: undefined` and `messageCount: undefined` because the `/fork` endpoint returns the session object from `createSession()` BEFORE messages are copied, so neither field is populated in the response:

```typescript
// sessions.ts route:
const forkedSession = createSession(db, newId, title);
// ... messages are copied here ...
return c.json(forkedSession, 201);  // ← returned before messageCount/claudeSessionId are set
```

Therefore `isTrulyEmpty` evaluates to `(undefined ?? 0) === 0 && !undefined` = `true && true` = **true**, and New Chat is blocked.

This is a pre-existing bug tracked as issue #144 (same root cause documented in `bug-144-test.md`), but the prior fix using `messageCount` does not solve it for fork sessions because the fork response doesn't include `messageCount`.

**Workaround to view welcome screen:** To trigger the empty state `WelcomeScreen` component, `activeSessionId` must be `null`. This only happens when there are no sessions at all.

---

## Bug Summary

| # | Severity | Description |
|---|----------|-------------|
| Bug #1 | Medium | Toast notification overlaps Settings tab row, intercepting clicks and blocking tab navigation without JS workarounds |
| Bug #2 | High | Fork session does not load parent message history into Claude context — fork is UI-only, Claude starts fresh |
| Bug #3 | Low | Toast notifications stack indefinitely with no auto-dismiss and no close button |
| Bug #4 | High | "New Chat" button and `/new` command silently fail when a forked session is the active session (isTrulyEmpty guard misfires because fork API response omits messageCount and claudeSessionId) |
| Bug #5 | Low (UX) | Model selector is in "General" tab, not "Model" tab — wrong tab taxonomy |

---

## Settings Tab Inventory

All 9 tabs in the Settings panel:

| Tab | Contents |
|-----|---------|
| General | API Key, Model selector, Max Tokens slider |
| Model | Temperature, System Prompt, Thinking Effort |
| Appearance | (not tested this session) |
| Instructions | CLAUDE.md Files list, + Create CLAUDE.md button |
| Memory | (not tested this session) |
| MCP | (not tested this session) |
| Hooks | (not tested this session) |
| Advanced | Permission Mode, Auto-Compact toggle, Max Turns |
| Status | (not tested this session) |

---

## Files Referenced

- `/Users/dennisonbertram/Develop/claude-tauri-boilerplate/apps/desktop/src/App.tsx` — `handleNewChat` guard logic (lines 96-109)
- `/Users/dennisonbertram/Develop/claude-tauri-boilerplate/apps/desktop/src/hooks/useSessions.ts` — `forkSession` and `createSession` (lines 21-62)
- `/Users/dennisonbertram/Develop/claude-tauri-boilerplate/apps/server/src/routes/sessions.ts` — Fork route returning pre-copy session (lines 85-123)
- `/Users/dennisonbertram/Develop/claude-tauri-boilerplate/apps/desktop/src/hooks/useCommands.ts` — `/new` command wiring (line 36-40)
- `/Users/dennisonbertram/Develop/claude-tauri-boilerplate/apps/desktop/src/components/chat/ChatPage.tsx` — Command context with `createSession: onCreateSession ?? (() => {})` (line 268)
