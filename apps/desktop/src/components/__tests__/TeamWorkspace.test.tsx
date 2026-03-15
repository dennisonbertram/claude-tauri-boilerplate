import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TeamWorkspace } from '../teams/TeamWorkspace';
import type { TeammateStatus, TeamMessage, TeamTask } from '@claude-tauri/shared';

const mockTeam = {
  id: 'team-1',
  name: 'test-team',
  agents: [
    { name: 'researcher', description: 'Researches topics' },
    { name: 'coder', description: 'Writes code' },
  ],
  displayMode: 'auto' as const,
  createdAt: '2026-03-15T10:00:00Z',
  agentStatuses: [
    { name: 'researcher', status: 'active' as const, model: 'claude-sonnet-4' },
    { name: 'coder', status: 'idle' as const },
  ] as TeammateStatus[],
};

const mockMessages: TeamMessage[] = [
  {
    id: 'msg-1',
    from: 'researcher',
    to: 'coder',
    content: 'Found the issue',
    timestamp: '2026-03-15T10:00:00Z',
    type: 'message',
  },
];

const mockTasks: TeamTask[] = [
  { id: 't-1', subject: 'Fix bug', status: 'in_progress', assignee: 'coder' },
];

const mockOnShutdown = vi.fn();
const mockOnBack = vi.fn();

function renderWorkspace() {
  return render(
    <TeamWorkspace
      team={mockTeam}
      messages={mockMessages}
      tasks={mockTasks}
      onShutdown={mockOnShutdown}
      onBack={mockOnBack}
    />
  );
}

describe('TeamWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the workspace', () => {
    renderWorkspace();
    expect(screen.getByTestId('team-workspace')).toBeInTheDocument();
  });

  it('shows team name in header', () => {
    renderWorkspace();
    expect(screen.getByTestId('team-workspace-header')).toHaveTextContent('Team: test-team');
  });

  it('shows display mode badge', () => {
    renderWorkspace();
    expect(screen.getByText('auto')).toBeInTheDocument();
  });

  it('shows agent sidebar with teammate cards', () => {
    renderWorkspace();
    expect(screen.getByTestId('agents-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('teammate-card-researcher')).toBeInTheDocument();
    expect(screen.getByTestId('teammate-card-coder')).toBeInTheDocument();
  });

  it('shows message flow', () => {
    renderWorkspace();
    expect(screen.getByTestId('message-flow')).toBeInTheDocument();
    expect(screen.getByTestId('message-msg-1')).toBeInTheDocument();
  });

  it('shows task board', () => {
    renderWorkspace();
    expect(screen.getByTestId('task-board')).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', () => {
    renderWorkspace();
    fireEvent.click(screen.getByTestId('team-back-button'));
    expect(mockOnBack).toHaveBeenCalled();
  });

  it('shows confirmation before shutdown', () => {
    renderWorkspace();

    // First click shows confirm
    fireEvent.click(screen.getByTestId('shutdown-all-button'));
    expect(screen.getByTestId('confirm-shutdown-button')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-shutdown-button')).toBeInTheDocument();

    // Cancel returns to normal
    fireEvent.click(screen.getByTestId('cancel-shutdown-button'));
    expect(screen.queryByTestId('confirm-shutdown-button')).not.toBeInTheDocument();
  });

  it('calls onShutdown after confirmation', () => {
    renderWorkspace();

    fireEvent.click(screen.getByTestId('shutdown-all-button'));
    fireEvent.click(screen.getByTestId('confirm-shutdown-button'));
    expect(mockOnShutdown).toHaveBeenCalledWith('team-1');
  });
});
