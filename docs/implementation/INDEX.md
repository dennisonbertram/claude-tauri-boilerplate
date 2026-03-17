# Implementation

Implementation notes and code change documentation.

## Files

| File | Description |
|------|-------------|
| [phase1-scaffolding.md](phase1-scaffolding.md) | Phase 1 monorepo scaffolding - pnpm workspace, shared types, Hono server, Tauri+React desktop app |
| [phase2-auth-endpoint.md](phase2-auth-endpoint.md) | Phase 2 auth status endpoint - subscription detection via Claude Agent SDK with 10s timeout |
| [phase3-chat-streaming.md](phase3-chat-streaming.md) | Phase 3 chat streaming route - SSE streaming of Claude responses via AI SDK v6 UI message stream protocol |
| [phase4-sqlite-persistence.md](phase4-sqlite-persistence.md) | Phase 4 SQLite persistence - bun:sqlite for sessions and messages with CRUD operations and HTTP routes |
| [phase5-frontend-ui.md](phase5-frontend-ui.md) | Phase 5 frontend chat UI - React chat interface with shadcn/ui, AI SDK v6 useChat, session sidebar, and message streaming |
| [phase6-onboarding.md](phase6-onboarding.md) | Phase 6 onboarding screen - AuthGate with step-by-step Claude Code setup instructions |
| [phase7-sidecar-integration.md](phase7-sidecar-integration.md) | Phase 7 Tauri sidecar integration - Hono server as bundled sidecar with shell plugin, health polling, and dev/prod modes |
<<<<<<< HEAD
| [issue-75-wave-1-subagent.md](issue-75-wave-1-subagent.md) | Issue #75 implementation progress for CI failure forwarding and `Fix Errors` support (Wave 1). |
| [issue-76-wave-1-subagent.md](issue-76-wave-1-subagent.md) | Issue #76 provider support implementation notes and verification summary (wave 1: provider selection, env routing, persistence) |
| [issue-77-wave-1-subagent.md](issue-77-wave-1-subagent.md) | Initial implementation slice for Issue #77: command palette integration, fuzzy filtering, and command-driven navigation. |
| [issue-78-wave-1-subagent.md](issue-78-wave-1-subagent.md) | Issue #78 Wave 1: Linear issue metadata linked to sessions/workspaces and chat prompt context injection |
| [issue-79-wave-1-subagent.md](issue-79-wave-1-subagent.md) | Wave 1 for Issue #79: file picker, @-mentions, drag-and-drop file attachments, and inline preview rendering |
| [issue-80-wave-1-subagent.md](issue-80-wave-1-subagent.md) | Issue #80 wave 1 subagent implementation notes for diff viewer enhancements. |
