import type { Node, Edge } from '@xyflow/react';
import type {
  TriggerNodeData,
  ConditionNodeData,
  ActionNodeData,
  HookType,
} from '../components/agent-builder/types/canvas';
import { HOOK_EVENTS } from '../components/agent-builder/types/canvas';

interface HookEntry {
  type: HookType;
  command?: string;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  prompt?: string;
  model?: string;
  description?: string;
  timeout?: number;
}

interface HookGroup {
  matcher?: string;
  hooks: HookEntry[];
}

interface HooksJson {
  hooks: Record<string, HookGroup[]>;
}

/**
 * Converts React Flow canvas nodes + edges into a Claude Code hooks JSON string.
 *
 * Rules:
 * - Each TriggerNode becomes an event key in the hooks object.
 * - Trigger → Condition → Action(s): creates a group WITH a matcher.
 * - Trigger → Action(s) directly: creates a group WITHOUT a matcher.
 * - Orphaned nodes (not reachable from a trigger) are skipped.
 * - Invalid/incomplete nodes are skipped gracefully.
 */
export function compileCanvasToHooks(nodes: Node[], edges: Edge[]): string {
  const result: HooksJson = { hooks: Object.create(null) as Record<string, HookGroup[]> };

  // Build adjacency map: sourceId → targetIds
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = adjacency.get(edge.source);
    if (targets) {
      targets.push(edge.target);
    } else {
      adjacency.set(edge.source, [edge.target]);
    }
  }

  // Index nodes by id for fast lookup
  const nodeById = new Map<string, Node>();
  for (const node of nodes) {
    nodeById.set(node.id, node);
  }

  const triggerNodes = nodes.filter((n) => n.type === 'trigger');

  for (const trigger of triggerNodes) {
    const data = trigger.data as TriggerNodeData;
    const event = data.event;
    if (!event) continue;
    if (!HOOK_EVENTS.includes(event as any)) {
      console.warn(`[canvasCompiler] Unknown hook event: "${event}" — preserving in output`);
      // Don't skip — preserve unknown events
    }

    const groups: HookGroup[] = [];
    const connectedIds = adjacency.get(trigger.id) ?? [];
    const processedActionIds = new Set<string>();

    for (const connectedId of connectedIds) {
      const connectedNode = nodeById.get(connectedId);
      if (!connectedNode) continue;

      if (connectedNode.type === 'condition') {
        // Trigger → Condition → Action(s)
        const condData = connectedNode.data as ConditionNodeData;
        const actionIds = adjacency.get(connectedNode.id) ?? [];
        const hooks: HookEntry[] = [];
        for (const id of actionIds) {
          if (processedActionIds.has(id)) continue; // skip duplicates
          const node = nodeById.get(id);
          if (!node || node.type !== 'action') continue;
          const hookEntry = buildHookEntry(node.data as ActionNodeData);
          if (hookEntry) {
            hooks.push(hookEntry);
            processedActionIds.add(id);
          }
        }

        if (hooks.length > 0) {
          const group: HookGroup = { hooks };
          if (condData.matcher) {
            group.matcher = condData.matcher;
          }
          groups.push(group);
        }
      } else if (connectedNode.type === 'action') {
        // Trigger → Action directly (no condition) — each gets its own group
        if (processedActionIds.has(connectedNode.id)) continue;
        const hookEntry = buildHookEntry(connectedNode.data as ActionNodeData);
        if (hookEntry) {
          groups.push({ hooks: [hookEntry] });
          processedActionIds.add(connectedNode.id);
        }
      }
    }

    if (groups.length > 0) {
      // If multiple triggers share the same event, merge groups
      if (Object.prototype.hasOwnProperty.call(result.hooks, event)) {
        result.hooks[event].push(...groups);
      } else {
        result.hooks[event] = groups;
      }
    }
  }

  return JSON.stringify(result, null, 2);
}

function buildHookEntry(data: ActionNodeData): HookEntry | null {
  if (!data.hookType) return null;

  const entry: HookEntry = { type: data.hookType };

  switch (data.hookType) {
    case 'command':
      if (!data.command) return null;
      entry.command = data.command;
      if (data.timeout != null) entry.timeout = data.timeout;
      break;
    case 'http':
      if (!data.url) return null;
      entry.url = data.url;
      if (data.method) entry.method = data.method;
      if (data.headers && typeof data.headers === 'object' && !Array.isArray(data.headers)) {
        const CRLF_RE = /[\r\n]/;
        const sanitizedHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(data.headers)) {
          if (typeof k === 'string' && typeof v === 'string'
              && !CRLF_RE.test(k) && !CRLF_RE.test(v)
              && k.length < 200 && v.length < 1000) {
            sanitizedHeaders[k] = v;
          }
        }
        if (Object.keys(sanitizedHeaders).length > 0) {
          entry.headers = sanitizedHeaders;
        }
      }
      if (data.timeout != null) entry.timeout = data.timeout;
      break;
    case 'prompt':
      if (!data.prompt) return null;
      entry.prompt = data.prompt;
      if (data.model) entry.model = data.model;
      break;
    case 'agent':
      if (!data.description) return null;
      entry.description = data.description;
      break;
    default:
      return null;
  }

  return entry;
}
