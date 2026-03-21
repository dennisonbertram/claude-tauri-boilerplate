# App Discovery: Claude Code Desktop

Generated: 2026-03-20

## Application Type
Native desktop app (Tauri + React) — AI pair programming environment

## Tech Stack
- Tauri v2 (Rust backend), React 18, TypeScript, Tailwind CSS v4
- State: React hooks + context
- Icons: Phosphor Icons
- Fonts: Inter, Newsreader (serif), JetBrains Mono

## User Roles
Single user (personal desktop tool, no role distinction)

## Feature Map

### Chat View
- Start new conversation
- Resume existing session from recents list
- Search/filter sessions
- Send messages with text, images, attachments
- Select agent profile before chatting
- View streaming AI response with tool calls
- Approve/deny tool permission requests
- Expand/collapse thinking blocks
- Rewind conversation to checkpoint
- Fork session at any message
- Export session as JSON/Markdown
- Auto-naming of sessions
- View context window usage
- View session cost
- Switch model mid-session
- Toggle effort level (Low/Medium/High/Max)

### Workspaces / Projects View
- Add project (git repo path)
- Delete project
- Create workspace from scratch (branch name)
- Create workspace from GitHub issue
- Create workspace from Linear issue
- View workspace list per project
- Select and open workspace
- View git diff of workspace changes
- Merge workspace to base branch
- Discard workspace changes
- Add additional directories to workspace
- Rename workspace/branch
- Write workspace notes (shared as AI context)
- View workspace dashboards (artifacts)
- Chat within workspace context
- Open workspace in IDE
- Copy branch name

### Agent Profiles View
- Create agent profile
- Duplicate profile
- Delete profile
- Edit profile: name, icon, description
- Edit system prompt
- Configure model and effort
- Configure tools (allowed/denied)
- Configure automations/hooks
- Configure MCP integrations
- Configure sandbox
- Configure advanced settings
- Set profile as default

### Teams View
- Create team
- Add/invite members
- View member list
- Manage roles and permissions
- View shared usage pool
- View recent activity feed
- View pending invitations
- Revoke invitations

### Settings
- General: IDE preference, workspace branch prefix, workflow prompts
- Appearance: theme, font, density
- Notifications: enable/sound/workspace unread badge
- Model: primary model, effort level, thinking budget, API key/provider
- Advanced: permission mode, auto-compact, max turns, runtime env vars
- Workflows: configurable prompts for merge memory and other triggers
- Instructions: global system instructions (CLAUDE.md content)
- Memory: persistent memory file (MEMORY.md content)
- MCP: configure MCP servers
- Hooks: configure automation hooks
- Git: git integration settings
- Linear: Linear OAuth integration
- Status: live session info (model, tools, MCP servers, Claude Code version)

### Status Bar (always visible)
- Switch model via dropdown
- Change permission mode
- View active tool during streaming
- View agent count during swarm
- View context usage %
- View session cost
- Click to open settings

## Navigation Structure
- AppSidebar (260px left): New Chat button, nav links (Chat / Projects / Teams / Agents), recents list (chat view) or project/workspace tree (workspaces view), user footer with gear icon
- Sidebar collapses to 56px icon strip (toggle button, New Chat, nav icons, gear)
- Sessions in recents list are grouped by date bucket: Today / Yesterday / This Week / This Month / Older
- Main area switches between: Chat, Workspaces, Agents, Teams views
- WorkspacePanel has 5 tabs: Chat / Diff / Paths / Notes / Dashboards
- AgentProfileEditor has 8 tabs: General / Prompt / Model / Tools / Automations / Integrations / Sandbox / Advanced
- Settings opens as panel overlay (grouped into 5 sections: General, AI & Model, Data & Context, Integrations, Status)
- WelcomeScreen shown when chat view is active but no session is selected; includes agent profile pill selector, New Conversation button, and 3 template prompt suggestions

## Data Entities
- Session: create, read, rename, delete, fork, export
- Message: create (send), read (view), rewind to
- Project: create, read, delete
- Workspace: create, read, rename, merge, discard
- Agent Profile: create, read, update, delete, duplicate
- Team: create, read, manage members
- Artifact/Dashboard: create, read, archive, rename, regenerate

## Integrations
- GitHub: create workspace from issue, link issue number/title/URL to workspace header
- Linear: OAuth + create workspace from issue
- MCP servers: configure external tools (global and per-profile)
- IDEs: open workspace in VS Code, Cursor, or custom IDE URL

## Recommended Story Topics
1. **First conversation** — New user opens app, types first message, sees streaming response with tool calls
2. **Session management** — Find, rename, fork, export, delete sessions from sidebar
3. **Workspace lifecycle** — Create workspace, code with AI, view diff, merge to main
4. **Agent profile setup** — Create and configure a custom agent profile, use it in chat
5. **Tool calls and permissions** — AI executes tools, user approves/denies, sees results
6. **Settings and preferences** — Configure model, keyboard shortcuts, appearance
7. **Workspace notes and context** — Write notes, verify they appear as AI context
8. **Status bar and monitoring** — Switch models, track context usage, view costs
9. **Attachment and file context** — Attach images, drag files, use them in conversation
10. **Error handling and recovery** — Network errors, failed tool calls, permission denials, rewind
11. **Teams and collaboration** — Invite members, view activity, manage shared usage
12. **Power user workflows** — Multiple workspaces, agent switching, rewind + fork patterns
