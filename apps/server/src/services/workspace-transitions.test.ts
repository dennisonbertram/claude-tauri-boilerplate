import { describe, test, expect } from 'bun:test';
import {
  isValidTransition,
  VALID_WORKSPACE_TRANSITIONS,
  type WorkspaceStatus,
} from '@claude-tauri/shared';

describe('isValidTransition', () => {
  test('creating -> setup_running is valid', () => {
    expect(isValidTransition('creating', 'setup_running')).toBe(true);
  });

  test('creating -> ready is valid (no setup command)', () => {
    expect(isValidTransition('creating', 'ready')).toBe(true);
  });

  test('creating -> error is valid', () => {
    expect(isValidTransition('creating', 'error')).toBe(true);
  });

  test('creating -> active is NOT valid', () => {
    expect(isValidTransition('creating', 'active')).toBe(false);
  });

  test('ready -> active is valid', () => {
    expect(isValidTransition('ready', 'active')).toBe(true);
  });

  test('ready -> merging is valid', () => {
    expect(isValidTransition('ready', 'merging')).toBe(true);
  });

  test('ready -> discarding is valid', () => {
    expect(isValidTransition('ready', 'discarding')).toBe(true);
  });

  test('active -> ready is valid (chat ended)', () => {
    expect(isValidTransition('active', 'ready')).toBe(true);
  });

  test('merging -> merged is valid', () => {
    expect(isValidTransition('merging', 'merged')).toBe(true);
  });

  test('merging -> error is valid (merge conflict)', () => {
    expect(isValidTransition('merging', 'error')).toBe(true);
  });

  test('merged is a terminal state — no valid transitions', () => {
    const allStatuses: WorkspaceStatus[] = [
      'creating', 'setup_running', 'ready', 'active',
      'merging', 'discarding', 'merged', 'archived', 'error',
    ];
    for (const target of allStatuses) {
      expect(isValidTransition('merged', target)).toBe(false);
    }
  });

  test('archived is a terminal state — no valid transitions', () => {
    const allStatuses: WorkspaceStatus[] = [
      'creating', 'setup_running', 'ready', 'active',
      'merging', 'discarding', 'merged', 'archived', 'error',
    ];
    for (const target of allStatuses) {
      expect(isValidTransition('archived', target)).toBe(false);
    }
  });

  test('error -> ready is valid (recovered)', () => {
    expect(isValidTransition('error', 'ready')).toBe(true);
  });

  test('error -> creating is valid (retry)', () => {
    expect(isValidTransition('error', 'creating')).toBe(true);
  });

  test('error -> archived is valid (give up)', () => {
    expect(isValidTransition('error', 'archived')).toBe(true);
  });

  test('error -> active is NOT valid', () => {
    expect(isValidTransition('error', 'active')).toBe(false);
  });

  test('all statuses have entries in the transition map', () => {
    const allStatuses: WorkspaceStatus[] = [
      'creating', 'setup_running', 'ready', 'active',
      'merging', 'discarding', 'merged', 'archived', 'error',
    ];
    for (const status of allStatuses) {
      expect(VALID_WORKSPACE_TRANSITIONS[status]).toBeDefined();
      expect(Array.isArray(VALID_WORKSPACE_TRANSITIONS[status])).toBe(true);
    }
  });
});
