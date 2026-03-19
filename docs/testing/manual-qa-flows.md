# Manual QA Testing Flows

**App:** claude-tauri-boilerplate
**URL:** http://localhost:1420
**Backend:** http://localhost:3131
**Last updated:** 2026-03-19
**Total flows:** 30

---

## Before You Start

1. Start the full stack: `pnpm dev:all` from the project root.
2. Confirm both services are up:
   - `curl http://localhost:3131/api/health` — must return `{"status":"ok"}` (or similar)
   - Browser at `http://localhost:1420` — must load without a blank white screen
3. Hard-reload the browser: **Cmd+Shift+R** (clears cached JS/CSS).
4. Open browser DevTools: **Cmd+Option+I**, then click the **Console** tab.
5. If an auth/connection screen appears, click **"Check Connection"** to resolve it before testing.
6. Zero JS errors in the console is the baseline. Any pre-existing errors must be noted and understood before you begin — do not start testing with an unknown error state.

**Known pre-existing console errors (as of 2026-03-19, not blockers):**
- `500` on `/api/workspaces/{id}/diff` — workspace diff polling, not yet implemented
- `500` on `/api/workspaces/{id}/changed-files` — changed-files polling, not yet implemented
- `500` on `/api/sessions/{id}/checkpoints` — checkpoint polling, not yet implemented

These can be ignored during testing unless the flow being tested specifically involves those endpoints.

---

## Quick Smoke Test (5 min)

Run these 5 flows **first**. If any fail, stop and investigate before running the full suite. These flows cover the app's core loop.

| # | Flow | Purpose |
|---|------|---------|
| 1 | First-Time Launch and First Chat | Verify the app launches and chat works end-to-end |
| 7 | Switching Between Chat and Workspaces Views | Verify the Activity Bar and view switching work |
| 13 | WorkspacePanel — Paths Tab | Verify workspace panel loads and tabs render |
| 27 | Settings — Integrations Group | Verify settings navigation works across all groups |
| 5 | Multi-Turn Conversation with Context | Verify context is maintained across turns |

---

## Full Flow Suite

**Tracking format per flow:**
- `[ ]` = not yet run
- `[x]` = run — mark as **PASS**, **FAIL**, or **ISSUE** with a note

---

## Category 1: Navigation and Layout

*Covers the Activity Bar, view switching, panel structure, and active-state indicators.*

---

### Flow 1: First-Time Launch and First Chat

**Goal:** Verify the app launches cleanly and a new user can send their first message.
**Regression:** No — baseline smoke test.

- [ ] **Step 1.** Open the app (or reload at `http://localhost:1420`). Verify it lands on the **Chat view** (not a blank screen, not a loading spinner that never resolves).
- [ ] **Step 2.** Verify the **Activity Bar** is visible on the left edge. It must contain icons in this order: Chat, Workspaces, Teams, Agents, and a gear (Settings) icon. A user avatar may appear at the bottom.
- [ ] **Step 3.** Verify the **CONVERSATIONS** sidebar header is visible. If no sessions exist, an empty state with guidance text should appear — not a blank white area.
- [ ] **Step 4.** Click the **New Chat** button in the sidebar (usually a `+` or pencil icon near the "CONVERSATIONS" header). Verify a new empty session opens in the main panel and the chat input receives focus automatically.
- [ ] **Step 5.** Type `Hello, what can you help me with today?` and press **Enter**.
- [ ] **Step 6.** Verify the **streaming response** appears token by token in the main panel. The user's message must be visible above the response.
- [ ] **Step 7.** Verify the new session appears in the **CONVERSATIONS** sidebar with an auto-generated title (not "New Chat" or blank) while or after the response streams.
- [ ] **Step 8.** Scroll up in the chat — verify the user message and the streamed response are both preserved in the view.
- [ ] **Step 9.** Check the console — zero new JS errors should have appeared.

**Expected result:** Session is created, message sends, response streams, and the session appears in the sidebar with a sensible auto-title.

---

### Flow 7: Switching Between Chat and Workspaces Views

**Goal:** Verify that clicking between Activity Bar icons switches views without data loss.
**Regression:** No — baseline navigation test.

- [ ] **Step 1.** Start in the **Chat view** with at least one session open and visible. Send a short message if needed to have some content.
- [ ] **Step 2.** Click the **Workspaces icon** (second icon) in the Activity Bar.
- [ ] **Step 3.** Verify the sidebar now shows a **PROJECTS** header (with workspace/project list or an empty state). The main panel should show workspace content — not the chat thread you just left.
- [ ] **Step 4.** Verify the Workspaces icon is **visually highlighted** in the Activity Bar and the Chat icon is not.
- [ ] **Step 5.** Click the **Chat icon** (first icon) in the Activity Bar.
- [ ] **Step 6.** Verify the sidebar shows **CONVERSATIONS** again. The previously open session must still be selected and visible in the main panel.
- [ ] **Step 7.** Verify the chat input is present, empty, and responsive to typing.
- [ ] **Step 8.** Click **Workspaces**, then immediately click **Chat**, then **Workspaces**, then **Chat** — four rapid switches. Verify no flickering, no blank panels, no stale content from the wrong view.
- [ ] **Step 9.** Verify the active Activity Bar icon always matches the currently displayed view with no lag.

**Expected result:** View switching is non-destructive. Active state in the Activity Bar is always correct. The last-open chat session is restored when returning to Chat view.

---

### Flow 24: Activity Bar Icon Active States

**Goal:** Verify the Activity Bar correctly highlights the active view at all times and never shows an ambiguous state.
**Regression:** No — UX correctness test.

- [ ] **Step 1.** Click the **Chat icon** — verify it is highlighted (active color/weight distinct from inactive icons).
- [ ] **Step 2.** Click the **Workspaces icon** — verify Chat becomes inactive, Workspaces becomes active.
- [ ] **Step 3.** Click the **Teams icon** — verify Workspaces becomes inactive, Teams becomes active.
- [ ] **Step 4.** Click the **Agents icon** — verify Teams becomes inactive, Agents becomes active.
- [ ] **Step 5.** Click the **gear icon (Settings)** — verify Agents becomes inactive, the gear is highlighted.
- [ ] **Step 6.** Press **Escape** to close Settings (or click the X if it is a modal). Verify the Activity Bar reverts to highlight the **last non-Settings view** you were on before opening settings.
- [ ] **Step 7.** Click Chat, Workspaces, Teams, Agents, Chat in rapid succession — verify the active highlight always matches the panel that is actually visible.
- [ ] **Step 8.** Verify there is **never a state where no icon is highlighted** (the app is always "in" a view).

**Expected result:** Active state is always accurate, immediate, and unambiguous. Rapid navigation does not desync the highlight.

---

## Category 2: Session Management

*Covers creating, renaming, searching, deleting, and forking sessions.*

---

### Flow 2: Creating a New Chat via Keyboard Shortcut

**Goal:** Verify Cmd+N creates a new chat session from the keyboard alone.
**Regression:** No — keyboard shortcut test.

- [ ] **Step 1.** With the app focused on the Chat view and at least one session visible, press **Cmd+N**.
- [ ] **Step 2.** Verify a **new empty session** appears in the main panel and the chat input receives focus automatically (you should be able to type immediately without clicking).
- [ ] **Step 3.** Type `Explain the difference between async and concurrent programming` and press **Enter**.
- [ ] **Step 4.** While the response is **still streaming**, press **Cmd+N** again.
- [ ] **Step 5.** Verify a **second new session** is created. The first session (with the in-progress stream) remains visible in the sidebar.
- [ ] **Step 6.** Click the **first session** in the sidebar to switch back to it. Verify the streamed response completed and is visible.
- [ ] **Step 7.** Press **Escape** while the chat input is focused — note what happens (ideally: input is deselected or cleared; the session does not close).

**Expected result:** Cmd+N reliably creates new sessions and focuses input each time. Switching sessions during a stream does not interrupt it. Escape does not destroy state.

---

### Flow 3: Renaming a Session

**Goal:** Verify session renaming is persistent and that Enter in the rename input does not trigger chat submission.
**Regression:** YES — the stopPropagation fix for rename Enter key (commit `61e8662`) must be verified.

- [ ] **Step 1.** Open the app with at least one session in the sidebar. Click the session to open it.
- [ ] **Step 2.** Hover over the session title in the sidebar — verify a **rename affordance** appears (pencil icon or edit indicator).
- [ ] **Step 3.** Double-click the session title, or click the rename/pencil icon. Verify the title becomes an **editable text input** with the current text pre-selected.
- [ ] **Step 4.** Clear the field and type `Claude SDK Investigation`.
- [ ] **Step 5.** Press **Enter** to confirm.
- [ ] **CRITICAL CHECK — Step 6.** Verify that pressing Enter **only** confirmed the rename. It must NOT have submitted the chat form, sent a message, or done anything else. Check the chat message list: no new messages should have appeared.
- [ ] **Step 7.** Verify the sidebar now shows `Claude SDK Investigation` as the session name.
- [ ] **Step 8.** Click away from the session, then click back. Verify the name is still `Claude SDK Investigation`.
- [ ] **Step 9.** Reload the app (Cmd+R). Verify the renamed session still shows `Claude SDK Investigation` after reload.
- [ ] **Step 10.** Open the rename input again and press **Escape**. Verify the old name is **restored** (rename is cancelled, not committed as blank).

**Expected result:** Rename persists to the database and survives reload. Enter in rename input is isolated from the chat submission handler (stopPropagation is working). Escape cancels without data loss.

---

### Flow 4: Searching Sessions

**Goal:** Verify real-time session filtering works correctly.
**Regression:** No — search correctness test.

- [ ] **Step 1.** Create (or verify existence of) at least 5 sessions with distinct titles: `Rust error handling`, `React hooks deep dive`, `SQL optimization`, `Git rebase strategies`, `Docker networking`.
- [ ] **Step 2.** Click the **search input** in the CONVERSATIONS sidebar.
- [ ] **Step 3.** Type `React` — verify the list **immediately filters** to show only matching sessions. Non-matching sessions must be hidden, not just dimmed.
- [ ] **Step 4.** Clear the search — verify all sessions return to the list.
- [ ] **Step 5.** Type `xyz123` (no possible match). Verify an **empty state message** appears (e.g., "No conversations found") — not a blank panel.
- [ ] **Step 6.** Press **Escape** — verify the search clears and focus returns to the session list with all sessions visible.
- [ ] **Step 7.** Type `opt` (partial word) — verify `SQL optimization` still appears (partial matching must work).
- [ ] **Step 8.** Click a filtered search result to open that session. Verify the search state clears after opening (sidebar reverts to showing the full list).

**Expected result:** Real-time filtering, graceful empty state, keyboard-dismissible, case-insensitive partial matching.

---

### Flow 15: Deleting a Session

**Goal:** Verify session deletion is permanent, confirmed before execution, and does not affect other sessions.
**Regression:** No — data management test.

- [ ] **Step 1.** Create two new sessions: rename them `Test Session A` and `Test Session B`.
- [ ] **Step 2.** Right-click or hover over `Test Session A` in the sidebar. Verify a **context menu** or **delete button** appears.
- [ ] **Step 3.** Click the delete option. Verify a **confirmation prompt appears** before any data is deleted. (Deletion without confirmation is a UX failure — note it if absent.)
- [ ] **Step 4.** Confirm the deletion.
- [ ] **Step 5.** Verify `Test Session A` is **immediately removed** from the sidebar.
- [ ] **Step 6.** Verify `Test Session B` is still present and unaffected. Click it to confirm the main panel loads it correctly.
- [ ] **Step 7.** Click on `Test Session B` to make it the active session. Delete it. Verify the app **handles this gracefully** — it must either switch to another session or show the empty state. It must not crash or display a broken blank panel.
- [ ] **Step 8.** Reload the app. Verify neither deleted session reappears.

**Expected result:** Deletion is permanent, guarded by a confirmation, and non-destructive to other sessions. Deleting the currently active session is handled gracefully.

---

### Flow 16: Long Session Name Edge Case

**Goal:** Verify the sidebar handles extreme title lengths without layout breakage.
**Regression:** No — CSS overflow test.

- [ ] **Step 1.** Create a new session and rename it to this 120-character string: `This is an extremely long session name that no reasonable person would ever type but that we need to test for overflow handling`
- [ ] **Step 2.** Verify the sidebar **truncates** the name gracefully with an ellipsis or clip. The text must NOT overflow the sidebar into the Activity Bar or main panel.
- [ ] **Step 3.** Hover over the truncated name — verify a tooltip shows the full name (note: this is a nice-to-have, not a blocking failure if absent).
- [ ] **Step 4.** Verify no **horizontal scrollbar** appears on the sidebar due to the long title.
- [ ] **Step 5.** Rename the same session to a **single character**: `X`. Verify the sidebar still displays cleanly with no large empty space or misaligned elements.
- [ ] **Step 6.** Rename it back to a 30–40 character name. Verify all sidebar items realign correctly.

**Expected result:** All title lengths are handled gracefully via CSS truncation. No layout breakage at any title length.

---

### Flow 20: Forking a Session

**Goal:** Verify that forking a conversation creates an independent copy without affecting the original.
**Regression:** No — fork correctness test.

- [ ] **Step 1.** Open a session with at least 4 messages (2 user, 2 assistant). If none exists, send 2 messages to create one.
- [ ] **Step 2.** Locate the **fork/branch option** — this may be a context menu on a message, a button in the session header, or the slash command `/fork`. Trigger it.
- [ ] **Step 3.** Verify a **new session** is created in the sidebar, with a name indicating it is a fork (e.g., `Copy of...` or `[original title] — Fork`).
- [ ] **Step 4.** Open the forked session. Verify it contains **all messages up to the fork point** — the history must be present, not empty.
- [ ] **Step 5.** Send a new message in the forked session: `Let's explore a completely different approach using functional programming`. Verify the response builds on the forked history.
- [ ] **Step 6.** Return to the **original session**. Verify it is completely **unchanged** — no new messages, no modified content.
- [ ] **Step 7.** Delete the fork. Verify the original session is unaffected.

**Expected result:** Fork creates an independent copy up to the fork point. Both sessions are independently listed and independently editable after the fork.

---

## Category 3: Chat UX

*Covers message sending, streaming, multi-turn context, command palette, and the tip banner.*

---

### Flow 5: Multi-Turn Conversation with Context

**Goal:** Verify that each message in a session correctly maintains conversation context across turns.
**Regression:** No — context continuity test. This is a critical correctness check.

- [ ] **Step 1.** Create a new chat session.
- [ ] **Step 2.** Send: `I have a TypeScript function that takes a list of objects and groups them by a key. Write me a generic implementation.`
- [ ] **Step 3.** Wait for the full response. Verify it contains a code block with a TypeScript function.
- [ ] **Step 4.** Send the follow-up: `Now add a second parameter that controls whether the keys are sorted alphabetically.`
- [ ] **Step 5.** Verify the model's response **modifies the function from the previous turn** — it should not start from scratch or ask for clarification about what function you mean.
- [ ] **Step 6.** Send: `What's the time complexity of this implementation?`
- [ ] **Step 7.** Verify the answer references **this specific implementation** (not a generic answer about grouping algorithms in general).
- [ ] **Step 8.** Send: `Show me a usage example with an array of User objects that have id, name, and role fields.`
- [ ] **Step 9.** Scroll up — verify the full conversation history is visible, correctly ordered, and properly formatted.
- [ ] **Step 10.** Verify the session title in the sidebar reflects the conversation topic, not a generic placeholder.

**Expected result:** Context is maintained across all turns. Each response demonstrates awareness of the prior conversation. This verifies that session history is being passed to the backend on subsequent turns.

---

### Flow 6: Command Palette via / Button

**Goal:** Verify the slash command palette opens, filters, and inserts commands correctly.
**Regression:** No — command palette functional test.

- [ ] **Step 1.** Open an existing chat session (or create a new one).
- [ ] **Step 2.** Click the **`/` button** next to the chat input. Verify a command palette popover/modal appears **above** the input.
- [ ] **Step 3.** Observe the list of available commands (e.g., `/clear`, `/model`, `/help`, `/fork`). Verify the list is populated and not empty.
- [ ] **Step 4.** Click any command from the list. Verify it is **inserted into the chat input** and the palette closes.
- [ ] **Step 5.** Verify **focus returns to the chat input** after selection, so the user can continue typing.
- [ ] **Step 6.** Clear the input. Press **Escape** while the palette is open. Verify the palette closes and focus stays on the input. Verify nothing destructive happened (no session closed, no content cleared).
- [ ] **Step 7.** Type `/` manually in the chat input (without clicking the button). Verify the palette also opens via this trigger.
- [ ] **Step 8.** Type `/cl` after the slash — verify the command list **filters** to show only commands matching "cl" (e.g., `/clear`).
- [ ] **Step 9.** Click outside the palette (on the main chat area). Verify the palette closes cleanly.

**Expected result:** The `/` button and the typed `/` both open the palette. Escape and outside-click both close it without side effects. Commands filter and insert correctly.

---

### Flow 22: Very Long Streamed Response

**Goal:** Verify the app handles long model responses without layout issues or performance problems.
**Regression:** No — stress/rendering test.

- [ ] **Step 1.** Create a new chat session.
- [ ] **Step 2.** Send: `Write me a complete, production-ready React component library in TypeScript with 10 different components: Button, Input, Modal, Dropdown, Tabs, Card, Badge, Avatar, Tooltip, and Toast. Include full TypeScript types and prop documentation.`
- [ ] **Step 3.** While streaming, verify the text **renders smoothly** — no janky layout reflows, no lag that makes typing impossible.
- [ ] **Step 4.** Verify the message container **expands vertically** as content arrives. It must not push the chat input off screen or overlap with the sidebar.
- [ ] **Step 5.** Scroll **up** while streaming — verify you can read earlier content while new content arrives below. Verify auto-scroll to bottom resumes when you scroll back down.
- [ ] **Step 6.** Wait for the full response to complete. Verify the **streaming indicator** (spinner or typing cursor) disappears upon completion.
- [ ] **Step 7.** Scroll through the **entire response**. Verify no content is clipped or cut off at the bottom.
- [ ] **Step 8.** Click the **copy button** on a code block. Verify the clipboard copy works (paste into a text editor to confirm).
- [ ] **Step 9.** Verify the message does not overflow into the Activity Bar or sidebar.

**Expected result:** Long responses render correctly, scroll properly, complete cleanly, and do not break the layout.

---

### Flow 28: Switching Views During an Active Stream

**Goal:** Verify that view switching does not interrupt, corrupt, or duplicate an in-progress streaming response.
**Regression:** No — streaming isolation test. Streaming must be managed at the backend/fetch layer, not tied to component lifecycle.

- [ ] **Step 1.** Open a chat session and send a long-running prompt: `Write me a detailed 500-line Python script for a command-line task management tool with full CRUD operations, a SQLite backend, and argparse for the CLI interface.`
- [ ] **Step 2.** While the response is **visibly streaming** (tokens appearing), click the **Workspaces icon** in the Activity Bar. Verify the view switches cleanly — no crash, no freeze.
- [ ] **Step 3.** Wait 3 seconds, then click **Chat** in the Activity Bar.
- [ ] **Step 4.** Verify the stream has **continued in the background** — new tokens should be visible beyond what was showing when you switched away.
- [ ] **Step 5.** Verify the response has **not duplicated** (no repeated text) and has **not corrupted** (text makes sense).
- [ ] **Step 6.** Click **Teams**, then **Agents**, then **Chat** — all within 2–3 seconds, while the stream is still running.
- [ ] **Step 7.** Verify the stream **completes correctly** after all the rapid view switching.
- [ ] **Step 8.** Check the console for errors during and after this test.

**Expected result:** Streaming is unaffected by view switching. The final stored message is complete and correct.

---

## Category 4: Settings

*Covers all 5 settings groups plus keyboard shortcut access.*

---

### Flow 8: Opening Settings and Navigating All Groups

**Goal:** Verify Settings opens, all 5 groups are accessible, and navigation between them works.
**Regression:** No — settings navigation baseline.

- [ ] **Step 1.** Click the **gear icon** at the bottom of the Activity Bar. Verify the Settings panel opens (whether a modal, a side panel, or a full view replacement).
- [ ] **Step 2.** Verify the left-sidebar nav inside Settings shows these 5 groups: **General**, **AI & Model**, **Data & Context**, **Integrations**, **Status**.
- [ ] **Step 3.** Click **General** — verify relevant settings appear (theme, font size, keyboard shortcuts, etc.). The group must not be empty or show a "coming soon" placeholder.
- [ ] **Step 4.** Click **AI & Model** — verify model selection or AI-related options appear.
- [ ] **Step 5.** Click **Data & Context** — verify context window or data retention options appear.
- [ ] **Step 6.** Click **Integrations** — note what is shown (fully implemented options, placeholder, or "coming soon").
- [ ] **Step 7.** Click **Status** — verify the authenticated user's email is displayed. Verify subscription information is shown (plan type, auth method).
- [ ] **Step 8.** Verify the left-sidebar nav **highlights the active group** as you switch between them.
- [ ] **Step 9.** Press **Escape** to close Settings. Verify the app returns to the Chat view (or whichever view was active before).
- [ ] **Step 10.** Reopen Settings — verify any changes made in step 3 persist (settings were not reset by closing).

**Expected result:** All 5 groups are navigable and render content. The active group is highlighted. Changes persist after closing.

---

### Flow 9: Settings — AI and Model Group

**Goal:** Verify the model selector works and the selection is applied to new chat sessions.
**Regression:** No — model selection persistence test.

- [ ] **Step 1.** Open Settings via the gear icon. Click **AI & Model**.
- [ ] **Step 2.** Verify a **model selector** is visible (dropdown, radio group, or similar).
- [ ] **Step 3.** Note the currently selected model name.
- [ ] **Step 4.** Change the model to a **different option**.
- [ ] **Step 5.** Close Settings.
- [ ] **Step 6.** Create a **new chat session**.
- [ ] **Step 7.** Send: `What model are you?`
- [ ] **Step 8.** Verify the response identifies the newly selected model (this confirms the selection was applied).
- [ ] **Step 9.** Reopen Settings > AI & Model — verify the selection **persisted** (was not reset to the default).

**Expected result:** Model selection is saved and applied to new chat sessions. It persists across settings open/close cycles.

---

### Flow 10: Settings — Opening via Cmd+,

**Goal:** Verify the standard macOS keyboard shortcut opens and closes Settings.
**Regression:** No — keyboard shortcut test.

- [ ] **Step 1.** With the app focused on the Chat view, press **Cmd+,**.
- [ ] **Step 2.** Verify **Settings opens immediately**.
- [ ] **Step 3.** Navigate to any settings group.
- [ ] **Step 4.** Press **Cmd+,** again while Settings is already open — verify either: Settings stays open (idempotent), or it focuses the existing settings view. It must NOT close and reopen (that would be disorienting).
- [ ] **Step 5.** Press **Escape** — verify Settings closes.
- [ ] **Step 6.** Press **Cmd+,** once more — verify Settings reopens.
- [ ] **Step 7.** Click **outside the Settings panel** (if it is a modal) — verify it closes.
- [ ] **Step 8.** Verify returning to Chat view shows the app in the same state as before opening Settings.

**Expected result:** Cmd+, reliably opens Settings. Escape reliably closes it. The shortcut is idempotent when Settings is already open.

---

### Flow 25: Settings — General Group (Theme and Preferences)

**Goal:** Verify General settings apply immediately and persist.
**Regression:** No — preferences persistence test.

- [ ] **Step 1.** Open Settings via Cmd+,.
- [ ] **Step 2.** Click **General** in the settings left-sidebar.
- [ ] **Step 3.** Locate the **theme toggle** (light / dark / system). Note the current value.
- [ ] **Step 4.** Switch to **light theme** — verify the entire app updates **immediately** (sidebar, main panel, Activity Bar). No app restart should be required.
- [ ] **Step 5.** Switch back to **dark theme** — verify immediate reversion.
- [ ] **Step 6.** If a **system** theme option exists, set it. Note the result (does it match your current OS theme?).
- [ ] **Step 7.** Look for any font size or UI density setting — change it if present and verify it applies visually.
- [ ] **Step 8.** Close Settings. Reopen Settings — verify the **theme and any changed preferences persisted**.

**Expected result:** Theme changes apply immediately without restart. Preferences persist across settings open/close cycles.

---

### Flow 27: Settings — Integrations Group

**Goal:** Verify the Integrations section renders, validates inputs, and masks secrets.
**Regression:** No — integrations UI test. Note: if Integrations is a placeholder, the empty state must say so clearly.

- [ ] **Step 1.** Open Settings via gear icon. Click **Integrations** in the settings left-sidebar.
- [ ] **Step 2.** Observe what is shown. If integrations are listed (GitHub, Jira, Slack, webhooks, etc.), proceed to step 3. If a "coming soon" or empty state is shown, note it and mark this flow as **INFO** (not a failure) — skip to step 10.
- [ ] **Step 3.** Click on an available integration.
- [ ] **Step 4.** Verify the integration's **configuration options** are shown (API endpoint, token field, or similar).
- [ ] **SECURITY CHECK — Step 5.** Verify any API key or token input field **masks its value** (`type="password"` or equivalent). A token field that shows its value in plaintext is a security issue — flag it.
- [ ] **Step 6.** Enter **invalid data** into a required field (e.g., a blank token, a malformed URL). Verify **validation errors appear** inline rather than silently failing or crashing.
- [ ] **Step 7.** Close and reopen Settings. Verify the integration's **configuration state persisted** (form was not reset).
- [ ] **Step 8.** If a working integration is available, configure it correctly and verify a success state or confirmation message.
- [ ] **Step 9.** Disable or disconnect the integration. Verify the UI reverts to the disconnected/unconfigured state.
- [ ] **Step 10.** Verify the Settings left-sidebar nav highlights **Integrations** as active while this group is open.

**Expected result:** Integrations UI is present and functional (or clearly marked as coming soon). Input validation works. Secret fields are masked. State persists across settings open/close.

---

### Flow 26: Settings — Status Group

**Goal:** Verify the Status group shows accurate auth information and does not expose credentials in plaintext.
**Regression:** No — auth display and security test.

- [ ] **Step 1.** Open Settings via gear icon. Click **Status**.
- [ ] **Step 2.** Verify the **authenticated user's email address** is displayed.
- [ ] **Step 3.** Verify the **subscription plan** is shown (e.g., Free, Pro, Max, Team).
- [ ] **Step 4.** Verify there is some indication of the **authentication method** (Claude subscription auth vs API key override).
- [ ] **Step 5.** If `ANTHROPIC_API_KEY` is set in the environment, verify this is indicated in the status display.
- [ ] **SECURITY CHECK — Step 6.** Verify that **no API key value is visible in plaintext** anywhere in the Status view. The existence of a key may be indicated (e.g., "API key: set"), but the value must never be displayed.
- [ ] **Step 7.** Look for a **"Refresh status"** button. If present, click it — verify it updates the display (or shows the same data if nothing changed server-side).
- [ ] **Step 8.** Verify the **user avatar** in the Activity Bar reflects the authenticated user (initials, profile image, or some identifier consistent with the email shown in Status).

**Expected result:** Status shows accurate auth info. API keys are never exposed in plaintext.

---

## Category 5: Workspaces

*Covers workspace creation, WorkspacePanel tabs, and the Dashboards tab rename regression.*

---

### Flow 11: Creating a New Workspace

**Goal:** Verify workspace creation, persistence, and that the WorkspacePanel tabs all render.
**Regression:** No — workspace creation baseline.

- [ ] **Step 1.** Click the **Workspaces icon** in the Activity Bar.
- [ ] **Step 2.** Observe the **PROJECTS sidebar** — if no workspaces exist, verify a meaningful empty state with a create CTA is shown.
- [ ] **Step 3.** Click the **New Project / + button** to create a workspace. Enter the name `Claude SDK Integration` and confirm.
- [ ] **Step 4.** Verify the project appears in the PROJECTS sidebar.
- [ ] **Step 5.** Click the project to open it. Verify the **WorkspacePanel** opens in the main area.
- [ ] **Step 6.** Verify the WorkspacePanel contains these tabs: **Chat**, **Diff**, **Paths**, **Notes**, **Dashboards**.
- [ ] **Step 7.** Click each tab in order. Verify each one renders either content or a **meaningful empty state** without crashing or showing a blank white panel.
- [ ] **Step 8.** Click the **Notes tab** and type a few lines of notes. Verify the input accepts text.

**Expected result:** Workspace is created, persisted, and all WorkspacePanel tabs are navigable. No tab crashes.

---

### Flow 12: WorkspacePanel — Chat Tab

**Goal:** Verify workspace-scoped chat is functional and isolated from the main Chat view.
**Regression:** No — workspace chat scoping test.

- [ ] **Step 1.** Open an existing workspace (or create one per Flow 11). Click the **Chat tab** in the WorkspacePanel.
- [ ] **Step 2.** Verify a **chat input** is present (distinct from the global Chat view).
- [ ] **Step 3.** Send: `Summarize the purpose of this workspace.`
- [ ] **Step 4.** Verify a response **streams into the workspace chat panel**.
- [ ] **Step 5.** Switch to the **Notes tab**, type a note, then switch back to **Chat**. Verify the workspace chat **history is still present** (not lost on tab switch).
- [ ] **Step 6.** Click the **Chat icon** in the Activity Bar to go to the global Chat view. Verify the global sessions sidebar is separate. Note whether workspace chats appear in the global sessions list (either behavior is acceptable — note it).
- [ ] **Step 7.** Return to Workspaces view and open the same workspace. Click the **Chat tab**. Verify the **workspace chat history is still there**.

**Expected result:** Workspace chat is scoped to the workspace and survives tab switching. It does not interfere with global chat sessions.

---

### Flow 13: WorkspacePanel — Paths Tab

**Goal:** Verify the Paths tab renders and paths can be added.
**Regression:** No — workspace paths tab test.

- [ ] **Step 1.** Open a workspace. Click the **Paths tab** in the WorkspacePanel.
- [ ] **Step 2.** Observe the current state — empty state, a list of paths, or a directory picker should be shown.
- [ ] **Step 3.** If an **"Add Path"** button exists, click it.
- [ ] **Step 4.** Navigate to or type the path `/Users` (or any valid directory on the system). Confirm the selection.
- [ ] **Step 5.** Verify the path appears in the **Paths list**.
- [ ] **Step 6.** Switch to the **Notes tab** and back to **Paths** — verify the path persists across tab switches.

**Expected result:** Paths tab renders without crashing. Paths can be added and persist across tab switches.

---

### Flow 14: WorkspacePanel — Dashboards Tab

**Goal:** Verify dashboard creation, listing, detail view, and inline rename. The rename Enter key fix is the key regression here.
**Regression:** YES — the dashboard rename `stopPropagation` fix (commit `61e8662`) must be verified. The dashboard Dashboards tab was implemented in Phase 4 (commit `2b9a2cf`).

- [ ] **Step 1.** Open a workspace. Click the **Dashboards tab** in the WorkspacePanel.
- [ ] **Step 2.** Verify the **empty state** shows a meaningful message: `No dashboards yet.` (or similar) with a `+ New` button and a `Show archived` checkbox.
- [ ] **Step 3.** Click the **`+ New` button**. Verify a `window.prompt` dialog appears asking what the dashboard should show.
- [ ] **Step 4.** Enter the name `Sprint Overview` in the prompt and accept it.
- [ ] **Step 5.** Verify the dashboard appears in the **list on the left** side of the Dashboards tab panel.
- [ ] **Step 6.** Verify the **detail panel on the right** opens automatically after creation (you should not need to click the card separately).
- [ ] **Step 7.** Verify the detail panel shows: title, creation date, `Has revisions` metadata, **Archive** and **Regenerate** buttons, and a dashboard spec content section.
- [ ] **Step 8.** Click the **dashboard title** in the detail panel. Verify an **inline edit input** activates with the current title pre-filled.
- [ ] **Step 9.** Clear the input and type `Project Metrics Dashboard`.
- [ ] **CRITICAL CHECK — Step 10.** Press **Enter** to confirm the rename.
   - Verify the rename **completed** — both the list card and detail header should show `Project Metrics Dashboard`.
   - Verify pressing Enter did **NOT** trigger any chat submission, close any panel, or cause any other side effect. This is the regression check for the stopPropagation fix.
- [ ] **Step 11.** Check the console — no new errors related to the rename action should appear (the known button-in-button HTML nesting warning is pre-existing and acceptable).

**Expected result:** Dashboard creation, listing, detail view, and inline rename all work. Pressing Enter in the rename input is isolated from other event handlers. The button-in-button HTML warning is pre-existing and not a blocker.

---

## Category 6: Teams and Agents

*Covers the Teams view and Agent Profile lifecycle.*

---

### Flow 29: Teams View — Creating and Listing Teams

**Goal:** Verify the Teams view loads and team creation works.
**Regression:** No — Teams view baseline.

- [ ] **Step 1.** Click the **Teams icon** in the Activity Bar.
- [ ] **Step 2.** Verify the Teams view is shown with a sidebar and main content area. If empty, verify there is a meaningful empty state explaining what Teams are for.
- [ ] **Step 3.** Click a **"Create Team"** or **"New Team"** button. Enter the name `Code Review Team` and a description: `Automated team for reviewing PRs with multiple agent perspectives`.
- [ ] **Step 4.** Confirm creation. Verify the team **appears in the sidebar list**.
- [ ] **Step 5.** Click the team to open its detail view. Verify the detail view shows: team name, description, and available actions (add agents, configure, delete).
- [ ] **Step 6.** If Teams is not yet fully implemented, verify the empty state or placeholder clearly communicates this — it must not show a broken/crashed UI.

**Expected result:** Team creation works and the team is listed in the sidebar. The detail view loads. If Teams is a placeholder feature, it must communicate this clearly rather than showing a broken state.

---

### Flow 18: Agent Profile Creation

**Goal:** Verify a custom agent profile can be created, saved, and applied to a chat session.
**Regression:** No — agent profiles baseline.

- [ ] **Step 1.** Click the **Agents icon** in the Activity Bar.
- [ ] **Step 2.** Verify the sidebar shows an **AGENTS / AGENT PROFILES** header. Verify an empty state or existing profiles are shown.
- [ ] **Step 3.** Click the button to **create a new agent profile**.
- [ ] **Step 4.** Enter the name: `Code Reviewer`.
- [ ] **Step 5.** Enter the system prompt: `You are a senior software engineer performing code reviews. Focus on correctness, security, and maintainability. Be direct and specific.`
- [ ] **Step 6.** Set any other available options (model, temperature). Save the profile.
- [ ] **Step 7.** Verify the `Code Reviewer` profile appears in the **sidebar list**.
- [ ] **Step 8.** Click the profile — verify the detail view shows the name and system prompt correctly.
- [ ] **Step 9.** Click **"Use this agent"** (or the equivalent button to start a chat using this profile). Verify a new chat session is created.
- [ ] **Step 10.** Send a message: `What is your focus when reviewing code?` Verify the response reflects the system prompt (e.g., mentions correctness, security, maintainability).

**Expected result:** Agent profiles are created, persisted, and apply the correct system prompt when used in a chat session.

---

### Flow 19: Agent Profile Edit and Delete

**Goal:** Verify agent profiles can be updated and removed cleanly.
**Regression:** No — agent profiles edit/delete test.

- [ ] **Step 1.** Open the `Code Reviewer` profile created in Flow 18.
- [ ] **Step 2.** Click **Edit** (or click into the name/prompt fields). Change the name to `Code Reviewer — Security Focus`.
- [ ] **Step 3.** Update the system prompt to append: `Pay special attention to injection vulnerabilities and authentication flaws.`
- [ ] **Step 4.** Save the changes.
- [ ] **Step 5.** Verify the sidebar reflects the **new name** `Code Reviewer — Security Focus`.
- [ ] **Step 6.** Open the profile — verify the updated system prompt is shown correctly.
- [ ] **Step 7.** Start a chat using this profile and send: `Review this code snippet: SELECT * FROM users WHERE id = " + userInput`. Verify the response reflects the **security-focused system prompt** (should flag SQL injection).
- [ ] **Step 8.** Delete the profile. Verify it is **removed from the sidebar** and does not appear in profile selectors when creating new chats.

**Expected result:** Edit and delete both work. Changes are reflected immediately and persisted. Deleting a profile does not affect active chat sessions already using it.

---

## Category 7: Edge Cases and Error Recovery

*Covers empty states, restart persistence, and error resilience.*

---

### Flow 17: Empty State Verification Across All Views

**Goal:** Verify every view shows a meaningful empty state when no data exists.
**Regression:** No — empty state completeness check.

- [ ] **Step 1.** Go to the **Chat view** with no sessions. Verify the CONVERSATIONS sidebar shows an empty state with guidance text and a clear path to action (e.g., a "New Chat" button or instructional copy). A blank white panel is a failure.
- [ ] **Step 2.** Go to the **Workspaces view** with no projects. Verify the PROJECTS sidebar shows an empty state with a "Create Project" call-to-action.
- [ ] **Step 3.** Go to the **Teams view** with no teams. Verify an empty state explains what Teams are.
- [ ] **Step 4.** Go to the **Agents view** with no profiles. Verify an empty state explains what Agent Profiles are.
- [ ] **Step 5.** Go to **Settings > Status**. Verify subscription/auth info is shown (or a helpful unauthenticated message if applicable).
- [ ] **Step 6.** Return to **Chat view**. Create a session, delete it. Verify the Chat view **returns to the empty state** — not a blank panel.
- [ ] **Step 7.** Go to **Workspaces**. Create a project, delete it. Verify the Workspaces view **returns to the empty state**.

**Expected result:** Every view has an informative, action-oriented empty state. A blank white panel in any view is a UX failure.

---

### Flow 21: Continuing a Session After App Restart

**Goal:** Verify full session persistence across app restart — all messages and multi-turn context survive.
**Regression:** No — persistence and data integrity test.

- [ ] **Step 1.** Open a chat session and send **3–4 messages** with substantial content (e.g., a multi-step coding conversation with code blocks in the responses).
- [ ] **Step 2.** Note the **session title** and the **last message content** (first few words).
- [ ] **Step 3.** **Close the app completely** — not just minimize, but fully quit (Cmd+Q or close the window and confirm exit if prompted).
- [ ] **Step 4.** **Reopen the app** and navigate to `http://localhost:1420`.
- [ ] **Step 5.** Verify the CONVERSATIONS sidebar shows the **same sessions** as before the restart.
- [ ] **Step 6.** Click the session from step 1. Verify **all messages** (both user and assistant) are present and in the correct order.
- [ ] **Step 7.** Verify the chat input is **empty and focused**.
- [ ] **Step 8.** Send: `Continuing from where we left off — can you summarize what we discussed?`. Verify the model's response demonstrates **awareness of the prior conversation** (it references specific topics from the earlier messages).

**Expected result:** Full session persistence across restart. Messages are stored in SQLite, not memory. Multi-turn context is maintained after reload.

---

### Flow 23: Command Palette via Cmd+K

**Goal:** Verify the global Cmd+K command palette navigates to sessions, views, and commands.
**Regression:** No — global keyboard shortcut test. Note: if Cmd+K is not implemented, this test confirms the gap.

- [ ] **Step 1.** With the app open on any view, press **Cmd+K**.
- [ ] **Step 2.** Verify a **command palette overlay** appears (centered modal or top-bar style) with a list of available commands or recent items.
- [ ] **Step 3.** Type `new` — verify results filter to commands related to creating new things (e.g., "New Chat", "New Project").
- [ ] **Step 4.** Select **"New Chat"** — verify a new session is created.
- [ ] **Step 5.** Press **Cmd+K** again, type `settings`. Select the Settings option — verify Settings opens.
- [ ] **Step 6.** Press **Cmd+K** once more, type a session name keyword (e.g., `React` if a session with that name exists). Verify the matching session appears — select it to navigate directly to that session.
- [ ] **Step 7.** Press **Escape** at any point — verify the palette closes without side effects.

**Expected result:** Cmd+K opens a global palette for sessions, views, and commands. Escape always closes it cleanly. If Cmd+K is not implemented, note it as a missing feature (not a blocker for other flows).

---

### Flow 30: Full Developer Workflow — Chat to Workspace to Notes

**Goal:** An end-to-end workflow combining Chat, Workspaces, and Notes. This is the highest-value integration test — it crosses three major views and validates that no view loses data when another is opened.
**Regression:** No — end-to-end workflow test.

- [ ] **Step 1.** Go to **Chat view**. Create a new session titled `API Design Session`.
- [ ] **Step 2.** Send: `Help me design a REST API for a task management app. I need endpoints for users, tasks, projects, and comments.`
- [ ] **Step 3.** Read the response — the model should propose a set of REST endpoints.
- [ ] **Step 4.** Send the follow-up: `Good. Now add rate limiting and authentication requirements for each endpoint.`
- [ ] **Step 5.** Switch to **Workspaces view**. Create a new project: `Task Management API`.
- [ ] **Step 6.** Open the WorkspacePanel, go to the **Notes tab**. Type a summary of the API design from the chat: `Auth: JWT bearer on all endpoints. Rate limit: 100 req/min per user. Endpoints: POST /users, GET /tasks, etc.`
- [ ] **Step 7.** Switch to the **Paths tab**. Add a local directory path (e.g., the project root).
- [ ] **Step 8.** Return to **Chat view**. Open the `API Design Session`. Verify it is **completely unchanged** — all messages are still present.
- [ ] **Step 9.** Continue the conversation: `Now generate an OpenAPI 3.0 spec for these endpoints.` Verify the model responds with YAML content.
- [ ] **Step 10.** Copy the generated YAML. Go to **Workspaces > Task Management API > Notes**. Paste the YAML into the Notes tab. Verify notes are saved (switch to another tab and back to confirm).
- [ ] **Step 11.** Verify the workspace **Paths tab** still shows the path from step 7 (no data loss from notes editing).
- [ ] **Step 12.** Return to **Chat view**. Create a new session. Send: `What security vulnerabilities should I watch out for in a JWT-based REST API?` Verify it starts a fresh conversation with no contamination from the API Design Session.

**Expected result:** The full multi-view workflow completes without data loss. Chat history, workspace notes, and paths all persist independently. View switching never loses state. This is the single most comprehensive validation of the app's data model.

---

## Known Issues and Accepted Behaviors

These issues have been investigated and are either accepted, pre-existing, or have known workarounds. Do not file new bugs for these unless the behavior has changed.

| Issue | Severity | Notes |
|-------|----------|-------|
| `<button>` nested inside `<button>` in Dashboards list item | Medium | Pre-existing HTML nesting violation in `WorkspaceDashboardsView`. Both buttons function correctly. React logs a hydration warning. Fix is tracked separately. |
| `500` on `/api/workspaces/{id}/diff` | Low | Workspace diff polling is not yet implemented. Expected 500 during development. |
| `500` on `/api/workspaces/{id}/changed-files` | Low | Changed-files polling is not yet implemented. Expected 500 during development. |
| `500` on `/api/sessions/{id}/checkpoints` | Low | Session checkpoint polling is not yet implemented. Expected 500 during development. |
| Dashboard creation uses `window.prompt` | Low | The "New Dashboard" flow uses a native browser prompt dialog rather than an inline form. This is a known Phase 4 limitation. Phase 5 will add a proper inline creation UI. |
| Dashboard spec shows stub content | Info | After creation, the dashboard spec section shows `"Widget canvas rendering is coming in Phase 5."` This is expected — the rendering layer is deferred. |

---

## Bug Reporting Template

When you find a bug during testing, use this format. Create a GitHub issue with the bug label and paste this block into the issue description.

```
**Flow:** [flow number and name, e.g., "Flow 3: Renaming a Session"]
**Step:** [step number where it failed, e.g., "Step 6"]
**Expected:** [what should have happened]
**Actual:** [what actually happened]
**Console errors:** [yes / no — if yes, paste the error text]
**Reproducible:** [yes / no / intermittent]
**Screenshot:** [attach if applicable]
```

---

*This document is generated from `user-flows-30.md` and refined for canonical QA use.*
*Source draft: `docs/testing/user-flows-30.md`*
*Last verified against codebase: 2026-03-19*
