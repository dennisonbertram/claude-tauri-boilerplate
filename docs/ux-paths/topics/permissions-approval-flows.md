# UX Stories: Permissions & Approval Flows

Topic: Permissions & Approval Flows  
App Context: Claude Tauri Boilerplate -- Desktop AI coding assistant with git workspace management

---

## STORY-001: Request Permission to Run Bash Command

**Type**: short
**Topic**: Permissions & Approval Flows
**Persona**: Developer building a project with Claude
**Goal**: Approve a risky bash command before Claude executes it
**Preconditions**: Chat session active, permission mode = 'default', Claude attempts bash tool use

### Steps
1. Claude requests to execute `$ git status && npm run build`
2. PermissionDialog appears inline in chat with red border (high-risk)
3. Dialog shows ShieldAlert icon, "Bash" tool name, command in terminal-styled box
4. User reads the command and toggles "Always allow Bash for this session" checkbox
5. User clicks "Allow" button
6. Bash executes immediately, tool progress shows in chat
7. On next bash attempt in same session, no permission dialog appears (already allowed)

### Variations
- **Always allow**: User toggles checkbox before clicking Allow → scope = 'session' stored in permissionStore
- **Deny**: User clicks "Deny" → permission:denied event emitted, bash execution blocked
- **Timeout**: If user ignores dialog for 60 seconds, auto-deny and show error banner
- **Multiple tools**: Bash + Write both requested in same turn → two sequential permission dialogs

### Edge Cases
- User denies Bash, then agent tries same command again → Permission dialog re-appears (fresh request)
- User allows all high-risk tools but profile has disallowedTools=['Bash'] → Permission denied regardless
- Browser/Read requests don't show dialog (low-risk, auto-allow in default mode)

---

## STORY-002: Manage Tool Permissions in Agent Profile

**Type**: medium
**Topic**: Permissions & Approval Flows
**Persona**: AI engineer configuring an agent profile for a code review use case
**Goal**: Set up which tools the agent can access and require approval for risky ones
**Preconditions**: Agent Profile Editor open, on ToolsTab

### Steps
1. User opens Agents tab → clicks a profile or creates new one
2. Clicks ToolsTab, scrolls to "Permission Mode" dropdown
3. Selects "Plan" mode to require full plan review before tool execution
4. Scrolls to Tools section, sees "Show visual" vs "Show raw" toggle
5. Clicks "Visual" to see tool grid with Allow/Block/Default buttons per tool
6. Clicks "Allow" for Read, Glob, Grep (read-only tools)
7. Clicks "Block" for Write, Bash (restrict agent from modifying system)
8. Scrolls down, notices remaining tools default to "Default" (ask permission if used)
9. Clicks Save Profile
10. Next chat with this profile will only allow Read/Glob/Grep without prompting

### Variations
- **Allowlist mode**: Leave all tools at "Default" except explicitly Allow Read/Glob/Grep → agent restricted to those only
- **Denylist mode**: Block only Bash and Write, allow all others
- **Raw textarea mode**: Copy-paste tool names, one per line, for bulk configuration
- **Preset profiles**: User selects "Python-safe" or "Read-only" from template, auto-configures tools

### Edge Cases
- User sets allowedTools=['Read', 'Glob'] AND disallowedTools=['Read'] → disallowed wins, Read blocked
- User saves profile mid-edit, closes editor, reopens → unsaved changes lost (draft not persisted)
- Profile changes don't affect active session → only new sessions use updated tools

---

## STORY-003: Review and Approve a Workspace Plan

**Type**: medium
**Topic**: Permissions & Approval Flows
**Persona**: Engineering lead verifying an AI-generated plan before workspace creation
**Goal**: Review a multi-step plan and approve it before Claude executes workspace operations
**Preconditions**: Chat session active, permission mode = 'plan', Claude has generated a plan

### Steps
1. Chat shows PlanView with purple header "Planning..." and animated loading indicator
2. Plan content streams in (markdown formatted steps)
3. Plan completes, status changes to "Review Plan", button set changes
4. User scrolls and reads the 7-step plan for refactoring a module
5. User clicks "Approve" button (quick approve, no feedback)
6. PlanView updates: icon changes to green checkmark, status = "Plan Approved"
7. Claude automatically proceeds to execute the plan steps
8. Each executed step shows progress updates in the main chat

### Variations
- **Approve with feedback**: User clicks "Approve with Feedback" → input field appears with placeholder "Approval notes (optional)"
- **Provide input**: User clicks "Provide Input", adds clarification → Claude re-plans based on feedback
- **Reject with feedback**: User clicks "Reject" → field placeholder changes to "Feedback for changes (optional)" → Claude regenerates plan
- **Copy/Export**: User clicks "Copy" to copy plan to clipboard or "Export to New Chat" to branch conversation
- **Collapse approved**: After approval, user can toggle plan to collapsed view via chevron button

### Edge Cases
- User approves, but Claude hits permission error during execution → Plan shows as approved, but chat shows error for blocked tool
- User rejects twice with conflicting feedback → agent tries to reconcile or asks clarification
- Plan contains 50+ steps → scrollable content area, user might not see entire plan before approving
- Session persists → plan state lost on page refresh (UI state not persisted to backend)

---

## STORY-004: Identify Risk Level of Requested Tool

**Type**: short
**Topic**: Permissions & Approval Flows
**Persona**: Cautious developer wanting to understand what each tool can do
**Goal**: Quickly understand the risk level of a tool before deciding to allow it
**Preconditions**: PermissionDialog displayed in chat

### Steps
1. Claude requests Write permission
2. PermissionDialog appears with red border and ShieldAlert icon (indicates high-risk)
3. User recognizes red = dangerous → reads tool input showing file path and content preview
4. User clicks "Deny" to block file write
5. Later, Claude requests Grep permission
6. PermissionDialog appears with blue border and ShieldCheck icon (indicates low-risk)
7. User clicks "Allow" immediately (trusts low-risk tool)

### Variations
- **Medium risk**: Glob or custom tool → yellow border, Shield icon
- **No icon context**: User hovers over icon → tooltip explains "High-risk: Modifies files or runs commands"

### Edge Cases
- Unknown tool not in HIGH_RISK_TOOLS, LOW_RISK_TOOLS → defaults to medium risk
- Tool name is generic (e.g., "Execute") → user can't tell purpose from name, reads input section

---

## STORY-005: Set Up Session-Scoped vs. Permanent Permissions

**Type**: medium
**Topic**: Permissions & Approval Flows
**Persona**: Developer wanting to grant Bash access for current session only
**Goal**: Allow Bash for this session without permanently approving all future sessions
**Preconditions**: PermissionDialog for Bash displayed, user clicks "Always allow" checkbox

### Steps
1. Claude requests Bash: `$ npm install`
2. PermissionDialog shows with "Always allow Bash for this session" checkbox
3. User toggles checkbox (unchecked → checked)
4. User clicks "Allow"
5. PermissionDecisionResult sent with decision='allow_always', scope='session'
6. Backend permissionStore.addSessionAllowedTool(sessionId, 'Bash')
7. In same session, next Bash request skips dialog, auto-allows
8. User creates new session → first Bash request shows permission dialog again (session-specific)

### Variations
- **Session ended**: User closes chat/ends session → permissionStore.clearSession(sessionId) removes all session permissions
- **No checkbox**: If permission mode = 'acceptEdits', Write is auto-allowed (no dialog); Bash still prompts
- **Permanent scope**: Future enhancement: checkbox to save permission to profile (scope='permanent'), but currently only scope='session' supported

### Edge Cases
- User checks "Always allow", then immediately denies in a new session → conflicting UX (checbox implies always, but no global state)
- Multiple sessions active → each maintains own allowed set, no cross-session permission leakage

---

## STORY-006: Handle File Write Permission with Content Preview

**Type**: medium
**Topic**: Permissions & Approval Flows
**Persona**: Developer reviewing an AI-generated code file before Claude writes it
**Goal**: Inspect the file content Claude wants to write and approve/deny with full visibility
**Preconditions**: Claude requests Write or Edit permission, PermissionDialog displayed

### Steps
1. Claude requests to Write `/src/components/Button.tsx`
2. PermissionDialog appears with "File" label and file path in code box
3. Content section shows first 500 chars of tsx code with syntax highlighting (bg-muted)
4. User scrolls through content preview (max-h-32 overflow, shows truncation notice)
5. User spots potential issue in code → clicks "Deny"
6. Chat shows "Permission Denied: Write" banner with error message
7. User sends follow-up message with corrected instructions
8. Claude generates improved code and requests Write again
9. User reviews new preview and clicks "Allow"

### Variations
- **Edit mode**: User sees old_string (red bg, red text) and new_string (green bg, green text) side-by-side
- **Large file**: Content preview truncated at 500 chars with "..." indicator, user might not see full file (design limitation)
- **Deny without review**: User immediately clicks Deny without scrolling → tool blocked regardless of content

### Edge Cases
- File content contains special characters or non-UTF8 → preview might show garbled text
- Edit tool with multi-line old_string → red section might exceed max-h-24 overflow, require scroll
- Content is binary/image → ToolInputDisplay doesn't handle, falls back to JSON view

---

## STORY-007: Use Permission Mode = "Accept Edits" for Auto-Approval

**Type**: short
**Topic**: Permissions & Approval Flows
**Persona**: Developer with high trust in Claude's code generation
**Goal**: Skip file edit permission dialogs while still requiring approval for risky operations
**Preconditions**: Agent profile with permissionMode='acceptEdits'

### Steps
1. User creates new chat with profile set to permissionMode='acceptEdits'
2. Claude requests Edit (file modification)
3. No permission dialog appears → edit executes automatically
4. Claude requests Bash: `$ npm test`
5. PermissionDialog appears (Bash is high-risk, not covered by acceptEdits mode)
6. User reviews command and clicks "Allow"
7. Bash executes

### Variations
- **Write vs. Edit**: Both covered by acceptEdits; Bash, NotebookEdit still require permission
- **Read-only tools**: Always auto-allow regardless of mode

### Edge Cases
- permissionMode='acceptEdits' AND disallowedTools=['Edit'] → Edit still blocked even with mode setting
- User switches mode mid-chat → only affects new requests, doesn't retroactively apply to pending dialogs

---

## STORY-008: Handle Permission Denial and Error Recovery

**Type**: medium
**Topic**: Permissions & Approval Flows
**Persona**: User learning to safely set up agent tooling
**Goal**: Understand why a tool was blocked and provide new instructions
**Preconditions**: User has previously denied a tool, Claude tries same tool again

### Steps
1. Chat shows Claude's request to run Bash
2. User denies the request
3. ErrorBanner appears: "Permission Denied: Bash"
4. Chat continues (no tool execution, but conversation persists)
5. User sends new message: "Try a safer approach without bash"
6. Claude reformulates task using Read/Grep instead
7. No permission dialog appears for read-only tools
8. Task completes successfully

### Variations
- **Re-request same tool**: Claude tries Bash again in next turn → permission dialog re-appears (new requestId)
- **Different tool same turn**: Bash denied, but Claude also needs Write → two separate decisions needed
- **Tool output without permission**: Claude uses file content without running bash → allowed without dialog

### Edge Cases
- User denies Bash 5 times → should UI suggest blocking it in profile to reduce spam?
- Error message unclear (e.g., "Tool blocked") → user doesn't know if they denied or profile forbade it

---

## STORY-009: Enable Plan Mode for Multi-Step Review Workflow

**Type**: long
**Topic**: Permissions & Approval Flows
**Persona**: Senior engineer deploying critical infrastructure changes via Claude
**Goal**: Have Claude create a detailed plan before executing any modifications
**Preconditions**: Agent profile with permissionMode='plan'

### Steps
1. User opens new chat with profile set to permissionMode='plan'
2. User asks: "Refactor the auth module and update all tests"
3. Claude thinks and streams plan into PlanView (status='planning')
4. Plan completes: "1. Extract auth logic into utils... 2. Update unit tests... 3. Run full suite..."
5. PlanView status changes to 'review', shows Approve, Reject, Copy, Export buttons
6. User reads through plan (10+ steps), decides step 7 is risky
7. User clicks "Reject" → feedback input appears
8. User types: "Step 7: Use npm audit before updating deps"
9. User clicks "Confirm Reject"
10. Claude re-plans incorporating feedback
11. New plan appears in PlanView
12. User clicks "Approve" (blue button, no feedback)
13. Claude executes: Write, Edit, Bash requests now proceed without individual permission dialogs
14. Each step logs in chat with progress updates

### Variations
- **Approve with feedback**: User clicks "Approve with Feedback", adds notes (e.g., "Proceed but monitor logs")
- **Provide input during review**: User clicks "Provide Input" instead of approve/reject → sends clarifying question
- **Plan too long**: User skips to bottom via scrolling, notices "Saved to /tmp/plan-123.md" link
- **Quick approve**: User clicks "Approve" button directly (no feedback) for pre-reviewed plans
- **Handoff**: User clicks "Handoff" → exports plan to new chat for different agent

### Edge Cases
- Plan contains >30 steps → UX might feel overwhelming, user approval fatigue
- User approves plan, but first executed step hits permission error → plan continues or halts? (behavior undefined)
- Session loses plan state on refresh → PlanView resets, can't resume partial approval
- Feedback loop infinite: User rejects, Claude re-plans, user rejects again → no automatic exit condition

---

## STORY-010: Configure Sandbox for Tool Isolation

**Type**: medium
**Topic**: Permissions & Approval Flows
**Persona**: Security-conscious dev wanting isolated execution environment
**Goal**: Set up Docker sandbox to isolate agent tool execution from host system
**Preconditions**: Agent ProfileEditor open, on SandboxTab

### Steps
1. User opens Agents tab, selects profile or creates new
2. Clicks SandboxTab to see sandbox configuration
3. Info banner explains: "A sandbox runs your agent's tools in an isolated environment"
4. Sees 4 preset buttons: None, Node.js, Python 3, Custom JSON
5. User clicks "Python 3"
6. JSON editor auto-populates with Python 3 Docker config (image: 'python:3.11-slim', volumes)
7. User reads config, modifies volume mount: `/workspace:/workspace` → `/data:/data`
8. Validation shows "Valid JSON" in green
9. User saves profile
10. Next chat with this profile runs all tools inside Python 3 container
11. Bash commands execute inside container (isolated from host)
12. File writes go to container volume (mapped to /data host path)

### Variations
- **No sandbox**: User selects "None" → tools run directly on host (no isolation)
- **Node.js preset**: User selects "Node.js" → node:20-slim image
- **Custom JSON**: User selects "Custom" → free-form JSON editor for advanced config
- **Invalid JSON**: User types malformed config → "Invalid JSON" warning in red, save disabled
- **Multi-volume**: User adds multiple volume mounts in custom config

### Edge Cases
- Docker not installed → tools fail at runtime with unclear error "Container start failed"
- Sandbox image has limited tools → agent tries to run tool not available in image (e.g., cargo in Python image)
- Permissions inside container → file write might fail due to container user permissions (uid mismatch)

---

## STORY-011: Review Risk Level in Permission Mode Settings

**Type**: short
**Topic**: Permissions & Approval Flows
**Persona**: Team lead reviewing company policy for AI agent tool access
**Goal**: Understand how each permission mode affects risk exposure
**Preconditions**: Agent ProfileEditor open, ToolsTab visible

### Steps
1. User opens ToolsTab, sees "Permission Mode" dropdown with 4 options
2. Hovers over "Plan" option → description tooltip: "Create a plan first, then ask for approval"
3. Selects "Plan" from dropdown
4. Reads policy text below: "Default: Ask for permission on risky operations"
5. Recognizes "Plan" is safer than "Default" (plan review → approval gate)
6. Clicks to "Accept Edits" option → description: "Auto-accept file edits, ask for other operations"
7. Understands: Write/Edit auto-approved, but Bash still prompts
8. Hovers over "Bypass Permissions" → description: "Skip all permission prompts (use with caution)"
9. Decides "Bypass" too risky for team → selects "Plan" mode
10. Saves profile

### Variations
- **Compare modes side-by-side**: UI shows comparison table (Default vs. Plan vs. Accept Edits vs. Bypass)
- **Per-profile risk scoring**: UI shows "Risk Level: Medium" for current mode selection

### Edge Cases
- Descriptions too technical → user confused about practical impact
- Mode selection doesn't show which tools are affected → unclear what "Accept Edits" really means

---

## STORY-012: Recover from Permission Timeout or Disconnection

**Type**: medium
**Topic**: Permissions & Approval Flows
**Persona**: User in long-running chat interrupted by network issue
**Goal**: Resume chat without losing pending permission request or session state
**Preconditions**: Permission dialog waiting for user input, network disconnects or page closes

### Steps
1. Chat session active, Claude requests Bash permission
2. PermissionDialog displayed, user steps away
3. Network disconnects (simulated timeout)
4. After 60 seconds, permission request auto-denies with banner: "Permission request expired"
5. User reconnects moments later
6. Chat state preserved (messages, context still visible)
7. Claude's bash-requiring action failed silently
8. Chat shows error: "Tool execution failed: permission denied"
9. User can retry with corrected instructions or re-enable tool

### Variations
- **Manual timeout UI**: Instead of auto-deny, show countdown timer "Expires in: 45s" on permission dialog
- **Persistent permission state**: Store pending permissions to backend → survive page reload
- **Resumable sessions**: sessionId persists → reconnecting loads previous permissions for that session

### Edge Cases
- Browser tab closed while permission pending → permission times out, session state lost on reconnect
- Multiple pending permissions → user closes tab, all timeout, unclear which ones failed
- Network flaky: permission request sent but response lost → dialog hangs indefinitely (no timeout fallback)

---
