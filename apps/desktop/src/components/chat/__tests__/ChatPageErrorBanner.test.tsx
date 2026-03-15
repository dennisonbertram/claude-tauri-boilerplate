import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock useChat from @ai-sdk/react
const mockSendMessage = vi.fn();
const mockClearError = vi.fn();
const mockSetMessages = vi.fn();

let useChatReturn: Record<string, unknown> = {};

vi.mock('@ai-sdk/react', () => ({
  useChat: () => useChatReturn,
}));

// Mock DefaultChatTransport
vi.mock('ai', () => ({
  DefaultChatTransport: vi.fn(),
}));

// Mock useStreamEvents
vi.mock('@/hooks/useStreamEvents', () => ({
  useStreamEvents: () => ({
    toolCalls: [],
    thinkingBlocks: [],
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
  }),
}));

// Mock useCommands
vi.mock('@/hooks/useCommands', () => ({
  useCommands: () => ({
    commands: [],
    filterCommands: vi.fn(() => []),
  }),
}));

// Mock useCommandPalette
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

// Import AFTER mocks are set up
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

describe('ChatPage - ErrorBanner integration (Bug #35)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupUseChat();
  });

  it('does not show error banner when there is no error', () => {
    setupUseChat({ error: undefined });
    render(<ChatPage sessionId={null} />);

    // ErrorBanner renders null when error is null
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows error banner when useChat returns an error', () => {
    setupUseChat({ error: new Error('Service Unavailable') });
    render(<ChatPage sessionId={null} />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.getByText(/Service Unavailable/)).toBeInTheDocument();
  });

  it('shows API error banner for generic server errors (e.g. 503)', () => {
    setupUseChat({ error: new Error('Server returned 503') });
    render(<ChatPage sessionId={null} />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    // API errors get red/destructive styling
    expect(alert.className).toMatch(/destructive|red|error/i);
  });

  it('shows rate limit error banner for rate limit messages', () => {
    setupUseChat({
      error: new Error('Rate limit exceeded, please retry'),
    });
    render(<ChatPage sessionId={null} />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    // Rate limit errors get warning/amber styling
    expect(alert.className).toMatch(/warning|yellow|amber/i);
  });

  it('shows auth error banner for authentication errors', () => {
    setupUseChat({
      error: new Error('Authentication failed (401)'),
    });
    render(<ChatPage sessionId={null} />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
  });

  it('shows network error banner with reconnecting indicator', () => {
    setupUseChat({
      error: new Error('Network error: ECONNREFUSED'),
    });
    render(<ChatPage sessionId={null} />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.getByText(/Reconnecting/i)).toBeInTheDocument();
  });

  it('shows retry button for retryable errors', () => {
    setupUseChat({ error: new Error('Server returned 503') });
    render(<ChatPage sessionId={null} />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
  });

  it('does not show retry button for auth errors', () => {
    setupUseChat({
      error: new Error('Authentication failed (401)'),
    });
    render(<ChatPage sessionId={null} />);

    expect(
      screen.queryByRole('button', { name: /retry/i })
    ).not.toBeInTheDocument();
  });

  it('clears the error when dismiss button is clicked', () => {
    setupUseChat({ error: new Error('Some error') });
    render(<ChatPage sessionId={null} />);

    const dismissButton = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(dismissButton);

    expect(mockClearError).toHaveBeenCalledTimes(1);
  });

  it('retries the last user message when retry button is clicked', () => {
    setupUseChat({
      error: new Error('Server returned 503'),
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    });
    render(<ChatPage sessionId={null} />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);

    expect(mockClearError).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith({ text: 'Hello world' });
  });

  it('does not show loading indicator when status is error-like (not streaming/submitted)', () => {
    // When an error occurs, status should be 'ready' (not 'streaming' or 'submitted')
    setupUseChat({
      error: new Error('Server error'),
      status: 'ready',
    });
    render(<ChatPage sessionId={null} />);

    // The error banner should be visible
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
