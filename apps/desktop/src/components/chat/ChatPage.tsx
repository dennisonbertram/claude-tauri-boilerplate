import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from '@ai-sdk/react';
import type { Message, PermissionResponse } from '@claude-tauri/shared';
import { pickProviderConfig } from '@claude-tauri/shared';
import { MessageList } from './MessageList';
import type { AssistantResponseMetadata } from './MessageList';
import { ChatInput } from './ChatInput';
import { ErrorBanner, type ChatError } from './ErrorBanner';
import { PermissionDialog } from './PermissionDialog';
import { PlanView } from './PlanView';
import { SubagentPanel } from './SubagentPanel';
import { CheckpointTimeline } from './CheckpointTimeline';
import { RewindDialog } from './RewindDialog';
import { LatestTurnChangesDialog } from './LatestTurnChangesDialog';
import type { RewindMode } from './RewindDialog';
import type { PermissionDecisionResult } from './PermissionDialog';
import { useStreamEvents } from '@/hooks/useStreamEvents';
import type { UsageState } from '@/hooks/useStreamEvents';
import { useSubagents } from '@/hooks/useSubagents';
import { useCommands } from '@/hooks/useCommands';
import { useCommandPalette } from '@/hooks/useCommandPalette';
import { useKeyboardShortcuts, type ShortcutDefinition } from '@/hooks/useKeyboardShortcuts';
import { ShortcutHelpModal } from '@/components/ShortcutHelpModal';
import { ContextIndicator } from './ContextIndicator';
import type { ContextUsage } from './ContextIndicator';
import { CostDisplay } from './CostDisplay';
import { useCostTracking } from '@/hooks/useCostTracking';
import { useSuggestions } from '@/hooks/useSuggestions';
import { useContextSummary } from '@/hooks/useContextSummary';
import { useCheckpoints } from '@/hooks/useCheckpoints';
import { SuggestionChips } from './SuggestionChips';
import { useSettings } from '@/hooks/useSettings';
import { calculateCost, getModelFromName } from '@/lib/pricing';
import type { PlanDecisionRequest, Checkpoint, RewindPreview } from '@claude-tauri/shared';
import type { ToolCallState } from '@/hooks/useStreamEvents';
import { useWorkspaceDiff } from '@/hooks/useWorkspaceDiff';
import * as workspaceApi from '@/lib/workspace-api';
import { generateArtifact } from '@/lib/workspace-api';
import { toast } from 'sonner';
import type { AttachedImage } from './ChatInput';
import { LinearIssuePicker } from '@/components/linear/LinearIssuePicker';
import type { CreateWorkspaceRequest } from '@claude-tauri/shared';
import * as linearApi from '@/lib/linear-api';
import { promptMemoryUpdate } from '@/lib/memoryUpdatePrompt';
import './gen-ui/defaultRenderers';
import {
  getWorkflowPrompt,
  buildReviewMemoryDraft,
  buildReviewWorkflowMessage,
  buildPrWorkflowMessage,
  buildBranchNameWorkflowMessage,
  buildBrowserWorkflowMessage,
} from '@/lib/workflowPrompts';

const API_BASE = 'http://localhost:3131';
const PLAN_EXPORT_DRAFT_KEY = 'claude-tauri-plan-export-draft';

export interface ChatPageStatusData {
  model: string | null;
  isStreaming: boolean;
  toolCalls: Map<string, import('@/hooks/useStreamEvents').ToolCallState>;
  cumulativeUsage: import('@/hooks/useStreamEvents').CumulativeUsage;
  sessionTotalCost: number;
  subagentActiveCount: number;
  sessionInfo?: {
    sessionId: string;
    model: string;
    tools: string[];
    mcpServers: Array<{ name: string; status: string }>;
    claudeCodeVersion: string;
  } | null;
}

type LinearIssueContext = NonNullable<CreateWorkspaceRequest['linearIssue']>;

interface ChatPageProps {
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
}

function extractCommandFromToolInput(input: string): string | undefined {
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
function toUIMessage(msg: Message): UIMessage {
  return {
    id: msg.id,
    role: msg.role,
    parts: [{ type: 'text' as const, text: msg.content }],
  };
}

function getLatestAssistantMessageId(messages: UIMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'assistant') {
      return messages[index].id;
    }
  }

  return null;
}

export function ChatPage({
  sessionId,
  onCreateSession,
  onExportSession,
  onStatusChange,
  onAutoName,
  workspaceId,
  projectId,
  additionalDirectories,
  onToggleSidebar,
  onOpenSettings,
  onOpenSessions,
  onOpenPullRequests,
  onOpenWorkspacePaths,
  onTaskComplete,
}: ChatPageProps) {
  const { settings, updateSettings } = useSettings();
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<AttachedImage[]>([]);
  const [linearIssue, setLinearIssue] = useState<LinearIssueContext | null>(null);
  const [linearPickerOpen, setLinearPickerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [thinkingToggleVersion, setThinkingToggleVersion] = useState(0);
  const {
    toolCalls,
    thinkingBlocks,
    pendingPermissions,
    resolvePermission,
    plan,
    approvePlan,
    rejectPlan,
    cumulativeUsage,
    isCompacting,
    usage,
    sessionInfo,
    processEvent,
    reset: resetStreamEvents,
  } = useStreamEvents();

  const {
    agents: subagents,
    activeCount: subagentActiveCount,
    isVisible: subagentPanelVisible,
    toggleVisibility: toggleSubagentPanel,
    reset: resetSubagents,
  } = useSubagents({
    onRootTaskComplete: onTaskComplete,
  });

  const {
    messageCosts,
    sessionTotalCost,
    addMessageCost,
    reset: resetCostTracking,
  } = useCostTracking();

  const {
    diff: workspaceDiff,
    changedFiles,
    fetchDiff: fetchWorkspaceDiff,
  } = useWorkspaceDiff(workspaceId ?? null);
  const suggestedFiles = useMemo(
    () => changedFiles.map((file) => file.path),
    [changedFiles]
  );

  useEffect(() => {
    if (!workspaceId) return;
    void fetchWorkspaceDiff();
  }, [workspaceId, fetchWorkspaceDiff]);

  // Checkpoint tracking state
  const lastUserPromptRef = useRef('');
  const lastUserMessageIdRef = useRef('');
  const [rewindTarget, setRewindTarget] = useState<Checkpoint | null>(null);
  const [rewindPreview, setRewindPreview] = useState<RewindPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [latestChangesOpen, setLatestChangesOpen] = useState(false);
  const [latestChangesLoading, setLatestChangesLoading] = useState(false);
  const [latestChangesDiff, setLatestChangesDiff] = useState('');
  const [latestChangesError, setLatestChangesError] = useState<string | null>(null);
  const [archivedPlanId, setArchivedPlanId] = useState<string | null>(null);
  const [archivedPlanPath, setArchivedPlanPath] = useState<string | null>(null);
  const [assistantMetadata, setAssistantMetadata] = useState<
    Record<string, AssistantResponseMetadata>
  >({});

  // Auto-naming: track user message count per session
  const userMsgCountRef = useRef(0);
  const autoNameCalledRef = useRef(false);
  const prevSessionIdRef = useRef(sessionId);

  // Reset counters when session changes
  if (sessionId !== prevSessionIdRef.current) {
    prevSessionIdRef.current = sessionId;
    userMsgCountRef.current = 0;
    autoNameCalledRef.current = false;
  }

  // Claude's context window is 200k tokens
  const MAX_CONTEXT_TOKENS = 200_000;

  const contextUsage: ContextUsage = useMemo(
    () => ({
      inputTokens: cumulativeUsage.inputTokens,
      outputTokens: cumulativeUsage.outputTokens,
      cacheReadTokens: cumulativeUsage.cacheReadTokens,
      cacheCreationTokens: cumulativeUsage.cacheCreationTokens,
      maxTokens: MAX_CONTEXT_TOKENS,
    }),
    [cumulativeUsage]
  );

  // Record cost when a session:result event provides usage data
  const lastRecordedUsageRef = useRef<UsageState | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${API_BASE}/api/chat`,
        body: {
          sessionId,
          model: settings.model,
          effort: settings.fastMode ? 'low' : settings.effort,
          thinkingBudgetTokens: settings.thinkingBudgetTokens,
          permissionMode: settings.permissionMode,
          provider: settings.provider,
          runtimeEnv: settings.runtimeEnv,
          systemPrompt: settings.systemPrompt || undefined,
          providerConfig: pickProviderConfig(settings.provider, settings),
          ...(workspaceId ? { workspaceId } : {}),
          ...(additionalDirectories && additionalDirectories.length > 0
            ? { additionalDirectories }
            : {}),
          ...(linearIssue ? { linearIssue } : {}),
        },
      }),
    [
      sessionId,
      settings.model,
      settings.effort,
      settings.fastMode,
      settings.thinkingBudgetTokens,
      settings.permissionMode,
      settings.provider,
      settings.runtimeEnv,
      settings.systemPrompt,
      settings.bedrockBaseUrl,
      settings.bedrockProjectId,
      settings.vertexProjectId,
      settings.vertexBaseUrl,
      settings.customBaseUrl,
      settings.runtimeEnv,
      workspaceId,
      additionalDirectories,
      linearIssue,
    ]
  );

  // Deep-link: #linear/issue/ENG-123 preselects a Linear issue context for this chat.
  useEffect(() => {
    const match = window.location.hash.match(/^#linear\/issue\/([^/?#]+)$/);
    if (!match?.[1]) return;
    const identifier = decodeURIComponent(match[1]);

    let cancelled = false;
    (async () => {
      try {
        const issue = await linearApi.getIssue(identifier);
        if (cancelled) return;
        setLinearIssue({
          id: issue.id,
          title: issue.title,
          summary: issue.summary,
          url: issue.url,
        });
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Stable fallback ID so we don't recreate the Chat on every render
  // when sessionId is null. Using useRef + crypto ensures it persists
  // across renders but is unique per ChatPage mount.
  const fallbackId = useRef(crypto.randomUUID()).current;

  // Handle data-stream-event parts from the AI SDK data channel.
  // The server sends custom events (session:init, tool:result, etc.)
  // via `{ type: 'data-stream-event', data: <StreamEvent> }` which
  // the AI SDK delivers through the onData callback.
  const handleDataPart = useCallback(
    (part: { type: string; data?: unknown }) => {
      if (part.type === 'data-stream-event' && part.data && typeof part.data === 'object' && 'type' in part.data) {
        processEvent(part.data as import('@claude-tauri/shared').StreamEvent);
      }
    },
    [processEvent]
  );

  const { messages, sendMessage, status, setMessages, error, clearError } =
    useChat({
      id: sessionId ?? fallbackId,
      transport,
      onData: handleDataPart as any,
    });

  useEffect(() => {
    if (usage && usage !== lastRecordedUsageRef.current) {
      lastRecordedUsageRef.current = usage;
      const model = sessionInfo?.model ?? 'claude-sonnet-4';
      const latestAssistantId = getLatestAssistantMessageId(messages);
      const costUsd =
        usage.costUsd > 0
          ? usage.costUsd
          : calculateCost(
              {
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                cacheReadTokens: usage.cacheReadTokens,
                cacheCreationTokens: usage.cacheCreationTokens,
              },
              getModelFromName(model)
            );

      addMessageCost({
        messageId: `turn-${Date.now()}`,
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens,
        cacheCreationTokens: usage.cacheCreationTokens,
        costUsd,
        durationMs: usage.durationMs,
      });

      if (latestAssistantId) {
        setAssistantMetadata((current) => ({
          ...current,
          [latestAssistantId]: {
            changedFiles: current[latestAssistantId]?.changedFiles ?? [],
            model,
            durationMs: usage.durationMs,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            cacheReadTokens: usage.cacheReadTokens,
            cacheCreationTokens: usage.cacheCreationTokens,
          },
        }));
      }
    }
  }, [usage, sessionInfo, addMessageCost, messages]);

  const isLoading = status === 'submitted' || status === 'streaming';

  const {
    checkpoints,
    previewRewind,
    executeRewind,
    reset: resetCheckpoints,
  } = useCheckpoints({
    sessionId,
    toolCalls,
    lastUserPrompt: lastUserPromptRef.current,
    userMessageId: lastUserMessageIdRef.current,
    isStreaming: isLoading,
  });

  // Prompt suggestions based on last assistant message
  const handleSuggestionAccept = useCallback(
    (suggestion: string) => {
      setInput(suggestion);
    },
    []
  );

  const {
    suggestions,
    currentSuggestion,
    accept: acceptSuggestion,
    dismiss: dismissSuggestion,
    dismissAll: dismissAllSuggestions,
  } = useSuggestions(messages, { onAccept: handleSuggestionAccept });

  const { summary: contextSummary } = useContextSummary(sessionId, messages, isLoading);

  const handleAcceptGhostText = useCallback(() => {
    if (currentSuggestion) {
      acceptSuggestion(currentSuggestion);
    }
  }, [currentSuggestion, acceptSuggestion]);

  const handleSuggestionChipSelect = useCallback(
    (suggestion: string) => {
      setInput(suggestion);
    },
    []
  );

  const composePromptWithAttachments = useCallback(
    (text: string, files: AttachedImage[]) => {
      if (!files.length) return text;

      const mentioned = new Set((text.match(/@([^\s]+)/g) || []).map((match) => match.slice(1)));
      const additional = files.filter(
        (file) =>
          !mentioned.has(file.name) &&
          !mentioned.has(file.name.split('/').pop() || '')
      );
      if (!additional.length) return text;

      const lines = additional.map((file) => `- @${file.name}`);
      return `${text}\n\nAttached files:\n${lines.join('\n')}`;
    },
    []
  );

  // Command palette integration
  const clearChat = useCallback(() => {
    setMessages([]);
    setAssistantMetadata({});
    resetStreamEvents();
    resetCostTracking();
    resetSubagents();
    resetCheckpoints();
    lastUserPromptRef.current = '';
    lastUserMessageIdRef.current = '';
    setAttachments([]);
  }, [setMessages, resetStreamEvents, resetCostTracking, resetSubagents, resetCheckpoints]);

  const runReviewWorkflow = useCallback(async () => {
    const latest = await fetchWorkspaceDiff();
    const diff = latest?.diff ?? workspaceDiff;
    const filePaths = (latest?.changedFiles ?? changedFiles).map((f) => f.path);
    const prompt = getWorkflowPrompt(settings.workflowPrompts, 'review');
    const text = buildReviewWorkflowMessage({ prompt, changedFiles: filePaths, diff });
    await sendMessage({ text } as any);
  }, [fetchWorkspaceDiff, workspaceDiff, changedFiles, settings.workflowPrompts, sendMessage]);

  const runPrWorkflow = useCallback(async () => {
    const latest = await fetchWorkspaceDiff();
    const diff = latest?.diff ?? workspaceDiff;
    const prompt = getWorkflowPrompt(settings.workflowPrompts, 'pr');
    const text = buildPrWorkflowMessage({ prompt, diff });
    await sendMessage({ text } as any);
  }, [fetchWorkspaceDiff, workspaceDiff, settings.workflowPrompts, sendMessage]);

  const runBranchWorkflow = useCallback(async () => {
    const latest = await fetchWorkspaceDiff();
    const filePaths = (latest?.changedFiles ?? changedFiles).map((f) => f.path);
    const prompt = getWorkflowPrompt(settings.workflowPrompts, 'branch');
    const text = buildBranchNameWorkflowMessage({ prompt, changedFiles: filePaths });
    await sendMessage({ text } as any);
  }, [fetchWorkspaceDiff, changedFiles, settings.workflowPrompts, sendMessage]);

  const runBrowserWorkflow = useCallback(
    async (task?: string) => {
      const prompt = getWorkflowPrompt(settings.workflowPrompts, 'browser');
      const text = buildBrowserWorkflowMessage({
        prompt,
        targetUrl: 'http://localhost:1420',
        task,
      });
      await sendMessage({ text } as any);
    },
    [settings.workflowPrompts, sendMessage]
  );

  const generateDashboard = useCallback(
    workspaceId && projectId
      ? async () => {
          const prompt = window.prompt('What should this dashboard show?');
          if (!prompt) return;
          try {
            const result = await generateArtifact(projectId, {
              prompt,
              workspaceId,
              sessionId: sessionId ?? undefined,
            });
            toast.success(`Dashboard "${result.artifact.title}" created`);
          } catch {
            toast.error('Failed to generate dashboard');
          }
        }
      : async () => {
          toast.info('Open a workspace to generate dashboard artifacts');
        },
    [workspaceId, projectId, sessionId]
  );

  const commandContext = useMemo(
    () => ({
      clearChat,
      createSession: onCreateSession ?? (() => {}),
      exportSession: onExportSession ?? (() => {}),
      showHelp: () => setHelpOpen(true),
      showSettings: onOpenSettings,
      showModelSelector: onOpenSettings ? () => onOpenSettings('model') : undefined,
      showCostSummary: () => setCostOpen(true),
      showSessionList: onOpenSessions,
      openPullRequests: onOpenPullRequests,
      showLinearIssues: () => setLinearPickerOpen(true),
      addDir: onOpenWorkspacePaths,
      runReviewWorkflow,
      runPrWorkflow,
      runBranchWorkflow,
      runBrowserWorkflow,
      generateDashboard,
    }),
    [
      clearChat,
      onCreateSession,
      onExportSession,
      onOpenSettings,
      onOpenSessions,
      onOpenPullRequests,
      onOpenWorkspacePaths,
      runReviewWorkflow,
      runPrWorkflow,
      runBranchWorkflow,
      runBrowserWorkflow,
      generateDashboard,
    ]
  );

  const { commands, filterCommands } = useCommands(commandContext);

  const {
    isOpen: paletteOpen,
    searchQuery: paletteFilter,
    filteredCommands,
    close: closePalette,
    handleInputChange: handlePaletteInput,
    handleCommandSelect,
  } = useCommandPalette({ commands, filterCommands });

  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      handlePaletteInput(value);
    },
    [handlePaletteInput]
  );

  const handleCommandSelectAndClear = useCallback(
    (cmd: typeof commands[number]) => {
      setInput('');
      handleCommandSelect(cmd);
    },
    [handleCommandSelect]
  );

  const handlePaletteClose = useCallback(() => {
    setInput('');
    closePalette();
  }, [closePalette]);

  const toggleThinkingVisibility = useCallback(() => {
    updateSettings({ showThinking: !settings.showThinking });
  }, [settings.showThinking, updateSettings]);

  const toggleThinkingExpanded = useCallback(() => {
    setThinkingExpanded((prev) => !prev);
    setThinkingToggleVersion((prev) => prev + 1);
  }, []);

  // Keyboard shortcuts
  const shortcutDefs: ShortcutDefinition[] = useMemo(
    () => [
      {
        id: 'new-session',
        key: 'n',
        meta: true,
        label: 'New Session',
        category: 'chat' as const,
        handler: () => onCreateSession?.(),
      },
      {
        id: 'clear-chat',
        key: 'l',
        meta: true,
        label: 'Clear Chat',
        category: 'chat' as const,
        handler: clearChat,
      },
      {
        id: 'toggle-sidebar',
        key: '/',
        meta: true,
        label: 'Toggle Sidebar',
        category: 'navigation' as const,
        handler: onToggleSidebar ?? (() => {}),
      },
      {
        id: 'settings',
        key: ',',
        meta: true,
        label: 'Open Settings',
        category: 'navigation' as const,
        handler: onOpenSettings ?? (() => {}),
      },
      {
        id: 'help',
        key: '?',
        meta: true,
        shift: true,
        label: 'Show Help',
        category: 'general' as const,
        handler: () => setHelpOpen((prev) => !prev),
      },
      {
        id: 'thinking-visibility',
        key: 't',
        alt: true,
        label: 'Toggle thinking visibility',
        category: 'chat' as const,
        handler: toggleThinkingVisibility,
      },
      {
        id: 'thinking-expand',
        key: '.',
        meta: true,
        shift: true,
        label: 'Expand thinking blocks',
        category: 'chat' as const,
        handler: toggleThinkingExpanded,
      },
      {
        id: 'escape',
        key: 'Escape',
        label: 'Cancel / Close',
        category: 'general' as const,
        handler: () => {
          if (costOpen) {
            setCostOpen(false);
          } else if (helpOpen) {
            setHelpOpen(false);
          } else if (paletteOpen) {
            handlePaletteClose();
          }
        },
      },
    ],
    [
      onCreateSession,
      clearChat,
      costOpen,
      helpOpen,
      paletteOpen,
      handlePaletteClose,
      onToggleSidebar,
      onOpenSettings,
      toggleThinkingVisibility,
      toggleThinkingExpanded,
    ]
  );

  const { shortcuts } = useKeyboardShortcuts(shortcutDefs);

  // Load persisted messages when the session changes
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      setAssistantMetadata({});
      return;
    }

    setMessages([]);
    setAssistantMetadata({});

    let cancelled = false;

    async function loadMessages() {
      try {
        const res = await fetch(
          `${API_BASE}/api/sessions/${sessionId}/messages`
        );
        if (!res.ok) return;

        const saved: Message[] = await res.json();
        if (cancelled) return;

        setMessages(saved.map(toUIMessage));
      } catch {
        // Server not reachable — leave messages empty
      }
    }

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [sessionId, setMessages]);

  // Track when streaming completes to trigger auto-naming
  const wasStreamingRef = useRef(false);
  useEffect(() => {
    if (isLoading) {
      wasStreamingRef.current = true;
    } else if (wasStreamingRef.current) {
      // Streaming just ended
      wasStreamingRef.current = false;
      const completedAssistantId = getLatestAssistantMessageId(messages);
      if (workspaceId && completedAssistantId) {
        void fetchWorkspaceDiff().then((latest) => {
          const changedFilesForTurn =
            latest?.changedFiles?.map((file) => file.path) ?? [];
          setAssistantMetadata((current) => {
            const existing = current[completedAssistantId];
            if (!existing) return current;

            return {
              ...current,
              [completedAssistantId]: {
                ...existing,
                changedFiles: changedFilesForTurn,
              },
            };
          });
        });
      }

      userMsgCountRef.current += 1;
      if (
        userMsgCountRef.current >= 2 &&
        !autoNameCalledRef.current &&
        sessionId &&
        onAutoName
      ) {
        autoNameCalledRef.current = true;
        onAutoName(sessionId);
      }
    }
  }, [isLoading, sessionId, onAutoName, messages, workspaceId, fetchWorkspaceDiff]);

  // Report status data to parent for StatusBar
  useEffect(() => {
    onStatusChange?.({
      model: sessionInfo?.model ?? null,
      isStreaming: isLoading,
      toolCalls,
      cumulativeUsage,
      sessionTotalCost,
      subagentActiveCount,
      sessionInfo: sessionInfo ?? null,
    });
  }, [sessionInfo, isLoading, toolCalls, cumulativeUsage, sessionTotalCost, subagentActiveCount, onStatusChange]);

  const chatError: ChatError | null = useMemo(() => {
    if (!error) return null;

    const msg = error.message || 'An unexpected error occurred';
    const lowerMsg = msg.toLowerCase();

    if (lowerMsg.includes('rate limit') || lowerMsg.includes('429')) {
      return { type: 'rate_limit', message: msg, retryable: true };
    }
    if (
      lowerMsg.includes('auth') ||
      lowerMsg.includes('401') ||
      lowerMsg.includes('403')
    ) {
      return { type: 'auth', message: msg, retryable: false };
    }
    if (
      lowerMsg.includes('network') ||
      lowerMsg.includes('fetch') ||
      lowerMsg.includes('econnrefused') ||
      lowerMsg.includes('econnreset')
    ) {
      return { type: 'network', message: msg, retryable: true };
    }
    return { type: 'api', message: msg, retryable: true };
  }, [error]);

  const handleRetry = useCallback(() => {
    clearError();
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === 'user');
    if (!lastUserMessage) return;

    const text = lastUserMessage.parts
      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('');

    if (text) {
      resetStreamEvents();
      sendMessage({ text });
    }
  }, [messages, clearError, sendMessage, resetStreamEvents]);

  const handleDismissError = useCallback(() => {
    clearError();
  }, [clearError]);

  const handlePermissionDecision = useCallback(
    async (result: PermissionDecisionResult) => {
      if (!sessionId) return;
      resolvePermission(result.requestId);

      try {
        await fetch(`${API_BASE}/api/chat/permission`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            requestId: result.requestId,
            decision: result.decision,
            scope: result.scope,
          } satisfies PermissionResponse),
        });
      } catch (err) {
        console.error('[permission] Failed to send decision:', err);
      }
    },
    [sessionId, resolvePermission]
  );

  const handlePlanApprove = useCallback(async () => {
    if (!plan) return;
    if (!sessionId) return;
    approvePlan(plan.planId);

    try {
      await fetch(`${API_BASE}/api/chat/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          planId: plan.planId,
          decision: 'approve',
        } satisfies PlanDecisionRequest),
      });
    } catch (err) {
      console.error('[plan] Failed to send approval:', err);
    }
  }, [sessionId, plan, approvePlan]);

  const buildPlanDraft = useCallback(
    (heading: string) => {
      if (!plan) return '';
      return [
        heading,
        archivedPlanPath ? `Plan file: ${archivedPlanPath}` : undefined,
        '',
        plan.content,
      ]
        .filter((value): value is string => Boolean(value))
        .join('\n');
    },
    [plan, archivedPlanPath]
  );

  const handlePlanReject = useCallback(
    async (feedback?: string) => {
      if (!plan) return;
      if (!sessionId) return;
      rejectPlan(plan.planId, feedback);

      try {
        await fetch(`${API_BASE}/api/chat/plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          planId: plan.planId,
          decision: 'reject',
          feedback,
        } satisfies PlanDecisionRequest),
      });
        if (feedback?.trim()) {
          const prompt = getWorkflowPrompt(
            settings.workflowPrompts,
            'reviewMemory'
          );
          promptMemoryUpdate({
            trigger: 'review-feedback',
            draft: {
              fileName: 'MEMORY.md',
              content: buildReviewMemoryDraft({
                prompt,
                feedback,
              }),
            },
            onOpenMemory: () => onOpenSettings?.('memory'),
          });
        }
      } catch (err) {
        console.error('[plan] Failed to send rejection:', err);
      }
    },
    [sessionId, plan, rejectPlan, onOpenSettings, settings.workflowPrompts]
  );

  const handlePlanApproveWithFeedback = useCallback(
    async (feedback?: string) => {
      if (!plan) return;
      if (!sessionId) return;
      approvePlan(plan.planId);

      try {
        await fetch(`${API_BASE}/api/chat/plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          planId: plan.planId,
          decision: 'approve',
          feedback,
        } satisfies PlanDecisionRequest),
      });
        if (feedback?.trim()) {
          const prompt = getWorkflowPrompt(
            settings.workflowPrompts,
            'reviewMemory'
          );
          promptMemoryUpdate({
            trigger: 'review-feedback',
            draft: {
              fileName: 'MEMORY.md',
              content: buildReviewMemoryDraft({
                prompt,
                feedback,
              }),
            },
            onOpenMemory: () => onOpenSettings?.('memory'),
          });
        }
      } catch (err) {
        console.error('[plan] Failed to send approval feedback:', err);
      }
    },
    [sessionId, plan, approvePlan, onOpenSettings, settings.workflowPrompts]
  );

  const handlePlanInput = useCallback(
    async (feedback: string) => {
      const text = feedback.trim();
      if (!text) return;

      resetStreamEvents();
      await sendMessage({
        text: `Continue planning with this user input:\n${text}`,
      } as any);
    },
    [resetStreamEvents, sendMessage]
  );

  const handlePlanCopy = useCallback(async () => {
    const text = buildPlanDraft('Copy of current plan');
    if (!text) return;
    await navigator.clipboard.writeText(text);
  }, [buildPlanDraft]);

  const handlePlanExportToNewChat = useCallback(async () => {
    const draft = buildPlanDraft('Implement this approved plan');
    if (!draft) return;

    window.sessionStorage.setItem(PLAN_EXPORT_DRAFT_KEY, draft);
    if (onCreateSession) {
      await onCreateSession();
      return;
    }

    setInput(draft);
  }, [buildPlanDraft, onCreateSession]);

  const handlePlanHandoff = useCallback(async () => {
    const text = buildPlanDraft('Handoff to another agent');
    if (!text) return;
    await navigator.clipboard.writeText(text);
  }, [buildPlanDraft]);

  useEffect(() => {
    if (!plan || !sessionId) return;
    if (!plan.content.trim()) return;
    if (plan.planId === archivedPlanId) return;
    if (plan.status !== 'review' && plan.status !== 'approved' && plan.status !== 'rejected') {
      return;
    }

    let cancelled = false;

    void fetch(`${API_BASE}/api/chat/plan/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        planId: plan.planId,
        content: plan.content,
      }),
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { path?: string };
      })
      .then((result) => {
        if (cancelled || !result?.path) return;
        setArchivedPlanId(plan.planId);
        setArchivedPlanPath(result.path);
      })
      .catch((error) => {
        console.error('[plan] Failed to archive plan:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [plan, sessionId, archivedPlanId]);

  useEffect(() => {
    const draft = window.sessionStorage.getItem(PLAN_EXPORT_DRAFT_KEY);
    if (!draft) return;
    if (input.trim().length > 0) return;

    setInput(draft);
    window.sessionStorage.removeItem(PLAN_EXPORT_DRAFT_KEY);
  }, [sessionId]);

  const handleFixErrors = useCallback(
    async (toolCall: ToolCallState) => {
      if (!toolCall.ciFailures) return;

      const command = extractCommandFromToolInput(toolCall.input);
      const checks =
        toolCall.ciFailures.checks.length > 0
          ? `\nFailing checks:\n${toolCall.ciFailures.checks
              .map((item) => `- ${item}`)
              .join('\n')}`
          : '';
      const commandLine = command ? `\nLast command: ${command}` : '';
      const prompt =
        `The previous CI checks failed. Please fix the issues and rerun validation.${checks}${commandLine}\n\nRaw logs:\n${toolCall.ciFailures.rawOutput}`;

      resetStreamEvents();
      setInput('');
      await sendMessage({ text: prompt });
    },
    [isLoading, resetStreamEvents, sendMessage]
  );

  const pendingPermissionEntries = useMemo(
    () => Array.from(pendingPermissions.values()),
    [pendingPermissions]
  );

  // Rewind dialog handlers
  const handleRewindClick = useCallback(
    async (checkpointId: string) => {
      const cp = checkpoints.find((c) => c.id === checkpointId);
      if (!cp) return;
      setRewindTarget(cp);
      setIsLoadingPreview(true);
      const preview = await previewRewind(checkpointId);
      setRewindPreview(preview);
      setIsLoadingPreview(false);
    },
    [checkpoints, previewRewind]
  );

  const handleRewindConfirm = useCallback(
    async (mode: RewindMode) => {
      if (!rewindTarget) return;
      const ok = await executeRewind(rewindTarget.id, mode);
      if (ok && sessionId) {
        try {
          const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`);
          if (res.ok) {
            const saved: Message[] = await res.json();
            setMessages(saved.map(toUIMessage));
          }
        } catch {
          // ignore
        }

        if (workspaceId) {
          void fetchWorkspaceDiff();
        }
      }
      setRewindTarget(null);
      setRewindPreview(null);
    },
    [rewindTarget, executeRewind, sessionId, setMessages, workspaceId, fetchWorkspaceDiff]
  );

  const handleRewindCancel = useCallback(() => {
    setRewindTarget(null);
    setRewindPreview(null);
  }, []);

  const handleViewLatestChanges = useCallback(
    async (range: { fromRef: string; toRef: string }) => {
      if (!workspaceId) return;
      setLatestChangesOpen(true);
      setLatestChangesLoading(true);
      setLatestChangesError(null);
      try {
        const result = await workspaceApi.fetchWorkspaceDiff(workspaceId, range);
        setLatestChangesDiff(result.diff);
      } catch (err) {
        setLatestChangesError(err instanceof Error ? err.message : 'Failed to load diff');
        setLatestChangesDiff('');
      } finally {
        setLatestChangesLoading(false);
      }
    },
    [workspaceId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    if (text.startsWith('/')) {
      const commandToken = text.slice(1).trim().split(/\s+/)[0]?.toLowerCase() ?? '';
      if (commandToken) {
        const matchedCommand = commands.find(
          (cmd) => cmd.name.toLowerCase() === commandToken
        );
        if (matchedCommand) {
          const commandArgs = text.slice(commandToken.length + 1).trim();
          setInput('');
          if (commandToken === 'add-dir' && onOpenWorkspacePaths) {
            onOpenWorkspacePaths(commandArgs || undefined);
            return;
          }
          if (commandToken === 'browser') {
            resetStreamEvents();
            await runBrowserWorkflow(commandArgs);
            return;
          }
          handleCommandSelect(matchedCommand);
          return;
        }

        const pluginCommands = new Set(
          (sessionInfo?.slashCommands ?? []).map((command) => command.toLowerCase())
        );
        if (!pluginCommands.has(commandToken)) {
          setMessages([
            ...messages,
            {
              id: `invalid-slash-${Date.now()}`,
              role: 'assistant',
              parts: [
                {
                  type: 'text',
                  text: `Invalid slash command: /${commandToken}`,
                },
              ],
            } as UIMessage,
          ]);
          return;
        }
      }
    }

    // Track turn info for checkpoints
    const payload = composePromptWithAttachments(text, attachments);
    const attachmentRefs = attachments.map((file) => file.name).filter(Boolean);
    lastUserPromptRef.current = text;
    lastUserMessageIdRef.current = `user-${Date.now()}`;

    setInput('');
    resetStreamEvents();
    setAttachments([]);
    await sendMessage({
      text: payload,
      attachments: attachmentRefs,
    } as any);
  };

  return (
    <div className="flex flex-1 flex-col min-w-0">
      <MessageList
        messages={messages}
        isLoading={isLoading}
        toolCalls={toolCalls}
        thinkingBlocks={thinkingBlocks}
        showThinking={settings.showThinking}
        thinkingExpanded={thinkingExpanded}
        thinkingToggleVersion={thinkingToggleVersion}
        onToolFixErrors={handleFixErrors}
        assistantMetadata={assistantMetadata}
        sessionId={sessionId}
        projectId={projectId}
      />
      {/* Subagent visualization panel */}
      {(subagents.length > 0 || subagentPanelVisible) && (
        <SubagentPanel
          agents={subagents}
          activeCount={subagentActiveCount}
          isVisible={subagentPanelVisible}
          onToggleVisibility={toggleSubagentPanel}
        />
      )}
      {/* Checkpoint timeline */}
      <CheckpointTimeline
        checkpoints={checkpoints}
        onRewind={handleRewindClick}
        onViewLatestChanges={workspaceId ? handleViewLatestChanges : undefined}
      />
      <LatestTurnChangesDialog
        open={latestChangesOpen}
        loading={latestChangesLoading}
        diff={latestChangesDiff}
        error={latestChangesError}
        onClose={() => setLatestChangesOpen(false)}
      />
      {/* Rewind dialog */}
      {rewindTarget && (
        <RewindDialog
          checkpoint={rewindTarget}
          preview={rewindPreview}
          isLoadingPreview={isLoadingPreview}
          onRewind={handleRewindConfirm}
          onCancel={handleRewindCancel}
        />
      )}
      {/* Error banner */}
      <ErrorBanner
        error={chatError}
        onDismiss={handleDismissError}
        onRetry={handleRetry}
      />
      {/* Plan view */}
      {plan && plan.status !== 'idle' && (
        <div className="border-t border-border px-4 py-2">
          <PlanView
            plan={plan}
            savedPath={archivedPlanPath}
            onApprove={handlePlanApprove}
            onReject={handlePlanReject}
            onSendInput={handlePlanInput}
            onCopy={handlePlanCopy}
            onExportToNewChat={handlePlanExportToNewChat}
            onHandoff={handlePlanHandoff}
          />
        </div>
      )}
      {/* Permission dialogs */}
      {pendingPermissionEntries.length > 0 && (
        <div className="border-t border-border px-4 py-2 space-y-2">
          {pendingPermissionEntries.map((perm) => (
            <PermissionDialog
              key={perm.requestId}
              request={{
                type: 'permission:request',
                ...perm,
              }}
              onDecision={handlePermissionDecision}
            />
          ))}
        </div>
      )}
      {/* Suggestion chips */}
      {suggestions.length > 0 && !isLoading && (
        <SuggestionChips
          suggestions={suggestions}
          onSelect={handleSuggestionChipSelect}
          onDismiss={dismissSuggestion}
        />
      )}
      {linearIssue ? (
        <div className="border-t border-border px-4 py-2 flex items-center gap-2">
          <div className="text-xs text-muted-foreground shrink-0">Issue:</div>
          <button
            className="text-xs font-mono text-primary hover:underline underline-offset-2 truncate"
            onClick={() => setLinearPickerOpen(true)}
            title={linearIssue.title}
          >
            {linearIssue.id}
          </button>
          <div className="text-xs text-muted-foreground truncate">{linearIssue.title}</div>
          <button
            className="ml-auto rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => {
              setLinearIssue(null);
              if (window.location.hash.startsWith('#linear/issue/')) window.location.hash = '';
            }}
          >
            Clear
          </button>
        </div>
      ) : null}
      <ChatInput
        input={input}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        showPalette={paletteOpen}
        paletteFilter={paletteFilter}
        paletteCommands={filteredCommands}
        onCommandSelect={handleCommandSelectAndClear}
        onPaletteClose={handlePaletteClose}
        images={attachments}
        onImagesChange={setAttachments}
        availableFiles={suggestedFiles}
        ghostText={isLoading ? undefined : currentSuggestion}
        onAcceptSuggestion={handleAcceptGhostText}
        contextSummary={isLoading ? undefined : contextSummary}
      />
      <ShortcutHelpModal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        shortcuts={shortcuts}
      />
      {costOpen && (
        <div
          data-testid="cost-dialog-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setCostOpen(false)}
        >
          <div
            data-testid="cost-dialog"
            className="w-80 rounded-xl border border-border bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold">Session Cost</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total cost</span>
                <span className="font-mono">${sessionTotalCost.toFixed(6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Messages</span>
                <span className="font-mono">{messageCosts.length}</span>
              </div>
            </div>
            <button
              data-testid="cost-dialog-close"
              onClick={() => setCostOpen(false)}
              className="mt-4 w-full rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <LinearIssuePicker
        isOpen={linearPickerOpen}
        onClose={() => setLinearPickerOpen(false)}
        onSelectIssue={(issue) => {
          setLinearIssue({
            id: issue.id,
            title: issue.title,
            summary: issue.summary,
            url: issue.url,
          });
          window.location.hash = `#linear/issue/${encodeURIComponent(issue.id)}`;
        }}
        onOpenSettings={() => onOpenSettings?.('linear')}
      />
    </div>
  );
}
