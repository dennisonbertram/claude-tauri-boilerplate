import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock hooks used by ChatPage so we only validate transport payload shape.
const mockUseChat = vi.hoisted(() => vi.fn());
const mockUseSettings = vi.hoisted(() => vi.fn());
const mockDefaultChatTransport = vi.hoisted(() => vi.fn());
const mockUseStreamEvents = vi.hoisted(() => vi.fn());

vi.mock('@ai-sdk/react', () => ({
  useChat: mockUseChat,
}));

vi.mock('ai', () => ({
  DefaultChatTransport: mockDefaultChatTransport,
}));

vi.mock('@/hooks/useSettings', () => ({
  useSettings: mockUseSettings,
}));

vi.mock('@/hooks/useStreamEvents', () => ({
  useStreamEvents: mockUseStreamEvents,
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

// Avoid rendering deep UI by stubbing presentation components.
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
  PlanView: ({ onApprove, onReject }: { onApprove: () => void; onReject: (feedback?: string) => void }) => (
    <div>
      <button data-testid="plan-approve" onClick={() => void onApprove()}>
        Approve
      </button>
      <button data-testid="plan-reject" onClick={() => void onReject('Needs more detail')}>
        Reject
      </button>
    </div>
  ),
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

import { ChatPage } from '../ChatPage';

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
    permissionMode: 'default',
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

describe('ChatPage transport provider payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
    mockUseChat.mockReturnValue({
      messages: [],
      sendMessage: vi.fn(),
      status: 'ready',
      setMessages: vi.fn(),
      error: undefined,
      clearError: vi.fn(),
    });
    mockUseSettings.mockReturnValue({
      settings: getDefaultSettings(),
      updateSettings: vi.fn(),
      resetSettings: vi.fn(),
    });
    mockUseStreamEvents.mockReturnValue(getDefaultStreamEventsState());
  });

  it('sends provider and providerConfig for bedrock settings', () => {
    mockUseSettings.mockReturnValue({
      settings: getDefaultSettings({
        provider: 'bedrock',
        bedrockBaseUrl: 'https://bedrock.internal',
      }),
      updateSettings: vi.fn(),
      resetSettings: vi.fn(),
    });

    render(<ChatPage sessionId={null} />);

    expect(mockDefaultChatTransport).toHaveBeenCalledTimes(1);
    const call = mockDefaultChatTransport.mock.calls.at(-1)?.[0];
    expect(call).toMatchObject({
      api: 'http://localhost:3131/api/chat',
      body: expect.objectContaining({
        provider: 'bedrock',
        providerConfig: {
          bedrockBaseUrl: 'https://bedrock.internal',
          bedrockProjectId: '',
          vertexProjectId: '',
          vertexBaseUrl: '',
          customBaseUrl: '',
        },
      }),
    });
  });

  it('sends provider and providerConfig for vertex settings', () => {
    mockUseSettings.mockReturnValue({
      settings: getDefaultSettings({
        provider: 'vertex',
        vertexProjectId: 'test-vertex-project',
        vertexBaseUrl: 'https://vertex.internal',
      }),
      updateSettings: vi.fn(),
      resetSettings: vi.fn(),
    });

    render(<ChatPage sessionId={null} />);

    expect(mockDefaultChatTransport).toHaveBeenCalledTimes(1);
    const call = mockDefaultChatTransport.mock.calls.at(-1)?.[0];
    expect(call).toMatchObject({
      body: expect.objectContaining({
        provider: 'vertex',
        providerConfig: {
          bedrockBaseUrl: '',
          bedrockProjectId: '',
          vertexProjectId: 'test-vertex-project',
          vertexBaseUrl: 'https://vertex.internal',
          customBaseUrl: '',
        },
      }),
    });
  });

  it('sends provider and providerConfig for custom settings', () => {
    mockUseSettings.mockReturnValue({
      settings: getDefaultSettings({
        provider: 'custom',
        customBaseUrl: 'https://custom.internal',
      }),
      updateSettings: vi.fn(),
      resetSettings: vi.fn(),
    });

    render(<ChatPage sessionId='session-1' />);

    expect(mockDefaultChatTransport).toHaveBeenCalledTimes(1);
    const call = mockDefaultChatTransport.mock.calls.at(-1)?.[0];
    expect(call).toMatchObject({
      body: expect.objectContaining({
        provider: 'custom',
        providerConfig: {
          bedrockBaseUrl: '',
          bedrockProjectId: '',
          vertexProjectId: '',
          vertexBaseUrl: '',
          customBaseUrl: 'https://custom.internal',
        },
      }),
    });
  });

  it('includes permissionMode in transport body when set to plan', () => {
    mockUseSettings.mockReturnValue({
      settings: getDefaultSettings({
        permissionMode: 'plan',
      }),
      updateSettings: vi.fn(),
      resetSettings: vi.fn(),
    });

    render(<ChatPage sessionId={null} />);

    const call = mockDefaultChatTransport.mock.calls.at(-1)?.[0];
    expect(call).toMatchObject({
      body: expect.objectContaining({
        permissionMode: 'plan',
      }),
    });
  });

  it('sends approve decision to /api/chat/plan and updates local plan state', async () => {
    const approvePlan = vi.fn();
    mockUseStreamEvents.mockReturnValue(
      getDefaultStreamEventsState({
        plan: {
          planId: 'plan-123',
          status: 'review',
          content: 'Plan content',
        },
        approvePlan,
      })
    );

    const fetchMock = vi.fn(async () => ({ ok: false, json: async () => [] }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    render(<ChatPage sessionId="session-1" />);
    fireEvent.click(screen.getByTestId('plan-approve'));

    await waitFor(() => {
      const planCall = fetchMock.mock.calls.find(([url]) =>
        String(url).endsWith('/api/chat/plan')
      );
      expect(planCall).toBeDefined();
    });

    const planCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/api/chat/plan')
    );
    const requestInit = planCall?.[1] as RequestInit;

    expect(approvePlan).toHaveBeenCalledWith('plan-123');
    expect(requestInit.method).toBe('POST');
    expect(JSON.parse(requestInit.body as string)).toEqual({
      sessionId: 'session-1',
      planId: 'plan-123',
      decision: 'approve',
    });
  });

  it('sends reject decision to /api/chat/plan with feedback', async () => {
    const rejectPlan = vi.fn();
    mockUseStreamEvents.mockReturnValue(
      getDefaultStreamEventsState({
        plan: {
          planId: 'plan-456',
          status: 'review',
          content: 'Plan content',
        },
        rejectPlan,
      })
    );

    const fetchMock = vi.fn(async () => ({ ok: false, json: async () => [] }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    render(<ChatPage sessionId="session-2" />);
    fireEvent.click(screen.getByTestId('plan-reject'));

    await waitFor(() => {
      const planCall = fetchMock.mock.calls.find(([url]) =>
        String(url).endsWith('/api/chat/plan')
      );
      expect(planCall).toBeDefined();
    });

    const planCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/api/chat/plan')
    );
    const requestInit = planCall?.[1] as RequestInit;

    expect(rejectPlan).toHaveBeenCalledWith('plan-456', 'Needs more detail');
    expect(requestInit.method).toBe('POST');
    expect(JSON.parse(requestInit.body as string)).toEqual({
      sessionId: 'session-2',
      planId: 'plan-456',
      decision: 'reject',
      feedback: 'Needs more detail',
    });
  });

  it('includes linearIssue in transport body when deep link hash targets an issue', async () => {
    window.location.hash = '#linear/issue/ENG-123';

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(typeof input === 'string' ? input : input?.url ?? '');
        if (url.includes('/api/linear/issues/ENG-123')) {
          return {
            ok: true,
            json: async () => ({
              id: 'ENG-123',
              title: 'Deep link issue',
              summary: 'Summary',
              url: 'https://linear.app/org/issue/ENG-123/deep-link-issue',
            }),
          } as any;
        }
        return { ok: false, json: async () => ({}) } as any;
      }) as any
    );

    render(<ChatPage sessionId={null} />);

    await waitFor(() => {
      expect(mockDefaultChatTransport).toHaveBeenCalledTimes(2);
    });

    const secondCall = mockDefaultChatTransport.mock.calls.at(-1)?.[0];
    expect(secondCall?.body?.linearIssue).toMatchObject({
      id: 'ENG-123',
      title: 'Deep link issue',
      summary: 'Summary',
      url: 'https://linear.app/org/issue/ENG-123/deep-link-issue',
    });
  });
});
