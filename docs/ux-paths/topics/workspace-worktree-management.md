# UX Stories: Workspace Worktree Management

Topic: Workspace Worktree Management  
App Context: Claude Tauri Boilerplate -- Desktop AI coding assistant with git workspace management

---

## STORY-001: Create a Basic Workspace Manually

**Type**: short
**Topic**: Workspace Worktree Management
**Persona**: Developer (Alex)
**Goal**: Set up a new git worktree for a feature branch
**Preconditions**: Project "my-app" exists in Workspaces view; Alex has it selected

### Steps
1. Click **+ New Workspace** button in project header → Dialog opens with "Manual" tab selected
2. Enter workspace name "user-auth" → Name field validates and accepts input
3. Optional: Browse repository or enter custom base/source branches → Dropdown shows detected local branches
4. Click **Create** → Status badge shows "Creating..." with pulse animation
5. Page briefly shows spinner, then "Ready" status appears → Workspace loads in main panel

### Variations
- **Custom base branch**: User selects "develop" instead of "main" as base → Worktree created from develop
- **Source branch**: User provides existing feature branch name → New worktree based on that branch
- **Repository path**: User selects a different git repository via file browser → Branches detected for that repo

### Edge Cases
- User leaves name empty → Submit button disabled, validation message shown
- User provides invalid branch name → Server returns 400 error, user can retry
- Worktree creation fails (disk space, permissions) → Status transitions to "error" with error message visible
- User tries to create duplicate workspace name → API rejects with descriptive error

---

## STORY-002: Create Workspace from GitHub Issue

**Type**: medium
**Topic**: Workspace Worktree Management
**Persona**: Developer (Jordan)
**Goal**: Quickly start work on a GitHub issue with context
**Preconditions**: "web-app" project selected; GitHub integration configured

### Steps
1. Click **+ New Workspace** → Dialog opens
2. Click **GitHub Issue** tab → Search field appears with "Loading issues..." spinner
3. Type "login button" in search → Debounced fetch executes, issues list updates
4. See results: "#145 - Add dark mode to login button", "#234 - Improve login validation"
5. Click issue #145 → Issue selected, workspace name auto-fills as "issue-145-add-dark-mode-to-login-button"
6. Branch name auto-fills as "issue-145-add-dark-mode-to-login-button" (can edit)
7. Click **Create** → Worktree created from main branch with Linear/GitHub metadata stored
8. Workspace Panel loads with issue badge showing "#145 Add dark mode..." linked to GitHub

### Variations
- **Search by issue number**: User types "#234" → Exact match returned immediately
- **No results**: User searches "xyz999" → "No issues found" message, can retry with different query
- **Edit auto-filled name**: User changes suggested name to "dark-mode-login" → Custom name used instead

### Edge Cases
- GitHub API unreachable → Error message "Failed to load issues" with retry option
- Issue search returns 100+ results → Only first 20 shown, user refines search
- User selects issue but network fails during workspace creation → Status shows "error" with network error message

---

## STORY-003: Create Workspace from Branch

**Type**: short
**Topic**: Workspace Worktree Management
**Persona**: Developer (Sam)
**Goal**: Create workspace from existing project branch
**Preconditions**: "api-server" project selected with multiple branches

### Steps
1. Click **+ New Workspace** → Dialog opens
2. Click **Branch** tab → "Loading branches..." spinner appears
3. Branch list loads: main, develop, feature/auth, hotfix/payment-api
4. Select "feature/auth" → Auto-fills workspace name as "feature-auth"
5. Optionally edit workspace name to "auth-feature" → Input accepts custom name
6. Click **Create** → Worktree created from feature/auth branch

### Variations
- **Current branch disabled**: If already working on feature/auth, it shows as (current) but still selectable
- **Delete failed**: User can't select branch (grayed out) if branch was deleted upstream → Loading retried on tab switch

### Edge Cases
- No branches found → Empty dropdown; error message "No branches detected"
- Branch list load times out → User sees spinner; manual mode available as fallback

---

## STORY-004: Monitor Workspace Creation Status

**Type**: short
**Topic**: Workspace Worktree Management
**Persona**: Developer (Taylor)
**Goal**: Understand what's happening while workspace is being set up
**Preconditions**: User just clicked "Create" on workspace dialog

### Steps
1. Dialog closes, workspace appears in sidebar with **"Creating"** status badge (amber, pulsing)
2. Main panel shows spinner and placeholder → User waits
3. After ~2 seconds, status updates to **"Setting up"** (setup hooks running) → Still pulsing
4. After setup finishes (~5 sec), status changes to **"Ready"** (green, stable) → Panel loads fully
5. Chat, Diff, Notes tabs now interactive

### Variations
- **Setup hooks error**: Status transitions to "error" with message "Setup script failed: git hook not found"
- **User closes tab during creation**: Workspace continues creating in background; re-opening shows current status

### Edge Cases
- Workspace stuck in "Creating" for >30 seconds → Might indicate system issue; user can force delete
- Network disconnect during creation → Workspace saved to DB but status unclear; manual refresh loads actual state

---

## STORY-005: View Workspace Diff and Changed Files

**Type**: medium
**Topic**: Workspace Worktree Management
**Persona**: Code Reviewer (Morgan)
**Goal**: Review changes in workspace before merging
**Preconditions**: Workspace "user-auth" has status "Ready" with uncommitted changes

### Steps
1. Click workspace "user-auth" in sidebar → WorkspacePanel loads
2. Click **Diff** tab → Unified diff view loads showing changed files
3. See file tree: auth/login.ts (M), auth/signup.ts (A), utils/crypto.ts (M)
4. Each file shows colored status badge (M=yellow, A=green, D=red)
5. Click "auth/login.ts" → Expands to show git diff: 3 lines added (green), 1 line removed (red)
6. Click code review icon ("brain" or comment icon) → **CodeReviewDialog** opens
7. Enter prompt "Check for security issues" → Claude analyzes diff and returns AI summary with inline comments

### Variations
- **Side-by-side view**: User toggles diff mode to side-by-side → Left/right column layout
- **Large diff**: User filters by filename → Only matching files shown
- **No changes**: Diff tab shows empty state "No changes in this workspace"

### Edge Cases
- Diff fetch times out → Error message "Failed to fetch diff"; retry button available
- File deleted in workspace → Shows full file content with all lines marked as removed
- Binary files changed → Shows file path only; "Binary file changed" label

---

## STORY-006: Add Additional Directories to Workspace

**Type**: short
**Topic**: Workspace Worktree Management
**Persona**: Developer (Casey)
**Goal**: Give Claude access to sibling repos while working on main workspace
**Preconditions**: Workspace "api-gateway" open; user wants to include "shared-utils" repo

### Steps
1. Click **Paths** tab in workspace panel → "Workspace settings" section shows
2. See input: "Add directory" with placeholder "/path/to/another-repo"
3. Enter "/path/to/shared-utils" → Text accepted
4. Click **Add directory** button → Directory added to list below
5. New row shows: "shared-utils" (repo name extracted), path, and "Remove" button
6. Workspace context now includes shared-utils in Claude's file scanning

### Variations
- **Browse instead of typing**: Click browse button → File picker opens → User selects folder → Path auto-fills
- **Invalid path**: User enters "/nonexistent/path" → Server validates; error message shown "Path does not exist or is not accessible"
- **Filter list**: User types "shared" in filter box → Only "shared-utils" shown in list

### Edge Cases
- Add same directory twice → Auto-deduplicated; set-based logic prevents duplicates
- Remove directory mid-operation → Removes from list; changes persisted to backend
- Parent directory has no read access → Error shown; user needs to fix permissions

---

## STORY-007: Merge Workspace Back to Base Branch

**Type**: medium
**Topic**: Workspace Worktree Management
**Persona**: Developer (Alex)
**Goal**: Finalize changes by merging feature branch back to main
**Preconditions**: Workspace "user-auth" status is "Ready" or "Active"; all changes committed

### Steps
1. Click workspace "user-auth" in sidebar → Panel loads
2. Click **Merge** button in header (top right) → **WorkspaceMergeDialog** opens
3. Dialog shows: "This will merge branch user-auth-branch into main"
4. Confirmation summary: "Merge workspace user-auth (user-auth-branch) into main"
5. Review changes visible in background; click **Merge** button in dialog
6. Status badge changes to **"Merging"** (purple, pulsing) → Merge operation in progress
7. After merge completes, status becomes **"Merged"** (purple, stable) → Workspace read-only
8. Dialog offers to update workspace notes/memory with merge context (optional)

### Variations
- **Merge to non-main branch**: User created workspace with baseBranch="develop" → Dialog shows "merge into develop"
- **Merge conflict**: During merge, git returns conflict → Status transitions to "error" with conflict message; user must resolve manually
- **Auto-commit before merge**: If enabled in settings, uncommitted changes auto-committed before merge starts

### Edge Cases
- User clicks Merge twice rapidly → Second click disabled while first merge in progress
- Network fails mid-merge → Status stays "merging"; manual refresh shows actual state (merged or error)
- Merge conflicts prevent fast-forward → Error message "Could not merge cleanly"; user directed to manual conflict resolution
- Target branch was deleted → Merge fails with "base branch not found" error

---

## STORY-008: Discard Workspace (Destructive)

**Type**: short
**Topic**: Workspace Worktree Management
**Persona**: Developer (Jordan)
**Goal**: Clean up abandoned workspace and free disk space
**Preconditions**: Workspace "experiment-old-api" status is "Ready"; user no longer needs it

### Steps
1. Click workspace "experiment-old-api" in sidebar
2. Click **Discard** button (red, top right) → **WorkspaceMergeDialog** opens in discard mode
3. Dialog shows warning: "This will delete the worktree and branch. This cannot be undone."
4. Confirmation summary with AlertTriangle icon: "Permanently discard workspace experiment-old-api..."
5. Click **Discard** button (red) → Status badge shows **"Discarding"** (orange, pulsing)
6. After deletion completes, status becomes **"Archived"** → Workspace removed from main sidebar view
7. If needed, user can view archived workspaces in settings

### Variations
- **Unsaved changes in workspace**: Dialog warns "Workspace has uncommitted changes; they will be lost"
- **Discard with force flag**: User clicks discard, force=true sent → Bypasses some checks; worktree deleted forcefully
- **Background process**: User discards, then immediately selects another workspace → Discard completes in background

### Edge Cases
- Workspace locked by another process → Error "Worktree is locked; try again later"
- Discard fails partway → Status transitions to "error"; user can retry or force-delete
- User undoes discard → Not possible; archived workspaces are permanent (restore from backup only)

---

## STORY-009: Add Code Review Comments to Diff

**Type**: medium
**Topic**: Workspace Worktree Management
**Persona**: Code Reviewer (Casey)
**Goal**: Leave inline feedback on workspace changes before merge
**Preconditions**: Workspace diff is open; user has identified issue in code

### Steps
1. In Diff tab, user hovers over a specific line in "auth/login.ts" → Line highlight appears
2. Click comment icon or small "+" on the line number → Inline comment form appears below that line
3. Type comment: "This should use const instead of let for immutability"
4. Choose severity: "suggestion" (dropdown)
5. Click **Add Comment** → Comment saved; shows as purple box with comment text
6. Comment persists in workspace; visible to all users accessing workspace

### Variations
- **AI code review**: User clicks "Generate Review" button → Claude analyzes entire diff, adds multiple comments with "AI" badge
- **Resolve comment**: User fixes the issue, clicks checkmark on comment → Comment marked as resolved (grayed out)
- **Delete comment**: User right-clicks comment → Confirmation modal; comment removed after confirmation

### Edge Cases
- Comment on deleted line → Comment shows but may be orphaned; user can still read it
- Multiple comments on same line → All visible; stacked vertically or in sidebar list
- Comment fetch fails → Error message; retry available

---

## STORY-010: View Workspace Git History (Revisions)

**Type**: short
**Topic**: Workspace Worktree Management
**Persona**: Developer (Sam)
**Goal**: Understand what commits were made in this workspace branch
**Preconditions**: Workspace "feature-auth" has 3+ commits since creation

### Steps
1. Click workspace "feature-auth"
2. Planned future tab (or via workspace notes): **Revisions** tab
3. Chronological list shows:
   - "3f2e1a - Add JWT validation (2h ago)"
   - "2b4d8c - Create auth service (4h ago)"
   - "a1f3e2 - Initial setup from main (6h ago)"
4. Each row clickable; shows full commit message and author
5. Can copy commit hash or navigate to full diff of that commit

### Edge Cases
- No commits yet → "No commits in this workspace" message
- Workspace created from branch with commit history → Full history shown (not just new commits)

---

## STORY-011: Rename Workspace and Branch

**Type**: short
**Topic**: Workspace Worktree Management
**Persona**: Developer (Morgan)
**Goal**: Update workspace name after scope changed
**Preconditions**: Workspace "old-name" exists; user realizes scope expanded

### Steps
1. In ProjectSidebar, hover over workspace "old-name" → Right-click context menu appears OR edit icon shows
2. Click **Rename** option → Name becomes editable inline; shows input field
3. Enter new name "user-auth-complete" → Input updates
4. Press Enter OR click outside → Rename submitted
5. Backend updates workspace name; sidebar refreshes with new name
6. Workspace panel header also updates to show new name

### Variations
- **Rename branch only**: User can edit branch name separately in Workspace panel header (copy branch button → editable field)
- **Invalid name**: User enters invalid characters → Validation error; can retry
- **Duplicate name**: User tries to create another "user-auth-complete" → Server rejects with "Workspace name already exists"

### Edge Cases
- Network fails during rename → Previous name restored; error message shown
- User cancels rename mid-edit (Escape key) → Reverts to previous name

---

## STORY-012: View Workspace Notes with Preview

**Type**: short
**Topic**: Workspace Worktree Management
**Persona**: Developer (Alex)
**Goal**: Document workspace context and share notes with Claude
**Preconditions**: Workspace "project-x" open; user previously added notes

### Steps
1. Click **Notes** tab in workspace panel → Text area shows saved notes content
2. Click **Preview** button (top right) → Switches to preview mode; markdown rendered
3. See formatted notes: headings, code blocks, lists rendered prettily
4. Notes auto-save as user types (debounced 600ms) → "Saving..." indicator appears
5. After save completes, "Saved ✓" indicator shows for 2 seconds
6. Click **Edit** to return to edit mode

### Variations
- **Empty notes**: First time opening → Placeholder: "Add notes, plans, or context..."
- **Markdown with code blocks**: User pastes code snippet with triple backticks → Preview shows syntax highlighting
- **Notes shared with Claude**: Notes shown as context in chat; visible in workspace chat input

### Edge Cases
- Large notes (>10KB) → Text area still responsive; save completes normally
- Save fails (network error) → Save status stays "saving" briefly, then reverts to "idle"; user prompted to retry
- Blur before save completes → Forced save on blur; waits for timer to expire then saves

---

## STORY-013: Filter and Search Workspaces in Sidebar

**Type**: short
**Topic**: Workspace Worktree Management
**Persona**: Developer (Casey)
**Goal**: Find specific workspace quickly when many exist
**Preconditions**: Project has 15+ workspaces; user looking for specific one

### Steps
1. In ProjectSidebar, scroll to workspace list section
2. Input field appears: "Filter workspaces..." (or similar)
3. Type "auth" → List instantly filters; shows only workspaces with "auth" in name
4. Results: "user-auth", "auth-service", "oauth-integration"
5. Click "user-auth" → Selected and loaded in main panel
6. Clear filter → Full list returns

### Edge Cases
- No matches found → "No workspaces matching 'xyz'" message
- Filter is case-insensitive; partial match works

---

## STORY-014: Open Workspace in IDE

**Type**: short
**Topic**: Workspace Worktree Management
**Persona**: Developer (Jordan)
**Goal**: Switch from web UI to local IDE for coding
**Preconditions**: Workspace "feature-x" status "Ready"; IDE configured (VS Code, WebStorm, etc.)

### Steps
1. Click workspace "feature-x" in sidebar → Panel loads
2. Click **Open In** button (top right of header) → Opens workspace worktree path in configured IDE
3. IDE launches (or focuses if already running) showing the worktree directory
4. User now editing files locally with full IDE features (linting, debugging, etc.)

### Variations
- **IDE preference**: User has set VS Code as default in settings → Opens in VS Code
- **Custom IDE**: User configured custom IDE URL in settings → Custom IDE called with path parameter

### Edge Cases
- IDE not installed → OS error dialog; user prompted to install or change IDE preference
- Worktree path contains spaces → Path properly escaped in IDE command

---

## STORY-015: Handle Workspace Status Errors and Recovery

**Type**: medium
**Topic**: Workspace Worktree Management
**Persona**: Developer (Morgan)
**Goal**: Understand and recover from workspace creation/merge failures
**Preconditions**: Workspace stuck in "error" status with message "git config failed"

### Steps
1. User clicks workspace with error status → Sidebar shows error badge (red)
2. Main panel loads; header shows **"Error"** badge with alert icon
3. Error message visible: "Setup failed: git config failed"
4. User has options:
   - **Retry**: Attempts to transition back to "ready" state
   - **Discard**: Cleans up failed worktree
   - **View Details**: Shows full error log/traceback
5. User clicks **Retry** → Status transitions back to "creating" → Attempts setup again
6. If retry succeeds, status becomes "ready" → Workspace usable

### Variations
- **Permanent error**: Retry fails repeatedly → User can only discard; suggests contacting support for permissions issues
- **Locked worktree**: Another process using directory → Error: "Worktree is locked"; user advised to close IDE or restart

### Edge Cases
- Error message extremely long → Shown in modal/dialog for readability
- Error occurs during merge → Workspace stays in "merging" state; user must manually fix conflict then retry

---
