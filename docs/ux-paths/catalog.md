# UX Path Catalog: Claude Tauri Boilerplate

Generated: 2026-03-20  
Total Stories: 161  
Topics: 11  
Coverage: 13 / 14 feature areas (93%)

## Summary

| Type | Count | Percentage |
|------|-------|------------|
| Short | 84 | 52% |
| Medium | 59 | 37% |
| Long | 18 | 11% |
| **Total** | **161** | **100%** |

| Topic | Stories | Short | Medium | Long |
|-------|---------|-------|--------|------|
| Chat Sessions & History | 15 | 9 | 5 | 1 |
| Streaming Chat Interface | 12 | 6 | 3 | 3 |
| Workspace Worktree Management | 15 | 10 | 5 | 0 |
| Agent Profiles & Configuration | 12 | 6 | 4 | 2 |
| Settings Panel | 15 | 5 | 8 | 2 |
| Permissions & Approval Flows | 12 | 4 | 7 | 1 |
| Linear & GitHub Integration | 15 | 7 | 6 | 2 |
| Code Review & Dashboards | 25 | 13 | 8 | 4 |
| Teams & Multi-Agent Swarm | 15 | 10 | 5 | 0 |
| Advanced Chat Features | 10 | 7 | 3 | 0 |
| Desktop App Shell & Sidecar | 15 | 7 | 5 | 3 |

## Coverage Matrix

| Feature Area | Covering Topic(s) | Story Count | Gaps |
|-------------|-------------------|-------------|------|
| Chat Sessions & History | Chat Sessions & History | 15 | Good coverage |
| Streaming Chat Interface | Streaming Chat Interface | 12 | Good coverage |
| Workspace Worktree Management | Workspace Worktree Management | 15 | Good coverage |
| Projects | -- | 0 | **Not covered** |
| Agent Profiles & Configuration | Agent Profiles & Configuration | 12 | Good coverage |
| Settings & Configuration | Settings Panel | 15 | Good coverage |
| Teams & Multi-Agent Swarm | Teams & Multi-Agent Swarm | 15 | Good coverage |
| Linear Integration | Linear & GitHub Integration | 15 | Good coverage |
| GitHub Integration | Linear & GitHub Integration | 15 | Good coverage |
| MCP Servers | -- | 0 | **Not covered** |
| Code Review & Diff Viewing | Code Review & Dashboards | 25 | Good coverage |
| Dashboards/Artifacts | Code Review & Dashboards | 25 | Good coverage |
| Permissions & Access Control | Permissions & Approval Flows | 12 | Good coverage |
| Advanced Features | Advanced Chat Features | 10 | Good coverage |

## Story Dependency Graph

Stories that should be run before others for logical prerequisite flow:

```
Desktop App Shell & Sidecar (STORY-147 to STORY-161)
  Launch app, sidecar startup, auth gate
  |
  +-- Chat Sessions & History (STORY-001 to STORY-015)
  |     Create session, send messages, manage history
  |     |
  |     +-- Streaming Chat Interface (STORY-016 to STORY-027)
  |     |     Image attachments, tool calls, streaming, cost tracking
  |     |     |
  |     |     +-- Advanced Chat Features (STORY-137 to STORY-146)
  |     |           Plan mode, checkpoints, rewind, suggestions
  |     |
  |     +-- Permissions & Approval Flows (STORY-068 to STORY-079)
  |           Permission dialogs, scope management
  |
  +-- Agent Profiles & Configuration (STORY-043 to STORY-054)
  |     Create profiles, configure tools, hooks, MCP
  |     |
  |     +-- Settings Panel (STORY-055 to STORY-069)
  |           Theme, notifications, memory, instructions, hooks
  |
  +-- Workspace Worktree Management (STORY-028 to STORY-042)
  |     Create workspaces, view diffs, merge/discard
  |     |
  |     +-- Linear & GitHub Integration (STORY-080 to STORY-094)
  |     |     OAuth, issue picker, workspace from issue
  |     |
  |     +-- Code Review & Dashboards (STORY-095 to STORY-119)
  |           Diff review, comments, dashboard generation
  |
  +-- Teams & Multi-Agent Swarm (STORY-120 to STORY-134)
        Team creation, agent config, task board, monitoring
```

### Key Prerequisites

| Before | Must Complete | Reason |
|--------|-------------|--------|
| Any chat story | STORY-147 (App Launch) | App must be running |
| Streaming chat | STORY-001 (Create Session) | Need active session |
| Workspace merge | STORY-028 (Create Workspace) | Need workspace to merge |
| Code review | STORY-028 (Create Workspace) | Need workspace with changes |
| Linear workspace | STORY-080 (Linear OAuth) | Need Linear authentication |
| GitHub workspace | STORY-085 (GitHub Issue Browse) | Need GitHub connection |
| Team tasks | STORY-120 (Create Team) | Need team context |
| Plan mode | STORY-001 (Create Session) | Need active chat |
| Profile selector | STORY-043 (Create Profile) | Need profiles to select |
| Dashboard generation | STORY-028 (Create Workspace) | Need workspace context |

## All Stories

### Chat Sessions & History

*Topic file: `docs/ux-paths/topics/chat-sessions-history.md`*

| Global ID | Local ID | Type | Title | Persona |
|-----------|----------|------|-------|---------|
| STORY-001 | STORY-001 | short | Create First Chat Session | New user onboarding |
| STORY-002 | STORY-002 | short | Search Sessions by Topic | Power user with 30+ sessions |
| STORY-003 | STORY-003 | short | Rename Session After Conversation | Organized user who wants meaningful session names |
| STORY-004 | STORY-004 | medium | Fork Session at Checkpoint | Developer exploring multiple approaches to a problem |
| STORY-005 | STORY-005 | short | Export Session to Markdown | Technical writer documenting a code review |
| STORY-006 | STORY-006 | short | Delete Session with Confirmation | User cleaning up old sessions |
| STORY-007 | STORY-007 | medium | Auto-Name Session Based on Content | User wanting meaningful names without manual input |
| STORY-008 | STORY-008 | short | View Session Context Summary | User returning to old session after a week |
| STORY-009 | STORY-009 | medium | Link Session to Agent Profile | User with multiple profiles (e.g., "Code Reviewer", "Arch... |
| STORY-010 | STORY-010 | short | List and Organize Sessions by Date | Long-time user with 80+ sessions over 3 months |
| STORY-011 | STORY-011 | medium | Recover Recently Deleted Session | User who accidentally deleted important session |
| STORY-012 | STORY-012 | medium | Browse Full Session Thread with Message Parts | Developer reviewing a complex multi-turn conversation |
| STORY-013 | STORY-013 | long | Share Session Export with Team | Team lead sharing code review findings |
| STORY-014 | STORY-014 | short | Session Persistence Across App Restart | User who closes and reopens app mid-conversation |
| STORY-015 | STORY-015 | short | Handle Session with Profile Badge | User with multiple specialized agent profiles |

### Streaming Chat Interface

*Topic file: `docs/ux-paths/topics/streaming-chat-interface.md`*

| Global ID | Local ID | Type | Title | Persona |
|-----------|----------|------|-------|---------|
| STORY-016 | STORY-001 | medium | First Message with Image Attachment | Software developer |
| STORY-017 | STORY-002 | short | Effort Picker Flow with Thinking Budget Trade-off | Senior engineer tackling a complex architectural decision |
| STORY-018 | STORY-003 | medium | Real-time Tool Visualization with Elapsed Time | DevOps engineer |
| STORY-019 | STORY-004 | short | Model & Effort Selector with Fast Mode Toggle | Impatient user in a time crunch |
| STORY-020 | STORY-005 | short | Suggestion Chips After Empty Assistant Message | New user seeking guidance |
| STORY-021 | STORY-006 | short | Cost Tracking with Expandable Breakdown | Budget-conscious developer |
| STORY-022 | STORY-007 | short | Context Indicator Nearing Limit | Researcher with long-running conversation |
| STORY-023 | STORY-008 | medium | Markdown with Code, LaTeX, and Mermaid Rendering | Technical writer |
| STORY-024 | STORY-009 | long | Workflow Template Trigger (Code Review) | Tech lead reviewing a pull request |
| STORY-025 | STORY-010 | long | Rewind Dialog and Checkpoint Timeline | Iterative developer |
| STORY-026 | STORY-011 | short | Thinking Block Expansion & Collapse Toggle | Curious researcher |
| STORY-027 | STORY-012 | long | Permission Dialog & Risky Tool Execution | Safety-conscious engineer |

### Workspace Worktree Management

*Topic file: `docs/ux-paths/topics/workspace-worktree-management.md`*

| Global ID | Local ID | Type | Title | Persona |
|-----------|----------|------|-------|---------|
| STORY-028 | STORY-001 | short | Create a Basic Workspace Manually | Developer (Alex) |
| STORY-029 | STORY-002 | medium | Create Workspace from GitHub Issue | Developer (Jordan) |
| STORY-030 | STORY-003 | short | Create Workspace from Branch | Developer (Sam) |
| STORY-031 | STORY-004 | short | Monitor Workspace Creation Status | Developer (Taylor) |
| STORY-032 | STORY-005 | medium | View Workspace Diff and Changed Files | Code Reviewer (Morgan) |
| STORY-033 | STORY-006 | short | Add Additional Directories to Workspace | Developer (Casey) |
| STORY-034 | STORY-007 | medium | Merge Workspace Back to Base Branch | Developer (Alex) |
| STORY-035 | STORY-008 | short | Discard Workspace (Destructive) | Developer (Jordan) |
| STORY-036 | STORY-009 | medium | Add Code Review Comments to Diff | Code Reviewer (Casey) |
| STORY-037 | STORY-010 | short | View Workspace Git History (Revisions) | Developer (Sam) |
| STORY-038 | STORY-011 | short | Rename Workspace and Branch | Developer (Morgan) |
| STORY-039 | STORY-012 | short | View Workspace Notes with Preview | Developer (Alex) |
| STORY-040 | STORY-013 | short | Filter and Search Workspaces in Sidebar | Developer (Casey) |
| STORY-041 | STORY-014 | short | Open Workspace in IDE | Developer (Jordan) |
| STORY-042 | STORY-015 | medium | Handle Workspace Status Errors and Recovery | Developer (Morgan) |

### Agent Profiles & Configuration

*Topic file: `docs/ux-paths/topics/agent-profiles-configuration.md`*

| Global ID | Local ID | Type | Title | Persona |
|-----------|----------|------|-------|---------|
| STORY-043 | STORY-001 | short | Create New Agent Profile | Developer (Claude Code user building specialized agents) |
| STORY-044 | STORY-002 | short | Configure Profile Metadata | Organization manager (setting up team defaults) |
| STORY-045 | STORY-003 | medium | Configure System Prompt | AI architect (fine-tuning agent behavior) |
| STORY-046 | STORY-004 | short | Select Model & Effort Level | Cost-conscious developer (optimizing token usage) |
| STORY-047 | STORY-005 | medium | Configure Tool Permissions | Security officer (restricting dangerous tool access) |
| STORY-048 | STORY-006 | long | Configure MCP Servers | DevOps engineer (integrating Model Context Protocol servers) |
| STORY-049 | STORY-007 | long | Visual Hook Editor (XY Flow Canvas) | Power user (automating multi-step workflows) |
| STORY-050 | STORY-008 | short | Configure Sandbox Environment | Security-conscious user (isolating tool execution) |
| STORY-051 | STORY-009 | short | Profile Selector in Chat | Chat user (switching agent behaviors mid-session) |
| STORY-052 | STORY-010 | short | Delete Profile with Confirmation | Cleanup-focused user (removing old profiles) |
| STORY-053 | STORY-011 | medium | Import/Export Profile Configuration | Team lead (sharing configurations) |
| STORY-054 | STORY-012 | medium | Manage Advanced Settings | Power user (controlling execution limits and environment) |

### Settings Panel

*Topic file: `docs/ux-paths/topics/settings-panel.md`*

| Global ID | Local ID | Type | Title | Persona |
|-----------|----------|------|-------|---------|
| STORY-055 | STORY-001 | short | Toggle Theme Preference | Developer with external monitors |
| STORY-056 | STORY-002 | medium | Customize Chat Appearance with Font & Density | Accessibility-focused user with vision impairment |
| STORY-057 | STORY-003 | short | Configure Workspace Branch Prefix | Team lead managing multiple projects |
| STORY-058 | STORY-004 | medium | Enable and Test Notification Sounds | Background task monitor |
| STORY-059 | STORY-005 | long | Manage Memory Files with Search and Edit | Research analyst building persistent project knowledge base |
| STORY-060 | STORY-006 | medium | Add MCP Server with Preset | Tool integrator setting up browser automation |
| STORY-061 | STORY-007 | medium | Create and Edit Custom Instructions File | Project maintainer documenting coding standards |
| STORY-062 | STORY-008 | medium | Configure Advanced Model Parameters | Power user fine-tuning AI behavior |
| STORY-063 | STORY-009 | long | Configure Hooks for Automated Workflows | DevOps engineer automating CI/CD triggers |
| STORY-064 | STORY-010 | medium | Set Git Provider Credentials (Bedrock/Vertex) | AWS-based enterprise user |
| STORY-065 | STORY-011 | short | Request Browser Notification Permission | Distracted user needing task completion alerts |
| STORY-066 | STORY-012 | medium | Workflow Template Customization | Template designer optimizing workflow patterns |
| STORY-067 | STORY-013 | short | View System Status and Runtime Info | Troubleshooting user checking app health |
| STORY-068 | STORY-014 | short | Search and Navigate Settings Tabs Efficiently | User with many settings tabs |
| STORY-069 | STORY-015 | medium | Handle Settings Persistence and Defaults Reset | User troubleshooting app behavior |

### Permissions & Approval Flows

*Topic file: `docs/ux-paths/topics/permissions-approval-flows.md`*

| Global ID | Local ID | Type | Title | Persona |
|-----------|----------|------|-------|---------|
| STORY-070 | STORY-001 | short | Request Permission to Run Bash Command | Developer building a project with Claude |
| STORY-071 | STORY-002 | medium | Manage Tool Permissions in Agent Profile | AI engineer configuring an agent profile for a code revie... |
| STORY-072 | STORY-003 | medium | Review and Approve a Workspace Plan | Engineering lead verifying an AI-generated plan before wo... |
| STORY-073 | STORY-004 | short | Identify Risk Level of Requested Tool | Cautious developer wanting to understand what each tool c... |
| STORY-074 | STORY-005 | medium | Set Up Session-Scoped vs. Permanent Permissions | Developer wanting to grant Bash access for current sessio... |
| STORY-075 | STORY-006 | medium | Handle File Write Permission with Content Preview | Developer reviewing an AI-generated code file before Clau... |
| STORY-076 | STORY-007 | short | Use Permission Mode = "Accept Edits" for Auto-Approval | Developer with high trust in Claude's code generation |
| STORY-077 | STORY-008 | medium | Handle Permission Denial and Error Recovery | User learning to safely set up agent tooling |
| STORY-078 | STORY-009 | long | Enable Plan Mode for Multi-Step Review Workflow | Senior engineer deploying critical infrastructure changes... |
| STORY-079 | STORY-010 | medium | Configure Sandbox for Tool Isolation | Security-conscious dev wanting isolated execution environ... |
| STORY-080 | STORY-011 | short | Review Risk Level in Permission Mode Settings | Team lead reviewing company policy for AI agent tool access |
| STORY-081 | STORY-012 | medium | Recover from Permission Timeout or Disconnection | User in long-running chat interrupted by network issue |

### Linear & GitHub Integration

*Topic file: `docs/ux-paths/topics/linear-github-integration.md`*

| Global ID | Local ID | Type | Title | Persona |
|-----------|----------|------|-------|---------|
| STORY-082 | STORY-001 | short | Connect Linear OAuth | Developer (first-time setup) |
| STORY-083 | STORY-002 | medium | Browse Linear Issues in Modal | Developer solving a task |
| STORY-084 | STORY-003 | short | Attach Linear Issue to Chat | Developer providing context |
| STORY-085 | STORY-004 | medium | Create Workspace from Linear Issue | Developer implementing a feature |
| STORY-086 | STORY-005 | short | View Linear Issue Deep Link | Developer sharing workspace |
| STORY-087 | STORY-006 | medium | Search GitHub Issues in Workspace Dialog | Developer starting work from PR/issue |
| STORY-088 | STORY-007 | short | Auto-Fill Workspace Name from GitHub Issue | Developer creating workspace |
| STORY-089 | STORY-008 | medium | Create Workspace from GitHub Issue | Developer implementing GitHub task |
| STORY-090 | STORY-009 | short | Disconnect Linear | Developer revoking access |
| STORY-091 | STORY-010 | medium | Handle Linear Auth Expiration | Developer with expired token |
| STORY-092 | STORY-011 | long | Multi-Issue Workspace Context | Developer coordinating related work |
| STORY-093 | STORY-012 | long | Linear Issue Status Sync | Developer tracking work progress |
| STORY-094 | STORY-013 | short | GitHub Issue Body Preview | Developer understanding issue scope |
| STORY-095 | STORY-014 | medium | Issue Search History | Developer frequently reusing issues |
| STORY-096 | STORY-015 | short | Linear Issue Picker Offline | Developer on poor connection |

### Code Review & Dashboards

*Topic file: `docs/ux-paths/topics/code-review-dashboards.md`*

| Global ID | Local ID | Type | Title | Persona |
|-----------|----------|------|-------|---------|
| STORY-097 | STORY-001 | short | View Workspace Diff with Unified Layout | Developer reviewing changes before merge |
| STORY-098 | STORY-002 | short | Comment on Specific Diff Line | Code reviewer documenting feedback |
| STORY-099 | STORY-003 | short | Filter Diff Files by Review Status | Developer completing code review |
| STORY-100 | STORY-004 | medium | Start AI Code Review | Developer requesting automated code review |
| STORY-101 | STORY-005 | short | Right-Click Review Customization | Advanced user with custom review standards |
| STORY-102 | STORY-006 | medium | View Code Review Summary with Severity Index | Developer triaging code review findings |
| STORY-103 | STORY-007 | medium | Create New Dashboard with Prompt | Developer building project artifact/summary |
| STORY-104 | STORY-008 | short | Rename Dashboard Title | Developer organizing dashboards |
| STORY-105 | STORY-009 | short | Archive and Restore Dashboard Visibility | Developer cleaning up old dashboards |
| STORY-106 | STORY-010 | medium | Regenerate Dashboard with Different Prompt | Developer iterating on dashboard design |
| STORY-107 | STORY-011 | medium | View Artifact Revision History | Developer tracking dashboard evolution |
| STORY-108 | STORY-012 | long | Generate Dashboard from Chat Message | Developer leveraging chat to build artifacts |
| STORY-109 | STORY-013 | short | Copy Diff to Clipboard | Developer sharing changes |
| STORY-110 | STORY-014 | short | Export Workspace Diff as File | Developer documenting changes for record |
| STORY-111 | STORY-015 | short | View Workspace Notes Panel | Developer documenting workspace context |
| STORY-112 | STORY-016 | long | Diff Comment Threads with Nested Replies | Code reviewer collaborating on complex issues |
| STORY-113 | STORY-017 | long | Export Code Review to Issue | Team lead documenting review findings |
| STORY-114 | STORY-018 | medium | Side-by-Side Diff View with Sticky Headers | Developer comparing large files |
| STORY-115 | STORY-019 | long | Dashboard Canvas Widget Rendering | Developer viewing generated dashboard |
| STORY-116 | STORY-020 | medium | Artifact Archive and Restore Workflow | Developer managing project artifacts |
| STORY-117 | STORY-021 | medium | Artifact Search and Filter by Project | Developer finding old dashboards |
| STORY-118 | STORY-022 | short | Code Review Severity Breakdown | Developer understanding review priorities |
| STORY-119 | STORY-023 | short | Dashboard Prompt History | Developer trying similar dashboards |
| STORY-120 | STORY-024 | short | Diff Line Count Summary | Developer assessing change scope |
| STORY-121 | STORY-025 | short | Inline Code Syntax Highlighting in Diff | Developer reviewing code quality |

### Teams & Multi-Agent Swarm

*Topic file: `docs/ux-paths/topics/teams-multi-agent-swarm.md`*

| Global ID | Local ID | Type | Title | Persona |
|-----------|----------|------|-------|---------|
| STORY-122 | STORY-001 | medium | Create Team with Multiple Agents | Dev Lead (setting up coordinated AI agents for a codebase... |
| STORY-123 | STORY-002 | medium | Open Team and Monitor Live Agent Status | Team Manager (checking on active team during orchestration) |
| STORY-124 | STORY-003 | short | Send Direct Message Between Agents | Orchestrator (script-based inter-agent coordination) |
| STORY-125 | STORY-004 | medium | Manage Agent Tasks with Kanban Board | Project Lead (tracking team progress via task workflow) |
| STORY-126 | STORY-005 | short | Delete and Shutdown Teams | Admin (cleaning up completed team orchestrations) |
| STORY-127 | STORY-006 | short | Expand Agent Details and View Tools | DevOps Engineer (verifying agent configurations) |
| STORY-128 | STORY-007 | short | Change Team Display Mode | Platform Architect (testing different orchestration modes) |
| STORY-129 | STORY-008 | short | Handle Agent Stop from Sidebar | Monitor/Observer (stopping misbehaving agent) |
| STORY-130 | STORY-009 | short | Filter Messages by Agent Name | Debugger (reviewing agent conversations for a specific in... |
| STORY-131 | STORY-010 | short | Shutdown Team with Confirmation Flow | Session Manager (ending team orchestration gracefully) |
| STORY-132 | STORY-011 | medium | Create Team with Mixed Agent Permissions | Security Officer (setting up controlled agent escalation) |
| STORY-133 | STORY-012 | short | View Team Metadata and Creation Info | Admin (auditing team configurations) |
| STORY-134 | STORY-013 | short | Add Agent to Existing Team | Team Manager (scaling team mid-orchestration) |
| STORY-135 | STORY-014 | short | Navigate Between Team List and Workspace | Team Manager (context switching between multiple teams) |
| STORY-136 | STORY-015 | medium | Real-Time Agent Status Updates (Future Feature) | Orchestrator (monitoring live team execution) |

### Advanced Chat Features

*Topic file: `docs/ux-paths/topics/advanced-chat-features.md`*

| Global ID | Local ID | Type | Title | Persona |
|-----------|----------|------|-------|---------|
| STORY-137 | STORY-001 | short | Review Cost Breakdown During Session | Data scientist monitoring API spend |
| STORY-138 | STORY-002 | medium | Rewind Conversation to Earlier Checkpoint | Developer trying different approaches in code review |
| STORY-139 | STORY-003 | medium | Monitor Active Subagent Execution | AI researcher observing multi-agent task decomposition |
| STORY-140 | STORY-004 | short | Accept Suggestion Chip for Next Action | Product manager using AI to brainstorm features |
| STORY-141 | STORY-005 | short | Review Thinking Process Before Approval | Safety researcher validating AI reasoning chain |
| STORY-142 | STORY-006 | short | Pin Context Summary Under Input | Manager keeping track of discussion thread across many turns |
| STORY-143 | STORY-007 | short | Monitor Token Usage While Typing | API cost monitor with tight budget |
| STORY-144 | STORY-008 | short | Expand and Collapse Approved Plan | Engineer reviewing AI-generated plan for code refactor |
| STORY-145 | STORY-009 | medium | View Latest Turn File Changes in Diff | Code reviewer comparing Turn 7 vs Turn 8 file modifications |
| STORY-146 | STORY-010 | short | Provide Feedback While Approving Plan | Manager approving AI plan with optional guidance |

### Desktop App Shell & Sidecar

*Topic file: `docs/ux-paths/topics/desktop-app-shell-sidecar.md`*

| Global ID | Local ID | Type | Title | Persona |
|-----------|----------|------|-------|---------|
| STORY-147 | STORY-001 | medium | App Launch & Window Initialization | First-time user |
| STORY-148 | STORY-002 | medium | Server Sidecar Startup & Lifecycle | Developer/DevOps |
| STORY-149 | STORY-003 | long | Authentication Gate & Subscription Check | Returning user with valid Claude subscription |
| STORY-150 | STORY-004 | long | Onboarding Flow for New Users | First-time user without Claude subscription |
| STORY-151 | STORY-005 | short | Platform Detection & OS-Specific Behaviors | User across macOS, Windows, Linux |
| STORY-152 | STORY-006 | short | Welcome Screen with Profile Selection | Authenticated user starting first chat |
| STORY-153 | STORY-007 | medium | Error Boundary Recovery & Crash Handling | User experiencing rendering error |
| STORY-154 | STORY-008 | short | Loading State During Server Startup Delay | User on slow machine or network |
| STORY-155 | STORY-009 | medium | Multi-View Navigation & State Persistence | Advanced user switching between Chat, Teams, and Workspaces |
| STORY-156 | STORY-010 | short | Settings Panel Access & Quick Open | User adjusting app preferences |
| STORY-157 | STORY-011 | short | Quit Confirmation for Running Agents | User with active subagent tasks |
| STORY-158 | STORY-012 | long | App Startup Sequence & Initialization Order | DevOps/debugging engineer |
| STORY-159 | STORY-013 | short | Window State Recovery & Restore on Reopen | User reopening app after close |
| STORY-160 | STORY-014 | medium | Error Recovery & Graceful Degradation | User with network issues or API failures |
| STORY-161 | STORY-015 | short | Performance & Resource Cleanup on View Switch | User rapidly switching between Chat and Workspaces |

## Gaps & Recommendations

### Uncovered Feature Areas

- **Projects CRUD**: No dedicated topic covers project management (add, list, delete projects, health status). Projects are tangentially referenced in Workspace stories but no stories exercise the full project lifecycle.
- **MCP Server Runtime**: MCP server configuration is covered in Settings and Agent Profiles, but no stories cover the runtime behavior: dynamic tool discovery during chat, server status monitoring in real-time, or handling server failures mid-conversation.
- **Onboarding / First Run**: Desktop App Shell covers launch and auth, but there is no dedicated first-run experience story (empty state, first project setup, first session walkthrough).
- **Keyboard Shortcuts & Command Palette**: The app has a command palette and keyboard shortcuts, but no stories exercise these power-user interaction patterns.
- **Error Recovery Across Features**: Individual topics cover some error cases, but there are no cross-cutting error recovery stories (e.g., network loss during streaming, database corruption recovery, sidecar crash recovery).
- **Multi-Window / Multi-Instance**: As a Tauri desktop app, users may open multiple windows. No stories test concurrent instance behavior.
- **Data Migration / Import**: No stories cover migrating data between installations or importing configurations from another machine.

### Recommended Additional Stories

- STORY-NEW-A: **Add First Project** (medium) -- New user adds their first git repository, sees it validated, and creates their first workspace from it.
- STORY-NEW-B: **Delete Project with Active Workspaces** (short) -- User attempts to delete a project that has active workspaces; confirm warning dialog and cascading effects.
- STORY-NEW-C: **Command Palette Navigation** (short) -- Power user opens command palette (Cmd+K), searches for and executes actions without touching the mouse.
- STORY-NEW-D: **MCP Server Failure During Chat** (medium) -- User is mid-conversation when an MCP server goes down; observe error handling, graceful degradation, and recovery.
- STORY-NEW-E: **First Run Onboarding** (long) -- Brand new user launches app for the first time, completes auth, creates first project, starts first chat.
- STORY-NEW-F: **Network Loss During Streaming** (medium) -- User loses network connectivity while Claude is streaming a response; observe buffering, reconnection, and recovery behavior.
- STORY-NEW-G: **Bulk Workspace Cleanup** (short) -- User archives or discards multiple old workspaces in sequence to free disk space.
- STORY-NEW-H: **Profile Import from Team** (medium) -- User receives a shared agent profile JSON file and imports it into their local installation.

---

*This catalog was generated by analyzing 11 topic files containing 161 UX stories across all major feature areas of the Claude Tauri Boilerplate desktop application.*
