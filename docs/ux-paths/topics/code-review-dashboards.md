# UX Stories: Code Review & Dashboards

Topic: Code Review & Dashboards  
App Context: Claude Tauri Boilerplate -- Desktop AI coding assistant with git workspace management

---

## STORY-001: View Workspace Diff with Unified Layout

**Type**: short  
**Topic**: Code Review & Dashboards  
**Persona**: Developer reviewing changes before merge  
**Goal**: Understand all changes in current workspace diff  
**Preconditions**: Workspace is in ready/active status with uncommitted changes

### Steps
1. Open Workspace → select project → select workspace → click Diff tab
2. Unified view loads, showing file list (left) and diff content (right)
3. System displays changed files with status badges (M=modified, A=added, D=deleted, R=renamed)
4. User scrolls through diff lines: removed (red bg), added (green bg), context (neutral)
5. Each line shows old/new line numbers and content
6. User refreshes diff → changes refetch automatically

### Variations
- **Range comparison**: User selects "Compare" dropdowns to pick historical revisions, clicks Apply to see diff between two commits
- **Side-by-side view**: User clicks "Side-by-side" button to see old/new columns in split layout

### Edge Cases
- Empty diff: System shows "No changes"
- Large diff (100+ files): Scrolling loads content progressively
- Binary file added: Diff shows metadata but no hunks
- Merge conflict: Diff indicates conflict status with special styling

---

## STORY-002: Comment on Specific Diff Line

**Type**: short  
**Topic**: Code Review & Dashboards  
**Persona**: Code reviewer documenting feedback  
**Goal**: Leave inline comment on a code change  
**Preconditions**: Diff view is open, diff contains changes

### Steps
1. User hovers over a specific diff line (added/removed/context)
2. "Comment" button appears at right edge of line
3. User clicks Comment → text area appears below the line
4. User types markdown (supported) in textarea
5. User clicks "Save comment" → comment persists below the line
6. Comment displays with avatar, content, and Delete button

### Variations
- **File-level comment**: User clicks comment icon on file header to comment on entire file changes
- **Multiple comments**: User adds multiple comments to same line; they stack vertically
- **Edit comment** (future): Hover over saved comment, click Edit to modify content

### Edge Cases
- Comment with no text: Save button disabled
- Markdown in comment: Rendered in comment display
- Long comment: Text wraps within fixed width, scrollable if needed
- Delete comment: Removed from UI immediately, no undo

---

## STORY-003: Filter Diff Files by Review Status

**Type**: short  
**Topic**: Code Review & Dashboards  
**Persona**: Developer completing code review  
**Goal**: Track which files have been reviewed  
**Preconditions**: Diff tab open with multiple changed files

### Steps
1. At top of file list panel, user sees "Mark all reviewed" button
2. User clicks on individual file → background highlights with green (reviewed) or gray (unreviewed)
3. User clicks file's "Mark reviewed" button → file toggles to reviewed state
4. System maintains review state in sidebar (green border, "Reviewed" label)
5. User selects Filter dropdown → chooses "Unreviewed" to hide reviewed files
6. List now shows only unreviewed files; count updates

### Variations
- **Mark all reviewed**: User clicks "Mark all reviewed" button → all visible files toggle to reviewed (or unreviewed if all already reviewed)
- **Persist across refreshes**: Review state saved locally in session (cleared on close)

### Edge Cases
- No files to review: Filter shows empty state
- All files reviewed: Filter "Unreviewed" shows no results; "Mark all unreviewed" button visible

---

## STORY-004: Start AI Code Review

**Type**: medium  
**Topic**: Code Review & Dashboards  
**Persona**: Developer requesting automated code review  
**Goal**: Get AI-generated review with severity-categorized comments  
**Preconditions**: Workspace diff visible, at least one changed file

### Steps
1. User clicks "Review" button in top-right of diff controls
2. Default review prompt executes immediately (left-click)
3. AI processes diff asynchronously; "Reviewing..." state shows
4. Review completes; summary banner appears above diff with:
   - Timestamp, badge "AI Review"
   - Count badges: e.g., "3 Critical, 2 Warning, 1 Suggestion"
5. Summary text describes overall findings
6. Comment index lists each finding with severity color, file, line number
7. User clicks comment in index → scrolls to corresponding line in diff

### Variations
- **Customize prompt (right-click)**: User right-clicks Review button → CodeReviewDialog opens with:
  - Editable prompt textarea (8 rows)
  - Model selector (text input)
  - Effort dropdown (Low/Medium/High/Max)
  - Start Review button executes with custom settings
- **Workspace notes integration** (future): Summary auto-inserted into workspace notes panel

### Edge Cases
- Review fails: Error banner shows "Review failed: [reason]"
- No issues found: Summary shows "No issues found" (green checkmark)
- Very large diff (1000+ lines): Review may timeout or return partial results
- All AI comments are read-only (no editing)

---

## STORY-005: Right-Click Review Customization

**Type**: short  
**Topic**: Code Review & Dashboards  
**Persona**: Advanced user with custom review standards  
**Goal**: Run code review with custom prompt and model  
**Preconditions**: Review button visible in diff controls

### Steps
1. User right-clicks "Review" button in diff toolbar
2. CodeReviewDialog modal opens with:
   - Review Prompt textarea (8 rows) pre-filled with default prompt
   - Model field (text input)
   - Effort dropdown (Low/Medium/High/Max)
3. User modifies prompt: e.g., "Check for security issues in authentication logic"
4. User changes effort to "High"
5. User clicks "Start Review" → dialog closes
6. Review executes with custom settings; summary appears in diff

### Variations
- **Clear prompt**: User deletes all text → uses initial model value
- **Keyboard submit**: User presses Escape to cancel, or Ctrl+Enter to submit (future)

### Edge Cases
- Invalid model name: Backend returns error; displayed in dialog
- Empty prompt: Uses default instead

---

## STORY-006: View Code Review Summary with Severity Index

**Type**: medium  
**Topic**: Code Review & Dashboards  
**Persona**: Developer triaging code review findings  
**Goal**: Quickly scan all findings by severity and navigate to locations  
**Preconditions**: AI code review completed with findings

### Steps
1. Review summary banner displays below diff controls
2. Header shows: "AI Review" badge, timestamp (e.g., "2:45 PM"), severity counts
3. Summary text: "Found 3 issues: potential SQL injection in query builder, missing input validation on user_id, hardcoded API key"
4. Comment index (collapsible section):
   - Lists all comments grouped by severity
   - Each comment shows: severity badge (Critical/Warning/Suggestion), filename, line number, body (2-line preview)
5. User clicks comment in index → diff scrolls to that file/line
6. Comment appears highlighted in diff with blue border (AI comment styling)

### Variations
- **Collapsible index**: User clicks comment count to toggle visibility
- **No issues**: Summary shows green checkmark, index is empty

### Edge Cases
- Comment references deleted line: Index still shows it; scrolling to line may fail gracefully
- Malformed comment body: Displays as-is

---

## STORY-007: Create New Dashboard with Prompt

**Type**: medium  
**Topic**: Code Review & Dashboards  
**Persona**: Developer building project artifact/summary  
**Goal**: Generate a new dashboard from natural language prompt  
**Preconditions**: Workspace open, Dashboards tab visible

### Steps
1. User clicks "New" button in Dashboards left panel header
2. DashboardPromptModal opens with title "New Dashboard"
3. Textarea is focused, placeholder: "Describe what this dashboard should show..."
4. User types prompt: "Show API request latency metrics over past week"
5. User presses Cmd+Enter or clicks "Generate" button
6. Modal shows loading spinner on button; textarea disabled
7. AI generates artifact asynchronously
8. Success: Modal closes, new dashboard appears at top of list
9. User can immediately rename/archive it

### Variations
- **Cancel generation**: User presses Escape or clicks Cancel button
- **Generation error**: Modal shows error text, user can retry or cancel

### Edge Cases
- Empty prompt: Generate button disabled
- Very long prompt: Textarea expands to fit; may hit API limits
- Timeout (>5 min): Error shown, user can retry

---

## STORY-008: Rename Dashboard Title

**Type**: short  
**Topic**: Code Review & Dashboards  
**Persona**: Developer organizing dashboards  
**Goal**: Update dashboard name after creation  
**Preconditions**: Dashboard created and selected in right panel

### Steps
1. User selects dashboard from left list → details panel opens on right
2. Dashboard title displays as heading (blue, underline on hover)
3. User clicks title → inline edit mode activates
4. Input field appears with current title selected
5. User types new title: "API Latency Dashboard v2"
6. User presses Enter or clicks elsewhere → title saves
7. Left panel list updates with new name
8. Edit mode closes; title now shows in heading

### Variations
- **Cancel edit**: User presses Escape → reverts to previous name
- **No change**: User clicks elsewhere without editing → closes input

### Edge Cases
- Blank title: Input required; save disabled
- Very long title: Input accepts, truncates in list view with ellipsis

---

## STORY-009: Archive and Restore Dashboard Visibility

**Type**: short  
**Topic**: Code Review & Dashboards  
**Persona**: Developer cleaning up old dashboards  
**Goal**: Archive completed dashboard; unhide archived ones if needed  
**Preconditions**: Dashboard list visible with active dashboards

### Steps
1. Dashboard listed in left panel with hover-visible Archive button
2. User clicks Archive button (icon) on dashboard row
3. Archive icon (box icon) → button shows "Archive" label on hover
4. User confirms (implicit, no dialog) → dashboard fades out
5. Left panel automatically filters; dashboard disappears from list
6. User checks "Show archived" checkbox at top
7. Archived dashboard reappears with opacity-50 styling
8. User can click it to view archived version (read-only)

### Variations
- **Archive from detail view**: User selects dashboard, clicks "Archive" button in right panel header
- **No archive confirmation**: Direct action for simplicity

### Edge Cases
- Archive fails: Error shown, dashboard stays visible
- Empty list after archive: "No dashboards yet" message shown

---

## STORY-010: Regenerate Dashboard with Different Prompt

**Type**: medium  
**Topic**: Code Review & Dashboards  
**Persona**: Developer iterating on dashboard design  
**Goal**: Re-generate dashboard with new requirements  
**Preconditions**: Dashboard selected, previous revision exists

### Steps
1. User selects dashboard from list → detail panel opens
2. User clicks "Regenerate" button in right panel header
3. DashboardPromptModal opens with title "Regenerate Dashboard"
4. Textarea is focused, empty (no default value to avoid confusion)
5. User types new prompt: "Show API latency broken down by endpoint"
6. User clicks "Generate" → Modal shows loading spinner
7. Button text changes to "Regenerating..."
8. New artifact revision created; spec updated
9. Success: Modal closes, detail panel refreshes
10. Revision indicator updates: "Has revisions"

### Variations
- **Revision history** (future): User sees list of previous revisions with diffs
- **Revert to previous**: User can restore older revision

### Edge Cases
- Regenerate fails: Error shown in modal; user can retry
- Same prompt: New revision still created (counts as update)

---

## STORY-011: View Artifact Revision History

**Type**: medium  
**Topic**: Code Review & Dashboards  
**Persona**: Developer tracking dashboard evolution  
**Goal**: See all versions of a dashboard and compare changes  
**Preconditions**: Dashboard with revisions selected

### Steps
1. Dashboard detail panel shows "Has revisions" indicator
2. User clicks revision indicator or "View History" link (future)
3. Revision panel opens showing timeline:
   - Latest revision at top
   - Each entry: revision #, timestamp, prompt summary, model used
4. User clicks on revision → spec previewed in main area
5. User hovers over revision → Compare button appears
6. User clicks Compare → opens side-by-side diff of spec JSON
7. Differences highlighted in green (added), red (removed)

### Variations
- **Restore revision**: User right-clicks revision → "Restore as current" makes old version active
- **Delete revision**: User can remove non-current revisions

### Edge Cases
- No revisions: "No revision history" message
- Revisions too large: Diff truncated with "See full diff" link

---

## STORY-012: Generate Dashboard from Chat Message

**Type**: long  
**Topic**: Code Review & Dashboards  
**Persona**: Developer leveraging chat to build artifacts  
**Goal**: Create dashboard directly from AI suggestion in chat  
**Preconditions**: Chat session with artifact suggestion in message

### Steps
1. AI assistant message contains dashboard artifact reference:
   ```
   I've created a dashboard showing request latency metrics:
   [Dashboard "API Metrics" - active]
   ```
2. User clicks on artifact block or "View" button
3. Artifact panel opens in sidebar (or new tab in workspaces view)
4. Dashboard pre-populated with AI-generated spec
5. User can immediately regenerate, rename, or archive
6. Artifact linked to session: visible in dashboards list under project

### Variations
- **Artifact in different message**: User can reference old messages' artifacts
- **Inline editing** (future): User edits spec directly in chat context

### Edge Cases
- Artifact generation failed: Error message in chat instead of artifact block
- Session closed: Artifact persists; accessible from dashboards tab

---

## STORY-013: Copy Diff to Clipboard

**Type**: short  
**Topic**: Code Review & Dashboards  
**Persona**: Developer sharing changes  
**Goal**: Export diff as unified format text  
**Preconditions**: Diff viewer visible with changes

### Steps
1. Diff viewer shows "Copy" button in top-right toolbar
2. User clicks Copy button
3. Button animates: text changes to "Copied!" with checkmark (green)
4. Unified diff text copied to clipboard (format: `+line`, `-line`, ` line`)
5. User pastes elsewhere (Slack, email, issue) → receives formatted diff
6. After 2 seconds, button returns to "Copy" state

### Variations
- **Copy file**: Right-click file header → "Copy file diff"
- **Copy line**: Right-click individual line → copy just that hunk

### Edge Cases
- Clipboard unavailable: Silent fail, button shows nothing
- Large diff (1000+ lines): May be slow to copy

---

## STORY-014: Export Workspace Diff as File

**Type**: short  
**Topic**: Code Review & Dashboards  
**Persona**: Developer documenting changes for record  
**Goal**: Save diff as `.patch` or `.diff` file  
**Preconditions**: Workspace diff visible

### Steps
1. User clicks "Export" button (future, not yet visible) in diff toolbar
2. Dropdown menu appears: "Save as .patch", "Save as .diff", "Copy unified text"
3. User selects "Save as .patch"
4. System generates patch file with metadata (author, timestamp, hunks)
5. Download triggered; file saved to Downloads folder
6. Patch file named: `workspace-{id}-{timestamp}.patch`

### Variations
- **Include inline comments**: Patch file contains comment threads as diff comments section
- **Include review summary**: Patch header includes AI review summary

### Edge Cases
- Binary files: Excluded from patch
- Large workspace (100+ files): May generate large file

---

## STORY-015: View Workspace Notes Panel

**Type**: short  
**Topic**: Code Review & Dashboards  
**Persona**: Developer documenting workspace context  
**Goal**: Add and view workspace notes alongside diff  
**Preconditions**: Workspace detail view open

### Steps
1. Workspace detail area has tab bar: Diff | Dashboards | Notes | Sessions
2. User clicks "Notes" tab
3. Notes panel opens with:
   - Rich text editor (Markdown support)
   - Empty state: "No notes yet. Start typing..."
4. User types notes: "Refactored authentication flow. See PR #123 for context."
5. Notes auto-save on blur or Cmd+S
6. Next time user opens workspace, notes persist
7. Notes linked to workspace (not session)

### Variations
- **Code review summary injection** (future): After code review, summary auto-appended to notes
- **Mention commits**: User can reference commits by hash in notes

### Edge Cases
- Notes very long (10k+ chars): Editor may lag
- Markdown rendering: User sees live preview split-pane

---

## STORY-016: Diff Comment Threads with Nested Replies

**Type**: long  
**Topic**: Code Review & Dashboards  
**Persona**: Code reviewer collaborating on complex issues  
**Goal**: Have multi-turn conversation on specific code changes  
**Preconditions**: Multiple diff comments on same/adjacent lines

### Steps
1. User hovers over diff line → clicks Comment
2. Textarea appears with placeholder "Add review comment"
3. User types: "Why is this using string concatenation? Should be parameterized."
4. User saves comment
5. Comment displays; another user (or same user later) clicks Reply
6. Nested reply textarea appears indented below
7. Replier types: "@alice Good catch! Changed to use prepared statements in v2."
8. Thread now shows 2-message conversation
9. Each reply shows author, timestamp, content
10. Delete button removes individual messages (not whole thread)

### Variations
- **Mention users**: User types @name → autocomplete suggests team members
- **Resolve thread**: Thread collapse/expand with "Resolved" badge
- **Sync to PR/Issue** (future): Thread exported to GitHub/Linear issue

### Edge Cases
- No reply permissions: Reply button hidden for read-only mode
- Very long thread (20+ replies): Collapsed/scrollable view

---

## STORY-017: Export Code Review to Issue

**Type**: long  
**Topic**: Code Review & Dashboards  
**Persona**: Team lead documenting review findings  
**Goal**: Export AI code review as GitHub/Linear issue  
**Preconditions**: Code review completed with findings

### Steps
1. Review summary visible with comment index
2. User clicks "Export to Issue" button (future feature)
3. Modal opens: "Create GitHub Issue"
4. Fields pre-populated:
   - Title: "Code Review: [workspace name]"
   - Body: Markdown with summary + comment list
   - Assignee: Workspace owner
5. User adjusts title/body if needed
6. User clicks "Create Issue"
7. Issue created on GitHub; link returned
8. User can click link to view issue in browser

### Variations
- **Linear export**: Export to Linear issue with same flow
- **Draft mode**: Pre-fill without creating until user confirms

### Edge Cases
- GitHub auth not configured: Modal shows setup instructions
- Very long review: Body truncated with "See full review in app" link

---

## STORY-018: Side-by-Side Diff View with Sticky Headers

**Type**: medium  
**Topic**: Code Review & Dashboards  
**Persona**: Developer comparing large files  
**Goal**: See old and new code side-by-side with line numbers  
**Preconditions**: Diff viewer open with changes

### Steps
1. User clicks "Side-by-side" button in diff controls
2. Diff layout transforms to 5-column grid:
   - Old line number | Old code | | New line number | New code | Comment button
3. Matching context lines aligned vertically
4. Added lines show empty old side; removed show empty new side
5. Colors: red (removed), green (added), neutral (context)
6. User scrolls horizontally if lines are long; new lines wrap
7. File header stays sticky at top when scrolling down
8. Hunk headers (@@ lines) also sticky

### Variations
- **Unified vs side-by-side toggle**: Smooth transition between views
- **Syntax highlighting** (future): Code blocks highlighted by language

### Edge Cases
- Very long lines (200+ chars): Horizontal scroll, line wrapping may cause misalignment
- Many hunks: Loading spinner shows progressive rendering

---

## STORY-019: Dashboard Canvas Widget Rendering

**Type**: long  
**Topic**: Code Review & Dashboards  
**Persona**: Developer viewing generated dashboard  
**Goal**: See interactive dashboard widgets from artifact spec  
**Preconditions**: Dashboard with generated spec selected

### Steps
1. Dashboard detail panel shows "Dashboard Spec" section
2. Currently displays: "Spec stored in revision [id]. Dashboard canvas is in early preview. Interactive widget rendering is coming soon."
3. (Future) Dashboard canvas renders widgets from spec JSON:
   - Cards with metrics
   - Charts (bar, line, donut)
   - Tables with data
   - Custom layout
4. User can click on widgets to drill down
5. Filters/date range controls adjust displayed data

### Variations
- **Edit mode** (future): User can drag/resize widgets
- **Export as HTML**: User generates static HTML for sharing

### Edge Cases
- Spec has invalid widget type: Gracefully skip with error label
- Rendering fails: Shows fallback "Unable to render dashboard"

---

## STORY-020: Artifact Archive and Restore Workflow

**Type**: medium  
**Topic**: Code Review & Dashboards  
**Persona**: Developer managing project artifacts  
**Goal**: Remove completed dashboards but keep history  
**Preconditions**: Multiple dashboards in project

### Steps
1. User has 5 active dashboards in list
2. User completes work on "API Metrics" dashboard
3. User clicks archive icon on dashboard row
4. Dashboard disappears from active list
5. User unchecks "Show archived" (was unchecked)
6. User later checks "Show archived" to view old work
7. Archived dashboard reappears with muted styling
8. User clicks archived dashboard → can view but not edit
9. User right-clicks archived dashboard → "Restore" option appears
10. User clicks Restore → dashboard moves back to active list

### Variations
- **Bulk archive**: Select multiple dashboards, archive all
- **Trash bin** (future): Archived items moved to trash, permanently deleted after 30 days

### Edge Cases
- Restore archived dashboard with same name as active: Renames to "API Metrics (restored)"
- Cannot edit archived dashboard: Detail panel is read-only

---

## STORY-021: Artifact Search and Filter by Project

**Type**: medium  
**Topic**: Code Review & Dashboards  
**Persona**: Developer finding old dashboards  
**Goal**: Search artifacts across project  
**Preconditions**: Project has 10+ dashboards

### Steps
1. Dashboards list has search field at top (future feature)
2. User types "latency" → filters list to dashboards with "latency" in title
3. Matches: "API Latency Dashboard", "Latency Trends"
4. User can also filter by:
   - Created date range
   - Status (active/archived)
5. Results update in real-time
6. User clears search → shows all dashboards again

### Variations
- **Full-text search**: Searches title, description, and spec content
- **Save filter preset**: User names and saves filter combinations

### Edge Cases
- No matches: "No dashboards match your search"
- Search with no results: Still shows filter options

---

## STORY-022: Code Review Severity Breakdown

**Type**: short  
**Topic**: Code Review & Dashboards  
**Persona**: Developer understanding review priorities  
**Goal**: See clear breakdown of issue severity levels  
**Preconditions**: Code review completed

### Steps
1. Review summary shows severity badges in top-right:
   - "3 Critical" (red), "2 Warning" (yellow), "1 Suggestion" (blue), "0 Info" (gray)
2. User hovers over badge → tooltip shows "3 Critical Issues"
3. Clicking badge filters comment index to show only that severity
4. All comments in index show severity badge at left
5. Color-coding consistent: Critical=red, Warning=yellow, Suggestion=blue, Info=gray

### Variations
- **Collapse by severity**: Comment index sections collapsible by severity type
- **Summary text uses count**: "Found 3 critical issues and 2 warnings"

### Edge Cases
- No issues of a severity type: Badge hidden (or shows 0 in muted color)

---

## STORY-023: Dashboard Prompt History

**Type**: short  
**Topic**: Code Review & Dashboards  
**Persona**: Developer trying similar dashboards  
**Goal**: Reuse previous prompts for new dashboards  
**Preconditions**: Multiple dashboards created in session

### Steps
1. User clicks "New" to open DashboardPromptModal
2. Textarea shows dropdown or history icon
3. User clicks history icon → dropdown shows recent prompts:
   - "Show API request latency metrics over past week"
   - "Display user signup flow conversion rates"
4. User clicks prompt → textarea pre-fills with text
5. User modifies if needed and generates

### Variations
- **Search history**: Type to filter previous prompts
- **Favorites**: User stars frequently-used prompts

### Edge Cases
- First-time user: No history; dropdown empty or hidden

---

## STORY-024: Diff Line Count Summary

**Type**: short  
**Topic**: Code Review & Dashboards  
**Persona**: Developer assessing change scope  
**Goal**: See overview of additions and deletions  
**Preconditions**: Diff viewer open

### Steps
1. Diff controls bar shows: "15 changed files"
2. Below that: "342 insertions (+), 128 deletions (-)" in green and red
3. Per-file stats also shown in file list header
4. Large changes highlighted (e.g., if one file has 500+ lines changed)

### Variations
- **Binary file note**: "1 binary file changed" included in count
- **Toggleable detail**: User clicks stat to see breakdown by file type

### Edge Cases
- Empty diff: Shows "0 changed files"
- All deletions: Shows only deletions count

---

## STORY-025: Inline Code Syntax Highlighting in Diff

**Type**: short  
**Topic**: Code Review & Dashboards  
**Persona**: Developer reviewing code quality  
**Goal**: See syntax-highlighted code in diff for clarity  
**Preconditions**: Diff contains source code (not binary)

### Steps
1. Diff viewer displays code lines with syntax highlighting (future feature)
2. Language auto-detected from file extension (.js, .py, .ts, etc.)
3. Keywords, strings, comments colored per language conventions
4. User can toggle highlighting off if preferred
5. Reduces eye strain and improves code pattern recognition

### Variations
- **Custom themes**: User can choose light/dark syntax themes
- **Diff-specific palette**: Highlighting adapted to show added/removed clearly

### Edge Cases
- Unknown file type: Falls back to plaintext (no highlighting)
- Mixed languages in file: Best-effort highlighting

---

End of UX Stories  
Generated: 2026-03-20  
Coverage: 25 user stories spanning diff viewing, commenting, code review, dashboard generation, and artifact management.
