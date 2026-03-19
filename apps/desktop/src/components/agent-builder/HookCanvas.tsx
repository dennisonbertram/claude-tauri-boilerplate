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

interface HookCanvasProps {
  hooksJson: string | null;
  hooksCanvasJson: string | null;
  onChange: (hooksJson: string, hooksCanvasJson: string) => void;
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
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

    // Priority 1: saved canvas JSON
    if (hooksCanvasJson) {
      try {
        const saved: CanvasState = JSON.parse(hooksCanvasJson);
        if (saved.nodes) setNodes(saved.nodes as CanvasNode[]);
        if (saved.edges) setEdges(saved.edges as CanvasEdge[]);
        return;
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
    }, 500),
    [onChange],
  );

  // Watch nodes/edges for changes (skip first render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    notifyChange(nodes, edges);
  }, [nodes, edges]);

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
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const newNode: CanvasNode = {
          id: `${nodeType}-${Date.now()}`,
          type: nodeType,
          position,
          data,
        } as CanvasNode;

        setNodes((nds) => [...nds, newNode]);
      } catch {
        // invalid drag data
      }
    },
    [screenToFlowPosition, setNodes],
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
