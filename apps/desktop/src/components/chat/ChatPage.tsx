import { useState, useEffect, useMemo, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from '@ai-sdk/react';
import type { Message, PermissionResponse } from '@claude-tauri/shared';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { ErrorBanner, type ChatError } from './ErrorBanner';
import { PermissionDialog } from './PermissionDialog';
import { PlanView } from './PlanView';
import type { PermissionDecisionResult } from './PermissionDialog';
import { useStreamEvents } from '@/hooks/useStreamEvents';
import { useCommands } from '@/hooks/useCommands';
import { useCommandPalette } from '@/hooks/useCommandPalette';
import type { PlanDecisionRequest } from '@claude-tauri/shared';

const API_BASE = 'http://localhost:3131';

interface ChatPageProps {
  sessionId: string | null;
  onCreateSession?: () => void | Promise<void>;
  onExportSession?: () => void | Promise<void>;
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

export function ChatPage({ sessionId, onCreateSession, onExportSession }: ChatPageProps) {
  const [input, setInput] = useState('');
  const {
    toolCalls,
    thinkingBlocks,
    pendingPermissions,
    resolvePermission,
    plan,
    approvePlan,
    rejectPlan,
    reset: resetStreamEvents,
  } = useStreamEvents();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${API_BASE}/api/chat`,
        body: { sessionId },
      }),
    [sessionId]
  );

  const { messages, sendMessage, status, setMessages, error, clearError } =
    useChat({
      // Use sessionId as the chat id so useChat resets its internal state
      // when switching sessions
      id: sessionId ?? undefined,
      transport,
    });

  // Command palette integration
  const clearChat = useCallback(() => {
    setMessages([]);
    resetStreamEvents();
  }, [setMessages, resetStreamEvents]);

  const commandContext = useMemo(
    () => ({
      clearChat,
      createSession: onCreateSession ?? (() => {}),
      exportSession: onExportSession ?? (() => {}),
    }),
    [clearChat, onCreateSession, onExportSession]
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

  // Wrap setInput to also drive palette state
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      handlePaletteInput(value);
    },
    [handlePaletteInput]
  );

  // When a command is selected, clear the input and execute
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

  // Load persisted messages when the session changes
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    async function loadMessages() {
      try {
        const res = await fetch(
          `${API_BASE}/api/sessions/${sessionId}/messages`
        );
        if (!res.ok) return;

        const saved: Message[] = await res.json();
        if (cancelled) return;

        if (saved.length > 0) {
          setMessages(saved.map(toUIMessage));
        }
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

  /**
   * Convert the AI SDK Error into a ChatError for the ErrorBanner component.
   * Maps common HTTP status messages to the appropriate error type.
   */
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
    // Default to API error (covers 5xx like 503, generic failures, etc.)
    return { type: 'api', message: msg, retryable: true };
  }, [error]);

  /**
   * Retry the last user message by re-submitting it.
   */
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
      // Remove from pending state immediately for responsive UI
      resolvePermission(result.requestId);

      // Send decision to backend
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

  const pendingPermissionEntries = useMemo(
    () => Array.from(pendingPermissions.values()),
    [pendingPermissions]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    // Don't send slash commands as chat messages
    if (text.startsWith('/')) {
      return;
    }

    setInput('');
    resetStreamEvents();
    await sendMessage({ text });
  };

  return (
    <div className="flex flex-1 flex-col min-w-0">
      <MessageList
        messages={messages}
        isLoading={isLoading}
        toolCalls={toolCalls}
        thinkingBlocks={thinkingBlocks}
      />
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
      />
    </div>
  );
}
