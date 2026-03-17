import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

Element.prototype.scrollIntoView = vi.fn();

const mockSendMessage = vi.fn();
const mockSetMessages = vi.fn();
const mockClearError = vi.fn();

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

vi.mock('../MessageList', () => ({
  MessageList: () => <div data-testid="message-list" />,
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

import { ChatPage } from '../ChatPage';

function setupUseChat(overrides: Partial<typeof useChatReturn> = {}) {
  useChatReturn = {
    messages: [],
    sendMessage: mockSendMessage,
    status: 'ready',
    setMessages: mockSetMessages,
    error: undefined,
    clearError: mockClearError,
    ...overrides,
  };
}

describe('ChatPage keyboard shortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupUseChat();
  });

  it('opens Settings when Cmd+, is pressed', () => {
    const onOpenSettings = vi.fn();

    render(<ChatPage sessionId={null} onOpenSettings={onOpenSettings} />);

    fireEvent.keyDown(window, { key: ',', metaKey: true });

    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it('lists Open Settings in the help modal shortcut registry', () => {
    render(<ChatPage sessionId={null} onOpenSettings={vi.fn()} />);

    fireEvent.keyDown(window, { key: '?', metaKey: true, shiftKey: true });

    expect(screen.getByRole('dialog', { name: 'Keyboard Shortcuts' })).toBeInTheDocument();
    expect(screen.getByText('Open Settings')).toBeInTheDocument();
  });
});
