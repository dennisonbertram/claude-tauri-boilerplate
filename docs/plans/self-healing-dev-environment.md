# Self-Healing Development Environment

## Overview

A system where the app monitors itself during use, captures bugs in real-time, and uses AI to diagnose and fix them live — with hot-reload preserving state. Think of it as a flight recorder + AI mechanic built into the dev environment.

**Status:** Issues created, labeled `deferred`. Each issue will be picked up deliberately.

**Reviewed by:** GPT-5.4 (xhigh reasoning, 318K tokens) via Codex. Key findings incorporated into issue descriptions.

## GPT-5.4 Review Summary

| Perspective | Verdict | Key Finding |
|-------------|---------|-------------|
| **Security** | FAIL → Fixed | Flight recorder can leak prompts/tokens. `acceptEdits` too permissive. **Fix:** Added redaction pipeline. Replaced with two-step human approval gate. |
| **Architecture** | CONCERN → Fixed | Lifecycle/job runner must come before AI agents. Hot patch dirties main worktree. **Fix:** Reordered. Hot patch redesigned as preview/apply. |
| **Reliability** | FAIL → Fixed | HMR intermittent drops. Auto-revert too naive. **Fix:** Hot patch marked experimental. Error fingerprinting replaces raw counting. Job leases added. |
| **UX** | CONCERN | Dashboard tries to be too many things. **Fix:** Mandatory review step between diagnosed and fix. |
| **Feasibility** | CONCERN | Issues 1-6 feasible. Issue 7 (hot patch) is weak link. **Fix:** Scoped to frontend-only, experimental. |

## Issue Dependency Graph

```
#220: Flight Recorder + Redaction Pipeline (foundation)
    ↓
#221: Bug Report Button & Modal  ───→  #222: Backend Storage & API
    ↓                                       ↓
#223: Dashboard UI  ←──────────────────────┘
    ↓
#224: Status Lifecycle & Job Runner (prerequisite for AI agents)
    ↓
#225: AI Diagnosis Agent
    ↓
#226: Fix Agent via Worktree Sandbox (with human approval gate)
    ↓
#227: End-to-End Integration
    ↓
#228: Hot Patch Delivery (EXPERIMENTAL — frontend-only)
    ↓
#229: Passive Observer (stretch goal)
```

**Implementation order:** #220 → #221+#222 (parallel) → #223 → #224 → #225 → #226 → #227 → #228 → #229

## GitHub Issues

| # | Issue | Title | Phase | Labels |
|---|-------|-------|-------|--------|
| 1 | [#220](https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/220) | Flight Recorder + Redaction Pipeline | Phase 1: Foundation | frontend, large |
| 2 | [#221](https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/221) | Bug Report Button & Modal UI | Phase 2: Capture | frontend, medium |
| 3 | [#222](https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/222) | Bug Report Storage Backend & API | Phase 2: Capture | backend, medium |
| 4 | [#223](https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/223) | Bug Report Dashboard UI | Phase 2: Capture | frontend, large |
| 5 | [#224](https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/224) | Status Lifecycle, Job Runner & Error Recovery | Phase 3: Intelligence | backend, large |
| 6 | [#225](https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/225) | AI Bug Diagnosis Agent | Phase 3: Intelligence | backend, large, sdk-integration |
| 7 | [#226](https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/226) | Fix Agent via Worktree Sandbox | Phase 3: Intelligence | backend, large, security |
| 8 | [#227](https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/227) | End-to-End Integration | Phase 4: Integration | frontend+backend, large |
| 9 | [#228](https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/228) | Hot Patch Delivery (EXPERIMENTAL) | Phase 4: Integration | frontend+backend, large |
| 10 | [#229](https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/229) | Passive Observer (Stretch Goal) | Phase 4: Integration | frontend, medium |

## Key Architecture Decisions

1. **Dev-mode only** — all components gated behind `import.meta.env.DEV`, tree-shaken in production
2. **Redaction pipeline** — API keys, auth headers, and absolute paths scrubbed before persistence
3. **Two-step fix model** — Claude proposes diff → human reviews → approved diff applied in worktree
4. **Job runner with leases** — prevents concurrent operations, handles timeouts and orphan cleanup
5. **Error fingerprinting** — hash of error message + component stack, not raw error count
6. **Hot patch is experimental** — frontend-only, explicit preview/apply, not silent file copying

## Critical Existing Files to Reuse

| File | What to Reuse |
|------|--------------|
| `apps/desktop/src/App.tsx` | Dev-mode gating pattern (`import.meta.env.DEV`) |
| `apps/desktop/src/components/ErrorBoundary.tsx` | Hook into for React error capture |
| `apps/server/src/db/schema.ts` | Table creation pattern |
| `apps/server/src/db/index.ts` | CRUD helper pattern with prepared statements |
| `apps/server/src/services/claude.ts` | `streamClaude()` for diagnosis + fix agents |
| `apps/server/src/services/worktree.ts` | `WorktreeService` for fix sandboxing |
| `apps/server/src/middleware/error-handler.ts` | Error response pattern |
| `packages/shared/src/types.ts` | Status transition validation pattern |
