import type { Node, Edge } from '@xyflow/react';

export type CanvasNodeType = 'trigger' | 'condition' | 'action';

export interface TriggerNodeData extends Record<string, unknown> {
  event: string; // e.g. "PreToolUse"
  label: string;
}

export interface ConditionNodeData extends Record<string, unknown> {
  matcher: string; // regex string
  label: string;
}

export type HookType = 'command' | 'http' | 'prompt' | 'agent';

export interface ActionNodeData extends Record<string, unknown> {
  hookType: HookType;
  label: string;
  // command
  command?: string;
  timeout?: number;
  // http
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  // prompt
  prompt?: string;
  model?: string;
  // agent
  description?: string;
}

export type TriggerNode = Node<TriggerNodeData, 'trigger'>;
export type ConditionNode = Node<ConditionNodeData, 'condition'>;
export type ActionNode = Node<ActionNodeData, 'action'>;
export type CanvasNode = TriggerNode | ConditionNode | ActionNode;
export type CanvasEdge = Edge;

export interface CanvasState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

export const HOOK_EVENTS = [
  'SessionStart',
  'SessionEnd',
  'PreToolUse',
  'PostToolUse',
  'Stop',
  'SubagentStop',
  'UserPromptSubmit',
  'PreCompact',
  'Notification',
] as const;

export type HookEvent = (typeof HOOK_EVENTS)[number];
