import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WelcomeScreen } from '../WelcomeScreen';

describe('WelcomeScreen model display', () => {
  const defaultProps = {
    onNewChat: vi.fn(),
    onSubmit: vi.fn(),
    onSelectModel: vi.fn(),
    currentModel: 'claude-haiku-4-5-20251001',
  };

  const openOptionalControls = async () => {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /optional setup controls/i }));
    return user;
  };

  it('displays the model name from the modelDisplay prop', async () => {
    render(<WelcomeScreen {...defaultProps} modelDisplay="Haiku 4.5" />);
    await openOptionalControls();

    expect(screen.getByText('Haiku 4.5')).toBeDefined();
  });

  it('displays a different model when prop changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <WelcomeScreen {...defaultProps} modelDisplay="Sonnet 4.6" />,
    );
    await user.click(screen.getByRole('button', { name: /optional setup controls/i }));

    expect(screen.getByText('Sonnet 4.6')).toBeDefined();

    rerender(<WelcomeScreen {...defaultProps} modelDisplay="Opus 4.6" />);
    expect(screen.getByText('Opus 4.6')).toBeDefined();
    expect(screen.queryByText('Sonnet 4.6')).toBeNull();
  });

  it('falls back to "Claude" when no modelDisplay prop is provided', async () => {
    render(<WelcomeScreen {...defaultProps} />);
    await openOptionalControls();
    // Default model label remains visible in collapsed setup section
    expect(screen.getByText('Claude')).toBeDefined();
  });

  it('does not contain hardcoded "Claude Sonnet"', async () => {
    render(<WelcomeScreen {...defaultProps} modelDisplay="Haiku 4.5" />);
    await openOptionalControls();
    // "Claude Sonnet" was previously hardcoded and should no longer appear
    expect(screen.queryByText('Claude Sonnet')).toBeNull();
  });
});
