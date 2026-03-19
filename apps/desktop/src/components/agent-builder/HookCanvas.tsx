import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Background,
  Controls,
  MiniMap,
  type Connection,
  type OnConnect,
  type NodeMouseHandler,
} from '@xyflow/react';
import { nodeTypes } from './nodes';
import { NodePalette } from './panels/NodePalette';
import { NodeConfigPanel } from './panels/NodeConfigPanel';
import { compileCanvasToHooks } from '../../lib/canvasCompiler';
import { generateCanvasFromHooks } from '../../lib/canvasGenerator';
import { isValidConnection as checkConnection } from '../../lib/connectionRules';
import type {
  CanvasNode,
  CanvasEdge,
  CanvasState,
  CanvasNodeType,
} from './types/canvas';

const VALID_NODE_TYPES = new Set(['trigger', 'condition', 'action']);
const MAX_STRING_LENGTH = 10_000;
const MAX_NODE_COUNT = 200;
const MAX_EDGES = 400;

function sanitizeNodeData(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'string') {
      result[key] = val.slice(0, MAX_STRING_LENGTH);
    } else if (typeof val === 'number' && isFinite(val)) {
      result[key] = val;
    } else if (val === null || val === undefined) {
      result[key] = val;
    } else if (typeof val === 'boolean') {
      result[key] = val;
    }
    // Skip objects/arrays — keep data flat
  }
  return result;
}

interface HookCanvasProps {
  hooksJson: string | null;
  hooksCanvasJson: string | null;
  onChange: (hooksJson: string, hooksCanvasJson: string) => void;
}

type DebouncedFn<T extends (...args: any[]) => void> = T & { cancel: () => void };

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): DebouncedFn<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fn(...args); }, ms);
  };
  debounced.cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
  };
  return debounced as DebouncedFn<T>;
}

function HookCanvasInner({ hooksJson, hooksCanvasJson, onChange }: HookCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasEdge>([]);
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const initialized = useRef(false);
  const isFirstRender = useRef(true);

  // Load saved state on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Priority 1: saved canvas JSON (atomic load — both nodes and edges or neither)
    if (hooksCanvasJson) {
      try {
        const saved: CanvasState = JSON.parse(hooksCanvasJson);
        if (saved.nodes && Array.isArray(saved.nodes) && saved.nodes.length <= MAX_NODE_COUNT
            && saved.edges && Array.isArray(saved.edges) && saved.edges.length <= MAX_EDGES) {
          setNodes(saved.nodes as CanvasNode[]);
          setEdges(saved.edges as CanvasEdge[]);
          return; // Only return early if we successfully loaded BOTH
        }
        // If nodes exceed limit or arrays missing, fall through to regenerate from hooksJson
        console.warn(`Canvas state has ${saved.nodes?.length} nodes (max ${MAX_NODE_COUNT}), regenerating from hooks JSON`);
      } catch {
        // fall through to priority 2
      }
    }

    // Priority 2: generate from hooks JSON
    if (hooksJson) {
      const generated = generateCanvasFromHooks(hooksJson);
      if (generated) {
        setNodes(generated.nodes as CanvasNode[]);
        setEdges(generated.edges as CanvasEdge[]);
      }
    }
  }, []);

  // Debounced change notification
  const notifyChange = useCallback(
    debounce((currentNodes: CanvasNode[], currentEdges: CanvasEdge[]) => {
      const newHooksJson = compileCanvasToHooks(currentNodes, currentEdges);
      const newCanvasJson = JSON.stringify({
        nodes: currentNodes,
        edges: currentEdges,
      });
      onChange(newHooksJson, newCanvasJson);
    }, 500) as DebouncedFn<(nodes: CanvasNode[], edges: CanvasEdge[]) => void>,
    [onChange],
  );

  // Cancel pending debounce on unmount
  useEffect(() => {
    return () => {
      notifyChange.cancel();
    };
  }, [notifyChange]);

  // Watch nodes/edges for structural changes (skip first render + selection/drag changes)
  const prevStructuralRef = useRef<string>('');

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Structural fingerprint: only id, type, position, data — ignore selected/dragging/positionAbsolute
    const structural = JSON.stringify(
      nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data }))
    ) + '|' + JSON.stringify(
      edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle }))
    );

    if (structural === prevStructuralRef.current) return; // Only presentational change, skip
    prevStructuralRef.current = structural;
    notifyChange(nodes, edges);
  }, [nodes, edges, notifyChange]);

  // Connection validation
  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);
      if (!sourceNode || !targetNode) return;

      const sourceType = sourceNode.type as CanvasNodeType;
      const targetType = targetNode.type as CanvasNodeType;

      if (checkConnection(sourceType, targetType)) {
        setEdges((eds) => addEdge(params, eds));
      }
    },
    [nodes, setEdges],
  );

  // Drag and drop from palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData('application/reactflow');
      if (!raw) return;

      try {
        const { nodeType, data } = JSON.parse(raw);

        // Validate nodeType
        if (!VALID_NODE_TYPES.has(nodeType)) return;

        // Validate data is a plain object
        if (!data || typeof data !== 'object' || Array.isArray(data)) return;

        // Enforce max node count
        if (nodes.length >= MAX_NODE_COUNT) {
          console.warn('Maximum node count reached');
          return;
        }

        // Sanitize string fields
        const sanitizedData = sanitizeNodeData(data);

        // Warn on dangerous hook types created via drag-and-drop
        if (nodeType === 'action') {
          const hookType = (data as Record<string, unknown>).hookType;
          if (hookType === 'command' || hookType === 'http') {
            const typeName = hookType === 'command' ? 'command execution' : 'HTTP request';
            const confirmed = window.confirm(
              `This will add a ${typeName} hook that can ${hookType === 'command' ? 'run local commands' : 'make HTTP requests'}. Add anyway?`
            );
            if (!confirmed) return;
          }
        }

        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const newNode: CanvasNode = {
          id: `${nodeType}-${Date.now()}`,
          type: nodeType,
          position,
          data: sanitizedData,
        } as CanvasNode;

        setNodes((nds) => [...nds, newNode]);
      } catch {
        // invalid drag data
      }
    },
    [screenToFlowPosition, setNodes, nodes],
  );

  // Node selection
  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedNode(node as CanvasNode);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Update node data from config panel
  const onUpdateNode = useCallback(
    (nodeId: string, newData: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n,
        ) as CanvasNode[],
      );
      setSelectedNode((prev) =>
        prev && prev.id === nodeId
          ? ({ ...prev, data: { ...prev.data, ...newData } } as CanvasNode)
          : prev,
      );
    },
    [],
  );

  return (
    <div className="flex h-full w-full">
      {/* Left palette */}
      <NodePalette />

      {/* Canvas */}
      <div ref={reactFlowWrapper} className="flex-1 h-full bg-neutral-950">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode="Delete"
          className="bg-neutral-950"
        >
          <Background color="#374151" gap={16} />
          <Controls className="[&>button]:bg-neutral-800 [&>button]:border-neutral-700 [&>button]:text-white" />
          <MiniMap className="!bg-neutral-900" />
        </ReactFlow>
      </div>

      {/* Right config panel */}
      {selectedNode && (
        <NodeConfigPanel
          selectedNode={selectedNode}
          onUpdateNode={onUpdateNode}
        />
      )}
    </div>
  );
}

export function HookCanvas(props: HookCanvasProps) {
  return (
    <ReactFlowProvider>
      <HookCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
