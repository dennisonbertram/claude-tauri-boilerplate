# Canvas Workspace UX Design Research

**Date:** 2026-03-18
**Purpose:** UX design research for the canvas workspace feature — an infinite canvas where multiple Claude chat sessions live as spatial nodes, inspired by Figma/FigJam but purpose-built for AI conversations.
**Related:** [Canvas Workspace Feature Plan](../plans/canvas-workspace.md) | [Canvas Issues Current State](canvas-issues-current-state.md)

---

## Table of Contents

1. [Canvas UX Patterns from Leading Tools](#1-canvas-ux-patterns-from-leading-tools)
2. [Split-Pane vs Canvas Tradeoffs](#2-split-pane-vs-canvas-tradeoffs)
3. [Frozen / Inactive Node UX](#3-frozen--inactive-node-ux)
4. [Spatial Organization UX](#4-spatial-organization-ux)
5. [Performance Perception](#5-performance-perception)
6. [Accessibility Considerations](#6-accessibility-considerations)
7. [Recommendations for Our Implementation](#7-recommendations-for-our-implementation)

---

## 1. Canvas UX Patterns from Leading Tools

### 1.1 Figma / FigJam

Figma is the gold standard for infinite canvas UX. What makes it feel great:

**Rendering Architecture**
- Custom GPU-rendered tile-based engine (WebGL, now migrating to WebGPU). All rendering bypasses the browser's DOM pipeline and talks directly to the GPU. [Source](https://www.figma.com/blog/figma-rendering-powered-by-webgpu/)
- C++ core compiled to WebAssembly for native-like performance. Figma's rendering engine was "often faster than the rendering engines in competitor's native applications." [Source](https://madebyevan.com/figma/)
- They target 60fps and have achieved it for both zooming and dragging in benchmark documents. For dragging, they improved from 30fps to 60fps average. [Source](https://www.figma.com/blog/keeping-figma-fast/)

**Canvas Navigation**
- `Cmd/Ctrl + scroll` for zoom in/out, `Space + drag` for panning, `Z + drag` for zoom region
- `Shift+1` to fit all content, `Shift+2` to zoom to selection — key for jumping between distant elements
- Arrow keys pan when nothing is selected, `H` activates hand tool [Source](https://help.figma.com/hc/en-us/articles/360040328653-Use-Figma-products-with-a-keyboard)
- Snapping and smart guides provide immediate visual feedback when elements align

**Organization**
- Groups combine related items that move as one unit
- Frames define independent coordinate spaces with fixed bounds (unlike groups which auto-resize)
- Sections (added later) provide semantic grouping for board organization, similar to Miro's frames [Source](https://www.figma.com/best-practices/groups-versus-frames/)

**What makes it feel great:** Precision (snapping, alignment guides), responsiveness (GPU rendering, no frame drops during interaction), undo/redo for fearless exploration, and real-time collaboration (live cursors, edit locking).

### 1.2 tldraw

tldraw is the most relevant open-source reference for our canvas. Key patterns:

**Architecture**
- Framework-agnostic core (`@tldraw/editor`) with higher-level React UI packages
- R-tree spatial indexing for O(log n) shape queries — critical for brush selection, hover detection, and culling off-screen elements [Source](https://deepwiki.com/tldraw/tldraw)
- Shape indicators (selection outlines, hover states) render via 2D canvas instead of SVG, achieving up to 25x faster rendering for many shapes

**Performance Techniques**
- Event batching: input events buffered and dispatched per tick instead of immediately
- Centralized culling: reduces subscription overhead from O(N) to O(1) for on-screen shapes
- `useQuickReactor` for transform updates without React re-renders during pan/zoom
- WebGL-powered minimap for smooth navigation at all zoom levels [Source](https://tldraw.dev/releases/v2.1.0)

**Lessons for us:** tldraw proves that a React-based canvas can feel smooth with proper architectural decisions. Their culling approach and event batching patterns are directly applicable to our chat node canvas.

### 1.3 Cursor / Windsurf (AI Coding IDEs)

These tools use a fundamentally different model than canvas — they're split-pane IDEs with a chat sidebar.

**Cursor**
- VS Code fork with an AI chat panel on the right side
- Agent mode generates code across multiple files, runs commands, auto-discovers context
- More fine-grained control over context — users manually include/exclude files [Source](https://cursor.com/)

**Windsurf**
- Cleaner, more consumer-product-like UX compared to Cursor ("Apple product vs Microsoft one")
- Agentic mode is the default — the agent indexes and pulls relevant code automatically
- Codemaps feature: AI-annotated visual maps of code structure (closest thing to canvas thinking in a coding tool) [Source](https://windsurf.com/compare/windsurf-vs-cursor)

**Lesson:** Coding tools haven't adopted canvas because code editing is inherently single-focus. But Windsurf's Codemaps hint at spatial understanding as a navigation aid, not a primary workspace.

### 1.4 AI-Specific Canvas Tools

This is the most directly relevant category. Several tools have emerged that put AI conversations on an infinite canvas:

**ChatGPT Canvas**
- Dual-panel layout: chat on the right, editable work artifact on the left
- Not a true infinite canvas — more of a co-authorship workspace
- Users can highlight specific sections for targeted feedback
- The key insight: separating the work product from the conversation makes iteration faster [Source](https://openai.com/index/introducing-canvas/)

**RabbitHoles AI** ($39 one-time purchase)
- True infinite canvas where each node is a separate AI conversation
- Nodes can branch into multiple directions, sharing context selectively
- Multi-model support (OpenAI, Anthropic, Google, local models via Ollama)
- Content nodes: add files, websites, connect them to chat nodes
- Local-first: all data stored on device, exportable as JSON/markdown
- User feedback: "Everything on a single canvas, well organized and connected by nodes" [Source](https://www.rabbitholes.ai/)

**Nodeline AI**
- Similar concept to RabbitHoles: infinite canvas with branching conversations
- Each node is a conversation, branched conversations share context
- Local-first, privacy-focused, supports multiple AI providers [Source](https://www.nodelineai.com/)

**Canvas Chat** (open source, by Eric Ma)
- Visual non-linear chat interface with directed graph topology
- Key innovation: **highlight-and-branch** — select text within a node, ask a follow-up, creates excerpt + question + response as connected nodes
- **Multi-select merge**: Cmd-click multiple nodes to synthesize across branches. System deduplicates ancestor context.
- **Matrix evaluation**: Compare options against criteria in grid form, with context from the DAG
- Context flow: walks the DAG backward from selected nodes, collecting all ancestors sorted by creation time [Source](https://ericmjl.github.io/blog/2025/12/31/canvas-chat-a-visual-interface-for-thinking-with-llms/)

**Project Nodal**
- Local-first infinite canvas that turns linear AI chats into a spatial knowledge graph
- Uses embeddings + PCA for semantic spatial clustering — related conversations naturally cluster together [Source](https://github.com/yibie/project-nodal)

**Key Pattern Across All:** Every AI canvas tool treats conversations as persistent spatial objects rather than ephemeral chat scrolls. The value proposition is always the same: nonlinear thinking requires nonlinear interfaces.

### 1.5 Post-Chat UI Movement

Allen Pike's influential "Post-Chat UI" essay argues that chat should be "a debug interface — a fallback mode — and not the primary UX." Key patterns emerging beyond chat:

1. **Co-authorship** — Work product front-and-center, chat is secondary (ChatGPT Canvas, Cursor)
2. **Generative right-click** — AI actions surfaced through context menus on specific objects
3. **Type instead of pick** — Natural language replacing dropdowns (Command-K bars)
4. **Inline feedback** — "Writing daemons" with configurable personalities providing real-time commentary
5. **Tab completion** — Proactively suggest and execute predictable next actions
6. **Multimodal interaction** — Talk and point simultaneously

[Source: Post-Chat UI by Allen Pike](https://allenpike.com/2025/post-chat-llm-ui/)

**Relevance:** Our canvas is actually a post-chat UI. The canvas itself becomes the primary workspace; the chat within each node is the means, not the end.

---

## 2. Split-Pane vs Canvas Tradeoffs

### 2.1 When Split-Pane Wins

| Scenario | Why Split-Pane is Better |
|----------|-------------------------|
| Comparing two outputs | Side-by-side is the natural metaphor; canvas adds unnecessary spatial freedom |
| Code review workflows | Diff-like comparison needs fixed columns, not freeform placement |
| New users | Zero learning curve — resizable panels are universally understood |
| Small number of sessions (2-3) | Canvas overhead not justified when simple tiling works |
| Keyboard-only users | Tab between panes is trivial; canvas spatial navigation is not |

### 2.2 When Canvas Wins

| Scenario | Why Canvas is Better |
|----------|---------------------|
| 5+ simultaneous sessions | Tiling breaks down; spatial organization scales indefinitely |
| Research workflows | Users need to see relationships between threads, not just content |
| Long-running background tasks | Minimap + status indicators show all work at a glance |
| Annotation and planning | Arrows, sticky notes, and grouping are only possible on canvas |
| Context cherry-picking | Visual proximity signals which conversations share context |

### 2.3 Progressive Disclosure Strategy

The key UX principle from Nielsen Norman Group: "defer secondary options to a subsidiary screen" to focus users on primary options shown by default. [Source](https://www.nngroup.com/articles/progressive-disclosure/)

**Recommended progression for our app:**

```
Level 0: Single chat view (current — default)
     ↓ User clicks "Split View" or drags a session to the side
Level 1: Split-pane (2-3 panels)
     ↓ User clicks "Open Canvas" or reaches 4+ sessions
Level 2: Full infinite canvas
```

**The transition must feel continuous, not modal:**
- Split view should feel like "I pulled another chat next to this one"
- Canvas should feel like "I zoomed out and can see everything"
- The key insight from Miro: animated transitions between views provide spatial context. When toggling to canvas, the current chat should animate to become a node at its position. [Source](https://community.miro.com/ideas/adding-transition-animation-to-miro-boards-like-in-powerpoint-prezi-1219)

**Risk: Oversimplification**
Progressive disclosure can "oversimplify the product and limit what users can achieve; oversimplification affects usability for advanced users and can give the impression that the software lacks depth." [Source](https://www.uxpin.com/studio/blog/what-is-progressive-disclosure/) We must ensure canvas features are discoverable even when not front-and-center.

---

## 3. Frozen / Inactive Node UX

This is the most novel UX challenge in our design. No existing tool has exactly this pattern — multiple AI chat sessions where only one streams live and others show frozen state with background processing indicators.

### 3.1 Status Indicator Design

**Four-state model** (aligned with the existing plan):

| State | Visual Treatment | Information Shown |
|-------|-----------------|-------------------|
| **idle-empty** | Muted card, plus icon | "Start a conversation" |
| **focused-streaming** | Full chat, active border, streaming tokens | Live message list with streaming response |
| **frozen-working** | Frozen snapshot + pulsing indicator | Last message preview, "Claude is working...", elapsed time, pulsing dot |
| **frozen-idle** | Frozen snapshot, no animation | Last message preview, message count, last activity timestamp |

**Design principles from the Workday Canvas Design System:**
- Color communicates status meaning consistently across the app (green = idle/done, amber = working, blue = focused)
- Loading patterns "provide feedback that information is still processing and that the screen is not frozen" [Source](https://canvas.workday.com/patterns/loading/)
- Status dots indicate binary state (active/inactive) and are "commonly seen in design patterns like Notifications or Activity indicators" [Source](https://mobbin.com/glossary/status-dot)

### 3.2 What to Show in a Frozen Node

Based on analysis of Canvas Chat, RabbitHoles, and Nodeline patterns:

**Minimized state (zoomed out / `< 0.4` zoom):**
- Session title (1 line, truncated)
- Status dot (color-coded: green idle, amber working, red needs input)
- Message count badge

**Preview state (mid zoom / `0.4-0.8`):**
- Session title
- Last assistant message (2-3 lines, truncated)
- Status indicator with label ("Working...", "Idle", "Needs permission")
- Time since last activity

**Active-capable state (zoomed in / `> 0.8`):**
- Full frozen snapshot of last few messages
- Click/double-click to activate and begin streaming

### 3.3 "Needs Input" Special State

When a frozen node's background session hits a permission prompt (tool approval, file write confirmation), it needs to grab attention without being disruptive:

- Amber pulsing border (not red — that implies error)
- Status label: "Needs your input"
- Optional: brief toast notification if the user is focused on another node
- **Never interrupt the focused node's streaming** — queue the notification

### 3.4 Background Activity Indicators

Avoid spinners (they feel like blocking); prefer subtle motion:

- **Pulsing dot**: Small circle with opacity animation (60% → 100% → 60%, 2s cycle)
- **Token count ticker**: If available, show approximate tokens generated (e.g., "~340 tokens")
- **Progress hint**: If the task has predictable length, show a thin progress bar at the bottom of the card
- **Elapsed time**: "Working for 12s" — gives user a sense of how long the operation is taking

---

## 4. Spatial Organization UX

### 4.1 How Users Naturally Organize Chat Threads

Research from visual AI chat tools and whiteboard apps reveals consistent patterns:

**Clustering by topic:** Users place related conversations near each other. Project Nodal takes this further with embedding-based semantic clustering — conversations about similar topics automatically drift toward each other. [Source](https://github.com/yibie/project-nodal)

**Timeline/workflow ordering:** Left-to-right or top-to-bottom arrangement reflecting chronological or dependency order (similar to Kanban boards).

**Hub-and-spoke:** A "main" research conversation in the center with exploratory branches radiating outward (the natural topology for Canvas Chat's DAG model). [Source](https://ericmjl.github.io/blog/2025/12/31/canvas-chat-a-visual-interface-for-thinking-with-llms/)

**Separation by status:** Active work on one side, completed/reference conversations on another. Users create spatial "zones" similar to Miro frames.

### 4.2 Auto-Layout vs Manual Positioning

**Auto-layout algorithms** (from React Flow, G6, yFiles research):

| Algorithm | Best For | Notes |
|-----------|---------|-------|
| **Hierarchical/tree** | Branching conversations | Minimizes edge crossings, shows parent-child relationships |
| **Force-directed** | Topic clustering | Nodes repel/attract based on connections, organic feel |
| **Grid/tile** | Equal-importance sessions | Clean, predictable, works well for small counts |
| **Radial** | Hub-and-spoke workflows | Central node with branches radiating outward |

[Source: React Flow auto-layout](https://reactflow.dev/examples/layout/auto-layout) | [Source: G6 layouts](https://g6.antv.antgroup.com/en/manual/plugin/minimap)

**Recommendation: Hybrid approach**
1. **Initial placement**: Auto-layout when creating new nodes (grid for first 4, then force-directed)
2. **Manual override**: User drags always take priority and persist
3. **Re-layout button**: "Tidy up" function that re-applies auto-layout to all nodes (with animation)
4. **Smart placement**: New nodes appear near the node they were created from (e.g., fork → place adjacent to parent)

React Flow's dynamic layouting example shows smooth animated transitions when nodes reposition — this is critical for the re-layout feature to feel good. [Source](https://reactflow.dev/examples/layout/dynamic-layouting)

### 4.3 Grouping and Color Coding

**Frames/Sections** (from Figma and Miro):
- Named rectangular regions that visually group related nodes
- Color-coded backgrounds (e.g., blue for "research", green for "implementation", red for "debugging")
- Nodes inside a frame move together when the frame is dragged
- Miro's approach: frames are created by selecting objects and clicking "frame", or by drawing a region [Source](https://help.miro.com/hc/en-us/articles/360018261813-Frames)

**Sticky Notes/Annotations:**
- Small text nodes for labels, reminders, or context
- Color-coded (yellow for notes, pink for warnings, green for done)
- Connectable to chat nodes via edges

**Edge Labels:**
- Edges between nodes carry labels explaining the relationship ("forked from", "context shared", "depends on")

### 4.4 Minimap

The minimap is essential once the canvas exceeds viewport bounds.

**Best practices from tldraw and G6:**
- Thumbnail view of the entire canvas in a corner (bottom-right is conventional)
- Current viewport shown as a highlighted rectangle that can be dragged to navigate
- tldraw uses WebGL for the minimap for smooth rendering even with many shapes [Source](https://tldraw.dev/releases/v2.1.0)
- G6 supports three minimap modes: `default` (all shapes), `keyShape` (simplified outlines), `delegateShape` (colored rectangles) [Source](https://g6.antv.antgroup.com/en/manual/plugin/minimap)
- Allow hiding shapes from the minimap (tldraw's `hideInMinimap` option) — useful for hiding sticky notes or annotations at overview level
- React Flow provides a built-in `<MiniMap />` component with customizable node rendering

**For our app:** Use React Flow's MiniMap with color-coded dots per node status (green = idle, amber = working, blue = focused). This gives instant "what's happening across my workspace" visibility.

---

## 5. Performance Perception

### 5.1 Making Freeze/Unfreeze Feel Instant

The 200ms threshold is critical: "humans can perceive discrete images in as little as 13 milliseconds, however deciding where to focus takes between 100 and 140 milliseconds, giving us around 200 milliseconds to present a user interface state change in order to appear instant." [Source](https://www.nngroup.com/articles/skeleton-screens/)

**Freeze (active → frozen):**
1. Immediately capture the last rendered state as a static snapshot (plain text + basic formatting)
2. Replace the live `MessageList` component with the lightweight `FrozenSnapshot` component
3. Add status indicator overlay
4. Total time budget: < 50ms (just a React state swap, no network calls)

**Unfreeze (frozen → active):**
1. Show the frozen snapshot immediately (it's already there)
2. Swap in the full `MessageList` component
3. Fetch missed messages via `GET /messages?after=lastMessageId`
4. Animate new messages in (slide up, fade in)
5. Resume SSE stream if still active
6. Target: snapshot visible in < 50ms, full state restored in < 300ms

### 5.2 Skeleton States vs Snapshots

**Skeleton screens** "don't speed up load times — they just make it feel faster. By mimicking the UI layout, skeleton screens help users perceive a page loading 20 to 30% faster than with traditional spinners." [Source](https://blog.logrocket.com/ux-design/skeleton-loading-screen-design/)

**For our use case, snapshots beat skeletons:**
- We already have the content (the last few messages). Showing a skeleton when we have real data is worse.
- Use skeletons only for the initial load of a brand-new canvas (before any session data is fetched)
- For node unfreezing, show the frozen snapshot (real content) and progressively enhance with live data

**Animation patterns for focus transitions:**
- Pulsing skeleton shimmer (left-to-right gradient sweep) for initial load only
- Slide-up animation for new messages appearing during catch-up
- Smooth zoom animation when double-clicking a node to focus (canvas viewport animates to center the node)
- Cross-fade between frozen and active states (150ms ease-out)

### 5.3 Figma's Performance Lessons

Figma's approach is instructive even though our canvas is simpler:

1. **GPU rendering where it matters:** Figma renders the canvas via GPU, but UI chrome is standard React. We should do the same — React Flow handles the canvas, React handles node interiors. [Source](https://andrewkchan.dev/posts/figma2.html)
2. **Throttle canvas rendering:** Figma selectively throttles canvas updates for overall responsiveness. For us, this means debouncing node position saves and throttling minimap updates. [Source](https://andrewkchan.dev/posts/figma2.html)
3. **Event batching:** tldraw's approach of buffering events and dispatching per tick prevents input storms during rapid interactions. React Flow handles this internally but we should be aware of it for custom interactions.

---

## 6. Accessibility Considerations

Canvas interfaces present unique accessibility challenges. The HTML5 canvas element itself "lacks specific mechanisms to add accessibility hooks for content produced using the canvas element." [Source](https://www.w3.org/html/wg/wiki/AddedElementCanvas) However, our approach (React Flow, which uses DOM nodes) is inherently more accessible than raw canvas.

### 6.1 Keyboard Navigation

**WCAG 2.1.1 requires all interactive elements to work with keyboard alone.** [Source](https://www.uxpin.com/studio/blog/wcag-211-keyboard-accessibility-explained/)

**Proposed keyboard model:**

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Cycle focus between nodes (in spatial order: left-to-right, top-to-bottom) |
| `Enter` | Activate focused node (unfreeze, start streaming) |
| `Escape` | Deactivate current node (freeze), return focus to canvas |
| `Arrow keys` | Pan canvas (when no node is focused) |
| `Cmd/Ctrl + =/-` | Zoom in/out |
| `Cmd/Ctrl + 0` | Fit all nodes in viewport |
| `Cmd/Ctrl + 1-9` | Quick-jump to node by position |
| `Cmd/Ctrl + N` | Create new node |
| `Space` | Toggle node state (expand/collapse) when focused |

**Focus management:**
- Visible focus ring on currently focused node (high-contrast border, 3:1 minimum contrast ratio per WCAG 2.1 SC 1.4.11)
- Focus trap within active node (Tab cycles through chat input, messages, controls)
- Escape releases focus trap back to canvas level [Source](https://www.uxpin.com/studio/blog/how-to-build-accessible-modals-with-focus-traps/)

### 6.2 Screen Reader Support

**Strategy: Dual representation**
- Canvas layout is visual; provide a parallel list/tree view accessible via screen reader
- Use `aria-live` regions for status updates ("Claude is working in Session 3", "Session 5 needs your input")
- Each node should have `aria-label` with: session title, status, message count, last activity
- Focus changes should be announced: "Focused on Session 2: Debugging auth flow, 14 messages, idle"

**React Flow accessibility:**
- React Flow nodes are DOM elements (not canvas pixels), so they receive keyboard focus and can have ARIA attributes
- We'll need custom `tabIndex` management to ensure logical spatial focus order
- The minimap should be navigable but not in the main tab order (use `aria-hidden` or a separate keyboard shortcut to activate)

### 6.3 Reduced Motion

- Respect `prefers-reduced-motion` media query for all animations
- Miro provides a "Reduce motion" toggle for users who prefer no motion transitions [Source](https://community.miro.com/ideas/adding-transition-animation-to-miro-boards-like-in-powerpoint-prezi-1219)
- When reduced motion is active: instant state changes instead of cross-fades, no pulsing indicators (use static icons instead), no zoom animations

### 6.4 Color Independence

- Status indicators must not rely on color alone (WCAG 1.4.1)
- Working state: amber dot + "Working..." text label
- Needs input: amber dot + "Needs input" text + distinct icon (exclamation mark)
- Focused: blue border + "Active" label
- Idle: gray dot + no label needed (default state)

---

## 7. Recommendations for Our Implementation

### 7.1 Technology Stack

| Need | Recommendation | Rationale |
|------|---------------|-----------|
| Canvas engine | **React Flow** (v12+) | Built for React, includes MiniMap, Controls, Background. DOM-based nodes (good for accessibility). Used by most AI canvas tools. |
| State management | **Zustand** (canvas-scoped) | Lightweight, doesn't interfere with existing hooks-based state. Already in the plan. |
| Layout algorithm | **dagre** (via `@dagrejs/dagre`) | Hierarchical layout ideal for conversation trees. React Flow has first-class dagre integration. |
| Animations | **CSS transitions + React Flow viewport animations** | Keep it simple. Framer Motion only if CSS proves insufficient. |
| Node content | **React components** (not canvas rendering) | Each node is a React component. Full React ecosystem access. Accessible by default. |

### 7.2 Node Design Specifications

**Minimized node** (< 0.4 zoom):
```
┌──────────────┐
│ ● Session 3  │  ← Status dot + title
│   14 msgs    │  ← Message count
└──────────────┘
  ~120x60px
```

**Preview node** (0.4-0.8 zoom):
```
┌─────────────────────────┐
│ 🟡 Debugging auth flow  │  ← Status dot + title
│─────────────────────────│
│ "The issue is in the    │  ← Last message preview
│  token refresh logic…"  │     (2-3 lines)
│─────────────────────────│
│ 14 msgs · Working 8s    │  ← Count + status
└─────────────────────────┘
  ~280x160px
```

**Active node** (> 0.8 zoom, focused):
```
┌─────────────────────────────┐
│ 🔵 Debugging auth flow    ✕ │  ← Title + close/minimize
│─────────────────────────────│
│ │ User: Can you check the  │
│ │ token refresh logic?     │  ← Scrollable message list
│ │                          │
│ │ Claude: Looking at the   │
│ │ refresh handler in...    │  ← Live streaming
│ │ █                        │
│─────────────────────────────│
│ [Type a message...]    [⏎] │  ← Chat input
└─────────────────────────────┘
  ~400x500px (resizable)
```

### 7.3 Interaction Model

**Creating nodes:**
- "New Chat" button on canvas toolbar creates a node near viewport center
- Fork from existing node: right-click → "Fork conversation" → new node appears adjacent with connecting edge
- Drag session from sidebar onto canvas (if sidebar is visible)

**Activating nodes:**
- Double-click to focus and activate streaming
- Single-click to select (for move/resize/delete)
- Only one node active at a time (Phase 3), up to 3 in Phase 5

**Connecting nodes:**
- Drag from node edge to create a relationship edge
- Edge types: "forked from", "context shared", "related to" (user-labeled)
- Edges are visual only in Phase 2-4; context-sharing edges become functional in later phases

**Canvas navigation:**
- Scroll to pan (or middle-click drag)
- Pinch/scroll+Cmd to zoom
- Minimap click to jump
- `Cmd+0` to fit all, `Cmd+Shift+1` to zoom to selected node

### 7.4 Priority Ordering

Based on this research, the existing phased plan is well-structured. Specific additions:

**Add to Phase 1 (Split-Pane):**
- Keyboard shortcut to cycle focus between panes (`Cmd+]` / `Cmd+[`)
- Animated transition when splitting (chat slides to make room)

**Add to Phase 2 (Static Canvas):**
- Three zoom-level node renderers from day one (minimized, preview, active placeholder)
- Minimap with color-coded status dots
- "Tidy up" auto-layout button
- `prefers-reduced-motion` support

**Add to Phase 3 (Live Canvas):**
- Frozen snapshot capture on focus-out (< 50ms budget)
- Status indicator with text labels (not just color dots)
- "Needs input" notification queue (never interrupt focused node)
- Keyboard navigation between nodes (Tab cycle)

**Add to Phase 4 (Zoom Levels):**
- Screen reader dual-representation (canvas + accessible list view)
- `aria-live` for status changes

**Defer to Phase 6+:**
- Semantic spatial clustering (embedding-based auto-positioning)
- Highlight-and-branch (Canvas Chat pattern)
- Multi-select merge for cross-conversation synthesis

### 7.5 Anti-Patterns to Avoid

1. **Don't build a raw canvas renderer.** Use React Flow's DOM-based approach. Raw canvas (like Figma's WebGL) is only justified at massive scale and destroys accessibility.
2. **Don't auto-play animations on frozen nodes.** Pulsing dots are fine; animated message streaming previews are distracting and wasteful.
3. **Don't force canvas on users.** Canvas is a power feature. The single-chat view must remain the default and always be one click away.
4. **Don't over-connect nodes.** Too many edges make the canvas look like a circuit diagram. Default to no edges; let users add them intentionally.
5. **Don't skip the split-pane phase.** It validates the multi-instance pattern at 20% of the complexity and delivers real value immediately.

---

## Sources

### Canvas & Design Tools
- [Figma Rendering: Powered by WebGPU](https://www.figma.com/blog/figma-rendering-powered-by-webgpu/)
- [Keeping Figma Fast](https://www.figma.com/blog/keeping-figma-fast/)
- [Building a professional design tool on the web (Figma)](https://www.figma.com/blog/building-a-professional-design-tool-on-the-web/)
- [Notes From Figma II: Engineering Learnings](https://andrewkchan.dev/posts/figma2.html)
- [Figma: Made by Evan (rendering details)](https://madebyevan.com/figma/)
- [Figma keyboard shortcuts](https://help.figma.com/hc/en-us/articles/360040328653-Use-Figma-products-with-a-keyboard)
- [Figma groups vs frames](https://www.figma.com/best-practices/groups-versus-frames/)
- [tldraw: Infinite Canvas SDK](https://tldraw.dev/)
- [tldraw Canvas Rendering Pipeline (DeepWiki)](https://deepwiki.com/tldraw/tldraw/3.1-canvas-rendering)
- [tldraw v2.1.0 (WebGL minimap)](https://tldraw.dev/releases/v2.1.0)
- [Miro: Structuring board content](https://help.miro.com/hc/en-us/articles/360017730973-Structuring-board-content)
- [Miro: Frames](https://help.miro.com/hc/en-us/articles/360018261813-Frames)

### AI Canvas & Chat Tools
- [Canvas Chat: A Visual Interface for Thinking with LLMs](https://ericmjl.github.io/blog/2025/12/31/canvas-chat-a-visual-interface-for-thinking-with-llms/)
- [RabbitHoles AI](https://www.rabbitholes.ai/)
- [Nodeline AI](https://www.nodelineai.com/)
- [Project Nodal (GitHub)](https://github.com/yibie/project-nodal)
- [ChatGPT Canvas Introduction (OpenAI)](https://openai.com/index/introducing-canvas/)
- [Visual AI Chat vs Linear Chat (Second Brain)](https://www.thesecondbrain.io/blog/visual-ai-chat-vs-linear-chat)

### Post-Chat UI & LLM Interface Design
- [Post-Chat UI by Allen Pike](https://allenpike.com/2025/post-chat-llm-ui/)
- [Thought Eddies: LLM Chat UI Concepts](https://www.danielcorin.com/posts/2025/llm-chat-ui-concepts/)
- [LLM Conversation Branching](https://www.danielcorin.com/posts/2025/llm-conversation-branching)
- [Design Patterns for AI Interfaces (Smashing Magazine)](https://www.smashingmagazine.com/2025/07/design-patterns-ai-interfaces/)
- [The Shape of AI: UX Patterns for AI Design](https://www.shapeof.ai/)

### Layout & Spatial Organization
- [React Flow: Node-Based UIs](https://reactflow.dev)
- [React Flow: Auto Layout](https://reactflow.dev/examples/layout/auto-layout)
- [React Flow: Dynamic Layouting](https://reactflow.dev/examples/layout/dynamic-layouting)
- [G6 Minimap Plugin](https://g6.antv.antgroup.com/en/manual/plugin/minimap)
- [Creating an auto-layout algorithm for graphs](https://crinkles.dev/writing/auto-graph-layout-algorithm)

### Performance & Perception
- [Skeleton Screens 101 (NN/g)](https://www.nngroup.com/articles/skeleton-screens/)
- [Skeleton loading screen design (LogRocket)](https://blog.logrocket.com/ux-design/skeleton-loading-screen-design/)
- [The Psychology of Waiting: Skeletons](https://medium.com/@elenech/the-psychology-of-waiting-skeletons-ca3b309e12a2)

### Progressive Disclosure
- [Progressive Disclosure (NN/g)](https://www.nngroup.com/articles/progressive-disclosure/)
- [What is Progressive Disclosure? (UXPin)](https://www.uxpin.com/studio/blog/what-is-progressive-disclosure/)
- [Progressive Disclosure (IxDF)](https://ixdf.org/literature/topics/progressive-disclosure)

### Accessibility
- [WCAG 2.1.1 Keyboard Accessibility (UXPin)](https://www.uxpin.com/studio/blog/wcag-211-keyboard-accessibility-explained/)
- [WebAIM Keyboard Accessibility](https://webaim.org/techniques/keyboard/)
- [How to Build Accessible Modals with Focus Traps (UXPin)](https://www.uxpin.com/studio/blog/how-to-build-accessible-modals-with-focus-traps/)
- [Canvas Accessibility (W3C)](https://www.w3.org/html/wg/wiki/AddedElementCanvas)
- [Workday Canvas Design System: Status Indicators](https://canvas.workday.com/components/indicators/status-indicator)
- [Workday Canvas Design System: Loading Patterns](https://canvas.workday.com/patterns/loading/)
- [Status Dot UI Design (Mobbin)](https://mobbin.com/glossary/status-dot)

### Coding IDE UX
- [Windsurf vs Cursor comparison](https://windsurf.com/compare/windsurf-vs-cursor)
- [Cursor](https://cursor.com/)
