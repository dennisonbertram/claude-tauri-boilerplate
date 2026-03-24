# Permissions & Approval Flows Walk Report (STORY-070 to STORY-081)

## Walk Date
2026-03-23

## Summary Table

| Story | Title | Status | Bugs | Missing |
|-------|-------|--------|------|---------|
| STORY-070 | Request Permission to Run Bash Command | blocked | 1 CRITICAL | 0 |
| STORY-071 | Manage Tool Permissions in Agent Profile | pass | 0 | 0 |
| STORY-072 | Review and Approve a Workspace Plan | blocked | 0 | 1 |
| STORY-073 | Identify Risk Level of Requested Tool | fail | 0 | 3 |
| STORY-074 | Set Up Session-Scoped vs. Permanent Permissions | fail | 0 | 3 |
| STORY-075 | Handle File Write Permission with Content Preview | blocked | 0 | 1 |
| STORY-076 | Use Permission Mode = "Accept Edits" for Auto-Approval | partial | 1 CRITICAL | 0 |
| STORY-077 | Handle Permission Denial and Error Recovery | blocked | 0 | 2 |
| STORY-078 | Enable Plan Mode for Multi-Step Review Workflow | fail | 0 | 3 |
| STORY-079 | Configure Sandbox for Tool Isolation | pass | 0 | 0 |
| STORY-080 | Review Risk Level in Permission Mode Settings | fail | 0 | 3 |
| STORY-081 | Recover from Permission Timeout or Disconnection | blocked | 0 | 2 |

## Counts
- **pass**: 2 (STORY-071, STORY-079)
- **partial**: 1 (STORY-076)
- **fail**: 4 (STORY-073, STORY-074, STORY-078, STORY-080)
- **blocked**: 5 (STORY-070, STORY-072, STORY-075, STORY-077, STORY-081)
- **Total bugs**: 2 (1 unique CRITICAL crash - status bar permission mode button)
- **Total missing features**: 18

## Key Findings

### What Works Well
1. **Agent Profile Tools tab** (STORY-071): Comprehensive tool permissions UI with Default/Allow/Block toggles per tool, Permission Mode dropdown, and "Show raw" JSON view
2. **Sandbox Configuration** (STORY-079): Full sandbox setup with presets (None, Node.js, Python 3, Custom JSON) and editable Docker container configuration

### Critical Bugs
1. **Status bar permission mode crash**: Clicking the "Normal" permission mode button in the status bar causes an immediate app crash with "Something went wrong" error. This affects STORY-070 and STORY-076.
2. **Settings > Data & Context crash**: Clicking the "Data & Context" tab in Settings also crashes the app (separate from the permission mode crash).

### Major Gaps
1. **No risk level indicators** (STORY-073, STORY-080): Tools lack any visual risk classification despite the system internally distinguishing "risky operations"
2. **No session vs permanent scope** (STORY-074): Permissions are only configurable at the profile level with no session-scoped options
3. **No plan mode toggle** (STORY-078): ExitPlanMode tool exists but no corresponding UI to enter/enable plan mode
4. **Many features require active session**: 5 stories blocked because runtime permission dialogs, denial handling, and timeout behavior can only be tested with a running sidecar

### Permission System Architecture (Observed)
- **Global level**: Settings > AI & Model > Advanced > Permission Mode dropdown
- **Profile level**: Agent Profiles > Tools tab > Permission Mode dropdown + per-tool Default/Allow/Block
- **Session level**: Status bar shows current mode (e.g., "Normal") but crashes on click
