# UX Stories: Linear & GitHub Integration

Topic: Linear & GitHub Integration  
App Context: Claude Tauri Boilerplate -- Desktop AI coding assistant with git workspace management

---

## STORY-001: Connect Linear OAuth

**Type**: short
**Topic**: Linear & GitHub Integration
**Persona**: Developer (first-time setup)
**Goal**: Authenticate with Linear to browse and attach issues
**Preconditions**: User has Linear account; app is running

### Steps
1. Open Settings → Linear Integration panel
2. See "Not connected" status with Connect button
3. Click "Connect Linear"
4. New browser window opens with linear.app/oauth/authorize form
5. Approve scopes (default: read)
6. Redirected back; OAuth callback stores access token
7. Return to Settings and click Refresh
8. Status updates to "Connected"

### Variations
- **Network offline**: Toast error; user can retry
- **Missing env vars**: Server returns LINEAR_ENV_MISSING (500); shown as "Failed to start Linear auth"
- **Window blocked**: User manually enables popups; can copy URL from console

### Edge Cases
- **Expired token**: Next issue list request returns 401; UI shows "Linear is not connected" → Reconnect prompt
- **Scope insufficient**: User must re-connect to grant additional permissions
- **Callback state mismatch**: Returns INVALID_STATE (400); user must start fresh auth flow

---

## STORY-002: Browse Linear Issues in Modal

**Type**: medium
**Topic**: Linear & GitHub Integration
**Persona**: Developer solving a task
**Goal**: Search for and select a Linear issue to attach context
**Preconditions**: Linear is connected

### Steps
1. User clicks "Linear Issues" button in chat sidebar (or issue picker trigger)
2. LinearIssuePicker modal opens (720px wide, 2-column grid)
3. Left column: Search field auto-focused, placeholder "Search by title or identifier (e.g. ENG-123)…"
4. Type "auth" → 200ms debounce triggers `/api/linear/issues?q=auth`
5. Results: 25-limit sorted by createdAt descending
6. Each result shows: identifier (ENG-123), title (underline), summary (2-line truncated), created date
7. Click issue → highlight border-primary, bg-primary/10
8. Right column updates with selected issue details

### Variations
- **Empty query**: Loads all recent issues (first 25)
- **No results**: "No issues found" text in gray
- **Search by identifier**: "ENG-123" matches exactly (case-insensitive)
- **Clear button**: Resets query and results instantly

### Edge Cases
- **GraphQL error**: "Linear GraphQL returned errors" → error banner (red) in modal
- **Linear not connected**: Modal shows "Linear is not connected" → button to open Settings
- **Slow network**: Loading spinner; 5s+ timeout shows error; user can retry

---

## STORY-003: Attach Linear Issue to Chat

**Type**: short
**Topic**: Linear & GitHub Integration
**Persona**: Developer providing context
**Goal**: Add a Linear issue as context to current chat session
**Preconditions**: Issue selected in LinearIssuePicker

### Steps
1. In LinearIssuePicker, issue selected (right column visible)
2. Click "Attach to chat" button
3. Modal closes
4. Chat interface shows issue banner below input
5. Banner: "Linear: ENG-123 — Issue Title" with close (X) button
6. User can type message → send includes issue context
7. Issue context passed to backend in `linearIssue` field
8. Chat history displays attached issue info

### Variations
- **Close icon**: Removes banner; issue context not sent
- **Multiple messages**: Issue context stays attached until user detaches
- **Workspace context**: When creating workspace, same issue is auto-populated

### Edge Cases
- **Very long title**: Title truncates with ellipsis
- **No URL in issue**: Link to Linear not shown in banner

---

## STORY-004: Create Workspace from Linear Issue

**Type**: medium
**Topic**: Linear & GitHub Integration
**Persona**: Developer implementing a feature
**Goal**: Create a git worktree directly from a Linear issue
**Preconditions**: Issue selected in LinearIssuePicker; projects exist

### Steps
1. LinearIssuePicker open, issue selected
2. Right column shows "Create workspace" section
3. Dropdown: "Project" — auto-select if 1 project, otherwise prompt
4. Input: "Workspace name" — pre-filled with slugified issue id (e.g., "eng-123")
5. Input: "Base branch (optional)" — defaults to project's default branch
6. Click "Create workspace"
7. POST `/api/projects/{projectId}/workspaces` with:
   - name: "eng-123"
   - baseBranch: "main"
   - linearIssue: { id: "ENG-123", title, summary, url }
8. Loading state: "Creating…"
9. Toast: "Workspace created" with "eng-123 from ENG-123"
10. Modal closes; user redirected to workspace view

### Variations
- **Custom branch**: User overrides base branch input
- **Custom name**: User edits pre-filled workspace name
- **No projects**: Error: "No projects available" — prompt to add project
- **Name conflict**: Server returns error; shown in modal

### Edge Cases
- **Network timeout**: "Failed to create workspace"; user can retry
- **Disk full**: Backend error; shown in toast
- **Empty input fields**: Create button disabled until valid

---

## STORY-005: View Linear Issue Deep Link

**Type**: short
**Topic**: Linear & GitHub Integration
**Persona**: Developer sharing workspace
**Goal**: Generate shareable link to a Linear issue
**Preconditions**: Issue selected in LinearIssuePicker

### Steps
1. In LinearIssuePicker, issue selected
2. Click "Copy deep link" button
3. Toast appears: "Deep link updated — #linear/issue/ENG-123"
4. URL fragment changes to `#linear/issue/ENG-123`
5. User can copy URL from browser bar to share
6. Shared recipient can click link → app navigates to issue picker with pre-populated issue

### Variations
- **Open in Linear**: Click link to issue → opens linear.app in new tab
- **Deep link navigation**: App can be opened with `#linear/issue/ENG-123` → picker loads issue

### Edge Cases
- **Special chars in identifier**: URL-encoded in fragment

---

## STORY-006: Search GitHub Issues in Workspace Dialog

**Type**: medium
**Topic**: Linear & GitHub Integration
**Persona**: Developer starting work from PR/issue
**Goal**: Create a workspace from an open GitHub issue
**Preconditions**: Project is GitHub-linked; `gh` CLI authenticated

### Steps
1. Workspaces panel → "New Workspace" dialog
2. Tab: "GitHub Issue" (3rd tab with GitHub icon)
3. Input: "Search Issues" auto-focused
4. Type "auth" → 300ms debounce triggers `/api/projects/{projectId}/github-issues?q=auth`
5. List: up to 20 results; each shows:
   - Issue #123 (gray monospace)
   - Status badge (green "OPEN" or gray "CLOSED")
   - Title (bold, truncated)
6. Click issue → highlighted with bg-primary/10
7. Right column updates with workspace naming options

### Variations
- **Empty search**: Shows recent 20 open issues
- **No GitHub remote**: Error: "GitHub CLI not authenticated or no remote" (503)
- **No `gh` installed**: Error: "GitHub CLI not available" (503)
- **Large result set**: Paginate on scroll (max 20 per request, hard limit)

### Edge Cases
- **Issue with no body**: Display only title/number
- **Network interruption**: Retry button in error state
- **Closed issues**: Not shown (--state open filter)

---

## STORY-007: Auto-Fill Workspace Name from GitHub Issue

**Type**: short
**Topic**: Linear & GitHub Integration
**Persona**: Developer creating workspace
**Goal**: Automatically generate workspace name from issue metadata
**Preconditions**: GitHub issue selected in CreateWorkspaceDialog

### Steps
1. Issue selected in GitHub Issue tab
2. Right panel shows "Workspace Name" input (auto-focused)
3. Pre-filled with `issue-{number}-{slugified-title}`
   - Example: "#245 Fix auth bug" → "issue-245-fix-auth-bug"
4. User can edit or accept default
5. Branch name field also auto-filled: "issue-245-fix-auth-bug"
6. Note: "Branch will be created as `issue/issue-245-fix-auth-bug`"
7. Click "Create" → workspace created with branch prefix

### Variations
- **Very long title**: Truncated to 60 chars; hyphens deduplicated
- **Special chars**: Non-alphanumeric replaced with hyphens
- **Manual override**: User can edit both workspace and branch names independently

### Edge Cases
- **Title starts with number**: Leading hyphen trimmed
- **Only numbers in title**: "issue-245-" (valid but lean)

---

## STORY-008: Create Workspace from GitHub Issue

**Type**: medium
**Topic**: Linear & GitHub Integration
**Persona**: Developer implementing GitHub task
**Goal**: Create git worktree with GitHub issue context
**Preconditions**: GitHub issue selected; workspace name valid

### Steps
1. CreateWorkspaceDialog: GitHub Issue tab, issue selected
2. Workspace name pre-filled; can edit
3. Click "Create"
4. POST `/api/projects/{projectId}/workspaces` with:
   - name: "issue-245-fix-auth-bug"
   - githubIssue: { number, title, url, state, body }
5. Spinner: "Creating…"
6. Backend:
   - Creates git worktree
   - Sets branch to `issue/{name}` (checked out)
   - Stores GitHub issue metadata
7. Toast: "Workspace created"
8. Dialog closes; workspace details panel opens
9. User can see issue link in workspace metadata

### Variations
- **Custom branch name**: User specifies source branch
- **Multiple projects**: Project selector dropdown
- **No GitHub auth**: Error prompt → suggest `gh auth login`

### Edge Cases
- **Branch already exists**: Git error; shown to user
- **Issue deleted**: Still create workspace; URL may 404

---

## STORY-009: Disconnect Linear

**Type**: short
**Topic**: Linear & GitHub Integration
**Persona**: Developer revoking access
**Goal**: Revoke Linear OAuth token and disconnect
**Preconditions**: Linear is connected

### Steps
1. Settings → Linear Integration panel
2. Status shows "Connected"
3. Click "Disconnect" button (red variant)
4. POST `/api/linear/disconnect`
5. Backend: Deletes `linear_oauth` row from SQLite
6. Status updates to "Not connected"
7. Next time Linear Issues picker opens → shows "Linear is not connected" with reconnect prompt

### Variations
- **Refresh button**: User clicks to manually check status after external disconnect

### Edge Cases
- **Database error**: Error toast; manual retry
- **Already disconnected**: Idempotent; shows "Not connected" anyway

---

## STORY-010: Handle Linear Auth Expiration

**Type**: medium
**Topic**: Linear & GitHub Integration
**Persona**: Developer with expired token
**Goal**: Gracefully handle expired Linear credentials
**Preconditions**: Token has expired; user tries to list issues

### Steps
1. User opens LinearIssuePicker (status check passes; token exists)
2. Typing in search → fetch `/api/linear/issues?q=...`
3. Server checks token validity; it's expired
4. Returns 401 "Linear is not connected"
5. Frontend shows error: "Linear is not connected" with "Open Settings" button
6. User clicks → navigates to Settings
7. Linear status shows "Not connected"
8. User clicks "Connect Linear" to re-authorize

### Variations
- **Refresh token available**: Backend auto-refreshes (if implemented)
- **No user action**: Error persists; user must manually reconnect

### Edge Cases
- **Partial expiration**: Token valid for some requests, invalid for others → eventual consistency issue

---

## STORY-011: Multi-Issue Workspace Context

**Type**: long
**Topic**: Linear & GitHub Integration
**Persona**: Developer coordinating related work
**Goal**: Link multiple issues (Linear + GitHub) to a single workspace
**Preconditions**: Workspace exists with one issue; user wants to add another

### Steps
1. Workspace detail view shows "Linear: ENG-123" and "GitHub: #245"
2. User clicks "Add Context" button (or context menu)
3. Dialog: "Add more issue context?"
   - Option A: Select another Linear issue
   - Option B: Select another GitHub issue
4. Choose Linear issue "ENG-124"
5. POST `/api/workspaces/{id}` with additional linearIssue
6. Workspace metadata updated
7. Detail view now shows both issues linked
8. Chat context includes both in system message

### Variations
- **Replace instead of add**: Toggle to replace ENG-123 with ENG-124
- **Remove context**: Button to clear individual issue
- **Order matters**: Newer issues appear first in context

### Edge Cases
- **Same issue twice**: Prevent duplicate; show warning
- **Conflicting issues**: Allow; user may have intentional multi-issue workspace

---

## STORY-012: Linear Issue Status Sync

**Type**: long
**Topic**: Linear & GitHub Integration
**Persona**: Developer tracking work progress
**Goal**: Display current issue status in workspace without re-opening Linear
**Preconditions**: Workspace has attached Linear issue

### Steps
1. Workspace detail shows "Linear: ENG-123 — Fix auth bug [In Progress]"
2. Badge color indicates status (In Progress = blue, Done = green, Todo = gray)
3. User clicks issue link → opens linear.app in new tab
4. After user marks issue Done in Linear, user refreshes workspace view
5. Badge updates to green "Done"
6. Chat context includes status: "Issue status: Done"

### Variations
- **Auto-refresh**: Periodically poll `/api/linear/issues/{id}` (optional optimization)
- **Webhook**: Linear sends update; workspace syncs automatically
- **Polling interval**: Every 30s if workspace is active

### Edge Cases
- **Offline**: Status shows last-known; refreshes on reconnect
- **Issue archived**: Status shows "Archived"

---

## STORY-013: GitHub Issue Body Preview

**Type**: short
**Topic**: Linear & GitHub Integration
**Persona**: Developer understanding issue scope
**Goal**: Preview GitHub issue body before creating workspace
**Preconditions**: GitHub issue selected in CreateWorkspaceDialog

### Steps
1. CreateWorkspaceDialog: GitHub Issue tab
2. Issue list shows title + status badge
3. Click issue → selected state (highlight)
4. Issue body appears in collapsible "Details" section
5. Shows first 500 chars of issue body
6. "Read full issue" link opens in Linear/GitHub
7. User can create workspace with full context understanding

### Variations
- **No body**: Shows "No description provided"
- **Very long body**: Truncates; scrollable preview
- **Markdown in body**: Renders as plain text or preserves structure

### Edge Cases
- **HTML/embedded images**: Stripped; plain text only
- **Issue deleted**: Shows cached body or "Issue no longer available"

---

## STORY-014: Issue Search History

**Type**: medium
**Topic**: Linear & GitHub Integration
**Persona**: Developer frequently reusing issues
**Goal**: Access recent issue searches without retyping
**Preconditions**: User has searched for issues before

### Steps
1. LinearIssuePicker opens
2. Search field shows placeholder + dropdown icon
3. Click dropdown → shows last 10 searches (e.g., "auth", "payment", "ENG-500")
4. Click "auth" → search re-executes; results shown
5. Or type new query to override history
6. Clear history: settings option "Clear issue search history"

### Variations
- **Cross-session persistence**: Stored in localStorage or server
- **Per-project history**: Different history for each project

### Edge Cases
- **No history**: Dropdown shows "No recent searches"
- **Deleted issues**: Old results may return 404; gracefully skip

---

## STORY-015: Linear Issue Picker Offline

**Type**: short
**Topic**: Linear & GitHub Integration
**Persona**: Developer on poor connection
**Goal**: Handle offline/network errors gracefully
**Preconditions**: Network unavailable or server down

### Steps
1. LinearIssuePicker opens; tries to check status
2. Status check times out (5s)
3. Shows error: "Linear is not connected" (conservatively)
4. User can click "Open Settings" to troubleshoot
5. Or close picker and retry later
6. If online again: "Refresh" button re-checks status

### Variations
- **Partial failure**: Search fails but status succeeded → show error in results area
- **Retry logic**: Automatic exponential backoff (not implemented; manual refresh)

### Edge Cases
- **Very slow connection**: Feels offline; user may assume disconnected
- **DNS timeout**: Treated as network error; same UX as offline

---
