# Investigations

Deep-dive investigations into specific technologies, libraries, and integration patterns.

## Files

| File | Description |
|------|-------------|
| [claude-code-sdk-vercel-ai.md](claude-code-sdk-vercel-ai.md) | Claude Agent SDK + Vercel AI SDK integration research, including package rename findings and streaming patterns |
| [tauri-v2-architecture.md](tauri-v2-architecture.md) | Tauri v2 architecture overview covering IPC, React integration, sidecar servers, SQLite, and configuration |
| [shadcn-ai-elements-setup.md](shadcn-ai-elements-setup.md) | Setup guide for shadcn/ui v2+ with Vite/React, AI SDK Elements, Tailwind CSS v4, and Hono backend |
| [hono-server-architecture.md](hono-server-architecture.md) | Evaluation of Hono as backend framework covering routing, SSE streaming, SQLite, Vercel AI SDK compatibility, and typed RPC |
| [simple-ai-dev.md](simple-ai-dev.md) | Research on simple-ai.dev, an open-source AI development toolkit by Alwurts |
| [ai-sdk-elements.md](ai-sdk-elements.md) | Investigation of Vercel AI SDK Elements, the open-source React component library built on shadcn/ui for AI-native apps |
| [remaining-issues-breakdown.md](remaining-issues-breakdown.md) | Comprehensive breakdown of all 7 remaining open GitHub issues (#1, #2, #8, #10, #12, #26, #31) with full details, acceptance criteria, and implementation plans |
| [backend-curl-audit.md](backend-curl-audit.md) | Comprehensive audit of the backend server: all routes, the /api/chat SSE pipeline, Claude Agent SDK event transformation, Vercel AI SDK wire format, and known issues |
| [curl-test-results.md](curl-test-results.md) | Live curl testing of all 16 backend API endpoints. Found 7 bugs including missing `text-end` SSE event, data channel events not consumed by frontend, git status path truncation, event ordering issues, and invalid JSON returning 500. Includes full raw SSE stream capture and AI SDK protocol analysis. |
| [frontend-chat-debug.md](frontend-chat-debug.md) | Root cause analysis of frontend chat not displaying messages. Primary bug: `useChat({ id: undefined })` causes Chat instance recreation on every render, orphaning in-flight requests. Secondary: `onData` callback not wired between useStreamEvents and useChat. Includes specific code-level fixes. |
| [sidebar-scroll-issue.md](sidebar-scroll-issue.md) | Root cause analysis of the sidebar session list expanding page height instead of scrolling independently. The issue is missing `min-h-0` on flex children, which causes the ScrollArea to grow to fit all content rather than constraining to available space. Includes exact Tailwind class fixes for SessionSidebar and MessageList. |
| [settings-panel-review.md](settings-panel-review.md) | Review of the current SettingsPanel implementation (8 tabs, useSettings hook, sub-panels), comparison with Claude Code CLI's /config dialog (Status/Config/Usage tabs, 23+ settings), inventory of data already available from API endpoints and session:init stream events, gap analysis identifying what's missing, and prioritized enhancement recommendations. |
