import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSubagents } from '../useSubagents';
import type { StreamEvent } from '@claude-tauri/shared';

function makeTaskStarted(
  taskId: string,
  description: string,
  taskType?: string
): StreamEvent {
  return {
    type: 'task:started',
    taskId,
    description,
    taskType,
  };
}

function makeTaskProgress(taskId: string, progress: unknown): StreamEvent {
  return {
    type: 'task:progress',
    taskId,
    progress,
  };
}

function makeTaskNotification(
  taskId: string,
  status: 'completed' | 'failed' | 'stopped',
  summary: string,
  usage?: { totalTokens: number; toolUses: number; durationMs: number }
): StreamEvent {
  return {
    type: 'task:notification',
    taskId,
    status,
    summary,
    usage,
  };
}

describe('useSubagents', () => {
  describe('initial state', () => {
    it('starts with empty agents array', () => {
      const { result } = renderHook(() => useSubagents());
      expect(result.current.agents).toEqual([]);
    });

    it('starts with zero active count', () => {
      const { result } = renderHook(() => useSubagents());
      expect(result.current.activeCount).toBe(0);
    });

    it('starts with panel not visible', () => {
      const { result } = renderHook(() => useSubagents());
      expect(result.current.isVisible).toBe(false);
    });
  });

  describe('processEvent - task:started', () => {
    it('creates an agent node from task:started event', () => {
      const { result } = renderHook(() => useSubagents());

      act(() => {
        result.current.processEvent(makeTaskStarted('task-1', 'Researching codebase'));
      });

      expect(result.current.agents).toHaveLength(1);
      expect(result.current.agents[0]).toMatchObject({
        taskId: 'task-1',
        description: 'Researching codebase',
        status: 'running',
        children: [],
      });
    });

    it('sets taskType when provided', () => {
      const { result } = renderHook(() => useSubagents());

      act(() => {
        result.current.processEvent(
          makeTaskStarted('task-1', 'Writing code', 'implementation')
        );
      });

      expect(result.current.agents[0].taskType).toBe('implementation');
    });

    it('records startTime on creation', () => {
      const { result } = renderHook(() => useSubagents());
      const before = Date.now();

      act(() => {
        result.current.processEvent(makeTaskStarted('task-1', 'Test'));
      });

      const after = Date.now();
      expect(result.current.agents[0].startTime).toBeGreaterThanOrEqual(before);
      expect(result.current.agents[0].startTime).toBeLessThanOrEqual(after);
    });

    it('increments activeCount when agents are started', () => {
      const { result } = renderHook(() => useSubagents());

      act(() => {
        result.current.processEvent(makeTaskStarted('task-1', 'Agent 1'));
      });
      expect(result.current.activeCount).toBe(1);

      act(() => {
        result.current.processEvent(makeTaskStarted('task-2', 'Agent 2'));
      });
      expect(result.current.activeCount).toBe(2);
    });

    it('auto-shows panel when first agent starts', () => {
      const { result } = renderHook(() => useSubagents());
      expect(result.current.isVisible).toBe(false);

      act(() => {
        result.current.processEvent(makeTaskStarted('task-1', 'Agent 1'));
      });

      expect(result.current.isVisible).toBe(true);
    });
  });

  describe('processEvent - task:progress', () => {
    it('updates progress text for an existing agent', () => {
      const { result } = renderHook(() => useSubagents());

      act(() => {
        result.current.processEvent(makeTaskStarted('task-1', 'Agent 1'));
      });
      act(() => {
        result.current.processEvent(
          makeTaskProgress('task-1', 'Reading file utils.ts')
        );
      });

      expect(result.current.agents[0].progress).toBe('Reading file utils.ts');
    });

    it('overwrites previous progress text', () => {
      const { result } = renderHook(() => useSubagents());

      act(() => {
        result.current.processEvent(makeTaskStarted('task-1', 'Agent 1'));
      });
      act(() => {
        result.current.processEvent(makeTaskProgress('task-1', 'Step 1'));
      });
      act(() => {
        result.current.processEvent(makeTaskProgress('task-1', 'Step 2'));
      });

      expect(result.current.agents[0].progress).toBe('Step 2');
    });

    it('ignores progress for unknown task IDs', () => {
      const { result } = renderHook(() => useSubagents());

      act(() => {
        result.current.processEvent(makeTaskProgress('unknown', 'Doing stuff'));
      });

      expect(result.current.agents).toEqual([]);
    });

    it('handles object progress by converting to string', () => {
      const { result } = renderHook(() => useSubagents());

      act(() => {
        result.current.processEvent(makeTaskStarted('task-1', 'Agent 1'));
      });
      act(() => {
        result.current.processEvent(
          makeTaskProgress('task-1', { step: 3, total: 10 })
        );
      });

      // Should convert to a string representation
      expect(typeof result.current.agents[0].progress).toBe('string');
      expect(result.current.agents[0].progress).toBeTruthy();
    });
  });

  describe('processEvent - task:notification', () => {
    it('marks agent as completed', () => {
      const { result } = renderHook(() => useSubagents());

      act(() => {
        result.current.processEvent(makeTaskStarted('task-1', 'Agent 1'));
      });
      act(() => {
        result.current.processEvent(
          makeTaskNotification('task-1', 'completed', 'Finished analysis')
        );
      });

      expect(result.current.agents[0].status).toBe('completed');
      expect(result.current.agents[0].summary).toBe('Finished analysis');
    });

    it('marks agent as failed', () => {
      const { result } = renderHook(() => useSubagents());

      act(() => {
        result.current.processEvent(makeTaskStarted('task-1', 'Agent 1'));
      });
      act(() => {
        result.current.processEvent(
          makeTaskNotification('task-1', 'failed', 'Could not complete')
        );
      });

      expect(result.current.agents[0].status).toBe('failed');
      expect(result.current.agents[0].summary).toBe('Could not complete');
    });

    it('marks agent as stopped', () => {
      const { result } = renderHook(() => useSubagents());

      act(() => {
        result.current.processEvent(makeTaskStarted('task-1', 'Agent 1'));
      });
      act(() => {
        result.current.processEvent(
          makeTaskNotification('task-1', 'stopped', 'User cancelled')
        );
      });

      expect(result.current.agents[0].status).toBe('stopped');
    });

    it('decrements activeCount when agent completes', () => {
      const { result } = renderHook(() => useSubagents());

      act(() => {
        result.current.processEvent(makeTaskStarted('task-1', 'Agent 1'));
        result.current.processEvent(makeTaskStarted('task-2', 'Agent 2'));
      });
      expect(result.current.activeCount).toBe(2);

      act(() => {
        result.current.processEvent(
          makeTaskNotification('task-1', 'completed', 'Done')
        );
      });
      expect(result.current.activeCount).toBe(1);
    });

    it('stores usage info when provided', () => {
      const { result } = renderHook(() => useSubagents());

      act(() => {
        result.current.processEvent(makeTaskStarted('task-1', 'Agent 1'));
      });
      act(() => {
        result.current.processEvent(
          makeTaskNotification('task-1', 'completed', 'Done', {
            totalTokens: 5000,
            toolUses: 3,
            durationMs: 12000,
          })
        );
      });

      expect(result.current.agents[0].usage).toEqual({
        totalTokens: 5000,
        toolUses: 3,
        durationMs: 12000,
      });
    });

    it('ignores notification for unknown task IDs', () => {
      const { result } = renderHook(() => useSubagents());

      act(() => {
        result.current.processEvent(
          makeTaskNotification('unknown', 'completed', 'Done')
        );
      });

      expect(result.current.agents).toEqual([]);
      expect(result.current.activeCount).toBe(0);
    });
  });

  describe('parent-child relationships', () => {
    it('nests child agents under parent using hierarchical task IDs', () => {
      const { result } = renderHook(() => useSubagents());

      // Parent agent
      act(() => {
        result.current.processEvent(makeTaskStarted('task-1', 'Parent agent'));
      });
      // Child agent - task ID contains parent reference via convention
      act(() => {
        result.current.processEvent(makeTaskStarted('task-1.1', 'Child agent'));
      });

      // The top-level agents array should contain only the parent
      expect(result.current.agents).toHaveLength(1);
      expect(result.current.agents[0].taskId).toBe('task-1');
      expect(result.current.agents[0].children).toHaveLength(1);
      expect(result.current.agents[0].children[0].taskId).toBe('task-1.1');
    });

    it('handles multiple children under one parent', () => {
      const { result } = renderHook(() => useSubagents());

      act(() => {
        result.current.processEvent(makeTaskStarted('task-1', 'Parent'));
        result.current.processEvent(makeTaskStarted('task-1.1', 'Child A'));
        result.current.processEvent(makeTaskStarted('task-1.2', 'Child B'));
      });

      expect(result.current.agents).toHaveLength(1);
      expect(result.current.agents[0].children).toHaveLength(2);
    });

    it('treats agents without dot notation as top-level', () => {
      const { result } = renderHook(() => useSubagents());

      act(() => {
        result.current.processEvent(makeTaskStarted('task-1', 'Agent A'));
        result.current.processEvent(makeTaskStarted('task-2', 'Agent B'));
      });

      expect(result.current.agents).toHaveLength(2);
    });

    it('falls back to top-level if parent ID not found', () => {
      const { result } = renderHook(() => useSubagents());

      // Child arrives without parent
      act(() => {
        result.current.processEvent(makeTaskStarted('task-99.1', 'Orphan child'));
      });

      // Should appear at top level
      expect(result.current.agents).toHaveLength(1);
      expect(result.current.agents[0].taskId).toBe('task-99.1');
    });
  });

  describe('toggleVisibility', () => {
    it('toggles panel visibility', () => {
      const { result } = renderHook(() => useSubagents());

      act(() => {
        result.current.toggleVisibility();
      });
      expect(result.current.isVisible).toBe(true);

      act(() => {
        result.current.toggleVisibility();
      });
      expect(result.current.isVisible).toBe(false);
    });
  });

  describe('reset', () => {
    it('clears all agents and resets state', () => {
      const { result } = renderHook(() => useSubagents());

      act(() => {
        result.current.processEvent(makeTaskStarted('task-1', 'Agent 1'));
        result.current.processEvent(makeTaskStarted('task-2', 'Agent 2'));
      });
      expect(result.current.agents).toHaveLength(2);
      expect(result.current.activeCount).toBe(2);

      act(() => {
        result.current.reset();
      });

      expect(result.current.agents).toEqual([]);
      expect(result.current.activeCount).toBe(0);
    });
  });

  describe('ignores non-task events', () => {
    it('ignores text:delta events', () => {
      const { result } = renderHook(() => useSubagents());

      act(() => {
        result.current.processEvent({
          type: 'text:delta',
          text: 'hello',
          blockIndex: 0,
        } as StreamEvent);
      });

      expect(result.current.agents).toEqual([]);
    });

    it('ignores session:init events', () => {
      const { result } = renderHook(() => useSubagents());

      act(() => {
        result.current.processEvent({
          type: 'session:init',
          sessionId: 'sess-1',
          model: 'claude-sonnet-4',
          tools: [],
          mcpServers: [],
          claudeCodeVersion: '1.0.0',
        } as StreamEvent);
      });

      expect(result.current.agents).toEqual([]);
    });
  });
});
