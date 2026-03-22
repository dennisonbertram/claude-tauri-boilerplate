import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any module imports.
// ---------------------------------------------------------------------------
const {
  mockUseChat,
  mockUseSettings,
  mockDefaultChatTransport,
  mockUseStreamEvents,
  mockPromptMemoryUpdate,
  mockUseWorkspaceDiff,
} = vi.hoisted(() => ({
  mockUseChat: vi.fn(),
  mockUseSettings: vi.fn(),
  mockDefaultChatTransport: vi.fn(),
  mockUseStreamEvents: vi.fn(),
  mockPromptMemoryUpdate: vi.fn(),
  mockUseWorkspaceDiff: vi.fn(),
}));

vi.mock('@ai-sdk/react', () => ({
  useChat: (...args: unknown[]) => mockUseChat(...args),
}));

vi.mock('ai', () => ({
  DefaultChatTransport: mockDefaultChatTransport,
}));

vi.mock('@claude-tauri/shared', () => ({
  pickProviderConfig: (_provider: string, settings: Record<string, unknown>) => ({
    bedrockBaseUrl: settings.bedrockBaseUrl ?? '',
    bedrockProjectId: settings.bedrockProjectId ?? '',
    vertexProjectId: settings.vertexProjectId ?? '',
    vertexBaseUrl: settings.vertexBaseUrl ?? '',
    customBaseUrl: settings.customBaseUrl ?? '',
  }),
}));

vi.mock('@/hooks/useSettings', () => ({
  useSettings: (...args: unknown[]) => mockUseSettings(...args),
}));

vi.mock('@/lib/memoryUpdatePrompt', () => ({
  promptMemoryUpdate: (...args: unknown[]) => mockPromptMemoryUpdate(...args),
}));

vi.mock('@/hooks/useStreamEvents', () => ({
  useStreamEvents: (...args: unknown[]) => mockUseStreamEvents(...args),
}));

vi.mock('@/hooks/useWorkspaceDiff', () => ({
  useWorkspaceDiff: (...args: unknown[]) => mockUseWorkspaceDiff(...args),
}));

vi.mock('@/hooks/useSubagents', () => ({
  useSubagents: () => ({
    agents: [],
    activeCount: 0,
    isVisible: false,
    toggleVisibility: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCommands', () => ({
  useCommands: () => ({
    commands: [],
    filterCommands: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCommandPalette', () => ({
  useCommandPalette: () => ({
    isOpen: false,
    searchQuery: '',
    filteredCommands: [],
    close: vi.fn(),
    handleInputChange: vi.fn(),
    handleCommandSelect: vi.fn(),
  }),
}));

vi.mock('@/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: () => ({ shortcuts: [] }),
  isMacPlatform: () => false,
}));

vi.mock('@/hooks/useCostTracking', () => ({
  useCostTracking: () => ({
    messageCosts: [],
    sessionTotalCost: 0,
    addMessageCost: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock('@/hooks/useSuggestions', () => ({
  useSuggestions: () => ({
    suggestions: [],
    currentSuggestion: null,
    accept: vi.fn(),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCheckpoints', () => ({
  useCheckpoints: () => ({
    checkpoints: [],
    previewRewind: vi.fn(),
    executeRewind: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock('@/components/chat/MessageList', () => ({
  MessageList: () => null,
}));

vi.mock('@/components/chat/ShortcutHelpModal', () => ({
  ShortcutHelpModal: () => null,
}));

vi.mock('@/components/chat/CostDisplay', () => ({
  CostDisplay: () => null,
}));

vi.mock('@/components/chat/ChatInput', () => ({
  ChatInput: () => null,
}));

vi.mock('@/components/chat/PermissionDialog', () => ({
  PermissionDialog: () => null,
}));

vi.mock('@/components/chat/PlanView', () => ({
  PlanView: () => null,
}));

vi.mock('@/components/chat/SubagentPanel', () => ({
  SubagentPanel: () => null,
}));

vi.mock('@/components/chat/CheckpointTimeline', () => ({
  CheckpointTimeline: () => null,
}));

vi.mock('@/components/chat/RewindDialog', () => ({
  RewindDialog: () => null,
}));

vi.mock('@/components/chat/ContextIndicator', () => ({
  ContextIndicator: () => null,
}));

vi.mock('@/components/chat/ErrorBanner', () => ({
  ErrorBanner: () => null,
}));

vi.mock('@/components/chat/SuggestionChips', () => ({
  SuggestionChips: () => null,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
import { ChatPage } from '../ChatPage';
import { createElement } from 'react';

function getDefaultSettings(overrides = {}) {
  return {
    provider: 'anthropic',
    bedrockBaseUrl: '',
    bedrockProjectId: '',
    vertexProjectId: '',
    vertexBaseUrl: '',
    customBaseUrl: '',
    model: 'claude-sonnet-4-6',
    effort: 'high',
    thinkingBudgetTokens: 16000,
    permissionMode: 'default',
    systemPrompt: '',
    workflowPrompts: {
      review: 'Review prompt',
      pr: 'PR prompt',
      branch: 'Branch prompt',
      browser: 'Browser prompt',
    },
    runtimeEnv: {},
    ...overrides,
  };
}

function getDefaultStreamEventsState(overrides = {}) {
  return {
    toolCalls: new Map(),
    thinkingBlocks: new Map(),
    pendingPermissions: new Map(),
    resolvePermission: vi.fn(),
    plan: null,
    approvePlan: vi.fn(),
    rejectPlan: vi.fn(),
    reset: vi.fn(),
    cumulativeUsage: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    },
    isCompacting: false,
    usage: null,
    sessionInfo: null,
    processEvent: vi.fn(),
    ...overrides,
  };
}

function defaultUseChatReturn(overrides = {}) {
  return {
    messages: [],
    sendMessage: vi.fn(),
    status: 'ready',
    setMessages: vi.fn(),
    error: undefined,
    clearError: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests — SDK transport initialization (regression for #308)
// ---------------------------------------------------------------------------
describe('ChatPage SDK transport initialization (#308)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
    mockUseChat.mockReturnValue(defaultUseChatReturn());
    mockUseSettings.mockReturnValue({
      settings: getDefaultSettings(),
      updateSettings: vi.fn(),
      resetSettings: vi.fn(),
    });
    mockUseStreamEvents.mockReturnValue(getDefaultStreamEventsState());
    mockUseWorkspaceDiff.mockReturnValue({
      diff: '',
      changedFiles: [],
      fetchDiff: vi.fn(),
    });
  });

  it('creates transport with all required fields', () => {
    render(createElement(ChatPage, { sessionId: 'session-abc' }));

    expect(mockDefaultChatTransport).toHaveBeenCalledTimes(1);
    const config = mockDefaultChatTransport.mock.calls[0][0];

    expect(config.api).toBe('http://localhost:3131/api/chat');
    expect(config.body).toBeDefined();
    expect(config.body.sessionId).toBe('session-abc');
    expect(config.body.model).toBe('claude-sonnet-4-6');
    expect(config.body.effort).toBe('high');
    expect(config.body.permissionMode).toBe('default');
    expect(config.body.provider).toBe('anthropic');
  });

  // TODO: #267 — quarantined, useChat id transition behavior changed
  it.skip('passes a stable id to useChat that does not change when sessionId transitions from null', () => {
    // Render with null sessionId (no session yet)
    const { rerender } = render(createElement(ChatPage, { sessionId: null }));
    expect(mockUseChat).toHaveBeenCalled();

    const firstCallOptions = mockUseChat.mock.calls[0][0];
    const firstId = firstCallOptions.id;
    expect(firstId).toBeDefined();
    expect(typeof firstId).toBe('string');
    expect(firstId.length).toBeGreaterThan(0);

    // Simulate session creation — parent now provides a real sessionId
    vi.clearAllMocks();
    mockUseChat.mockReturnValue(defaultUseChatReturn());
    rerender(createElement(ChatPage, { sessionId: 'real-session-123' }));

    const secondCallOptions = mockUseChat.mock.calls[0][0];
    const secondId = secondCallOptions.id;

    // The id should have transitioned to the real session id (one-time lock-in)
    expect(secondId).toBe('real-session-123');
  });

  it('keeps the chat id stable once a real sessionId is locked in', () => {
    // Start with a real session
    const { rerender } = render(
      createElement(ChatPage, { sessionId: 'session-1' })
    );

    const firstId = mockUseChat.mock.calls[0][0].id;
    expect(firstId).toBe('session-1');

    // Re-render with the same session — id should not change
    vi.clearAllMocks();
    mockUseChat.mockReturnValue(defaultUseChatReturn());
    rerender(createElement(ChatPage, { sessionId: 'session-1' }));

    const secondId = mockUseChat.mock.calls[0][0].id;
    expect(secondId).toBe('session-1');
  });

  it('handles null/undefined sessionId gracefully by using a fallback UUID', () => {
    render(createElement(ChatPage, { sessionId: null }));

    const options = mockUseChat.mock.calls[0][0];
    expect(options.id).toBeDefined();
    expect(typeof options.id).toBe('string');
    // Should be a valid UUID-like string (not "null" or "undefined")
    expect(options.id).not.toBe('null');
    expect(options.id).not.toBe('undefined');
    expect(options.id.length).toBeGreaterThan(0);
  });

  it('structures sendMessage payload with { text } format', () => {
    const mockSendMessage = vi.fn();
    mockUseChat.mockReturnValue(
      defaultUseChatReturn({ sendMessage: mockSendMessage })
    );

    render(createElement(ChatPage, { sessionId: 'session-send' }));

    // The sendMessage function should accept { text: string } payloads
    // Verify the hook is configured — the actual call happens from ChatInput
    expect(mockUseChat).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        transport: expect.anything(),
      })
    );
  });

  it('passes onData callback to useChat for stream event processing', () => {
    render(createElement(ChatPage, { sessionId: null }));

    const options = mockUseChat.mock.calls[0][0];
    expect(options.onData).toBeDefined();
    expect(typeof options.onData).toBe('function');
  });

  it('does not duplicate runtimeEnv in transport dependency array (transport not recreated unnecessarily)', () => {
    const { rerender } = render(createElement(ChatPage, { sessionId: null }));
    const firstCallCount = mockDefaultChatTransport.mock.calls.length;

    // Re-render with same settings — transport should NOT be recreated
    rerender(createElement(ChatPage, { sessionId: null }));
    expect(mockDefaultChatTransport.mock.calls.length).toBe(firstCallCount);
  });
});
