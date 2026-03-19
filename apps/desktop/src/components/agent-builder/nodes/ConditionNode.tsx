import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ConditionNode as ConditionNodeType } from '../types/canvas';

export const ConditionNode = memo(({ data, selected }: NodeProps<ConditionNodeType>) => {
  return (
    <div className={`min-w-[180px] rounded-lg border-2 ${
      selected ? 'border-blue-400' : 'border-blue-500/50'
    } bg-blue-900/20 shadow-lg`}>
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-blue-400 !border-blue-600 !w-3 !h-3"
      />
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/40 rounded-t-lg border-b border-blue-500/30">
        <span className="text-blue-400 text-xs">&#9881;</span>
        <span className="text-xs font-semibold text-blue-300 uppercase tracking-wide">Condition</span>
      </div>
      {/* Body */}
      <div className="px-3 py-2">
        <div className="text-sm font-medium text-white font-mono">
          {data.matcher || 'No matcher'}
        </div>
        <div className="text-xs text-neutral-400 mt-0.5">Tool matcher (regex)</div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-blue-400 !border-blue-600 !w-3 !h-3"
      />
    </div>
  );
});
ConditionNode.displayName = 'ConditionNode';
