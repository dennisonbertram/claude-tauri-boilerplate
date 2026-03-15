import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThinkingBlock } from './ThinkingBlock';

describe('ThinkingBlock', () => {
  it('renders the "Thinking..." label', () => {
    render(<ThinkingBlock text="Some thinking content" />);
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
  });

  it('is collapsed by default', () => {
    render(<ThinkingBlock text="Hidden thinking content" />);
    expect(screen.queryByText('Hidden thinking content')).not.toBeInTheDocument();
  });

  it('expands to show thinking text when clicked', async () => {
    const user = userEvent.setup();
    render(<ThinkingBlock text="Let me reason about this problem step by step." />);

    // Click to expand
    const toggle = screen.getByRole('button', { name: /thinking/i });
    await user.click(toggle);

    expect(
      screen.getByText('Let me reason about this problem step by step.')
    ).toBeInTheDocument();
  });

  it('collapses again on second click', async () => {
    const user = userEvent.setup();
    render(<ThinkingBlock text="Reasoning content" />);

    const toggle = screen.getByRole('button', { name: /thinking/i });
    await user.click(toggle); // expand
    expect(screen.getByText('Reasoning content')).toBeInTheDocument();

    await user.click(toggle); // collapse
    expect(screen.queryByText('Reasoning content')).not.toBeInTheDocument();
  });

  it('shows duration when provided', () => {
    render(<ThinkingBlock text="Deep thought" durationMs={4500} />);
    expect(screen.getByText(/4\.5s/)).toBeInTheDocument();
  });

  it('renders with italic styling for the thinking text', async () => {
    const user = userEvent.setup();
    const { container } = render(<ThinkingBlock text="Italic thoughts" />);

    const toggle = screen.getByRole('button', { name: /thinking/i });
    await user.click(toggle);

    const textEl = container.querySelector('[data-testid="thinking-text"]');
    expect(textEl).toBeInTheDocument();
    expect(textEl?.className).toContain('italic');
  });

  it('does not render when text is empty', () => {
    const { container } = render(<ThinkingBlock text="" />);
    expect(container.firstChild).toBeNull();
  });
});
