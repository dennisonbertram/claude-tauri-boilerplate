import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskBoard } from '../teams/TaskBoard';
import type { TeamTask } from '@claude-tauri/shared';

const mockTasks: TeamTask[] = [
  { id: 't-1', subject: 'Research API docs', status: 'pending', assignee: 'researcher' },
  { id: 't-2', subject: 'Fix auth bug', status: 'in_progress', assignee: 'coder' },
  { id: 't-3', subject: 'Write tests', status: 'pending' },
  { id: 't-4', subject: 'Deploy to staging', status: 'completed', assignee: 'devops' },
  { id: 't-5', subject: 'Code review', status: 'completed', assignee: 'reviewer' },
  { id: 't-6', subject: 'Update docs', status: 'completed' },
];

describe('TaskBoard', () => {
  it('renders the task board', () => {
    render(<TaskBoard tasks={mockTasks} />);
    expect(screen.getByTestId('task-board')).toBeInTheDocument();
  });

  it('shows correct counts in header', () => {
    render(<TaskBoard tasks={mockTasks} />);
    const toggle = screen.getByTestId('task-board-toggle');
    expect(toggle).toHaveTextContent('Pending(2)');
    expect(toggle).toHaveTextContent('In Progress(1)');
    expect(toggle).toHaveTextContent('Done(3)');
  });

  it('renders three columns', () => {
    render(<TaskBoard tasks={mockTasks} />);
    expect(screen.getByTestId('task-column-pending')).toBeInTheDocument();
    expect(screen.getByTestId('task-column-in_progress')).toBeInTheDocument();
    expect(screen.getByTestId('task-column-completed')).toBeInTheDocument();
  });

  it('renders task cards in correct columns', () => {
    render(<TaskBoard tasks={mockTasks} />);

    // Pending column
    const pendingCol = screen.getByTestId('task-column-pending');
    expect(pendingCol).toHaveTextContent('Research API docs');
    expect(pendingCol).toHaveTextContent('Write tests');

    // In Progress column
    const inProgressCol = screen.getByTestId('task-column-in_progress');
    expect(inProgressCol).toHaveTextContent('Fix auth bug');

    // Completed column
    const completedCol = screen.getByTestId('task-column-completed');
    expect(completedCol).toHaveTextContent('Deploy to staging');
    expect(completedCol).toHaveTextContent('Code review');
    expect(completedCol).toHaveTextContent('Update docs');
  });

  it('shows assignee badges', () => {
    render(<TaskBoard tasks={mockTasks} />);
    expect(screen.getByTestId('task-assignee-t-1')).toHaveTextContent('researcher');
    expect(screen.getByTestId('task-assignee-t-2')).toHaveTextContent('coder');
  });

  it('does not show assignee badge for unassigned tasks', () => {
    render(<TaskBoard tasks={mockTasks} />);
    expect(screen.queryByTestId('task-assignee-t-3')).not.toBeInTheDocument();
  });

  it('collapses and expands when toggle is clicked', () => {
    render(<TaskBoard tasks={mockTasks} />);

    // Initially expanded
    expect(screen.getByTestId('task-board-columns')).toBeInTheDocument();

    // Collapse
    fireEvent.click(screen.getByTestId('task-board-toggle'));
    expect(screen.queryByTestId('task-board-columns')).not.toBeInTheDocument();

    // Expand again
    fireEvent.click(screen.getByTestId('task-board-toggle'));
    expect(screen.getByTestId('task-board-columns')).toBeInTheDocument();
  });

  it('handles empty task list', () => {
    render(<TaskBoard tasks={[]} />);
    expect(screen.getByTestId('task-board-toggle')).toHaveTextContent('Pending(0)');
    expect(screen.getByTestId('task-board-toggle')).toHaveTextContent('In Progress(0)');
    expect(screen.getByTestId('task-board-toggle')).toHaveTextContent('Done(0)');
  });
});
