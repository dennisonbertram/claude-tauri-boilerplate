import { describe, it, expect } from 'vitest';
import {
  streamEventsReducer,
  initialStreamEventsState,
} from './useStreamEvents';
import type {
  StreamPermissionRequest,
  StreamPermissionDenied,
} from '@claude-tauri/shared';

describe('streamEventsReducer - permission events', () => {
  it('adds a permission request to pendingPermissions', () => {
    const event: StreamPermissionRequest = {
      type: 'permission:request',
      requestId: 'req-1',
      toolName: 'Bash',
      toolInput: { command: 'ls -la' },
      riskLevel: 'high',
    };

    const newState = streamEventsReducer(initialStreamEventsState, {
      type: 'PROCESS_EVENT',
      event,
    });

    expect(newState.pendingPermissions.size).toBe(1);
    const pending = newState.pendingPermissions.get('req-1');
    expect(pending).toBeDefined();
    expect(pending!.toolName).toBe('Bash');
    expect(pending!.riskLevel).toBe('high');
  });

  it('removes a permission request after RESOLVE_PERMISSION', () => {
    // First add a permission request
    const event: StreamPermissionRequest = {
      type: 'permission:request',
      requestId: 'req-2',
      toolName: 'Write',
      toolInput: { file_path: '/src/test.ts', content: 'hello' },
      riskLevel: 'high',
    };

    const stateWithPermission = streamEventsReducer(initialStreamEventsState, {
      type: 'PROCESS_EVENT',
      event,
    });

    expect(stateWithPermission.pendingPermissions.size).toBe(1);

    // Now resolve it
    const newState = streamEventsReducer(stateWithPermission, {
      type: 'RESOLVE_PERMISSION',
      requestId: 'req-2',
    });

    expect(newState.pendingPermissions.size).toBe(0);
  });

  it('handles permission:denied by removing from pending and adding to denied list', () => {
    // First add a permission request
    const requestEvent: StreamPermissionRequest = {
      type: 'permission:request',
      requestId: 'req-3',
      toolName: 'Bash',
      toolInput: { command: 'rm -rf /' },
      riskLevel: 'high',
    };

    const stateWithPermission = streamEventsReducer(initialStreamEventsState, {
      type: 'PROCESS_EVENT',
      event: requestEvent,
    });

    // Now receive denied event
    const deniedEvent: StreamPermissionDenied = {
      type: 'permission:denied',
      requestId: 'req-3',
      toolName: 'Bash',
    };

    const newState = streamEventsReducer(stateWithPermission, {
      type: 'PROCESS_EVENT',
      event: deniedEvent,
    });

    expect(newState.pendingPermissions.size).toBe(0);
    expect(newState.deniedPermissions.length).toBe(1);
    expect(newState.deniedPermissions[0].toolName).toBe('Bash');
  });

  it('handles multiple concurrent permission requests', () => {
    const event1: StreamPermissionRequest = {
      type: 'permission:request',
      requestId: 'req-a',
      toolName: 'Read',
      toolInput: { file_path: '/etc/passwd' },
      riskLevel: 'medium',
    };

    const event2: StreamPermissionRequest = {
      type: 'permission:request',
      requestId: 'req-b',
      toolName: 'Bash',
      toolInput: { command: 'whoami' },
      riskLevel: 'high',
    };

    let state = streamEventsReducer(initialStreamEventsState, {
      type: 'PROCESS_EVENT',
      event: event1,
    });

    state = streamEventsReducer(state, {
      type: 'PROCESS_EVENT',
      event: event2,
    });

    expect(state.pendingPermissions.size).toBe(2);
    expect(state.pendingPermissions.has('req-a')).toBe(true);
    expect(state.pendingPermissions.has('req-b')).toBe(true);
  });

  it('clears pendingPermissions on RESET', () => {
    const event: StreamPermissionRequest = {
      type: 'permission:request',
      requestId: 'req-reset',
      toolName: 'Bash',
      toolInput: { command: 'test' },
      riskLevel: 'high',
    };

    const stateWithPermission = streamEventsReducer(initialStreamEventsState, {
      type: 'PROCESS_EVENT',
      event,
    });

    const resetState = streamEventsReducer(stateWithPermission, {
      type: 'RESET',
    });

    expect(resetState.pendingPermissions.size).toBe(0);
    expect(resetState.deniedPermissions.length).toBe(0);
  });
});
