import { describe, test, expect, beforeEach, spyOn } from 'bun:test';
import { mapSdkEvent } from './event-mapper';
import type {
  StreamPlanStart,
  StreamPlanContent,
  StreamPlanComplete,
} from '@claude-tauri/shared';

describe('mapSdkEvent - plan events', () => {
  let consoleSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    consoleSpy = spyOn(console, 'warn').mockImplementation(() => {});
  });

  test('maps plan_start system event to plan:start', () => {
    const sdkEvent = {
      type: 'system',
      subtype: 'plan_start',
      plan_id: 'plan-1',
    };

    const result = mapSdkEvent(sdkEvent);
    expect(result).toHaveLength(1);
    const event = result[0] as StreamPlanStart;
    expect(event.type).toBe('plan:start');
    expect(event.planId).toBe('plan-1');
  });

  test('maps plan_content system event to plan:content', () => {
    const sdkEvent = {
      type: 'system',
      subtype: 'plan_content',
      plan_id: 'plan-1',
      text: 'Step 1: Read the file\n',
    };

    const result = mapSdkEvent(sdkEvent);
    expect(result).toHaveLength(1);
    const event = result[0] as StreamPlanContent;
    expect(event.type).toBe('plan:content');
    expect(event.planId).toBe('plan-1');
    expect(event.text).toBe('Step 1: Read the file\n');
  });

  test('maps plan_complete system event to plan:complete', () => {
    const sdkEvent = {
      type: 'system',
      subtype: 'plan_complete',
      plan_id: 'plan-1',
    };

    const result = mapSdkEvent(sdkEvent);
    expect(result).toHaveLength(1);
    const event = result[0] as StreamPlanComplete;
    expect(event.type).toBe('plan:complete');
    expect(event.planId).toBe('plan-1');
  });

  test('handles missing plan_id gracefully', () => {
    const sdkEvent = {
      type: 'system',
      subtype: 'plan_start',
    };

    const result = mapSdkEvent(sdkEvent);
    expect(result).toHaveLength(1);
    const event = result[0] as StreamPlanStart;
    expect(event.type).toBe('plan:start');
    expect(event.planId).toBe('');
  });

  test('handles empty text in plan_content', () => {
    const sdkEvent = {
      type: 'system',
      subtype: 'plan_content',
      plan_id: 'plan-2',
      text: '',
    };

    const result = mapSdkEvent(sdkEvent);
    expect(result).toHaveLength(1);
    const event = result[0] as StreamPlanContent;
    expect(event.text).toBe('');
  });
});
