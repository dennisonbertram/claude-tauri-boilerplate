# STORY-037: View Workspace Git History (Revisions)

## Status: PASS

## Walk Steps

1. Opened workspace Investigation via Projects sidebar
2. Clicked Diff tab -- revision/comparison controls are visible
3. Found "Compare:" label with two dropdown comboboxes for selecting revisions
4. From-revision dropdown contains: Workspace base, and all commits (00dca0d, 3feeef7, f9ff78b, 8919707, 1b74302, eac5485, b2582b1, 09df4dd)
5. To-revision dropdown contains: Current, and all the same commits
6. "Apply" button triggers the comparison
7. Commit SHAs and messages shown in dropdowns (e.g., "8919707 -- fix(auth): accept X-API-Key header alongside Authorization: Bearer")
8. File list shows changed files with status indicators (A=added, M=modified) and "Needs review" / "Reviewed" labels
9. "Review" button available for AI code review
10. "Refresh" button to reload diff
11. Unified / Side-by-side view toggle available

## Findings

### What Works
- Full commit history available in revision dropdowns
- Commit-to-commit comparison works (selecting specific SHAs and clicking Apply)
- File change status indicators (A, M) with review tracking
- Unified and Side-by-side view modes
- AI Review button for automated code review

### Issues Found
1. **No dedicated commit log/history view** -- Git history is only accessible via the diff comparison dropdowns. There is no separate "History" or "Commits" tab showing a commit log with dates, authors, and messages in a timeline format.
2. **"Workspace base to Current" returns 0 files** -- The default/most-useful comparison range doesn't work (see STORY-036 findings).

## Screenshots
- `diff-revision-selectors.png` -- Diff tab showing revision dropdown selectors
- `paths-tab-working.png` -- Paths tab (separate feature, working correctly)
