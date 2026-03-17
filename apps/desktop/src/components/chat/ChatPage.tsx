import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from '@ai-sdk/react';
import type { Message, PermissionResponse } from '@claude-tauri/shared';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { ErrorBanner, type ChatError } from './ErrorBanner';
import { PermissionDialog } from './PermissionDialog';
import { PlanView } from './PlanView';
import { SubagentPanel } from './SubagentPanel';
import { CheckpointTimeline } from './CheckpointTimeline';
import { RewindDialog } from './RewindDialog';
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
import { useCheckpoints } from '@/hooks/useCheckpoints';
import { SuggestionChips } from './SuggestionChips';
import { useSettings } from '@/hooks/useSettings';
import { calculateCost, getModelFromName } from '@/lib/pricing';
import type { PlanDecisionRequest, Checkpoint, RewindPreview } from '@claude-tauri/shared';
import type { ToolCallState } from '@/hooks/useStreamEvents';
import { useWorkspaceDiff } from '@/hooks/useWorkspaceDiff';
import type { AttachedImage } from './ChatInput';
import { LinearIssuePicker } from '@/components/linear/LinearIssuePicker';
import type { CreateWorkspaceRequest } from '@claude-tauri/shared';
import * as linearApi from '@/lib/linear-api';
import './gen-ui/defaultRenderers';

const API_BASE = 'http://localhost:3131';

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
  onToggleSidebar?: () => void;
  onOpenSettings?: (tab?: string) => void;
  onOpenSessions?: () => void;
  onOpenPullRequests?: () => void;
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

export function ChatPage({
  sessionId,
  onCreateSession,
  onExportSession,
  onStatusChange,
  onAutoName,
  workspaceId,
  onToggleSidebar,
  onOpenSettings,
  onOpenSessions,
  onOpenPullRequests,
}: ChatPageProps) {
  const { settings } = useSettings();
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<AttachedImage[]>([]);
  const [linearIssue, setLinearIssue] = useState<LinearIssueContext | null>(null);
  const [linearPickerOpen, setLinearPickerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
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
  } = useSubagents();

  const {
    messageCosts,
    sessionTotalCost,
    addMessageCost,
    reset: resetCostTracking,
  } = useCostTracking();

  const { changedFiles, fetchDiff: fetchWorkspaceDiff } = useWorkspaceDiff(workspaceId ?? null);
  const suggestedFiles = useMemo(
    () => changedFiles.map((file) => file.path),
    [changedFiles]
  );

  useEffect(() => {
    if (!workspaceId) return;
    void fetchWorkspaceDiff();
  }, [workspaceId, fetchWorkspaceDiff]);

  // Checkpoint tracking state
  const turnIndexRef = useRef(0);
  const lastUserPromptRef = useRef('');
  const lastUserMessageIdRef = useRef('');
  const [rewindTarget, setRewindTarget] = useState<Checkpoint | null>(null);
  const [rewindPreview, setRewindPreview] = useState<RewindPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const {
    checkpoints,
    previewRewind,
    executeRewind,
    reset: resetCheckpoints,
  } = useCheckpoints({
    sessionId,
    toolCalls,
    lastUserPrompt: lastUserPromptRef.current,
    turnIndex: turnIndexRef.current,
    userMessageId: lastUserMessageIdRef.current,
  });

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
  useEffect(() => {
    if (usage && usage !== lastRecordedUsageRef.current) {
      lastRecordedUsageRef.current = usage;
      const model = sessionInfo?.model ?? 'claude-sonnet-4';
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
    }
  }, [usage, sessionInfo, addMessageCost]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${API_BASE}/api/chat`,
        body: {
          sessionId,
          model: settings.model,
          effort: settings.effort,
          permissionMode: settings.permissionMode,
          provider: settings.provider,
          providerConfig: {
            bedrockBaseUrl: settings.bedrockBaseUrl,
            bedrockProjectId: settings.bedrockProjectId,
            vertexProjectId: settings.vertexProjectId,
            vertexBaseUrl: settings.vertexBaseUrl,
            customBaseUrl: settings.customBaseUrl,
          },
          ...(workspaceId ? { workspaceId } : {}),
          ...(linearIssue ? { linearIssue } : {}),
        },
      }),
    [
      sessionId,
      settings.model,
      settings.effort,
      settings.permissionMode,
      settings.provider,
      settings.bedrockBaseUrl,
      settings.bedrockProjectId,
      settings.vertexProjectId,
      settings.vertexBaseUrl,
      settings.customBaseUrl,
      workspaceId,
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
    resetStreamEvents();
    resetCostTracking();
    resetSubagents();
    resetCheckpoints();
    turnIndexRef.current = 0;
    lastUserPromptRef.current = '';
    lastUserMessageIdRef.current = '';
    setAttachments([]);
  }, [setMessages, resetStreamEvents, resetCostTracking, resetSubagents, resetCheckpoints]);

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
    }),
    [
      clearChat,
      onCreateSession,
      onExportSession,
      onOpenSettings,
      onOpenSessions,
      onOpenPullRequests,
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
    [onCreateSession, clearChat, costOpen, helpOpen, paletteOpen, handlePaletteClose, onToggleSidebar, onOpenSettings]
  );

  const { shortcuts } = useKeyboardShortcuts(shortcutDefs);

  // Load persisted messages when the session changes
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }

    setMessages([]);

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

  const isLoading = status === 'submitted' || status === 'streaming';

  // Track when streaming completes to trigger auto-naming
  const wasStreamingRef = useRef(false);
  useEffect(() => {
    if (isLoading) {
      wasStreamingRef.current = true;
    } else if (wasStreamingRef.current) {
      // Streaming just ended
      wasStreamingRef.current = false;
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
  }, [isLoading, sessionId, onAutoName]);

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
      } catch (err) {
        console.error('[plan] Failed to send rejection:', err);
      }
    },
    [sessionId, plan, rejectPlan]
  );

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
      await executeRewind(rewindTarget.id, mode);
      setRewindTarget(null);
      setRewindPreview(null);
    },
    [rewindTarget, executeRewind]
  );

  const handleRewindCancel = useCallback(() => {
    setRewindTarget(null);
    setRewindPreview(null);
  }, []);

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
          setInput('');
          handleCommandSelect(matchedCommand);
          return;
        }
      }
    }

    // Track turn info for checkpoints
    const payload = composePromptWithAttachments(text, attachments);
    const attachmentRefs = attachments.map((file) => file.name).filter(Boolean);
    lastUserPromptRef.current = text;
    lastUserMessageIdRef.current = `user-${Date.now()}`;
    turnIndexRef.current += 1;

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
        onToolFixErrors={handleFixErrors}
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
            onApprove={handlePlanApprove}
            onReject={handlePlanReject}
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
