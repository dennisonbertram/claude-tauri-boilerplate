import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddProjectDialog } from '../AddProjectDialog';

const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
const mockOnClose = vi.fn();

describe('AddProjectDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not show validation on initial render', () => {
    render(
      <AddProjectDialog isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />
    );

    expect(screen.queryByText('Path is required')).not.toBeInTheDocument();
  });

  it('does not show stale validation message when reopened', () => {
    const { rerender } = render(
      <AddProjectDialog isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />
    );

    const pathInput = screen.getByPlaceholderText('/path/to/your/repo');
    fireEvent.blur(pathInput);
    expect(screen.getByText('Path is required')).toBeInTheDocument();

    rerender(<AddProjectDialog isOpen={false} onClose={mockOnClose} onSubmit={mockOnSubmit} />);
    rerender(<AddProjectDialog isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    expect(screen.queryByText('Path is required')).not.toBeInTheDocument();
  });
});

