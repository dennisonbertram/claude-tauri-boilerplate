import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotebookViewer } from '../NotebookViewer';
import type { NotebookData } from '../NotebookViewer';

// --- Sample notebook data ---
const sampleNotebook: NotebookData = {
  cells: [
    {
      cell_type: 'code',
      source: ["print('hello')\n"],
      execution_count: 1,
      outputs: [
        { output_type: 'stream', text: ['hello\n'] },
      ],
    },
    {
      cell_type: 'markdown',
      source: ['# Title\n', 'Some text'],
    },
    {
      cell_type: 'code',
      source: ['import numpy as np\n', 'x = np.array([1, 2, 3])\n'],
      execution_count: 2,
      outputs: [],
    },
  ],
  metadata: { kernelspec: { display_name: 'Python 3', language: 'python' } },
  nbformat: 4,
  nbformat_minor: 5,
};

const notebookWithImage: NotebookData = {
  cells: [
    {
      cell_type: 'code',
      source: ['plt.plot([1, 2, 3])\n'],
      execution_count: 3,
      outputs: [
        {
          output_type: 'display_data',
          data: {
            'image/png': 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          },
        },
      ],
    },
  ],
  metadata: {},
  nbformat: 4,
  nbformat_minor: 5,
};

const emptyNotebook: NotebookData = {
  cells: [],
  metadata: {},
  nbformat: 4,
  nbformat_minor: 5,
};

// =====================================================================
// NotebookViewer
// =====================================================================
describe('NotebookViewer', () => {
  it('renders code cells with source', () => {
    render(<NotebookViewer notebook={sampleNotebook} />);
    expect(screen.getByText(/print\('hello'\)/)).toBeInTheDocument();
  });

  it('renders markdown cells', () => {
    render(<NotebookViewer notebook={sampleNotebook} />);
    // The markdown renderer should render "# Title" as a heading
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Some text')).toBeInTheDocument();
  });

  it('renders output text from stream outputs', () => {
    render(<NotebookViewer notebook={sampleNotebook} />);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('renders base64 images from display_data outputs', () => {
    render(<NotebookViewer notebook={notebookWithImage} />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', expect.stringContaining('data:image/png;base64,'));
  });

  it('shows execution count badge for code cells', () => {
    render(<NotebookViewer notebook={sampleNotebook} />);
    const badges = screen.getAllByTestId('execution-count');
    expect(badges[0]).toHaveTextContent('[1]');
    expect(badges[1]).toHaveTextContent('[2]');
  });

  it('shows cell count badge in header', () => {
    render(<NotebookViewer notebook={sampleNotebook} />);
    const badge = screen.getByTestId('cell-count-badge');
    expect(badge).toHaveTextContent('3 cells');
  });

  it('handles empty notebook gracefully', () => {
    render(<NotebookViewer notebook={emptyNotebook} />);
    const badge = screen.getByTestId('cell-count-badge');
    expect(badge).toHaveTextContent('0 cells');
    expect(screen.getByText(/no cells/i)).toBeInTheDocument();
  });

  it('renders cell dividers between cells', () => {
    render(<NotebookViewer notebook={sampleNotebook} />);
    const dividers = screen.getAllByTestId('cell-divider');
    // Dividers between cells: 3 cells -> 2 dividers
    expect(dividers).toHaveLength(2);
  });

  it('cells are collapsible on click', () => {
    render(<NotebookViewer notebook={sampleNotebook} />);
    // Find a cell header and click to collapse
    const cellHeaders = screen.getAllByTestId('cell-header');
    expect(cellHeaders.length).toBeGreaterThan(0);

    // The first code cell should show its content
    expect(screen.getByText(/print\('hello'\)/)).toBeInTheDocument();

    // Click to collapse the first cell
    fireEvent.click(cellHeaders[0]);

    // Content should be hidden after collapse
    expect(screen.queryByText(/print\('hello'\)/)).not.toBeInTheDocument();
  });

  it('renders execute_result output type', () => {
    const notebookWithResult: NotebookData = {
      cells: [
        {
          cell_type: 'code',
          source: ['2 + 2\n'],
          execution_count: 1,
          outputs: [
            {
              output_type: 'execute_result',
              data: { 'text/plain': ['4'] },
              execution_count: 1,
            },
          ],
        },
      ],
      metadata: {},
      nbformat: 4,
      nbformat_minor: 5,
    };
    render(<NotebookViewer notebook={notebookWithResult} />);
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders error output type', () => {
    const notebookWithError: NotebookData = {
      cells: [
        {
          cell_type: 'code',
          source: ['1/0\n'],
          execution_count: 1,
          outputs: [
            {
              output_type: 'error',
              ename: 'ZeroDivisionError',
              evalue: 'division by zero',
              traceback: ['ZeroDivisionError: division by zero'],
            },
          ],
        },
      ],
      metadata: {},
      nbformat: 4,
      nbformat_minor: 5,
    };
    render(<NotebookViewer notebook={notebookWithError} />);
    expect(screen.getByText(/ZeroDivisionError/)).toBeInTheDocument();
  });

  it('handles null execution_count', () => {
    const notebookNullExec: NotebookData = {
      cells: [
        {
          cell_type: 'code',
          source: ['x = 1\n'],
          execution_count: null,
          outputs: [],
        },
      ],
      metadata: {},
      nbformat: 4,
      nbformat_minor: 5,
    };
    render(<NotebookViewer notebook={notebookNullExec} />);
    const badge = screen.getByTestId('execution-count');
    expect(badge).toHaveTextContent('[ ]');
  });
});
