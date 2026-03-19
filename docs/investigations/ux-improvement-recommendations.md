# UX Improvement Recommendations

**Date:** 2026-03-18
**Sources:** Full codebase walkthrough (204 frontend files) + Gemini 2.5 Pro analysis
**Status:** Research / Proposal

---

## Executive Summary

The application has a strong technical foundation and an impressive feature set spanning chat, workspaces (git worktrees), and multi-agent teams. However, the current information architecture creates significant friction: dual sidebar swapping breaks spatial consistency, 13 settings tabs overwhelm users, and powerful features like command workflows, checkpoints, and dashboards are buried behind multiple layers of navigation. This document proposes 10 targeted improvements, prioritized by impact and effort, that would transform the app from a capable-but-complex tool into an intuitive desktop experience.

---

## Current UX Assessment

### What Works Well

1. **Inline permission dialogs** -- Permission requests appear in the message flow itself rather than as modal interrupts. This is a genuinely good pattern that respects the user's context while keeping security visible. See `PermissionDialog.test.tsx`.

2. **Contextual error banner** -- `ErrorBanner.tsx` uses distinct visual styles (red for API/auth, amber for rate limits, blue for network) with appropriate actions (Retry for retryable errors, "Reconnecting..." for network). This is better error communication than most chat apps.

3. **Streaming with tool visibility** -- Tool calls (bash, file read/write, grep, web search) are rendered inline as collapsible blocks with live status indicators. The gen-ui registry pattern (`components/chat/gen-ui/registry.ts`) is extensible and well-architected.

4. **Welcome screen** -- `WelcomeScreen.tsx` is clean and focused: logo, tagline, single CTA button with keyboard shortcut hint. No unnecessary onboarding friction.

5. **Workspace git integration** -- `ProjectSidebar.tsx` shows live git status per workspace (staged/uncommitted file counts, clean indicator), branch names with copy buttons, and inline rename. This is genuinely useful for multi-worktree workflows.

6. **Command palette with fuzzy search** -- `CommandPalette.tsx` groups commands by category (Chat, Navigation, Tools), supports keyboard navigation (arrow keys, Enter, Escape), shows scroll hints, and uses relevance-ranked fuzzy matching via `commandSearch.ts`.

7. **Onboarding screen** -- `OnboardingScreen.tsx` provides clear, step-by-step instructions for connecting to the Claude CLI. Targeted and well-scoped for the developer audience.

### Core Problems

**1. Navigation Confusion (Critical)**
The app swaps the entire 280px sidebar between `SessionSidebar.tsx` and `ProjectSidebar.tsx` when switching views. The view toggle tabs (Chat / Workspaces / Teams) are duplicated across three separate components -- `SessionSidebar.tsx` (lines 51-84), `ProjectSidebar.tsx` (lines 146-177), and an inline div in `App.tsx` (lines 319-345) for the Teams view. This means the navigation chrome itself is inconsistent across views.

**2. Settings Overload (High)**
`SettingsPanel.tsx` defines 13 tabs: General, Git, Model, Workflows, Appearance, Notifications, Instructions, Memory, MCP, Linear, Hooks, Advanced, Status. The tab bar wraps or requires compact density mode (`tabDensity` setting) to fit. Users cannot scan this many options efficiently. Tests (`SettingsTabsOverflow.test.tsx`) confirm the overflow issue was significant enough to need its own test.

**3. Feature Discoverability (High)**
The command palette is only discoverable through subtle placeholder text `(/ for commands)`. Workflows (`/review`, `/pr`, `/compact`) are invisible to users who never type `/`. Checkpoints only appear after file-modifying turns. Dashboards require navigating to Workspaces > Project > Workspace > Dashboards tab -- four levels deep from the default Chat view.

---

## Detailed Recommendations

### 1. Unified Navigation (Activity Bar)

- **Problem**: The dual sidebar swap violates spatial consistency. When users click "Workspaces," the entire sidebar -- including the UserBadge, search, and session list -- is replaced by a completely different component (`ProjectSidebar.tsx`) with different content and controls. The view toggle tabs are copy-pasted across three locations (`SessionSidebar.tsx:51-84`, `ProjectSidebar.tsx:146-177`, `App.tsx:319-345`), each with identical but independently maintained markup. Users lose their mental anchor when the sidebar morphs.

- **Solution**: Adopt a persistent Activity Bar on the far left, inspired by VS Code. This thin vertical bar (48px wide) contains icon buttons for each view. The sidebar content area (280px) changes based on the selected activity, but the Activity Bar itself never changes. This gives users a fixed spatial reference point.

- **Visual concept**:
```
 Current Layout:
 ┌──────────────────────────────────────────────────┐
 │ [Chat|Workspaces|Teams]  tabs (in sidebar)       │
 │┌────────────────┐┌──────────────────────────────┐│
 ││  SessionSidebar││                              ││
 ││  (swaps to     ││       Main Content           ││
 ││  ProjectSidebar││                              ││
 ││  or inline div)││                              ││
 │└────────────────┘└──────────────────────────────┘│
 │[StatusBar                                       ]│
 └──────────────────────────────────────────────────┘

 Proposed Layout:
 ┌──────────────────────────────────────────────────┐
 │┌──┐┌────────────────┐┌────────────────────────┐ │
 ││  ││                ││                        │ │
 ││A ││  Sidebar Panel ││     Main Content       │ │
 ││c ││  (changes by   ││                        │ │
 ││t ││   activity)    ││                        │ │
 ││i ││                ││                        │ │
 ││v ││                ││                        │ │
 ││i ││                ││                        │ │
 ││t ││                ││                        │ │
 ││y ││                ││                        │ │
 ││  ││                ││                        │ │
 ││B ││                ││                        │ │
 ││a ││                ││                        │ │
 ││r ││                ││                        │ │
 ││  ││                ││                        │ │
 ││48││     280px      ││       flex-1           │ │
 │└──┘└────────────────┘└────────────────────────┘ │
 │[StatusBar                                       ]│
 └──────────────────────────────────────────────────┘

 Activity Bar (48px):
 ┌──┐
 │💬│  Chat
 │📁│  Workspaces
 │👥│  Teams
 │  │
 │  │  (spacer)
 │  │
 │⚙️│  Settings
 │👤│  User Badge
 └──┘
```

- **Implementation notes**:
  - Create a new `ActivityBar.tsx` component (48px wide, fixed left)
  - Remove the duplicated view toggle tabs from `SessionSidebar.tsx`, `ProjectSidebar.tsx`, and `App.tsx`
  - Move `UserBadge` from `SessionSidebar.tsx` (line 87) to the bottom of the Activity Bar
  - Move the settings gear button from `SessionSidebar.tsx` (lines 88-109) to the Activity Bar
  - The `activeView` state in `App.tsx` (line 87) stays, but is now driven by Activity Bar clicks instead of inline tabs
  - The sidebar rendering logic in `App.tsx` (lines 276-345) simplifies -- always render a sidebar, just change its content

- **Effort**: High (new component, refactor three existing components, adjust all layout tests)
- **Impact**: High (fixes the single most disorienting UX issue)

---

### 2. Settings Reorganization

- **Problem**: 13 tabs in `SettingsPanel.tsx` (lines 40-54) is too many for users to scan. The flat list mixes high-frequency settings (Model, Appearance) with rarely-changed configuration (MCP, Hooks, Linear). The `SettingsTabsOverflow.test.tsx` test file exists specifically because the tabs overflow their container.

- **Solution**: Group the 13 tabs into 5 logical categories. Each category becomes a top-level section, with the former tabs becoming sub-sections within each.

- **Proposed grouping**:

| Current Tab | Proposed Group | Rationale |
|---|---|---|
| General | **General** | Universal settings (default session title, tab density) |
| Appearance | **General** | Theme, font size, UI density -- basic preferences |
| Notifications | **General** | Alert preferences are general user prefs |
| Model | **AI & Model** | Core AI configuration |
| Advanced | **AI & Model** | Permission mode, thinking budget, privacy -- all AI behavior |
| Workflows | **AI & Model** | Workflow prompts (/review, /pr) are AI-related |
| Git | **Integrations** | External tool integration |
| Linear | **Integrations** | External service integration |
| Instructions | **Data & Context** | Custom instructions for Claude |
| Memory | **Data & Context** | Persistent memory management |
| MCP | **Data & Context** | Model Context Protocol servers |
| Hooks | **Data & Context** | Event hooks and automation |
| Status | **Status** | Runtime info (session, tools, MCP servers) |

This reduces the top-level scan from 13 items to 5: **General, AI & Model, Integrations, Data & Context, Status**.

- **Implementation notes**:
  - Change `TabId` type in `SettingsPanel.tsx` (line 25) to use group IDs
  - Each group renders as an accordion or scrollable section with its sub-tabs
  - Consider using a left-sidebar navigation within the settings panel instead of top tabs
  - Update `SettingsPanel.test.tsx` and `SettingsTabsOverflow.test.tsx`
  - The `onOpenSettings('advanced')` calls from `StatusBar.tsx` (lines 280, 313) need mapping to the new group

- **Effort**: Medium
- **Impact**: High

---

### 3. Feature Discovery System

- **Problem**: The app's most powerful features are invisible to users who don't already know about them:
  - Command palette: only hinted at via placeholder text `(/ for commands)` in the chat input
  - Workflows (`/review`, `/pr`, `/compact`): completely hidden behind the command palette
  - Checkpoints: `CheckpointTimeline.tsx` only renders when checkpoints exist
  - Dashboards: buried at Workspaces > Project > Workspace > Dashboards tab (4 levels deep)
  - Keyboard shortcuts: discoverable only through the help modal or accidentally

- **Solution**: Implement a lightweight discovery system with three components:

- **Specific actions**:
  1. **Add a `/` button next to the chat input** -- a small icon that opens the command palette on click. Currently the palette is only triggered by typing `/` at the start of a message. An explicit clickable affordance makes it visible.
  2. **Show a "tip" banner on first launch** -- After the first successful chat message, show a dismissible tip: "Pro tip: Type / to access commands like /review, /pr, and /compact." Store dismissal in settings.
  3. **Surface Dashboards outside Workspaces** -- Add a "Dashboards" entry to the command palette (`useCommands.ts`) that opens the most recent workspace's dashboards tab or prompts workspace creation.
  4. **Checkpoint awareness indicator** -- When checkpoints are available but the timeline is collapsed, show a small badge or icon in the chat header area indicating "N checkpoints available."
  5. **Add keyboard shortcut hints to buttons** -- The WelcomeScreen already shows `Cmd+N` on the button. Extend this pattern to other key actions (settings gear should show `Cmd+,`, etc.).

- **Effort**: Low-Medium (mostly additive, no restructuring)
- **Impact**: High

---

### 4. Workspace Onboarding Wizard

- **Problem**: Creating a workspace requires multiple disconnected steps:
  1. Switch to the "Workspaces" view (may require discovering the view tabs first)
  2. Click "Add Project" to open `AddProjectDialog.tsx`
  3. Enter a repository path and submit
  4. The project appears; click the "+" button to open `CreateWorkspaceDialog.tsx`
  5. Choose a mode (Manual / Branch / GitHub Issue), fill in fields, submit

  This is a 5-step flow spread across 2 separate dialogs and a sidebar interaction. For new users encountering Workspaces for the first time, it is unclear why steps 2-3 (adding a project) are separate from steps 4-5 (creating a workspace).

- **Solution**: Create a single `WorkspaceWizard.tsx` component that combines the project selection and workspace creation into one guided flow.

- **Wizard steps**:
  1. **Select or add project** -- Show existing projects as selectable cards. Include an "Add new project" option with an inline path input. If only one project exists, pre-select it.
  2. **Choose creation mode** -- The three modes from `CreateWorkspaceDialog.tsx` (Manual, Branch, GitHub Issue) presented as large, descriptive cards instead of small tabs.
  3. **Configure workspace** -- Mode-specific fields (name, branch, issue search). Auto-fill where possible (already done well in the current dialog).
  4. **Confirm & create** -- Summary of what will happen: "Create workspace 'my-feature' from branch 'main' in project 'claude-tauri-boilerplate'."

  The wizard would replace the "+" button in `ProjectSidebar.tsx` and the "Add Project" button. Both `AddProjectDialog.tsx` and `CreateWorkspaceDialog.tsx` can be kept as standalone components for power users who want quick access.

- **Effort**: Medium (new component, but reuses existing dialog internals)
- **Impact**: High (workspace creation is the gateway to the app's most powerful feature)

---

### 5. Status Bar Simplification

- **Problem**: `StatusBar.tsx` displays up to 11 simultaneous pieces of information across three sections:
  - Left: ModelSegment, PermissionModeSegment, PrivacyModeIndicator, GitBranchSegment, ConnectionIndicator
  - Center: TurnTimer, ActiveToolDisplay, AgentCountBadge
  - Right: ResourceUsageSegment, ContextUsageSegment, CostSegment

  While each item is individually useful, the combined density is high. Some items (CPU/Memory, Privacy indicator) are conditional, but when everything is active, the status bar becomes a wall of tiny text.

- **Solution**: Apply progressive disclosure and grouping:

  1. **Group related items**: Combine CPU + Memory into a single "System" indicator that expands on hover/click.
  2. **Make more items conditional**: The TurnTimer (line 512) already only shows during streaming. Apply the same pattern: hide CostSegment when cost is $0.00 (already done at line 58), hide GitBranchSegment when not in a git repo, hide PermissionModeSegment when set to "Normal" (the default).
  3. **Truncate aggressively**: The model name is truncated to `max-w-[120px]` (line 207) and branch to `max-w-[100px]` (line 390). Consider whether these maximums are too generous for narrow windows.
  4. **Consider a hover panel**: On hover/click of any status bar section, show a small popover with the full details. The model picker already does this well (lines 223-258).

- **Proposed layout**:
```
 Current StatusBar (everything visible):
 [Model v] [Perms] [Privacy] [Branch] [●] | [0:42] [Running: Bash] [3] | [CPU 12%] [MEM 340MB] [████ 67%] [$0.42]

 Proposed StatusBar (simplified defaults):
 [Model v] [Branch] [●]                   | [0:42] [Running: Bash]      |              [████ 67%] [$0.42]
                                               (center only when active)    (hover for CPU/MEM detail)
```

- **Effort**: Low (mostly CSS changes and conditional rendering tweaks)
- **Impact**: Medium

---

### 6. Enhanced Empty States

- **Problem**: Several views have weak empty states that tell users what is missing but do not guide them toward the next action:
  - `SessionSidebar.tsx` (line 141): `"No conversations yet"` -- plain text, no CTA
  - `ProjectSidebar.tsx` (line 191): `"No projects yet"` -- plain text, no CTA
  - `ProjectSidebar.tsx` (line 276): `"No workspaces"` -- plain text, even smaller
  - `TeamsView.tsx` (lines 56-61): `"No teams yet"` with a sub-line, but the "New Team" button is in the header, far from the message
  - `App.tsx` (lines 376-380): Workspace main area shows `"Select a workspace or create one to get started"` -- no actionable button

- **Solution**: Every empty state should include:
  1. A descriptive illustration or icon (does not need to be complex -- even a simple SVG adds warmth)
  2. A brief explanation of what the feature does (1 sentence)
  3. A primary action button that performs the most logical next step

- **Specific states to improve**:

| Location | Current | Proposed |
|---|---|---|
| `SessionSidebar.tsx` sessions list | "No conversations yet" | Icon + "Start your first conversation with Claude" + [New Chat] button |
| `ProjectSidebar.tsx` projects list | "No projects yet" | Icon + "Add a project to start working with git worktrees" + [Add Project] button |
| `ProjectSidebar.tsx` workspaces list | "No workspaces" | "Create a workspace to start coding" + [+] button |
| `TeamsView.tsx` teams list | "No teams yet" + description | Move the "New Team" button into the empty state as a prominent CTA |
| `App.tsx` workspace main area | "Select a workspace or create one" | Add an [Add Project] button and brief explanation |

- **Effort**: Low (each is a small component change)
- **Impact**: Medium

---

### 7. Session/Workspace Clarity

- **Problem**: The app has two distinct concepts that may confuse users:
  - **Sessions** (in the Chat view): standalone chat conversations stored in SQLite, managed by `useSessions.ts`
  - **Workspaces** (in the Workspaces view): git worktrees with an embedded chat session, managed by `useWorkspaces.ts` and backed by `workspace-api.ts`

  Users switching from "Chat" to "Workspaces" may not understand why there are two different places to chat, or what the difference is. The workspace chat (`WorkspacePanel.tsx` line 370) renders the same `ChatPage` component as the main Chat view, further blurring the distinction.

- **Solution**:
  1. **Add a brief tooltip or info icon** next to each view tab explaining the distinction:
     - Chat: "Standalone conversations. Quick questions, brainstorming, and one-off tasks."
     - Workspaces: "Git worktree-isolated coding environments. Each workspace has its own branch, diff view, and persistent chat."
  2. **Rename "Chat" to "Sessions"** in the view tabs to make the contrast clearer. "Sessions" implies a log; "Workspaces" implies an environment.
  3. **Add a "What are Workspaces?" link** to the empty state in the Workspaces view that opens a brief in-app explanation or points to documentation.
  4. **Consider showing workspace context in the chat** -- When chatting inside a workspace, display the workspace name and branch in the chat header so users always know which context they are in. `WorkspacePanel.tsx` already has this in the header (line 213), but it could be more prominent.

- **Effort**: Low-Medium
- **Impact**: Medium

---

### 8. Chat Message Differentiation

- **Problem**: User and assistant messages in the chat use the same basic layout. While the message content differs (user messages are shorter, assistant messages have tool calls and markdown), the visual containers are not strongly differentiated. This can make long conversations harder to scan. Both `ChatPage.tsx` and the underlying message rendering use similar styling for both roles.

- **Solution**: Apply subtle but consistent visual differentiation:
  1. **Background color**: User messages get a slightly different background (e.g., `bg-muted/30`) compared to assistant messages (default background).
  2. **Alignment**: Consider right-aligning user messages or adding a left-side color bar (similar to Slack quotes) to assistant messages.
  3. **Avatar or role indicator**: Add a small icon or label (a user icon for user messages, the Claude diamond for assistant messages) in the message header.
  4. **Spacing**: Slightly more vertical spacing between message groups (user + response) than within them.

- **Implementation notes**:
  - These changes affect the message rendering in `ChatPage.tsx` and related message display components
  - Keep the differentiation subtle -- heavy visual distinction (like chat bubbles) conflicts with the developer-tool aesthetic
  - Dark theme colors for differentiation: user messages could use `bg-primary/5`, assistant messages stay on `bg-background`

- **Effort**: Low
- **Impact**: Low-Medium

---

### 9. Dialog Improvements

- **Problem**: Dialogs like `CreateWorkspaceDialog.tsx`, `WorkspaceMergeDialog.tsx`, and `AddProjectDialog.tsx` are functional but text-heavy. The create workspace dialog has three tabbed modes, each with multiple fields and explanatory text. There are no visual cues (icons, illustrations) to help users orient quickly when a dialog opens.

- **Solution**: Add lightweight visual improvements to dialogs:
  1. **Mode icons**: In `CreateWorkspaceDialog.tsx`, add an icon to each tab (Manual: wrench, Branch: git branch, GitHub Issue: GitHub logo). Currently the tabs at line 234 are text-only.
  2. **Section headers with icons**: Group related fields under mini-headers with icons (e.g., a git icon next to "Base Branch").
  3. **Confirmation summaries**: Before destructive actions (merge, discard in `WorkspaceMergeDialog.tsx`), show a clear summary of what will happen using a distinct visual treatment (bordered box, warning icon for discard).
  4. **Loading states**: The branch loading (`branchLoading`, line 317) and issue loading (`issueLoading`, line 362) use plain text. Replace with proper skeleton loading indicators.

- **Effort**: Low
- **Impact**: Low

---

### 10. Sidebar Layout Optimization

- **Problem**: In `SessionSidebar.tsx`, the UserBadge and settings gear are placed at the top of the sidebar (lines 86-110), above the "New Chat" button and search input. This pushes the actual session list further down. The UserBadge shows the user's email and plan -- information that is rarely needed after first launch. It occupies prime real estate at the top of the most-used view.

- **Solution**:
  1. **Move UserBadge to the bottom of the sidebar** -- Place it in a footer section, similar to how VS Code shows the user account at the bottom of the Activity Bar. This frees up top space for the session list.
  2. **Collapse the UserBadge by default** -- Show only an avatar or initial. Full email and plan details appear on hover or click.
  3. **If Activity Bar is implemented (Recommendation #1)** -- Move the UserBadge and settings gear to the Activity Bar entirely. The sidebar then has zero overhead: it opens with the search input and session list immediately.

- **Current sidebar layout vs. proposed**:
```
 Current SessionSidebar:        Proposed (without Activity Bar):
 ┌──────────────────────┐       ┌──────────────────────┐
 │ [Chat|WS|Teams] tabs │       │ [New Chat]           │
 │ UserBadge    [⚙️]    │       │ [Search sessions...] │
 │ ──────────────────── │       │ ──────────────────── │
 │ [New Chat]           │       │ Session 1            │
 │ [Search sessions...] │       │ Session 2            │
 │ ──────────────────── │       │ Session 3            │
 │ Session 1            │       │ ...                  │
 │ Session 2            │       │ ──────────────────── │
 │ Session 3            │       │ [J] user@email  [⚙️] │
 │ ...                  │       └──────────────────────┘
 └──────────────────────┘
```

- **Effort**: Low (reorder existing elements in `SessionSidebar.tsx`)
- **Impact**: Low-Medium

---

## Implementation Priority Matrix

```
                        High Impact
                            │
           ┌────────────────┼────────────────┐
           │                │                │
           │  Phase 1       │  Phase 2-3     │
           │  DO FIRST      │  DO NEXT       │
           │                │                │
           │  #3 Discovery  │  #1 Activity   │
           │  #6 Empty      │     Bar        │
           │    States      │  #2 Settings   │
           │  #5 StatusBar  │  #4 Workspace  │
           │                │     Wizard     │
  Low ─────┼────────────────┼────────────────┼───── High
  Effort   │                │                │   Effort
           │  Phase 1       │                │
           │  EASY WINS     │  DEFER         │
           │                │                │
           │  #8 Chat Msgs  │                │
           │  #10 Sidebar   │                │
           │  #9 Dialogs    │                │
           │  #7 Clarity    │                │
           │                │                │
           └────────────────┼────────────────┘
                            │
                        Low Impact
```

---

## Proposed Implementation Phases

### Phase 1: Quick Wins (1-2 days each)

These changes are small, self-contained, and deliver immediate UX improvements:

| # | Recommendation | Files Changed | Estimated Time |
|---|---|---|---|
| 3 | Feature Discovery System (partial) | `ChatInput.tsx`, `useCommands.ts`, `WelcomeScreen.tsx` | 1-2 days |
| 5 | Status Bar Simplification | `StatusBar.tsx` | 1 day |
| 6 | Enhanced Empty States | `SessionSidebar.tsx`, `ProjectSidebar.tsx`, `TeamsView.tsx`, `App.tsx` | 1 day |
| 8 | Chat Message Differentiation | `ChatPage.tsx`, message rendering components | 1 day |
| 9 | Dialog Improvements | `CreateWorkspaceDialog.tsx`, `WorkspaceMergeDialog.tsx` | 1 day |
| 10 | Sidebar Layout Optimization | `SessionSidebar.tsx` | 0.5 days |

### Phase 2: Medium Effort (3-5 days each)

These require more planning and touch multiple components:

| # | Recommendation | Files Changed | Estimated Time |
|---|---|---|---|
| 2 | Settings Reorganization | `SettingsPanel.tsx`, `SettingsPanel.test.tsx`, `SettingsTabsOverflow.test.tsx` | 3-4 days |
| 4 | Workspace Onboarding Wizard | New `WorkspaceWizard.tsx`, `ProjectSidebar.tsx`, `App.tsx` | 3-5 days |
| 7 | Session/Workspace Clarity | `SessionSidebar.tsx`, `ProjectSidebar.tsx`, view tabs | 2-3 days |
| 3 | Feature Discovery (full) | `CheckpointTimeline.tsx`, `CommandPalette.tsx`, settings persistence | 2-3 days |

### Phase 3: Major Restructuring (1-2 weeks)

This is the largest change and should be done after Phase 1-2 are validated:

| # | Recommendation | Files Changed | Estimated Time |
|---|---|---|---|
| 1 | Unified Navigation (Activity Bar) | New `ActivityBar.tsx`, `App.tsx`, `SessionSidebar.tsx`, `ProjectSidebar.tsx`, `App.test.tsx`, all sidebar tests | 1-2 weeks |

The Activity Bar change should come last because: (a) it is the highest-effort item, (b) Phase 1-2 improvements will still deliver value with the current sidebar structure, and (c) the Activity Bar implementation will be cleaner if settings and empty states are already improved.

---

## Appendix: Comparison with Competitor UX

| Feature | This App | VS Code | Cursor | ChatGPT Desktop | Windsurf |
|---|---|---|---|---|---|
| **Primary navigation** | Sidebar tabs (swapping) | Activity Bar (persistent) | Activity Bar (persistent) | Sidebar list (single) | Activity Bar (persistent) |
| **Settings organization** | 13 flat tabs | Categories > subcategories | Mirrors VS Code | Single scrollable page | Mirrors VS Code |
| **Command palette** | Triggered by `/` in chat input | `Cmd+Shift+P` (global) | `Cmd+Shift+P` (global) | None | `Cmd+Shift+P` (global) |
| **Workspace concept** | Git worktrees with embedded chat | Folders/workspaces (no chat) | Folders (chat is separate) | N/A (no workspace concept) | Projects with AI context |
| **Empty states** | Text-only ("No X yet") | Rich illustrations + CTAs | Follows VS Code | Greeting with suggestions | Illustrations + actions |
| **Status bar** | High density (11 items max) | High density but customizable | Follows VS Code | None | Minimal (model + status) |
| **Feature discovery** | Placeholder text only | Welcome tab, command palette hints, extensions | Onboarding tour | Conversation starters | Interactive tutorial |
| **Chat differentiation** | Minimal visual difference | N/A | Background colors + avatars | Distinct bubbles + avatars | Background tints + icons |

**Key takeaway**: Every major competitor uses a persistent Activity Bar for navigation. Adopting this pattern (Recommendation #1) would align with established muscle memory for the target audience (developers who use VS Code or Cursor daily). The current tab-swapping approach is unique to this app and not in a way that benefits users.

**ChatGPT Desktop is the outlier**: It uses a simple sidebar list with no Activity Bar, but it also has a much simpler feature set (no workspaces, no teams, no settings complexity). This app's feature depth is closer to VS Code/Cursor, so the VS Code navigation model is the more appropriate reference.
