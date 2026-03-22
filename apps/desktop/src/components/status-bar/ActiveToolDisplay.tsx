import { useMemo } from 'react';
import type { ToolCallState } from '@/hooks/useStreamEvents';

export function ActiveToolDisplay({ toolCalls }: { toolCalls: Map<string, ToolCallState> }) {
  const activeTool = useMemo(() => {
    for (const tc of toolCalls.values()) {
      if (tc.status === 'running') return tc;
    }
    return null;
  }, [toolCalls]);

  if (!activeTool) return null;

  return (
    <div data-testid="active-tool-display" className="flex items-center gap-1 px-1.5 py-0.5 max-w-[200px]">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
      <span className="truncate">{activeTool.name}</span>
    </div>
  );
}
