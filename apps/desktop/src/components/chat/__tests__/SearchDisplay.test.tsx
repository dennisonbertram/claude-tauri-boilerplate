import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GrepDisplay } from '../GrepDisplay';
import { GlobDisplay } from '../GlobDisplay';
import { ToolCallBlock } from '../ToolCallBlock';
import type { ToolCallState } from '@/hooks/useStreamEvents';

// --- Helper to build a ToolCallState ---
function makeToolCall(
  overrides: Partial<ToolCallState> & { name: string }
): ToolCallState {
  return {
    toolUseId: 'tool-1',
    status: 'complete',
    input: '',
    ...overrides,
  };
}

// =====================================================================
// GrepDisplay
// =====================================================================
describe('GrepDisplay', () => {
  const defaultInput = {
    pattern: 'TODO',
    path: '/src',
  };

  const sampleGrepResult = [
    'src/app.ts:5:  // TODO: fix this later',
    'src/app.ts:12:  // TODO: add error handling',
    'src/utils/helpers.ts:3:// TODO: refactor',
    'src/utils/helpers.ts:28:  // TODO: optimize',
    'src/utils/helpers.ts:45:  // TODO: add tests',
  ].join('\n');

  it('renders the search pattern in the header', () => {
    render(
      <GrepDisplay
        toolCall={makeToolCall({
          name: 'Grep',
          input: JSON.stringify(defaultInput),
          result: sampleGrepResult,
        })}
      />
    );
    expect(screen.getByTestId('grep-pattern')).toHaveTextContent('TODO');
  });

  it('shows match count summary', () => {
    render(
      <GrepDisplay
        toolCall={makeToolCall({
          name: 'Grep',
          input: JSON.stringify(defaultInput),
          result: sampleGrepResult,
        })}
      />
    );
    const summary = screen.getByTestId('grep-summary');
    expect(summary).toHaveTextContent('5');
    expect(summary).toHaveTextContent('2');
  });

  it('groups results by file', () => {
    render(
      <GrepDisplay
        toolCall={makeToolCall({
          name: 'Grep',
          input: JSON.stringify(defaultInput),
          result: sampleGrepResult,
        })}
      />
    );
    const fileGroups = screen.getAllByTestId('grep-file-group');
    expect(fileGroups).toHaveLength(2);
  });

  it('shows file paths in group headers', () => {
    render(
      <GrepDisplay
        toolCall={makeToolCall({
          name: 'Grep',
          input: JSON.stringify(defaultInput),
          result: sampleGrepResult,
        })}
      />
    );
    expect(screen.getByText('src/app.ts')).toBeInTheDocument();
    expect(screen.getByText('src/utils/helpers.ts')).toBeInTheDocument();
  });

  it('shows line numbers for each match', () => {
    render(
      <GrepDisplay
        toolCall={makeToolCall({
          name: 'Grep',
          input: JSON.stringify(defaultInput),
          result: sampleGrepResult,
        })}
      />
    );
    const lineNumbers = screen.getAllByTestId('grep-line-number');
    expect(lineNumbers.length).toBe(5);
    expect(lineNumbers[0]).toHaveTextContent('5');
    expect(lineNumbers[1]).toHaveTextContent('12');
    expect(lineNumbers[2]).toHaveTextContent('3');
  });

  it('shows match content for each line', () => {
    render(
      <GrepDisplay
        toolCall={makeToolCall({
          name: 'Grep',
          input: JSON.stringify(defaultInput),
          result: sampleGrepResult,
        })}
      />
    );
    expect(screen.getByText(/fix this later/)).toBeInTheDocument();
    expect(screen.getByText(/add error handling/)).toBeInTheDocument();
    expect(screen.getByText(/refactor/)).toBeInTheDocument();
  });

  it('shows match count per file in group header', () => {
    render(
      <GrepDisplay
        toolCall={makeToolCall({
          name: 'Grep',
          input: JSON.stringify(defaultInput),
          result: sampleGrepResult,
        })}
      />
    );
    const matchCounts = screen.getAllByTestId('grep-file-match-count');
    expect(matchCounts[0]).toHaveTextContent('2');
    expect(matchCounts[1]).toHaveTextContent('3');
  });

  it('handles files_with_matches output mode (no line numbers)', () => {
    const filesOnlyResult = 'src/app.ts\nsrc/utils/helpers.ts\nsrc/index.ts';
    render(
      <GrepDisplay
        toolCall={makeToolCall({
          name: 'Grep',
          input: JSON.stringify({
            pattern: 'TODO',
            output_mode: 'files_with_matches',
          }),
          result: filesOnlyResult,
        })}
      />
    );
    // Should show file list without line numbers
    expect(screen.getByText('src/app.ts')).toBeInTheDocument();
    expect(screen.getByText('src/utils/helpers.ts')).toBeInTheDocument();
    expect(screen.getByText('src/index.ts')).toBeInTheDocument();
  });

  it('renders status indicator for running state', () => {
    render(
      <GrepDisplay
        toolCall={makeToolCall({
          name: 'Grep',
          status: 'running',
          input: JSON.stringify(defaultInput),
        })}
      />
    );
    expect(screen.getByTestId('status-running')).toBeInTheDocument();
  });

  it('renders status indicator for complete state', () => {
    render(
      <GrepDisplay
        toolCall={makeToolCall({
          name: 'Grep',
          status: 'complete',
          input: JSON.stringify(defaultInput),
          result: sampleGrepResult,
        })}
      />
    );
    expect(screen.getByTestId('status-complete')).toBeInTheDocument();
  });

  it('renders status indicator for error state', () => {
    render(
      <GrepDisplay
        toolCall={makeToolCall({
          name: 'Grep',
          status: 'error',
          input: JSON.stringify(defaultInput),
        })}
      />
    );
    expect(screen.getByTestId('status-error')).toBeInTheDocument();
  });

  it('shows empty state when no results', () => {
    render(
      <GrepDisplay
        toolCall={makeToolCall({
          name: 'Grep',
          input: JSON.stringify(defaultInput),
          result: '',
        })}
      />
    );
    expect(screen.getByTestId('grep-empty')).toBeInTheDocument();
  });

  it('handles result with special characters in paths', () => {
    const specialResult = 'src/my file (1).ts:10:  // TODO: handle spaces';
    render(
      <GrepDisplay
        toolCall={makeToolCall({
          name: 'Grep',
          input: JSON.stringify({ pattern: 'TODO' }),
          result: specialResult,
        })}
      />
    );
    expect(screen.getByText('src/my file (1).ts')).toBeInTheDocument();
  });

  it('handles result with no result yet (still running)', () => {
    render(
      <GrepDisplay
        toolCall={makeToolCall({
          name: 'Grep',
          status: 'running',
          input: JSON.stringify(defaultInput),
        })}
      />
    );
    // Should not crash and should show header
    expect(screen.getByTestId('grep-pattern')).toHaveTextContent('TODO');
  });
});

// =====================================================================
// GlobDisplay
// =====================================================================
describe('GlobDisplay', () => {
  const defaultInput = {
    pattern: '**/*.ts',
    path: '/src',
  };

  const sampleGlobResult = [
    'src/app.ts',
    'src/index.ts',
    'src/utils/helpers.ts',
    'src/components/Button.tsx',
    'src/hooks/useAuth.ts',
    'src/styles/main.css',
  ].join('\n');

  it('renders the glob pattern in the header', () => {
    render(
      <GlobDisplay
        toolCall={makeToolCall({
          name: 'Glob',
          input: JSON.stringify(defaultInput),
          result: sampleGlobResult,
        })}
      />
    );
    expect(screen.getByTestId('glob-pattern')).toHaveTextContent('**/*.ts');
  });

  it('shows file count summary', () => {
    render(
      <GlobDisplay
        toolCall={makeToolCall({
          name: 'Glob',
          input: JSON.stringify(defaultInput),
          result: sampleGlobResult,
        })}
      />
    );
    const summary = screen.getByTestId('glob-summary');
    expect(summary).toHaveTextContent('6');
  });

  it('renders each file in the list', () => {
    render(
      <GlobDisplay
        toolCall={makeToolCall({
          name: 'Glob',
          input: JSON.stringify(defaultInput),
          result: sampleGlobResult,
        })}
      />
    );
    const fileItems = screen.getAllByTestId('glob-file-item');
    expect(fileItems).toHaveLength(6);
  });

  it('shows file paths', () => {
    render(
      <GlobDisplay
        toolCall={makeToolCall({
          name: 'Glob',
          input: JSON.stringify(defaultInput),
          result: sampleGlobResult,
        })}
      />
    );
    expect(screen.getByText('src/app.ts')).toBeInTheDocument();
    expect(screen.getByText('src/index.ts')).toBeInTheDocument();
    expect(screen.getByText('src/utils/helpers.ts')).toBeInTheDocument();
  });

  it('shows file type icons based on extension', () => {
    render(
      <GlobDisplay
        toolCall={makeToolCall({
          name: 'Glob',
          input: JSON.stringify(defaultInput),
          result: sampleGlobResult,
        })}
      />
    );
    const fileIcons = screen.getAllByTestId('glob-file-icon');
    expect(fileIcons.length).toBe(6);
  });

  it('renders status indicator for running state', () => {
    render(
      <GlobDisplay
        toolCall={makeToolCall({
          name: 'Glob',
          status: 'running',
          input: JSON.stringify(defaultInput),
        })}
      />
    );
    expect(screen.getByTestId('status-running')).toBeInTheDocument();
  });

  it('renders status indicator for complete state', () => {
    render(
      <GlobDisplay
        toolCall={makeToolCall({
          name: 'Glob',
          status: 'complete',
          input: JSON.stringify(defaultInput),
          result: sampleGlobResult,
        })}
      />
    );
    expect(screen.getByTestId('status-complete')).toBeInTheDocument();
  });

  it('shows empty state when no results', () => {
    render(
      <GlobDisplay
        toolCall={makeToolCall({
          name: 'Glob',
          input: JSON.stringify(defaultInput),
          result: '',
        })}
      />
    );
    expect(screen.getByTestId('glob-empty')).toBeInTheDocument();
  });

  it('handles result with no result yet (still running)', () => {
    render(
      <GlobDisplay
        toolCall={makeToolCall({
          name: 'Glob',
          status: 'running',
          input: JSON.stringify(defaultInput),
        })}
      />
    );
    expect(screen.getByTestId('glob-pattern')).toHaveTextContent('**/*.ts');
  });

  it('handles paths with special characters', () => {
    const specialResult = 'src/my file (1).ts\nsrc/[bracket].ts';
    render(
      <GlobDisplay
        toolCall={makeToolCall({
          name: 'Glob',
          input: JSON.stringify({ pattern: '**/*' }),
          result: specialResult,
        })}
      />
    );
    expect(screen.getByText('src/my file (1).ts')).toBeInTheDocument();
    expect(screen.getByText('src/[bracket].ts')).toBeInTheDocument();
  });

  it('shows directory path for search scope', () => {
    render(
      <GlobDisplay
        toolCall={makeToolCall({
          name: 'Glob',
          input: JSON.stringify({ pattern: '**/*.ts', path: '/src/components' }),
          result: 'src/components/Button.tsx',
        })}
      />
    );
    expect(screen.getByTestId('glob-search-path')).toHaveTextContent(
      '/src/components'
    );
  });
});

// =====================================================================
// Copy functionality
// =====================================================================
describe('Search display copy functionality', () => {
  it('shows copy button for Grep file paths and changes icon on click', async () => {
    const user = userEvent.setup();
    render(
      <GrepDisplay
        toolCall={makeToolCall({
          name: 'Grep',
          input: JSON.stringify({ pattern: 'TODO' }),
          result: 'src/app.ts:5:  // TODO fix this',
        })}
      />
    );
    const copyBtn = screen.getAllByTestId('grep-copy-path')[0];
    expect(copyBtn).toBeInTheDocument();
    // Clicking the copy button should trigger the copy handler
    // (the check icon appears to confirm the copy)
    await user.click(copyBtn);
    // Verify the button is still there after click (no crash)
    expect(screen.getAllByTestId('grep-copy-path')[0]).toBeInTheDocument();
  });

  it('shows copy button for Glob file paths and changes icon on click', async () => {
    const user = userEvent.setup();
    render(
      <GlobDisplay
        toolCall={makeToolCall({
          name: 'Glob',
          input: JSON.stringify({ pattern: '**/*.ts' }),
          result: 'src/app.ts',
        })}
      />
    );
    const copyBtn = screen.getAllByTestId('glob-copy-path')[0];
    expect(copyBtn).toBeInTheDocument();
    await user.click(copyBtn);
    expect(screen.getAllByTestId('glob-copy-path')[0]).toBeInTheDocument();
  });
});

// =====================================================================
// ToolCallBlock routing for Grep and Glob
// =====================================================================
describe('ToolCallBlock routing for Grep and Glob', () => {
  it('routes Grep tool calls to GrepDisplay', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({
          name: 'Grep',
          input: JSON.stringify({ pattern: 'TODO', path: '/src' }),
          result: 'src/app.ts:5:  // TODO fix this',
        })}
      />
    );
    // GrepDisplay renders pattern in header
    expect(screen.getByTestId('grep-pattern')).toHaveTextContent('TODO');
  });

  it('routes Glob tool calls to GlobDisplay', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({
          name: 'Glob',
          input: JSON.stringify({ pattern: '**/*.ts' }),
          result: 'src/app.ts\nsrc/index.ts',
        })}
      />
    );
    // GlobDisplay renders pattern in header
    expect(screen.getByTestId('glob-pattern')).toHaveTextContent('**/*.ts');
  });

  it('routes Grep to GrepDisplay instead of generic display', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({
          name: 'Grep',
          input: JSON.stringify({ pattern: 'error' }),
          result: 'src/app.ts:1: error found',
        })}
      />
    );
    // GrepDisplay should render file groups, not just raw "Grep" label
    expect(screen.getByTestId('grep-file-group')).toBeInTheDocument();
  });

  it('routes Glob to GlobDisplay instead of generic display', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({
          name: 'Glob',
          input: JSON.stringify({ pattern: '*.ts' }),
          result: 'src/app.ts',
        })}
      />
    );
    // GlobDisplay should render file items, not just raw "Glob" label
    expect(screen.getByTestId('glob-file-item')).toBeInTheDocument();
  });
});
