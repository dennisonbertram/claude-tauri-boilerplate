import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { UIMessage } from '@ai-sdk/react';
import { MessageList } from '../MessageList';

const mockUseSettings = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useSettings', () => ({
  useSettings: mockUseSettings,
}));

Element.prototype.scrollIntoView = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  mockUseSettings.mockReturnValue({
    settings: {
      chatFont: 'proportional',
      chatDensity: 'comfortable',
      chatWidth: 'standard',
    },
  });
  vi.stubGlobal(
    'requestAnimationFrame',
    ((callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 0)) as typeof requestAnimationFrame
  );
  vi.stubGlobal(
    'cancelAnimationFrame',
    ((id: number) => window.clearTimeout(id)) as typeof cancelAnimationFrame
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: vi.fn(),
    },
  });
});

function makeMessage(index: number): UIMessage {
  return {
    id: `message-${index}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    parts: [{ type: 'text', text: `message ${index}` }],
  };
}

function getViewport(container: HTMLElement): HTMLDivElement {
  const viewport = container.querySelector(
    '[data-slot="scroll-area-viewport"]'
  ) as HTMLDivElement | null;
  if (!viewport) {
    throw new Error('scroll area viewport not found');
  }
  return viewport;
}

function mockScrollableViewport(
  viewport: HTMLDivElement,
  options: { scrollHeight: number; clientHeight: number; scrollTop: number }
) {
  Object.defineProperty(viewport, 'scrollHeight', {
    configurable: true,
    value: options.scrollHeight,
    writable: true,
  });
  Object.defineProperty(viewport, 'clientHeight', {
    configurable: true,
    value: options.clientHeight,
    writable: true,
  });
  Object.defineProperty(viewport, 'scrollTop', {
    configurable: true,
    value: options.scrollTop,
    writable: true,
  });
}

describe('MessageList scroll affordance', () => {
  it('shows the scroll-to-bottom button when scrolled above the bottom', () => {
    const messages = Array.from({ length: 20 }, (_, index) =>
      makeMessage(index)
    );

    const { container } = render(
      <MessageList messages={messages} isLoading={false} />
    );
    const viewport = getViewport(container);

    mockScrollableViewport(viewport, {
      scrollHeight: 1200,
      clientHeight: 300,
      scrollTop: 0,
    });

    fireEvent.scroll(viewport);

    expect(screen.getByTestId('message-list-scroll-to-bottom')).toBeInTheDocument();
  });

  it('updates the affordance after viewport metrics settle on the next frame', async () => {
    const messages = Array.from({ length: 20 }, (_, index) =>
      makeMessage(index)
    );
    const { container } = render(
      <MessageList messages={messages} isLoading={false} />
    );
    const viewport = getViewport(container);

    mockScrollableViewport(viewport, {
      scrollHeight: 1200,
      clientHeight: 300,
      scrollTop: 0,
    });

    await act(async () => {
      vi.runAllTimers();
    });

    expect(
      screen.getByTestId('message-list-scroll-to-bottom')
    ).toBeInTheDocument();
  });

  it('scrolls to latest and hides when the affordance is clicked', async () => {
    const messages = Array.from({ length: 20 }, (_, index) =>
      makeMessage(index)
    );
    const { container } = render(
      <MessageList messages={messages} isLoading={false} />
    );
    const viewport = getViewport(container);
    const scrollTo = vi.fn();

    mockScrollableViewport(viewport, {
      scrollHeight: 1400,
      clientHeight: 350,
      scrollTop: 0,
    });
    Object.defineProperty(viewport, 'scrollTo', { value: scrollTo });

    fireEvent.scroll(viewport);
    expect(screen.getByTestId('message-list-scroll-to-bottom')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('message-list-scroll-to-bottom'));

    expect(scrollTo).toHaveBeenCalledOnce();
    expect(scrollTo).toHaveBeenCalledWith({
      top: 1400,
      behavior: 'smooth',
    });
    expect(
      screen.queryByTestId('message-list-scroll-to-bottom')
    ).not.toBeInTheDocument();
  });

  it('hides the button when the user scrolls to the bottom', () => {
    const messages = Array.from({ length: 20 }, (_, index) =>
      makeMessage(index)
    );
    const { container } = render(
      <MessageList messages={messages} isLoading={false} />
    );
    const viewport = getViewport(container);

    mockScrollableViewport(viewport, {
      scrollHeight: 1000,
      clientHeight: 300,
      scrollTop: 0,
    });

    fireEvent.scroll(viewport);
    expect(screen.getByTestId('message-list-scroll-to-bottom')).toBeInTheDocument();

    Object.defineProperty(viewport, 'scrollTop', {
      configurable: true,
      value: 700,
      writable: true,
    });
    fireEvent.scroll(viewport);

    expect(
      screen.queryByTestId('message-list-scroll-to-bottom')
    ).not.toBeInTheDocument();
  });
});

describe('MessageList appearance settings', () => {
  it('applies the selected chat density, width, and font controls', () => {
    mockUseSettings.mockReturnValue({
      settings: {
        chatFont: 'mono',
        monoFontFamily: 'courier',
        chatDensity: 'compact',
        chatWidth: 'wide',
      },
    });

    const messages = [
      {
        id: 'message-1',
        role: 'user',
        parts: [{ type: 'text', text: 'hello world' }],
      } as UIMessage,
      {
        id: 'message-2',
        role: 'assistant',
        parts: [{ type: 'text', text: 'reply' }],
      } as UIMessage,
    ];

    render(
      <MessageList messages={messages} isLoading={false} />
    );

    const content = screen.getByTestId('message-list-content');
    expect(content).toHaveClass('max-w-5xl');
    expect(content).toHaveClass('space-y-2');
    expect(content).toHaveClass('p-3');

    const bubbles = screen.getAllByTestId('message-bubble');
    expect(bubbles[0]).toHaveClass('font-mono');
    expect(bubbles[1]).toHaveClass('font-mono');
    expect(bubbles[0]).toHaveStyle({ fontFamily: 'var(--chat-mono-font)' });
    expect(bubbles[1]).toHaveStyle({ fontFamily: 'var(--chat-mono-font)' });
  });
});

describe('MessageList thinking visibility', () => {
  const streamingAssistantMessage: UIMessage = {
    id: 'assistant-1',
    role: 'assistant',
    parts: [{ type: 'text', text: 'Visible assistant text' }],
  };

  it('hides thinking blocks when showThinking is disabled', () => {
    mockUseSettings.mockReturnValue({
      settings: {
        chatFont: 'proportional',
        chatDensity: 'comfortable',
        chatWidth: 'standard',
        showThinking: false,
      },
    });

    render(
      <MessageList
        messages={[streamingAssistantMessage]}
        isLoading
        thinkingBlocks={new Map([['block-0', 'private reasoning']])}
      />
    );

    expect(screen.queryByText('Thinking...')).not.toBeInTheDocument();
  });
});

describe('MessageList assistant response metadata', () => {
  const assistantMessage: UIMessage = {
    id: 'assistant-meta',
    role: 'assistant',
    parts: [{ type: 'text', text: 'Ship the patch and add coverage.' }],
  };

  it('renders an assistant response footer with summary metadata and changed files', () => {
    render(
      <MessageList
        messages={[assistantMessage]}
        isLoading={false}
        assistantMetadata={{
          'assistant-meta': {
            model: 'claude-sonnet-4-6',
            durationMs: 2345,
            inputTokens: 1200,
            outputTokens: 340,
            cacheReadTokens: 20,
            cacheCreationTokens: 10,
            changedFiles: ['apps/server/src/routes/chat.ts', 'README.md'],
          },
        }}
      />
    );

    expect(screen.getByTestId('assistant-response-meta-assistant-meta')).toHaveTextContent(
      '2.3s'
    );
    expect(screen.getByTestId('assistant-response-meta-assistant-meta')).toHaveTextContent(
      '2 files changed'
    );
    expect(screen.getByText('apps/server/src/routes/chat.ts')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
  });

  it('shows detailed token metadata on hover', () => {
    render(
      <MessageList
        messages={[assistantMessage]}
        isLoading={false}
        assistantMetadata={{
          'assistant-meta': {
            model: 'claude-sonnet-4-6',
            durationMs: 2345,
            inputTokens: 1200,
            outputTokens: 340,
            cacheReadTokens: 20,
            cacheCreationTokens: 10,
            changedFiles: [],
          },
        }}
      />
    );

    fireEvent.mouseEnter(screen.getByTestId('assistant-response-meta-assistant-meta'));

    expect(screen.getByText('Model: claude-sonnet-4-6')).toBeInTheDocument();
    expect(screen.getByText('Input: 1,200')).toBeInTheDocument();
    expect(screen.getByText('Output: 340')).toBeInTheDocument();
    expect(screen.getByText('Cache read: 20')).toBeInTheDocument();
    expect(screen.getByText('Cache write: 10')).toBeInTheDocument();
  });

  it('copies the assistant message markdown when copy is clicked', async () => {
    render(
      <MessageList
        messages={[assistantMessage]}
        isLoading={false}
        assistantMetadata={{
          'assistant-meta': {
            model: 'claude-sonnet-4-6',
            durationMs: 2345,
            inputTokens: 1200,
            outputTokens: 340,
            cacheReadTokens: 20,
            cacheCreationTokens: 10,
            changedFiles: [],
          },
        }}
      />
    );

    fireEvent.click(screen.getByTestId('assistant-response-copy-assistant-meta'));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'Ship the patch and add coverage.'
    );
  });
});
