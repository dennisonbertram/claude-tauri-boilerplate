# STORY-095: Issue Search History

## Walk Date: 2026-03-23

## Steps Performed
1. Searched for search history functionality in Linear and GitHub issue search
2. Checked DocumentsView for search history pattern

## Observations
- DocumentsView has a `RECENT_SEARCHES` constant with hardcoded search terms
- No search history mechanism found in LinearIssuePicker or GithubIssueModeForm
- Issue search is stateless -- previous searches are not persisted or recalled
- No localStorage or API-backed search history for issue pickers

## Result: NOT IMPLEMENTED
Issue search history is not implemented in the Linear or GitHub issue pickers. Only the Documents search view has a (hardcoded) recent searches sidebar.

## Code References
- `/apps/desktop/src/components/documents/DocumentsView.tsx` (lines 82, 213-218 -- Documents search has recent searches)
- `/apps/desktop/src/components/linear/LinearIssuePicker.tsx` (no search history)
- `/apps/desktop/src/components/workspaces/GithubIssueModeForm.tsx` (no search history)
