import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ActionNode as ActionNodeType } from '../types/canvas';

const TYPE_STYLES = {
  command: {
    border: 'border-green-500/50',
    selectedBorder: 'border-green-400',
    bg: 'bg-green-900/20',
    header: 'bg-green-900/40',
    headerBorder: 'border-green-500/30',
    text: 'text-green-300',
    handle: '!bg-green-400 !border-green-600',
    icon: '\u25B6',
  },
  http: {
    border: 'border-yellow-500/50',
    selectedBorder: 'border-yellow-400',
    bg: 'bg-yellow-900/20',
    header: 'bg-yellow-900/40',
    headerBorder: 'border-yellow-500/30',
    text: 'text-yellow-300',
    handle: '!bg-yellow-400 !border-yellow-600',
    icon: '\u2197',
  },
  prompt: {
    border: 'border-pink-500/50',
    selectedBorder: 'border-pink-400',
    bg: 'bg-pink-900/20',
    header: 'bg-pink-900/40',
    headerBorder: 'border-pink-500/30',
    text: 'text-pink-300',
    handle: '!bg-pink-400 !border-pink-600',
    icon: '\uD83D\uDCAC',
  },
  agent: {
    border: 'border-orange-500/50',
    selectedBorder: 'border-orange-400',
    bg: 'bg-orange-900/20',
    header: 'bg-orange-900/40',
    headerBorder: 'border-orange-500/30',
    text: 'text-orange-300',
    handle: '!bg-orange-400 !border-orange-600',
    icon: '\uD83E\uDD16',
  },
} as const;

function getPreview(data: ActionNodeType['data']): string {
  switch (data.hookType) {
    case 'command':
      return data.command ? data.command.slice(0, 40) : 'No command';
    case 'http':
      return data.url ? `${data.method ?? 'GET'} ${data.url}`.slice(0, 40) : 'No URL';
    case 'prompt':
      return data.prompt ? data.prompt.slice(0, 40) : 'No prompt';
    case 'agent':
      return data.description ? data.description.slice(0, 40) : 'No description';
    default:
      return '';
  }
}

export const ActionNode = memo(({ data, selected }: NodeProps<ActionNodeType>) => {
  const style = TYPE_STYLES[data.hookType] ?? TYPE_STYLES.command;
  const preview = getPreview(data);

  return (
    <div className={`min-w-[200px] max-w-[280px] rounded-lg border-2 ${
      selected ? style.selectedBorder : style.border
    } ${style.bg} shadow-lg`}>
      <Handle
        type="target"
        position={Position.Top}
        className={`${style.handle} !w-3 !h-3`}
      />
      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2 ${style.header} rounded-t-lg border-b ${style.headerBorder}`}>
        <span className="text-xs">{style.icon}</span>
        <span className={`text-xs font-semibold ${style.text} uppercase tracking-wide`}>
          {data.hookType}
        </span>
      </div>
      {/* Body */}
      <div className="px-3 py-2">
        <div className="text-sm text-white font-mono truncate">{preview}</div>
      </div>
      {/* No source handle -- actions are leaf nodes */}
    </div>
  );
});
ActionNode.displayName = 'ActionNode';
