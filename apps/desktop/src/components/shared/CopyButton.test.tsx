import { render, screen, fireEvent, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyButton } from './CopyButton';

describe('CopyButton', () => {
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('clears a pending copied-state timeout when unmounted', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { unmount } = render(<CopyButton text="hello world" variant="text" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
      await Promise.resolve();
    });

    expect(writeTextMock).toHaveBeenCalledWith('hello world');
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
