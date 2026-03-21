# UX Stories: Teams & Multi-Agent Swarm

Topic: Teams & Multi-Agent Swarm  
App Context: Claude Tauri Boilerplate -- Desktop AI coding assistant with git workspace management

---

## STORY-001: Create Team with Multiple Agents

**Type**: medium
**Topic**: Teams & Multi-Agent Swarm
**Persona**: Dev Lead (setting up coordinated AI agents for a codebase audit)
**Goal**: Create a team with 3 specialized agents (architect, reviewer, debugger) to work together
**Preconditions**: User is in Teams view with no teams created

### Steps
1. Click "New Team" button → Team creation dialog opens
2. Enter team name: "Code Audit Team"
3. Leave display mode as "Auto" (default)
4. Define Agent 1:
   - Name: "Architect"
   - Model: "claude-opus-4-6"
   - Description: "Analyzes overall system architecture and design patterns"
   - Permission Mode: "normal"
5. Click "+ Add Agent" → New agent form appears below
6. Define Agent 2:
   - Name: "Reviewer"
   - Model: "claude-opus-4-6"
   - Description: "Examines code quality and suggests improvements"
   - Permission Mode: "normal"
7. Click "+ Add Agent" → Third agent form appears
8. Define Agent 3:
   - Name: "Debugger"
   - Model: "claude-opus-4-6" (optional, can leave as default)
   - Description: "Identifies bugs and performance issues"
   - Permission Mode: "dontAsk"
9. Click "Create Team" → Dialog closes, new team appears in list
10. Team card shows: "Code Audit Team" | "3 agents" | "auto" | creation date

### Variations
- **Different display modes**: User selects "tmux" for sandboxed execution per agent
- **Mixed permission modes**: Some agents set to "acceptEdits", others to "dontAsk"
- **Single agent team**: User only defines 1 agent (minimum requirement)
- **Default models**: Leave model selector empty for all agents (use default model)

### Edge Cases
- **Duplicate agent names**: User enters "Reviewer" twice → Error: "Duplicate agent name: Reviewer"
- **Missing description**: User tries to submit with blank description → Error: "All agents must have a description"
- **Empty team name**: User clicks Create with blank name → Error: "Team name is required"
- **Escape key**: User presses Escape mid-form → Dialog closes, form resets
- **Network delay**: Create button shows "Creating..." state for 2+ seconds

---

## STORY-002: Open Team and Monitor Live Agent Status

**Type**: medium
**Topic**: Teams & Multi-Agent Swarm
**Persona**: Team Manager (checking on active team during orchestration)
**Goal**: Open a team and see which agents are currently active/idle/stopped
**Preconditions**: "Code Audit Team" exists with 3 agents; one is actively processing

### Steps
1. Click "Code Audit Team" in the team list → TeamWorkspace view opens
2. Header shows: "Team: Code Audit Team" | "auto" | "Shutdown All" button
3. Left sidebar displays agent cards:
   - "Architect" with green pulsing dot (active), "Active" label
   - "Reviewer" with yellow dot (idle), "Idle" label, no current task
   - "Debugger" with yellow dot (idle), "Idle" label
4. Agents sidebar shows count: "Agents (3)"
5. Architect card shows: "Current Task: Analyzing main.ts module structure"
6. Click Architect card → Card expands to show:
   - Status: Active (pulsing)
   - Model: claude-opus-4-6
   - Tools: file_read, glob_search, code_analysis
7. Click Reviewer card → Expands showing no tools configured
8. Scroll down in agents panel → Task board visible with status counts

### Variations
- **Agent stops**: Reviewer dot changes to gray (stopped), "Stop" button disappears
- **New agent joins**: Fourth agent appears in sidebar with idle status (e.g., post-mortem analyzer)
- **All agents idle**: No pulsing dots, all show "Idle"
- **Click Stop button**: Reviewer's Stop button becomes disabled immediately after click

### Edge Cases
- **Network sync lag**: Agent status updates 1-2 seconds after actual state change
- **Unknown status**: Agent shows status "awaiting" (state transition), ambiguous color (orange)
- **Too many agents**: Sidebar overflows, becomes scrollable within left panel
- **Missing current task**: Active agent has no task description (just shows status)

---

## STORY-003: Send Direct Message Between Agents

**Type**: short
**Topic**: Teams & Multi-Agent Swarm
**Persona**: Orchestrator (script-based inter-agent coordination)
**Goal**: Send a direct message (DM) from Architect to Reviewer with findings
**Preconditions**: Team workspace is open, both agents exist

### Steps
1. Message flow panel shows: "Messages" header with filter box and count "0"
2. Panel is empty: "No messages yet" (center-aligned)
3. (Simulated/API) POST to `/api/teams/{id}/messages`:
   ```
   from: "Architect"
   to: "Reviewer"
   type: "message"
   content: "Module structure is too tightly coupled. Consider dependency injection."
   ```
4. New message appears in message flow (auto-scrolls to bottom):
   - "Architect → Reviewer" with blue "DM" badge
   - Message content in monospace: "Module structure is too tightly coupled..."
   - Timestamp: "10:35:42 AM"
5. Message list now shows: "1" in count badge

### Variations
- **Broadcast message**: type = "broadcast", message shows purple "Broadcast" badge, routes to "all"
- **Shutdown request**: type = "shutdown_request", red badge, routed to specific agent
- **Filter messages**: User types "Reviewer" in filter → Shows only messages from/to Reviewer
- **Scroll history**: User scrolls up to see earlier messages

### Edge Cases
- **Very long message**: Content wraps and breaks appropriately
- **Special characters**: Message contains code with quotes, backticks renders safely
- **Missing recipient**: POST to non-existent agent → 400 error or silent failure
- **Rapid messages**: 5+ messages arrive in 1 second → All render, no lag

---

## STORY-004: Manage Agent Tasks with Kanban Board

**Type**: medium
**Topic**: Teams & Multi-Agent Swarm
**Persona**: Project Lead (tracking team progress via task workflow)
**Goal**: Create tasks, assign to agents, and move through workflow columns
**Preconditions**: Team workspace open, task board visible at bottom

### Steps
1. Task board header shows: "Tasks" toggle button, "Pending(2) | In Progress(1) | Done(0)"
2. Click toggle to expand → Three columns appear:
   - "Pending (2)" column with tasks:
     - "Refactor Database Layer" (no assignee)
     - "Add Type Definitions" (no assignee)
   - "In Progress (1)" with:
     - "Review Configuration Module" assigned to "Reviewer"
   - "Completed (0)" column (empty)
3. (Simulated API) Add new task: "Test Error Handling" assigned to "Debugger"
   - Task appears in Pending column
   - Count updates: "Pending(3)"
4. (Simulated API) Move "Test Error Handling" to In Progress:
   - Task moves to middle column
   - Counts update: "Pending(2) | In Progress(2)"
5. (Simulated API) Move "Review Configuration Module" to Completed:
   - Task moves to right column
   - Completed column shows 1 task with green checkmark
   - Counts update: "Pending(2) | In Progress(1) | Done(1)"

### Variations
- **Collapse board**: Click toggle again → Board collapses to single header line
- **No tasks**: All columns show "None" placeholder with muted text
- **Multiple assignees**: Task shows multiple assignee badges (e.g., "Reviewer, Debugger")
- **Long task subject**: Text truncates with ellipsis if exceeds column width

### Edge Cases
- **Reassign task**: User moves task from Reviewer to Debugger → Assignee badge updates
- **Delete task**: No UI for deletion (design decision), task stays in board
- **Pending → Completed skip**: User tries to move directly to Done (should go through In Progress)
- **Board scrolls with narrow viewport**: Columns stack horizontally, become scrollable

---

## STORY-005: Delete and Shutdown Teams

**Type**: short
**Topic**: Teams & Multi-Agent Swarm
**Persona**: Admin (cleaning up completed team orchestrations)
**Goal**: Safely shutdown active agents, then delete team
**Preconditions**: Team workspace open with agents running

### Steps
1. Click "Shutdown All" button in header → Button changes to two-button confirmation:
   - Red "Yes, Shutdown" button
   - Gray "Cancel" button
   - Text: "Confirm?"
2. Click "Yes, Shutdown" → All agents transition to "stopped" status:
   - Architect dot becomes gray
   - Reviewer dot becomes gray
   - Debugger dot becomes gray
   - All show "Stopped" label
   - Stop buttons disappear from cards
3. Click back arrow → Return to Teams list view
4. "Code Audit Team" card still visible with action buttons
5. Click "Delete" button on team card → Confirmation:
   - Button text changes to red "Delete"
   - Alternate button appears: "Cancel"
6. Click "Delete" → Team disappears from list
7. Teams list now shows remaining teams or empty state

### Variations
- **Cancel shutdown**: Click "Cancel" before confirming → Buttons revert to "Shutdown All"
- **Cancel delete**: Click "Cancel" on delete confirmation → Team stays in list
- **Delete without shutdown**: Click Delete directly from list (no shutdown first)
- **Rapid actions**: User clicks Delete, then Cancel rapidly → Stable state maintained

### Edge Cases
- **Network timeout**: Shutdown takes 5+ seconds → Loading spinner or disabled state
- **Agent restart mid-shutdown**: One agent restarts while shutting down others
- **Delete fails**: 500 error from API → Error toast, team remains in list
- **Last team**: Deleting last team → Returns to empty state with "No teams yet"

---

## STORY-006: Expand Agent Details and View Tools

**Type**: short
**Topic**: Teams & Multi-Agent Swarm
**Persona**: DevOps Engineer (verifying agent configurations)
**Goal**: View detailed agent configuration including assigned tools
**Preconditions**: Team workspace open, agents sidebar visible

### Steps
1. Agent card shows compressed state: name + status dot + "Active"/"Idle" label
2. Click on "Reviewer" card to expand
3. Card grows with additional section showing tools:
   - "Tool 1: git_read"
   - "Tool 2: file_glob"
   - "Tool 3: code_review"
   - Each tool in light blue badge
4. Card also shows:
   - Model chip: "claude-opus-4-6"
5. Click again to collapse → Extra sections hide, card returns to compact state
6. Click on "Debugger" (no tools) → Expands showing:
   - Italic text: "No tools configured"
   - Model: default (if inherited)

### Variations
- **Many tools**: Agent has 10+ tools → Tools section becomes scrollable
- **Custom tool names**: Tools show integration names like "linear_api", "github_read"
- **Tool tooltips**: Hover over tool badge → Shows tool description (if available)
- **Copy tool list**: Right-click on expanded section → Copy tools as CSV

### Edge Cases
- **Missing model info**: Agent model is null/undefined → Shows "Default model" instead of specific version
- **Malformed tool list**: Agent has tools = undefined → "No tools configured" shown
- **Very long agent names**: Name wraps or truncates in compact view, shows fully in expanded

---

## STORY-007: Change Team Display Mode

**Type**: short
**Topic**: Teams & Multi-Agent Swarm
**Persona**: Platform Architect (testing different orchestration modes)
**Goal**: Switch team from "auto" to "tmux" mode mid-team-lifecycle
**Preconditions**: Team workspace open, display mode badge visible in header

### Steps
1. Header shows: "Team: Code Audit Team" | badge: "auto" (gray background)
2. Badge is clickable (or there's a settings icon next to it)
3. Click display mode badge → Dropdown menu appears:
   - "Auto" (currently selected, checkmark)
   - "In-Process"
   - "Tmux"
4. Click "Tmux" → Dropdown closes, badge updates to "tmux"
5. (Optional) Agents restart in new mode, statuses briefly show "restarting"
6. Agents return to active/idle status in new orchestration mode

### Variations
- **No change needed**: User clicks "Auto" (current mode) → No visual change
- **Settings panel**: Mode selector is in a separate settings/config panel (accessed via icon)
- **Read-only mode**: Display mode is set at creation time, cannot be changed (no UI)
- **Mode preview**: Tooltip on badge explains each mode (auto=smart, tmux=sandboxed, etc.)

### Edge Cases
- **Mode change fails**: 500 error → Error toast, mode reverts to previous value
- **Active orchestration during change**: Team is running tasks → Prevents mode change or queues it
- **Unknown mode**: Backend returns mode="experimental" → UI falls back to "auto" label

---

## STORY-008: Handle Agent Stop from Sidebar

**Type**: short
**Topic**: Teams & Multi-Agent Swarm
**Persona**: Monitor/Observer (stopping misbehaving agent)
**Goal**: Stop a single running agent without shutting down entire team
**Preconditions**: Team workspace open, "Architect" agent is active (pulsing green)

### Steps
1. Architect card displays:
   - Green pulsing dot
   - "Architect" name
   - "Active" label
   - Red "Stop" button (visible only if status !== 'stopped')
2. Current task: "Analyzing main.ts module structure"
3. Click "Stop" button → Button becomes disabled immediately
4. Architect's status updates:
   - Dot changes from green to gray
   - Label changes from "Active" to "Stopped"
   - Stop button disappears
   - Current task clears or shows "Stopped at 10:45:23 AM"
5. Other agents (Reviewer, Debugger) remain unchanged

### Variations
- **Stop already-stopped agent**: Stop button not visible, cannot click
- **Stop idle agent**: Reviewer (idle) has Stop button → Click stops it (prevents restart)
- **Stop via API**: POST `/api/teams/{id}/agents/{name}/stop` (internal mechanism)
- **Bulk stop**: Select multiple agents, click "Stop All" (variant of shutdown flow)

### Edge Cases
- **Stop button click lag**: Click takes 1-2 seconds to register (network delay)
- **Agent restarts after stop**: Agent returns to active mid-stop transition (race condition)
- **Cannot stop**: Agent in cleanup state, Stop button disabled with tooltip "Cannot stop during cleanup"
- **Already stopped**: Button click has no effect (idempotent)

---

## STORY-009: Filter Messages by Agent Name

**Type**: short
**Topic**: Teams & Multi-Agent Swarm
**Persona**: Debugger (reviewing agent conversations for a specific interaction)
**Goal**: Filter message flow to show only communications from/to "Reviewer"
**Preconditions**: Team workspace open, 5+ messages in message flow

### Steps
1. Message flow panel header shows: "Messages" label + filter input + count "5"
2. Filter input placeholder: "Filter by agent..."
3. Type "Reviewer" in filter box
4. Message list updates in real-time:
   - Now shows 3 messages (out of 5 original):
     - "Reviewer → Debugger: Review database migration..."
     - "Architect → Reviewer: Please analyze schema..."
     - "Reviewer → Architect: Schema looks good but..."
5. Count badge updates: "3"
6. Clear filter (delete text or click X) → All 5 messages return

### Variations
- **Case insensitive**: Type "reviewer" (lowercase) → Still matches "Reviewer"
- **Partial match**: Type "eview" → Still finds messages from/to Reviewer
- **No matches**: Type "NonExistent" → Shows "No messages yet" (filtered result)
- **Filter broadcasts**: Type "all" to show only broadcast messages (type = "broadcast")

### Edge Cases
- **Filter while messages arriving**: New message from Reviewer arrives → Appears in filtered list immediately
- **Filter with empty message flow**: Type anything in empty state → Stays empty with "No messages yet"
- **Whitespace filter**: Type "   " (spaces) → Treated as empty filter, shows all messages
- **Very long filter**: Paste 100 characters → Input accepts but may not match any agent names

---

## STORY-010: Shutdown Team with Confirmation Flow

**Type**: short
**Topic**: Teams & Multi-Agent Swarm
**Persona**: Session Manager (ending team orchestration gracefully)
**Goal**: Execute full team shutdown with two-step confirmation
**Preconditions**: Team workspace open with all agents running

### Steps
1. Team header displays "Shutdown All" button (destructive red/orange styling)
2. Click "Shutdown All" → Header changes to confirmation mode:
   - Confirmation text: "Confirm?"
   - Red button: "Yes, Shutdown"
   - Gray button: "Cancel"
3. Click "Yes, Shutdown" → All agents stop:
   - Architect: green → gray, "Stopped"
   - Reviewer: yellow → gray, "Stopped"
   - Debugger: yellow → gray, "Stopped"
   - Header reverts: "Shutdown All" button reappears
4. Return to Teams list → Team still exists for re-use or deletion

### Variations
- **Cancel at confirmation**: Click "Cancel" → Reverts to "Shutdown All" button, no change to agents
- **Shutdown from list**: No direct UI; must open team first
- **Auto-shutdown**: Team shuts down after timeout or all tasks completed (background behavior)
- **Partial shutdown**: Only shutdown agents in "active" state (implementation detail)

### Edge Cases
- **Rapid double-click**: User clicks "Shutdown All" twice quickly → Second click ignored (already confirmed)
- **Network error during shutdown**: Some agents stop, others remain active → Show error, allow retry
- **Agents restart during shutdown**: One agent auto-recovers → Status updates reflect actual state
- **Shutdown takes 10+ seconds**: No progress indicator → May feel stuck to user

---

## STORY-011: Create Team with Mixed Agent Permissions

**Type**: medium
**Topic**: Teams & Multi-Agent Swarm
**Persona**: Security Officer (setting up controlled agent escalation)
**Goal**: Create team where only trusted agent has "dontAsk" permission
**Preconditions**: On Teams view, no teams created

### Steps
1. Click "New Team"
2. Team name: "Security Review Team"
3. Display mode: "auto"
4. Agent 1:
   - Name: "Gatekeeper"
   - Description: "Initial security triage and gate-keeping"
   - Model: default
   - Permission mode: "normal" (requires confirmation for each action)
5. Click "+ Add Agent"
6. Agent 2:
   - Name: "Executor"
   - Description: "Trusted agent that executes changes without asking"
   - Model: claude-opus-4-6
   - Permission mode: "dontAsk" ← Selected
7. Click "+ Add Agent"
8. Agent 3:
   - Name: "Reviewer"
   - Description: "Post-action review and logging"
   - Permission mode: "plan" ← User must approve steps first
9. Create team → Team created with mixed permissions
10. Team card confirms: "3 agents" | "auto" mode

### Variations
- **acceptEdits mode**: Agent set to "acceptEdits" for code review auto-acceptance
- **Plan mode for all**: High-security team with all agents in "plan" mode
- **Change permissions later**: Edit agent in team detail → Adjust permission mode

### Edge Cases
- **Dontask without supervision**: "Executor" with "dontAsk" in live environment (risk)
- **Conflicting permissions**: Plan-mode agent blocked by normal-mode gatekeeper (workflow issue)
- **Permission validation**: Server validates that "dontAsk" agents have necessary tools configured

---

## STORY-012: View Team Metadata and Creation Info

**Type**: short
**Topic**: Teams & Multi-Agent Swarm
**Persona**: Admin (auditing team configurations)
**Goal**: View team details (creation date, display mode, agent count)
**Preconditions**: Multiple teams exist, user on Teams list view

### Steps
1. Teams list shows multiple teams:
   - "Code Audit Team" | "3 agents" | "auto" | "Mar 20, 2026"
   - "Security Review Team" | "3 agents" | "auto" | "Mar 19, 2026"
2. Hover over "Code Audit Team" card → Tooltip or expanded info shows:
   - Created: "March 20, 2026 at 10:30 AM"
   - Display Mode: "Auto orchestration"
   - Agents: 3 (Architect, Reviewer, Debugger)
   - Status: "Idle" (no active orchestration)
3. Click team → Opens workspace with all metadata visible in header

### Variations
- **Sorted by date**: Teams list sorted newest first (Mar 20 before Mar 19)
- **Search teams**: User types "audit" → Filters to "Code Audit Team"
- **Team description**: Teams have optional description field shown in list
- **Last accessed date**: Card shows "Last opened: 2 hours ago"

### Edge Cases
- **Very long team name**: "Code Audit Team for Enterprise Financial Services Pipeline" truncates with ellipsis
- **No creation date**: Should not occur, but display "Unknown" or epoch date
- **Future-dated team**: Creation date in future (clock skew) → Shows without error

---

## STORY-013: Add Agent to Existing Team

**Type**: short
**Topic**: Teams & Multi-Agent Swarm
**Persona**: Team Manager (scaling team mid-orchestration)
**Goal**: Add a new agent to an existing team without recreating
**Preconditions**: Team workspace open, 3 agents already defined

### Steps
1. Team has: Architect, Reviewer, Debugger (all idle or active)
2. (Hypothetical UI) Click "Add Agent" button in agents sidebar header
3. New agent form appears (inline or in popup):
   - Name: "Logger"
   - Description: "Logs all agent decisions and state transitions"
   - Model: default
   - Permission mode: "dontAsk"
4. Click "Add" → New agent appears in sidebar:
   - "Logger" with yellow idle dot
   - Status: "Idle"
   - No current task
5. Agents count updates: "Agents (4)"
6. Agents sidebar scrolls to show new agent

### Variations
- **Add agent via API**: POST `/api/teams/{id}/agents` with agent definition
- **Remove agent**: Click "Remove" on agent card → Agent removed from sidebar (reverse operation)
- **Existing agent duplicate**: Try to add "Reviewer" again → Error: "Agent already exists in team"
- **Many agents**: Adding 10th agent → Sidebar becomes scrollable, new agent appears at bottom

### Edge Cases
- **Add during active orchestration**: Unclear if new agent can join mid-task
- **Agent validation**: Missing description → Error: "Description required"
- **Duplicate names case-sensitive**: "reviewer" vs "Reviewer" → Allowed (case difference) or blocked?
- **Add agent to deleted team**: Team no longer exists → 404 error

---

## STORY-014: Navigate Between Team List and Workspace

**Type**: short
**Topic**: Teams & Multi-Agent Swarm
**Persona**: Team Manager (context switching between multiple teams)
**Goal**: Switch from team detail view back to list, then open different team
**Preconditions**: Two teams exist; user opened "Code Audit Team" workspace

### Steps
1. Team workspace shows: "← Back" link in header + "Team: Code Audit Team"
2. Click "← Back" → Returns to Teams list view
3. Both teams visible:
   - "Code Audit Team" | "3 agents"
   - "Security Review Team" | "3 agents"
4. Click "Security Review Team" → Switches to workspace for that team
5. Header updates: "Team: Security Review Team"
6. Agents sidebar loads agents: Gatekeeper, Executor, Reviewer
7. Message flow and task board are empty (separate per-team state)
8. Click "← Back" again → Returns to Teams list

### Variations
- **Rapid switching**: User clicks back and forth between teams quickly → Smooth transitions
- **Unsaved changes**: If team had unsaved task, switching discards it (no dialog)
- **Deep linking**: Direct URL to team workspace `/teams/:teamId` bookmarkable
- **Browser back button**: User presses browser back → Behaves like "← Back" link

### Edge Cases
- **Team deleted**: User opens team, admin deletes it, user tries back/forward → Handle gracefully (404)
- **Slow load**: Switching teams, workspace takes 2+ seconds to render → Show skeleton loader
- **List refreshed**: While in workspace, another session creates new team → New team visible on return to list

---

## STORY-015: Real-Time Agent Status Updates (Future Feature)

**Type**: medium
**Topic**: Teams & Multi-Agent Swarm
**Persona**: Orchestrator (monitoring live team execution)
**Goal**: See agent status changes in real-time (active → idle → stopped)
**Preconditions**: Team workspace open, WebSocket or polling enabled

### Steps
1. All agents initially idle (yellow dots)
2. (Background) Orchestration starts, "Architect" becomes active
3. Architect dot changes to green and starts pulsing (animation every ~500ms)
4. Current task updates: "Analyzing architecture patterns..."
5. (Background) Reviewer becomes active (green, pulsing)
6. (Background) Both working for 10 seconds, then Architect becomes idle again
7. Architect dot changes to yellow, stops pulsing
8. Current task clears
9. Message flow receives broadcast: "Architect → all: Analysis complete"
10. Task board updates: 1 task moves from "In Progress" → "Completed"

### Variations
- **Polling fallback**: If WebSocket unavailable, poll every 2 seconds (less responsive)
- **Status history**: Expand agent card to see timeline: "Active 10:30-10:45, Idle 10:45-present"
- **Status change notifications**: Toast notification: "Reviewer is now active"
- **Auto-refresh message flow**: New messages appear without manual refresh

### Edge Cases
- **Network disconnect**: Status updates lag, eventually catch up when connection restored
- **Concurrent status changes**: Two agents change status simultaneously → Both update properly
- **Stale status**: User loses network, status dot says "Active" but agent actually stopped
- **Performance under load**: 20+ agents updating every second → Throttle updates, aggregate changes

---
