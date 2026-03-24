import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
const mockOnAddAgent = vi.fn<(teamId: string, agent: unknown) => Promise<boolean>>();
const mockOnRemoveAgent = vi.fn<(teamId: string, agentName: string) => Promise<boolean>>();

function renderWithAgentManagement(
  overrides: {
    onAddAgent?: typeof mockOnAddAgent;
    onRemoveAgent?: typeof mockOnRemoveAgent;
  } = {},
) {
  return render(
    <TeamWorkspace
      team={mockTeam}
      messages={mockMessages}
      tasks={mockTasks}
      onShutdown={mockOnShutdown}
      onBack={mockOnBack}
      onAddAgent={overrides.onAddAgent}
      onRemoveAgent={overrides.onRemoveAgent}
    />,
  );
}

describe('TeamWorkspace agent management', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('"+" add agent button visible when onAddAgent provided', () => {
    renderWithAgentManagement({ onAddAgent: mockOnAddAgent });
    expect(screen.getByTestId('workspace-add-agent-button')).toBeInTheDocument();
  });

  it('"+" button hidden when onAddAgent undefined', () => {
    renderWithAgentManagement();
    expect(screen.queryByTestId('workspace-add-agent-button')).not.toBeInTheDocument();
  });

  it('click "+" opens AddAgentDialog', () => {
    renderWithAgentManagement({ onAddAgent: mockOnAddAgent });
    expect(screen.queryByTestId('add-agent-dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('workspace-add-agent-button'));
    expect(screen.getByTestId('add-agent-dialog')).toBeInTheDocument();
  });

  it('AddAgentDialog validates empty name', () => {
    renderWithAgentManagement({ onAddAgent: mockOnAddAgent });
    fireEvent.click(screen.getByTestId('workspace-add-agent-button'));
    fireEvent.click(screen.getByTestId('add-agent-submit'));
    expect(screen.getByTestId('add-agent-error')).toHaveTextContent('Agent name is required');
  });

  it('AddAgentDialog validates empty description', () => {
    renderWithAgentManagement({ onAddAgent: mockOnAddAgent });
    fireEvent.click(screen.getByTestId('workspace-add-agent-button'));
    fireEvent.change(screen.getByTestId('add-agent-name'), { target: { value: 'new-agent' } });
    fireEvent.click(screen.getByTestId('add-agent-submit'));
    expect(screen.getByTestId('add-agent-error')).toHaveTextContent('Agent description is required');
  });

  it('successful add calls onAddAgent with agent definition', async () => {
    mockOnAddAgent.mockResolvedValue(true);
    renderWithAgentManagement({ onAddAgent: mockOnAddAgent });
    fireEvent.click(screen.getByTestId('workspace-add-agent-button'));

    fireEvent.change(screen.getByTestId('add-agent-name'), { target: { value: 'new-agent' } });
    fireEvent.change(screen.getByTestId('add-agent-description'), { target: { value: 'Does new things' } });
    fireEvent.click(screen.getByTestId('add-agent-submit'));

    await waitFor(() => {
      expect(mockOnAddAgent).toHaveBeenCalledWith('team-1', expect.objectContaining({
        name: 'new-agent',
        description: 'Does new things',
      }));
    });
  });

  it('dialog closes after successful add', async () => {
    mockOnAddAgent.mockResolvedValue(true);
    renderWithAgentManagement({ onAddAgent: mockOnAddAgent });
    fireEvent.click(screen.getByTestId('workspace-add-agent-button'));
    expect(screen.getByTestId('add-agent-dialog')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('add-agent-name'), { target: { value: 'new-agent' } });
    fireEvent.change(screen.getByTestId('add-agent-description'), { target: { value: 'Does stuff' } });
    fireEvent.click(screen.getByTestId('add-agent-submit'));

    await waitFor(() => {
      expect(screen.queryByTestId('add-agent-dialog')).not.toBeInTheDocument();
    });
  });

  it('remove agent button triggers confirmation', () => {
    renderWithAgentManagement({ onRemoveAgent: mockOnRemoveAgent });
    const removeBtn = screen.getByTestId('remove-agent-researcher');
    fireEvent.click(removeBtn);
    expect(screen.getByTestId('confirm-remove-agent-researcher')).toBeInTheDocument();
  });

  it('confirm remove calls onRemoveAgent', () => {
    mockOnRemoveAgent.mockResolvedValue(true);
    renderWithAgentManagement({ onRemoveAgent: mockOnRemoveAgent });
    fireEvent.click(screen.getByTestId('remove-agent-researcher'));
    fireEvent.click(screen.getByTestId('confirm-remove-agent-researcher'));
    expect(mockOnRemoveAgent).toHaveBeenCalledWith('team-1', 'researcher');
  });

  it('cancel remove dismisses confirmation without calling onRemoveAgent', () => {
    renderWithAgentManagement({ onRemoveAgent: mockOnRemoveAgent });
    fireEvent.click(screen.getByTestId('remove-agent-researcher'));
    // Find the Cancel button by role and name within the confirmation area
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(mockOnRemoveAgent).not.toHaveBeenCalled();
    expect(screen.queryByTestId('confirm-remove-agent-researcher')).not.toBeInTheDocument();
  });
});
