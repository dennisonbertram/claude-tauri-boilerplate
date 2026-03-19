import { useState, type DragEvent, type ReactNode } from 'react';
import { HOOK_EVENTS } from '../types/canvas';

interface NodePaletteProps {
  className?: string;
}

const TRIGGER_TEMPLATES = HOOK_EVENTS.map((event) => ({
  nodeType: 'trigger' as const,
  data: { event, label: event },
}));

const CONDITION_TEMPLATE = {
  nodeType: 'condition' as const,
  data: { matcher: '', label: 'Condition' },
};

const ACTION_TEMPLATES = [
  { nodeType: 'action' as const, data: { hookType: 'command' as const, label: 'Command', command: '' } },
  { nodeType: 'action' as const, data: { hookType: 'http' as const, label: 'HTTP', url: '', method: 'GET' } },
  { nodeType: 'action' as const, data: { hookType: 'prompt' as const, label: 'Prompt', prompt: '' } },
  { nodeType: 'action' as const, data: { hookType: 'agent' as const, label: 'Agent', description: '' } },
];

const ACTION_COLORS: Record<string, string> = {
  command: 'border-green-500/50 bg-green-900/20 text-green-300',
  http: 'border-yellow-500/50 bg-yellow-900/20 text-yellow-300',
  prompt: 'border-pink-500/50 bg-pink-900/20 text-pink-300',
  agent: 'border-orange-500/50 bg-orange-900/20 text-orange-300',
};

const ACTION_ICONS: Record<string, string> = {
  command: '>_',
  http: '@',
  prompt: '?',
  agent: '&',
};

function DraggableNode({
  label,
  color,
  icon,
  onDragStart,
}: {
  label: string;
  color: string;
  icon: string;
  onDragStart: (e: DragEvent) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border cursor-grab active:cursor-grabbing text-xs ${color} select-none`}
    >
      <span>{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 w-full px-2 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-400 hover:text-neutral-200 transition-colors"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>
          &#9654;
        </span>
        {title}
      </button>
      {open && <div className="space-y-1 px-2 pb-2">{children}</div>}
    </div>
  );
}

function handleDragStart(e: DragEvent, template: { nodeType: string; data: Record<string, unknown> }) {
  e.dataTransfer.setData('application/reactflow', JSON.stringify(template));
  e.dataTransfer.effectAllowed = 'move';
}

export function NodePalette({ className = '' }: NodePaletteProps) {
  return (
    <div className={`w-[200px] shrink-0 border-r border-neutral-700 bg-neutral-900 flex flex-col min-h-0 overflow-hidden ${className}`}>
      <div className="px-3 py-2 border-b border-neutral-700">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Node Palette
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 py-2">
        <CollapsibleSection title="Triggers">
          {TRIGGER_TEMPLATES.map((t) => (
            <DraggableNode
              key={t.data.event}
              label={t.data.event}
              color="border-purple-500/50 bg-purple-900/20 text-purple-300"
              icon="&#9889;"
              onDragStart={(e) => handleDragStart(e, { nodeType: t.nodeType, data: { ...t.data } })}
            />
          ))}
        </CollapsibleSection>

        <CollapsibleSection title="Condition">
          <DraggableNode
            label="Condition"
            color="border-blue-500/50 bg-blue-900/20 text-blue-300"
            icon="&#9881;"
            onDragStart={(e) => handleDragStart(e, { nodeType: CONDITION_TEMPLATE.nodeType, data: { ...CONDITION_TEMPLATE.data } })}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Actions">
          {ACTION_TEMPLATES.map((t) => (
            <DraggableNode
              key={t.data.hookType}
              label={t.data.label}
              color={ACTION_COLORS[t.data.hookType]}
              icon={ACTION_ICONS[t.data.hookType]}
              onDragStart={(e) => handleDragStart(e, { nodeType: t.nodeType, data: { ...t.data } })}
            />
          ))}
        </CollapsibleSection>
      </div>
    </div>
  );
}
