import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessions } from './useSessions';

const { mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

describe('useSessions', () => {
  const mockFetch = vi.fn();
  const mockCreateObjectURL = vi.fn(() => 'blob:url');
  const mockRevokeObjectURL = vi.fn();
  const mockAnchorClick = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);

    mockFetch.mockReset();
    mockToastSuccess.mockReset();
    mockToastError.mockReset();
    mockCreateObjectURL.mockClear();
    mockRevokeObjectURL.mockClear();
    mockAnchorClick.mockClear();

    vi.spyOn(URL, 'createObjectURL').mockImplementation(mockCreateObjectURL);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(mockRevokeObjectURL);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(mockAnchorClick);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows a success toast after a successful export', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/sessions/session-1/export?format=json')) {
        return {
          ok: true,
          headers: {
            get: (name: string) =>
              name.toLowerCase() === 'content-disposition'
                ? 'attachment; filename="session-export.json"'
                : null,
          },
          blob: async () => new Blob(['test-content'], { type: 'application/json' }),
        };
      }
      return {
        ok: true,
        json: async () => [],
      };
    });

    const { result } = renderHook(() => useSessions());

    await act(async () => {
      await result.current.exportSession('session-1', 'json');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3131/api/sessions/session-1/export?format=json'
    );
    expect(mockCreateObjectURL).toHaveBeenCalledOnce();
    expect(mockAnchorClick).toHaveBeenCalledOnce();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:url');
    expect(mockToastSuccess).toHaveBeenCalledOnce();
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Session exported',
      expect.objectContaining({ description: 'session-export.json' })
    );
  });

  it('shows an error toast when export fails with non-ok response', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/sessions/session-1/export?format=md')) {
        return {
          ok: false,
          status: 500,
          headers: { get: vi.fn() },
          blob: async () => new Blob(),
        };
      }
      return {
        ok: true,
        json: async () => [],
      };
    });

    const { result } = renderHook(() => useSessions());

    await act(async () => {
      await result.current.exportSession('session-1', 'md');
    });

    expect(mockToastError).toHaveBeenCalledOnce();
    expect(mockToastError).toHaveBeenCalledWith(
      'Export failed',
      expect.objectContaining({ description: 'Server returned 500' })
    );
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('shows an error toast when export request throws', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useSessions());

    await act(async () => {
      await result.current.exportSession('session-1', 'json');
    });

    expect(mockToastError).toHaveBeenCalledOnce();
    expect(mockToastError).toHaveBeenCalledWith(
      'Export failed',
      expect.objectContaining({ description: 'Could not reach the server' })
    );
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});
