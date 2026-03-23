import { useCallback, useMemo, useEffect } from 'react';
import type { UIMessage } from '@ai-sdk/react';
import type { Message, PlanDecisionRequest, PermissionResponse } from '@claude-tauri/shared';
import type { ChatError } from './ErrorBanner';
import type { PermissionDecisionResult } from './PermissionDialog';
import type { RewindMode } from './RewindDialog';
import type { ToolCallState } from '@/hooks/useStreamEvents';
import type { AttachedImage } from './ChatInput';
import type { ShortcutDefinition } from '@/hooks/useKeyboardShortcuts';
import { useCommands } from '@/hooks/useCommands';
import { useCommandPalette } from '@/hooks/useCommandPalette';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { toast } from 'sonner';
import { generateArtifact } from '@/lib/workspace-api';
import * as workspaceApi from '@/lib/workspace-api';
import { promptMemoryUpdate } from '@/lib/memoryUpdatePrompt';
import {
  getWorkflowPrompt,
  buildReviewMemoryDraft,
  buildReviewWorkflowMessage,
  buildPrWorkflowMessage,
  buildBranchNameWorkflowMessage,
  buildBrowserWorkflowMessage,
} from '@/lib/workflowPrompts';
import {
  API_BASE,
  PLAN_EXPORT_DRAFT_KEY,
  extractCommandFromToolInput,
  toUIMessage,
} from './chatPageTypes';
import type { ChatPageProps } from './chatPageTypes';
import type { useChatPageState } from './useChatPageState';

type State = ReturnType<typeof useChatPageState>;

export function useChatPageHandlers(state: State, props: ChatPageProps) {
  const {
    sessionId,
    onCreateSession,
    onExportSession,
    onOpenSettings,
    onOpenSessions,
    onOpenPullRequests,
    onOpenWorkspacePaths,
    onToggleSidebar,
    workspaceId,
    projectId,
  } = props;

  const {
    settings,
    updateSettings,
    input,
    setInput,
    attachments,
    setAttachments,
    setLinearPickerOpen,
    helpOpen,
    setHelpOpen,
    costOpen,
    setCostOpen,
    setThinkingExpanded,
    setThinkingToggleVersion,
    setDashboardModalOpen,
    setDashboardModalLoading,
    setDashboardModalError,
    plan,
    approvePlan,
    rejectPlan,
    resolvePermission,
    pendingPermissions,
    resetStreamEvents,
    sessionInfo,
    messages,
    sendMessage,
    isLoading,
    setMessages,
    error,
    clearError,
    setAssistantMetadata,
    resetCostTracking,
    resetSubagents,
    resetCheckpoints,
    workspaceDiff,
    changedFiles,
    fetchWorkspaceDiff,
    checkpoints,
    previewRewind,
    executeRewind,
    rewindTarget,
    setRewindTarget,
    setRewindPreview,
    setIsLoadingPreview,
    setLatestChangesOpen,
    setLatestChangesLoading,
    setLatestChangesError,
    setLatestChangesDiff,
    archivedPlanId,
    setArchivedPlanId,
    archivedPlanPath,
    setArchivedPlanPath,
    currentSuggestion,
    acceptSuggestion,
    lastUserPromptRef,
    lastUserMessageIdRef,
  } = state;

  // --------------- Clear chat ---------------
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
  }, [setMessages, resetStreamEvents, resetCostTracking, resetSubagents, resetCheckpoints, setAssistantMetadata, setAttachments, lastUserPromptRef, lastUserMessageIdRef]);

  // --------------- Workflow handlers ---------------
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
        targetUrl: window.location.origin,
        task,
      });
      await sendMessage({ text } as any);
    },
    [settings.workflowPrompts, sendMessage]
  );

  // --------------- Dashboard ---------------
  const handleDashboardModalConfirm = useCallback(
    async (prompt: string) => {
      if (!workspaceId || !projectId) return;
      setDashboardModalLoading(true);
      setDashboardModalError(null);
      try {
        const result = await generateArtifact(projectId, {
          prompt,
          workspaceId,
          sessionId: sessionId ?? undefined,
        });
        toast.success(`Dashboard "${result.artifact.title}" created`);
        setDashboardModalOpen(false);
      } catch (err) {
        setDashboardModalError(err instanceof Error ? err.message : 'Failed to generate dashboard');
      } finally {
        setDashboardModalLoading(false);
      }
    },
    [workspaceId, projectId, sessionId, setDashboardModalLoading, setDashboardModalError, setDashboardModalOpen]
  );

  const generateDashboard = useCallback(
    workspaceId && projectId
      ? () => {
          setDashboardModalError(null);
          setDashboardModalOpen(true);
        }
      : async () => {
          toast.info('Open a workspace to generate dashboard artifacts');
        },
    [workspaceId, projectId, setDashboardModalError, setDashboardModalOpen]
  );

  // --------------- Command palette ---------------
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
      setHelpOpen,
      setCostOpen,
      setLinearPickerOpen,
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
    [setInput, handlePaletteInput]
  );

  const handleCommandSelectAndClear = useCallback(
    (cmd: (typeof commands)[number]) => {
      setInput('');
      handleCommandSelect(cmd);
    },
    [setInput, handleCommandSelect]
  );

  const handlePaletteClose = useCallback(() => {
    setInput('');
    closePalette();
  }, [setInput, closePalette]);

  // --------------- Thinking toggles ---------------
  const toggleThinkingVisibility = useCallback(() => {
    updateSettings({ showThinking: !settings.showThinking });
  }, [settings.showThinking, updateSettings]);

  const toggleThinkingExpanded = useCallback(() => {
    setThinkingExpanded((prev: boolean) => !prev);
    setThinkingToggleVersion((prev: number) => prev + 1);
  }, [setThinkingExpanded, setThinkingToggleVersion]);

  // --------------- Keyboard shortcuts ---------------
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
        handler: () => setHelpOpen((prev: boolean) => !prev),
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
      setHelpOpen,
      setCostOpen,
    ]
  );

  const { shortcuts } = useKeyboardShortcuts(shortcutDefs);

  // --------------- Error handling ---------------
  const chatError: ChatError | null = useMemo(() => {
    if (!error) return null;

    const rawMsg = error.message || 'An unexpected error occurred';
    const lowerMsg = rawMsg.toLowerCase();

    console.error('[ChatPage] Error details:', rawMsg);

    const isTechnicalError =
      lowerMsg.includes('circular structure') ||
      lowerMsg.includes('fibernode') ||
      lowerMsg.includes('htmlelement') ||
      lowerMsg.includes('converting circular') ||
      lowerMsg.includes('stack trace') ||
      lowerMsg.includes('typeerror') ||
      lowerMsg.includes('referenceerror') ||
      lowerMsg.includes('syntaxerror') ||
      lowerMsg.includes('cannot read propert');

    const msg = isTechnicalError
      ? 'Something went wrong sending your message. Please try again.'
      : rawMsg;

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
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
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

  // --------------- Permission handling ---------------
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

  const pendingPermissionEntries = useMemo(
    () => Array.from(pendingPermissions.values()),
    [pendingPermissions]
  );

  // --------------- Plan handling ---------------
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
        if (feedback?.trim()) {
          const prompt = getWorkflowPrompt(settings.workflowPrompts, 'reviewMemory');
          promptMemoryUpdate({
            trigger: 'review-feedback',
            draft: {
              fileName: 'MEMORY.md',
              content: buildReviewMemoryDraft({ prompt, feedback }),
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
          const prompt = getWorkflowPrompt(settings.workflowPrompts, 'reviewMemory');
          promptMemoryUpdate({
            trigger: 'review-feedback',
            draft: {
              fileName: 'MEMORY.md',
              content: buildReviewMemoryDraft({ prompt, feedback }),
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
  }, [buildPlanDraft, onCreateSession, setInput]);

  const handlePlanHandoff = useCallback(async () => {
    const text = buildPlanDraft('Handoff to another agent');
    if (!text) return;
    await navigator.clipboard.writeText(text);
  }, [buildPlanDraft]);

  // Archive plan effect
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
      .catch((archiveError) => {
        console.error('[plan] Failed to archive plan:', archiveError);
      });

    return () => {
      cancelled = true;
    };
  }, [plan, sessionId, archivedPlanId, setArchivedPlanId, setArchivedPlanPath]);

  // Restore plan export draft
  useEffect(() => {
    const draft = window.sessionStorage.getItem(PLAN_EXPORT_DRAFT_KEY);
    if (!draft) return;
    if (input.trim().length > 0) return;

    setInput(draft);
    window.sessionStorage.removeItem(PLAN_EXPORT_DRAFT_KEY);
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // --------------- Fix errors handler ---------------
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
      const prompt = `The previous CI checks failed. Please fix the issues and rerun validation.${checks}${commandLine}\n\nRaw logs:\n${toolCall.ciFailures.rawOutput}`;

      resetStreamEvents();
      setInput('');
      await sendMessage({ text: prompt });
    },
    [isLoading, resetStreamEvents, sendMessage, setInput]
  );

  // --------------- Rewind handlers ---------------
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
    [checkpoints, previewRewind, setRewindTarget, setIsLoadingPreview, setRewindPreview]
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
    [rewindTarget, executeRewind, sessionId, setMessages, workspaceId, fetchWorkspaceDiff, setRewindTarget, setRewindPreview]
  );

  const handleRewindCancel = useCallback(() => {
    setRewindTarget(null);
    setRewindPreview(null);
  }, [setRewindTarget, setRewindPreview]);

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
    [workspaceId, setLatestChangesOpen, setLatestChangesLoading, setLatestChangesError, setLatestChangesDiff]
  );

  // --------------- Suggestion handlers ---------------
  const handleAcceptGhostText = useCallback(() => {
    if (currentSuggestion) {
      acceptSuggestion(currentSuggestion);
    }
  }, [currentSuggestion, acceptSuggestion]);

  const handleSuggestionChipSelect = useCallback(
    (suggestion: string) => {
      setInput(suggestion);
    },
    [setInput]
  );

  // --------------- Compose prompt with attachments ---------------
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

  // --------------- Submit handler ---------------
  const handleSubmit = useCallback(async () => {
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
          (sessionInfo?.slashCommands ?? []).map((command: string) => command.toLowerCase())
        );
        if (!pluginCommands.has(commandToken)) {
          setMessages((prev: UIMessage[]) => [
            ...prev,
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

    const payload = composePromptWithAttachments(text, attachments);
    lastUserPromptRef.current = text;
    lastUserMessageIdRef.current = `user-${Date.now()}`;

    setInput('');
    resetStreamEvents();
    setAttachments([]);
    await sendMessage({ text: payload });
  }, [
    input,
    isLoading,
    commands,
    setInput,
    onOpenWorkspacePaths,
    resetStreamEvents,
    runBrowserWorkflow,
    handleCommandSelect,
    sessionInfo,
    setMessages,
    composePromptWithAttachments,
    attachments,
    lastUserPromptRef,
    lastUserMessageIdRef,
    setAttachments,
    sendMessage,
  ]);

  return {
    // Command palette
    commands,
    paletteOpen,
    paletteFilter,
    filteredCommands,
    handleInputChange,
    handleCommandSelectAndClear,
    handlePaletteClose,
    handleCommandSelect,

    // Shortcuts
    shortcuts,

    // Error
    chatError,
    handleRetry,
    handleDismissError,

    // Permission
    handlePermissionDecision,
    pendingPermissionEntries,

    // Plan
    handlePlanApprove,
    handlePlanReject,
    handlePlanApproveWithFeedback,
    handlePlanInput,
    handlePlanCopy,
    handlePlanExportToNewChat,
    handlePlanHandoff,

    // Fix errors
    handleFixErrors,

    // Rewind
    handleRewindClick,
    handleRewindConfirm,
    handleRewindCancel,

    // Latest changes
    handleViewLatestChanges,

    // Suggestions
    handleAcceptGhostText,
    handleSuggestionChipSelect,

    // Thinking
    toggleThinkingVisibility,
    toggleThinkingExpanded,

    // Workflows
    runReviewWorkflow,
    runPrWorkflow,
    runBranchWorkflow,
    runBrowserWorkflow,

    // Dashboard
    handleDashboardModalConfirm,
    generateDashboard,

    // Clear
    clearChat,

    // Submit
    handleSubmit,
  };
}
