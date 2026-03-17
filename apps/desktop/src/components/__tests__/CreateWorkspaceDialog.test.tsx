import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateWorkspaceDialog } from '../workspaces/CreateWorkspaceDialog';

const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
const mockOnClose = vi.fn();

function renderDialog(isOpen = true) {
  return render(
    <CreateWorkspaceDialog
      isOpen={isOpen}
      projectName="my-project"
      defaultBranch="main"
      onClose={mockOnClose}
      onSubmit={mockOnSubmit}
    />
  );
}

describe('CreateWorkspaceDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    renderDialog(false);
    expect(screen.queryByText('Create Workspace')).not.toBeInTheDocument();
  });

  it('renders when isOpen is true', () => {
    renderDialog();
    expect(screen.getByText('Create Workspace')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('my-feature')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  it('shows validation error when Create is clicked with empty name', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByText('Workspace name is required')).toBeInTheDocument();
  });

  it('does not call onSubmit when name is empty', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('clears the error message when the user starts typing in the name field', () => {
    renderDialog();
    // Trigger the error
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByText('Workspace name is required')).toBeInTheDocument();

    // Start typing — error should disappear
    fireEvent.change(screen.getByPlaceholderText('my-feature'), {
      target: { value: 'my-workspace' },
    });
    expect(screen.queryByText('Workspace name is required')).not.toBeInTheDocument();
  });

  it('calls onSubmit with trimmed name when a valid name is entered', async () => {
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText('my-feature'), {
      target: { value: '  my-workspace  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith('my-workspace', undefined);
    });
  });

  it('does not show the error message on initial render', () => {
    renderDialog();
    expect(screen.queryByText('Workspace name is required')).not.toBeInTheDocument();
  });

  it('shows error for whitespace-only name', () => {
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText('my-feature'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByText('Workspace name is required')).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel is clicked', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
