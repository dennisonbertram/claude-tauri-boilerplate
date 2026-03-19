import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { TriggerNode as TriggerNodeType } from '../types/canvas';

export const TriggerNode = memo(({ data, selected }: NodeProps<TriggerNodeType>) => {
  return (
    <div className={`min-w-[180px] rounded-lg border-2 ${
      selected ? 'border-purple-400' : 'border-purple-500/50'
    } bg-purple-900/20 shadow-lg`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-purple-900/40 rounded-t-lg border-b border-purple-500/30">
        <span className="text-purple-400 text-xs">&#9889;</span>
        <span className="text-xs font-semibold text-purple-300 uppercase tracking-wide">Trigger</span>
      </div>
      {/* Body */}
      <div className="px-3 py-2">
        <div className="text-sm font-medium text-white">{data.event || 'Select event'}</div>
        <div className="text-xs text-neutral-400 mt-0.5">Hook event</div>
      </div>
      {/* Output handle only */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-purple-400 !border-purple-600 !w-3 !h-3"
      />
    </div>
  );
});
TriggerNode.displayName = 'TriggerNode';
