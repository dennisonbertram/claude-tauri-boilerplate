import { useState, useCallback, useMemo } from 'react';

export interface MessageCost {
  messageId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
  durationMs: number;
  timestamp: number;
}

export type AddMessageCostInput = Omit<MessageCost, 'timestamp'>;

export function useCostTracking() {
  const [messageCosts, setMessageCosts] = useState<MessageCost[]>([]);

  const addMessageCost = useCallback((input: AddMessageCostInput) => {
    const entry: MessageCost = {
      ...input,
      timestamp: Date.now(),
    };
    setMessageCosts((prev) => [...prev, entry]);
  }, []);

  const reset = useCallback(() => {
    setMessageCosts([]);
  }, []);

  const sessionTotalCost = useMemo(
    () => messageCosts.reduce((sum, mc) => sum + mc.costUsd, 0),
    [messageCosts]
  );

  return {
    messageCosts,
    sessionTotalCost,
    addMessageCost,
    reset,
  };
}
