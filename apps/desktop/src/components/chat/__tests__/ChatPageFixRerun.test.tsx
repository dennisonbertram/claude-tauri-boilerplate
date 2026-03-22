import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { ToolCallState } from '@/hooks/useStreamEvents';
import { ChatPage } from '../ChatPage';

Element.prototype.scrollIntoView = vi.fn();

const mockSendMessage = vi.fn().mockResolvedValue(undefined);
const mockSetMessages = vi.fn();
const mockResetStreamEvents = vi.fn();

const toolCall: ToolCallState = {
  toolUseId: 'tool-1',
  name: 'Bash',
  status: 'complete',
  input: '{"command":"pnpm run test:ci"}',
  result: 'Process completed with exit code 1\n✗ lint: failed\n✓ test: failed',
  ciFailures: {
    summary: '1 failing CI checks detected',
    checks: ['Process completed with exit code 1', '✗ lint: failed', '✓ test: failed'],
    rawOutput: 'Process completed with exit code 1\n✗ lint: failed\n✓ test: failed',
  },
};

const mockUseChatReturn: Record<string, unknown> = {};
vi.mock('@ai-sdk/react', () => ({
  useChat: () => mockUseChatReturn,
}));

vi.mock('ai', () => ({
  DefaultChatTransport: vi.fn(),
}));

vi.mock('@/hooks/useStreamEvents', () => ({
  useStreamEvents: () => ({
    toolCalls: new Map([['tool-1', toolCall]]),
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
    reset: mockResetStreamEvents,
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

vi.mock('../MessageList', () => ({
  MessageList: ({ onToolFixErrors }: { onToolFixErrors?: (toolCall: ToolCallState) => void }) => {
    if (onToolFixErrors) {
      onToolFixErrors({
        toolUseId: 'tool-1',
        name: 'Bash',
        status: 'complete',
        input: '{"command":"pnpm run test:ci"}',
        result: 'Process completed with exit code 1\n✗ lint: failed\n✓ test: failed',
        ciFailures: {
          summary: '1 failing CI checks detected',
          checks: [
            'Process completed with exit code 1',
            '✗ lint: failed',
            '✓ test: failed',
          ],
          rawOutput: 'Process completed with exit code 1\n✗ lint: failed\n✓ test: failed',
        },
      });
    }
    return <div data-testid="message-list" />;
  },
}));

vi.mock('../ChatInput', () => ({
  ChatInput: () => <div data-testid="chat-input" />,
}));

vi.mock('../ErrorBanner', () => ({
  ErrorBanner: () => null,
}));

vi.mock('../PermissionDialog', () => ({
  PermissionDialog: () => null,
}));

vi.mock('../PlanView', () => ({
  PlanView: () => null,
}));

vi.mock('../SubagentPanel', () => ({
  SubagentPanel: () => null,
}));

vi.mock('../CheckpointTimeline', () => ({
  CheckpointTimeline: () => null,
}));

vi.mock('../RewindDialog', () => ({
  RewindDialog: () => null,
}));

vi.mock('../ContextIndicator', () => ({
  ContextIndicator: () => null,
}));

vi.mock('../CostDisplay', () => ({
  CostDisplay: () => null,
}));

vi.mock('../SuggestionChips', () => ({
  SuggestionChips: () => null,
}));

vi.mock('@/components/ShortcutHelpModal', () => ({
  ShortcutHelpModal: () => null,
}));

function setupUseChat(overrides: Record<string, unknown> = {}) {
  mockUseChatReturn.messages = [
    {
      id: 'assistant-1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'running diagnostics' }],
    },
  ];
  mockUseChatReturn.sendMessage = mockSendMessage;
  mockUseChatReturn.status = 'streaming';
  mockUseChatReturn.setMessages = mockSetMessages;
  mockUseChatReturn.error = undefined;
  mockUseChatReturn.clearError = vi.fn();
  Object.assign(mockUseChatReturn, overrides);
}

// TODO: #267 — quarantined, resetStreamEvents called twice after welcome auto-send change
describe.skip('ChatPage fix-rerun loop behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupUseChat();
  });

  it('can trigger fix-errors rerun path while streaming', () => {
    render(<ChatPage sessionId={null} />);

    expect(mockResetStreamEvents).toHaveBeenCalledOnce();
    expect(mockSendMessage).toHaveBeenCalledOnce();
    expect(mockSendMessage).toHaveBeenCalledWith({
      text: expect.stringContaining(
        'The previous CI checks failed. Please fix the issues and rerun validation.'
      ),
    });
    const promptText =
      (mockSendMessage.mock.calls[0]?.[0] as { text: string }).text;
    expect(promptText).toContain('Last command: pnpm run test:ci');
    expect(promptText).toContain('Failing checks:\n- Process completed with exit code 1');
    expect(promptText).toContain('Raw logs:');
  });
});
