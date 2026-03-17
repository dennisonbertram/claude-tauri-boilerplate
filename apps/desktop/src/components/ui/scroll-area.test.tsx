import '@testing-library/jest-dom/vitest';
import { createRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScrollArea } from './scroll-area';

describe('ScrollArea viewport bindings', () => {
  it('forwards viewport refs and scroll handlers to the viewport element', () => {
    const viewportRef = createRef<HTMLDivElement>();
    const onScroll = vi.fn();

    render(
      <div className="h-32">
        <ScrollArea
          className="h-24"
          viewportRef={viewportRef}
          viewportProps={{ onScroll }}
        >
          <div style={{ height: 400 }}>Long content</div>
        </ScrollArea>
      </div>
    );

    expect(viewportRef.current).toBeInstanceOf(HTMLDivElement);

    fireEvent.scroll(viewportRef.current!);

    expect(onScroll).toHaveBeenCalledTimes(1);
  });
});
