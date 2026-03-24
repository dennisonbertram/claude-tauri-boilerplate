# STORY-092: Multi-Issue Workspace Context

## Walk Date: 2026-03-23

## Steps Performed
1. Searched for multi-issue support in workspace and chat contexts
2. Reviewed workspace API and LinearIssueBar

## Observations
- Workspace API accepts single `linearIssue` and single `githubIssue` parameters
- LinearIssueBar displays a single issue (no multi-issue UI)
- ChatPage tracks a single `linearIssue` context
- No UI for attaching multiple issues to a workspace or chat
- The data model supports one Linear issue + one GitHub issue per workspace (different types), but not multiple of the same type

## Result: NOT IMPLEMENTED
Multi-issue workspace context is not implemented. Only one Linear issue and one GitHub issue can be attached per workspace.

## Code References
- `/apps/desktop/src/lib/api/workspaces-api.ts` (lines 25-26, single issue params)
- `/apps/desktop/src/components/chat/LinearIssueBar.tsx` (single issue display)
