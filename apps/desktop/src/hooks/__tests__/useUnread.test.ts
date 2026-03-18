import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUnread } from '../useUnread';

describe('useUnread', () => {
  it('starts with an empty unread set', () => {
    const { result } = renderHook(() => useUnread());
    expect(result.current.unreadIds.size).toBe(0);
    expect(result.current.unreadCount).toBe(0);
  });

  it('markAsUnread adds a workspace ID to the unread set', () => {
    const { result } = renderHook(() => useUnread());
    act(() => {
      result.current.markAsUnread('ws-1');
    });
    expect(result.current.unreadIds.has('ws-1')).toBe(true);
    expect(result.current.unreadCount).toBe(1);
  });

  it('markAsUnread is idempotent — adding the same ID twice stays at count 1', () => {
    const { result } = renderHook(() => useUnread());
    act(() => {
      result.current.markAsUnread('ws-1');
      result.current.markAsUnread('ws-1');
    });
    expect(result.current.unreadCount).toBe(1);
  });

  it('markAsRead removes a workspace ID from the unread set', () => {
    const { result } = renderHook(() => useUnread());
    act(() => {
      result.current.markAsUnread('ws-1');
    });
    act(() => {
      result.current.markAsRead('ws-1');
    });
    expect(result.current.unreadIds.has('ws-1')).toBe(false);
    expect(result.current.unreadCount).toBe(0);
  });

  it('markAsRead on a non-unread ID is a no-op', () => {
    const { result } = renderHook(() => useUnread());
    act(() => {
      result.current.markAsUnread('ws-1');
    });
    act(() => {
      result.current.markAsRead('ws-999');
    });
    expect(result.current.unreadCount).toBe(1);
  });

  it('isUnread returns true for unread workspaces', () => {
    const { result } = renderHook(() => useUnread());
    act(() => {
      result.current.markAsUnread('ws-abc');
    });
    expect(result.current.isUnread('ws-abc')).toBe(true);
    expect(result.current.isUnread('ws-xyz')).toBe(false);
  });

  it('tracks multiple workspaces independently', () => {
    const { result } = renderHook(() => useUnread());
    act(() => {
      result.current.markAsUnread('ws-1');
      result.current.markAsUnread('ws-2');
      result.current.markAsUnread('ws-3');
    });
    expect(result.current.unreadCount).toBe(3);

    act(() => {
      result.current.markAsRead('ws-2');
    });
    expect(result.current.unreadCount).toBe(2);
    expect(result.current.isUnread('ws-1')).toBe(true);
    expect(result.current.isUnread('ws-2')).toBe(false);
    expect(result.current.isUnread('ws-3')).toBe(true);
  });
});
