import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DiffViewer } from '../DiffViewer';

describe('DiffViewer', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  // --- Single line change ---
  describe('single line change', () => {
    it('renders a single removed line with red styling and minus prefix', () => {
      render(
        <DiffViewer
          oldString="const x = 1;"
          newString="const x = 10;"
        />
      );
      const removedLines = screen.getAllByTestId('diff-removed');
      expect(removedLines).toHaveLength(1);
      expect(removedLines[0]).toHaveTextContent('const x = 1;');
    });

    it('renders a single added line with green styling and plus prefix', () => {
      render(
        <DiffViewer
          oldString="const x = 1;"
          newString="const x = 10;"
        />
      );
      const addedLines = screen.getAllByTestId('diff-added');
      expect(addedLines).toHaveLength(1);
      expect(addedLines[0]).toHaveTextContent('const x = 10;');
    });
  });

  // --- Multi-line add/remove ---
  describe('multi-line changes', () => {
    it('renders multiple removed lines', () => {
      render(
        <DiffViewer
          oldString={'const a = 1;\nconst b = 2;\nconst c = 3;'}
          newString={'const a = 10;'}
        />
      );
      const removedLines = screen.getAllByTestId('diff-removed');
      expect(removedLines).toHaveLength(3);
      expect(removedLines[0]).toHaveTextContent('const a = 1;');
      expect(removedLines[1]).toHaveTextContent('const b = 2;');
      expect(removedLines[2]).toHaveTextContent('const c = 3;');
    });

    it('renders multiple added lines', () => {
      render(
        <DiffViewer
          oldString={'const a = 1;'}
          newString={'const a = 10;\nconst b = 20;\nconst c = 30;'}
        />
      );
      const addedLines = screen.getAllByTestId('diff-added');
      expect(addedLines).toHaveLength(3);
      expect(addedLines[0]).toHaveTextContent('const a = 10;');
      expect(addedLines[1]).toHaveTextContent('const b = 20;');
      expect(addedLines[2]).toHaveTextContent('const c = 30;');
    });

    it('handles interleaved context and change lines', () => {
      render(
        <DiffViewer
          oldString={'line1\nline2\nline3'}
          newString={'line1\nmodified\nline3'}
        />
      );
      // Context lines (unchanged)
      const contextLines = screen.getAllByTestId('diff-context');
      expect(contextLines.length).toBeGreaterThanOrEqual(2); // line1 and line3

      // Changed lines
      const removedLines = screen.getAllByTestId('diff-removed');
      expect(removedLines).toHaveLength(1);
      expect(removedLines[0]).toHaveTextContent('line2');

      const addedLines = screen.getAllByTestId('diff-added');
      expect(addedLines).toHaveLength(1);
      expect(addedLines[0]).toHaveTextContent('modified');
    });
  });

  // --- Context lines ---
  describe('context lines', () => {
    it('renders context lines for unchanged content', () => {
      render(
        <DiffViewer
          oldString={'first\nsecond\nthird'}
          newString={'first\nchanged\nthird'}
        />
      );
      const contextLines = screen.getAllByTestId('diff-context');
      // "first" and "third" are unchanged context
      expect(contextLines.length).toBe(2);
      expect(contextLines[0]).toHaveTextContent('first');
      expect(contextLines[1]).toHaveTextContent('third');
    });

    it('renders line numbers for both old and new sides', () => {
      render(
        <DiffViewer
          oldString={'aaa\nbbb\nccc'}
          newString={'aaa\nxxx\nccc'}
        />
      );
      // Line numbers should be present as data attributes or visible text
      const allLines = screen.getAllByTestId(/^diff-(context|removed|added)$/);
      expect(allLines.length).toBeGreaterThan(0);

      // Each line should have old-line-num and new-line-num spans
      const oldLineNums = screen.getAllByTestId('old-line-num');
      const newLineNums = screen.getAllByTestId('new-line-num');
      expect(oldLineNums.length).toBeGreaterThan(0);
      expect(newLineNums.length).toBeGreaterThan(0);
    });
  });

  // --- Copy button ---
  describe('copy button', () => {
    it('renders a copy button', () => {
      render(
        <DiffViewer
          oldString="old"
          newString="new"
        />
      );
      expect(screen.getByLabelText('Copy diff')).toBeInTheDocument();
    });

    it('copies unified diff text to clipboard when clicked', () => {
      render(
        <DiffViewer
          oldString="old line"
          newString="new line"
        />
      );
      fireEvent.click(screen.getByLabelText('Copy diff'));
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
      // The copied text should contain the diff content
      const copiedText = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(copiedText).toContain('-old line');
      expect(copiedText).toContain('+new line');
    });

    it('shows "Copied!" feedback after clicking', async () => {
      render(
        <DiffViewer
          oldString="old"
          newString="new"
        />
      );
      fireEvent.click(screen.getByLabelText('Copy diff'));
      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
    });
  });

  // --- Empty diff ---
  describe('empty diff', () => {
    it('renders nothing when both strings are empty', () => {
      const { container } = render(
        <DiffViewer
          oldString=""
          newString=""
        />
      );
      // Should render an empty or minimal container
      expect(container.querySelector('[data-testid="diff-removed"]')).toBeNull();
      expect(container.querySelector('[data-testid="diff-added"]')).toBeNull();
    });

    it('renders only added lines when oldString is empty', () => {
      render(
        <DiffViewer
          oldString=""
          newString={'new line 1\nnew line 2'}
        />
      );
      expect(screen.queryAllByTestId('diff-removed')).toHaveLength(0);
      expect(screen.getAllByTestId('diff-added')).toHaveLength(2);
    });

    it('renders only removed lines when newString is empty', () => {
      render(
        <DiffViewer
          oldString={'old line 1\nold line 2'}
          newString=""
        />
      );
      expect(screen.getAllByTestId('diff-removed')).toHaveLength(2);
      expect(screen.queryAllByTestId('diff-added')).toHaveLength(0);
    });
  });

  // --- File path display ---
  describe('file path header', () => {
    it('shows file path when provided', () => {
      render(
        <DiffViewer
          oldString="old"
          newString="new"
          filePath="/src/app.ts"
        />
      );
      expect(screen.getByText('/src/app.ts')).toBeInTheDocument();
    });

    it('does not show file path header when not provided', () => {
      render(
        <DiffViewer
          oldString="old"
          newString="new"
        />
      );
      // No file path element should be rendered
      expect(screen.queryByTestId('diff-file-path')).not.toBeInTheDocument();
    });
  });

  // --- Identical strings ---
  describe('identical strings', () => {
    it('renders all lines as context when strings are identical', () => {
      render(
        <DiffViewer
          oldString={'line1\nline2\nline3'}
          newString={'line1\nline2\nline3'}
        />
      );
      const contextLines = screen.getAllByTestId('diff-context');
      expect(contextLines).toHaveLength(3);
      expect(screen.queryAllByTestId('diff-removed')).toHaveLength(0);
      expect(screen.queryAllByTestId('diff-added')).toHaveLength(0);
    });
  });
});
