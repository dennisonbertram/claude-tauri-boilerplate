import type { StatusBarProps } from '@/components/StatusBar';
import type { ChatPageStatusData } from '@/components/chat/ChatPage';
import type { Checkpoint } from '@claude-tauri/shared';

export const defaultStatusData: StatusBarProps & { checkpoints?: import('@claude-tauri/shared').Checkpoint[]; sessionInfo?: ChatPageStatusData['sessionInfo'] } = {
  model: null,
  isStreaming: false,
  toolCalls: new Map(),
  cumulativeUsage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
  sessionTotalCost: 0,
  subagentActiveCount: 0,
  checkpoints: [] as Checkpoint[],
  sessionInfo: null,
};
