import { describe, test, expect, beforeEach, spyOn } from 'bun:test';
import { mapSdkEvent } from './event-mapper';
import type {
  StreamPermissionRequest,
  StreamPermissionDenied,
} from '@claude-tauri/shared';

describe('mapSdkEvent - permission events', () => {
  let consoleSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    consoleSpy = spyOn(console, 'warn').mockImplementation(() => {});
  });

  test('maps permission_request system event to permission:request', () => {
    const sdkEvent = {
      type: 'system',
      subtype: 'permission_request',
      permission_request_id: 'perm-req-1',
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /tmp/test' },
      risk_level: 'high',
    };

    const result = mapSdkEvent(sdkEvent);
    expect(result).toHaveLength(1);
    const event = result[0] as StreamPermissionRequest;
    expect(event.type).toBe('permission:request');
    expect(event.requestId).toBe('perm-req-1');
    expect(event.toolName).toBe('Bash');
    expect(event.toolInput).toEqual({ command: 'rm -rf /tmp/test' });
    expect(event.riskLevel).toBe('high');
  });

  test('maps permission_denied system event to permission:denied', () => {
    const sdkEvent = {
      type: 'system',
      subtype: 'permission_denied',
      permission_request_id: 'perm-req-2',
      tool_name: 'Write',
    };

    const result = mapSdkEvent(sdkEvent);
    expect(result).toHaveLength(1);
    const event = result[0] as StreamPermissionDenied;
    expect(event.type).toBe('permission:denied');
    expect(event.requestId).toBe('perm-req-2');
    expect(event.toolName).toBe('Write');
  });

  test('defaults risk_level to medium when not provided', () => {
    const sdkEvent = {
      type: 'system',
      subtype: 'permission_request',
      permission_request_id: 'perm-req-3',
      tool_name: 'SomeTool',
      tool_input: { key: 'value' },
    };

    const result = mapSdkEvent(sdkEvent);
    expect(result).toHaveLength(1);
    const event = result[0] as StreamPermissionRequest;
    expect(event.riskLevel).toBe('medium');
  });
});
