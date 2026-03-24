# STORY-036: Add Code Review Comments to Diff

## Status: PARTIAL PASS

## Walk Steps

1. Navigated to Projects > ai-domain-registration > Investigation workspace
2. Clicked the Diff tab -- opens correctly with comparison controls
3. Selected historical comparison range (pre-launch commit to checkpoint) -- files loaded
4. Found per-file "Comment" buttons and "File comments: 0" labels in the file list panel
5. Found per-line "Comment" buttons on individual diff code lines (confirmed in accessibility tree)
6. Clicked a per-line Comment button -- comment composer did NOT appear visually
7. Verified source code: `DiffCommentComposer.tsx` renders textarea with "Add review comment (Markdown supported)" placeholder, Cancel and "Save comment" buttons
8. Verified source code: `DiffLineView.tsx` renders Comment button per line, DiffCommentThread for existing comments, DiffCommentComposer when `isActiveComment` is true

## Findings

### Feature Exists in Code
- Per-line Comment buttons render on every diff line (confirmed in accessibility tree)
- `DiffCommentComposer` has textarea + Cancel + "Save comment" buttons
- `DiffCommentThread` renders existing comments with Delete option and AI comment badges
- Comments are persisted via `api.createDiffComment()` / `api.fetchDiffComments()`

### Issues Found
1. **BUG: Comment composer does not appear when clicking per-line Comment button** -- The click registered but no textarea appeared. Possible state management or rendering issue preventing `isActiveComment` from becoming true.
2. **UX: Diff code panel hard to reach** -- Layout uses `h-1/3` for file list and a `ScrollArea` below for code diff. Page-level scrolling doesn't reach the code diff panel, making per-line Comment buttons hard to access visually.
3. **BUG: "Workspace base to Current" comparison returns 0 files** -- Despite commits existing, the default diff comparison shows no changes. Only specific commit-to-commit ranges produce results.

## Screenshots
- `workspace-overview.png` -- Workspace with tabs visible
- `diff-tab-empty.png` -- Diff tab with no files (default comparison)
- `diff-historical-with-files.png` -- Historical diff comparison loaded with file list
- `diff-line-comment-area.png` -- File list panel showing Mark reviewed buttons
- `diff-after-comment-click.png` -- After clicking Comment button (no composer appeared)
