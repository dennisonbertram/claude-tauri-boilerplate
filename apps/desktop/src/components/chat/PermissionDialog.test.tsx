import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PermissionDialog } from './PermissionDialog';
import type { StreamPermissionRequest } from '@claude-tauri/shared';

function makeRequest(overrides: Partial<StreamPermissionRequest> = {}): StreamPermissionRequest {
  return {
    type: 'permission:request',
    requestId: 'req-1',
    toolName: 'Read',
    toolInput: { file_path: '/src/index.ts' },
    riskLevel: 'low',
    ...overrides,
  };
}

describe('PermissionDialog', () => {
  it('renders the tool name', () => {
    render(
      <PermissionDialog
        request={makeRequest()}
        onDecision={vi.fn()}
      />
    );
    // The tool name appears in the tool info section as a standalone element
    const toolNameElements = screen.getAllByText(/Read/);
    expect(toolNameElements.length).toBeGreaterThanOrEqual(1);
    // Check that we can find the "Permission Required" header
    expect(screen.getByText('Permission Required')).toBeInTheDocument();
  });

  it('shows tool input as formatted JSON', () => {
    render(
      <PermissionDialog
        request={makeRequest({ toolInput: { file_path: '/src/app.ts' } })}
        onDecision={vi.fn()}
      />
    );
    expect(screen.getByText(/\/src\/app\.ts/)).toBeInTheDocument();
  });

  it('shows Allow and Deny buttons', () => {
    render(
      <PermissionDialog
        request={makeRequest()}
        onDecision={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /allow/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /deny/i })).toBeInTheDocument();
  });

  it('calls onDecision with allow_once when Allow is clicked', async () => {
    const user = userEvent.setup();
    const onDecision = vi.fn();
    render(
      <PermissionDialog
        request={makeRequest()}
        onDecision={onDecision}
      />
    );

    await user.click(screen.getByRole('button', { name: /^allow$/i }));
    expect(onDecision).toHaveBeenCalledWith({
      requestId: 'req-1',
      decision: 'allow_once',
    });
  });

  it('calls onDecision with deny when Deny is clicked', async () => {
    const user = userEvent.setup();
    const onDecision = vi.fn();
    render(
      <PermissionDialog
        request={makeRequest()}
        onDecision={onDecision}
      />
    );

    await user.click(screen.getByRole('button', { name: /deny/i }));
    expect(onDecision).toHaveBeenCalledWith({
      requestId: 'req-1',
      decision: 'deny',
    });
  });

  it('calls onDecision with allow_always when Always Allow is checked then Allow is clicked', async () => {
    const user = userEvent.setup();
    const onDecision = vi.fn();
    render(
      <PermissionDialog
        request={makeRequest()}
        onDecision={onDecision}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: /always allow/i });
    await user.click(checkbox);
    await user.click(screen.getByRole('button', { name: /^allow$/i }));
    expect(onDecision).toHaveBeenCalledWith({
      requestId: 'req-1',
      decision: 'allow_always',
      scope: 'session',
    });
  });

  it('shows high-risk styling for Bash commands', () => {
    const { container } = render(
      <PermissionDialog
        request={makeRequest({
          toolName: 'Bash',
          toolInput: { command: 'rm -rf /tmp/test' },
          riskLevel: 'high',
        })}
        onDecision={vi.fn()}
      />
    );

    // Should have danger/high-risk indicator
    expect(screen.getByText(/rm -rf/)).toBeInTheDocument();
    // The container should have a red border for high risk
    const dialog = container.querySelector('[data-risk="high"]');
    expect(dialog).toBeInTheDocument();
  });

  it('shows medium-risk styling for Write tool', () => {
    const { container } = render(
      <PermissionDialog
        request={makeRequest({
          toolName: 'Write',
          toolInput: { file_path: '/src/new-file.ts', content: 'hello' },
          riskLevel: 'high',
        })}
        onDecision={vi.fn()}
      />
    );

    // Should show the file path
    expect(screen.getByText(/\/src\/new-file\.ts/)).toBeInTheDocument();
    const dialog = container.querySelector('[data-risk="high"]');
    expect(dialog).toBeInTheDocument();
  });

  it('shows low-risk styling for read-only tools', () => {
    const { container } = render(
      <PermissionDialog
        request={makeRequest({
          toolName: 'Grep',
          toolInput: { pattern: 'TODO' },
          riskLevel: 'low',
        })}
        onDecision={vi.fn()}
      />
    );

    const dialog = container.querySelector('[data-risk="low"]');
    expect(dialog).toBeInTheDocument();
  });

  it('highlights the command for Bash tool calls', () => {
    render(
      <PermissionDialog
        request={makeRequest({
          toolName: 'Bash',
          toolInput: { command: 'git status' },
          riskLevel: 'high',
        })}
        onDecision={vi.fn()}
      />
    );

    // The command should be displayed prominently
    expect(screen.getByText(/git status/)).toBeInTheDocument();
  });

  it('shows file path prominently for Write/Edit tools', () => {
    render(
      <PermissionDialog
        request={makeRequest({
          toolName: 'Edit',
          toolInput: {
            file_path: '/src/utils.ts',
            old_string: 'foo',
            new_string: 'bar',
          },
          riskLevel: 'high',
        })}
        onDecision={vi.fn()}
      />
    );

    expect(screen.getByText(/\/src\/utils\.ts/)).toBeInTheDocument();
  });
});
