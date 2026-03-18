import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const { mockToastInfo } = vi.hoisted(() => ({
  mockToastInfo: vi.fn(),
}));

import { promptMemoryUpdate } from '../memoryUpdatePrompt';

vi.mock('sonner', () => ({
  toast: {
    info: mockToastInfo,
  },
}));

describe('promptMemoryUpdate', () => {
  beforeEach(() => {
    mockToastInfo.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('prompts the user to update memory after review feedback', () => {
    const openMemory = vi.fn();

    promptMemoryUpdate({
      trigger: 'review-feedback',
      onOpenMemory: openMemory,
    });

    expect(mockToastInfo).toHaveBeenCalledOnce();
    expect(mockToastInfo).toHaveBeenCalledWith(
      expect.stringContaining('review feedback'),
      expect.objectContaining({
        description: expect.stringContaining('future sessions'),
        duration: 8000,
        action: expect.objectContaining({
          label: 'Open Memory',
          onClick: expect.any(Function),
        }),
      })
    );

    const options = mockToastInfo.mock.calls.at(-1)?.[1] as {
      action?: { onClick?: () => void };
    };
    options.action?.onClick?.();
    expect(openMemory).toHaveBeenCalledOnce();
  });

  it('prompts the user to update memory after a workspace merge', () => {
    promptMemoryUpdate({ trigger: 'workspace-merge' });

    expect(mockToastInfo).toHaveBeenCalledOnce();
    expect(mockToastInfo).toHaveBeenCalledWith(
      expect.stringContaining('merge'),
      expect.objectContaining({
        description: expect.stringContaining('same memory files'),
        duration: 8000,
      })
    );
  });
});
