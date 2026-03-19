# Gemini 2.5 Pro UX Review: Claude Tauri Boilerplate

**Date:** 2026-03-18
**Model:** gemini/gemini-2.5-pro (via `llm` CLI)
**Input:** Full frontend codebase (204 files, 344,566 tokens) flattened with repomix from `apps/desktop/src/`
**Purpose:** Comprehensive UX review of the Claude Code desktop GUI

---

### Overall Impression

The application is clearly a power-user tool for developers, drawing inspiration from modern IDEs and developer-focused chat clients. The feature set is rich and ambitious, covering chat, version control integration (workspaces), and multi-agent systems (teams). The use of React, custom hooks, and a component-based architecture is solid.

The core UX challenge is managing this complexity. The app is at a critical juncture where it needs to refine its information architecture and user flows to prevent high cognitive load and ensure its powerful features are discoverable and intuitive.

---

### 1. Information Architecture (IA)

The application's IA is split into three main views: **Chat**, **Workspaces**, and **Teams**. This top-level organization is logical. However, the implementation presents a significant architectural challenge.

*   **Problem: Dual Sidebars.** The app uses two different sidebars (`SessionSidebar.tsx` for Chat view, `ProjectSidebar.tsx` for Workspaces view) that are swapped out entirely when the user switches views. This is an unconventional and potentially confusing pattern. Users must maintain two separate mental models for navigation.
*   **Nested IA in Workspaces:** The `WorkspacePanel.tsx` introduces another layer of navigation with its own tabs (Chat, Diff, Paths, Notes, Dashboards). This is a powerful "IDE-within-an-app" concept but buries features like Dashboards deep within the hierarchy.
*   **Overloaded Settings:** The `SettingsPanel.tsx` has 12 tabs, as confirmed in `SettingsTabsOverflow.test.tsx`. This is a classic sign of an IA that needs restructuring. It forces users to scan a long list to find what they need. Categories like "Instructions", "Memory", "MCP", and "Hooks" are all advanced configuration that could be grouped.

**Recommendation:**
*   Adopt a unified navigation model similar to VS Code's "Activity Bar." Create a single, persistent, thin bar on the far left with icons for "Chat," "Workspaces," "Teams," and "Settings." Clicking an icon would change the content of the main sidebar panel, but the top-level navigation structure would remain constant. This consolidates navigation and provides a stable "home base" for the user.
*   Reorganize the Settings panel by grouping tabs into logical sections like:
    *   **Account & General:** (General, Status)
    *   **AI & Model:** (Model, Advanced)
    *   **Appearance:** (Appearance)
    *   **Data & Automation:** (Instructions, Memory, Hooks, MCP)
    *   **Integrations:** (Git, Linear)

---

### 2. User Flow Analysis

*   **New Chat:** The flow is straightforward: click "New Chat". The guard logic in `NewChatBehavior.test.tsx` that prevents creating a new session when the current one is empty is a thoughtful UX touch that prevents clutter.
*   **Creating a Workspace:** This is a high-friction flow.
    1.  User must first be in the "Workspaces" view.
    2.  Click "Add Project" (`AddProjectDialog.tsx`).
    3.  Select the project, then click "New workspace".
    4.  Interact with `CreateWorkspaceDialog.tsx`, which has three different modes (Manual, Branch, GitHub Issue).
    This multi-dialog process could be streamlined into a single, multi-step wizard to guide the user more effectively.
*   **Settings:** The flow to change a setting is `Click Gear -> Find Tab -> Find Setting`. With 12 tabs, "Find Tab" is the primary friction point. Reducing the number of top-level tabs is crucial.

---

### 3. Visual Hierarchy & Layout

The main layout is a standard two-column (Sidebar + Main Content) structure, which is appropriate for a dev tool.

*   **The Sidebar Swap:** As mentioned in the IA section, swapping the entire sidebar (`SessionSidebar.tsx` vs. `ProjectSidebar.tsx`) is the most significant layout issue. It breaks spatial consistency.
*   **`StatusBar.tsx`:** This component is extremely information-dense (Model, Permissions, Git, Connection, CPU/Memory, Context Usage, Cost, Timers, Active Tools). While this data is valuable, presenting it all at once increases cognitive load. The fact that resource usage is configurable (`SettingsPanel.test.tsx`) is good, and this pattern should be extended to other status bar items.
*   **Hierarchy within Sidebars:** The sidebars use indentation and expand/collapse sections well to create hierarchy (e.g., projects containing workspaces). This is effective.

---

### 4. Onboarding & Empty States

The app handles onboarding and empty states reasonably well, but there's room for improvement.

*   **First Launch/Auth:** `OnboardingScreen.tsx` provides a clear, step-by-step guide for developers to connect the app to the `claude` CLI tool. This is excellent, targeted onboarding.
*   **Empty Chat View:** `WelcomeScreen.tsx` is a good landing page. It clearly states the app's purpose and provides a primary call-to-action ("New Conversation").
*   **Empty Workspaces/Teams:** Components like `TeamsView.tsx` and `ProjectSidebar.tsx` have simple "No X yet" messages. These could be improved by adding a primary action button directly in the empty state (e.g., a large "Add Your First Project" button in the center of the panel).

---

### 5. Feature Discoverability

This is a major area for improvement. Many powerful features are hidden.

*   **Command Palette:** The `ChatInput.tsx` placeholder text `(/ for commands)` is the primary discovery mechanism. This is subtle and easily missed. A more explicit onboarding tip or a small, permanent icon near the input could help.
*   **Workflows (`/review`, `/pr`, etc.):** These are powerful but completely hidden behind the command palette. Users who don't discover the palette will never find them.
*   **Checkpoints & Rewind:** `CheckpointTimeline.tsx` is only visible when checkpoints exist. A user won't know this feature is available until after they've completed a few turns with file modifications. There's no "up-front" indication that this safety net exists.
*   **Dashboards & Artifacts:** These are arguably the most hidden features. The user must:
    1.  Switch to the "Workspaces" view.
    2.  Create a project and a workspace.
    3.  Select the workspace to open `WorkspacePanel.tsx`.
    4.  Navigate to the "Dashboards" tab (`WorkspaceDashboardsView.tsx`).
    This is too deep in the hierarchy for what could be a key feature.

---

### 6. Cognitive Load

The app asks a lot of the user, particularly in settings and advanced features.

*   **Settings Panel:** The 12 tabs are overwhelming. The sheer number of options in `SettingsPanel.tsx`, especially in the "Appearance" and "Model" tabs, could be intimidating.
*   **Workspaces vs. Sessions:** The distinction between a "Session" (a chat log) and a "Workspace" (a git worktree with its own associated chat session) may not be immediately clear to new users.
*   **Status Bar:** The density of information in `StatusBar.tsx` can be high. It's not clear which metrics are most important at a glance.

**Recommendation:**
*   Simplify the status bar by default, perhaps grouping related items (e.g., CPU + Memory into a single "System" metric) that expand on hover.
*   Use progressive disclosure more aggressively. Hide advanced settings (e.g., "Thinking Budget") behind an "Advanced" toggle within the Model tab itself.

---

### 7. Interaction Patterns

The interaction design is generally consistent and follows established patterns for developer tools.

*   **Context Menus:** The use of hover-to-show three-dot menus and right-click context menus in `SessionSidebar.tsx` is good. The rename-in-place interaction is a nice, modern touch.
*   **Inline "Modals":** The `PermissionDialog.tsx` and `PlanView.tsx` components are excellent examples of contextual, non-blocking interactions. They appear directly in the message flow, keeping the user in context, which is far better than a traditional modal that would cover the entire screen.
*   **Dialogs:** Creation dialogs (`CreateWorkspaceDialog.tsx`, `AddProjectDialog.tsx`) are used consistently for setup tasks. They are standard modal dialogs, which is appropriate for these focused tasks.

---

### 8. Status Communication

The app does a good job of communicating its state.

*   **`StatusBar.tsx`** is the central hub for this, effectively showing streaming state, tool activity, and connection health.
*   **`ToolCallBlock.tsx` and `ThinkingBlock.tsx`** provide granular, in-context status updates during an AI turn. The ability to expand/collapse these is crucial for managing visual noise and is well-implemented.
*   **`ErrorBanner.tsx`** is a standout. The tests reveal it has different styles for API, rate limit, auth, and network errors. This contextual feedback is excellent UX.
*   The loading state for `WorkspaceDashboardsView.tsx` and other async views is present, which is good.

---

### 9. Comparison to Best Practices

*   **VS Code / Cursor:** The most obvious point of comparison is the navigation model. This app should adopt the **Activity Bar** pattern from VS Code. It provides a stable, top-level navigation structure that this app currently lacks due to the sidebar swapping.
*   **ChatGPT Desktop:** ChatGPT is simpler. Claude Code is clearly aiming for a more complex, IDE-like experience. This is a valid product choice, but it means the app must be even more diligent about managing complexity.
*   **Command Palette:** The implementation via `useCommandPalette.tsx` and `CommandPalette.tsx` is a solid adoption of a best-in-class pattern from tools like VS Code, Sublime Text, and Raycast. The fuzzy search from `commandSearch.ts` is also a key part of making this feel right.

---

### 10. Top 10 Recommendations (Prioritized)

1.  **(High Impact / High Effort)** **Unify Navigation with an Activity Bar:** Replace the `SessionSidebar` / `ProjectSidebar` swap. Implement a single, persistent icon bar on the far left for Chat, Workspaces, Teams, and Settings. This will provide a stable IA foundation.
2.  **(High Impact / Medium Effort)** **Streamline Settings:** Group the 12 tabs in `SettingsPanel.tsx` into 4-5 logical categories (e.g., General, Appearance, AI/Model, Data & Automation, Integrations) to drastically reduce cognitive load.
3.  **(High Impact / Medium Effort)** **Improve Workspace Onboarding:** Replace the `AddProjectDialog` -> `CreateWorkspaceDialog` flow with a single, guided, multi-step "Create Workspace" wizard. This will lower the barrier to entry for the app's most powerful feature.
4.  **(High Impact / Low Effort)** **Improve Feature Discoverability:**
    *   Add an "Artifacts" or "Dashboards" icon to the new Activity Bar to surface this feature.
    *   Add a small, non-intrusive UI element near the `ChatInput` that hints at the command palette on first use.
5.  **(Medium Impact / Medium Effort)** **Clarify the Session/Workspace mental model:** Use tooltips, better empty states, or a brief one-time onboarding pop-up to explain that a "Session" is a chat log, while a "Workspace" is a sandboxed coding environment with its own chat.
6.  **(Medium Impact / Low Effort)** **Make the Status Bar Cleaner:** By default, group less critical info in `StatusBar.tsx`. For example, combine CPU and Memory into one "System" item that reveals details on hover. Make more items configurable to hide.
7.  **(Medium Impact / Low Effort)** **Enhance Empty States:** Add primary action buttons to empty states. For example, the empty `WorkspacePanel` should have a "Start a new chat in this workspace" button. The empty `TeamsView` should have a "Create Your First Team" button.
8.  **(Medium Impact / Low Effort)** **Consolidate Sidebar Controls:** The `SessionSidebar` has a "New Chat" button at the top and the user badge/settings at the very top. Consider moving the user badge and settings to the bottom of the sidebar, a common pattern in apps like VS Code and Discord, to give more vertical space to the session list.
9.  **(Low Impact / Low Effort)** **Improve In-Chat Hierarchy:** User messages (`role: 'user'`) should be visually distinct from assistant messages, not just by alignment but perhaps with a slightly different background or accent color to improve scannability of the conversation.
10. **(Low Impact / Low Effort)** **Add Visual Cues to Dialogs:** The various creation dialogs are very text-heavy. Add simple icons to `CreateWorkspaceDialog.tsx` modes (Manual, Branch, Issue) to make them more scannable and visually distinct.
