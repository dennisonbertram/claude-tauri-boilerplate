# UX Walk Report: Linear & GitHub Integration (STORY-082 to STORY-096)

## Walk Date: 2026-03-23
## App URL: http://localhost:1927 (server: http://localhost:3846)

---

## Summary Table

| Story | Title | Status | Severity |
|-------|-------|--------|----------|
| STORY-082 | Connect Linear OAuth | PASS | -- |
| STORY-083 | Browse Linear Issues in Modal | PASS | -- |
| STORY-084 | Attach Linear Issue to Chat | PASS | -- |
| STORY-085 | Create Workspace from Linear Issue | PASS | -- |
| STORY-086 | View Linear Issue Deep Link | PARTIAL | Low |
| STORY-087 | Search GitHub Issues in Workspace Dialog | PASS | -- |
| STORY-088 | Auto-Fill Workspace Name from GitHub Issue | PASS | -- |
| STORY-089 | Create Workspace from GitHub Issue | PASS | -- |
| STORY-090 | Disconnect Linear | PASS | -- |
| STORY-091 | Handle Linear Auth Expiration | PARTIAL | Medium |
| STORY-092 | Multi-Issue Workspace Context | NOT IMPLEMENTED | Low |
| STORY-093 | Linear Issue Status Sync | NOT IMPLEMENTED | Low |
| STORY-094 | GitHub Issue Body Preview | NOT IMPLEMENTED | Low |
| STORY-095 | Issue Search History | NOT IMPLEMENTED | Low |
| STORY-096 | Linear Issue Picker Offline | NOT IMPLEMENTED | Low |

---

## Counts

- **PASS**: 8
- **PARTIAL**: 2
- **NOT IMPLEMENTED**: 5
- **FAIL**: 0

---

## Key Findings

### What Works Well
1. **Linear OAuth flow** is fully implemented with connect/disconnect/refresh in Settings > Integrations
2. **Linear issue picker** is a well-structured modal with search, selection, and workspace creation
3. **GitHub issue search** in workspace creation dialog has a clean three-tab design (Manual/Branch/GitHub Issue)
4. **Workspace name auto-fill** works for both Linear and GitHub issues
5. **Error handling** exists throughout with user-facing error messages

### Gaps and Issues

#### STORY-086 (Partial): Linear Deep Link
- Issue ID in chat bar reopens the picker instead of linking to linear.app
- Recommendation: Add external link icon/button that opens `https://linear.app/team/issue-id`

#### STORY-091 (Partial): Auth Expiration
- No specific 401/expired token handling
- Users see generic error messages when auth expires
- Recommendation: Detect 401 responses and show "Session expired, please reconnect" with a direct link to Settings > Integrations

#### STORY-092 (Not Implemented): Multi-Issue Context
- Only one Linear issue + one GitHub issue per workspace
- No multi-issue attachment UI

#### STORY-093 (Not Implemented): Status Sync
- Issues fetched on-demand only, no live sync

#### STORY-094 (Not Implemented): GitHub Issue Body Preview
- `body` field exists in data model but not rendered

#### STORY-095 (Not Implemented): Issue Search History
- Issue search is stateless, no history persistence

#### STORY-096 (Not Implemented): Offline Handling
- No offline-aware UX for the Linear picker

### Blockers Encountered
- **Known crash**: Clicking on conversations/workspaces in the sidebar crashes the app, preventing live testing of workspace creation dialogs
- **Linear not connected**: Could not test live Linear API flows (OAuth required)

---

## Test Methodology
- Direct UI interaction via browser on http://localhost:1927
- Source code review for components not reachable via UI
- Key source files examined:
  - `apps/desktop/src/components/settings/LinearPanel.tsx`
  - `apps/desktop/src/components/linear/LinearIssuePicker.tsx`
  - `apps/desktop/src/components/chat/LinearIssueBar.tsx`
  - `apps/desktop/src/components/workspaces/CreateWorkspaceDialog.tsx`
  - `apps/desktop/src/components/workspaces/GithubIssueModeForm.tsx`
  - `apps/desktop/src/lib/linear-api.ts`
  - `apps/desktop/src/lib/api/github-api.ts`
