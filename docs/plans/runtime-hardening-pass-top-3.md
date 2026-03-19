# Runtime Hardening Pass: Top 3

## Goal

Harden the boilerplate for real multi-session AI coding use without changing the current Claude-based runtime choice.

## Scope

This pass is intentionally limited to the three highest-leverage hardening items from the code review:

1. Request-scoped credential and provider isolation: GitHub issue `#231`
2. Sensitive log redaction and debug gating: GitHub issue `#232`
3. Workspace path boundary enforcement for agent-accessible files: GitHub issue `#233`

## Tracked Issues

- [ ] `#231` Hardening: isolate request-scoped Claude/provider env from global `process.env`
- [ ] `#232` Hardening: redact sensitive chat and sidecar logs by default
- [ ] `#233` Hardening: enforce workspace path boundaries for `additionalDirectories` and attachments

## Acceptance Criteria

- [ ] No request-handling path mutates shared `process.env` for provider selection, auth detection, auto-naming, or context summarization.
- [ ] Concurrent-request regression coverage proves that one request cannot affect another request's provider/auth environment.
- [ ] Default server and sidecar logs do not print raw prompts, injected instructions, workspace notes, attachments, provider config, or runtime env values.
- [ ] Optional debug logging is explicit, redacted, and safe to leave enabled in local development.
- [ ] `additionalDirectories` and attachment references are enforced against a documented workspace/project path policy.
- [ ] Escapes via `..`, absolute-path injection, and symlink/canonical-path boundary violations are rejected with explicit API errors.
- [ ] Backend regression tests cover all three hardening areas and the full server suite remains green.

## Execution Order

1. Isolate request-scoped auth/provider configuration first.
2. Remove or redact sensitive logs second.
3. Tighten workspace path policy third.

This order reduces the highest-risk leakage paths first and keeps follow-up debugging safer.

## Plan

### 1. Request-Scoped Credential Isolation

- [ ] Audit every SDK call path that currently writes to `process.env`.
- [ ] Replace global env mutation with a request-scoped mechanism.
- [ ] Preserve current Claude subscription behavior and provider override behavior.
- [ ] Add regression tests for overlapping chat/auth/auto-name/context-summary requests.

Primary code paths:

- `apps/server/src/services/claude.ts`
- `apps/server/src/services/auth.ts`
- `apps/server/src/services/auto-namer.ts`
- `apps/server/src/services/context-summary.ts`

### 2. Sensitive Log Sanitization

- [ ] Remove raw request/prompt dumps from the chat route.
- [ ] Remove sidecar log forwarding that can leak sensitive payloads unless explicitly redacted.
- [ ] Add a small logging policy for safe structured fields and redaction behavior.
- [ ] Keep enough diagnostics to debug request flow without exposing secrets or prompt contents.

Primary code paths:

- `apps/server/src/routes/chat.ts`
- `apps/desktop/src/lib/sidecar.ts`

### 3. Workspace Path Boundary Enforcement

- [ ] Define an explicit allowlist policy for `additionalDirectories`.
- [ ] Enforce the policy during workspace create/update and chat execution.
- [ ] Keep attachment validation aligned with the same boundary model.
- [ ] Add regression coverage for repo-root, workspace-root, nested-child, and escape-path cases.

Primary code paths:

- `apps/server/src/routes/workspaces.ts`
- `apps/server/src/routes/chat.ts`
- `apps/server/src/utils/paths.ts`

## Notes

- Keeping the Claude runtime loop is intentional for now. This pass is about hardening the current architecture, not abstracting the runtime layer.
- Follow-up candidates after this pass: setup-command parsing hardening, sidecar port configurability, and restoring a green desktop baseline.
