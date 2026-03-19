import type { Node, Edge } from '@xyflow/react';
import type {
  TriggerNodeData,
  ConditionNodeData,
  ActionNodeData,
  HookType,
} from '../components/agent-builder/types/canvas';
import { HOOK_EVENTS } from '../components/agent-builder/types/canvas';

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype', '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__']);
const MAX_MATCHER_LENGTH = 200;

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
    if (DANGEROUS_KEYS.has(event)) {
      console.warn(`[canvasCompiler] Blocking dangerous event key: "${event}"`);
      continue;
    }
    if (!HOOK_EVENTS.includes(event as any)) {
      console.warn(`[canvasCompiler] Unknown hook event: "${event}" — preserving in output`);
      // Don't skip — preserve unknown events
    }

    const groups: HookGroup[] = [];
    // Sort connected nodes by Y position for deterministic top-to-bottom ordering
    const sortByY = (ids: string[]) =>
      [...ids].sort((a, b) => ((nodeById.get(a)?.position?.y ?? 0) - (nodeById.get(b)?.position?.y ?? 0)));
    const connectedIds = sortByY(adjacency.get(trigger.id) ?? []);
    const processedActionIds = new Set<string>();

    for (const connectedId of connectedIds) {
      const connectedNode = nodeById.get(connectedId);
      if (!connectedNode) continue;

      if (connectedNode.type === 'condition') {
        // Trigger → Condition → Action(s)
        const condData = connectedNode.data as ConditionNodeData;
        const actionIds = sortByY(adjacency.get(connectedNode.id) ?? []);
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
            group.matcher = condData.matcher.slice(0, MAX_MATCHER_LENGTH);
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
      if (typeof data.command !== 'string' || !data.command.trim()) return null;
      entry.command = data.command.slice(0, 10_000);
      if (data.timeout != null && Number.isFinite(Number(data.timeout)) && Number(data.timeout) > 0) {
        entry.timeout = Math.floor(Number(data.timeout));
      }
      break;
    case 'http':
      if (typeof data.url !== 'string' || !data.url.trim()) return null;
      const CRLF_URL = /[\r\n]/;
      if (CRLF_URL.test(data.url)) return null; // Reject CRLF injection in URL
      entry.url = data.url.slice(0, 2000);
      if (typeof data.method === 'string') {
        const cleanMethod = data.method.replace(/[\r\n]/g, '').slice(0, 20);
        if (cleanMethod) entry.method = cleanMethod;
      }
      if (data.headers && typeof data.headers === 'object' && !Array.isArray(data.headers)) {
        const CRLF_RE = /[\r\n]/;
        const sanitizedHeaders: Record<string, string> = Object.create(null);
        for (const [k, v] of Object.entries(data.headers)) {
          if (DANGEROUS_KEYS.has(k)) continue;
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
      if (data.timeout != null && Number.isFinite(Number(data.timeout)) && Number(data.timeout) > 0) {
        entry.timeout = Math.floor(Number(data.timeout));
      }
      break;
    case 'prompt':
      if (typeof data.prompt !== 'string' || !data.prompt.trim()) return null;
      entry.prompt = data.prompt.slice(0, 50_000);
      if (typeof data.model === 'string') entry.model = data.model.slice(0, 200);
      break;
    case 'agent':
      if (typeof data.description !== 'string' || !data.description.trim()) return null;
      entry.description = data.description.slice(0, 10_000);
      break;
    default:
      return null;
  }

  return entry;
}
