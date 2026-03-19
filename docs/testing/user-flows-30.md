# 30 User Flows for Manual Testing

Generated: 2026-03-19
App: claude-tauri-boilerplate (http://localhost:1420)

---

## Flow 1: First-Time Launch and First Chat
**Goal:** A developer opens the app for the first time and sends their first message.
**Steps:**
1. Launch the app — observe the default view (should land on Chat view)
2. Verify the Activity Bar is visible on the left with icons for Chat, Workspaces, Teams, Agents, Settings, and user avatar
3. Observe the sidebar: "CONVERSATIONS" header should be visible, session list should be empty
4. Observe the main panel: should show an empty state or welcome prompt, not a blank white void
5. Click the "New Chat" button in the sidebar
6. Verify focus jumps to the chat input in the main panel
7. Type "Hello, what can you help me with today?" and press Enter
8. Watch the streaming response appear token by token
9. Verify the session appears in the CONVERSATIONS sidebar with an auto-generated title
10. Scroll up in the chat to verify message history is preserved
**Expected result:** Session created, message sent, response streamed, session listed in sidebar with a sensible auto-title.
**UX concern:** If the sidebar is empty on first launch with no empty-state copy, the user may not know what to do. The "New Chat" button must be discoverable without any prior session.

---

## Flow 2: Creating a New Chat via Keyboard Shortcut
**Goal:** A developer who prefers the keyboard starts a new chat without touching the mouse.
**Steps:**
1. App is open with at least one existing session visible in the sidebar
2. Press Cmd+N (or the documented new chat shortcut)
3. Verify a new session is created and the chat input receives focus automatically
4. Type "Explain the difference between async and concurrent programming"
5. Press Enter to send
6. While the response is streaming, press Cmd+N again
7. Verify a second new session is created (the previous one remains in sidebar)
8. Switch back to the first session by clicking it in the sidebar
9. Verify the streaming response from step 5 is still visible / completed
10. Press Escape and verify focus behavior (does it deselect the input?)
**Expected result:** Cmd+N reliably creates a new session and focuses input each time. Switching between sessions does not lose content.
**UX concern:** If Cmd+N doesn't work while a different panel is focused (e.g., sidebar search), the shortcut may feel broken. Also, creating a second session while one is still streaming should not interrupt the first.

---

## Flow 3: Renaming a Session
**Goal:** A developer wants to rename an auto-titled session to something meaningful.
**Steps:**
1. Open the app with at least one session in the sidebar
2. Click on a session to open it
3. Hover over the session title in the sidebar — verify a rename affordance appears (pencil icon, double-click highlight, etc.)
4. Double-click the session title (or click the rename icon)
5. Verify the title becomes an editable input field with the current text selected
6. Clear the title and type "Claude SDK Investigation"
7. Press Enter to confirm
8. Verify the sidebar now shows "Claude SDK Investigation" as the session name
9. Click away from the session and back to it — verify the new name persists
10. Reload the app (Cmd+R or restart) and verify the renamed session still shows the correct title
**Expected result:** Rename is persisted to the database and survives reload.
**UX concern:** If pressing Enter in the rename input also submits the chat form, that is a critical bug (stopPropagation must be working). If Escape does not cancel the rename and restore the old name, users will lose titles unintentionally.

---

## Flow 4: Searching Sessions
**Goal:** A developer with 10+ sessions wants to find a specific one by keyword.
**Steps:**
1. Create at least 5 sessions with distinct titles (e.g., "Rust error handling", "React hooks deep dive", "SQL optimization", "Git rebase strategies", "Docker networking")
2. Click the search icon or search input in the CONVERSATIONS sidebar
3. Type "React" — verify results filter to only matching sessions in real time
4. Verify non-matching sessions are hidden (not just dimmed)
5. Clear the search — verify all sessions return
6. Type "xyz123" (no match) — verify an empty state message appears ("No conversations found" or similar)
7. Press Escape — verify the search clears and focus returns to the session list
8. Type a partial word like "opt" — verify "SQL optimization" still appears
9. Click a filtered result to open that session
10. Verify the search state clears after opening a session (sidebar shows full list again)
**Expected result:** Real-time filtering, graceful empty state, keyboard-dismissible.
**UX concern:** If search is case-sensitive it will confuse users. If pressing Escape while search is active navigates away from the current session instead of clearing search, that is a UX regression.

---

## Flow 5: Multi-Turn Conversation with Context
**Goal:** A developer uses back-and-forth conversation to iteratively solve a problem.
**Steps:**
1. Create a new chat session
2. Send: "I have a TypeScript function that takes a list of objects and groups them by a key. Write me a generic implementation."
3. Wait for the full response (code block expected)
4. Send a follow-up: "Now add a second parameter that controls whether the keys are sorted alphabetically"
5. Verify the model's response shows awareness of the previous function (it modifies the same code, not a new one)
6. Send: "What's the time complexity of this implementation?"
7. Verify the answer references "this implementation" (the one just written), not a generic answer
8. Send: "Show me a usage example with an array of User objects that have id, name, and role fields"
9. Scroll up to verify the full conversation history is visible and properly formatted
10. Note the session title — verify it reflects the conversation topic, not "New Chat"
**Expected result:** Each turn demonstrates context continuity. The model's responses clearly build on prior turns.
**UX concern:** If session history is not properly passed to the backend on subsequent turns, the model will treat each message as a fresh conversation. This is a critical correctness failure to catch manually.

---

## Flow 6: Command Palette via / Button
**Goal:** A developer discovers and uses the command palette to insert a slash command.
**Steps:**
1. Open an existing chat session or create a new one
2. Click the `/` button next to the chat input
3. Verify a command palette popover/modal appears above the input
4. Observe the list of available commands (e.g., /clear, /model, /help, /fork)
5. Click a command to select it — verify it is inserted into the chat input
6. Verify focus returns to the chat input after selection
7. Press Escape while the palette is open — verify the palette closes and focus stays on the input
8. Type "/" manually in the input — verify the palette also opens via typing
9. Type "/cl" after the slash — verify the list filters to matching commands
10. Select /clear from the palette and send — verify the intended behavior executes
**Expected result:** The / button and typed / both open the palette. Escape closes without side effects. Commands are filterable.
**UX concern:** If the palette intercepts Escape and also closes the session or clears the input, that is a destructive UX bug. If clicking outside the palette does not close it, the user is stuck.

---

## Flow 7: Switching Between Chat and Workspaces Views
**Goal:** A developer is mid-conversation and needs to check a workspace, then returns to their conversation.
**Steps:**
1. Open a chat session and send a message ("What are the SOLID principles?")
2. While the response is streaming (or after it completes), click the Workspaces icon in the Activity Bar
3. Verify the sidebar switches to show "PROJECTS" header and project/workspace list
4. Verify the main panel shows workspace content (or an empty state if no workspaces exist)
5. Click the Chat icon in the Activity Bar to return
6. Verify the sidebar shows "CONVERSATIONS" again with the previous session still selected
7. Verify the previous conversation is intact in the main panel
8. Verify the chat input still has its previous state (empty or partially typed)
9. Click Workspaces again, then click Chat again — confirm this toggle is stable (no flicker, no blank panels)
10. Verify the active Activity Bar icon highlights correctly for each view
**Expected result:** View switching is non-destructive. The previously open session is restored when returning to Chat view.
**UX concern:** If switching views clears the selected session, users lose their place. If the Activity Bar icon does not visibly indicate the active view, navigation feels broken.

---

## Flow 8: Opening Settings via Gear Icon
**Goal:** A developer wants to configure the app and explores all five settings groups.
**Steps:**
1. Click the gear icon at the bottom of the Activity Bar
2. Verify the Settings panel opens (in a modal, a new view, or replaces the sidebar)
3. Verify the left-sidebar nav shows all 5 groups: General, AI & Model, Data & Context, Integrations, Status
4. Click "General" — verify relevant settings appear (theme, font size, keyboard shortcuts, etc.)
5. Click "AI & Model" — verify model selection and AI-related options appear
6. Click "Data & Context" — verify context window or data retention options appear
7. Click "Integrations" — verify any integration options (GitHub, API keys, etc.) appear
8. Click "Status" — verify subscription/auth status information is shown
9. Change one setting in "General" (e.g., toggle a preference)
10. Close settings (click X, press Escape, or click back to Chat) — verify the changed setting persists
**Expected result:** All 5 groups are navigable and render content. The settings left-nav highlights the active group. Changes persist after closing.
**UX concern:** If "Status" shows only placeholder text or "coming soon," note it but do not consider it a bug. If closing settings resets unsaved changes without warning, that is a UX concern.

---

## Flow 9: Settings — AI & Model Group
**Goal:** A developer wants to change the Claude model being used.
**Steps:**
1. Open Settings via the gear icon
2. Click "AI & Model" in the left-sidebar nav
3. Verify a model selector is visible (dropdown or radio group)
4. Note the currently selected model
5. Change the model to a different option
6. Close settings
7. Open a new chat session
8. Send a message: "What model are you?"
9. Verify the response reflects the newly selected model
10. Reopen Settings > AI & Model and verify the selection persisted
**Expected result:** Model selection is saved and applied to new chats.
**UX concern:** If existing sessions continue to use the old model after the change, it should be documented (expected behavior). If the model selector shows options that don't actually work, the error should surface clearly.

---

## Flow 10: Settings — Keyboard Shortcut (Cmd+,)
**Goal:** A developer uses the standard macOS shortcut to open settings.
**Steps:**
1. With the app focused on the Chat view, press Cmd+,
2. Verify Settings opens immediately
3. Navigate to any settings group via the left-sidebar
4. Make a change (e.g., adjust a preference)
5. Press Cmd+, again — verify either settings stays open (it's already open) or focuses it
6. Press Escape — verify settings closes
7. Press Cmd+, once more — verify settings re-opens to the same group as before (or defaults to General)
8. Click outside the settings panel (if it's a modal) — verify it closes
9. Verify returning to Chat view shows the app in the state it was in before opening settings
10. Verify the Activity Bar gear icon visually indicates Settings is active while open
**Expected result:** Cmd+, reliably opens and Escape reliably closes. Settings is idempotent (pressing the shortcut when already open is harmless).
**UX concern:** If Cmd+, is not intercepted by the app (browser default behavior fires instead), note this as a missing keyboard binding.

---

## Flow 11: Creating a New Workspace
**Goal:** A developer starts a new project and creates a workspace to organize their work.
**Steps:**
1. Click the Workspaces icon in the Activity Bar
2. Observe the "PROJECTS" sidebar — if empty, verify an empty state with a call-to-action
3. Click the button to create a new project/workspace (+ icon or "New Project" button)
4. Enter a project name: "Claude SDK Integration"
5. Confirm the creation
6. Verify the project appears in the PROJECTS sidebar
7. Click on the project to expand it or open its workspace
8. Verify a WorkspacePanel opens in the main area with tabs: Chat, Diff, Paths, Notes, Dashboards
9. Click each tab and verify it renders content (or an appropriate empty state) without crashing
10. Click the Notes tab and type a few lines of notes
**Expected result:** Workspace is created, persisted, and the WorkspacePanel tabs are all navigable.
**UX concern:** If there is no visual distinction between a "project" and a "workspace" in the UI, the hierarchy may confuse users. If clicking a tab crashes the app or shows a blank panel with no empty state, note it.

---

## Flow 12: Using the WorkspacePanel Chat Tab
**Goal:** A developer uses the workspace-scoped chat to discuss files in context.
**Steps:**
1. Open an existing workspace or create one per Flow 11
2. Click the Chat tab in the WorkspacePanel
3. Verify a chat input is available (distinct from the main Chat view)
4. Send a message: "Summarize the purpose of this workspace"
5. Verify a response is streamed into the workspace chat
6. Switch to the main Chat view (Activity Bar) — verify a separate session list appears (workspace chats may or may not appear in the main list — note the behavior)
7. Return to the Workspaces view and open the same workspace
8. Verify the workspace chat history is still present
9. Switch to the Notes tab and add a note, then switch back to Chat — verify chat history persists
10. Verify the workspace chat does not interfere with the main Chat view sessions
**Expected result:** Workspace chat is scoped to the workspace. It survives tab switching within the panel.
**UX concern:** If workspace chat and main chat sessions are interleaved in the same sidebar, it may be confusing. If workspace chat history is lost on tab switch, that is a bug.

---

## Flow 13: WorkspacePanel — Paths Tab
**Goal:** A developer checks the Paths tab to understand file/directory context for the workspace.
**Steps:**
1. Open a workspace in the Workspaces view
2. Click the Paths tab in the WorkspacePanel
3. Observe the current state — empty state, a list of paths, or a directory picker
4. If there is an "Add Path" button, click it
5. Navigate to a directory (e.g., /Users/username/Develop/claude-tauri-boilerplate)
6. Confirm the selection
7. Verify the path appears in the Paths list
8. Add a second path (e.g., a specific file)
9. Verify both paths are listed
10. Switch to another tab and back to Paths — verify the paths persist
**Expected result:** Paths can be added and persist across tab switches. The list shows the added paths cleanly.
**UX concern:** If the OS file picker does not open or throws an error, this is a Tauri dialog integration issue. If paths are not persisted to the database, they will be lost on app restart.

---

## Flow 14: WorkspacePanel — Dashboards Tab
**Goal:** A developer explores the Dashboards tab to view project-level metrics or custom views.
**Steps:**
1. Open a workspace in the Workspaces view
2. Click the Dashboards tab in the WorkspacePanel
3. Observe the empty state — verify it shows a meaningful message (e.g., "No dashboards yet — create one")
4. Click a "New Dashboard" button (if available)
5. Enter a dashboard name: "Sprint Overview"
6. Confirm creation
7. Verify the dashboard appears in the Dashboards tab with its name
8. Click the dashboard to open it
9. Click the dashboard title to rename it — verify inline edit activates
10. Type a new name and press Enter — verify the new name is saved and the rename input closes without submitting any form
**Expected result:** Dashboard creation, listing, and rename all work. Rename specifically must not bubble up to the chat input (regression from prior fix).
**UX concern:** This tab was recently implemented (Phase 4). The rename input's Enter key event must have stopPropagation to avoid triggering other actions. Test this explicitly.

---

## Flow 15: Deleting a Session
**Goal:** A developer cleans up old or test sessions they no longer need.
**Steps:**
1. Create two new sessions with recognizable names ("Test Session A" and "Test Session B")
2. Right-click or hover over "Test Session A" in the sidebar — verify a context menu or delete button appears
3. Click delete (or "Remove")
4. Verify a confirmation prompt appears ("Are you sure?" or similar — especially since this is irreversible)
5. Confirm the deletion
6. Verify "Test Session A" is removed from the sidebar immediately
7. Verify "Test Session B" is still present and unaffected
8. Click on "Test Session B" to confirm the main panel correctly shows that session
9. Attempt to delete the currently active session — verify the app handles this gracefully (switches to another session or shows empty state, does not crash)
10. Reload the app — verify the deleted session does not reappear
**Expected result:** Deletion is permanent, confirmed, and non-destructive to other sessions.
**UX concern:** Deleting without confirmation is a UX failure. Deleting the active session and then crashing or showing a broken state is a bug. The UI should handle the "deleted the currently open session" case explicitly.

---

## Flow 16: Long Session Name Edge Case
**Goal:** Test how the sidebar handles an extremely long session title.
**Steps:**
1. Create a new chat session
2. Rename it to a 120-character string: "This is an extremely long session name that no reasonable person would ever type but that we need to test for overflow handling"
3. Verify the sidebar truncates the name gracefully (ellipsis or clip, no horizontal overflow)
4. Hover over the truncated name — verify a tooltip shows the full name (optional but good UX)
5. Verify the sidebar layout is not broken (no text overflowing Activity Bar or main panel)
6. Click the session with the long name — verify the main panel shows it correctly
7. Rename it to a single character: "X"
8. Verify the sidebar still displays it cleanly (no large empty space or misaligned elements)
9. Rename it back to a medium-length name
10. Verify all sidebar items realign correctly after the rename
**Expected result:** The sidebar handles any title length gracefully via CSS truncation. No layout breakage.
**UX concern:** CSS `overflow: hidden` with `text-overflow: ellipsis` must be applied to session title elements. If the title wraps to multiple lines, the sidebar will be visually broken.

---

## Flow 17: Empty State Verification Across All Views
**Goal:** Verify that every view shows a meaningful empty state when there is no data.
**Steps:**
1. (Set up: ensure you have a fresh account or clear all data) Open the app
2. Go to the Chat view — verify the CONVERSATIONS sidebar shows an empty state with guidance
3. Go to the Workspaces view — verify the PROJECTS sidebar shows an empty state with a "Create Project" CTA
4. Go to the Teams view — verify an empty state with context about what Teams are
5. Go to the Agents view — verify an empty state with context about what Agent Profiles are
6. Go to Settings > Status — verify subscription info is shown (or a helpful message if unauthenticated)
7. Return to Chat view and create a session, then delete it
8. Verify the Chat view returns to the empty state (not a blank white panel)
9. Go to Workspaces, create and then delete a project
10. Verify the Workspaces view returns to the empty state
**Expected result:** Every empty state is informative and action-oriented, never a blank panel.
**UX concern:** A blank white panel where an empty state should be is one of the most common first-impression failures. All four main views must have empty states tested.

---

## Flow 18: Agent Profile Creation
**Goal:** A developer creates a custom Claude agent profile for a specific use case.
**Steps:**
1. Click the Agents icon in the Activity Bar
2. Verify the sidebar shows "AGENTS" or "AGENT PROFILES" header and a list (or empty state)
3. Click a button to create a new agent profile
4. Enter a name: "Code Reviewer"
5. Enter a system prompt: "You are a senior software engineer performing code reviews. Focus on correctness, security, and maintainability. Be direct and specific."
6. Set any other available options (model, temperature, tools, etc.)
7. Save the profile
8. Verify the "Code Reviewer" profile appears in the sidebar list
9. Click on the profile to open it — verify the details are displayed correctly
10. Click "Use this agent" or start a chat using this profile — verify the system prompt is applied to the new session
**Expected result:** Agent profiles are created, persisted, and usable in chat sessions.
**UX concern:** If the system prompt field has no character limit indicator and cuts off silently, users will be confused when long prompts are truncated. If "Use this agent" creates a session but the system prompt is not actually applied, this is a critical functional gap.

---

## Flow 19: Agent Profile Edit and Delete
**Goal:** A developer updates and later removes an agent profile.
**Steps:**
1. Open an existing agent profile created in Flow 18 ("Code Reviewer")
2. Click "Edit" or click into the name/prompt fields to modify them
3. Change the name to "Code Reviewer — Security Focus"
4. Update the system prompt to add: "Pay special attention to injection vulnerabilities and authentication flaws."
5. Save the changes
6. Verify the sidebar reflects the new name
7. Open the profile again — verify the updated system prompt is shown
8. Start a chat using this profile — send "Review this: SELECT * FROM users WHERE id = " + userInput
9. Verify the model's response reflects the security-focused system prompt
10. Delete the profile — verify it is removed from the sidebar and does not appear in future new-chat profile selectors
**Expected result:** Edit and delete both work. Changes are immediately reflected in the UI and persisted.
**UX concern:** Deleting an agent profile that is currently being used in an active chat session should not crash that session. The session should continue with the original system prompt already in effect.

---

## Flow 20: Forking a Session
**Goal:** A developer wants to branch a conversation to explore an alternative approach without losing the original.
**Steps:**
1. Open a chat session with at least 4 messages (2 user, 2 assistant)
2. Find the fork/branch option — this may be a context menu on a message, a button in the session header, or a slash command (/fork)
3. Trigger the fork
4. Verify a new session is created in the sidebar with a name indicating it's a fork (e.g., "Code Reviewer — Fork" or "Copy of Code Reviewer")
5. Open the forked session — verify it contains all messages up to the fork point
6. Send a new message in the forked session: "Let's try a completely different approach using functional programming"
7. Verify the response continues from the fork point, not from scratch
8. Return to the original session — verify it is unchanged
9. Verify both sessions are independently listed in the sidebar
10. Delete the fork — verify the original session is unaffected
**Expected result:** Fork creates an independent copy of the conversation up to the fork point. Both sessions are independent after the fork.
**UX concern:** If the fork inherits session ID instead of copying message history, it may overwrite the original. If there is no visual indication that a session is a fork, users will be confused about the relationship.

---

## Flow 21: Continuing a Session After App Restart
**Goal:** A developer closes and reopens the app and verifies session history is intact.
**Steps:**
1. Open a chat session and send 3-4 messages with substantial content
2. Note the session title and the last message content
3. Close the app completely (not just minimize — fully quit)
4. Reopen the app
5. Verify the CONVERSATIONS sidebar shows the same sessions as before
6. Click the session from step 1
7. Verify all messages (user and assistant) are present and correctly ordered
8. Verify the chat input is empty and focused
9. Send a new message in the same session: "Continuing from where we left off — can you summarize what we discussed?"
10. Verify the model's response demonstrates awareness of the prior conversation
**Expected result:** Full session persistence across app restart. Multi-turn context is maintained.
**UX concern:** If messages are stored in memory only (not SQLite), they will be lost on restart. If the session ID changes on restart, the model will lose context. Both are critical correctness failures.

---

## Flow 22: Very Long Streamed Response
**Goal:** Test how the app handles a very long model response (e.g., generating a large code file).
**Steps:**
1. Create a new chat session
2. Send: "Write me a complete, production-ready React component library in TypeScript with 10 different components: Button, Input, Modal, Dropdown, Tabs, Card, Badge, Avatar, Tooltip, and Toast. Include full TypeScript types and prop documentation."
3. Observe the streaming response as it appears — verify text renders smoothly without lag
4. Watch for any layout issues: does the message container expand properly? Does the sidebar remain accessible?
5. Verify scrolling works during streaming (auto-scroll to bottom, with ability to scroll up to read earlier content)
6. Wait for the full response to complete
7. Scroll through the entire response — verify no content is clipped or cut off
8. Copy a code block from the response — verify the clipboard copy works
9. Verify the message takes up appropriate space (not overflowing into the Activity Bar or sidebar)
10. Note the total time for the response to complete and verify the streaming indicator (loading spinner or cursor) disappears on completion
**Expected result:** Long responses render correctly, scroll properly, and complete cleanly.
**UX concern:** If the chat panel does not handle very long messages with proper scroll behavior, users reading long code blocks will fight with auto-scroll. If code blocks have horizontal scroll, verify it works without breaking the layout.

---

## Flow 23: Command Palette via Cmd+K
**Goal:** A developer uses Cmd+K to access the global command palette for quick navigation.
**Steps:**
1. With the app open on any view, press Cmd+K
2. Verify a command palette overlay appears (centered modal or top-bar style)
3. Verify the palette shows a list of available commands or recent items
4. Type "new" — verify results filter to commands related to creating new things
5. Select "New Chat" from the filtered results — verify a new session is created
6. Press Cmd+K again, type "settings"
7. Select the Settings option — verify Settings opens
8. Press Cmd+K once more, type a session name keyword (e.g., "Claude SDK")
9. Verify the matching session appears in results — select it to navigate directly to that session
10. Press Escape at any point during the above — verify the palette closes without side effects
**Expected result:** Cmd+K opens a global palette that can navigate to sessions, views, and commands. Escape always closes it cleanly.
**UX concern:** If Cmd+K is not implemented at the app level (only the / button is), this test will reveal a missing shortcut. If the palette shows stale results (sessions that were deleted still appear), that is a data integrity issue.

---

## Flow 24: Activity Bar Icon Active States
**Goal:** Verify that the Activity Bar correctly highlights the active view at all times.
**Steps:**
1. Click the Chat icon in the Activity Bar — verify it is visually highlighted/active
2. Click the Workspaces icon — verify Chat becomes inactive and Workspaces becomes active
3. Click the Teams icon — verify Workspaces becomes inactive and Teams becomes active
4. Click the Agents icon — verify Teams becomes inactive and Agents becomes active
5. Click the gear (Settings) icon — verify Agents becomes inactive and the gear is highlighted
6. Click the user avatar — verify whatever action this triggers (profile menu, etc.)
7. Press Escape or close Settings — verify the Activity Bar reverts to the last non-Settings icon
8. Navigate between views rapidly (click Chat, Workspaces, Teams in quick succession)
9. Verify the highlighted state always matches the currently displayed view with no lag
10. Verify there is never a state where no icon is highlighted (the app is always "in" a view)
**Expected result:** Active state is always accurate, immediate, and visible.
**UX concern:** If active state is managed by local React state rather than derived from a router or global state manager, rapid clicking may cause the highlight to desync from the actual visible panel. This is a common bug in hand-rolled Activity Bar implementations.

---

## Flow 25: Settings — General Group (Theme and Preferences)
**Goal:** A developer customizes the app's appearance and verifies changes apply immediately.
**Steps:**
1. Open Settings via gear icon or Cmd+,
2. Click "General" in the settings left-sidebar
3. Locate a theme toggle (light/dark/system) if present
4. Switch from dark to light theme — verify the entire app updates immediately
5. Switch back to dark theme — verify immediate reversion
6. Set "system" theme if available — note the behavior
7. Find any font size or density setting — change it and verify it applies to the sidebar and main panel
8. Find any keyboard shortcut remapping option (if present) — note what shortcuts are customizable
9. Close settings
10. Reopen settings — verify all changed preferences are persisted
**Expected result:** All General settings apply immediately (no restart required) and persist across sessions.
**UX concern:** If theme changes require an app restart, that is a poor UX for a desktop app. If "system" theme doesn't react to the OS theme change at runtime, note it as a limitation.

---

## Flow 26: Settings — Status Group (Auth and Subscription)
**Goal:** A developer checks their subscription status and auth information.
**Steps:**
1. Open Settings via gear icon
2. Click "Status" in the settings left-sidebar
3. Verify the currently authenticated user's email is displayed
4. Verify the subscription plan is shown (Free, Pro, etc.)
5. Verify there is some indication of the authentication method (subscription auth vs API key)
6. If ANTHROPIC_API_KEY is set in the environment, verify it is noted in the status
7. Look for a "Sign out" or "Refresh status" button — verify it is present
8. Click "Refresh status" if present — verify it updates (or shows the same data if nothing changed)
9. Verify no sensitive information is exposed (API key values should not be shown in plaintext)
10. Close settings and verify the user avatar in the Activity Bar reflects the logged-in user
**Expected result:** Status group shows accurate auth info. No credentials are exposed in plaintext.
**UX concern:** If the auth status shows "Unknown" or an error state even when the app is working correctly (the health check passes), that is a display bug. API key values must never be shown in the UI.

---

## Flow 27: Settings — Integrations Group
**Goal:** A developer explores the Integrations section to connect external tools.
**Steps:**
1. Open Settings via gear icon
2. Click "Integrations" in the settings left-sidebar
3. Observe what integrations are listed (GitHub, Jira, Slack, custom webhooks, etc.)
4. Click on an available integration
5. Verify the integration's configuration options are shown (API endpoint, token field, etc.)
6. Attempt to configure an integration with invalid data — verify validation errors appear
7. Verify API key/token fields mask their values (type="password" or similar)
8. If a working integration is available, configure it correctly and verify a success state
9. Close and reopen settings — verify the integration state persists
10. Disable or disconnect the integration and verify the UI reverts to the disconnected state
**Expected result:** Integrations UI is present, validates inputs, masks secrets, and persists state.
**UX concern:** If the Integrations group is a placeholder ("coming soon"), note it for the backlog. Token input fields that display values in plaintext are a security concern and must be flagged.

---

## Flow 28: Switching Views During an Active Stream
**Goal:** Verify that view switching does not interrupt or corrupt an in-progress stream.
**Steps:**
1. Open a chat session and send a long-running prompt ("Write me a 500-line Python script for...")
2. While the response is streaming (tokens visible), click the Workspaces icon in the Activity Bar
3. Verify the app switches to Workspaces view cleanly (no crash, no freeze)
4. Wait 3 seconds, then click Chat in the Activity Bar
5. Verify the stream has continued in the background and the latest tokens are visible
6. Verify the streaming did not stop, duplicate, or corrupt upon returning to Chat view
7. Click Teams mid-stream, then Agents, then Chat — all within 2-3 seconds
8. Verify the stream completes correctly after all the rapid view switching
9. Verify the final message in the session is correctly stored (reload and check)
10. Verify no console errors were generated during the view switching
**Expected result:** Streaming is managed by the backend/fetch layer, not the view layer. View switching has no effect on in-progress streams.
**UX concern:** If streaming is tied to a React component that unmounts on view switch, the stream will abort. This is a common architectural error where the stream is managed inside a component rather than a global store or service worker.

---

## Flow 29: Teams View — Creating and Listing Teams
**Goal:** A developer sets up a team for multi-agent workflows.
**Steps:**
1. Click the Teams icon in the Activity Bar
2. Verify the Teams view is shown with its sidebar and main area
3. Observe the empty state — verify it explains what Teams are for
4. Click a "Create Team" or "New Team" button
5. Enter a team name: "Code Review Team"
6. Add a description: "Automated team for reviewing PRs with multiple agent perspectives"
7. Confirm creation
8. Verify the team appears in the sidebar list
9. Click the team to open its detail view
10. Verify the detail view shows the team's name, description, and any available actions (add agents, configure, delete)
**Expected result:** Team creation works and the team is listed. The detail view loads correctly.
**UX concern:** If Teams is a planned but unimplemented feature, the empty state must clearly say so rather than showing a broken UI. If team creation succeeds but the team does not appear in the sidebar, that is a state management bug.

---

## Flow 30: Full Developer Workflow — Session to Workspace to Notes
**Goal:** A realistic end-to-end workflow combining Chat, Workspaces, and Notes over 10 minutes of use.
**Steps:**
1. Start in Chat view — create a new session titled "API Design Session"
2. Send: "Help me design a REST API for a task management app. I need endpoints for users, tasks, projects, and comments."
3. Read the response — the model suggests a set of endpoints
4. Reply: "Good. Now let's add rate limiting and authentication requirements for each endpoint."
5. After the response, switch to Workspaces view
6. Create a new project: "Task Management API"
7. Open the WorkspacePanel, go to the Notes tab
8. Type notes summarizing the API design from the chat: "Auth: JWT bearer on all endpoints. Rate limit: 100 req/min per user. Endpoints: POST /users, GET /tasks, etc."
9. Switch to the Paths tab, add the local project directory if one exists
10. Return to Chat view and open the "API Design Session" — verify it is unchanged
11. Continue the conversation: "Now generate an OpenAPI 3.0 spec for these endpoints"
12. Copy the generated YAML from the response
13. Go to Workspaces > Task Management API > Notes, paste the spec there
14. Verify notes are saved (switch tabs and come back)
15. Return to Chat, create a new session from the API session: ask "What security vulnerabilities should I watch out for in this API design?"
**Expected result:** The full multi-view workflow works without data loss. Chat history, workspace notes, and paths all persist independently. The developer can use Chat for thinking and Workspaces for organizing the output.
**UX concern:** This flow crosses three major views and exercises nearly every sidebar. It is the highest-value smoke test. If any view loses state when another is opened, or if notes are not persisted, the fundamental data model of the app has a flaw. Run this flow first when validating a new build.

---

## Summary

| Category | Flows |
|----------|-------|
| First-time experience & onboarding | 1, 2 |
| Session management (create, rename, search, delete, fork) | 3, 4, 15, 16, 20 |
| Multi-turn conversation & context | 5, 21 |
| Command palette & keyboard shortcuts | 6, 10, 23 |
| Settings (all 5 groups) | 8, 9, 25, 26, 27 |
| Workspace creation & tabs | 11, 12, 13, 14 |
| View switching & Activity Bar | 7, 24, 28 |
| Edge cases (empty states, long content, streams) | 17, 22 |
| Agent profile lifecycle | 18, 19 |
| Teams view | 29 |
| Full end-to-end developer workflow | 30 |
