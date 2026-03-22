import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WelcomeScreen } from '../WelcomeScreen';

describe('WelcomeScreen model display', () => {
  const defaultProps = {
    onNewChat: vi.fn(),
    onSubmit: vi.fn(),
  };

  it('displays the model name from the modelDisplay prop', () => {
    render(<WelcomeScreen {...defaultProps} modelDisplay="Haiku 4.5" />);
    expect(screen.getByText('Haiku 4.5')).toBeDefined();
  });

  it('displays a different model when prop changes', () => {
    const { rerender } = render(
      <WelcomeScreen {...defaultProps} modelDisplay="Sonnet 4.6" />,
    );
    expect(screen.getByText('Sonnet 4.6')).toBeDefined();

    rerender(<WelcomeScreen {...defaultProps} modelDisplay="Opus 4.6" />);
    expect(screen.getByText('Opus 4.6')).toBeDefined();
    expect(screen.queryByText('Sonnet 4.6')).toBeNull();
  });

  it('falls back to "Claude" when no modelDisplay prop is provided', () => {
    render(<WelcomeScreen {...defaultProps} />);
    expect(screen.getByText('Claude')).toBeDefined();
  });

  it('does not contain hardcoded "Claude Sonnet"', () => {
    render(<WelcomeScreen {...defaultProps} modelDisplay="Haiku 4.5" />);
    expect(screen.queryByText('Claude Sonnet')).toBeNull();
  });
});
