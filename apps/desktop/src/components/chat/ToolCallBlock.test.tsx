import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolCallBlock } from './ToolCallBlock';
import type { ToolCallState } from '@/hooks/useStreamEvents';

function makeToolCall(overrides: Partial<ToolCallState> = {}): ToolCallState {
  return {
    toolUseId: 'tool-1',
    name: 'Grep',
    status: 'running',
    input: '{"pattern":"TODO","path":"/src"}',
    ...overrides,
  };
}

describe('ToolCallBlock', () => {
  it('renders the tool name', () => {
    render(<ToolCallBlock toolCall={makeToolCall()} />);
    expect(screen.getByText('Grep')).toBeInTheDocument();
  });

  it('shows a spinner indicator when status is running', () => {
    const { container } = render(<ToolCallBlock toolCall={makeToolCall({ status: 'running' })} />);
    const spinner = container.querySelector('[data-testid="status-running"]');
    expect(spinner).toBeInTheDocument();
  });

  it('shows a checkmark indicator when status is complete', () => {
    const { container } = render(
      <ToolCallBlock toolCall={makeToolCall({ status: 'complete', result: 'done' })} />
    );
    const check = container.querySelector('[data-testid="status-complete"]');
    expect(check).toBeInTheDocument();
  });

  it('shows an error indicator when status is error', () => {
    const { container } = render(
      <ToolCallBlock toolCall={makeToolCall({ status: 'error' })} />
    );
    const errorIcon = container.querySelector('[data-testid="status-error"]');
    expect(errorIcon).toBeInTheDocument();
  });

  it('is expanded by default when running', () => {
    render(<ToolCallBlock toolCall={makeToolCall({ status: 'running' })} />);
    // Input section should be visible when running
    expect(screen.getByText(/pattern/)).toBeInTheDocument();
  });

  it('is collapsed by default when complete', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({ status: 'complete', result: 'search results' })}
      />
    );
    // Input section should not be visible when collapsed
    expect(screen.queryByText(/pattern/)).not.toBeInTheDocument();
  });

  it('can be toggled open and closed', async () => {
    const user = userEvent.setup();
    render(
      <ToolCallBlock
        toolCall={makeToolCall({ status: 'complete', result: 'search results' })}
      />
    );

    // Initially collapsed -- input not visible
    expect(screen.queryByText(/pattern/)).not.toBeInTheDocument();

    // Click to expand
    const header = screen.getByRole('button', { name: /Grep/i });
    await user.click(header);

    // Now input should be visible
    expect(screen.getByText(/pattern/)).toBeInTheDocument();
  });

  it('renders the result when complete and expanded', async () => {
    const user = userEvent.setup();
    render(
      <ToolCallBlock
        toolCall={makeToolCall({
          status: 'complete',
          result: 'const x = 42;',
        })}
      />
    );

    // Expand
    const header = screen.getByRole('button', { name: /Grep/i });
    await user.click(header);

    expect(screen.getByText(/const x = 42/)).toBeInTheDocument();
  });

  it('shows summary text when available', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({
          status: 'complete',
          summary: 'Found 42 matches in /src',
        })}
      />
    );
    expect(screen.getByText(/Found 42 matches in \/src/)).toBeInTheDocument();
  });

  it('shows elapsed time when available and running', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({ status: 'running', elapsedSeconds: 3 })}
      />
    );
    expect(screen.getByText(/3s/)).toBeInTheDocument();
  });

  it('renders Bash tool calls with BashDisplay component', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({
          name: 'Bash',
          status: 'complete',
          input: '{"command":"ls -la"}',
          result: 'total 42\ndrwxr-xr-x  5 user  staff  160 Mar 14 10:00 .',
        })}
      />
    );

    // BashDisplay renders the command in a code element
    const command = screen.getByTestId('bash-command');
    expect(command).toHaveTextContent('ls -la');

    // Output is shown in the bash-output area (visible by default)
    const output = screen.getByTestId('bash-output');
    expect(output).toHaveTextContent('total 42');
  });
});
