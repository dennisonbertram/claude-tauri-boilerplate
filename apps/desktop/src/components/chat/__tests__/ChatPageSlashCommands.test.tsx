import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

const mockSendMessage = vi.fn();
const mockSetMessages = vi.fn();
const mockClearError = vi.fn();
const mockHandleCommandSelect = vi.fn();

let useChatReturn: Record<string, unknown> = {};

vi.mock('@ai-sdk/react', () => ({
  useChat: () => useChatReturn,
}));

vi.mock('ai', () => ({
  DefaultChatTransport: vi.fn(),
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
      permissionMode: 'default',
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

const mockUseStreamEvents = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useStreamEvents', () => ({
  useStreamEvents: () => mockUseStreamEvents(),
}));

vi.mock('@/hooks/useCommands', () => ({
  useCommands: () => ({
    commands: [
      { name: 'clear', description: 'Clear current chat', category: 'chat', execute: vi.fn() },
      { name: 'compact', description: 'Compact conversation context', category: 'chat', execute: vi.fn() },
      { name: 'restart', description: 'Restart the session', category: 'chat', execute: vi.fn() },
      { name: 'add-dir', description: 'Attach a directory', category: 'tools', execute: vi.fn() },
      { name: 'browser', description: 'Test the app with browser tooling', category: 'tools', execute: vi.fn() },
    ],
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
    handleCommandSelect: mockHandleCommandSelect,
  }),
}));

vi.mock('@/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: () => ({ shortcuts: [] }),
  isMacPlatform: () => false,
  formatShortcut: () => '',
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

function getDefaultStreamEventsState(overrides: Record<string, unknown> = {}) {
  return {
    toolCalls: new Map(),
    thinkingBlocks: new Map(),
    pendingPermissions: new Map(),
    resolvePermission: vi.fn(),
    plan: null,
    approvePlan: vi.fn(),
    rejectPlan: vi.fn(),
    usage: null,
    sessionInfo: null,
    processEvent: vi.fn(),
    reset: vi.fn(),
    cumulativeUsage: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    },
    isCompacting: false,
    ...overrides,
  };
}

describe('ChatPage - slash command validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupUseChat();
    mockUseStreamEvents.mockReturnValue(getDefaultStreamEventsState());
  });

  it('renders an in-chat error message for invalid slash commands', async () => {
    const user = userEvent.setup();
    render(<ChatPage sessionId={null} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, '/does-not-exist');
    await user.keyboard('{Enter}');

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(mockSetMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
        }),
      ])
    );
  });

  it('allows known server slash commands (e.g. plugin-installed) to be sent to the backend', async () => {
    const user = userEvent.setup();
    mockUseStreamEvents.mockReturnValue(
      getDefaultStreamEventsState({
        sessionInfo: {
          sessionId: 'sdk-session-1',
          model: 'claude-opus-4-6',
          tools: [],
          mcpServers: [],
          claudeCodeVersion: '0.0.0',
          slashCommands: ['plugin-cmd'],
        },
      })
    );

    render(<ChatPage sessionId={null} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, '/plugin-cmd');
    await user.keyboard('{Enter}');

    expect(mockSendMessage).toHaveBeenCalled();
  });

  it('routes /browser to the local workflow command instead of the backend', async () => {
    const user = userEvent.setup();
    render(<ChatPage sessionId={null} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, '/browser check the settings page');
    await user.keyboard('{Enter}');

    expect(mockSendMessage).toHaveBeenCalledOnce();
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Target URL: http://localhost:1420'),
      })
    );
    expect(mockSetMessages).not.toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
        }),
      ])
    );
    expect(mockHandleCommandSelect).not.toHaveBeenCalled();
  });
});
