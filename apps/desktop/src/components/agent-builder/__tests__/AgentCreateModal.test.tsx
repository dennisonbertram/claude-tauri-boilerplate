import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentCreateModal } from '../AgentCreateModal';

describe('AgentCreateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when closed', () => {
    render(
      <AgentCreateModal
        isOpen={false}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
        onCreateBlank={vi.fn()}
        onGenerate={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders both blank and AI creation paths', () => {
    render(
      <AgentCreateModal
        isOpen={true}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
        onCreateBlank={vi.fn()}
        onGenerate={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/create a new agent/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create blank profile/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/agent idea/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate with ai/i })).toBeInTheDocument();
  });

  it('submits the blank and AI flows', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCreateBlank = vi.fn();
    const onGenerate = vi.fn();

    render(
      <AgentCreateModal
        isOpen={true}
        isLoading={false}
        error={null}
        onClose={onClose}
        onCreateBlank={onCreateBlank}
        onGenerate={onGenerate}
      />
    );

    await user.click(screen.getByRole('button', { name: /create blank profile/i }));
    expect(onCreateBlank).toHaveBeenCalledOnce();

    await user.type(screen.getByLabelText(/agent idea/i), 'A concise research agent');
    await user.click(screen.getByRole('button', { name: /generate with ai/i }));

    expect(onGenerate).toHaveBeenCalledWith('A concise research agent');
  });
});
