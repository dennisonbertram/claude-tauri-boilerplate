import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolCallBlock } from './ToolCallBlock';
import type { ToolCallState } from '@/hooks/useStreamEvents';

function makeToolCall(overrides: Partial<ToolCallState> = {}): ToolCallState {
  return {
    toolUseId: 'tool-1',
    name: 'Read',
    status: 'running',
    input: '{"file_path":"/src/index.ts"}',
    ...overrides,
  };
}

describe('ToolCallBlock', () => {
  it('renders the tool name', () => {
    render(<ToolCallBlock toolCall={makeToolCall()} />);
    expect(screen.getByText('Read')).toBeInTheDocument();
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
    expect(screen.getByText(/file_path/)).toBeInTheDocument();
  });

  it('is collapsed by default when complete', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({ status: 'complete', result: 'file contents' })}
      />
    );
    // Input section should not be visible when collapsed
    expect(screen.queryByText(/file_path/)).not.toBeInTheDocument();
  });

  it('can be toggled open and closed', async () => {
    const user = userEvent.setup();
    render(
      <ToolCallBlock
        toolCall={makeToolCall({ status: 'complete', result: 'file contents' })}
      />
    );

    // Initially collapsed -- input not visible
    expect(screen.queryByText(/file_path/)).not.toBeInTheDocument();

    // Click to expand
    const header = screen.getByRole('button', { name: /Read/i });
    await user.click(header);

    // Now input should be visible
    expect(screen.getByText(/file_path/)).toBeInTheDocument();
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
    const header = screen.getByRole('button', { name: /Read/i });
    await user.click(header);

    expect(screen.getByText(/const x = 42/)).toBeInTheDocument();
  });

  it('shows summary text when available', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({
          status: 'complete',
          summary: 'Read file /src/index.ts (42 lines)',
        })}
      />
    );
    expect(screen.getByText(/Read file \/src\/index\.ts/)).toBeInTheDocument();
  });

  it('shows elapsed time when available and running', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({ status: 'running', elapsedSeconds: 3 })}
      />
    );
    expect(screen.getByText(/3s/)).toBeInTheDocument();
  });

  it('renders Bash tool output with terminal styling', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ToolCallBlock
        toolCall={makeToolCall({
          name: 'Bash',
          status: 'complete',
          input: '{"command":"ls -la"}',
          result: 'total 42\ndrwxr-xr-x  5 user  staff  160 Mar 14 10:00 .',
        })}
      />
    );

    // Expand
    const header = screen.getByRole('button', { name: /Bash/i });
    await user.click(header);

    // Result should be in a terminal-styled container
    const terminal = container.querySelector('[data-testid="terminal-output"]');
    expect(terminal).toBeInTheDocument();
  });
});
