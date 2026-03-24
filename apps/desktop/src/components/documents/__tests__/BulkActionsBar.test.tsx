import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkActionsBar } from '../BulkActionsBar';

describe('BulkActionsBar', () => {
  it('renders nothing when selectedCount is 0', () => {
    const { container } = render(
      <BulkActionsBar selectedCount={0} onDelete={vi.fn()} onClearSelection={vi.fn()} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows selection count', () => {
    render(
      <BulkActionsBar selectedCount={3} onDelete={vi.fn()} onClearSelection={vi.fn()} />
    );
    expect(screen.getByTestId('bulk-selection-count')).toHaveTextContent('3 selected');
  });

  it('shows singular text for 1 selected', () => {
    render(
      <BulkActionsBar selectedCount={1} onDelete={vi.fn()} onClearSelection={vi.fn()} />
    );
    expect(screen.getByTestId('bulk-selection-count')).toHaveTextContent('1 selected');
  });

  it('calls onClearSelection when clear button is clicked', () => {
    const onClear = vi.fn();
    render(
      <BulkActionsBar selectedCount={2} onDelete={vi.fn()} onClearSelection={onClear} />
    );
    fireEvent.click(screen.getByTestId('bulk-clear-selection'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('shows confirmation dialog when delete is clicked', () => {
    render(
      <BulkActionsBar selectedCount={5} onDelete={vi.fn()} onClearSelection={vi.fn()} />
    );

    // No dialog initially
    expect(screen.queryByTestId('bulk-delete-confirm-dialog')).toBeNull();

    // Click delete button
    fireEvent.click(screen.getByTestId('bulk-delete-button'));

    // Dialog appears
    expect(screen.getByTestId('bulk-delete-confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete 5 documents?')).toBeInTheDocument();
  });

  it('calls onDelete when confirmed', () => {
    const onDelete = vi.fn();
    render(
      <BulkActionsBar selectedCount={3} onDelete={onDelete} onClearSelection={vi.fn()} />
    );

    fireEvent.click(screen.getByTestId('bulk-delete-button'));
    fireEvent.click(screen.getByTestId('bulk-delete-confirm'));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('does not call onDelete when cancelled', () => {
    const onDelete = vi.fn();
    render(
      <BulkActionsBar selectedCount={3} onDelete={onDelete} onClearSelection={vi.fn()} />
    );

    fireEvent.click(screen.getByTestId('bulk-delete-button'));
    fireEvent.click(screen.getByTestId('bulk-delete-cancel'));

    expect(onDelete).not.toHaveBeenCalled();
    // Dialog should be dismissed
    expect(screen.queryByTestId('bulk-delete-confirm-dialog')).toBeNull();
  });

  it('shows singular in confirmation for 1 document', () => {
    render(
      <BulkActionsBar selectedCount={1} onDelete={vi.fn()} onClearSelection={vi.fn()} />
    );

    fireEvent.click(screen.getByTestId('bulk-delete-button'));
    expect(screen.getByText('Delete 1 document?')).toBeInTheDocument();
  });
});
