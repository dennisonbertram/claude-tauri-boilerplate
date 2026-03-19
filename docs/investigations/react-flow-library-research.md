# React Flow Library Research

**Date:** 2026-03-19
**Purpose:** Comprehensive research into React Flow (xyflow) -- the visual node-based graph editor for React -- covering core concepts, custom nodes, state management, serialization, built-in components, and best practices.

---

## Table of Contents

1. [Package Name and Version](#1-package-name-and-version)
2. [Core Concepts](#2-core-concepts)
3. [Creating Custom Node Types](#3-creating-custom-node-types)
4. [Handles and Connections](#4-handles-and-connections)
5. [Edge Types and Custom Edges](#5-edge-types-and-custom-edges)
6. [Built-in Components](#6-built-in-components)
7. [State Management Patterns](#7-state-management-patterns)
8. [Serialization and Deserialization](#8-serialization-and-deserialization)
9. [Sub Flows and Grouping](#9-sub-flows-and-grouping)
10. [Performance Best Practices](#10-performance-best-practices)
11. [TypeScript Usage](#11-typescript-usage)
12. [Relevance to This Project](#12-relevance-to-this-project)
13. [Sources](#13-sources)

---

## 1. Package Name and Version

### Current Package: `@xyflow/react`

The package was renamed from `reactflow` to `@xyflow/react` with the release of React Flow 12. The xyflow organization now maintains both React Flow and Svelte Flow under a unified umbrella.

| Detail | Value |
|--------|-------|
| **Package name** | `@xyflow/react` |
| **Current version** | 12.10.1 |
| **Major version** | 12 (current stable) |
| **Old package** | `reactflow` (deprecated, do not use for new projects) |
| **Peer dependencies** | React 17+ (React 19 supported as of recent updates) |
| **License** | MIT |
| **Repository** | https://github.com/xyflow/xyflow |
| **Documentation** | https://reactflow.dev |

### Installation

```bash
# Current (v12+)
npm install @xyflow/react

# Or with pnpm
pnpm add @xyflow/react
```

### Migration from `reactflow` to `@xyflow/react`

If migrating from the old package:
1. Install `@xyflow/react` and remove `reactflow`
2. Update all imports from `'reactflow'` to `'@xyflow/react'`
3. Update style import to `'@xyflow/react/dist/style.css'` or `'@xyflow/react/dist/base.css'`
4. The maintainers have stated they will not change the package name again

Full migration guide: https://reactflow.dev/learn/troubleshooting/migrate-to-v12

---

## 2. Core Concepts

### Nodes

Nodes are the individual elements in a flowgraph. Each node has:

- **`id`** -- Unique string identifier
- **`position`** -- `{ x: number, y: number }` coordinates
- **`data`** -- Object containing arbitrary data (commonly includes `label`)
- **`type`** (optional) -- String matching a key in `nodeTypes` (defaults to `'default'`)

```typescript
const nodes: Node[] = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: 'Start' } },
  { id: '2', position: { x: 200, y: 100 }, data: { label: 'End' }, type: 'custom' },
];
```

Built-in node types: `'default'`, `'input'` (source only), `'output'` (target only), `'group'`.

### Edges

Edges connect nodes. Every edge needs a source and target.

- **`id`** -- Unique string identifier
- **`source`** -- ID of the source node
- **`target`** -- ID of the target node
- **`sourceHandle`** (optional) -- ID of the specific source handle
- **`targetHandle`** (optional) -- ID of the specific target handle
- **`type`** (optional) -- Edge rendering type
- **`animated`** (optional) -- Boolean for animated dashed edge
- **`label`** (optional) -- Text label on the edge

```typescript
const edges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e1-3', source: '1', target: '3', animated: true, label: 'async' },
];
```

Built-in edge types: `'default'` (bezier), `'straight'`, `'step'`, `'smoothstep'`.

### Handles

Handles (called "ports" in some libraries) are the connection points on nodes. They appear as grey circles by default but are just `div` elements that can be styled freely.

- **`type`** -- `'source'` or `'target'`
- **`position`** -- `Position.Top`, `Position.Bottom`, `Position.Left`, `Position.Right`
- **`id`** (optional) -- Required when a node has multiple handles of the same type

### Viewport

The viewport encompasses `x`, `y`, and `zoom` values defining the visible area and scale. Users navigate by panning (drag) and zooming (scroll wheel).

### Connection Line

A placeholder edge that appears while the user drags from a handle to create a new connection. Comes with the same four built-in types as edges and is fully customizable.

### Selection

Users select elements by clicking individually or holding Shift to create selection boxes. Selected items get elevated z-indexes and custom components receive a `selected` prop.

---

## 3. Creating Custom Node Types

Custom nodes are plain React components. React Flow wraps them in an interactive container that injects props like `id`, `position`, `data`, `selected`, and `isConnectable`.

### Basic Custom Node

```tsx
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

// Wrap in memo for performance
const CustomNode = memo(({ data, isConnectable }) => {
  return (
    <div style={{
      padding: '10px 20px',
      borderRadius: '8px',
      background: data.color || '#fff',
      border: '2px solid #222',
      minWidth: '150px',
    }}>
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} />
      <div>
        <strong>{data.label}</strong>
        {data.description && (
          <p style={{ margin: '5px 0 0', fontSize: '12px' }}>{data.description}</p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} />
    </div>
  );
});
```

### Registering Custom Node Types

**Critical:** Define `nodeTypes` OUTSIDE the component to prevent re-renders on every render cycle.

```tsx
import { ReactFlow } from '@xyflow/react';
import { CustomNode } from './CustomNode';
import { SumNode } from './SumNode';

// MUST be defined outside the component
const nodeTypes = {
  custom: CustomNode,
  sum: SumNode,
};

function Flow() {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      // ...
    />
  );
}
```

### Props Injected into Custom Nodes

| Prop | Type | Description |
|------|------|-------------|
| `id` | `string` | Node ID |
| `data` | `object` | The `data` field from the node definition |
| `type` | `string` | Node type string |
| `selected` | `boolean` | Whether the node is selected |
| `isConnectable` | `boolean` | Whether handles accept connections |
| `dragHandle` | `string` | CSS selector for the drag handle area |
| `positionAbsoluteX` | `number` | Absolute X position |
| `positionAbsoluteY` | `number` | Absolute Y position |

### Interactive Elements Inside Nodes

Use the `nodrag` and `nowheel` CSS classes on interactive elements (inputs, selectors, etc.) inside custom nodes to prevent conflict with node dragging and viewport scrolling:

```tsx
<input
  type="color"
  className="nodrag"
  onChange={(e) => updateNodeColor(id, e.target.value)}
/>
```

---

## 4. Handles and Connections

### Multiple Handles

When a node has multiple handles of the same type, each must have a unique `id`:

```tsx
const MultiHandleNode = memo(({ data }) => {
  return (
    <div style={{ padding: '15px', background: '#f0f0f0', borderRadius: '5px' }}>
      <Handle type="target" position={Position.Left} id="input-1" style={{ top: '30%' }} />
      <Handle type="target" position={Position.Left} id="input-2" style={{ top: '70%' }} />
      <div>{data.label}</div>
      <Handle type="source" position={Position.Right} id="output-1" style={{ top: '30%' }} />
      <Handle type="source" position={Position.Right} id="output-2" style={{ top: '70%' }} />
    </div>
  );
});
```

### Connecting to Specific Handles

When creating edges, specify `sourceHandle` and `targetHandle` to target specific handles:

```typescript
const edges = [
  { id: 'e1-2', source: '1', target: '2', targetHandle: 'input-1' },
  { id: 'e2-3', source: '2', target: '3', sourceHandle: 'output-2' },
];
```

### Handling New Connections

The `onConnect` callback fires when a user connects two handles by dragging:

```tsx
import { addEdge, type OnConnect } from '@xyflow/react';

const onConnect: OnConnect = useCallback(
  (params) => {
    setEdges((edges) => addEdge(params, edges));
  },
  [setEdges],
);

<ReactFlow onConnect={onConnect} /* ... */ />
```

### Connection Validation

Use the `isValidConnection` prop to control which connections are allowed:

```tsx
<ReactFlow
  isValidConnection={(connection) => {
    // Only allow connections between different node types
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    return sourceNode?.type !== targetNode?.type;
  }}
/>
```

---

## 5. Edge Types and Custom Edges

### Built-in Edge Types

| Type | Description |
|------|-------------|
| `default` (bezier) | Curved bezier path between nodes |
| `straight` | Direct straight line |
| `step` | Right-angle steps (L-shaped) |
| `smoothstep` | Rounded right-angle steps |

### Edge Options

```typescript
const edge: Edge = {
  id: 'e1-2',
  source: '1',
  target: '2',
  type: 'smoothstep',
  animated: true,          // Dashed animation
  label: 'connection',     // Text label
  style: { stroke: 'red' },
  markerEnd: { type: MarkerType.ArrowClosed }, // Arrow at end
  markerStart: { type: MarkerType.Arrow },     // Arrow at start
};
```

### Custom Edge Types

Custom edges follow the same pattern as custom nodes:

```tsx
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';

function DataEdge({ sourceX, sourceY, targetX, targetY, ...props }: EdgeProps) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, targetX, targetY });
  return <BaseEdge path={edgePath} {...props} />;
}

// Define outside component
const edgeTypes = { data: DataEdge };
```

### Edge Labels

React Flow supports rendering custom labels on edges, including interactive React components.

---

## 6. Built-in Components

React Flow ships with several companion components that enhance the user experience.

### MiniMap

Bird's-eye view of the entire flowgraph for navigation in large flows.

```tsx
import { MiniMap } from '@xyflow/react';

<ReactFlow nodes={nodes} edges={edges}>
  <MiniMap
    nodeColor={(node) => {
      switch (node.type) {
        case 'input': return '#6ede87';
        case 'output': return '#ff0072';
        default: return '#eee';
      }
    }}
    zoomable   // Allow zooming the minimap
    pannable   // Allow panning the minimap
  />
</ReactFlow>
```

### Controls

Small panel with zoom in, zoom out, fit view, and lock viewport buttons.

```tsx
import { Controls } from '@xyflow/react';

<ReactFlow nodes={nodes} edges={edges}>
  <Controls
    showInteractive={false}  // Hide the lock button
  />
</ReactFlow>
```

### Background

Adds a visual grid pattern (dots, lines, or cross) to the flow canvas.

```tsx
import { Background, BackgroundVariant } from '@xyflow/react';

<ReactFlow nodes={nodes} edges={edges}>
  <Background
    variant={BackgroundVariant.Dots}  // 'dots' | 'lines' | 'cross'
    gap={12}
    size={1}
    color="#aaa"
  />
</ReactFlow>
```

### Panel

Fixed overlay for titles, buttons, or any UI that should stay stationary relative to the viewport.

```tsx
import { Panel } from '@xyflow/react';

<ReactFlow nodes={nodes} edges={edges}>
  <Panel position="top-right">
    <button onClick={onSave}>Save</button>
    <button onClick={onRestore}>Restore</button>
  </Panel>
</ReactFlow>
```

Panel positions: `'top-left'`, `'top-center'`, `'top-right'`, `'bottom-left'`, `'bottom-center'`, `'bottom-right'`.

### NodeToolbar

Toolbar that appears next to a selected node, useful for node-specific actions.

```tsx
import { NodeToolbar } from '@xyflow/react';

function CustomNode({ data }) {
  return (
    <>
      <NodeToolbar position={Position.Top}>
        <button>Edit</button>
        <button>Delete</button>
      </NodeToolbar>
      <div>{data.label}</div>
    </>
  );
}
```

---

## 7. State Management Patterns

### Pattern 1: useNodesState / useEdgesState (Simple)

Good for prototyping and simple flows. Works like `useState` with an additional helper callback.

```tsx
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  type OnConnect,
} from '@xyflow/react';

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      fitView
    />
  );
}
```

**Tradeoff:** Fine for production, but as complexity grows (e.g., updating node data from inside custom nodes), a centralized store is preferable.

### Pattern 2: Zustand Store (Recommended for Complex Apps)

React Flow already uses Zustand internally, making it a natural choice. This pattern centralizes all graph state and actions.

```typescript
// store.ts
import {
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';
import { createWithEqualityFn } from 'zustand/traditional';

export type FlowState = {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateNodeData: (nodeId: string, data: Partial<Node['data']>) => void;
};

const useFlowStore = createWithEqualityFn<FlowState>((set, get) => ({
  nodes: [],
  edges: [],

  onNodesChange: (changes: NodeChange[]) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    set({ edges: addEdge(connection, get().edges) });
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  updateNodeData: (nodeId, newData) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...newData } }
          : node,
      ),
    });
  },
}));

export default useFlowStore;
```

Using the store in a component:

```tsx
import { ReactFlow } from '@xyflow/react';
import { shallow } from 'zustand/shallow';
import useFlowStore, { type FlowState } from './store';

const selector = (state: FlowState) => ({
  nodes: state.nodes,
  edges: state.edges,
  onNodesChange: state.onNodesChange,
  onEdgesChange: state.onEdgesChange,
  onConnect: state.onConnect,
});

function Flow() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } =
    useFlowStore(selector, shallow);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      fitView
    />
  );
}
```

**Key details:**
- Use `shallow` comparison from Zustand to prevent unnecessary re-renders when using multiple values from the store.
- `applyNodeChanges` and `applyEdgeChanges` are React Flow helpers that handle all change types (position, selection, removal, etc.).
- Create new objects when updating node data -- React Flow needs reference changes to detect updates.

### Pattern 3: useReactFlow Hook (Imperative API)

Access the React Flow instance for imperative operations. Must be used inside `ReactFlowProvider`.

```tsx
import { useReactFlow } from '@xyflow/react';

function Toolbar() {
  const { getNodes, getEdges, fitView, zoomIn, zoomOut, setViewport,
          screenToFlowPosition, toObject } = useReactFlow();

  const addNodeAtCenter = () => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    // ... add node at position
  };

  return (
    <div>
      <button onClick={() => fitView({ padding: 0.2, duration: 800 })}>Fit</button>
      <button onClick={() => zoomIn({ duration: 300 })}>Zoom In</button>
      <button onClick={() => zoomOut({ duration: 300 })}>Zoom Out</button>
      <button onClick={addNodeAtCenter}>Add Node</button>
    </div>
  );
}
```

### ReactFlowProvider

Required wrapper when using `useReactFlow` or when the `<ReactFlow>` component and its consumers are in different component trees:

```tsx
import { ReactFlowProvider } from '@xyflow/react';

export function App() {
  return (
    <ReactFlowProvider>
      <Flow />
      <Sidebar />  {/* Can use useReactFlow here too */}
    </ReactFlowProvider>
  );
}
```

---

## 8. Serialization and Deserialization (Save/Load)

### Save with `toObject()`

The `toObject()` method returns a `ReactFlowJsonObject` containing nodes, edges, and viewport state:

```typescript
type ReactFlowJsonObject = {
  nodes: Node[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };
};
```

### Complete Save/Restore Example

```tsx
import { useState, useCallback } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  Panel,
  Background,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const STORAGE_KEY = 'my-flow-state';

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [rfInstance, setRfInstance] = useState(null);
  const { setViewport } = useReactFlow();

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  // Save: serialize entire flow to JSON
  const onSave = useCallback(() => {
    if (rfInstance) {
      const flow = rfInstance.toObject();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(flow));
    }
  }, [rfInstance]);

  // Restore: deserialize JSON back to flow state
  const onRestore = useCallback(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const flow = JSON.parse(saved);
      setNodes(flow.nodes || []);
      setEdges(flow.edges || []);
      setViewport(flow.viewport || { x: 0, y: 0, zoom: 1 });
    }
  }, [setNodes, setEdges, setViewport]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onInit={setRfInstance}  // Capture the instance
      fitView
    >
      <Panel position="top-right">
        <button onClick={onSave}>Save</button>
        <button onClick={onRestore}>Restore</button>
      </Panel>
      <Background />
    </ReactFlow>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
```

### Storage Options

| Storage | Best For |
|---------|----------|
| `localStorage` | Quick prototyping, per-browser persistence |
| SQLite / database | Multi-device, server-backed persistence |
| API endpoint | Collaborative editing, cloud storage |

For this project (Tauri + SQLite), the natural approach is to save `JSON.stringify(flow.toObject())` to a `TEXT` column in SQLite and parse it back on load.

---

## 9. Sub Flows and Grouping

### Parent-Child Nodes

Set `parentId` on a child node to nest it inside a parent. The child's position becomes relative to the parent.

```typescript
const nodes = [
  {
    id: 'group-1',
    type: 'group',
    position: { x: 0, y: 0 },
    data: {},
    style: { width: 400, height: 300 },
  },
  {
    id: 'child-1',
    parentId: 'group-1',       // Nested inside group-1
    extent: 'parent',          // Cannot be dragged outside parent bounds
    position: { x: 20, y: 40 },
    data: { label: 'Child' },
  },
];
```

### Key Options

- **`parentId`** -- Sets the parent node
- **`extent: 'parent'`** -- Constrains the child within the parent's bounds
- **`type: 'group'`** -- Renders a group node (no handles by default)
- **`expandParent: true`** -- Parent auto-resizes when children are dragged near edges

### Selection Grouping

Users can select multiple nodes, group them dynamically, and ungroup later. Useful for organizing complex flows.

---

## 10. Performance Best Practices

### Critical Rules

1. **Define `nodeTypes` and `edgeTypes` OUTSIDE the component.** Defining them inside causes React Flow to re-render every time the parent re-renders.

   ```tsx
   // GOOD
   const nodeTypes = { custom: CustomNode };
   function Flow() { return <ReactFlow nodeTypes={nodeTypes} />; }

   // BAD -- causes re-renders
   function Flow() {
     const nodeTypes = { custom: CustomNode }; // New object every render!
     return <ReactFlow nodeTypes={nodeTypes} />;
   }
   ```

2. **Wrap custom nodes with `React.memo`.** Prevents re-rendering when sibling nodes change.

3. **Memoize callback props with `useCallback`.** Functions like `onNodeClick`, `onConnect`, `onNodesChange`.

4. **Memoize object/array props with `useMemo`.** Props like `defaultEdgeOptions`, `snapGrid`, `connectionLineStyle`.

5. **Use `shallow` comparison with Zustand selectors.** Prevents re-renders when accessing multiple store values.

### Advanced Optimizations

- **Avoid accessing the full `nodes` array** in viewport-level components. Store derived data (like selected node IDs) separately.
- **Collapse large node trees** using the `hidden` property rather than conditional rendering.
- **Simplify CSS** -- complex animations, shadows, and gradients hurt performance at scale.
- **Level-of-Detail (LOD) rendering** -- show simplified node content when zoomed out, full detail when zoomed in. Check viewport zoom level and render accordingly.
- **React Flow virtualizes nodes** outside the viewport by default, only rendering visible nodes. Be aware this means off-screen nodes do not mount their React components.

### Early Optimization Matters

Unlike typical React apps where premature optimization is discouraged, React Flow performance issues that appear later in development can be very difficult to fix without major refactoring. Establish good patterns from the start.

---

## 11. TypeScript Usage

### Typed Node Data

```typescript
import { type Node } from '@xyflow/react';

type NumberNodeData = {
  value: number;
};

type NumberNode = Node<NumberNodeData, 'number'>;

const nodes: NumberNode[] = [
  {
    id: '1',
    type: 'number',
    data: { value: 42 },
    position: { x: 0, y: 0 },
  },
];
```

### Typed Custom Node Props

```typescript
import { type NodeProps, Handle, Position } from '@xyflow/react';

type NumberNodeProps = NodeProps<NumberNode>;

function NumberNode({ data }: NumberNodeProps) {
  return (
    <div>
      <Handle type="target" position={Position.Top} />
      <span>{data.value}</span>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

### Typed Edge Data

```typescript
import { type Edge } from '@xyflow/react';

type DataEdge = Edge<{ weight: number }, 'data'>;

const edges: DataEdge[] = [
  {
    id: 'e1-2',
    type: 'data',
    source: '1',
    target: '2',
    data: { weight: 0.8 },
  },
];
```

---

## 12. Relevance to This Project

For the canvas workspace feature in claude-tauri-boilerplate, React Flow provides:

| Need | React Flow Solution |
|------|---------------------|
| Visual node layout | Core `<ReactFlow>` with drag, pan, zoom |
| Custom artifact cards | Custom node types with any React content |
| Connections between artifacts | Edges with handles |
| Navigation in large canvases | MiniMap + Controls components |
| State management | Zustand store (already used internally) |
| Save/load canvas state | `toObject()` / `setNodes()`+`setEdges()`+`setViewport()` to SQLite |
| Grouping related items | Sub flows with `parentId` and `type: 'group'` |
| Node-specific actions | NodeToolbar component |
| Grid snapping | Built-in `snapToGrid` + `snapGrid` props |
| Keyboard navigation | Built-in selection, delete, multi-select |
| Performance at scale | Virtualization, memo patterns, LOD rendering |

### Recommended Setup for This Project

```bash
pnpm add @xyflow/react zustand
```

Key architectural decisions:
- Use Zustand for canvas state (consistent with React Flow's internal usage)
- Define `nodeTypes` as a module-level constant
- Wrap custom nodes with `React.memo`
- Serialize canvas state with `toObject()` to SQLite `TEXT` column
- Use `@xyflow/react/dist/base.css` for minimal base styles, then apply Tailwind for theming

---

## 13. Sources

### Official Documentation
- [React Flow Quick Start](https://reactflow.dev/learn)
- [Terms and Definitions](https://reactflow.dev/learn/concepts/terms-and-definitions)
- [Building a Flow](https://reactflow.dev/learn/concepts/building-a-flow)
- [Custom Nodes](https://reactflow.dev/learn/customization/custom-nodes)
- [Handles](https://reactflow.dev/learn/customization/handles)
- [Edge Labels](https://reactflow.dev/learn/customization/edge-labels)
- [Built-in Components](https://reactflow.dev/learn/concepts/built-in-components)
- [State Management Guide](https://reactflow.dev/learn/advanced-use/state-management)
- [Performance Guide](https://reactflow.dev/learn/advanced-use/performance)
- [TypeScript Usage](https://reactflow.dev/learn/advanced-use/typescript)
- [Migration to v12](https://reactflow.dev/learn/troubleshooting/migrate-to-v12)
- [Common Errors](https://reactflow.dev/learn/troubleshooting/common-errors)

### API Reference
- [ReactFlow Component](https://reactflow.dev/api-reference/react-flow)
- [Node Type](https://reactflow.dev/api-reference/types/node)
- [Edge Type](https://reactflow.dev/api-reference/types/edge)
- [NodeTypes](https://reactflow.dev/api-reference/types/node-types)
- [EdgeTypes](https://reactflow.dev/api-reference/types/edge-types)
- [ReactFlowJsonObject](https://reactflow.dev/api-reference/types/react-flow-json-object)
- [useReactFlow Hook](https://reactflow.dev/api-reference/hooks/use-react-flow)
- [useNodesState Hook](https://reactflow.dev/api-reference/hooks/use-nodes-state)
- [useEdgesState Hook](https://reactflow.dev/api-reference/hooks/use-edges-state)
- [useStore Hook](https://reactflow.dev/api-reference/hooks/use-store)
- [MiniMap Component](https://reactflow.dev/api-reference/components/minimap)
- [Controls Component](https://reactflow.dev/api-reference/components/controls)
- [Panel Component](https://reactflow.dev/api-reference/components/panel)

### Examples
- [Feature Overview](https://reactflow.dev/examples/overview)
- [Edge Types](https://reactflow.dev/examples/edges/edge-types)
- [Custom Edges](https://reactflow.dev/examples/edges/custom-edges)
- [Edge Markers](https://reactflow.dev/examples/edges/markers)
- [Save and Restore](https://reactflow.dev/examples/interaction/save-and-restore)
- [Sub Flows](https://reactflow.dev/examples/grouping/sub-flows)
- [Selection Grouping](https://reactflow.dev/examples/grouping/selection-grouping)
- [Parent-Child Relations](https://reactflow.dev/examples/grouping/parent-child-relation)
- [Node Toolbar](https://reactflow.dev/examples/nodes/node-toolbar)
- [Drag Handle](https://reactflow.dev/examples/nodes/drag-handle)
- [Easy Connect](https://reactflow.dev/examples/nodes/easy-connect)
- [Zoom Transitions](https://reactflow.dev/examples/interaction/zoom-transitions)

### Other
- [GitHub Repository: xyflow/xyflow](https://github.com/xyflow/xyflow)
- [npm: @xyflow/react](https://www.npmjs.com/package/@xyflow/react)
- [xyflow Blog: React Flow 12 Release](https://xyflow.com/blog/react-flow-12-release)
- [xyflow Blog: Spring 2025 Update](https://xyflow.com/blog/spring-update-2025)
- [React Flow v12 Discussion](https://github.com/xyflow/xyflow/discussions/3764)
- [Synergy Codes: React Flow State Management Webbook](https://www.synergycodes.com/webbook/webbook-react-flow-state-management)
- [Synergy Codes: Performance Optimization Guide](https://www.synergycodes.com/blog/guide-to-optimize-react-flow-project-performance)
