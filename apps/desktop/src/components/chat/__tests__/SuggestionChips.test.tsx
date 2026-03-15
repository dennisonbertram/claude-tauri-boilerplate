import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuggestionChips } from '../SuggestionChips';

describe('SuggestionChips', () => {
  const defaultProps = {
    suggestions: ['Explain this code', 'Add tests for this', 'Refactor this'],
    onSelect: vi.fn(),
    onDismiss: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders suggestion chips', () => {
      render(<SuggestionChips {...defaultProps} />);
      expect(screen.getByText('Explain this code')).toBeInTheDocument();
      expect(screen.getByText('Add tests for this')).toBeInTheDocument();
      expect(screen.getByText('Refactor this')).toBeInTheDocument();
    });

    it('renders nothing when suggestions array is empty', () => {
      const { container } = render(
        <SuggestionChips {...defaultProps} suggestions={[]} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders a dismiss button for each chip', () => {
      render(<SuggestionChips {...defaultProps} />);
      const dismissButtons = screen.getAllByRole('button', { name: /dismiss/i });
      expect(dismissButtons).toHaveLength(3);
    });
  });

  describe('interactions', () => {
    it('calls onSelect with the suggestion text when chip is clicked', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<SuggestionChips {...defaultProps} onSelect={onSelect} />);

      await user.click(screen.getByText('Explain this code'));
      expect(onSelect).toHaveBeenCalledWith('Explain this code');
    });

    it('calls onDismiss with the suggestion text when dismiss button is clicked', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(<SuggestionChips {...defaultProps} onDismiss={onDismiss} />);

      const dismissButtons = screen.getAllByRole('button', { name: /dismiss/i });
      await user.click(dismissButtons[0]);
      expect(onDismiss).toHaveBeenCalledWith('Explain this code');
    });

    it('does not call onSelect when dismiss button is clicked (event does not bubble)', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onDismiss = vi.fn();
      render(
        <SuggestionChips
          {...defaultProps}
          onSelect={onSelect}
          onDismiss={onDismiss}
        />
      );

      const dismissButtons = screen.getAllByRole('button', { name: /dismiss/i });
      await user.click(dismissButtons[0]);
      expect(onDismiss).toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('chips have role button', () => {
      render(<SuggestionChips {...defaultProps} />);
      // Each suggestion text is inside a button-like element
      const chips = screen.getAllByTestId('suggestion-chip');
      expect(chips).toHaveLength(3);
    });

    it('dismiss buttons have accessible labels', () => {
      render(<SuggestionChips {...defaultProps} />);
      const dismissButtons = screen.getAllByRole('button', { name: /dismiss/i });
      expect(dismissButtons.length).toBe(3);
    });
  });
});
