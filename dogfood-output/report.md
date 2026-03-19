# QA Report: 30 User Flows
Date: 2026-03-19
Tester: dogfood-agent (Claude Sonnet 4.6 via MCP chrome tool)

## Summary
- Total flows tested: 30
- Flows passed: 25
- Flows with issues: 5
- Issues found: 7 (Critical: 0, High: 2, Medium: 3, Low: 2)

No crashes, no error boundaries triggered, no console errors detected during the entire test run.

---

## Issues Found

### ISSUE-001: Workspace item click does not load workspace detail
**Severity:** High
**Flow:** 27 (click a workspace to expand/view it)
**Steps to reproduce:**
1. Navigate to Workspaces view
2. Click on a workspace item (e.g., "Investigation" under "ai-domain-registration")
**Expected:** The workspace detail loads in the main content panel (working directory, branch info, chat context, etc.)
**Actual:** The main content area remains showing "Select a workspace or create one to get started". Nothing happens. The workspace is listed with a "Ready" badge but clicking it does nothing.
**Notes:** This is a significant functional gap — the workspace panel never loads.

---

### ISSUE-002: Command palette shows duplicate shortcut `Cmd+N` for two different commands
**Severity:** High
**Flow:** 16, 17, 18 (command palette)
**Steps to reproduce:**
1. Open a chat session
2. Click the `/` button or type `/` in the input
3. Observe the shortcuts listed
**Expected:** Each command has a unique, correct keyboard shortcut
**Actual:** Both `/new` (Start a new session) and `/restart` (Restart the session) show `Cmd+N` as their shortcut. This is a copy-paste error — one of them should have a different shortcut or no shortcut listed.
**Screenshot reference:** Observed in command palette screenshots (flows 16-18)

---

### ISSUE-003: Settings close button has no accessible label
**Severity:** Medium
**Flow:** 5, 6 (Settings open/close)
**Steps to reproduce:**
1. Click the gear icon to open Settings
2. Inspect the close button (×) in the top-right corner of the panel
**Expected:** The close button has an `aria-label` like "Close settings" and is reachable via keyboard navigation
**Actual:** The button has no accessible label (`aria-label` is null), making it invisible to screen readers. It also renders at approximately 26×26px inside the browser viewport scroll area, making it hard to click precisely with a mouse. The button was not found via accessibility tree queries and required JavaScript DOM inspection to locate.

---

### ISSUE-004: Delete confirmation tooltip/popover appears misaligned — overlaps adjacent session
**Severity:** Medium
**Flow:** 12 (Delete a session)
**Steps to reproduce:**
1. Hover over a session item at the top of the session list
2. Click the three-dot menu → Delete
3. Observe where the "Confirm Delete" button appears
**Expected:** The confirmation appears clearly attached to the session being deleted, either as an inline confirmation within that row or a modal dialog
**Actual:** The "Confirm Delete" button visually appears overlapping the second item in the list (below the target session), making it ambiguous which session is being deleted. A real user could accidentally think they're confirming a different session's deletion.

---

### ISSUE-005: Settings Status tab shows blank Email field
**Severity:** Medium
**Flow:** 22 (Settings Status tab)
**Steps to reproduce:**
1. Open Settings
2. Click "Status" tab
3. Observe the Account section
**Expected:** Email shows the connected Claude account email address
**Actual:** Email field shows "—" (dash/empty). Plan shows "Pro" correctly. The email is missing, which could indicate the auth status endpoint is returning partial data, or the field isn't being populated from the auth response.

---

### ISSUE-006: Workspace action buttons (Copy, Rename, Clean) always visible instead of hover-only
**Severity:** Low
**Flow:** 25, 27 (Workspaces view)
**Steps to reproduce:**
1. Navigate to Workspaces view
2. Observe workspace items in the sidebar
**Expected:** Action buttons (Copy, Rename, Clean) should appear only on hover to reduce visual clutter
**Actual:** For some workspace items, "Copy", "Rename", and "Clean" action links are persistently visible even without hovering. The sidebar appears cluttered with inline action labels. This appears inconsistent — some workspaces show the actions and some don't.

---

### ISSUE-007: Project names include raw UUIDs/slugs not suitable for user display
**Severity:** Low
**Flow:** 25 (Workspaces view — project list)
**Steps to reproduce:**
1. Navigate to Workspaces view
2. Observe the project list
**Expected:** Projects show friendly human-readable names
**Actual:** One project is named "reconcile-ws-fG6AeG" — this appears to be an internal ID/slug exposed directly to the user. While this may be a data issue rather than a UI bug, it looks unprofessional and confusing.

---

## Flow Results

| Flow | Description | Status | Notes |
|------|-------------|--------|-------|
| 1 | Activity Bar - all 4 icons work and highlight correctly | PASS | Chat, Workspaces, Teams, Agents all navigate correctly; active icon gets darker background |
| 2 | CONVERSATIONS header visible + `+` button creates new chat | PASS | Header shows "CONVERSATIONS", `+` creates new session with random name |
| 3 | PROJECTS header visible + `+` button works | PASS | "PROJECTS" header shown; `+` opens "Add Project" modal asking for git repo path |
| 4 | Switching Chat → Workspaces → Teams → Agents → Chat | PASS | All transitions work, no crashes, correct content loaded each time |
| 5 | Settings opens from gear icon, shows 5 nav groups | PASS | General, AI & Model, Data & Context, Integrations, Status all present |
| 6 | Each settings group clickable shows different content | PASS | All 5 tabs switch content correctly |
| 7 | Create new chat with "New Chat" button | PASS | Creates session with random food-pair name (e.g., "Sizzling Truffle") |
| 8 | Session list shows sessions after navigation back | PASS | Sessions persist and are listed correctly |
| 9 | Hover over session shows three-dot menu | PASS | Three-dot (⋯) button appears on hover |
| 10 | Rename a session via three-dot → Rename, press Enter | PASS | Inline edit mode activates; Enter commits the new name |
| 11 | Search sessions - type in box, filter works | PASS | Typing "Peppy" filters to 3 matching sessions instantly |
| 12 | Delete a session via three-dot → confirm → removed | PARTIAL | Delete works but confirm button overlaps adjacent session row (ISSUE-004) |
| 13 | Open existing session with messages - no crash | PASS | Session loaded without errors; message history renders correctly |
| 14 | User messages show "You" label, assistant shows "Claude" | PASS | Labels display correctly on all messages |
| 15 | Pro tip banner shows above input, X dismisses it | PASS | Banner visible; dismiss button works (required JS click due to small hit target) |
| 16 | Click `/` button opens command palette | PASS | Command palette opens showing CHAT and NAVIGATION sections |
| 17 | Type `/` in chat input opens command palette | PASS | Typing `/` triggers palette inline |
| 18 | Press Cmd+K opens command palette | PASS | Global shortcut works correctly |
| 19 | Close command palette with Escape | PASS | Escape closes the palette cleanly |
| 20 | Settings → AI & Model - shows Model/Advanced content | PASS | Model selector, Max Tokens, Temperature, System Prompt, Thinking Effort all shown |
| 21 | Settings → Data & Context - shows Instructions/Memory/MCP | PASS | CLAUDE.md Files, Memory section with MEMORY.md file shown |
| 22 | Settings → Integrations - shows Git/Linear content | PASS | Git Workspace Branch Prefix and Linear integration shown |
| 23 | Settings → change Theme Dark to Light, UI changes | PASS | Theme switches; settings panel and visible content update to light colors |
| 24 | Settings → change Theme back to Dark | PASS | Dark mode restored correctly |
| 25 | Workspaces icon - PROJECTS header visible | PASS | "PROJECTS" header shown with correct icon highlighted |
| 26 | Project list renders with items | PASS | 4 projects listed: ai-domain-registration, reconcile-ws-fG6AeG, repo, claude-tauri-boilerplate |
| 27 | Click workspace to expand/view | FAIL | Clicking workspace item does nothing; main panel doesn't update (ISSUE-001) |
| 28 | Empty workspace shows "+ New Workspace" button | PASS | All projects without workspaces show "+ New Workspace" link; clicking opens Create Workspace modal |
| 29 | Teams icon - view loads with "No teams yet" | PASS | "Agent Teams" view loads with empty state and "New Team" button |
| 30 | Agents icon - Agent Profiles view loads with header | PASS | "AGENT PROFILES" header shown; 2 profiles listed (Code Reviewer, Code Reviewer (copy)) |

---

## Additional Observations

### Suggested reply chips pre-fill input on click
When clicking a suggested reply chip ("Tell me more", "Can you give an example?", "Summarize this"), the text is placed in the chat input but not auto-submitted. This is reasonable UX but worth confirming it's intentional.

### Status bar at bottom
The status bar shows model (Haiku 4.5), context mode (Normal), git branch (main), and a green connection dot. This is informative and well-implemented.

### User avatar shows "Unknown"
The user avatar in the bottom-left of the activity bar shows "Unknown" with a `?` avatar image, and the status tab confirms Email is blank (only Plan: Pro is populated). This is likely connected to ISSUE-005.

### Workspace sidebar state flickering
When opening the "+ New Workspace" modal for one project, the sidebar appeared to update and show a different project's workspace ("source-branch-check" appeared under "reconcile-ws-fG6AeG" which previously showed no workspaces). This suggests the workspace data may be loading asynchronously and the initial render shows stale/empty data.

### No console errors
Zero JavaScript errors or warnings were logged throughout the entire 30-flow test session. The app is stable from a runtime error perspective.
