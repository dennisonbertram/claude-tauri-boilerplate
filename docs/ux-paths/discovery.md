# App Discovery: Claude Tauri Boilerplate

Generated: 2026-03-25

## Application Type

Native desktop app built with Tauri and React. The product behaves like a personal AI workbench with multiple major surfaces rather than a single linear workflow.

## Tech Stack

- Tauri v2 shell with React + TypeScript frontend
- Hono/Bun sidecar API with local persistence
- Tailwind CSS v4 for styling
- Local-first session, profile, settings, project, and workspace management

## User Roles

- Primary persona: solo developer using the desktop app as an AI coding environment
- Secondary persona: power user who customizes agents, providers, hooks, and integrations
- Emerging persona: evaluator comparing global defaults versus profile-specific overrides

## Feature Map

### Chat and Session Flow

- Start a conversation from a welcome screen or resume from recents
- Choose an agent profile before the first prompt
- Choose a project context before the first prompt
- Choose a model before the first prompt
- Send a prompt and observe streaming output, tool calls, cost, context usage, and permissions
- Search, rename, fork, export, and delete sessions from the sidebar

### Agent Creation and Editing

- Open an agent creation modal with two entry points: blank profile or AI-generated profile
- Edit an agent across eight tabs: General, Prompt, Model, Tools, Automations, Integrations, Sandbox, Advanced
- Save, duplicate, delete, and mark profiles as default
- Resolve unsaved-changes confirmation when switching profiles

### Settings

- Open a right-hand settings drawer grouped into General, AI & Model, Data & Context, Integrations, and Status
- Configure provider credentials, runtime environment variables, IDE defaults, model defaults, permission mode, memory, instructions, hooks, MCP, and integrations
- Read live status information for the active session

### Projects and Workspaces

- Add projects and create workspaces from a branch or linked issue
- Select a project before chatting, then later move into workspace-specific flows
- Review diffs, notes, dashboards, and merge/discard operations

## Navigation Structure

- `AppSidebar` is the primary navigation surface, with chat recents or project/workspace listings depending on the active view
- `WelcomeScreen` is a pre-session setup surface layered inside chat
- `AgentBuilderView` is a dedicated full-page editor with its own sidebar and tabbed editor
- `SettingsPanel` is a global overlay with grouped sections that render multiple subsections in a single scrollable pane
- `StatusBar` is always visible and surfaces session-level controls and runtime state

## Data Entities

- Session
- Message
- Project
- Workspace
- Agent Profile
- Settings document
- Instruction and memory files
- Integration configurations

## Integrations

- Provider routing and API credentials
- GitHub and Linear issue flows
- MCP server configuration
- IDE deep-link preferences
- Google and notification integrations

## Error And Empty States

- Empty chat state routes to `WelcomeScreen`
- Empty agent-builder state prompts the user to select or create a profile
- Empty project selection states surface “No projects added yet”
- Unsaved profile edits trigger a native confirmation prompt
- Settings and runtime surfaces rely on inline descriptions more than progressive disclosure

## UX Friction Hotspots

### 1. Agent creation is split across multiple surfaces

- Users begin in a focused modal, then land in a dense eight-tab editor
- The first-run blank profile starts with a generic name, which can create low-confidence “am I editing the right thing?” moments
- Unsaved-change prompts appear when switching selection, which is protective but interrupts exploration

### 2. Model and permission concepts repeat across the product

- Model selection appears on the welcome screen, in global settings, inside agent profiles, and in runtime/status surfaces
- Permission mode appears in settings, in profiles, and again during live approval flows
- Hooks and MCP configuration exist globally in settings and locally in agent profiles, which creates override ambiguity

### 3. Settings prioritizes completeness over clarity

- Group-level navigation still renders several subsections in one long pane
- Some groups mix account-level setup, behavioral defaults, and advanced technical configuration
- The product asks users to understand scope boundaries without always naming them directly

### 4. Pre-chat setup risks feeling over-instrumented

- Before a first message, users may see agent profile, project selection, model selection, templates, connectors, attachment affordances, and learning copy
- This is powerful, but it can make the first prompt feel like a configuration exercise

### 5. Context handoff between chat and workspaces is strong technically but not always explicit

- Users can choose a project before chatting, but workspace-specific context lives elsewhere
- The app supports both general chat and project/workspace chat, which is useful but easy to blur

## Recommended Story Topics

1. Agent creation and editing
2. Settings information architecture
3. Chat entry and context selection
4. Navigation and surface switching
5. Permission trust and runtime feedback
6. Workspace and project handoffs
