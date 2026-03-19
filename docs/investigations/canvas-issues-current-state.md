# Canvas Workspace Issues - Current State

Captured 2026-03-18 from GitHub issues #176-#183.

---

## Issue #176: Canvas Workspace: Infinite canvas for multi-thread spatial UI
**State:** OPEN | **Labels:** backend, canvas-workspace, deferred, feature, frontend, large

### Epic: Canvas Workspace

Replace the sidebar-list + single-chat-view with an infinite canvas workspace (React Flow) where multiple chat threads live as spatial nodes. Users pan, zoom, drag nodes, annotate with sticky notes and arrows. Inspired by Figma/FigJam.

### Key Design Decisions

- **New views, not replacements** — `'split'` and `'canvas'` join existing `activeView` enum. Zero changes to current chat/workspaces/teams.
- **Parallel component, not refactored ChatPage** — Build `CanvasChatNode` as new component. Never touch ChatPage.tsx.
- **Freeze pattern** — Only focused node streams. Background nodes show frozen snapshot + working indicator via lightweight polling. Avoids HTTP connection exhaustion and DOM performance issues.
- **Split-pane view first** — Delivers 80% of multi-session value at 20% complexity, validates the pattern before full canvas investment.

### Phases

- [ ] Phase 0: Prerequisites (DB schema, status endpoint, HTTP/2 check)
- [ ] Phase 1: Split-pane view (2-3 resizable panels)
- [ ] Phase 2: Static canvas (React Flow, no streaming)
- [ ] Phase 3: Live canvas (single active node streaming)
- [ ] Phase 4: Zoom-level interaction modes
- [ ] Phase 5: Multiple simultaneous active nodes
- [ ] Phase 6: Annotations and edges

### Architecture Review

Full plan with risk mitigations from GPT-5.4 review at: `docs/plans/canvas-workspace.md` (to be created from `.claude/plans/binary-noodling-forest.md`)

### Modular File Structure

```
components/split/         # Phase 1 — Split-pane view
components/canvas/        # Phase 2+ — Canvas view
hooks/canvas/             # Canvas-specific hooks
stores/canvasStore.ts     # Layout state (Zustand, scoped)
stores/canvasSessionStore.ts  # Session state per node
lib/mermaid-queue.ts      # Singleton render queue
routes/canvas.ts          # Backend canvas CRUD
services/processing-registry.ts  # Track active streams
```

### Risk Summary

| Risk | Mitigation |
|------|-----------|
| ChatPage scope creep | Parallel component, never modify ChatPage |
| HTTP connection limits | Polling for background status, SSE only for focused node |
| DOM performance | FrozenSnapshot (<20 elements) for unfocused nodes |
| React Flow events | nopan/nodrag/nowheel classes + stopPropagation |
| Node virtualization | Zustand store survives mount/unmount |
| Mermaid in bounded nodes | Singleton queue, SVG clamping, skip when frozen |

---

## Issue #177: Canvas Phase 0: Prerequisites — DB schema, status endpoint, HTTP check
**State:** OPEN | **Labels:** backend, canvas-workspace, deferred, medium

### Phase 0: Prerequisites

Parent: #176

Prepare the codebase for canvas features without writing any canvas UI code.

### Tasks

- [ ] **Add canvas DB tables** (additive, no existing schema changes)
  - `canvas_layouts` — one per project/workspace, stores viewport state
  - `canvas_nodes` — session nodes, sticky notes, annotations with position/size/state
  - `canvas_edges` — visual arrows between nodes
  - File: `apps/server/src/db/schema.ts`

- [ ] **Add `GET /api/sessions/:id/status` endpoint**
  - Returns `{ sessionId, isProcessing, lastActivity, hasPendingPermission }`
  - Server-side `processingRegistry` (in-memory Set) tracks active streams
  - New file: `apps/server/src/services/processing-registry.ts`
  - Updated: `apps/server/src/routes/chat.ts` (wrap stream start/end)

- [ ] **Add `?after=<messageId>` to `GET /api/sessions/:id/messages`**
  - Returns only messages newer than the given ID
  - Simple SQLite: `WHERE id > ? ORDER BY created_at ASC`
  - File: `apps/server/src/routes/sessions.ts`

- [ ] **Add canvas layout CRUD routes**
  - New file: `apps/server/src/routes/canvas.ts`
  - CRUD for layouts, nodes, edges

- [ ] **Verify HTTP/1.1 vs HTTP/2**
  - Check Hono/Bun's default protocol
  - Document the connection limit (6 for HTTP/1.1)
  - If HTTP/1.1: hard-cap simultaneous active streams to 3

- [ ] **Verify mermaid async rendering**
  - File: `apps/desktop/src/components/chat/MermaidDiagram.tsx`
  - If synchronous, create `lib/mermaid-queue.ts` singleton render queue

### Acceptance Criteria

- All existing tests pass (zero regressions)
- New endpoints return correct data
- Canvas tables created via migration
- No changes to existing ChatPage or session components

---

## Issue #178: Canvas Phase 1: Split-pane view — multi-session side-by-side
**State:** OPEN | **Labels:** canvas-workspace, deferred, frontend, large

### Phase 1: Split-Pane View

Parent: #176
Depends on: Phase 0

**Delivers 80% of multi-session value at 20% of canvas complexity.** Validates the multi-instance chat pattern before investing in the full canvas.

### Description

Add a `'split'` view to `activeView` — 2-3 resizable vertical panels, each containing an independent `CanvasChatNode`.

### Tasks

- [ ] **Build `CanvasChatNode` component** (new, parallel to ChatPage)
  - Imports same hooks (`useStreamEvents`, `useChat`) but renders stripped-down UI
  - No StatusBar integration, no global keyboard shortcuts, no checkpoint timeline
  - Just: MessageList + ChatInput + PermissionDialog
  - File: `apps/desktop/src/components/canvas/CanvasChatNode.tsx`

- [ ] **Build `FrozenSnapshot` component**
  - Plain text preview of last 3 messages (<20 DOM elements)
  - Working indicator (pulsing dot + status label)
  - File: `apps/desktop/src/components/canvas/FrozenSnapshot.tsx`

- [ ] **Build `SplitView` container**
  - 2-3 resizable vertical panels
  - One panel is "focused" (active streaming), others show `FrozenSnapshot`
  - Click a frozen panel → it becomes focused, previous freezes
  - File: `apps/desktop/src/components/split/SplitView.tsx`

- [ ] **Add background status hooks**
  - `useBackgroundSessionStatus` — polls `/sessions/:id/status` every 2s when unfocused
  - `useMissedMessagePoll` — fetches messages since freeze point on re-focus
  - Files: `apps/desktop/src/hooks/canvas/`

- [ ] **Add `'split'` to view tabs** in sidebar

### Freeze Pattern UX

| Node State | Visual |
|-----------|--------|
| `focused-streaming` | Full chat UI, text streaming in |
| `focused-complete` | Full chat UI, input ready |
| `frozen-working` | Snapshot + pulsing dot "Working..." |
| `frozen-idle` | Snapshot, no indicator |

Re-focusing a frozen-working node: hydrate from Zustand store, poll `/messages?after=` to catch up, no SSE reconnect.

### Acceptance Criteria

- Split view renders 2-3 independent chat sessions side-by-side
- Only focused panel maintains SSE connection
- Frozen panels show working indicator when backend is processing
- Re-focusing catches up on missed messages
- Existing chat view completely untouched
- Zero changes to ChatPage.tsx

---

## Issue #179: Canvas Phase 2: Static canvas — React Flow with draggable session nodes
**State:** OPEN | **Labels:** canvas-workspace, deferred, frontend, large

### Phase 2: Static Canvas (No Streaming)

Parent: #176
Depends on: Phase 1

### Description

Add `'canvas'` to `activeView`. React Flow infinite canvas with session nodes you can drag around. No live chat yet — nodes display session data fetched from DB.

### Tasks

- [ ] **Install dependencies**: `reactflow`, `zustand`
- [ ] **Create `useCanvasStore`** (Zustand, scoped to canvas only)
  - Node positions, sizes, states, viewport/zoom
  - Sticky note content
  - Edge definitions
  - File: `apps/desktop/src/stores/canvasStore.ts`

- [ ] **Create `CanvasView` component** wrapping React Flow
  - Pan/zoom/drag/minimap
  - Custom node types: `session`, `sticky_note`
  - File: `apps/desktop/src/components/canvas/CanvasView.tsx`

- [ ] **Create `ChatNode` for canvas** (minimized + preview states)
  - Minimized: title card + status indicator
  - Preview: last 3 messages as plain text (FrozenSnapshot)
  - Fixed sizes per state (no auto-sizing)
  - File: `apps/desktop/src/components/canvas/ChatNode.tsx`

- [ ] **Create `StickyNoteNode`**
  - Colored, editable, draggable text notes
  - File: `apps/desktop/src/components/canvas/StickyNoteNode.tsx`

- [ ] **Persist layout to SQLite** via debounced save (1s after last drag)
  - Save node positions, viewport state to `canvas_layouts` / `canvas_nodes`
  - Load on canvas mount

- [ ] **Add `'canvas'` to sidebar view tabs**

### React Flow Gotchas to Handle

- `stopPropagation` on all inner interactive elements
- Portal z-index for dropdowns/tooltips inside nodes
- `nopan nodrag nowheel` classes on interactive content areas

### Acceptance Criteria

- Canvas view loads with existing sessions as draggable nodes
- Pan/zoom/minimap work smoothly
- Node positions persist across page reload
- Sticky notes create/edit/delete/drag
- 20 nodes maintain 60fps canvas interaction
- Existing views completely untouched

---

## Issue #180: Canvas Phase 3: Live canvas — single active node with streaming
**State:** OPEN | **Labels:** canvas-workspace, deferred, frontend, large

### Phase 3: Live Canvas (Single Active Node)

Parent: #176
Depends on: Phase 2

### Description

Enable one canvas node at a time to be "active" with live chat streaming. All other nodes remain frozen with working indicators. Uses the freeze pattern validated in Phase 1 split-pane view.

### Tasks

- [ ] **Double-click node → active state** renders full `CanvasChatNode`
- [ ] **One active node at a time** enforced by canvas store
- [ ] **Freeze + working indicator** on all other nodes
  - Pulsing dot "Working..." when backend is processing
  - "Needs input" (yellow) when permission dialog pending
  - Checkmark "Done" (3s fade) when processing completes
- [ ] **Re-focus catch-up**: hydrate from Zustand, poll `/messages?after=` for missed messages
- [ ] **Zustand `canvasSessionStore`** survives node mount/unmount (React Flow virtualization)
  - Messages, streaming status, last preview all persisted in store
  - Nodes hydrate from store on mount via `initialMessages`
- [ ] **Click outside or Escape** → node returns to preview/frozen state
- [ ] **StatusBar** shows focused node's status

### Node State Machine

```
idle-empty → focused-streaming → frozen-working → focused-streaming (re-focus)
                               → frozen-idle
           → focused-complete  → frozen-idle
```

### Acceptance Criteria

- Can open a node, send a message, receive streaming response on canvas
- Switching nodes freezes previous, activates new
- Working indicator visible on frozen-but-processing nodes
- Re-focus catches up without replaying stream
- Permission dialogs surface correctly on frozen nodes

---

## Issue #181: Canvas Phase 4: Zoom-level interaction modes
**State:** OPEN | **Labels:** canvas-workspace, deferred, frontend, medium

### Phase 4: Zoom-Level Interaction Modes

Parent: #176
Depends on: Phase 3

### Description

Zoom level determines node rendering fidelity. Smooth transitions between states as user zooms in/out.

### Tasks

- [ ] **Zoom thresholds**
  - `< 0.4` = minimized (title card only)
  - `0.4–0.8` = preview (FrozenSnapshot with last messages)
  - `> 0.8` = active-capable (can double-click to activate)
- [ ] **Smooth transitions** between states using CSS transitions
- [ ] **`useUpdateNodeInternals()`** on state transitions for size changes
- [ ] **Minimap** reflects current node states with visual indicators

### Acceptance Criteria

- Zooming in/out smoothly transitions node rendering
- No layout thrashing during zoom
- Minimap shows accurate node state representation

---

## Issue #182: Canvas Phase 5: Multiple simultaneous active nodes
**State:** OPEN | **Labels:** backend, canvas-workspace, deferred, frontend, large

### Phase 5: Multiple Simultaneous Active Nodes

Parent: #176
Depends on: Phase 4

### Description

Allow 2-3 nodes to be simultaneously active with live streaming. Only pursue this after split-pane and single-active canvas prove the UX need.

### Tasks

- [ ] **Remove one-active-at-a-time constraint** (configurable cap: 3)
- [ ] **SSE connection management**: connect when active, disconnect when frozen
- [ ] **Performance guardrails**: if frame rate drops below 30fps, auto-minimize LRU nodes
- [ ] **StatusBar** shows focused (last-interacted) node's status
- [ ] **HTTP/2 verification** required before this phase (or WebSocket multiplexer)

### Risks

- HTTP/1.1 limits 6 SSE connections per origin. 3 active streams + API calls = at limit.
- Must verify HTTP/2 or implement WebSocket multiplexer before shipping.
- Performance with 3 simultaneous markdown renderers needs profiling.

### Acceptance Criteria

- 3 active nodes stream simultaneously without frame drops
- Connection count stays within browser limits
- Auto-minimize kicks in when performance degrades

---

## Issue #183: Canvas Phase 6: Annotations, edges, and FigJam-style notes
**State:** OPEN | **Labels:** canvas-workspace, deferred, frontend, medium

### Phase 6: Annotations and Edges

Parent: #176
Depends on: Phase 3 (minimum), Phase 5 (ideal)

### Description

FigJam-style annotations: user-drawn arrows between nodes, edge labels, colored sticky notes with enhanced editing, group selection and move.

### Tasks

- [ ] **Arrow edges** between nodes (React Flow custom edge types)
- [ ] **Edge labels** — editable text on connections
- [ ] **Enhanced sticky notes** — color picker, rich text, resize
- [ ] **Group selection** — select multiple nodes, move together
- [ ] **Persist edges** to `canvas_edges` table

### Note from Review

This requires significant UX polish (snapping, handles, label editing in place, click-to-delete). It's a full mini-feature. Should not block earlier phases.

### Acceptance Criteria

- Can draw arrows between any two nodes
- Arrows persist across reload
- Sticky notes with color options
- Multi-select and group drag

---

## Gaps

The following gaps and thin areas were identified across the issue set:

### Phase 0 (#177)
- **No DB schema DDL.** Lists table names and columns conceptually but provides no actual `CREATE TABLE` statements, column types, indexes, or constraints. An implementing agent would have to design the schema from scratch.
- **No API response shapes.** The status endpoint says it returns `{ sessionId, isProcessing, ... }` but there are no Zod schemas, TypeScript types, or shared type definitions specified.
- **Canvas CRUD routes are vague.** "CRUD for layouts, nodes, edges" has no endpoint paths, request/response shapes, or error handling specified.
- **No migration strategy.** Says "canvas tables created via migration" but the project uses direct SQLite schema — no migration tooling exists. How tables get created is unaddressed.

### Phase 1 (#178)
- **No resizer library chosen.** Says "2-3 resizable vertical panels" but doesn't specify which library (react-resizable-panels, allotment, custom CSS resize, etc.).
- **No keyboard navigation spec.** How does the user switch focus between panels? Tab? Ctrl+1/2/3? Unspecified.
- **Session selection UX missing.** How does a user pick which sessions go in which panels? Drag from sidebar? Dropdown? No design provided.

### Phase 2 (#179)
- **React Flow version unspecified.** The library was renamed from `reactflow` to `@xyflow/react` in v12. The import name in the issue is outdated.
- **No "add node to canvas" UX.** Describes nodes on canvas but never specifies how a user adds a new session node or sticky note (context menu? toolbar? drag from sidebar?).
- **Canvas-to-DB persistence details thin.** Says "debounced save" but doesn't specify whether this is a full layout overwrite or incremental patch, or how conflicts with multiple open canvases would work.

### Phase 3 (#180)
- **No error/disconnect handling.** What happens if the SSE stream drops mid-response? What if the backend crashes while a node shows "Working..."? No recovery path specified.
- **Active node size/layout unclear.** When a node becomes active with full chat UI, does it expand in place? Open a modal overlay? Resize within React Flow? Not specified.
- **No scroll behavior spec.** Active node with full message list — does the canvas auto-pan to keep the node visible? Does the node have internal scroll?

### Phase 4 (#181)
- **Thinnest issue overall.** Four tasks, four acceptance criteria, no implementation detail. No discussion of how zoom thresholds interact with the active node (can you activate a node at zoom 0.3?). No performance budget for transition animations.
- **No debounce/throttle on zoom-triggered re-renders.** Rapid zoom could cause excessive state transitions.

### Phase 5 (#182)
- **No WebSocket multiplexer design.** Lists it as a fallback but provides zero detail on how it would work, what protocol it would use, or how it maps to existing SSE-based streaming.
- **Auto-minimize heuristic undefined.** Says "auto-minimize LRU nodes" but no detail on how LRU is tracked, what the fps measurement mechanism is, or how the user is informed.
- **No testing strategy.** Hardest phase to test — simultaneous streams, performance thresholds, connection limits. No test plan or tooling mentioned.

### Phase 6 (#183)
- **Very high-level.** Essentially a feature wish list with no implementation detail.
- **No edge data model.** Says "persist edges" but the schema for edges (source handle positions, label content, styling) is not defined.
- **Rich text in sticky notes is a rabbit hole.** Mentioned casually but rich text editing (contentEditable, ProseMirror, Tiptap, etc.) is a significant sub-feature with no library or approach chosen.
- **No design mockups or wireframes referenced** for any annotation UX.

### Cross-Cutting Gaps
- **No shared types defined.** Canvas node states, layout types, edge types — none of these are specified in `packages/shared/`. Every phase will need them.
- **No test plan for any phase.** The project mandates TDD (CLAUDE.md section 5), but none of the issues include test specifications or test file locations.
- **No performance benchmarks.** Phases 2-5 reference "60fps" and "no frame drops" but no profiling methodology, measurement tools, or baseline numbers are provided.
- **No accessibility considerations.** Keyboard navigation, screen reader support, focus management on an infinite canvas — completely unaddressed.
- **No undo/redo.** Moving nodes, editing sticky notes, drawing edges — no undo support mentioned anywhere.
