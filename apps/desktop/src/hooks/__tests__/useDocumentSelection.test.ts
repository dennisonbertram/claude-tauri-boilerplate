import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDocumentSelection } from '../useDocumentSelection';

const docIds = ['a', 'b', 'c', 'd', 'e'];

describe('useDocumentSelection', () => {
  it('starts with no selection', () => {
    const { result } = renderHook(() => useDocumentSelection(docIds));
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.isSomeSelected).toBe(false);
  });

  it('toggles a single item', () => {
    const { result } = renderHook(() => useDocumentSelection(docIds));

    act(() => result.current.toggle('b'));
    expect(result.current.selectedIds.has('b')).toBe(true);
    expect(result.current.selectedCount).toBe(1);

    // Toggle off
    act(() => result.current.toggle('b'));
    expect(result.current.selectedIds.has('b')).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });

  it('selects all', () => {
    const { result } = renderHook(() => useDocumentSelection(docIds));

    act(() => result.current.selectAll());
    expect(result.current.selectedCount).toBe(5);
    expect(result.current.isAllSelected).toBe(true);
    expect(result.current.isSomeSelected).toBe(false);
  });

  it('deselects all', () => {
    const { result } = renderHook(() => useDocumentSelection(docIds));

    act(() => result.current.selectAll());
    act(() => result.current.deselectAll());
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
  });

  it('reports isSomeSelected correctly', () => {
    const { result } = renderHook(() => useDocumentSelection(docIds));

    act(() => result.current.toggle('a'));
    expect(result.current.isSomeSelected).toBe(true);
    expect(result.current.isAllSelected).toBe(false);
  });

  it('shift+click selects a range', () => {
    const { result } = renderHook(() => useDocumentSelection(docIds));

    // First click on 'b' (index 1)
    act(() => result.current.toggle('b'));
    // Shift+click on 'd' (index 3) should select b, c, d
    act(() => result.current.toggle('d', true));

    expect(result.current.selectedIds.has('b')).toBe(true);
    expect(result.current.selectedIds.has('c')).toBe(true);
    expect(result.current.selectedIds.has('d')).toBe(true);
    expect(result.current.selectedIds.has('a')).toBe(false);
    expect(result.current.selectedIds.has('e')).toBe(false);
    expect(result.current.selectedCount).toBe(3);
  });

  it('shift+click works in reverse direction', () => {
    const { result } = renderHook(() => useDocumentSelection(docIds));

    // Click on 'd' (index 3)
    act(() => result.current.toggle('d'));
    // Shift+click on 'b' (index 1) — reverse
    act(() => result.current.toggle('b', true));

    expect(result.current.selectedIds.has('b')).toBe(true);
    expect(result.current.selectedIds.has('c')).toBe(true);
    expect(result.current.selectedIds.has('d')).toBe(true);
    expect(result.current.selectedCount).toBe(3);
  });

  it('handles empty document list', () => {
    const { result } = renderHook(() => useDocumentSelection([]));
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.isAllSelected).toBe(false);

    act(() => result.current.selectAll());
    expect(result.current.selectedCount).toBe(0);
  });
});
