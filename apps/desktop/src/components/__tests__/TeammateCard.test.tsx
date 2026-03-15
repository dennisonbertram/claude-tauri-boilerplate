import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TeammateCard } from '../teams/TeammateCard';
import type { TeammateStatus } from '@claude-tauri/shared';

function makeAgent(overrides: Partial<TeammateStatus> = {}): TeammateStatus {
  return {
    name: 'researcher',
    status: 'active',
    model: 'claude-sonnet-4',
    tools: ['Read', 'Grep', 'Glob'],
    ...overrides,
  };
}

describe('TeammateCard', () => {
  it('renders agent name and status', () => {
    render(<TeammateCard agent={makeAgent()} />);
    expect(screen.getByTestId('teammate-card-researcher')).toBeInTheDocument();
    expect(screen.getByText('researcher')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows green dot for active status', () => {
    render(<TeammateCard agent={makeAgent({ status: 'active' })} />);
    const dot = screen.getByTestId('status-dot-researcher');
    expect(dot.className).toContain('bg-green-400');
  });

  it('shows yellow dot for idle status', () => {
    render(<TeammateCard agent={makeAgent({ status: 'idle' })} />);
    const dot = screen.getByTestId('status-dot-researcher');
    expect(dot.className).toContain('bg-yellow-400');
  });

  it('shows gray dot for stopped status', () => {
    render(<TeammateCard agent={makeAgent({ status: 'stopped' })} />);
    const dot = screen.getByTestId('status-dot-researcher');
    expect(dot.className).toContain('bg-gray-400');
  });

  it('shows current task when assigned', () => {
    render(
      <TeammateCard
        agent={makeAgent({ currentTask: 'Researching API docs' })}
      />
    );
    expect(screen.getByTestId('current-task-researcher')).toHaveTextContent(
      'Researching API docs'
    );
  });

  it('expands to show tools on click', () => {
    render(<TeammateCard agent={makeAgent()} />);
    expect(screen.queryByTestId('teammate-details-researcher')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('teammate-card-researcher'));
    expect(screen.getByTestId('teammate-details-researcher')).toBeInTheDocument();
    expect(screen.getByText('Read')).toBeInTheDocument();
    expect(screen.getByText('Grep')).toBeInTheDocument();
  });

  it('collapses details on second click', () => {
    render(<TeammateCard agent={makeAgent()} />);
    fireEvent.click(screen.getByTestId('teammate-card-researcher'));
    expect(screen.getByTestId('teammate-details-researcher')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('teammate-card-researcher'));
    expect(screen.queryByTestId('teammate-details-researcher')).not.toBeInTheDocument();
  });

  it('shows stop button and calls onStop', () => {
    const onStop = vi.fn();
    render(<TeammateCard agent={makeAgent()} onStop={onStop} />);

    const stopBtn = screen.getByTestId('stop-agent-researcher');
    fireEvent.click(stopBtn);
    expect(onStop).toHaveBeenCalledWith('researcher');
  });

  it('hides stop button when agent is stopped', () => {
    const onStop = vi.fn();
    render(
      <TeammateCard agent={makeAgent({ status: 'stopped' })} onStop={onStop} />
    );
    expect(screen.queryByTestId('stop-agent-researcher')).not.toBeInTheDocument();
  });
});
