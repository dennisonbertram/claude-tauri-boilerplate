import type {
  CanvasState,
  CanvasNode,
  CanvasEdge,
  TriggerNodeData,
  ConditionNodeData,
  ActionNodeData,
  HookType,
} from '../components/agent-builder/types/canvas';

const MAX_EDGES = 400;
const MAX_GENERATED_NODES = 200;
const MAX_MATCHER_LENGTH = 200;

interface HookEntryInput {
  type?: string;
  command?: string;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  prompt?: string;
  model?: string;
  description?: string;
  timeout?: number;
}

interface HookGroupInput {
  matcher?: string;
  hooks?: HookEntryInput[];
}

/**
 * Converts a Claude Code hooks JSON string into React Flow canvas nodes + edges.
 *
 * Returns null for invalid/empty input. Gracefully skips malformed groups.
 *
 * Layout: triggers at x=50, conditions at x=350, actions at x=650, rows spaced 150px apart.
 */
export function generateCanvasFromHooks(
  hooksJsonString: string | null,
): CanvasState | null {
  if (!hooksJsonString) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(hooksJsonString);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const hooks = (parsed as Record<string, unknown>).hooks;
  if (!hooks || typeof hooks !== 'object') return null;

  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];
  let nodeIdCounter = 0;

  const genId = (prefix: string) => `${prefix}-${++nodeIdCounter}`;

  // Layout constants
  const TRIGGER_X = 50;
  const CONDITION_X = 350;
  const ACTION_X = 650;
  const ROW_HEIGHT = 150;
  let triggerY = 50;

  const limitReached = () => nodes.length >= MAX_GENERATED_NODES || edges.length >= MAX_EDGES;

  try {
    for (const [event, groups] of Object.entries(
      hooks as Record<string, unknown>,
    )) {
      if (!Array.isArray(groups)) continue;
      if (limitReached()) break;

      const triggerId = genId('trigger');
      const triggerData: TriggerNodeData = { event, label: event };
      nodes.push({
        id: triggerId,
        type: 'trigger' as const,
        position: { x: TRIGGER_X, y: triggerY },
        data: triggerData,
      });
      if (limitReached()) break;

      let conditionY = triggerY;

      for (const group of groups) {
        if (!group || typeof group !== 'object') continue;
        if (limitReached()) break;
        const hookList = Array.isArray((group as HookGroupInput).hooks) ? (group as HookGroupInput).hooks! : [];
        if (hookList.length === 0) continue;

        if ((group as HookGroupInput).matcher) {
          // Create a condition node for the matcher
          const conditionId = genId('condition');
          const rawMatcher = (group as HookGroupInput).matcher!;
          const condData: ConditionNodeData = {
            matcher: typeof rawMatcher === 'string' ? rawMatcher.slice(0, MAX_MATCHER_LENGTH) : '',
            label: `Match: ${typeof rawMatcher === 'string' ? rawMatcher.slice(0, 50) : ''}`,
          };
          nodes.push({
            id: conditionId,
            type: 'condition' as const,
            position: { x: CONDITION_X, y: conditionY },
            data: condData,
          });
          edges.push({
            id: genId('edge'),
            source: triggerId,
            target: conditionId,
          });
          if (limitReached()) break;

          let actionY = conditionY;
          for (const hook of hookList) {
            if (limitReached()) break;
            if (!hook || typeof hook !== 'object') continue;
            const actionData = buildActionData(hook);
            if (!actionData) continue;
            const actionId = genId('action');
            nodes.push({
              id: actionId,
              type: 'action' as const,
              position: { x: ACTION_X, y: actionY },
              data: actionData,
            });
            edges.push({
              id: genId('edge'),
              source: conditionId,
              target: actionId,
            });
            actionY += ROW_HEIGHT;
          }
          conditionY = Math.max(conditionY + ROW_HEIGHT, actionY);
        } else {
          // No condition — connect actions directly to trigger
          let actionY = conditionY;
          for (const hook of hookList) {
            if (limitReached()) break;
            if (!hook || typeof hook !== 'object') continue;
            const actionData = buildActionData(hook);
            if (!actionData) continue;
            const actionId = genId('action');
            nodes.push({
              id: actionId,
              type: 'action' as const,
              position: { x: ACTION_X, y: actionY },
              data: actionData,
            });
            edges.push({
              id: genId('edge'),
              source: triggerId,
              target: actionId,
            });
            actionY += ROW_HEIGHT;
          }
          conditionY = Math.max(conditionY + ROW_HEIGHT, actionY);
        }
      }

      triggerY = Math.max(triggerY + ROW_HEIGHT, conditionY + ROW_HEIGHT);
    }
  } catch {
    return null;
  }

  if (nodes.length === 0) return null;

  if (nodes.length > MAX_GENERATED_NODES) {
    console.warn(`Generated ${nodes.length} nodes, truncating to ${MAX_GENERATED_NODES}`);
    const allowedNodeIds = new Set(nodes.slice(0, MAX_GENERATED_NODES).map(n => n.id));
    const truncatedNodes = nodes.slice(0, MAX_GENERATED_NODES);
    let truncatedEdges = edges.filter(e => allowedNodeIds.has(e.source) && allowedNodeIds.has(e.target));
    if (truncatedEdges.length > MAX_EDGES) {
      truncatedEdges = truncatedEdges.slice(0, MAX_EDGES);
    }
    return { nodes: truncatedNodes, edges: truncatedEdges };
  }

  // Cap edges even when nodes are within limit
  if (edges.length > MAX_EDGES) {
    console.warn(`Generated ${edges.length} edges, truncating to ${MAX_EDGES}`);
    const allowedNodeIds = new Set(nodes.map(n => n.id));
    return {
      nodes,
      edges: edges.filter(e => allowedNodeIds.has(e.source) && allowedNodeIds.has(e.target)).slice(0, MAX_EDGES),
    };
  }

  return { nodes, edges };
}

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype', '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__']);
const VALID_HOOK_TYPES = new Set<string>([
  'command',
  'http',
  'prompt',
  'agent',
]);

function sanitizeHeaders(headers: Record<string, string>): Record<string, string> | undefined {
  const CRLF_RE = /[\r\n]/;
  const result: Record<string, string> = Object.create(null);
  let count = 0;
  for (const [k, v] of Object.entries(headers)) {
    if (DANGEROUS_KEYS.has(k)) continue;
    if (typeof k === 'string' && typeof v === 'string'
        && !CRLF_RE.test(k) && !CRLF_RE.test(v)
        && k.length < 200 && v.length < 1000) {
      result[k] = v;
      count++;
    }
  }
  return count > 0 ? result : undefined;
}

function buildActionData(hook: HookEntryInput): ActionNodeData | null {
  const type = typeof hook.type === 'string' ? hook.type : null;
  if (!type || !VALID_HOOK_TYPES.has(type)) return null;

  const hookType = type as HookType;
  const base = { hookType, label: type };

  switch (hookType) {
    case 'command': {
      const command = typeof hook.command === 'string' ? hook.command : '';
      return {
        ...base,
        label: command ? `cmd: ${command.slice(0, 30)}` : 'command',
        command: command.slice(0, 10_000),
        timeout: typeof hook.timeout === 'number' && isFinite(hook.timeout) ? hook.timeout : undefined,
      };
    }
    case 'http': {
      const url = typeof hook.url === 'string' ? hook.url : '';
      const method = typeof hook.method === 'string' ? hook.method : 'GET';
      return {
        ...base,
        label: url ? `${method}: ${url.slice(0, 25)}` : 'http',
        url: url.slice(0, 2000),
        method: method.slice(0, 20),
        headers: hook.headers && typeof hook.headers === 'object' && !Array.isArray(hook.headers) ? sanitizeHeaders(hook.headers) : undefined,
        timeout: typeof hook.timeout === 'number' && isFinite(hook.timeout) ? hook.timeout : undefined,
      };
    }
    case 'prompt': {
      const prompt = typeof hook.prompt === 'string' ? hook.prompt : '';
      const model = typeof hook.model === 'string' ? hook.model : undefined;
      return {
        ...base,
        label: prompt ? `prompt: ${prompt.slice(0, 25)}` : 'prompt',
        prompt: prompt.slice(0, 50_000),
        model: model?.slice(0, 200),
      };
    }
    case 'agent': {
      const description = typeof hook.description === 'string' ? hook.description : '';
      return {
        ...base,
        label: description ? `agent: ${description.slice(0, 25)}` : 'agent',
        description: description.slice(0, 10_000),
      };
    }
    default:
      return null;
  }
}
