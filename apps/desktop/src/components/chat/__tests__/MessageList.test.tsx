import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { UIMessage } from '@ai-sdk/react';
import { MessageList } from '../MessageList';

Element.prototype.scrollIntoView = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
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

  it('binds the viewport listener when the viewport is available on the next frame', async () => {
    const messages = Array.from({ length: 20 }, (_, index) =>
      makeMessage(index)
    );
    const originalQuerySelector = HTMLElement.prototype.querySelector;
    let firstViewportLookup = true;

    HTMLElement.prototype.querySelector = function (
      selector: string
    ): Element | null {
      if (
        selector === '[data-slot="scroll-area-viewport"]' &&
        firstViewportLookup
      ) {
        firstViewportLookup = false;
        return null;
      }

      return originalQuerySelector.call(this, selector);
    };

    try {
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

      fireEvent.scroll(viewport);
      expect(
        screen.getByTestId('message-list-scroll-to-bottom')
      ).toBeInTheDocument();
    } finally {
      HTMLElement.prototype.querySelector = originalQuerySelector;
    }
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
