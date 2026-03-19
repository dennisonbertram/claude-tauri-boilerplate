# Persistent Dashboard Artifacts V1 — Implementation Notes

## Date
2026-03-19

## Overview
Implements a durable, artifact-backed dashboard flow. Workspace chat can generate persisted dashboards via the `/dashboard` command. Dashboards are stored as first-class artifacts with revision history.

## Architecture

### Data Model (Phase 1)
Three new SQLite tables added to `apps/server/src/db/schema.ts`:
- `artifacts` — first-class artifact records (kind, title, project/workspace FK, status active/archived, current_revision_id)
- `artifact_revisions` — append-only revision history (spec_json, prompt, model, revision_number)
- `message_parts` — durable message parts linking messages to artifacts via `artifact_ref` parts

DB helpers in `apps/server/src/db/index.ts`: `createArtifact`, `getArtifact`, `listArtifactsByProject`, `setArtifactCurrentRevision`, `archiveArtifact`, `createArtifactRevision`, `getThreadMessages`, `updateArtifactTitle`, `countArtifactRevisions`. `addMessage` now accepts an optional `parts` array.

Shared types in `packages/shared/src/types.ts`: `Artifact`, `ArtifactRevision`, `MessagePart`, `ThreadMessage`, `ArtifactKind`, `ArtifactStatus`, `MessagePartType`.

### Backend Routes (Phase 2)
New routes registered in `apps/server/src/app.ts`:

| Route | File |
|-------|------|
| GET /api/artifacts/:id | routes/artifacts.ts |
| PATCH /api/artifacts/:id | routes/artifacts.ts |
| PATCH /api/artifacts/:id/archive | routes/artifacts.ts |
| POST /api/artifacts/:id/regenerate | routes/artifacts.ts |
| GET /api/projects/:id/artifacts | routes/artifacts.ts |
| POST /api/projects/:id/artifacts/generate | routes/artifacts.ts |
| GET /api/sessions/:id/thread | routes/sessions-thread.ts |

Generation and regeneration call `streamClaude` with a dashboard spec system prompt. Response is parsed with Zod (`dashboardSpecSchema`). Parse failures are stored with a `_parseError` field rather than failing the request.

### Frontend (Phases 3 + 4)
- `ArtifactBlock.tsx` — inline artifact card in message bubbles (icon, title, archive button)
- `WorkspaceDashboardsView.tsx` — two-panel listing + detail view; inline rename, archive, regenerate
- `WorkspacePanel.tsx` — new Dashboards tab (5th tab after Chat/Diff/Paths/Notes)
- `workspace-api.ts` — added: `fetchSessionThread`, `generateArtifact`, `fetchProjectArtifacts`, `archiveArtifact`, `renameArtifact`, `regenerateArtifact`
- `/dashboard` slash command in `useCommands.ts` → `generateDashboard` callback in `ChatPage.tsx`
- `MessageList.tsx` — loads thread parts and artifact map on mount; renders `ArtifactBlock` for artifact_ref parts

## Curl Verification Results (2026-03-19)

All endpoints verified against live server at `http://localhost:3131`:

| Endpoint | Result |
|----------|--------|
| POST /api/projects/:id/artifacts/generate | PASS — returned artifact + revision with valid spec JSON |
| GET /api/projects/:id/artifacts | PASS — listed active artifact |
| PATCH /api/artifacts/:id (rename) | PASS — title updated, updatedAt refreshed |
| POST /api/artifacts/:id/regenerate | PASS — created revision 2 with new spec, currentRevisionId updated |
| PATCH /api/artifacts/:id/archive | PASS — status changed to "archived" |
| GET /api/projects/:id/artifacts (post-archive) | PASS — empty array, archived artifact excluded |
| GET /api/sessions/:id/thread | PASS — returned 8 thread messages with parts arrays |

## Deferred
- Widget canvas rendering (currently shows spec JSON as code block)
- Dashboard embed in chat message thread (artifact_ref parts rendered as ArtifactBlock but not yet wired to the generate flow's output message)
- macOS Dock badge updates
