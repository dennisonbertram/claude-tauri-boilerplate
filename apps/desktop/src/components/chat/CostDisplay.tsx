import { useState } from 'react';
import { formatCost, getModelFromName } from '@/lib/pricing';
import type { MessageCost } from '@/hooks/useCostTracking';

interface CostDisplayProps {
  messageCosts: MessageCost[];
  sessionTotalCost: number;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function getModelDisplayName(model: string): string {
  const tier = getModelFromName(model);
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function CostDisplay({ messageCosts, sessionTotalCost }: CostDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't render anything if there are no costs
  if (messageCosts.length === 0 && sessionTotalCost === 0) {
    return null;
  }

  return (
    <div className="relative flex items-center">
      {/* Cost badge */}
      <button
        data-testid="cost-badge"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50 cursor-pointer"
        title="Click to see cost breakdown"
      >
        <span className="tabular-nums">{formatCost(sessionTotalCost)}</span>
      </button>

      {/* Expandable detail panel */}
      {isExpanded && (
        <div
          data-testid="cost-detail-panel"
          className="absolute bottom-full right-0 mb-2 z-50 w-80 rounded-md border border-border bg-popover shadow-md"
        >
          <div className="px-3 py-2 border-b border-border">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-foreground">Cost Breakdown</span>
              <span
                data-testid="cost-session-total"
                className="text-xs font-medium text-foreground tabular-nums"
              >
                {formatCost(sessionTotalCost)}
              </span>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto">
            {messageCosts.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                No cost data yet
              </div>
            ) : (
              <div className="divide-y divide-border">
                {messageCosts.map((cost, index) => (
                  <div
                    key={cost.messageId}
                    data-testid={`cost-message-row-${index}`}
                    className="px-3 py-2 text-xs"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-muted-foreground">
                        #{index + 1} &middot; {getModelDisplayName(cost.model)}
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatCost(cost.costUsd)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 text-muted-foreground">
                      <span>In: {formatNumber(cost.inputTokens)}</span>
                      <span>Out: {formatNumber(cost.outputTokens)}</span>
                      {(cost.cacheReadTokens > 0 || cost.cacheCreationTokens > 0) && (
                        <>
                          <span>Cache R: {formatNumber(cost.cacheReadTokens)}</span>
                          <span>Cache W: {formatNumber(cost.cacheCreationTokens)}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
