import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock hooks used by ChatPage so we only validate transport payload shape.
const {
  mockUseChat,
  mockUseSettings,
  mockDefaultChatTransport,
  mockUseStreamEvents,
  mockPromptMemoryUpdate,
  mockUseWorkspaceDiff,
  mockMessageList,
} = vi.hoisted(() => ({
  mockUseChat: vi.fn(),
  mockUseSettings: vi.fn(),
  mockDefaultChatTransport: vi.fn(),
  mockUseStreamEvents: vi.fn(),
  mockPromptMemoryUpdate: vi.fn(),
  mockUseWorkspaceDiff: vi.fn(),
  mockMessageList: vi.fn(),
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

// Avoid rendering deep UI by stubbing presentation components.
vi.mock('@/components/chat/MessageList', () => ({
  MessageList: (props: unknown) => {
    mockMessageList(props);
    return null;
  },
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
  PlanView: ({
    onApprove,
    onReject,
    onExportToNewChat,
  }: {
    onApprove: () => void;
    onReject: (feedback?: string) => void;
    onExportToNewChat: () => void;
  }) => (
    <div>
      <button data-testid="plan-approve" onClick={() => void onApprove()}>
        Approve
      </button>
      <button data-testid="plan-reject" onClick={() => void onReject('Needs more detail')}>
        Reject
      </button>
      <button
        data-testid="plan-export"
        onClick={() => void onExportToNewChat()}
      >
        Export
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
    mockUseWorkspaceDiff.mockReturnValue({
      diff: '',
      changedFiles: [],
      fetchDiff: vi.fn(),
    });
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
        providerConfig: expect.objectContaining({
          bedrockBaseUrl: 'https://bedrock.internal',
          bedrockProjectId: '',
        }),
      }),
    });
  });

  it('sends workspace additional directories to the backend when provided', () => {
    render(
      <ChatPage
        sessionId={null}
        workspaceId="workspace-1"
        additionalDirectories={['/repo-a', '/repo-b']}
      />
    );

    const call = mockDefaultChatTransport.mock.calls.at(-1)?.[0];
    expect(call).toMatchObject({
      body: expect.objectContaining({
        workspaceId: 'workspace-1',
        additionalDirectories: ['/repo-a', '/repo-b'],
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
        providerConfig: expect.objectContaining({
          vertexProjectId: 'test-vertex-project',
          vertexBaseUrl: 'https://vertex.internal',
        }),
      }),
    });
  });

  it('includes the global system prompt in the chat transport payload', () => {
    mockUseSettings.mockReturnValue({
      settings: getDefaultSettings({
        systemPrompt: 'Always produce release notes.',
      }),
      updateSettings: vi.fn(),
      resetSettings: vi.fn(),
    });

    render(<ChatPage sessionId={null} />);

    const call = mockDefaultChatTransport.mock.calls.at(-1)?.[0];
    expect(call).toMatchObject({
      body: expect.objectContaining({
        systemPrompt: 'Always produce release notes.',
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
        providerConfig: expect.objectContaining({
          customBaseUrl: 'https://custom.internal',
        }),
      }),
    });
  });

  it('sends runtimeEnv in transport body for runtime environment variables', () => {
    mockUseSettings.mockReturnValue({
      settings: getDefaultSettings({
        runtimeEnv: {
          TOOL_TOKEN: 'token-123',
          FEATURE_FLAG: 'on',
        },
      }),
      updateSettings: vi.fn(),
      resetSettings: vi.fn(),
    });

    render(<ChatPage sessionId={null} />);

    const call = mockDefaultChatTransport.mock.calls.at(-1)?.[0];
    expect(call).toMatchObject({
      body: expect.objectContaining({
        runtimeEnv: {
          TOOL_TOKEN: 'token-123',
          FEATURE_FLAG: 'on',
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

    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>().mockResolvedValue({ ok: false, json: async () => [] } as unknown as Response);
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
    expect(mockPromptMemoryUpdate).not.toHaveBeenCalled();
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

    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>().mockResolvedValue({ ok: false, json: async () => [] } as unknown as Response);
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

  it('prompts to update memory when review feedback is submitted', async () => {
    const rejectPlan = vi.fn();
    const onOpenSettings = vi.fn();
    mockUseStreamEvents.mockReturnValue(
      getDefaultStreamEventsState({
        plan: {
          planId: 'plan-memory',
          status: 'review',
          content: 'Plan content',
        },
        rejectPlan,
      })
    );

    const fetchMock = vi.fn(async () => ({ ok: false, json: async () => [] }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    render(<ChatPage sessionId="session-memory" onOpenSettings={onOpenSettings} />);
    fireEvent.click(screen.getByTestId('plan-reject'));

    await waitFor(() => {
      expect(mockPromptMemoryUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: 'review-feedback',
          onOpenMemory: expect.any(Function),
        })
      );
    });

    const args = mockPromptMemoryUpdate.mock.calls.at(-1)?.[0] as {
      onOpenMemory?: () => void;
    };
    args.onOpenMemory?.();

    expect(onOpenSettings).toHaveBeenCalledWith('memory');
    expect(rejectPlan).toHaveBeenCalledWith('plan-memory', 'Needs more detail');
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

  it('archives reviewable plans into .context via the plan route', async () => {
    mockUseStreamEvents.mockReturnValue(
      getDefaultStreamEventsState({
        plan: {
          planId: 'plan-archive',
          status: 'review',
          content: 'Archive this plan',
        },
      })
    );

    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith('/api/chat/plan/archive')) {
        return {
          ok: true,
          json: async () => ({ path: '/repo/.context/plans/plan-archive.md' }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    render(<ChatPage sessionId="session-archive" />);

    await waitFor(() => {
      const archiveCall = fetchMock.mock.calls.find(([url]) =>
        String(url).endsWith('/api/chat/plan/archive')
      );
      expect(archiveCall).toBeDefined();
    });
  });

  it('exports the current plan into a new chat draft', async () => {
    const onCreateSession = vi.fn();
    mockUseStreamEvents.mockReturnValue(
      getDefaultStreamEventsState({
        plan: {
          planId: 'plan-export',
          status: 'review',
          content: 'Implement this plan in the next chat',
        },
      })
    );

    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith('/api/chat/plan/archive')) {
        return {
          ok: true,
          json: async () => ({ path: '/repo/.context/plans/plan-export.md' }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    render(<ChatPage sessionId="session-export" onCreateSession={onCreateSession} />);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).endsWith('/api/chat/plan/archive')
        )
      ).toBe(true);
    });

    fireEvent.click(screen.getByTestId('plan-export'));

    expect(onCreateSession).toHaveBeenCalledOnce();
    expect(window.sessionStorage.getItem('claude-tauri-plan-export-draft')).toContain(
      'Implement this approved plan'
    );
  });
  it('forces effort=low when fastMode is enabled', async () => {
    mockUseSettings.mockReturnValue({
      settings: getDefaultSettings({
        effort: 'high',
        fastMode: true,
      }),
      updateSettings: vi.fn(),
      resetSettings: vi.fn(),
    });

    render(<ChatPage sessionId={null} />);

    await waitFor(() => {
      expect(mockDefaultChatTransport).toHaveBeenCalledTimes(1);
    });
    const call = mockDefaultChatTransport.mock.calls.at(-1)?.[0];
    expect(call).toMatchObject({
      body: expect.objectContaining({
        effort: 'low',
      }),
    });
  });

  it('includes thinking budget tokens in the chat transport payload', async () => {
    mockUseSettings.mockReturnValue({
      settings: getDefaultSettings({
        thinkingBudgetTokens: 24000,
      }),
      updateSettings: vi.fn(),
      resetSettings: vi.fn(),
    });

    render(<ChatPage sessionId={null} />);

    await waitFor(() => {
      expect(mockDefaultChatTransport).toHaveBeenCalledTimes(1);
    });
    const call = mockDefaultChatTransport.mock.calls.at(-1)?.[0];
    expect(call).toMatchObject({
      body: expect.objectContaining({
        thinkingBudgetTokens: 24000,
      }),
    });
  });
});
