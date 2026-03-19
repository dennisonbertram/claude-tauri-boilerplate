# Canvas Workspace Implementation Research

**Date:** 2026-03-18
**Purpose:** Best practices and patterns for building a canvas workspace UI with React Flow, split panes, state management, and multi-stream SSE -- targeting a chat/IDE-like desktop application.

---

## Table of Contents

1. [React Flow Best Practices](#1-react-flow-best-practices)
2. [Split-Pane Implementations](#2-split-pane-implementations)
3. [Freeze/Unfreeze & LOD Patterns](#3-freezeunfreeze--lod-patterns)
4. [Multi-Stream SSE Management](#4-multi-stream-sse-management)
5. [Canvas State Persistence](#5-canvas-state-persistence)
6. [Zustand Store Patterns for Canvas](#6-zustand-store-patterns-for-canvas)
7. [Recommendations for This Project](#7-recommendations-for-this-project)

---

## 1. React Flow Best Practices

### 1.1 Node Virtualization & Viewport Culling

React Flow renders **all nodes by default**, even those outside the viewport. For large canvases, this is a problem.

**`onlyRenderVisibleElements` prop:**
- Enables viewport-based culling so only visible nodes are rendered.
- **Caveat:** The current implementation has a known performance issue where nodes re-entering the viewport must be expensively reinitialized. For some workloads this can be *slower* than rendering everything.
- **Practical limit:** ~1,000 nodes depending on node complexity.
- Source: [xyflow/xyflow#3883](https://github.com/xyflow/xyflow/issues/3883)

**Recommendation:** For a chat/IDE canvas with <100 nodes, skip `onlyRenderVisibleElements` and rely on memoization instead. Enable it only if node counts grow large.

### 1.2 Custom Node Performance

Custom nodes are just React components. The critical rules:

```tsx
// GOOD: Define nodeTypes OUTSIDE the component to prevent re-registration
const nodeTypes = {
  chatNode: memo(ChatNode),
  artifactNode: memo(ArtifactNode),
  codeNode: memo(CodeNode),
};

function Canvas() {
  return <ReactFlow nodeTypes={nodeTypes} ... />;
}
```

**Key patterns:**
1. **Always wrap custom nodes with `React.memo()`** -- node state changes on every drag/pan/zoom, and without memo every node re-renders.
2. **Define `nodeTypes` outside the component** -- creating it inside causes React Flow to re-register types on every render.
3. **Use `useCallback` for all handler props** passed to `<ReactFlow>`.
4. **Memoize arrays/objects** like `defaultEdgeOptions`, `snapGrid` with `useMemo`.
5. **Avoid heavy CSS** (animations, shadows, gradients) on nodes in large diagrams.

Source: [React Flow Performance Docs](https://reactflow.dev/learn/advanced-use/performance)

### 1.3 Zoom-Level Conditional Rendering (LOD)

React Flow has an official pattern for rendering different content at different zoom levels using `useStore`:

```tsx
import { useStore, Handle, Position } from '@xyflow/react';
import { memo } from 'react';

// Selector: returns true when zoom >= 0.9
const zoomSelector = (s) => s.transform[2] >= 0.9;

const ChatNode = memo(({ data }) => {
  const showFullContent = useStore(zoomSelector);

  return (
    <>
      <Handle type="target" position={Position.Left} />
      {showFullContent ? (
        // Full chat content with message bubbles, code blocks, etc.
        <div className="p-4">{data.content}</div>
      ) : (
        // Simplified placeholder -- just title + status dot
        <div className="p-2 opacity-60">
          <div className="h-2 w-20 bg-gray-300 rounded" />
          <div className="h-2 w-14 bg-gray-200 rounded mt-1" />
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </>
  );
});
```

**Multiple LOD thresholds** for a canvas workspace:

| Zoom Level | Render Strategy |
|-----------|----------------|
| < 0.3 | Colored rectangles with title text only |
| 0.3 - 0.7 | Title + summary + status indicator |
| 0.7 - 1.0 | Title + truncated content preview |
| >= 1.0 | Full interactive content |

Source: [React Flow Contextual Zoom Example](https://reactflow.dev/examples/interaction/contextual-zoom)

### 1.4 State Management -- Don't Access Nodes Directly

The most critical performance mistake is subscribing to the `nodes` or `edges` arrays in components:

```tsx
// BAD: This re-renders on EVERY drag, pan, zoom
const nodes = useNodes();
const selectedNodes = nodes.filter(n => n.selected);

// GOOD: Store selection state separately
const selectedNodeIds = useCanvasStore(s => s.selectedNodeIds);
```

The `nodes` array changes reference on every interaction. Any component that reads it will re-render constantly. Keep derived state (selections, active node, etc.) in a separate Zustand slice.

Source: [React Flow Performance Docs](https://reactflow.dev/learn/advanced-use/performance)

### 1.5 Sub-Flows & Nesting

React Flow supports sub-flows (child nodes within parent nodes) but **does NOT support nested ReactFlow instances** due to transform conflicts.

For a canvas workspace where nodes might contain rich editors or chat views:
- Use custom nodes with embedded React components (editors, chat panels).
- Do NOT nest a `<ReactFlow>` inside a node.
- For grouping, use `parentId` on child nodes and `type: 'group'` on the parent.

Source: [React Flow Sub Flows](https://reactflow.dev/learn/layouting/sub-flows)

### 1.6 Grid Snapping for Performance

Enable `snapToGrid` to reduce state update frequency during drags:

```tsx
<ReactFlow
  snapToGrid={true}
  snapGrid={[20, 20]}
  // ...
/>
```

This constrains movement to grid increments, significantly reducing the number of position updates.

Source: [React Flow Optimization (DEV)](https://dev.to/usman_abdur_rehman/react-flowxyflow-optimization-45ik)

### 1.7 TypeScript Setup

```tsx
import type { Node, Edge, NodeTypes, BuiltInNode } from '@xyflow/react';

// Define your custom node types
type ChatNodeData = { title: string; content: string; sessionId: string };
type ArtifactNodeData = { title: string; type: 'code' | 'markdown'; content: string };

// Union type for all nodes
type AppNode =
  | Node<ChatNodeData, 'chatNode'>
  | Node<ArtifactNodeData, 'artifactNode'>
  | BuiltInNode;

// Register node types (outside component)
const nodeTypes: NodeTypes = {
  chatNode: memo(ChatNode),
  artifactNode: memo(ArtifactNode),
};
```

Source: [React Flow TypeScript Guide](https://reactflow.dev/learn/advanced-use/typescript)

---

## 2. Split-Pane Implementations

### 2.1 react-resizable-panels (Recommended)

By Brian Vaughn (React core team). The most maintained and feature-rich option.

**v4 API (current):**

```tsx
import { Group, Panel, Separator, useDefaultLayout, usePanelRef } from 'react-resizable-panels';

function Workspace() {
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    groupId: 'workspace-main',
    storage: localStorage,
    debounceSaveMs: 150,
    panelIds: ['sidebar', 'canvas', 'inspector'],
  });

  return (
    <Group
      orientation="horizontal"
      defaultLayout={defaultLayout}
      onLayoutChange={onLayoutChange}
    >
      <Panel id="sidebar" defaultSize="20%" minSize="15%" collapsible>
        <SessionSidebar />
      </Panel>
      <Separator />
      <Panel id="canvas" minSize="50%">
        <CanvasView />
      </Panel>
      <Separator />
      <Panel id="inspector" defaultSize="25%" minSize="15%" collapsible>
        <InspectorPanel />
      </Panel>
    </Group>
  );
}
```

**Key features:**
- **Layout persistence** via `useDefaultLayout` with configurable debounce.
- **Collapsible panels** -- collapse when dragged below `minSize / 2`, remembers previous size for re-expansion.
- **Imperative API** -- `usePanelRef()` returns handles with `getSize()`, `resize()`, `collapse()`, `expand()`.
- **Mixed units** -- `"30%"`, `"200px"`, `"10rem"`, `"50vh"` in the same group.
- **Keyboard accessible** -- WAI-ARIA Window Splitter pattern, arrow keys resize.
- **SSR compatible** -- works with Next.js, Remix, RSC.
- **Conditional panels** -- dynamic add/remove with stable `id` props.

**Imperative control example:**

```tsx
const panelRef = usePanelRef();

// Toggle sidebar programmatically
function toggleSidebar() {
  if (panelRef.isCollapsed()) {
    panelRef.expand();
  } else {
    panelRef.collapse();
  }
}
```

Source: [GitHub - bvaughn/react-resizable-panels](https://github.com/bvaughn/react-resizable-panels), [DeepWiki Advanced Features](https://deepwiki.com/bvaughn/react-resizable-panels/6-examples-and-usage-patterns)

### 2.2 Alternatives

| Library | Notes |
|---------|-------|
| `react-resplit` | Lighter weight, fewer features. No persistence built in. |
| `split-pane-react` | Simple API but less maintained. |
| Syncfusion Splitter | Commercial. Full-featured but heavy. |
| Custom CSS `resize` | Zero dependency but no keyboard support, no persistence. |

**Verdict:** `react-resizable-panels` is the clear winner for this project. Active maintenance, full accessibility, layout persistence, and collapsible panels out of the box.

### 2.3 Independent Panel State Pattern

Each panel should own its own state scope. The split-pane library handles layout; content state is independent:

```
WorkspaceLayout (react-resizable-panels)
  |-- SidebarPanel (own Zustand store or context)
  |-- CanvasPanel (React Flow + canvas Zustand store)
  |-- InspectorPanel (reads from canvas store selection)
```

The inspector panel subscribes to the canvas store's `selectedNodeId` via a selector -- it re-renders only when the selection changes, not on every canvas pan/zoom.

---

## 3. Freeze/Unfreeze & LOD Patterns

### 3.1 How Production Apps Handle Inactive Content

**Figma/FigJam approach (WebGL/Canvas2D):**
- Tile-based rendering with GPU acceleration.
- Only tiles in the viewport are rendered at full resolution.
- Off-screen content is represented as cached bitmaps at lower resolution.
- Plugin freeze mechanism: when a plugin is backgrounded, its VM is suspended to free memory.

**Infinite canvas pattern (DOM-based):**
- Space is divided into chunks; only chunks within a radius of the camera exist in the DOM.
- Once content fades out of view, it is removed from the render tree entirely.
- Re-entering the viewport triggers re-mount with cached data.

Source: [Figma Frozen Plugins](https://www.figma.com/plugin-docs/frozen-plugins/), [Infinite Canvas Tutorial (antvis)](https://github.com/antvis/infinite-canvas-tutorial)

### 3.2 Practical Freeze/Unfreeze for React Flow Nodes

For a chat/IDE canvas, "freeze" means: **stop expensive re-renders for off-screen or inactive nodes while keeping their state intact.**

```tsx
const ChatNode = memo(({ id, data }) => {
  const isActive = useCanvasStore(s => s.activeNodeId === id);
  const isVisible = useIsNodeVisible(id); // custom hook using IntersectionObserver or viewport bounds

  // Tier 1: Active node -- full interactive rendering
  if (isActive) {
    return <FullChatView sessionId={data.sessionId} />;
  }

  // Tier 2: Visible but inactive -- static snapshot
  if (isVisible) {
    return <StaticChatPreview content={data.lastSnapshot} />;
  }

  // Tier 3: Off-screen -- minimal placeholder
  return <div style={{ width: data.width, height: data.height }} />;
});
```

**Key insight:** The "freeze" is accomplished by rendering progressively cheaper components based on visibility and active state. The expensive chat UI (with SSE streaming, code highlighting, scroll state) only mounts for the active node.

### 3.3 Lazy Rendering at Zoom Levels

Combine the LOD zoom pattern (section 1.3) with the freeze pattern:

```tsx
const zoomLevel = useStore(s => s.transform[2]);
const isActive = useCanvasStore(s => s.activeNodeId === id);

function getNodeTier(zoom: number, isActive: boolean) {
  if (isActive) return 'full';        // Always render active node fully
  if (zoom < 0.3) return 'dot';       // Colored rectangle only
  if (zoom < 0.7) return 'summary';   // Title + status
  return 'preview';                   // Static content preview
}
```

---

## 4. Multi-Stream SSE Management

### 4.1 Architecture: One Active, Others Polled

In a canvas workspace, multiple chat sessions exist as nodes, but only one is actively streaming at a time.

**Pattern:**
- **Active node:** Full SSE connection with token-level streaming.
- **Inactive nodes:** No persistent connection. Fetch latest state on-demand (when node becomes visible or is selected).
- **Background status:** Lightweight polling or push-based status updates via a single shared SSE connection.

### 4.2 Connection Manager Singleton

```tsx
class SSEConnectionManager {
  private activeConnection: EventSource | null = null;
  private activeSessionId: string | null = null;
  private abortController: AbortController | null = null;

  /**
   * Connect to a session's chat stream.
   * Automatically disconnects the previous active connection.
   */
  async connectToSession(sessionId: string, onToken: (text: string) => void) {
    // Tear down previous connection
    this.disconnect();

    this.activeSessionId = sessionId;
    this.abortController = new AbortController();

    const response = await fetch(`/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, messages: [] }),
      signal: this.abortController.signal,
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const event of events) {
        const dataLine = event.split('\n').find(l => l.startsWith('data: '));
        if (dataLine) {
          const data = JSON.parse(dataLine.slice(6));
          if (data.type === 'text-delta') {
            onToken(data.textDelta);
          }
        }
      }
    }
  }

  disconnect() {
    this.abortController?.abort();
    this.activeConnection?.close();
    this.activeConnection = null;
    this.activeSessionId = null;
  }

  getActiveSessionId() {
    return this.activeSessionId;
  }
}

// Singleton instance
export const sseManager = new SSEConnectionManager();
```

### 4.3 React Hook for Multi-Stream

```tsx
function useCanvasChat(nodeId: string, sessionId: string) {
  const isActive = useCanvasStore(s => s.activeNodeId === nodeId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Load messages when node becomes active
  useEffect(() => {
    if (!isActive) return;

    // Fetch existing messages for this session
    fetch(`/api/sessions/${sessionId}/messages`)
      .then(r => r.json())
      .then(msgs => setMessages(msgs));
  }, [isActive, sessionId]);

  // Only the active node has a streaming connection
  const sendMessage = useCallback(async (content: string) => {
    if (!isActive) return;

    setIsStreaming(true);
    const userMsg = { role: 'user', content };
    setMessages(prev => [...prev, userMsg]);

    let assistantText = '';
    await sseManager.connectToSession(sessionId, (token) => {
      assistantText += token;
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'assistant') {
          updated[updated.length - 1] = { ...last, content: assistantText };
        } else {
          updated.push({ role: 'assistant', content: assistantText });
        }
        return updated;
      });
    });

    setIsStreaming(false);
  }, [isActive, sessionId]);

  return { messages, sendMessage, isStreaming };
}
```

### 4.4 HTTP/2 and Connection Limits

- **HTTP/1.1:** Browser limit of 6 concurrent connections per origin. Multiple SSE connections will exhaust this quickly.
- **HTTP/2:** Up to 100 concurrent streams (negotiable). Much safer for multi-stream, but still wasteful if most streams are idle.
- **Recommendation:** Stick to one active SSE connection. Use fetch-based polling for inactive nodes.

Source: [MDN - Using Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events), [OneUptime SSE Guide](https://oneuptime.com/blog/post/2026-01-15-server-sent-events-sse-react/view)

### 4.5 Reconnection with Exponential Backoff

```tsx
function useSSEWithReconnect(url: string, options?: {
  maxRetries?: number;
  initialRetryDelay?: number;
  maxRetryDelay?: number;
  backoffMultiplier?: number;
}) {
  const {
    maxRetries = 5,
    initialRetryDelay = 1000,
    maxRetryDelay = 30000,
    backoffMultiplier = 2,
  } = options ?? {};

  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState<'connecting' | 'connected' | 'reconnecting' | 'failed'>('connecting');

  const connect = useCallback(() => {
    const es = new EventSource(url);

    es.onopen = () => {
      setState('connected');
      setRetryCount(0);
    };

    es.onerror = () => {
      es.close();
      if (retryCount < maxRetries) {
        setState('reconnecting');
        const delay = Math.min(
          initialRetryDelay * Math.pow(backoffMultiplier, retryCount),
          maxRetryDelay
        );
        // Add jitter to prevent thundering herd
        const jitter = delay * 0.3 * Math.random();
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          connect();
        }, delay + jitter);
      } else {
        setState('failed');
      }
    };

    return () => es.close();
  }, [url, retryCount, maxRetries, initialRetryDelay, maxRetryDelay, backoffMultiplier]);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, []);

  return { state, retryCount };
}
```

### 4.6 Context-Based SSE Provider (Shared Connection)

For a shared status/notification stream alongside the active chat stream:

```tsx
const SSEContext = createContext<{
  isConnected: boolean;
  subscribe: (eventType: string, handler: (data: any) => void) => () => void;
} | null>(null);

function SSEProvider({ url, children }: { url: string; children: React.ReactNode }) {
  const esRef = useRef<EventSource | null>(null);
  const handlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setIsConnected(true);
    es.onerror = () => setIsConnected(false);

    es.onmessage = (event) => {
      const handlers = handlersRef.current.get('message');
      handlers?.forEach(h => h(JSON.parse(event.data)));
    };

    return () => es.close();
  }, [url]);

  const subscribe = useCallback((eventType: string, handler: (data: any) => void) => {
    if (!handlersRef.current.has(eventType)) {
      handlersRef.current.set(eventType, new Set());
      // Register custom event listener on the EventSource
      if (esRef.current && eventType !== 'message') {
        esRef.current.addEventListener(eventType, ((e: MessageEvent) => {
          handlersRef.current.get(eventType)?.forEach(h => h(JSON.parse(e.data)));
        }) as EventListener);
      }
    }
    handlersRef.current.get(eventType)!.add(handler);
    return () => { handlersRef.current.get(eventType)?.delete(handler); };
  }, []);

  return (
    <SSEContext.Provider value={{ isConnected, subscribe }}>
      {children}
    </SSEContext.Provider>
  );
}
```

---

## 5. Canvas State Persistence

### 5.1 What to Persist

| Data | Storage | Write Frequency |
|------|---------|-----------------|
| Node positions (x, y) | SQLite (server) | Debounced (500ms after last drag) |
| Viewport (pan x, pan y, zoom) | localStorage | Debounced (300ms after last interaction) |
| Panel layout sizes | localStorage | On resize end (built into react-resizable-panels) |
| Node dimensions (w, h) | SQLite (server) | On resize end |
| Edge connections | SQLite (server) | On connect/disconnect |
| Active node selection | In-memory only | Never persisted |

### 5.2 Debounced Save Pattern

```tsx
import { useDebouncedCallback } from 'use-debounce';

function useCanvasPersistence(dashboardId: string) {
  // Debounced save to server for node positions
  const saveNodePositions = useDebouncedCallback(
    async (nodes: Node[]) => {
      const positions = nodes.map(n => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        width: n.width,
        height: n.height,
      }));

      await fetch(`/api/dashboards/${dashboardId}/layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions }),
      });
    },
    500, // 500ms debounce
    { maxWait: 2000 } // Force save after 2s of continuous dragging
  );

  // Debounced save to localStorage for viewport
  const saveViewport = useDebouncedCallback(
    (viewport: { x: number; y: number; zoom: number }) => {
      localStorage.setItem(
        `canvas-viewport-${dashboardId}`,
        JSON.stringify(viewport)
      );
    },
    300
  );

  return { saveNodePositions, saveViewport };
}
```

### 5.3 Optimistic Updates for Drag/Zoom

Drag and zoom should update the UI immediately (optimistic) and persist in the background:

```tsx
function useOptimisticNodeDrag(dashboardId: string) {
  const { saveNodePositions } = useCanvasPersistence(dashboardId);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    // 1. Apply changes to local state immediately (optimistic)
    setNodes(nds => applyNodeChanges(changes, nds));

    // 2. If any position changes, debounce-save to server
    const hasDragChanges = changes.some(
      c => c.type === 'position' && c.dragging === false
    );
    if (hasDragChanges) {
      // Only save when drag ends (dragging === false)
      saveNodePositions(getNodes());
    }
  }, [saveNodePositions]);

  return { onNodesChange };
}
```

**Important:** Only persist when `dragging === false` (drag end) to avoid hammering the server during continuous drag. The debounce on `saveNodePositions` provides additional protection.

### 5.4 Zustand Persist with Debounced Storage

For viewport and UI preferences, use Zustand's persist middleware with debounced writes:

```tsx
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Option A: Use zustand-debounce package
import { createDebouncedJSONStorage } from 'zustand-debounce';

const useViewportStore = create(
  persist(
    (set) => ({
      x: 0,
      y: 0,
      zoom: 1,
      setViewport: (viewport: { x: number; y: number; zoom: number }) =>
        set(viewport),
    }),
    {
      name: 'canvas-viewport',
      storage: createDebouncedJSONStorage(() => localStorage, 300),
    }
  )
);
```

**Caution with IndexedDB + persist:** Async hydration can cause race conditions where a new empty store overwrites existing data. Use the `onRehydrateStorage` callback to handle this.

Source: [Zustand persist docs](https://zustand.docs.pmnd.rs/reference/middlewares/persist), [zustand-debounce](https://github.com/AbianS/zustand-debounce)

---

## 6. Zustand Store Patterns for Canvas

### 6.1 Store Architecture

Split canvas state into focused slices to minimize re-renders:

```tsx
// ---- Canvas Store (nodes, edges, viewport) ----
interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  activeNodeId: string | null;
  selectedNodeIds: string[];

  // React Flow change handlers
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  // Canvas-specific actions
  setActiveNode: (nodeId: string | null) => void;
  addChatNode: (sessionId: string, position: XYPosition) => void;
  addArtifactNode: (artifactId: string, position: XYPosition) => void;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
  removeNode: (nodeId: string) => void;
}

const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  activeNodeId: null,
  selectedNodeIds: [],

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    set({ edges: addEdge(connection, get().edges) });
  },

  setActiveNode: (nodeId) => set({ activeNodeId: nodeId }),

  addChatNode: (sessionId, position) => {
    const newNode: Node = {
      id: `chat-${sessionId}`,
      type: 'chatNode',
      position,
      data: { sessionId, title: 'New Chat' },
    };
    set({ nodes: [...get().nodes, newNode] });
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map(node =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
    });
  },

  removeNode: (nodeId) => {
    set({
      nodes: get().nodes.filter(n => n.id !== nodeId),
      edges: get().edges.filter(e => e.source !== nodeId && e.target !== nodeId),
      activeNodeId: get().activeNodeId === nodeId ? null : get().activeNodeId,
    });
  },
}));
```

### 6.2 Selector Patterns to Avoid Re-Renders

```tsx
// BAD: Subscribes to entire nodes array -- re-renders on every drag
const nodes = useCanvasStore(s => s.nodes);

// GOOD: Atomic selector -- only re-renders when active node changes
const activeNodeId = useCanvasStore(s => s.activeNodeId);

// GOOD: Derived selector for a specific node's data
const useNodeData = (nodeId: string) =>
  useCanvasStore(useCallback(s => s.nodes.find(n => n.id === nodeId)?.data, [nodeId]));

// GOOD: Use useShallow for multi-value selections
import { useShallow } from 'zustand/react/shallow';

const { activeNodeId, selectedNodeIds } = useCanvasStore(
  useShallow(s => ({
    activeNodeId: s.activeNodeId,
    selectedNodeIds: s.selectedNodeIds,
  }))
);
```

**Rule:** Only export custom hooks with selectors, never the raw store. This prevents accidental full-store subscriptions.

Source: [Zustand re-render prevention (egghead)](https://egghead.io/lessons/react-implement-zustand-state-selectors-in-react-to-prevent-unneeded-rerenders), [pmndrs/zustand Discussion #1916](https://github.com/pmndrs/zustand/discussions/1916)

### 6.3 Scoped Stores with React Context

For components that need isolated state (e.g., each chat node has its own message state), use the TkDodo pattern:

```tsx
import { createStore, useStore } from 'zustand';
import { createContext, useContext, useState } from 'react';

// Store factory
function createChatNodeStore(sessionId: string) {
  return createStore<ChatNodeState>((set) => ({
    messages: [],
    isStreaming: false,
    sessionId,

    addMessage: (msg) => set(s => ({ messages: [...s.messages, msg] })),
    setStreaming: (v) => set({ isStreaming: v }),
    updateLastMessage: (content) => set(s => {
      const msgs = [...s.messages];
      msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content };
      return { messages: msgs };
    }),
  }));
}

// Context
type ChatNodeStore = ReturnType<typeof createChatNodeStore>;
const ChatNodeStoreContext = createContext<ChatNodeStore | null>(null);

// Provider -- each chat node creates its own store
function ChatNodeStoreProvider({ sessionId, children }: {
  sessionId: string;
  children: React.ReactNode;
}) {
  const [store] = useState(() => createChatNodeStore(sessionId));
  return (
    <ChatNodeStoreContext.Provider value={store}>
      {children}
    </ChatNodeStoreContext.Provider>
  );
}

// Hook with selector
function useChatNodeStore<T>(selector: (s: ChatNodeState) => T): T {
  const store = useContext(ChatNodeStoreContext);
  if (!store) throw new Error('Missing ChatNodeStoreProvider');
  return useStore(store, selector);
}

// Atomic hooks
export const useChatMessages = () => useChatNodeStore(s => s.messages);
export const useIsStreaming = () => useChatNodeStore(s => s.isStreaming);
```

**Benefits:**
1. Each chat node instance has completely isolated state.
2. Testing is trivial -- render a provider with test data.
3. No store cleanup needed -- unmounting the provider disposes the store.

Source: [TkDodo - Zustand and React Context](https://tkdodo.eu/blog/zustand-and-react-context)

### 6.4 Actions Separate from State

Keep the actions object stable by grouping them:

```tsx
const useCanvasStore = create<CanvasState>((set, get) => ({
  // State
  nodes: [],
  edges: [],
  activeNodeId: null,

  // Actions grouped as a stable object
  actions: {
    setActiveNode: (id: string | null) => set({ activeNodeId: id }),
    addNode: (node: Node) => set({ nodes: [...get().nodes, node] }),
    // ...
  },
}));

// Actions selector never changes reference
const useCanvasActions = () => useCanvasStore(s => s.actions);
```

This pattern ensures components that only need actions never re-render due to state changes.

Source: [TkDodo - Working with Zustand](https://tkdodo.eu/blog/working-with-zustand)

---

## 7. Recommendations for This Project

### 7.1 Recommended Stack

| Concern | Library/Pattern |
|---------|----------------|
| Canvas | React Flow (`@xyflow/react`) |
| Split panes | `react-resizable-panels` v4 |
| State management | Zustand (canvas store + scoped chat stores via Context) |
| Persistence | SQLite for node layout, localStorage for viewport/panel sizes |
| SSE | Single active connection + fetch-based loading for inactive nodes |
| Debounce | `use-debounce` or `zustand-debounce` for persist |

### 7.2 Architecture Sketch

```
<WorkspaceLayout>                          // react-resizable-panels
  <Panel: Sidebar>
    <SessionList />                        // reads from sessions store
  </Panel>

  <Panel: Canvas>
    <ReactFlowProvider>
      <ReactFlow                           // reads from canvas Zustand store
        nodeTypes={nodeTypes}              // memo'd, defined outside
        snapToGrid
      >
        <ChatNode>                         // React.memo
          <ChatNodeStoreProvider>          // scoped Zustand via Context
            <ChatContent />               // LOD-based rendering
          </ChatNodeStoreProvider>
        </ChatNode>
        <ArtifactNode />                   // React.memo
      </ReactFlow>
    </ReactFlowProvider>
  </Panel>

  <Panel: Inspector>
    <NodeInspector />                      // subscribes to activeNodeId only
  </Panel>
</WorkspaceLayout>
```

### 7.3 Performance Budget

- **Node count target:** <50 nodes (chat sessions + artifacts on a single dashboard).
- **Skip `onlyRenderVisibleElements`** -- the re-initialization cost outweighs benefits at <50 nodes.
- **Use LOD rendering** at 3 zoom thresholds for visual fidelity without performance cost.
- **One active SSE connection** at a time. No concurrent streams.
- **Debounce all persistence** -- 300ms for viewport, 500ms for node positions.

### 7.4 Key Pitfalls to Avoid

1. **Do NOT define `nodeTypes` inside a component.** This causes React Flow to re-register all node types on every render.
2. **Do NOT subscribe to `useNodes()` in sidebar or inspector components.** Use separate Zustand selectors.
3. **Do NOT nest `<ReactFlow>` inside a custom node.** Use embedded React components instead.
4. **Do NOT open multiple SSE connections** for inactive chat nodes. Fetch on-demand.
5. **Do NOT persist on every `onNodesChange` call.** Only persist on drag-end with debounce.
6. **Do NOT use `onlyRenderVisibleElements` without benchmarking.** It can be slower due to re-initialization costs.

---

## Sources

- [React Flow Performance Guide](https://reactflow.dev/learn/advanced-use/performance)
- [React Flow Contextual Zoom Example](https://reactflow.dev/examples/interaction/contextual-zoom)
- [React Flow Custom Nodes](https://reactflow.dev/learn/customization/custom-nodes)
- [React Flow TypeScript Guide](https://reactflow.dev/learn/advanced-use/typescript)
- [React Flow State Management with Zustand](https://reactflow.dev/learn/advanced-use/state-management)
- [React Flow Sub Flows](https://reactflow.dev/learn/layouting/sub-flows)
- [React Flow Optimization (DEV Community)](https://dev.to/usman_abdur_rehman/react-flowxyflow-optimization-45ik)
- [xyflow/xyflow Virtualization Discussion #2703](https://github.com/xyflow/xyflow/discussions/2703)
- [xyflow/xyflow onlyRenderVisibleElements Issue #3883](https://github.com/xyflow/xyflow/issues/3883)
- [react-resizable-panels (GitHub)](https://github.com/bvaughn/react-resizable-panels)
- [react-resizable-panels Advanced Features (DeepWiki)](https://deepwiki.com/bvaughn/react-resizable-panels/6-examples-and-usage-patterns)
- [TkDodo - Zustand and React Context](https://tkdodo.eu/blog/zustand-and-react-context)
- [TkDodo - Working with Zustand](https://tkdodo.eu/blog/working-with-zustand)
- [Zustand persist middleware docs](https://zustand.docs.pmnd.rs/reference/middlewares/persist)
- [zustand-debounce (GitHub)](https://github.com/AbianS/zustand-debounce)
- [Zustand selector re-render prevention (egghead)](https://egghead.io/lessons/react-implement-zustand-state-selectors-in-react-to-prevent-unneeded-rerenders)
- [pmndrs/zustand Discussion #1916 - Selecting multiple props](https://github.com/pmndrs/zustand/discussions/1916)
- [MDN - Using Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [How to Implement SSE in React (OneUptime)](https://oneuptime.com/blog/post/2026-01-15-server-sent-events-sse-react/view)
- [SSE vs WebSockets vs Polling in 2025 (DEV Community)](https://dev.to/haraf/server-sent-events-sse-vs-websockets-vs-long-polling-whats-best-in-2025-5ep8)
- [Infinite Canvas Tutorial (antvis/GitHub)](https://github.com/antvis/infinite-canvas-tutorial)
- [Figma Frozen Plugins](https://www.figma.com/plugin-docs/frozen-plugins/)
- [IndexedDB Best Practices (web.dev)](https://web.dev/articles/indexeddb-best-practices-app-state)
- [Figma-like Infinite Canvas in React (Better Programming)](https://betterprogramming.pub/how-to-create-a-figma-like-infinite-canvas-in-react-a2b0365b2a7)
- [Velt React Flow Guide (Nov 2025)](https://velt.dev/blog/react-flow-guide-advanced-node-based-ui)
- [React Flow Guide (Synergy Codes)](https://www.synergycodes.com/blog/react-flow-everything-you-need-to-know)
