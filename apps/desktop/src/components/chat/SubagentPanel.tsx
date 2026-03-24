import { useState } from 'react';
import type { SubagentNode } from '@/hooks/useSubagents';

// --- Helper: Format elapsed time ---

function formatElapsed(startTime: number): string {
  const elapsed = Math.max(0, Date.now() - startTime);
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// --- Status styling ---

const statusColors: Record<string, string> = {
  running: 'text-blue-400',
  completed: 'text-green-400',
  failed: 'text-red-400',
  stopped: 'text-yellow-400',
};

const statusDots: Record<string, string> = {
  running: 'bg-blue-400 animate-pulse',
  completed: 'bg-green-400',
  failed: 'bg-red-400',
  stopped: 'bg-yellow-400',
};

// --- AgentNodeView Component ---

interface AgentNodeViewProps {
  agent: SubagentNode;
  depth: number;
}

function AgentNodeView({ agent, depth }: AgentNodeViewProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = agent.children.length > 0;

  return (
    <div
      data-testid={`agent-node-${agent.taskId}`}
      style={{ paddingLeft: `${depth * 16}px` }}
    >
      {/* Agent header row */}
      <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 text-sm">
        {/* Collapse toggle */}
        {hasChildren && (
          <button
            data-testid={`agent-collapse-${agent.taskId}`}
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '\u25BC' : '\u25B6'}
          </button>
        )}

        {/* Status dot */}
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${statusDots[agent.status] ?? 'bg-muted'}`}
        />

        {/* Description */}
        <span className="truncate flex-1 text-foreground">
          {agent.description}
        </span>

        {/* Task type badge */}
        {agent.taskType && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
            {agent.taskType}
          </span>
        )}

        {/* Status text */}
        <span
          data-testid={`agent-status-${agent.taskId}`}
          className={`text-xs shrink-0 ${statusColors[agent.status] ?? 'text-muted-foreground'}`}
        >
          {agent.status}
        </span>

        {/* Elapsed time */}
        <span
          data-testid={`agent-time-${agent.taskId}`}
          className="text-xs text-muted-foreground shrink-0 tabular-nums"
        >
          {formatElapsed(agent.startTime)}
        </span>
      </div>

      {/* Progress text */}
      {agent.progress && (
        <div
          data-testid={`agent-progress-${agent.taskId}`}
          className="text-xs text-muted-foreground pl-8 pb-1 truncate"
          style={{ paddingLeft: `${(depth * 16) + 32}px` }}
        >
          {agent.progress}
        </div>
      )}

      {/* Summary (shown when complete/failed) */}
      {agent.summary && (agent.status === 'completed' || agent.status === 'failed' || agent.status === 'stopped') && (
        <div
          data-testid={`agent-summary-${agent.taskId}`}
          className="text-xs text-muted-foreground pl-8 pb-1 italic truncate"
          style={{ paddingLeft: `${(depth * 16) + 32}px` }}
        >
          {agent.summary}
        </div>
      )}

      {/* Children */}
      {hasChildren && isExpanded && (
        <div data-testid={`agent-children-${agent.taskId}`}>
          {agent.children.map((child) => (
            <AgentNodeView key={child.taskId} agent={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- SubagentPanel Component ---

interface SubagentPanelProps {
  agents: SubagentNode[];
  activeCount: number;
  isVisible: boolean;
  onToggleVisibility: () => void;
}

export function SubagentPanel({
  agents,
  activeCount,
  isVisible,
  onToggleVisibility,
}: SubagentPanelProps) {
  return (
    <div className="border-t border-border" data-testid="subagent-panel">
      {/* Toggle bar */}
      <button
        data-testid="subagent-toggle"
        onClick={onToggleVisibility}
        className="flex items-center gap-2 w-full px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <span className="text-xs">{isVisible ? '\u25BC' : '\u25B6'}</span>
        <span>Agents</span>
        {activeCount > 0 && (
          <span
            data-testid="subagent-badge"
            className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-medium rounded-full bg-blue-500/20 text-blue-400"
          >
            {activeCount}
          </span>
        )}
      </button>

      {/* Panel content */}
      {isVisible && (
        <div data-testid="subagent-tree" className="px-2 pb-2 max-h-48 overflow-y-auto">
          {agents.length === 0 ? (
            <div
              data-testid="subagent-empty"
              className="text-xs text-muted-foreground text-center py-3"
            >
              No active agents
            </div>
          ) : (
            agents.map((agent) => (
              <AgentNodeView key={agent.taskId} agent={agent} depth={0} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
