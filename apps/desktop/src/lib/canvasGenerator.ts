import type {
  CanvasState,
  CanvasNode,
  CanvasEdge,
  TriggerNodeData,
  ConditionNodeData,
  ActionNodeData,
  HookType,
} from '../components/agent-builder/types/canvas';

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

  try {
    for (const [event, groups] of Object.entries(
      hooks as Record<string, unknown>,
    )) {
      if (!Array.isArray(groups)) continue;

      const triggerId = genId('trigger');
      const triggerData: TriggerNodeData = { event, label: event };
      nodes.push({
        id: triggerId,
        type: 'trigger' as const,
        position: { x: TRIGGER_X, y: triggerY },
        data: triggerData,
      });

      let conditionY = triggerY;

      for (const group of groups) {
        if (!group || typeof group !== 'object') continue;
        const hookList = Array.isArray((group as HookGroupInput).hooks) ? (group as HookGroupInput).hooks! : [];
        if (hookList.length === 0) continue;

        if ((group as HookGroupInput).matcher) {
          // Create a condition node for the matcher
          const conditionId = genId('condition');
          const condData: ConditionNodeData = {
            matcher: (group as HookGroupInput).matcher!,
            label: `Match: ${(group as HookGroupInput).matcher}`,
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

          let actionY = conditionY;
          for (const hook of hookList) {
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

  return { nodes, edges };
}

const VALID_HOOK_TYPES = new Set<string>([
  'command',
  'http',
  'prompt',
  'agent',
]);

function buildActionData(hook: HookEntryInput): ActionNodeData | null {
  const hookType = hook.type ?? 'command';
  if (!VALID_HOOK_TYPES.has(hookType)) return null;

  const type = hookType as HookType;

  switch (type) {
    case 'command':
      return {
        hookType: type,
        label: hook.command
          ? `cmd: ${hook.command.slice(0, 30)}`
          : 'command',
        command: hook.command ?? '',
        timeout: hook.timeout,
      };
    case 'http':
      return {
        hookType: type,
        label: hook.url ? `${hook.method ?? 'POST'}: ${hook.url.slice(0, 25)}` : 'http',
        url: hook.url ?? '',
        method: hook.method ?? 'POST',
        headers: hook.headers,
        timeout: hook.timeout,
      };
    case 'prompt':
      return {
        hookType: type,
        label: hook.prompt
          ? `prompt: ${hook.prompt.slice(0, 25)}`
          : 'prompt',
        prompt: hook.prompt ?? '',
        model: hook.model,
      };
    case 'agent':
      return {
        hookType: type,
        label: hook.description
          ? `agent: ${hook.description.slice(0, 25)}`
          : 'agent',
        description: hook.description ?? '',
      };
    default:
      return null;
  }
}
