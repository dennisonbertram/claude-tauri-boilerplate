import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { Message } from '@claude-tauri/shared';
import { pickProviderConfig } from '@claude-tauri/shared';
import type { AssistantResponseMetadata } from './MessageList';
import { useStreamEvents } from '@/hooks/useStreamEvents';
import type { UsageState } from '@/hooks/useStreamEvents';
import { useSubagents } from '@/hooks/useSubagents';
import { useCostTracking } from '@/hooks/useCostTracking';
import { useSuggestions } from '@/hooks/useSuggestions';
import { useContextSummary } from '@/hooks/useContextSummary';
import { useMcpServers } from '@/hooks/useMcpServers';
import { useCheckpoints } from '@/hooks/useCheckpoints';
import { useSettings } from '@/hooks/useSettings';
import { useWorkspaceDiff } from '@/hooks/useWorkspaceDiff';
import { calculateCost, getModelFromName } from '@/lib/pricing';
import type { AttachedImage } from './ChatInput';
import type { ContextUsage } from './ContextIndicator';
import type { Checkpoint, RewindPreview } from '@claude-tauri/shared';
import * as linearApi from '@/lib/linear-api';
import {
  API_BASE,
  MAX_CONTEXT_TOKENS,
  type ChatPageProps,
  type LinearIssueContext,
  toUIMessage,
  getLatestAssistantMessageId,
} from './chatPageTypes';

export function useChatPageState(props: ChatPageProps) {
  const {
    sessionId,
    onStatusChange,
    onAutoName,
    workspaceId,
    additionalDirectories,
    onTaskComplete,
    profileId,
    initialMessage,
    onInitialMessageConsumed,
    onSessionInitialized,
  } = props;

  const { settings, updateSettings } = useSettings();

  // --------------- Basic UI state ---------------
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<AttachedImage[]>([]);
  const [linearIssue, setLinearIssue] = useState<LinearIssueContext | null>(null);
  const [linearPickerOpen, setLinearPickerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [thinkingToggleVersion, setThinkingToggleVersion] = useState(0);
  const [dashboardModalOpen, setDashboardModalOpen] = useState(false);
  const [dashboardModalLoading, setDashboardModalLoading] = useState(false);
  const [dashboardModalError, setDashboardModalError] = useState<string | null>(null);

  // --------------- Stream events hook ---------------
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

  // --------------- Subagents ---------------
  const {
    agents: subagents,
    activeCount: subagentActiveCount,
    isVisible: subagentPanelVisible,
    toggleVisibility: toggleSubagentPanel,
    reset: resetSubagents,
  } = useSubagents({ onRootTaskComplete: onTaskComplete });

  // --------------- Cost tracking ---------------
  const {
    messageCosts,
    sessionTotalCost,
    addMessageCost,
    reset: resetCostTracking,
  } = useCostTracking();

  // --------------- Workspace diff ---------------
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

  // --------------- Checkpoint / rewind state ---------------
  const lastUserPromptRef = useRef('');
  const lastUserMessageIdRef = useRef('');
  const initialMessageSentRef = useRef(false);
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

  // --------------- Auto-naming ---------------
  const userMsgCountRef = useRef(0);
  const autoNameCalledRef = useRef(false);
  const prevSessionIdRef = useRef(sessionId);

  if (sessionId !== prevSessionIdRef.current) {
    prevSessionIdRef.current = sessionId;
    userMsgCountRef.current = 0;
    autoNameCalledRef.current = false;
  }

  // --------------- Context usage ---------------
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

  const lastRecordedUsageRef = useRef<UsageState | null>(null);

  // --------------- Transport ---------------
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
          ...(profileId ? { profileId } : {}),
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
      workspaceId,
      additionalDirectories,
      linearIssue,
      profileId,
    ]
  );

  // --------------- Deep-link: #linear/issue/ENG-123 ---------------
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

  // --------------- Chat hook ---------------
  // Generate a stable fallback ID that persists across renders but is created
  // once per component instance. This ensures that when sessionId is null,
  // the Chat instance uses a consistent ID rather than undefined (which would
  // cause the Chat to be recreated on every render due to 'id' in options check).
  const stableFallbackId = useMemo(
    () =>
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `fallback-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    []
  );

  // Use sessionId when available, otherwise fall back to the stable ID.
  // This ensures the Chat instance is recreated when sessionId actually changes
  // (e.g., user switches sessions) while remaining stable when sessionId is null.
  const chatId = sessionId ?? stableFallbackId;

  const handleDataPart = useCallback(
    (part: { type: string; data?: unknown }) => {
      if (
        part.type === 'data-stream-event' &&
        part.data &&
        typeof part.data === 'object' &&
        'type' in part.data
      ) {
        if ((part.data as { type: string }).type === 'session:init') {
          const event = part.data as { type: 'session:init'; sessionId?: string; appSessionId?: string };
          // Prefer appSessionId (the app-level DB session) over the Claude SDK sessionId
          const effectiveId = event.appSessionId || event.sessionId;
          if (typeof effectiveId === 'string' && effectiveId.trim().length > 0) {
            onSessionInitialized?.(effectiveId);
          }
        }
        processEvent(part.data as import('@claude-tauri/shared').StreamEvent);
      }
    },
    [processEvent, onSessionInitialized]
  );

  const { messages, sendMessage, status, setMessages, error, clearError } = useChat({
    id: chatId,
    transport,
    onData: handleDataPart as any,
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  // --------------- Record cost when usage arrives ---------------
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

  // --------------- Checkpoints ---------------
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

  // --------------- Suggestions ---------------
  const handleSuggestionAccept = useCallback((suggestion: string) => {
    setInput(suggestion);
  }, []);

  const {
    suggestions,
    currentSuggestion,
    accept: acceptSuggestion,
    dismiss: dismissSuggestion,
    dismissAll: dismissAllSuggestions,
  } = useSuggestions(messages, { onAccept: handleSuggestionAccept });

  const { summary: contextSummary } = useContextSummary(sessionId, messages, isLoading);
  const { visibleEnabledServers: mcpServers } = useMcpServers();

  // --------------- Load persisted messages when session changes ---------------
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
        const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`);
        if (!res.ok) return;

        const saved: Message[] = await res.json();
        if (cancelled) return;

        setMessages(saved.map(toUIMessage));
      } catch {
        // Server not reachable
      }
    }

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [sessionId, setMessages]);

  // --------------- Auto-name after first streaming completes ---------------
  const wasStreamingRef = useRef(false);
  useEffect(() => {
    if (isLoading) {
      wasStreamingRef.current = true;
    } else if (wasStreamingRef.current) {
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
        userMsgCountRef.current >= 1 &&
        messages.length >= 2 &&
        !autoNameCalledRef.current &&
        sessionId &&
        onAutoName
      ) {
        autoNameCalledRef.current = true;
        // Small delay to ensure the server has persisted the assistant message
        setTimeout(() => onAutoName(sessionId), 500);
      }
    }
  }, [isLoading, sessionId, onAutoName, messages, workspaceId, fetchWorkspaceDiff]);

  // --------------- Report status to parent ---------------
  useEffect(() => {
    onStatusChange?.({
      model: sessionInfo?.model ?? null,
      isStreaming: isLoading,
      toolCalls,
      cumulativeUsage,
      sessionTotalCost,
      subagentActiveCount,
      checkpoints,
      sessionInfo: sessionInfo ?? null,
    });
  }, [
    sessionInfo,
    isLoading,
    toolCalls,
    cumulativeUsage,
    sessionTotalCost,
    subagentActiveCount,
    checkpoints,
    onStatusChange,
  ]);

  // --------------- Auto-send initial message ---------------
  useEffect(() => {
    if (!initialMessage) {
      initialMessageSentRef.current = false;
      return;
    }

    if (initialMessageSentRef.current) {
      return;
    }

    initialMessageSentRef.current = true;
    // Don't call onInitialMessageConsumed here — pendingMessage must stay
    // truthy to keep ChatPage mounted until handleSessionInitialized fires
    resetStreamEvents();
    lastUserPromptRef.current = initialMessage;
    lastUserMessageIdRef.current = `user-${Date.now()}`;
    void sendMessage({ text: initialMessage } as any);
  }, [initialMessage, onInitialMessageConsumed, resetStreamEvents, sendMessage]);

  return {
    // Settings
    settings,
    updateSettings,

    // Basic UI state
    input,
    setInput,
    attachments,
    setAttachments,
    linearIssue,
    setLinearIssue,
    linearPickerOpen,
    setLinearPickerOpen,
    helpOpen,
    setHelpOpen,
    costOpen,
    setCostOpen,
    thinkingExpanded,
    setThinkingExpanded,
    thinkingToggleVersion,
    setThinkingToggleVersion,
    dashboardModalOpen,
    setDashboardModalOpen,
    dashboardModalLoading,
    setDashboardModalLoading,
    dashboardModalError,
    setDashboardModalError,

    // Stream events
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
    resetStreamEvents,

    // Subagents
    subagents,
    subagentActiveCount,
    subagentPanelVisible,
    toggleSubagentPanel,
    resetSubagents,

    // Cost
    messageCosts,
    sessionTotalCost,
    resetCostTracking,

    // Workspace diff
    workspaceDiff,
    changedFiles,
    fetchWorkspaceDiff,
    suggestedFiles,

    // Checkpoints / rewind
    lastUserPromptRef,
    lastUserMessageIdRef,
    rewindTarget,
    setRewindTarget,
    rewindPreview,
    setRewindPreview,
    isLoadingPreview,
    setIsLoadingPreview,
    latestChangesOpen,
    setLatestChangesOpen,
    latestChangesLoading,
    setLatestChangesLoading,
    latestChangesDiff,
    setLatestChangesDiff,
    latestChangesError,
    setLatestChangesError,
    archivedPlanId,
    setArchivedPlanId,
    archivedPlanPath,
    setArchivedPlanPath,
    assistantMetadata,
    setAssistantMetadata,
    checkpoints,
    previewRewind,
    executeRewind,
    resetCheckpoints,

    // Context
    contextUsage,
    contextSummary,

    // Chat hook
    messages,
    sendMessage,
    isLoading,
    setMessages,
    error,
    clearError,

    // Suggestions
    suggestions,
    currentSuggestion,
    acceptSuggestion,
    dismissSuggestion,
    dismissAllSuggestions,

    // MCP servers
    mcpServers,
  };
}
