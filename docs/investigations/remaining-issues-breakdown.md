# Remaining Open Issues Breakdown

Comprehensive breakdown of all open GitHub issues requiring attention, captured 2026-03-15.

---

## Issue #1: MCP Server Configuration UI

- **URL**: https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/1
- **State**: OPEN
- **Labels**: `feature`, `P2-nice-to-have`, `sdk-integration`, `needs-splitting`, `large`
- **Assignees**: None
- **Comments**: None

### Description

Build a settings panel for configuring MCP (Model Context Protocol) servers. Users need to add, remove, configure, and monitor external tool servers that extend Claude's capabilities.

### Current State

The backend passes `mcpServers` to the SDK via the `options` object, but there is no UI to manage MCP server configurations. Users must manually edit `.mcp.json` or pass configuration programmatically. The SDK supports stdio, HTTP/SSE, and in-process server types.

### Target State

A dedicated MCP Server management panel in the settings UI where users can:
- Add new servers (stdio with command + args, HTTP/SSE with URL, in-process SDK servers)
- Remove existing servers
- Enable/disable individual servers without deleting them
- View real-time server status and health
- Configure allowed tools per server
- View available tools exposed by each connected server
- Support environment variable injection for server commands

### Acceptance Criteria

- [ ] Settings panel section for MCP servers is accessible from the main settings
- [ ] Users can add a stdio-based MCP server by specifying command, args, and env vars
- [ ] Users can add an HTTP/SSE MCP server by specifying URL and optional headers
- [ ] Users can enable/disable servers with a toggle
- [ ] Server connection status is displayed (connected, disconnected, error) with real-time updates
- [ ] Available tools per server are listed with their names and descriptions
- [ ] Users can configure which tools from each server are allowed/denied
- [ ] Server configurations persist across sessions (stored in `.mcp.json` or equivalent)
- [ ] Error states are clearly displayed (e.g., server failed to start, connection refused)
- [ ] Removing a server shows a confirmation dialog

### Test Requirements

**Unit Tests:**
- Test MCP server config form validation (required fields, URL format, command existence)
- Test server enable/disable state toggling
- Test serialization/deserialization of server configs to/from `.mcp.json`
- Test tool permission filtering per server

**Integration Tests:**
- Test adding a stdio server and verifying it appears in `mcpServerStatus()`
- Test adding an HTTP server with authentication headers
- Test that disabled servers are not passed to the SDK `mcpServers` option
- Test real-time status polling via `query.mcpServerStatus()`
- Test that tool allowlists are correctly applied to `allowedTools` option

### Implementation Plan

1. Design the MCP server configuration data model (compatible with `.mcp.json` schema)
2. Create backend API endpoints for CRUD operations on server configs
3. Build the server list component with status indicators
4. Build the "Add Server" form with transport type selector (stdio/HTTP/SSE)
5. Implement server status polling using `query.mcpServerStatus()`
6. Build the tool browser per server showing available tools
7. Implement tool permission toggles (allow/deny per tool)
8. Add environment variable editor for stdio server configs
9. Persist configurations to `.mcp.json` and reload on startup
10. Add connection health monitoring with auto-retry logic

### SDK Reference

```typescript
// MCP Server Configuration (Options)
options: {
  mcpServers: {
    'my-server': {
      type: 'stdio',
      command: 'node',
      args: ['./server.js'],
      env: { API_KEY: process.env.MY_API_KEY },
    },
    'weather-api': {
      type: 'http',
      url: 'https://api.weather.com/mcp',
      headers: { Authorization: `Bearer ${token}` },
    },
  },
}

// Status Monitoring
const statuses = await query.mcpServerStatus();
// Returns: McpServerStatus[] with name and connection status

// Tool Naming Convention: mcp__<serverName>__<toolName>
```

### Dependencies

- SDK `mcpServers` option support (available)
- `query.mcpServerStatus()` API (available)
- `.mcp.json` file format support
- Settings panel infrastructure (may need to be built)

### Research References

- docs/research/claude-agent-sdk-complete-reference.md (Section 7: MCP Server Configuration)
- docs/research/claude-code-features-complete.md (Section 8: MCP)

---

## Issue #2: CLAUDE.md / Project Instructions Management

- **URL**: https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/2
- **State**: OPEN
- **Labels**: `feature`, `P2-nice-to-have`, `frontend`, `needs-splitting`, `large`
- **Assignees**: None
- **Comments**: None

### Description

Build a UI for viewing and editing CLAUDE.md project instruction files, with a visual hierarchy showing instructions from project, user, and global levels, and the ability to create or edit them directly from the app.

### Current State

Claude Code reads CLAUDE.md files at multiple levels (project root, `.claude/CLAUDE.md`, `~/.claude/CLAUDE.md`, managed policy) and loads them hierarchically. The SDK's `systemPrompt` and `settingSources` options control which instructions are loaded. Currently there is no GUI for viewing or managing these files.

### Target State

A dedicated instructions management panel that:
- Displays all loaded CLAUDE.md files with their source level (project, user, global, managed)
- Shows a visual hierarchy indicating precedence and loading order
- Allows viewing file contents with markdown preview
- Allows editing CLAUDE.md files directly (with save)
- Supports creating new CLAUDE.md files at project or user level
- Shows `.claude/rules/` modular instruction files with path-scoping info
- Displays `@path` import resolution
- Integrates with the `/init` command to generate initial CLAUDE.md
- Shows auto-memory files (MEMORY.md) alongside instructions

### Acceptance Criteria

- [ ] Instructions panel is accessible from settings or sidebar
- [ ] All loaded CLAUDE.md files are listed with their level (project, user, global)
- [ ] Visual hierarchy shows loading order and precedence
- [ ] Users can view the contents of any loaded instruction file
- [ ] Users can edit and save project-level CLAUDE.md files
- [ ] Users can edit and save user-level CLAUDE.md (`~/.claude/CLAUDE.md`)
- [ ] Users can create a new CLAUDE.md at the project root if one doesn't exist
- [ ] The `/init` command can be triggered from a button to auto-generate CLAUDE.md
- [ ] `.claude/rules/` files are listed with their path-scoping metadata
- [ ] Changes are reflected in the next SDK query (via `settingSources` or `systemPrompt`)

### Test Requirements

**Unit Tests:**
- Test file discovery logic for CLAUDE.md at each level
- Test hierarchy display ordering (managed > project > user)
- Test markdown rendering of instruction file contents
- Test form validation for CLAUDE.md editing (max 200 lines warning)
- Test rules file parsing with YAML frontmatter `paths` field

**Integration Tests:**
- Test saving a CLAUDE.md file and verifying it persists to disk
- Test that `settingSources: ['project', 'user']` loads the correct files
- Test creating a new CLAUDE.md via the init flow
- Test that edited instructions are picked up by the next `query()` call
- Test rules file path-scoping: verify rules only load for matching file patterns

### Implementation Plan

1. Build a file discovery service that locates all CLAUDE.md files (walk up directory tree from CWD)
2. Build a file discovery service for `.claude/rules/` files with frontmatter parsing
3. Create the instructions hierarchy view component (tree/list with level indicators)
4. Create the instruction file viewer with markdown rendering
5. Create the instruction file editor with save functionality
6. Add "Create CLAUDE.md" button for project root
7. Integrate `/init` command as a "Generate CLAUDE.md" action
8. Add rules file listing with path-scope visualization
9. Wire `settingSources` option to include appropriate levels
10. Add MEMORY.md viewer section for auto-memory entries

### SDK Reference

```typescript
// Setting Sources Option
options: {
  settingSources: ['user', 'project', 'local'],
}

// System Prompt Option
options: {
  systemPrompt: "Custom instructions here",
  // OR
  systemPrompt: {
    type: 'preset',
    preset: 'claude_code',
    append: 'Additional instructions from CLAUDE.md content',
  },
}
```

**CLAUDE.md File Locations:**

| Scope | Location |
|-------|----------|
| Managed | `/Library/Application Support/ClaudeCode/CLAUDE.md` (macOS) |
| Project | `./CLAUDE.md` or `./.claude/CLAUDE.md` |
| User | `~/.claude/CLAUDE.md` |

### Dependencies

- File system access (Tauri fs API)
- Markdown renderer component
- Text editor component (for CLAUDE.md editing)
- Settings panel infrastructure

### Research References

- docs/research/claude-agent-sdk-complete-reference.md (Section 3: Options -- settingSources, systemPrompt)
- docs/research/claude-code-features-complete.md (Section 6: Project Context / Memory System)

---

## Issue #8: Auto-Memory / Persistent Memory Management

- **URL**: https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/8
- **State**: OPEN
- **Labels**: `feature`, `P2-nice-to-have`, `core`, `needs-splitting`, `large`
- **Assignees**: None
- **Comments**: None

### Description

Build a UI for viewing, editing, searching, and managing Claude's auto-memory files that persist learnings across sessions, including the MEMORY.md entrypoint and topic-specific memory files.

### Current State

Claude Code automatically saves learnings across sessions (build commands, debugging insights, architecture notes, code style preferences) to `~/.claude/projects/<project>/memory/`. The SDK supports configuring memory directories via options, but there is no GUI for browsing, editing, or managing these memory entries.

### Target State

A dedicated memory management panel that provides:
- Memory file browser showing all auto-memory entries for the current project
- View and edit MEMORY.md (the entrypoint, first 200 lines loaded at startup)
- View and edit topic-specific memory files
- Add new memory entries manually
- Delete outdated or incorrect memories
- Search across all memory files
- Display which memories are currently active/loaded
- Toggle auto-memory on/off
- Configure custom memory directory
- Per-agent memory viewer for subagent persistent memory

### Acceptance Criteria

- [ ] Memory panel accessible from sidebar or settings
- [ ] MEMORY.md contents are displayed with markdown rendering
- [ ] Topic-specific memory files are listed and viewable
- [ ] Users can edit and save MEMORY.md and topic files
- [ ] Users can add new memory entries (appended to MEMORY.md or new topic file)
- [ ] Users can delete individual memory entries or files
- [ ] Search functionality works across all memory files
- [ ] Active/loaded memories are visually distinguished from unloaded ones
- [ ] Auto-memory toggle switch works (maps to `autoMemoryEnabled` setting)
- [ ] Custom memory directory configuration is available
- [ ] Changes persist to the filesystem immediately

### Test Requirements

**Unit Tests:**
- Test memory file discovery in `~/.claude/projects/<project>/memory/`
- Test MEMORY.md parsing (first 200 lines as entrypoint)
- Test memory entry add/edit/delete operations
- Test search across multiple memory files
- Test auto-memory toggle state management

**Integration Tests:**
- Test that editing MEMORY.md persists to disk and is loaded by the next session
- Test that creating a new topic file appears in the memory browser
- Test that toggling auto-memory off prevents new entries from being saved
- Test that custom `autoMemoryDirectory` setting redirects memory storage
- Test that all worktrees/subdirectories share one auto-memory directory per git repo

### Implementation Plan

1. Build memory file discovery service (scan `~/.claude/projects/<project>/memory/`)
2. Create MEMORY.md parser that understands the entrypoint structure (first 200 lines)
3. Build the memory browser component (file list with content preview)
4. Build the memory viewer with markdown rendering
5. Build the memory editor with save-to-disk functionality
6. Implement "Add Memory" form for creating new entries
7. Implement memory deletion with confirmation
8. Build search functionality across all memory files
9. Add auto-memory toggle wired to `autoMemoryEnabled` setting
10. Add custom memory directory configuration
11. Build per-agent memory viewer (user, project, local scopes)

### SDK Reference

```typescript
// Auto-Memory Configuration
{
  autoMemoryEnabled: boolean,
  autoMemoryDirectory: string,
}

// Memory Storage Locations
// ~/.claude/projects/<project>/memory/
//   MEMORY.md                      -- Entrypoint (first 200 lines loaded at startup)
//   topic-architecture.md          -- On-demand topic file
//   topic-debugging.md             -- On-demand topic file

// Subagent Memory Scopes
// user scope:    ~/.claude/agent-memory/<agent-name>/
// project scope: .claude/agent-memory/<agent-name>/
// local scope:   .claude/agent-memory-local/<agent-name>/

// Environment Variable
// CLAUDE_CODE_DISABLE_AUTO_MEMORY=1  -- Disable auto-memory entirely
```

### Dependencies

- File system access (Tauri fs API for reading/writing memory files)
- Markdown renderer component
- Text editor component
- Search/filter functionality
- Settings persistence for `autoMemoryEnabled`

### Research References

- docs/research/claude-agent-sdk-complete-reference.md (Section 3: Options -- settingSources)
- docs/research/claude-code-features-complete.md (Section 15: Memory / Auto-Memory)
- docs/research/claude-code-features-complete.md (Section 6: Project Context / Memory System)

---

## Issue #10: Hooks System Configuration UI

- **URL**: https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/10
- **State**: OPEN
- **Labels**: `feature`, `P2-nice-to-have`, `sdk-integration`, `needs-splitting`, `large`
- **Assignees**: None
- **Comments**: None

### Description

Build a hooks configuration panel for managing Claude Code's lifecycle hooks (PreToolUse, PostToolUse, Stop, SessionStart, etc.) with a visual editor for hook events, matchers, and command/prompt handlers, plus a real-time hook execution log.

### Current State

The SDK supports hooks via the `hooks` option, and Claude Code reads hook configurations from `settings.json` files. There are 20+ hook event types with command, HTTP, prompt, and agent handler types. Currently there is no GUI for configuring or monitoring hooks.

### Target State

A dedicated hooks management panel that provides:
- Visual hook configuration editor
- Hook event type selector with descriptions of when each event fires
- Matcher pattern editor (regex for matching tool names, agent types, etc.)
- Handler type selector (command, HTTP, prompt, agent) with appropriate input fields
- Enable/disable individual hooks without deleting them
- Hook execution log showing real-time hook activity during sessions
- Hook testing capability (dry-run a hook against a sample event)
- Visual indicator of which hooks are currently active
- Import/export hook configurations

### Acceptance Criteria

- [ ] Hooks panel accessible from settings
- [ ] All hook event types are listed with descriptions of when they fire
- [ ] Users can create a new hook by selecting event type, matcher, and handler
- [ ] Command-based hooks have fields for command string and timeout
- [ ] HTTP-based hooks have fields for URL, method, and headers
- [ ] Prompt-based hooks have a text area for the prompt template
- [ ] Agent-based hooks have configuration for model and tool access
- [ ] Individual hooks can be enabled/disabled with a toggle
- [ ] Hook execution log shows hook name, event, timing, and result in real-time
- [ ] Hook configurations are saved to `.claude/settings.json` or `.claude/settings.local.json`
- [ ] Existing hooks from settings files are loaded and displayed
- [ ] "Can Block" indicator shows which hook events support blocking decisions

### Hook Events Reference

| Event | When It Fires | Can Block? |
|-------|--------------|------------|
| `SessionStart` | Session starts or resumes | No |
| `SessionEnd` | Session ends | No |
| `InstructionsLoaded` | CLAUDE.md or rules loaded | No |
| `UserPromptSubmit` | User submits prompt | Yes |
| `PreToolUse` | Before tool execution | Yes (allow/deny/ask) |
| `PermissionRequest` | Permission dialog appears | Yes (allow/deny) |
| `PostToolUse` | Tool completes successfully | Yes |
| `PostToolUseFailure` | Tool execution fails | No |
| `Notification` | Notification sent | No |
| `SubagentStart` | Subagent spawned | No |
| `SubagentStop` | Subagent finishes | Yes (approve/block) |
| `Stop` | Claude finishes responding | Yes (approve/block) |
| `TeammateIdle` | Agent teammate going idle | Yes |
| `TaskCompleted` | Task marked complete | Yes |
| `ConfigChange` | Configuration changes | Yes |
| `WorktreeCreate` | Worktree being created | Yes |
| `WorktreeRemove` | Worktree being removed | No |
| `PreCompact` | Before context compaction | No |
| `PostCompact` | After context compaction | No |
| `Elicitation` | MCP server requests input | Yes |
| `ElicitationResult` | User responds to elicitation | Yes |

### Test Requirements

**Unit Tests:**
- Test hook configuration form validation (required fields per handler type)
- Test matcher pattern validation (valid regex)
- Test hook enable/disable state toggling
- Test hook configuration serialization to settings.json format
- Test hook event type metadata (which events can block, which support matchers)

**Integration Tests:**
- Test creating a PreToolUse command hook and verifying it appears in SDK options
- Test that disabled hooks are not passed to the SDK `hooks` option
- Test hook execution log receives SDKHookStartedMessage and SDKHookResponseMessage events
- Test saving hook config to `.claude/settings.json` and verifying it persists
- Test loading existing hooks from settings files on panel open

### Implementation Plan

1. Define hook event metadata (all 20+ events with descriptions, matcher support, blocking capability)
2. Build the hook list component showing configured hooks grouped by event type
3. Build the "Add Hook" wizard with event selector, matcher input, and handler configuration
4. Implement command handler editor (command input, timeout slider, env vars)
5. Implement HTTP handler editor (URL, method, headers, body template)
6. Implement prompt handler editor (prompt text area with variable placeholders)
7. Implement agent handler editor (model selector, tool access config)
8. Build the hook enable/disable toggle with immediate settings file update
9. Build the hook execution log component (fed by SDK hook lifecycle events)
10. Wire hook configurations into the SDK `hooks` option
11. Implement hook config persistence to `.claude/settings.json`
12. Add hook deletion with confirmation dialog

### SDK Reference

```typescript
// Hooks SDK Option
options: {
  hooks: {
    PreToolUse: [
      {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            command: "bash ./hooks/scan-secrets.sh",
            timeout: 30,
          },
        ],
      },
    ],
    Stop: [
      {
        matcher: "*",
        hooks: [
          {
            type: "prompt",
            prompt: "Verify all tasks complete. Return 'approve' or 'block'.",
            timeout: 30,
          },
        ],
      },
    ],
  },
}

// Hook Decision Outputs
// PreToolUse: { permissionDecision: "allow" | "deny" | "ask", updatedInput?, systemMessage? }
// Stop/SubagentStop: { decision: "approve" | "block", reason: string }

// Hook Lifecycle SDK Events
// SDKHookStartedMessage   -- A hook has begun executing
// SDKHookProgressMessage  -- Hook execution progress
// SDKHookResponseMessage  -- Hook returned a result
```

### Dependencies

- SDK `hooks` option support (available)
- SDK hook lifecycle events: SDKHookStartedMessage, SDKHookProgressMessage, SDKHookResponseMessage
- Settings file read/write (`.claude/settings.json`)
- Settings panel infrastructure

### Research References

- docs/research/claude-agent-sdk-complete-reference.md (Section 8: Hooks and Lifecycle Events)
- docs/research/claude-code-features-complete.md (Section 12: Hooks System)

---

## Issue #12: Agent Teams: Multi-Agent Workspace UI with Message Flow

- **URL**: https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/12
- **State**: OPEN
- **Labels**: `feature`, `P2-nice-to-have`, `frontend`, `blocked`, `large`
- **Assignees**: None
- **Comments**: None

### Description

Claude Code supports multi-agent teams where agents work in parallel and communicate with each other across separate sessions. The GUI needs a workspace view that shows team creation, teammate status, message flow visualization, task assignment, and shutdown controls.

### Current State

No agent team UI exists. The application has no concept of multiple coordinating agents, teammate status, or inter-agent message passing. All interaction is with a single chat session.

### Target State

A multi-agent workspace that provides:
- Team creation interface (define agents, their roles, tools, models)
- Teammate status display (active/idle/stopped) with real-time updates
- Message flow visualization showing communication between agents
- Task assignment board showing which agent handles which task
- Team shutdown controls (individual agent stop, full team teardown)
- Display mode selector (auto/in-process/tmux)

### Acceptance Criteria

- [ ] Team creation UI allows defining multiple agents with name, description, tools, model
- [ ] Each teammate shows real-time status (active/idle/stopped)
- [ ] Message flow visualization shows directional communication between agents
- [ ] Task assignment board maps tasks to agents with status
- [ ] Individual agent stop button works correctly
- [ ] Full team shutdown button terminates all agents
- [ ] `TeammateIdle` hook events update the UI
- [ ] Display mode selector allows switching between auto/in-process/tmux
- [ ] Team workspace coexists with main chat interface (split pane or tabs)

### Test Requirements

**Unit Tests:**
- TeamCreation component validates agent definitions
- TeammateCard renders correct status indicators
- MessageFlowGraph builds correct adjacency from events
- TaskBoard correctly assigns and tracks tasks per agent
- ShutdownControls trigger correct stop methods
- DisplayModeSelector updates teammateMode setting

**Integration Tests:**
- Full team lifecycle: create team -> agents activate -> agents communicate -> team shuts down
- TeammateIdle event triggers UI status update
- Stopping one agent does not affect others
- Team creation persists agent definitions correctly
- Message flow updates in real-time as agents communicate

### Implementation Plan

1. Design team workspace layout (split-pane with agent cards + central message flow)
2. Build `TeamCreationDialog` with agent definition forms
3. Build `TeammateCard` component showing agent name, model, tools, status
4. Build `MessageFlowGraph` component using a graph/network visualization
5. Build `TaskAssignmentBoard` showing task-to-agent mapping
6. Integrate `TeammateIdle` hook event handling
7. Implement individual and bulk shutdown controls
8. Add display mode selector (auto/in-process/tmux)
9. Wire team state to backend agent management endpoints
10. Add team workspace toggle in main navigation

### SDK Reference

```typescript
// Agent team configuration
options: {
  agents: {
    'researcher': {
      name: 'researcher',
      description: 'Research agent',
      tools: ['Read', 'Grep', 'Glob'],
      permissionMode: 'dontAsk',
    },
    'coder': {
      name: 'coder',
      description: 'Code writing agent',
      tools: ['Read', 'Write', 'Edit', 'Bash'],
      permissionMode: 'acceptEdits',
    },
  },
}

// Teammate settings (settings.json)
{
  "teammateMode": "auto" | "in-process" | "tmux"
}

// Relevant hook events:
// TeammateIdle -- fires when a teammate agent goes idle
// SubagentStart -- fires when a subagent spawns
// SubagentStop -- fires when a subagent finishes

// SDK init message includes agents:
// SDKSystemMessage.agents?: string[]
```

### Dependencies

- Subagent visualization panel should be built first as foundation
- Backend must support multi-agent session management
- Graph visualization library needed (e.g., react-flow, d3-force)

### Blockers

This issue is labeled `blocked` -- it depends on subagent visualization infrastructure being built first.

### Research References

- docs/research/claude-agent-sdk-complete-reference.md (Section 14: Subagent Definitions, Section 3: Options)
- docs/research/claude-code-features-complete.md (Section 23: Agent Teams)

---

## Issue #26: Checkpointing & Rewind: File Change History with One-Click Restore

- **URL**: https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/26
- **State**: OPEN
- **Labels**: `feature`, `P2-nice-to-have`, `frontend`, `blocked`, `large`
- **Assignees**: None
- **Comments**: None

### Description

Claude Code automatically checkpoints file changes before each edit and supports rewinding to previous states. The GUI needs a checkpoint timeline, diff views between checkpoints, and one-click rewind to any previous state using the SDK's `rewindFiles()` method.

### Current State

No checkpointing or rewind UI exists. Claude Code's SDK supports `query.rewindFiles(userMessageId)` but the GUI has no way to visualize checkpoints, view diffs between states, or trigger rewind operations.

### Target State

A checkpoint system that:
- Shows a timeline of checkpoints (one per user prompt)
- Displays file changes at each checkpoint (files modified, created, deleted)
- Provides diff view between any two checkpoints
- Offers three rewind modes: restore code+conversation, restore conversation only, restore code only
- Supports summarize-from-here as an alternative to full rewind
- Dry run mode to preview what would change before committing

### Acceptance Criteria

- [ ] Checkpoint timeline displays after the first file modification
- [ ] Each checkpoint shows: user prompt text, timestamp, files changed
- [ ] Clicking a checkpoint shows the file diff at that point
- [ ] Diff view between any two checkpoints works correctly
- [ ] "Restore code and conversation" rewinds both to selected checkpoint
- [ ] "Restore conversation only" rewinds messages but keeps current files
- [ ] "Restore code only" reverts files but keeps conversation history
- [ ] Dry run preview shows what files would change before committing
- [ ] "Summarize from here" compresses messages from checkpoint forward
- [ ] Checkpoint state persists across page reloads within a session
- [ ] Warning shown when rewind would discard significant work

### Test Requirements

**Unit Tests:**
- CheckpointTimeline renders correct number of checkpoints
- CheckpointCard shows correct file change summary
- DiffViewer displays correct before/after content
- RewindDialog shows correct mode options
- Dry run result displays correctly without applying changes
- Summarize action triggers compact with correct instructions

**Integration Tests:**
- Full workflow: edit files -> create checkpoints -> rewind -> verify state
- Rewind code+conversation restores both correctly
- Rewind conversation only keeps files intact
- Rewind code only keeps message history
- Dry run matches actual rewind results
- Multiple sequential rewinds work correctly

### Implementation Plan

1. Create `CheckpointTimeline` component showing chronological checkpoints
2. Create `CheckpointCard` component with file change summary
3. Build diff viewer for comparing checkpoint states
4. Implement rewind dialog with mode selection (code+conversation, conversation only, code only)
5. Wire `query.rewindFiles(userMessageId, { dryRun: true })` for preview
6. Wire `query.rewindFiles(userMessageId)` for actual rewind
7. Track checkpoint state from `SDKAssistantMessage` tool_use blocks (Edit/Write)
8. Implement summarize-from-here via compact with checkpoint reference
9. Add keyboard shortcut (Esc+Esc equivalent) to open rewind menu
10. Add persistence layer for checkpoint metadata within session

### SDK Reference

```typescript
// Rewind method on Query object
interface Query {
  rewindFiles(
    userMessageId: string,
    options?: { dryRun?: boolean }
  ): Promise<RewindFilesResult>;
}

// User messages have UUIDs that serve as checkpoint IDs
type SDKUserMessage = {
  type: "user";
  uuid?: UUID;  // This is the userMessageId for rewindFiles()
};

// Tool use blocks indicate file changes (Edit, Write, MultiEdit)
type ToolUseBlock = {
  type: "tool_use";
  name: "Edit" | "Write" | "MultiEdit";
  input: { file_path: string; /* ... */ };
};

// Files persisted event
type SDKFilesPersistedEvent = { type: "files_persisted"; };
```

### Dependencies

- SDK streaming must expose `rewindFiles()` method via backend API
- Chat state must track user message UUIDs for checkpoint identification
- File change tracking from tool_use blocks must be accumulated per turn
- Diff rendering library for file comparison views

### Blockers

This issue is labeled `blocked` -- it depends on core SDK streaming infrastructure.

### Research References

- docs/research/claude-agent-sdk-complete-reference.md (Section 2: Query methods - rewindFiles())
- docs/research/claude-code-features-complete.md (Section 18: Checkpointing / Rewind)

---

## Issue #31: Status Bar: Comprehensive VS Code-Style Bottom Status Bar

- **URL**: https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/31
- **State**: OPEN
- **Labels**: `feature`, `P2-nice-to-have`, `frontend`, `needs-splitting`, `large`
- **Assignees**: None
- **Comments**: None

### Description

Build a comprehensive status bar at the bottom of the window (styled like VS Code) showing current model, permission mode, git branch, context usage, connection status, active tools/agents, and turn duration timer.

### Current State

No persistent status bar exists. Critical session information (model, permission mode, git branch, connection status) is not visible at a glance. Users must use slash commands like `/status`, `/cost`, or `/context` to check this information.

### Target State

A bottom-anchored status bar with segmented sections showing:
- **Left**: Current model name + effort level, permission mode indicator, git branch with PR status
- **Center**: Turn duration timer (while Claude is working), active tool name
- **Right**: Context usage percentage, connection status indicator, active agent count, cost ticker
- Click interactions: model selector on model click, mode cycling on permission click, etc.
- Color-coded segments (e.g., green for connected, yellow for rate-limited, red for error)

### Acceptance Criteria

- [ ] Status bar fixed at bottom of window, always visible
- [ ] Current model displayed with effort level (e.g., "Sonnet 4.6 | high")
- [ ] Permission mode indicator shows current mode (Normal/Auto-Accept/Plan)
- [ ] Git branch name displayed, updates on branch change
- [ ] Context usage shown as percentage with color gradient (green -> yellow -> red)
- [ ] Connection status: green dot when connected, red when disconnected
- [ ] Turn duration timer appears and counts while Claude is generating
- [ ] Active tool name shown while a tool is executing
- [ ] Active agent count badge when subagents are running
- [ ] Clicking model opens model selector
- [ ] Clicking permission mode cycles through modes
- [ ] Clicking context usage opens detailed context panel
- [ ] Responsive: hides less important items on narrow windows

### Test Requirements

**Unit Tests:**
- StatusBar renders all segments with correct initial data
- ModelSegment displays correct model name and effort level
- PermissionModeSegment shows correct mode text and icon
- GitBranchSegment displays branch name
- ContextUsageSegment calculates correct color for given percentage
- ConnectionIndicator shows correct state for connected/disconnected
- TurnTimer starts/stops/resets correctly
- ActiveToolDisplay shows and hides with tool execution

**Integration Tests:**
- Model change via SDK updates status bar immediately
- Permission mode change reflects in status bar
- Git branch change (checkout) updates the display
- Context compaction resets context usage percentage
- Connection loss changes indicator to red
- Turn timer accurately tracks generation duration
- Clicking model segment opens model selector dialog
- Status bar responsive behavior at different window widths

### Implementation Plan

1. Create `StatusBar` container component with left/center/right sections
2. Create `ModelSegment` showing model name + effort level from SDK init
3. Create `PermissionModeSegment` with mode text and click-to-cycle
4. Create `GitBranchSegment` reading branch via Tauri command
5. Create `ContextUsageSegment` with color-coded percentage bar
6. Create `ConnectionIndicator` with green/red dot
7. Create `TurnTimer` that starts on user prompt and stops on result
8. Create `ActiveToolDisplay` showing current tool name during execution
9. Create `AgentCountBadge` showing active subagent count
10. Add click handlers for interactive segments (model picker, mode cycling)
11. Implement responsive behavior (priority-based item hiding)
12. Style to match VS Code status bar aesthetic (compact, colored segments)

### SDK Reference

```typescript
// Init message provides initial status bar data
type SDKSystemMessage = {
  type: "system";
  subtype: "init";
  model: string;
  permissionMode: PermissionMode;
  tools: string[];
  mcp_servers: { name: string; status: string }[];
  agents?: string[];
};

// Control methods for interactive segments
await query.setModel('opus');
await query.setPermissionMode('acceptEdits');
const models = await query.supportedModels();

// Events for status updates
type SDKResultMessage = { duration_ms: number; };
type SDKRateLimitEvent = { type: "rate_limit"; };
type SDKCompactBoundaryMessage = { type: "system"; subtype: "compact_boundary"; };
```

### Dependencies

- Git branch detection via Tauri sidecar or shell command
- SDK init event provides initial model, permission mode, tools
- SDK result/stream events provide turn timing and cost data
- Context usage calculation from token counts
- Model picker dialog (may be built separately)

### Research References

- docs/research/claude-agent-sdk-complete-reference.md (Section 2: Query methods, Section 4: SDKSystemMessage init)
- docs/research/claude-code-features-complete.md (Section 9: Status Line, Progress Indicators)

---

## Summary Table

| Issue | Title | Labels | Blocked? |
|-------|-------|--------|----------|
| #1 | MCP Server Configuration UI | feature, P2, sdk-integration, needs-splitting, large | No |
| #2 | CLAUDE.md / Project Instructions Management | feature, P2, frontend, needs-splitting, large | No |
| #8 | Auto-Memory / Persistent Memory Management | feature, P2, core, needs-splitting, large | No |
| #10 | Hooks System Configuration UI | feature, P2, sdk-integration, needs-splitting, large | No |
| #12 | Agent Teams: Multi-Agent Workspace UI | feature, P2, frontend, blocked, large | Yes |
| #26 | Checkpointing & Rewind | feature, P2, frontend, blocked, large | Yes |
| #31 | Status Bar (VS Code-Style) | feature, P2, frontend, needs-splitting, large | No |

### Common Patterns Across Issues

- **All 7 issues** are labeled `feature` and `P2-nice-to-have`
- **All 7 issues** are labeled `large` -- every one is a significant effort
- **5 of 7** are labeled `needs-splitting` -- they need to be broken into smaller sub-issues before implementation
- **2 of 7** are labeled `blocked` (#12 Agent Teams and #26 Checkpointing) -- they have dependencies on other work
- **None** have assignees or milestones
- **None** have any comments
- All share common dependencies on settings panel infrastructure, file system access via Tauri, and SDK integration patterns
