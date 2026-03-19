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
const MAX_PROMPT_LENGTH = 50_000;
const MAX_COMMAND_LENGTH = 10_000;
const MAX_URL_LENGTH = 2_000;
const MAX_NODE_COUNT = 200;
const MAX_EDGES = 400;
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype', '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__']);

function sanitizeNodeData(data: Record<string, unknown>): Record<string, unknown> {
  const CRLF_RE = /[\r\n]/;
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (DANGEROUS_KEYS.has(key)) continue;

    if (typeof val === 'string') {
      // Per-field length limits
      let limit = MAX_STRING_LENGTH;
      if (key === 'prompt') limit = MAX_PROMPT_LENGTH;
      else if (key === 'command' || key === 'description') limit = MAX_COMMAND_LENGTH;
      else if (key === 'url') limit = MAX_URL_LENGTH;
      result[key] = val.slice(0, limit);
    } else if (typeof val === 'number' && isFinite(val)) {
      result[key] = val;
    } else if (val === null || val === undefined) {
      result[key] = val;
    } else if (typeof val === 'boolean') {
      result[key] = val;
    } else if (key === 'headers' && val && typeof val === 'object' && !Array.isArray(val)) {
      // Sanitize headers: allow plain string key-value pairs only
      const sanitizedHeaders: Record<string, string> = {};
      for (const [hk, hv] of Object.entries(val as Record<string, unknown>)) {
        if (DANGEROUS_KEYS.has(hk)) continue;
        if (typeof hk === 'string' && typeof hv === 'string'
            && !CRLF_RE.test(hk) && !CRLF_RE.test(hv)
            && hk.length < 200 && hv.length < 1000) {
          sanitizedHeaders[hk] = hv;
        }
      }
      if (Object.keys(sanitizedHeaders).length > 0) {
        result[key] = sanitizedHeaders;
      }
    }
    // Skip other nested objects/arrays
  }
  return result;
}

function stripDangerousKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!DANGEROUS_KEYS.has(k) && typeof k === 'string' && k.length < 200) {
      result[k] = v;
    }
  }
  return result;
}

function canvasHasDangerousActions(savedState: { nodes: Array<Record<string, unknown>> }): boolean {
  return savedState.nodes.some(
    (n) =>
      n?.type === 'action' &&
      ((n?.data as Record<string, unknown>)?.hookType === 'command' ||
        (n?.data as Record<string, unknown>)?.hookType === 'http'),
  );
}

function isValidCanvasState(saved: unknown): saved is CanvasState {
  if (!saved || typeof saved !== 'object') return false;
  const s = saved as Record<string, unknown>;
  if (!Array.isArray(s.nodes) || !Array.isArray(s.edges)) return false;
  if (s.nodes.length > MAX_NODE_COUNT || s.edges.length > MAX_EDGES) return false;

  const VALID_TYPES = new Set(['trigger', 'condition', 'action']);
  const nodeIds = new Set<string>();

  for (const node of s.nodes) {
    if (!node || typeof node !== 'object') return false;
    const n = node as Record<string, unknown>;
    if (typeof n.id !== 'string' || n.id.length === 0 || n.id.length > 100) return false;
    if (typeof n.type !== 'string' || !VALID_TYPES.has(n.type)) return false;
    const pos = n.position as Record<string, unknown> | undefined;
    if (!pos || typeof pos.x !== 'number' || !isFinite(pos.x)) return false;
    if (typeof pos.y !== 'number' || !isFinite(pos.y)) return false;
    if (!n.data || typeof n.data !== 'object') return false;

    // Reject dangerous keys in node IDs
    const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
    if (DANGEROUS_KEYS.has(n.id)) return false;

    // Validate primitive types per node type
    if (n.type === 'trigger') {
      if ((n.data as any).event !== undefined && typeof (n.data as any).event !== 'string') return false;
    }
    if (n.type === 'condition') {
      if ((n.data as any).matcher !== undefined && typeof (n.data as any).matcher !== 'string') return false;
    }
    if (n.type === 'action') {
      const d = n.data as any;
      if (d.command !== undefined && typeof d.command !== 'string') return false;
      if (d.url !== undefined && typeof d.url !== 'string') return false;
      if (d.prompt !== undefined && typeof d.prompt !== 'string') return false;
      if (d.description !== undefined && typeof d.description !== 'string') return false;
    }

    if (nodeIds.has(n.id)) return false; // duplicate ID
    nodeIds.add(n.id);
  }

  for (const edge of s.edges) {
    if (!edge || typeof edge !== 'object') return false;
    const e = edge as Record<string, unknown>;
    if (typeof e.id !== 'string' || typeof e.source !== 'string' || typeof e.target !== 'string') return false;
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) return false; // dangling edge
  }

  return true;
}

function getHooksFingerprint(nodes: CanvasNode[], edges: CanvasEdge[]): string {
  return JSON.stringify(nodes.map(n => ({ id: n.id, type: n.type, data: n.data })))
    + '|'
    + JSON.stringify(edges.map(e => ({ source: e.source, target: e.target })));
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
  const lastCompiledHooksJsonRef = useRef<string>(hooksJson ?? '');
  const latestNodesRef = useRef<CanvasNode[]>([]);
  const latestEdgesRef = useRef<CanvasEdge[]>([]);
  const pendingStructuralRef = useRef(false);

  // Always keep refs up to date — runs after every render
  useEffect(() => {
    latestNodesRef.current = nodes;
    latestEdgesRef.current = edges;
  });

  // Load saved state on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Priority 1: saved canvas JSON (atomic load — both nodes and edges or neither)
    if (hooksCanvasJson) {
      try {
        const saved = JSON.parse(hooksCanvasJson);
        if (isValidCanvasState(saved)) {
          const hasDangerous = canvasHasDangerousActions(saved);
          const hooksAlreadyDangerous =
            hooksJson &&
            (hooksJson.includes('"type":"command"') ||
              hooksJson.includes('"type":"http"'));

          if (hasDangerous && !hooksAlreadyDangerous) {
            const confirmed = window.confirm(
              'This saved canvas contains command or HTTP hooks that can execute local commands or make HTTP requests. Load canvas anyway?',
            );
            if (!confirmed) {
              // Fall through to generate from hooksJson instead
            } else {
              const sanitizedNodes = saved.nodes.map((n: any) => ({
                id: String(n.id).slice(0, 100),
                type: n.type,
                position: { x: n.position?.x ?? 0, y: n.position?.y ?? 0 },
                data: sanitizeNodeData(stripDangerousKeys(n.data ?? {})),
              }));
              const sanitizedEdges = saved.edges.map((e: any) => ({
                id: String(e.id).slice(0, 100),
                source: String(e.source).slice(0, 100),
                target: String(e.target).slice(0, 100),
              }));
              setNodes(sanitizedNodes as CanvasNode[]);
              setEdges(sanitizedEdges as CanvasEdge[]);
              prevStructuralRef.current = getHooksFingerprint(sanitizedNodes as CanvasNode[], sanitizedEdges as CanvasEdge[]);
              lastCompiledHooksJsonRef.current =
                hooksJson ?? compileCanvasToHooks(sanitizedNodes as CanvasNode[], sanitizedEdges as CanvasEdge[]);
              return;
            }
          } else {
            // No dangerous hooks or already known — load directly
            const sanitizedNodes = saved.nodes.map((n: any) => ({
              id: String(n.id).slice(0, 100),
              type: n.type,
              position: { x: n.position?.x ?? 0, y: n.position?.y ?? 0 },
              data: sanitizeNodeData(stripDangerousKeys(n.data ?? {})),
            }));
            const sanitizedEdges = saved.edges.map((e: any) => ({
              id: String(e.id).slice(0, 100),
              source: String(e.source).slice(0, 100),
              target: String(e.target).slice(0, 100),
            }));
            setNodes(sanitizedNodes as CanvasNode[]);
            setEdges(sanitizedEdges as CanvasEdge[]);
            prevStructuralRef.current = getHooksFingerprint(sanitizedNodes as CanvasNode[], sanitizedEdges as CanvasEdge[]);
            lastCompiledHooksJsonRef.current =
              hooksJson ?? compileCanvasToHooks(sanitizedNodes as CanvasNode[], sanitizedEdges as CanvasEdge[]);
            return;
          }
        }
        console.warn('[HookCanvas] Invalid canvas state, regenerating from hooks JSON');
      } catch {
        console.warn('[HookCanvas] Failed to parse canvas JSON, regenerating');
      }
    }

    // Priority 2: generate from hooks JSON
    if (hooksJson) {
      const generated = generateCanvasFromHooks(hooksJson);
      if (generated) {
        setNodes(generated.nodes as CanvasNode[]);
        setEdges(generated.edges as CanvasEdge[]);
        prevStructuralRef.current = getHooksFingerprint(generated.nodes as CanvasNode[], generated.edges as CanvasEdge[]);
        lastCompiledHooksJsonRef.current = hooksJson;
      }
    }
  }, []);

  // Debounced change notification — reads from refs to always capture latest snapshot
  const notifyChange = useCallback(
    debounce(() => {
      const currentNodes = latestNodesRef.current;
      const currentEdges = latestEdgesRef.current;
      const newHooksJson = compileCanvasToHooks(currentNodes, currentEdges);
      const newCanvasJson = JSON.stringify({
        nodes: currentNodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
        edges: currentEdges.map(({ id, source, target }) => ({ id, source, target })),
      });
      lastCompiledHooksJsonRef.current = newHooksJson;
      pendingStructuralRef.current = false; // Structural change has been processed
      onChange(newHooksJson, newCanvasJson);
    }, 500) as DebouncedFn<() => void>,
    [onChange],
  );

  // Debounced layout save — persists position changes without recompiling hooks
  const saveLayout = useCallback(
    debounce(() => {
      const currentHooksJson = lastCompiledHooksJsonRef.current;
      if (!currentHooksJson) return; // Don't save if we don't have valid hooks yet
      const currentNodes = latestNodesRef.current;
      const currentEdges = latestEdgesRef.current;
      const canvasJson = JSON.stringify({
        nodes: currentNodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
        edges: currentEdges.map(({ id, source, target }) => ({ id, source, target })),
      });
      onChange(currentHooksJson, canvasJson);
    }, 2000) as DebouncedFn<() => void>,
    [onChange],
  );

  // Cancel pending debounces on unmount
  useEffect(() => {
    return () => {
      notifyChange.cancel();
      saveLayout.cancel();
    };
  }, [notifyChange, saveLayout]);

  // Watch nodes/edges for structural changes — excludes position so dragging doesn't recompile hooks
  const prevStructuralRef = useRef<string>('');

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevStructuralRef.current = getHooksFingerprint(nodes, edges);
      // Only set if mount effect hasn't already populated it with a real compiled value
      if (!lastCompiledHooksJsonRef.current) {
        lastCompiledHooksJsonRef.current = hooksJson ?? '';
      }
      return;
    }

    const fingerprint = getHooksFingerprint(nodes, edges);
    if (fingerprint === prevStructuralRef.current) {
      // Position-only change — only save layout if no structural change is pending
      if (!pendingStructuralRef.current) {
        saveLayout();
      }
      return;
    }
    prevStructuralRef.current = fingerprint;
    pendingStructuralRef.current = true; // Mark structural change pending
    saveLayout.cancel(); // Cancel pending layout save — structural save will include positions
    notifyChange();
  }, [nodes, edges, notifyChange, saveLayout]);

  // Connection validation
  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);
      if (!sourceNode || !targetNode) return;

      const sourceType = sourceNode.type as CanvasNodeType;
      const targetType = targetNode.type as CanvasNodeType;

      if (!checkConnection(sourceType, targetType)) return;

      setEdges((eds) => {
        if (eds.length >= MAX_EDGES) return eds;
        if (targetType === 'action' && eds.some(e => e.target === params.target)) return eds;
        return addEdge(params, eds);
      });
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
          id: `${nodeType}-${crypto.randomUUID()}`,
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

  // Clear selected node if it was deleted
  useEffect(() => {
    if (selectedNode && !nodes.find(n => n.id === selectedNode.id)) {
      setSelectedNode(null);
    }
  }, [nodes, selectedNode]);

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
