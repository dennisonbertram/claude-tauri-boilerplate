import type { CanvasNode, TriggerNodeData, ConditionNodeData, ActionNodeData } from '../types/canvas';
import { HOOK_EVENTS } from '../types/canvas';

interface NodeConfigPanelProps {
  selectedNode: CanvasNode | null;
  onUpdateNode: (nodeId: string, data: Partial<TriggerNodeData | ConditionNodeData | ActionNodeData>) => void;
  className?: string;
}

const inputClass =
  'w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-neutral-500';

const labelClass = 'block text-xs font-medium text-neutral-400 mb-1';

function TriggerConfig({
  node,
  onUpdate,
}: {
  node: CanvasNode;
  onUpdate: (data: Partial<TriggerNodeData>) => void;
}) {
  const data = node.data as TriggerNodeData;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-purple-300">Trigger Configuration</h3>
      <div>
        <label className={labelClass}>Event</label>
        <select
          value={data.event}
          onChange={(e) => onUpdate({ event: e.target.value, label: e.target.value })}
          className={inputClass}
        >
          {HOOK_EVENTS.map((event) => (
            <option key={event} value={event}>
              {event}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function ConditionConfig({
  node,
  onUpdate,
}: {
  node: CanvasNode;
  onUpdate: (data: Partial<ConditionNodeData>) => void;
}) {
  const data = node.data as ConditionNodeData;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-blue-300">Condition Configuration</h3>
      <div>
        <label className={labelClass}>Matcher (regex)</label>
        <input
          type="text"
          value={data.matcher}
          onChange={(e) =>
            onUpdate({
              matcher: e.target.value,
              label: e.target.value ? `Match: ${e.target.value}` : 'Condition',
            })
          }
          placeholder="e.g. Bash, Edit|Write, .*"
          className={inputClass}
        />
        <p className="mt-1 text-[10px] text-neutral-500">
          Matches tool names. E.g. <code>Bash</code>, <code>Edit|Write</code>, <code>.*</code>
        </p>
      </div>
    </div>
  );
}

function CommandActionConfig({
  node,
  onUpdate,
}: {
  node: CanvasNode;
  onUpdate: (data: Partial<ActionNodeData>) => void;
}) {
  const data = node.data as ActionNodeData;

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Command</label>
        <textarea
          value={data.command ?? ''}
          onChange={(e) => onUpdate({ command: e.target.value })}
          placeholder="echo 'hello world'"
          rows={3}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Timeout (ms)</label>
        <input
          type="number"
          value={data.timeout ?? ''}
          onChange={(e) => onUpdate({ timeout: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="10000"
          className={inputClass}
        />
      </div>
    </div>
  );
}

function HttpActionConfig({
  node,
  onUpdate,
}: {
  node: CanvasNode;
  onUpdate: (data: Partial<ActionNodeData>) => void;
}) {
  const data = node.data as ActionNodeData;

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>URL</label>
        <input
          type="text"
          value={data.url ?? ''}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder="https://example.com/webhook"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Method</label>
        <select
          value={data.method ?? 'GET'}
          onChange={(e) => onUpdate({ method: e.target.value })}
          className={inputClass}
        >
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Timeout (ms)</label>
        <input
          type="number"
          value={data.timeout ?? ''}
          onChange={(e) => onUpdate({ timeout: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="10000"
          className={inputClass}
        />
      </div>
    </div>
  );
}

function PromptActionConfig({
  node,
  onUpdate,
}: {
  node: CanvasNode;
  onUpdate: (data: Partial<ActionNodeData>) => void;
}) {
  const data = node.data as ActionNodeData;

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Prompt</label>
        <textarea
          value={data.prompt ?? ''}
          onChange={(e) => onUpdate({ prompt: e.target.value })}
          placeholder="Summarize the changes..."
          rows={4}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Model (optional)</label>
        <input
          type="text"
          value={data.model ?? ''}
          onChange={(e) => onUpdate({ model: e.target.value || undefined })}
          placeholder="claude-sonnet-4-5-20250514"
          className={inputClass}
        />
      </div>
    </div>
  );
}

function AgentActionConfig({
  node,
  onUpdate,
}: {
  node: CanvasNode;
  onUpdate: (data: Partial<ActionNodeData>) => void;
}) {
  const data = node.data as ActionNodeData;

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Description</label>
        <textarea
          value={data.description ?? ''}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Describe what this agent should do..."
          rows={4}
          className={inputClass}
        />
      </div>
    </div>
  );
}

const ACTION_CONFIG_COMPONENTS: Record<
  string,
  React.FC<{ node: CanvasNode; onUpdate: (data: Partial<ActionNodeData>) => void }>
> = {
  command: CommandActionConfig,
  http: HttpActionConfig,
  prompt: PromptActionConfig,
  agent: AgentActionConfig,
};

const ACTION_TITLES: Record<string, { label: string; color: string }> = {
  command: { label: 'Command Action', color: 'text-green-300' },
  http: { label: 'HTTP Action', color: 'text-yellow-300' },
  prompt: { label: 'Prompt Action', color: 'text-pink-300' },
  agent: { label: 'Agent Action', color: 'text-orange-300' },
};

function ActionConfig({
  node,
  onUpdate,
}: {
  node: CanvasNode;
  onUpdate: (data: Partial<ActionNodeData>) => void;
}) {
  const data = node.data as ActionNodeData;
  const ConfigComponent = ACTION_CONFIG_COMPONENTS[data.hookType];
  const titleInfo = ACTION_TITLES[data.hookType] ?? { label: 'Action', color: 'text-green-300' };

  return (
    <div className="space-y-3">
      <h3 className={`text-sm font-semibold ${titleInfo.color}`}>{titleInfo.label}</h3>
      {ConfigComponent && <ConfigComponent node={node} onUpdate={onUpdate} />}
    </div>
  );
}

export function NodeConfigPanel({ selectedNode, onUpdateNode, className = '' }: NodeConfigPanelProps) {
  if (!selectedNode) return null;

  const handleUpdate = (data: Partial<TriggerNodeData | ConditionNodeData | ActionNodeData>) => {
    onUpdateNode(selectedNode.id, data);
  };

  return (
    <div className={`w-[260px] shrink-0 border-l border-neutral-700 bg-neutral-900 flex flex-col min-h-0 overflow-hidden ${className}`}>
      <div className="px-3 py-2 border-b border-neutral-700">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Configuration
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {selectedNode.type === 'trigger' && (
          <TriggerConfig node={selectedNode} onUpdate={handleUpdate} />
        )}
        {selectedNode.type === 'condition' && (
          <ConditionConfig node={selectedNode} onUpdate={handleUpdate} />
        )}
        {selectedNode.type === 'action' && (
          <ActionConfig node={selectedNode} onUpdate={handleUpdate} />
        )}
      </div>
    </div>
  );
}
