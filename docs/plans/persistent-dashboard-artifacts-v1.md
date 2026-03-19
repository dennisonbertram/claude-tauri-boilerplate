# Persistent Dashboard Artifacts V1 Plan

## Status

- In progress (Phase 1 foundation landed in this branch).

## Feature summary

Implement a durable, artifact-backed dashboard flow where workspace chat can create dashboards and those dashboards persist as first-class artifacts with revisions and thread references.

## Acceptance criteria

- [ ] `/dashboard <prompt>` in workspace chat creates a persistent dashboard artifact + revision.
- [ ] Chat thread persists message parts with artifact references and survives reload.
- [ ] Legacy sessions without `message_parts` still render correctly.
- [ ] Artifact revisions are append-only; regenerate creates a new revision.
- [ ] Archived artifacts are hidden from default lists but old thread references keep rendering read-only.

## Implementation checklist

### Phase 0 - Baseline and planning
- [x] Capture baseline targeted test runs and document status.
- [x] Create this plan doc and update docs indexes.

### Phase 1 - Data model and shared types
- [x] Add `artifacts`, `artifact_revisions`, and `message_parts` tables plus indexes.
- [x] Add DB migration helper for artifact/message part tables.
- [x] Add shared type scaffolding for dashboard artifacts + durable thread parts.
- [x] Add regression tests for:
  - [x] schema/table presence,
  - [x] legacy message fallback,
  - [x] revision linkage,
  - [x] archive semantics preserving old thread references.

### Phase 2 - Artifact services and routes
- [x] Add server artifact service + generation service (Claude Agent SDK query, Zod validation, retry-on-repair).
- [x] Add artifact CRUD/regenerate/runtime routes.
- [x] Add `GET /api/sessions/:id/thread` route.

### Phase 3 - Frontend chat artifact rendering
- [x] Add persisted artifact renderer layer (separate from transient tool renderers).
- [x] Load and render persisted thread parts inline under message bubbles.
- [x] Add `/dashboard` workspace-only interception and flow.

### Phase 4 - Dashboard surface
- [x] Add dashboards listing + full-page canvas surface in workspace/project UI.
- [x] Add rename/duplicate/archive/regenerate actions.

### Phase 5 - Docs + manual verification
- [ ] Document implementation details in `docs/implementation/` + index updates.
- [ ] Run backend curl verification for new endpoints.
- [ ] Run frontend browser-tool verification for dashboard chat + surface flows.
- [ ] Add engineering log final completion entry.
