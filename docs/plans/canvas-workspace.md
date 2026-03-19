# Canvas Workspace Feature Plan (DEFERRED)

> **Status: DEFERRED** — Tickets created for future implementation. Not actively being built.

## Context

Replace the sidebar-list + single-chat-view with an infinite canvas workspace (React Flow) where multiple chat threads live as spatial nodes. Users pan, zoom, drag nodes, annotate with sticky notes and arrows. Inspired by Figma/FigJam.

Includes a **split-pane view** as an intermediate step — 2-3 resizable vertical panels, each with a full chat, delivering 80% of the value at 20% of the complexity.

**Key design decision:** Instead of rendering multiple active streams simultaneously, **freeze inactive nodes** and show a "working" indicator. Only the focused node renders live streaming. This eliminates bandwidth/performance concerns.

---

## Architecture Principles

1. **New views, not replacements** — `'split'` and `'canvas'` join existing `activeView` enum. Zero changes to current chat/workspaces/teams.
2. **Parallel component, not refactored ChatPage** — Build `CanvasChatNode` as a new component that imports the same hooks. Never touch ChatPage.tsx.
3. **Modular by domain** — Canvas code lives entirely in `components/canvas/`, split-pane in `components/split/`, shared hooks in `hooks/canvas/`. No cross-contamination with existing code.
4. **Zustand scoped to canvas only** — Existing hooks-based state untouched.
5. **Freeze pattern** — Only focused node streams. Background nodes show frozen snapshot + working indicator via lightweight polling.

---

## Phased Implementation

### Phase 0: Prerequisites
- Add `canvas_layouts`, `canvas_nodes`, `canvas_edges` DB tables (additive, no schema changes)
- Add `GET /api/sessions/:id/status` endpoint + server-side `processingRegistry`
- Add `?after=<messageId>` param to `GET /api/sessions/:id/messages`
- Verify HTTP/1.1 vs HTTP/2, document connection limits
- Verify mermaid async rendering

### Phase 1: Split-Pane View
- Add `'split'` to `activeView` — 2-3 resizable vertical panels
- Each panel is an independent `CanvasChatNode` (new component, not ChatPage)
- One panel is "focused" (active streaming), others are frozen with working indicator
- Validates the multi-instance chat pattern before investing in canvas
- **Delivers 80% of multi-session value at 20% complexity**

### Phase 2: Static Canvas (No Streaming)
- Add `'canvas'` to `activeView`
- React Flow with session nodes (minimized/preview states only)
- Pan/zoom/drag/minimap, sticky notes
- Node positions persist to SQLite via debounced save
- Zustand canvas store for layout state

### Phase 3: Live Canvas (Single Active Node)
- Double-click node → active state with live streaming
- One active node at a time, others frozen
- Freeze + working indicator pattern (pulsing dot, "Needs input" for permissions)
- Re-focus catches up via `GET /messages?after=` polling

### Phase 4: Zoom-Level Modes
- Zoom thresholds determine node rendering fidelity
- `< 0.4` = minimized, `0.4–0.8` = preview, `> 0.8` = active-capable

### Phase 5: Multiple Active Nodes (if validated)
- Allow 2-3 simultaneous focused nodes (cap at 3 SSE connections)
- Only after split-pane and single-active canvas prove the UX

### Phase 6: Annotations & Edges
- User-drawn arrows, edge labels, colored sticky notes
- Group selection and move

---

## GitHub Issues

All marked **deferred**:

| # | Phase | Title |
|---|-------|-------|
| #176 | Epic | Canvas Workspace: Infinite canvas for multi-thread spatial UI |
| #177 | 0 | Prerequisites — DB schema, status endpoint, HTTP check |
| #178 | 1 | Split-pane view — multi-session side-by-side |
| #179 | 2 | Static canvas — React Flow with draggable session nodes |
| #180 | 3 | Live canvas — single active node with streaming |
| #181 | 4 | Zoom-level interaction modes |
| #182 | 5 | Multiple simultaneous active nodes |
| #183 | 6 | Annotations, edges, and FigJam-style notes |

---

## Risk Mitigations (from Codex Review)

| Risk | Mitigation |
|------|-----------|
| ChatPage refactor scope creep | Build `CanvasChatNode` as parallel component. Never modify ChatPage.tsx. |
| HTTP connection limits | Polling for background status (`GET /sessions/:id/status`), SSE only for focused node |
| DOM performance | Frozen nodes render `FrozenSnapshot` (plain text, <20 DOM elements). Full MessageList only when focused. |
| React Flow events | `nopan nodrag nowheel` classes + `stopPropagation` on inputs/scrollable areas |
| Node virtualization | Zustand `canvasSessionStore` holds all session state, survives mount/unmount cycles |
| Mermaid in bounded nodes | Singleton render queue, SVG width clamping, skip render when frozen |
| Freeze UX | 4-state machine: idle-empty, focused-streaming, frozen-working, frozen-idle. Background poll + missed-message fetch on re-focus. |

---

## Key New Files (Modular Structure)

```
apps/desktop/src/
├── components/
│   ├── split/                    # Phase 1 — Split-pane view
│   │   ├── SplitView.tsx
│   │   └── SplitPane.tsx
│   ├── canvas/                   # Phase 2+ — Canvas view
│   │   ├── CanvasView.tsx
│   │   ├── CanvasChatNode.tsx    # Independent chat node (parallel to ChatPage)
│   │   ├── FrozenSnapshot.tsx    # Lightweight frozen node renderer
│   │   ├── WorkingIndicator.tsx  # Pulsing dot + status label
│   │   ├── StickyNoteNode.tsx
│   │   └── CanvasMinimap.tsx
│   └── chat/
│       └── ChatPage.tsx          # UNTOUCHED — zero changes
├── hooks/
│   └── canvas/
│       ├── useBackgroundSessionStatus.ts  # Poll /sessions/:id/status
│       └── useMissedMessagePoll.ts        # Catch up on re-focus
├── stores/
│   ├── canvasStore.ts            # Layout: positions, zoom, viewport
│   └── canvasSessionStore.ts     # Session state: messages, streaming status
└── lib/
    └── mermaid-queue.ts          # Singleton render queue

apps/server/src/
├── routes/
│   └── canvas.ts                 # Canvas layout CRUD
├── services/
│   └── processing-registry.ts    # Track active streaming sessions
└── db/
    └── schema.ts                 # + canvas_layouts, canvas_nodes, canvas_edges
```
