import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('@/components/ui/scroll-area', async () => {
  const React = await import('react');

  const ScrollArea = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
      viewportProps?: React.HTMLAttributes<HTMLDivElement>;
      viewportRef?: React.Ref<HTMLDivElement>;
    }
  >(function ScrollArea({ children, viewportProps, viewportRef, ...props }, ref) {
    const { className: viewportClassName, ...viewportRest } = viewportProps ?? {};

    return React.createElement(
      'div',
      { ref, 'data-slot': 'scroll-area', ...props },
      React.createElement(
        'div',
        {
          ref: viewportRef,
          'data-slot': 'scroll-area-viewport',
          className: viewportClassName,
          ...viewportRest,
        },
        children,
      ),
    );
  });

  const ScrollBar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    function ScrollBar(props, ref) {
      return React.createElement('div', { ref, ...props });
    },
  );

  return { ScrollArea, ScrollBar };
});
