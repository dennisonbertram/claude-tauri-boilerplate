import type { UIMessage } from '@ai-sdk/react';
import type { Message } from '@claude-tauri/shared';
import type { CreateWorkspaceRequest } from '@claude-tauri/shared';
import type { ToolCallState } from '@/hooks/useStreamEvents';

export const API_BASE = 'http://localhost:3131';
export const PLAN_EXPORT_DRAFT_KEY = 'claude-tauri-plan-export-draft';
export const MAX_CONTEXT_TOKENS = 200_000;

export interface ChatPageStatusData {
  model: string | null;
  isStreaming: boolean;
  toolCalls: Map<string, ToolCallState>;
  cumulativeUsage: import('@/hooks/useStreamEvents').CumulativeUsage;
  sessionTotalCost: number;
  subagentActiveCount: number;
  checkpoints: import('@claude-tauri/shared').Checkpoint[];
  sessionInfo?: {
    sessionId: string;
    model: string;
    tools: string[];
    mcpServers: Array<{ name: string; status: string }>;
    claudeCodeVersion: string;
  } | null;
}

export type LinearIssueContext = NonNullable<CreateWorkspaceRequest['linearIssue']>;

export interface ChatPageProps {
  sessionId: string | null;
  onCreateSession?: () => void | Promise<void>;
  onExportSession?: () => void | Promise<void>;
  onStatusChange?: (data: ChatPageStatusData) => void;
  onAutoName?: (sessionId: string) => void;
  workspaceId?: string;
  projectId?: string;
  additionalDirectories?: string[];
  onToggleSidebar?: () => void;
  onOpenSettings?: (tab?: string) => void;
  onOpenSessions?: () => void;
  onOpenPullRequests?: () => void;
  onOpenWorkspacePaths?: (path?: string) => void;
  /** Called when a root-level agent task reaches a terminal status */
  onTaskComplete?: (params: {
    status: 'completed' | 'failed' | 'stopped';
    summary: string;
  }) => void;
  /** Agent profile ID to use for this chat */
  profileId?: string | null;
  /** Available agent profiles for selection */
  agentProfiles?: import('@claude-tauri/shared').AgentProfile[];
  /** Callback when user selects a different profile */
  onSelectProfile?: (id: string | null) => void;
  /** Initial message to auto-send when the page mounts */
  initialMessage?: string | null;
  /** Called after the initial message has been consumed */
  onInitialMessageConsumed?: () => void;
  /** Called when backend initializes the app session ID */
  onSessionInitialized?: (sessionId: string) => void;
}

export function extractCommandFromToolInput(input: string): string | undefined {
  if (!input) return undefined;

  try {
    const parsed = JSON.parse(input);
    if (typeof parsed === 'string') return parsed;
    if (typeof parsed.command === 'string') return parsed.command;
    if (Array.isArray(parsed.command)) return parsed.command.join(' ');
  } catch {
    return input;
  }

  return undefined;
}

/**
 * Convert a persisted Message (from the DB) into a UIMessage
 * that the AI SDK useChat hook understands.
 */
export function toUIMessage(msg: Message): UIMessage {
  return {
    id: msg.id,
    role: msg.role,
    parts: [{ type: 'text' as const, text: msg.content }],
  };
}

export function getLatestAssistantMessageId(messages: UIMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'assistant') {
      return messages[index].id;
    }
  }

  return null;
}
