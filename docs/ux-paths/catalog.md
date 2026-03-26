# UX Path Catalog: Claude Tauri Boilerplate

Generated: 2026-03-25  
Focus: agent creation, settings, repeated information, and extraneous information  
Total Stories: 24  
Topics: 6

## Summary

This pass narrows the catalogue to the product seams that are most likely to create UX drag:

- creating and editing agents
- understanding the difference between global settings and profile settings
- getting to a first prompt without feeling over-configured
- moving between chat, projects, and workspaces without losing context
- trusting runtime permissions and feedback

| Type | Count |
|------|-------|
| Short | 10 |
| Medium | 11 |
| Long | 3 |

| Topic | Stories | Main UX Question |
|------|---------|------------------|
| Agent Creation and Editing | 5 | Can users create a useful agent without feeling dropped into too much configuration? |
| Settings Information Architecture | 4 | Can users tell what is global, what is per-profile, and what matters now? |
| Chat Entry and Context Selection | 4 | Can users reach a first prompt quickly despite many pre-chat controls? |
| Navigation and Surface Switching | 4 | Can users keep orientation as the app shifts between major modes? |
| Permission Trust and Feedback | 3 | Do runtime actions feel understandable and safe? |
| Workspace and Project Handoffs | 4 | Is project context carried clearly across chat and workspace flows? |

## Coverage Matrix

| Product Area | Covered By | What We Are Stress-Testing |
|-------------|------------|-----------------------------|
| Agent builder | Agent Creation and Editing | Blank vs generated start, tab density, save confidence, overrides |
| Global settings | Settings Information Architecture | Scope clarity, scrolling load, repeated controls |
| Welcome screen | Chat Entry and Context Selection | First-prompt friction, optional controls, information density |
| Sidebar and view switching | Navigation and Surface Switching | Wayfinding, context retention, recents vs projects mode-switching |
| Permission and runtime feedback | Permission Trust and Feedback | Approval confidence, cost/context/status comprehension |
| Project/workspace flows | Workspace and Project Handoffs | Project choice, workspace escalation, chat-to-code continuity |

## Story Dependency Notes

- Run `ACE-01` before any agent-profile reuse story.
- Run `SET-01` before testing overlap between settings and profile configuration.
- Run `CHAT-01` before project or workspace handoff stories.
- Run `NAV-01` before cross-surface switching stories.
- Run `WS-01` before workspace-linked chat stories.

## All Stories

### Agent Creation and Editing

Topic file: `docs/ux-paths/topics/agent-creation-and-editing.md`

| ID | Type | Title | Persona |
|----|------|-------|---------|
| ACE-01 | short | Create a blank agent from the modal | Developer making a first custom agent |
| ACE-02 | medium | Generate an agent with AI, then verify what was created | Developer using AI to bootstrap configuration |
| ACE-03 | medium | Switch between profiles while holding unsaved edits | Power user comparing variants |
| ACE-04 | long | Understand repeated model, tools, hooks, and integration controls | Product evaluator auditing scope overlap |
| ACE-05 | short | Decide whether delete and duplicate feel safe | User cleaning up old profiles |

### Settings Information Architecture

Topic file: `docs/ux-paths/topics/settings-information-architecture.md`

| ID | Type | Title | Persona |
|----|------|-------|---------|
| SET-01 | medium | Open settings to answer one simple question quickly | Developer trying to change one default |
| SET-02 | medium | Compare global model settings with profile model settings | User unsure which model setting wins |
| SET-03 | short | Read a long grouped settings pane without losing context | User navigating dense technical options |
| SET-04 | long | Configure hooks or MCP and determine where that configuration belongs | Power user managing global versus per-agent behavior |

### Chat Entry and Context Selection

Topic file: `docs/ux-paths/topics/chat-entry-and-context-selection.md`

| ID | Type | Title | Persona |
|----|------|-------|---------|
| CHAT-01 | short | Reach a first prompt with minimal setup | New user opening the app to ask one question |
| CHAT-02 | medium | Choose an agent, project, and model before chatting | User trying to set context correctly on the first try |
| CHAT-03 | medium | Interpret extra entry controls without feeling blocked | Curious user exploring templates, connectors, and attachments |
| CHAT-04 | short | Recover confidence after selecting the wrong pre-chat context | User who realizes the chosen setup was not needed |

### Navigation and Surface Switching

Topic file: `docs/ux-paths/topics/navigation-and-surface-switching.md`

| ID | Type | Title | Persona |
|----|------|-------|---------|
| NAV-01 | short | Understand the app from the sidebar alone | First-time user learning the product map |
| NAV-02 | medium | Jump from chat recents to projects without losing orientation | Returning user balancing multiple tasks |
| NAV-03 | medium | Use collapsed-sidebar mode and stay confident | Laptop user working in a constrained layout |
| NAV-04 | short | Find settings from multiple entry points and know why each exists | User noticing repeated controls |

### Permission Trust and Feedback

Topic file: `docs/ux-paths/topics/permission-trust-and-feedback.md`

| ID | Type | Title | Persona |
|----|------|-------|---------|
| PERM-01 | medium | See a risky tool request and decide quickly | Cautious developer reviewing a live action |
| PERM-02 | short | Use runtime indicators to understand what the agent is doing | Developer watching a long-running response |
| PERM-03 | medium | Reconcile permission mode in settings, profiles, and live prompts | User trying to predict approval behavior |

### Workspace and Project Handoffs

Topic file: `docs/ux-paths/topics/workspace-and-project-handoffs.md`

| ID | Type | Title | Persona |
|----|------|-------|---------|
| WS-01 | medium | Pick a project from the welcome screen before chatting | Developer who wants scoped context but not a workspace yet |
| WS-02 | medium | Move from general chat into workspace work | Developer escalating from ideation into code changes |
| WS-03 | short | Understand whether the current conversation is project-aware or workspace-aware | User checking context before asking for edits |
| WS-04 | long | Follow one task from project selection to workspace review | Developer doing end-to-end task execution |

## Gaps And Recommendations

### Highest-value walkthroughs to run next

- Walk the full blank-agent flow and note where the shift from simple modal to dense editor creates hesitation.
- Walk the global-settings-versus-profile-settings comparison for model, permission mode, hooks, and MCP.
- Walk the welcome screen with a “just let me ask a question” mindset and measure how many controls feel optional versus required.

### Likely UX risks from the codebase

- Repeated configuration concepts may make users ask “where should I set this?” before they ask “what should I set?”
- Grouped settings panes are efficient for experts but can feel like long technical forms for everyone else.
- The welcome screen offers many affordances up front, which is powerful but can delay the first moment of progress.
- Chat, project, and workspace context are all present in the product, but the boundaries between them are not always explicit in the UI language.

### Notable implementation-backed observations

- Agent creation uses a two-step journey: modal first, full editor second.
- Settings uses group navigation but still renders multiple subsections in one scroll area.
- Model, effort, permissions, hooks, and integrations appear in more than one surface.
- The welcome screen exposes project selection, profile selection, model selection, templates, and a plus menu before the user sends a first message.
