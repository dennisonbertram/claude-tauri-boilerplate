import type { ToolCallState, CumulativeUsage } from '@/hooks/useStreamEvents';
import { ModelSegment } from './status-bar/ModelSegment';
import { PermissionModeSegment } from './status-bar/PermissionModeSegment';
import { PrivacyModeIndicator } from './status-bar/PrivacyModeIndicator';
import { GitBranchSegment } from './status-bar/GitBranchSegment';
import { ConnectionIndicator } from './status-bar/ConnectionIndicator';
import { TurnTimer } from './status-bar/TurnTimer';
import { ActiveToolDisplay } from './status-bar/ActiveToolDisplay';
import { AgentCountBadge } from './status-bar/AgentCountBadge';
import { ResourceUsageSegment } from './status-bar/ResourceUsageSegment';
import { ContextUsageSegment } from './status-bar/ContextUsageSegment';
import { CostSegment } from './status-bar/CostSegment';

// --- Public Props ---

export interface StatusBarProps {
  model: string | null;
  isStreaming: boolean;
  toolCalls: Map<string, ToolCallState>;
  cumulativeUsage: CumulativeUsage;
  sessionTotalCost: number;
  subagentActiveCount: number;
  onShowSettings?: (tab?: string) => void;
}

// --- Main StatusBar ---

export function StatusBar({
  model,
  isStreaming,
  toolCalls,
  cumulativeUsage,
  sessionTotalCost,
  subagentActiveCount,
  onShowSettings,
}: StatusBarProps) {
  return (
    <div
      data-testid="status-bar"
      className="flex items-center h-7 shrink-0 border-t border-border bg-background text-xs text-muted-foreground select-none"
    >
      {/* Left section */}
      <div data-testid="status-bar-left" className="flex items-center gap-0.5 px-2 min-w-0">
        <ModelSegment model={model} />
        <PermissionModeSegment onShowSettings={onShowSettings} />
        <PrivacyModeIndicator onShowSettings={onShowSettings} />
        <GitBranchSegment />
        <ConnectionIndicator isStreaming={isStreaming} />
      </div>

      {/* Center section */}
      <div data-testid="status-bar-center" className="flex flex-1 items-center justify-center gap-2 min-w-0">
        <TurnTimer isStreaming={isStreaming} />
        <ActiveToolDisplay toolCalls={toolCalls} />
        {subagentActiveCount > 0 && <AgentCountBadge count={subagentActiveCount} />}
      </div>

      {/* Right section */}
      <div data-testid="status-bar-right" className="flex items-center gap-0.5 px-2 min-w-0">
        <ResourceUsageSegment />
        <ContextUsageSegment cumulativeUsage={cumulativeUsage} />
        {sessionTotalCost > 0 && <CostSegment cost={sessionTotalCost} />}
      </div>
    </div>
  );
}
