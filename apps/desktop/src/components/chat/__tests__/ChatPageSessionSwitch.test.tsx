import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { Message } from '@claude-tauri/shared';
import { ChatPage } from '../ChatPage';

Element.prototype.scrollIntoView = vi.fn();

const mockSetMessages = vi.fn();
const mockSendMessage = vi.fn();
const mockResetStreamEvents = vi.fn();
const mockClearError = vi.fn();

let setPendingSessionMessages: ((value: Message[]) => void) | null = null;
let useChatReturn: Record<string, unknown> = {};

const pendingSessionPayload = [{ id: 'pending-db-msg', role: 'user', content: 'pending' } as Message];

vi.mock('@ai-sdk/react', () => ({
  useChat: () => useChatReturn,
}));

vi.mock('ai', () => ({
  DefaultChatTransport: vi.fn(),
}));

vi.mock('@/hooks/useStreamEvents', () => ({
  useStreamEvents: () => ({
    toolCalls: new Map(),
    thinkingBlocks: new Map(),
    pendingPermissions: new Map(),
    resolvePermission: vi.fn(),
    plan: null,
    approvePlan: vi.fn(),
    rejectPlan: vi.fn(),
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
    reset: vi.fn(),
  }),
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

vi.mock('@/hooks/useWorkspaceDiff', () => ({
  useWorkspaceDiff: () => ({
    changedFiles: [],
    fetchDiff: vi.fn(),
  }),
}));

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({
    settings: {
      model: 'claude-sonnet-4-6',
      effort: 'medium',
      provider: 'anthropic',
      bedrockBaseUrl: '',
      bedrockProjectId: '',
      vertexProjectId: '',
      vertexBaseUrl: '',
      customBaseUrl: '',
    },
  }),
}));

vi.mock('@/hooks/useCostTracking', () => ({
  useCostTracking: () => ({
    messageCosts: [],
    sessionTotalCost: 0,
    addMessageCost: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCommands', () => ({
  useCommands: () => ({
    commands: [],
    filterCommands: vi.fn(() => []),
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

vi.mock('@/components/chat/MessageList', () => ({
  MessageList: () => null,
}));

vi.mock('@/components/chat/ChatInput', () => ({
  ChatInput: () => null,
}));

vi.mock('@/components/chat/ErrorBanner', () => ({
  ErrorBanner: () => null,
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

vi.mock('@/components/chat/CostDisplay', () => ({
  CostDisplay: () => null,
}));

vi.mock('@/components/chat/SuggestionChips', () => ({
  SuggestionChips: () => null,
}));

vi.mock('@/components/ShortcutHelpModal', () => ({
  ShortcutHelpModal: () => null,
}));

const makeJsonResponse = (messages: Message[]) => ({
  ok: true,
  json: async () => messages,
});

vi.stubGlobal(
  'fetch',
  vi.fn(async (url: string) => {
    if (url.includes('/api/sessions/session-with-messages/messages')) {
      return makeJsonResponse([
        {
          id: 'server-old-msg',
          role: 'assistant',
          content: 'Hello',
        } as Message,
      ]);
    }

    if (url.includes('/api/sessions/new-empty-session/messages')) {
      return new Promise((resolve) => {
        setPendingSessionMessages = (value: Message[]) => {
          resolve(makeJsonResponse(value));
        };
      });
    }

    return makeJsonResponse([]);
  }) as any
);

function setupUseChat(overrides: Partial<typeof useChatReturn> = {}) {
  useChatReturn = {
    messages: [
      {
        id: 'ui-msg',
        role: 'assistant',
        parts: [{ type: 'text', text: 'temporary' }],
      },
    ],
    sendMessage: mockSendMessage,
    status: 'ready',
    setMessages: mockSetMessages,
    error: undefined,
    clearError: mockClearError,
    resetStreamEvents: mockResetStreamEvents,
    ...overrides,
  };
}

describe('ChatPage session switch clear behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setPendingSessionMessages = null;
    setupUseChat();
  });

  it('clears local message state immediately when switching into an empty session', async () => {
    const { rerender } = render(<ChatPage sessionId="session-with-messages" />);

    await waitFor(() =>
      expect(mockSetMessages).toHaveBeenLastCalledWith([
        {
          id: 'server-old-msg',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Hello' }],
        },
      ])
    );

    const callsAfterFirstLoad = mockSetMessages.mock.calls.length;

    rerender(<ChatPage sessionId="new-empty-session" />);

    await Promise.resolve();
    expect(mockSetMessages).toHaveBeenCalledTimes(callsAfterFirstLoad + 1);
    expect(mockSetMessages).toHaveBeenLastCalledWith([]);

    setPendingSessionMessages?.(pendingSessionPayload);
    await waitFor(() =>
      expect(mockSetMessages).toHaveBeenLastCalledWith([])
    );
  });
});
