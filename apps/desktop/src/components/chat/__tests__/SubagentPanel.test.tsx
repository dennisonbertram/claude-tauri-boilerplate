import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubagentPanel } from '../SubagentPanel';
import type { SubagentNode } from '@/hooks/useSubagents';

function makeAgent(overrides: Partial<SubagentNode> = {}): SubagentNode {
  return {
    taskId: 'task-1',
    description: 'Test agent',
    status: 'running',
    startTime: Date.now(),
    children: [],
    ...overrides,
  };
}

describe('SubagentPanel', () => {
  describe('empty state', () => {
    it('shows empty state message when no agents exist', () => {
      render(
        <SubagentPanel
          agents={[]}
          activeCount={0}
          isVisible={true}
          onToggleVisibility={vi.fn()}
        />
      );

      expect(screen.getByTestId('subagent-empty')).toHaveTextContent(
        /no active agents/i
      );
    });

    it('does not render panel content when not visible', () => {
      render(
        <SubagentPanel
          agents={[makeAgent()]}
          activeCount={1}
          isVisible={false}
          onToggleVisibility={vi.fn()}
        />
      );

      expect(screen.queryByTestId('subagent-tree')).not.toBeInTheDocument();
    });
  });

  describe('toggle button', () => {
    it('shows toggle button with active count badge', () => {
      render(
        <SubagentPanel
          agents={[makeAgent()]}
          activeCount={3}
          isVisible={false}
          onToggleVisibility={vi.fn()}
        />
      );

      const badge = screen.getByTestId('subagent-badge');
      expect(badge).toHaveTextContent('3');
    });

    it('calls onToggleVisibility when toggle button clicked', async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();

      render(
        <SubagentPanel
          agents={[makeAgent()]}
          activeCount={1}
          isVisible={false}
          onToggleVisibility={onToggle}
        />
      );

      await user.click(screen.getByTestId('subagent-toggle'));
      expect(onToggle).toHaveBeenCalledOnce();
    });

    it('hides badge when active count is zero', () => {
      render(
        <SubagentPanel
          agents={[makeAgent({ status: 'completed' })]}
          activeCount={0}
          isVisible={true}
          onToggleVisibility={vi.fn()}
        />
      );

      expect(screen.queryByTestId('subagent-badge')).not.toBeInTheDocument();
    });
  });

  describe('agent tree rendering', () => {
    it('renders a single agent node', () => {
      render(
        <SubagentPanel
          agents={[makeAgent({ taskId: 'task-1', description: 'Research agent' })]}
          activeCount={1}
          isVisible={true}
          onToggleVisibility={vi.fn()}
        />
      );

      expect(screen.getByTestId('agent-node-task-1')).toBeInTheDocument();
      expect(screen.getByTestId('agent-node-task-1')).toHaveTextContent(
        'Research agent'
      );
    });

    it('renders multiple top-level agents', () => {
      render(
        <SubagentPanel
          agents={[
            makeAgent({ taskId: 'task-1', description: 'Agent A' }),
            makeAgent({ taskId: 'task-2', description: 'Agent B' }),
          ]}
          activeCount={2}
          isVisible={true}
          onToggleVisibility={vi.fn()}
        />
      );

      expect(screen.getByTestId('agent-node-task-1')).toBeInTheDocument();
      expect(screen.getByTestId('agent-node-task-2')).toBeInTheDocument();
    });

    it('renders nested children with indentation', () => {
      render(
        <SubagentPanel
          agents={[
            makeAgent({
              taskId: 'task-1',
              description: 'Parent',
              children: [
                makeAgent({
                  taskId: 'task-1.1',
                  description: 'Child',
                }),
              ],
            }),
          ]}
          activeCount={2}
          isVisible={true}
          onToggleVisibility={vi.fn()}
        />
      );

      expect(screen.getByTestId('agent-node-task-1')).toBeInTheDocument();
      expect(screen.getByTestId('agent-node-task-1.1')).toBeInTheDocument();
      expect(screen.getByTestId('agent-children-task-1')).toBeInTheDocument();
    });
  });

  describe('status indicators', () => {
    it('shows running indicator for active agents', () => {
      render(
        <SubagentPanel
          agents={[makeAgent({ taskId: 'task-1', status: 'running' })]}
          activeCount={1}
          isVisible={true}
          onToggleVisibility={vi.fn()}
        />
      );

      const statusEl = screen.getByTestId('agent-status-task-1');
      expect(statusEl).toHaveTextContent(/running/i);
    });

    it('shows completed indicator for finished agents', () => {
      render(
        <SubagentPanel
          agents={[makeAgent({ taskId: 'task-1', status: 'completed' })]}
          activeCount={0}
          isVisible={true}
          onToggleVisibility={vi.fn()}
        />
      );

      const statusEl = screen.getByTestId('agent-status-task-1');
      expect(statusEl).toHaveTextContent(/completed/i);
    });

    it('shows failed indicator for errored agents', () => {
      render(
        <SubagentPanel
          agents={[makeAgent({ taskId: 'task-1', status: 'failed' })]}
          activeCount={0}
          isVisible={true}
          onToggleVisibility={vi.fn()}
        />
      );

      const statusEl = screen.getByTestId('agent-status-task-1');
      expect(statusEl).toHaveTextContent(/failed/i);
    });

    it('shows stopped indicator for stopped agents', () => {
      render(
        <SubagentPanel
          agents={[makeAgent({ taskId: 'task-1', status: 'stopped' })]}
          activeCount={0}
          isVisible={true}
          onToggleVisibility={vi.fn()}
        />
      );

      const statusEl = screen.getByTestId('agent-status-task-1');
      expect(statusEl).toHaveTextContent(/stopped/i);
    });
  });

  describe('progress display', () => {
    it('shows progress text when available', () => {
      render(
        <SubagentPanel
          agents={[
            makeAgent({
              taskId: 'task-1',
              progress: 'Reading file main.ts',
            }),
          ]}
          activeCount={1}
          isVisible={true}
          onToggleVisibility={vi.fn()}
        />
      );

      expect(screen.getByTestId('agent-progress-task-1')).toHaveTextContent(
        'Reading file main.ts'
      );
    });

    it('does not render progress element when no progress', () => {
      render(
        <SubagentPanel
          agents={[makeAgent({ taskId: 'task-1' })]}
          activeCount={1}
          isVisible={true}
          onToggleVisibility={vi.fn()}
        />
      );

      expect(
        screen.queryByTestId('agent-progress-task-1')
      ).not.toBeInTheDocument();
    });
  });

  describe('summary display', () => {
    it('shows summary when agent is completed', () => {
      render(
        <SubagentPanel
          agents={[
            makeAgent({
              taskId: 'task-1',
              status: 'completed',
              summary: 'Analyzed 15 files successfully',
            }),
          ]}
          activeCount={0}
          isVisible={true}
          onToggleVisibility={vi.fn()}
        />
      );

      expect(screen.getByTestId('agent-summary-task-1')).toHaveTextContent(
        'Analyzed 15 files successfully'
      );
    });
  });

  describe('expand/collapse behavior', () => {
    it('starts with agent details expanded', () => {
      render(
        <SubagentPanel
          agents={[
            makeAgent({
              taskId: 'task-1',
              description: 'Agent',
              progress: 'Working...',
              children: [makeAgent({ taskId: 'task-1.1', description: 'Child' })],
            }),
          ]}
          activeCount={2}
          isVisible={true}
          onToggleVisibility={vi.fn()}
        />
      );

      // Children should be visible by default
      expect(screen.getByTestId('agent-children-task-1')).toBeInTheDocument();
    });

    it('can collapse an agent node to hide children', async () => {
      const user = userEvent.setup();

      render(
        <SubagentPanel
          agents={[
            makeAgent({
              taskId: 'task-1',
              description: 'Agent',
              children: [makeAgent({ taskId: 'task-1.1', description: 'Child' })],
            }),
          ]}
          activeCount={2}
          isVisible={true}
          onToggleVisibility={vi.fn()}
        />
      );

      // Click collapse toggle
      const toggle = screen.getByTestId('agent-collapse-task-1');
      await user.click(toggle);

      // Children should be hidden
      expect(screen.queryByTestId('agent-children-task-1')).not.toBeInTheDocument();
    });

    it('can re-expand a collapsed agent node', async () => {
      const user = userEvent.setup();

      render(
        <SubagentPanel
          agents={[
            makeAgent({
              taskId: 'task-1',
              description: 'Agent',
              children: [makeAgent({ taskId: 'task-1.1', description: 'Child' })],
            }),
          ]}
          activeCount={2}
          isVisible={true}
          onToggleVisibility={vi.fn()}
        />
      );

      const toggle = screen.getByTestId('agent-collapse-task-1');

      // Collapse
      await user.click(toggle);
      expect(screen.queryByTestId('agent-children-task-1')).not.toBeInTheDocument();

      // Re-expand
      await user.click(toggle);
      expect(screen.getByTestId('agent-children-task-1')).toBeInTheDocument();
    });

    it('does not show collapse toggle for leaf nodes', () => {
      render(
        <SubagentPanel
          agents={[makeAgent({ taskId: 'task-1', children: [] })]}
          activeCount={1}
          isVisible={true}
          onToggleVisibility={vi.fn()}
        />
      );

      expect(
        screen.queryByTestId('agent-collapse-task-1')
      ).not.toBeInTheDocument();
    });
  });

  describe('elapsed time display', () => {
    it('shows elapsed time for running agents', () => {
      const twoSecondsAgo = Date.now() - 2000;

      render(
        <SubagentPanel
          agents={[
            makeAgent({
              taskId: 'task-1',
              status: 'running',
              startTime: twoSecondsAgo,
            }),
          ]}
          activeCount={1}
          isVisible={true}
          onToggleVisibility={vi.fn()}
        />
      );

      // Should show some time indicator
      const timeEl = screen.getByTestId('agent-time-task-1');
      expect(timeEl).toBeInTheDocument();
    });
  });
});
