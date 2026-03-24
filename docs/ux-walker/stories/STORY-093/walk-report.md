# STORY-093: Linear Issue Status Sync

## Walk Date: 2026-03-23

## Steps Performed
1. Searched for issue status sync in Linear integration code
2. Checked if issue status is tracked or updated

## Observations
- Linear API has `getStatus()` for connection status, `listIssues()` and `getIssue()` for fetching
- No automatic status sync or polling for Linear issue status changes
- Issue data is fetched at query time but not refreshed/synced after initial load
- No status update push mechanism (e.g., webhooks or polling interval)
- LinearIssueBar shows issue ID and title but no status indicator

## Result: NOT IMPLEMENTED
Linear issue status sync is not implemented. Issues are fetched on-demand but not kept in sync with Linear.

## Code References
- `/apps/desktop/src/lib/linear-api.ts`
