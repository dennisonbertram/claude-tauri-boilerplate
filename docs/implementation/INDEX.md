# Implementation

Implementation notes and code change documentation.

## Files

| File | Description |
|------|-------------|
| [issue-100-bash-display-controls.md](issue-100-bash-display-controls.md) | Issue #100 implementation note for the completed BashDisplay search, clear-shortcut, and full-height controls plus browser validation. |
| [issue-112-browser-automation.md](issue-112-browser-automation.md) | Issue #112 implementation notes for Playwright MCP defaults, Settings presets, browser tool rendering, workflow prompt updates, and repo-root MCP config resolution. |
| [phase1-scaffolding.md](phase1-scaffolding.md) | Phase 1 monorepo scaffolding - pnpm workspace, shared types, Hono server, Tauri+React desktop app |
| [phase2-auth-endpoint.md](phase2-auth-endpoint.md) | Phase 2 auth status endpoint - subscription detection via Claude Agent SDK with 10s timeout |
| [phase3-chat-streaming.md](phase3-chat-streaming.md) | Phase 3 chat streaming route - SSE streaming of Claude responses via AI SDK v6 UI message stream protocol |
| [phase4-sqlite-persistence.md](phase4-sqlite-persistence.md) | Phase 4 SQLite persistence - bun:sqlite for sessions and messages with CRUD operations and HTTP routes |
| [phase5-frontend-ui.md](phase5-frontend-ui.md) | Phase 5 frontend chat UI - React chat interface with shadcn/ui, AI SDK v6 useChat, session sidebar, and message streaming |
| [phase6-onboarding.md](phase6-onboarding.md) | Phase 6 onboarding screen - AuthGate with step-by-step Claude Code setup instructions |
| [phase7-sidecar-integration.md](phase7-sidecar-integration.md) | Phase 7 Tauri sidecar integration - Hono server as bundled sidecar with shell plugin, health polling, and dev/prod modes |
| [issue-75-wave-1-subagent.md](issue-75-wave-1-subagent.md) | Issue #75 implementation progress for CI failure forwarding and `Fix Errors` support (Wave 1). |
| [issue-76-wave-1-subagent.md](issue-76-wave-1-subagent.md) | Issue #76 provider support implementation notes and verification summary (wave 1: provider selection, env routing, persistence). |
| [issue-77-wave-1-subagent.md](issue-77-wave-1-subagent.md) | Initial implementation slice for Issue #77: command palette integration, fuzzy filtering, and command-driven navigation. |
| [issue-78-wave-1-subagent.md](issue-78-wave-1-subagent.md) | Issue #78 Wave 1: Linear issue metadata linked to sessions/workspaces and chat prompt context injection. |
| [issue-79-wave-1-subagent.md](issue-79-wave-1-subagent.md) | Wave 1 for Issue #79: file picker, @-mentions, drag-and-drop file attachments, and inline preview rendering. |
| [issue-80-wave-1-subagent.md](issue-80-wave-1-subagent.md) | Issue #80 wave 1 subagent implementation notes for diff viewer enhancements. |
| [issue-113-wave13.md](issue-113-wave13.md) | Wave 13 closeout for Issue #113: monospace font-family selection, compact tab density, and appearance validation notes. |
| [issue-116-wave13.md](issue-116-wave13.md) | Issue #116 follow-up wiring for the persisted resource-usage toggle, Status-tab controls, and targeted desktop regression coverage. |
| [generative-ui-foundation-live-first.md](generative-ui-foundation-live-first.md) | Registry-based generative UI foundation refactor, shared tool parsing/sanitization, and persistence-path design notes. |
| [issue-114-wave13.md](issue-114-wave13.md) | Issue #114 implementation notes for multi-repo workspace attachments, `/add-dir` routing, and manual validation. |
| [issue-115-ai-memory-update.md](issue-115-ai-memory-update.md) | Issue #115 implementation note covering repo-scoped memory-update prompts, queued `MEMORY.md` drafts, regression coverage, and live browser validation. |
| [issue-92-response-metadata.md](issue-92-response-metadata.md) | Issue #92 implementation note for assistant response metadata/footer wiring, changed-file summaries, and validation status. |
| [issue-158-workflow-memory-404s.md](issue-158-workflow-memory-404s.md) | Issue #158 implementation note for removing normal-startup workflow prompt 404s by loading overrides from the memory index once. |
| [persistent-dashboard-artifacts-v1.md](persistent-dashboard-artifacts-v1.md) | Persistent Dashboard Artifacts V1 implementation notes covering data model (artifacts, artifact_revisions, message_parts tables), backend CRUD/generate/regenerate/archive routes, frontend Dashboards tab, /dashboard slash command, and curl verification results. |
