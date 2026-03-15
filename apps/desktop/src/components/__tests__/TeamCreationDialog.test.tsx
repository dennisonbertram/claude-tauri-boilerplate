import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TeamCreationDialog } from '../teams/TeamCreationDialog';

const mockOnCreate = vi.fn().mockResolvedValue({ id: 'test-id', name: 'test' });
const mockOnClose = vi.fn();

function renderDialog(isOpen = true) {
  return render(
    <TeamCreationDialog
      isOpen={isOpen}
      onClose={mockOnClose}
      onCreate={mockOnCreate}
    />
  );
}

describe('TeamCreationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    renderDialog(false);
    expect(screen.queryByTestId('team-creation-dialog')).not.toBeInTheDocument();
  });

  it('renders when isOpen is true', () => {
    renderDialog();
    expect(screen.getByTestId('team-creation-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('team-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('display-mode-select')).toBeInTheDocument();
    expect(screen.getByTestId('add-agent-button')).toBeInTheDocument();
  });

  it('starts with one empty agent form', () => {
    renderDialog();
    expect(screen.getByTestId('agent-form-0')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-form-1')).not.toBeInTheDocument();
  });

  it('adds an agent form when clicking Add Agent', () => {
    renderDialog();
    fireEvent.click(screen.getByTestId('add-agent-button'));
    expect(screen.getByTestId('agent-form-1')).toBeInTheDocument();
  });

  it('removes an agent form when clicking Remove', () => {
    renderDialog();
    fireEvent.click(screen.getByTestId('add-agent-button'));
    expect(screen.getByTestId('agent-form-1')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('remove-agent-1'));
    expect(screen.queryByTestId('agent-form-1')).not.toBeInTheDocument();
  });

  it('shows error when team name is empty', async () => {
    renderDialog();
    fireEvent.click(screen.getByTestId('team-creation-submit'));
    expect(screen.getByTestId('team-creation-error')).toHaveTextContent('Team name is required');
  });

  it('shows error when agent name is empty', async () => {
    renderDialog();
    fireEvent.change(screen.getByTestId('team-name-input'), {
      target: { value: 'My Team' },
    });
    // Agent name is empty, description is empty
    fireEvent.click(screen.getByTestId('team-creation-submit'));
    expect(screen.getByTestId('team-creation-error')).toHaveTextContent('must have a name');
  });

  it('shows error for duplicate agent names', async () => {
    renderDialog();
    fireEvent.change(screen.getByTestId('team-name-input'), {
      target: { value: 'My Team' },
    });
    fireEvent.change(screen.getByTestId('agent-name-0'), {
      target: { value: 'agent-a' },
    });
    fireEvent.change(screen.getByTestId('agent-description-0'), {
      target: { value: 'First agent' },
    });

    fireEvent.click(screen.getByTestId('add-agent-button'));
    fireEvent.change(screen.getByTestId('agent-name-1'), {
      target: { value: 'agent-a' },
    });
    fireEvent.change(screen.getByTestId('agent-description-1'), {
      target: { value: 'Second agent' },
    });

    fireEvent.click(screen.getByTestId('team-creation-submit'));
    expect(screen.getByTestId('team-creation-error')).toHaveTextContent('Duplicate');
  });

  it('calls onCreate with correct data on valid submission', async () => {
    renderDialog();
    fireEvent.change(screen.getByTestId('team-name-input'), {
      target: { value: 'My Team' },
    });
    fireEvent.change(screen.getByTestId('agent-name-0'), {
      target: { value: 'researcher' },
    });
    fireEvent.change(screen.getByTestId('agent-description-0'), {
      target: { value: 'Researches topics' },
    });

    fireEvent.click(screen.getByTestId('team-creation-submit'));

    await waitFor(() => {
      expect(mockOnCreate).toHaveBeenCalledWith(
        'My Team',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'researcher',
            description: 'Researches topics',
          }),
        ]),
        'auto'
      );
    });
  });

  it('calls onClose when cancel is clicked', () => {
    renderDialog();
    fireEvent.click(screen.getByTestId('team-creation-cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay is clicked', () => {
    renderDialog();
    fireEvent.click(screen.getByTestId('team-creation-overlay'));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
