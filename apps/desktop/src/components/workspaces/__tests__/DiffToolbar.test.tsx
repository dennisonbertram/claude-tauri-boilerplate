import { render, screen, fireEvent, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiffToolbar } from '../DiffToolbar';

describe('DiffToolbar', () => {
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
    const { unmount } = render(
      <DiffToolbar
        viewMode="unified"
        setViewMode={vi.fn()}
        hasRangeDiff={false}
        changedFilesCount={1}
        draftFromRef=""
        setDraftFromRef={vi.fn()}
        draftToRef=""
        setDraftToRef={vi.fn()}
        revisions={[]}
        rangeError={null}
        filterMode="all"
        setFilterMode={vi.fn()}
        isAllReviewed={false}
        reviewLoading={false}
        onRefresh={vi.fn()}
        onApplyRange={vi.fn()}
        onToggleAllReviewed={vi.fn()}
        onReviewClick={vi.fn()}
        onReviewContextMenu={vi.fn()}
        rawDiff="diff --git a/file b/file"
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
      await Promise.resolve();
    });

    expect(writeTextMock).toHaveBeenCalledWith('diff --git a/file b/file');
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
