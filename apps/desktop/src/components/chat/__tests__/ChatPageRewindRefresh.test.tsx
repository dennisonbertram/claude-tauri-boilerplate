import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Message, Checkpoint } from '@claude-tauri/shared';
import { ChatPage } from '../ChatPage';

Element.prototype.scrollIntoView = vi.fn();

const mockSetMessages = vi.fn();
const mockSendMessage = vi.fn();

let useChatReturn: Record<string, unknown> = {};

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

const executeRewind = vi.fn(async () => true);
const previewRewind = vi.fn(async () => ({
  checkpointId: 'cp-1',
  filesAffected: [],
  messagesRemoved: 2,
}));

vi.mock('@/hooks/useCheckpoints', () => ({
  useCheckpoints: () => ({
    checkpoints: [
      {
        id: 'cp-1',
        userMessageId: 'msg-1',
        promptPreview: 'Do a thing',
        timestamp: new Date().toISOString(),
        filesChanged: [],
        turnIndex: 0,
        gitCommit: null,
        messageCount: 2,
      } satisfies Checkpoint,
    ],
    previewRewind,
    executeRewind,
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
      permissionMode: 'normal',
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
  CheckpointTimeline: ({ checkpoints, onRewind }: any) => (
    <button
      data-testid="mock-open-rewind"
      onClick={() => onRewind(checkpoints[0].id)}
    >
      Open Rewind
    </button>
  ),
}));

vi.mock('@/components/chat/RewindDialog', () => ({
  RewindDialog: ({ onRewind }: any) => (
    <button data-testid="mock-confirm-rewind" onClick={() => onRewind('conversation_only')}>
      Confirm
    </button>
  ),
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

describe('ChatPage rewind refresh', () => {
  beforeEach(() => {
    mockSetMessages.mockReset();
    mockSendMessage.mockReset();
    executeRewind.mockClear();
    previewRewind.mockClear();

    useChatReturn = {
      messages: [],
      sendMessage: mockSendMessage,
      status: 'ready',
      setMessages: mockSetMessages,
      error: undefined,
      clearError: vi.fn(),
    };
  });

  it('reloads session messages after confirming a rewind', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/sessions/s1/messages')) {
        const callIndex = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/sessions/s1/messages')).length;
        const payload: Message[] =
          callIndex === 1
            ? [
                { id: 'm1', role: 'user', content: 'before' } as any,
                { id: 'm2', role: 'assistant', content: 'before' } as any,
              ]
            : [{ id: 'm1', role: 'user', content: 'after' } as any];
        return { ok: true, json: async () => payload } as any;
      }

      return { ok: true, json: async () => [] } as any;
    });

    vi.stubGlobal('fetch', fetchMock as any);

    render(<ChatPage sessionId="s1" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/sessions/s1/messages')
      );
    });

    fireEvent.click(screen.getByTestId('mock-open-rewind'));
    fireEvent.click(screen.getByTestId('mock-confirm-rewind'));

    await waitFor(() => {
      const messageFetchCalls = fetchMock.mock.calls.filter((c) =>
        String(c[0]).includes('/api/sessions/s1/messages')
      );
      expect(messageFetchCalls.length).toBe(2);
    });

    expect(executeRewind).toHaveBeenCalledWith('cp-1', 'conversation_only');
  });
});

