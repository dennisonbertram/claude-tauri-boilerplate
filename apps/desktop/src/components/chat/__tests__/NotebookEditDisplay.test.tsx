import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NotebookEditDisplay } from '../NotebookEditDisplay';
import { ToolCallBlock } from '../ToolCallBlock';
import { FileReadDisplay } from '../FileReadDisplay';
import type { ToolCallState } from '@/hooks/useStreamEvents';

// --- Helper to build a ToolCallState ---
function makeToolCall(overrides: Partial<ToolCallState> & { name: string }): ToolCallState {
  return {
    toolUseId: 'tool-1',
    status: 'complete',
    input: '',
    ...overrides,
  };
}

// =====================================================================
// NotebookEditDisplay
// =====================================================================
describe('NotebookEditDisplay', () => {
  it('shows cell number being edited', () => {
    render(
      <NotebookEditDisplay
        toolCall={makeToolCall({
          name: 'NotebookEdit',
          input: JSON.stringify({
            notebook_path: '/path/to/notebook.ipynb',
            cell_number: 3,
            new_source: 'print("updated")',
          }),
        })}
      />
    );
    expect(screen.getByTestId('cell-number')).toHaveTextContent('3');
  });

  it('shows edit mode replace', () => {
    render(
      <NotebookEditDisplay
        toolCall={makeToolCall({
          name: 'NotebookEdit',
          input: JSON.stringify({
            notebook_path: '/path/to/notebook.ipynb',
            cell_number: 0,
            new_source: 'x = 1',
            edit_mode: 'replace',
          }),
        })}
      />
    );
    expect(screen.getByTestId('edit-mode')).toHaveTextContent(/replace/i);
  });

  it('shows edit mode insert', () => {
    render(
      <NotebookEditDisplay
        toolCall={makeToolCall({
          name: 'NotebookEdit',
          input: JSON.stringify({
            notebook_path: '/path/to/notebook.ipynb',
            cell_number: 2,
            new_source: '# New cell',
            edit_mode: 'insert',
            cell_type: 'markdown',
          }),
        })}
      />
    );
    expect(screen.getByTestId('edit-mode')).toHaveTextContent(/insert/i);
  });

  it('shows edit mode delete', () => {
    render(
      <NotebookEditDisplay
        toolCall={makeToolCall({
          name: 'NotebookEdit',
          input: JSON.stringify({
            notebook_path: '/path/to/notebook.ipynb',
            cell_number: 1,
            new_source: '',
            edit_mode: 'delete',
          }),
        })}
      />
    );
    expect(screen.getByTestId('edit-mode')).toHaveTextContent(/delete/i);
  });

  it('shows the new source content', () => {
    render(
      <NotebookEditDisplay
        toolCall={makeToolCall({
          name: 'NotebookEdit',
          input: JSON.stringify({
            notebook_path: '/path/to/notebook.ipynb',
            cell_number: 0,
            new_source: 'import pandas as pd\ndf = pd.read_csv("data.csv")',
          }),
        })}
      />
    );
    expect(screen.getByTestId('new-source')).toHaveTextContent(/import pandas as pd/);
  });

  it('shows notebook path', () => {
    render(
      <NotebookEditDisplay
        toolCall={makeToolCall({
          name: 'NotebookEdit',
          input: JSON.stringify({
            notebook_path: '/path/to/analysis.ipynb',
            cell_number: 0,
            new_source: 'x = 1',
          }),
        })}
      />
    );
    expect(screen.getByText('/path/to/analysis.ipynb')).toBeInTheDocument();
  });

  it('shows cell type when provided', () => {
    render(
      <NotebookEditDisplay
        toolCall={makeToolCall({
          name: 'NotebookEdit',
          input: JSON.stringify({
            notebook_path: '/path/to/notebook.ipynb',
            cell_number: 0,
            new_source: '# Header',
            cell_type: 'markdown',
          }),
        })}
      />
    );
    expect(screen.getByTestId('cell-type')).toHaveTextContent(/markdown/i);
  });

  it('renders status indicator', () => {
    render(
      <NotebookEditDisplay
        toolCall={makeToolCall({
          name: 'NotebookEdit',
          status: 'running',
          input: JSON.stringify({
            notebook_path: '/path/to/notebook.ipynb',
            cell_number: 0,
            new_source: 'x = 1',
          }),
        })}
      />
    );
    expect(screen.getByTestId('status-running')).toBeInTheDocument();
  });
});

// =====================================================================
// ToolCallBlock routing for NotebookEdit
// =====================================================================
describe('ToolCallBlock routing for NotebookEdit', () => {
  it('routes NotebookEdit to NotebookEditDisplay', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({
          name: 'NotebookEdit',
          input: JSON.stringify({
            notebook_path: '/path/to/notebook.ipynb',
            cell_number: 0,
            new_source: 'x = 1',
          }),
        })}
      />
    );
    expect(screen.getByTestId('cell-number')).toBeInTheDocument();
  });
});

// =====================================================================
// FileReadDisplay .ipynb detection
// =====================================================================
describe('FileReadDisplay .ipynb detection', () => {
  it('detects .ipynb files and renders NotebookViewer', () => {
    const notebookJson = JSON.stringify({
      cells: [
        {
          cell_type: 'code',
          source: ["print('hello')\n"],
          execution_count: 1,
          outputs: [{ output_type: 'stream', text: ['hello\n'] }],
        },
      ],
      metadata: {},
      nbformat: 4,
      nbformat_minor: 5,
    });

    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          input: JSON.stringify({ file_path: '/path/to/notebook.ipynb' }),
          result: notebookJson,
        })}
      />
    );
    // NotebookViewer renders with cell-count-badge
    expect(screen.getByTestId('cell-count-badge')).toBeInTheDocument();
    expect(screen.getByText(/print\('hello'\)/)).toBeInTheDocument();
  });

  it('still renders normal display for non-ipynb files', () => {
    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          input: JSON.stringify({ file_path: '/path/to/file.py' }),
          result: 'print("hello")',
        })}
      />
    );
    // Should show normal file-content, not notebook viewer
    expect(screen.getByTestId('file-content')).toBeInTheDocument();
    expect(screen.queryByTestId('cell-count-badge')).not.toBeInTheDocument();
  });
});
