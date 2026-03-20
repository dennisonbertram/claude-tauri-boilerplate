import { useState } from 'react';
import { CaretDown, CaretRight, BookOpen } from '@phosphor-icons/react';
import { MarkdownRenderer } from './MarkdownRenderer';

// --- Jupyter notebook types ---

interface NotebookStreamOutput {
  output_type: 'stream';
  text: string[];
  name?: string;
}

interface NotebookDisplayDataOutput {
  output_type: 'display_data';
  data: Record<string, unknown>;
}

interface NotebookExecuteResultOutput {
  output_type: 'execute_result';
  data: Record<string, unknown>;
  execution_count?: number;
}

interface NotebookErrorOutput {
  output_type: 'error';
  ename: string;
  evalue: string;
  traceback: string[];
}

type NotebookOutput =
  | NotebookStreamOutput
  | NotebookDisplayDataOutput
  | NotebookExecuteResultOutput
  | NotebookErrorOutput;

interface NotebookCell {
  cell_type: 'code' | 'markdown' | 'raw';
  source: string[];
  execution_count?: number | null;
  outputs?: NotebookOutput[];
}

export interface NotebookData {
  cells: NotebookCell[];
  metadata: Record<string, unknown>;
  nbformat: number;
  nbformat_minor?: number;
}

interface NotebookViewerProps {
  notebook: NotebookData;
}

// --- Output renderers ---

function OutputRenderer({ output }: { output: NotebookOutput }) {
  switch (output.output_type) {
    case 'stream': {
      const text = output.text.join('').trimEnd();
      return (
        <pre className="text-xs font-mono text-zinc-300 bg-zinc-900/50 px-3 py-2 overflow-x-auto whitespace-pre">
          {text}
        </pre>
      );
    }

    case 'display_data':
    case 'execute_result': {
      const data = output.data;

      // Render image if available
      if (data['image/png']) {
        return (
          <div className="px-3 py-2">
            <img
              src={`data:image/png;base64,${data['image/png']}`}
              alt="Cell output"
              className="max-w-full h-auto rounded"
            />
          </div>
        );
      }

      if (data['image/jpeg']) {
        return (
          <div className="px-3 py-2">
            <img
              src={`data:image/jpeg;base64,${data['image/jpeg']}`}
              alt="Cell output"
              className="max-w-full h-auto rounded"
            />
          </div>
        );
      }

      // Render text/plain fallback
      if (data['text/plain']) {
        const textArr = data['text/plain'] as string[];
        const text = Array.isArray(textArr) ? textArr.join('') : String(textArr);
        return (
          <pre className="text-xs font-mono text-zinc-300 bg-zinc-900/50 px-3 py-2 overflow-x-auto whitespace-pre">
            {text.trimEnd()}
          </pre>
        );
      }

      return null;
    }

    case 'error': {
      const traceback = output.traceback.join('\n');
      return (
        <pre className="text-xs font-mono text-red-400 bg-red-950/30 px-3 py-2 overflow-x-auto whitespace-pre">
          {traceback}
        </pre>
      );
    }

    default:
      return null;
  }
}

// --- Cell renderers ---

function CodeCellContent({ cell }: { cell: NotebookCell }) {
  const source = cell.source.join('');
  const lines = source.trimEnd().split('\n');

  return (
    <div>
      {/* Source code */}
      <div className="relative">
        <pre className="text-xs font-mono text-zinc-200 bg-zinc-900 px-3 py-2 pl-12 overflow-x-auto whitespace-pre">
          {lines.map((line, i) => (
            <span key={i} className="block relative">
              <span className="absolute -left-9 w-7 text-right select-none text-zinc-600 text-xs">
                {i + 1}
              </span>
              {line}
            </span>
          ))}
        </pre>
      </div>

      {/* Outputs */}
      {cell.outputs && cell.outputs.length > 0 && (
        <div className="border-t border-border/50">
          {cell.outputs.map((output, i) => (
            <OutputRenderer key={i} output={output} />
          ))}
        </div>
      )}
    </div>
  );
}

function MarkdownCellContent({ cell }: { cell: NotebookCell }) {
  const source = cell.source.join('');
  return (
    <div className="px-3 py-2">
      <MarkdownRenderer content={source} />
    </div>
  );
}

function RawCellContent({ cell }: { cell: NotebookCell }) {
  const source = cell.source.join('');
  return (
    <pre className="text-xs font-mono text-zinc-400 bg-zinc-900/30 px-3 py-2 overflow-x-auto whitespace-pre">
      {source}
    </pre>
  );
}

// --- Cell component ---

function NotebookCell({ cell, index }: { cell: NotebookCell; index: number }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const cellTypeLabel =
    cell.cell_type === 'code'
      ? 'Code'
      : cell.cell_type === 'markdown'
        ? 'Markdown'
        : 'Raw';

  const cellTypeColor =
    cell.cell_type === 'code'
      ? 'text-blue-400'
      : cell.cell_type === 'markdown'
        ? 'text-green-400'
        : 'text-zinc-400';

  return (
    <div className="border border-border/50 rounded-md overflow-hidden">
      {/* Cell header */}
      <button
        data-testid="cell-header"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-muted/50 transition-colors bg-muted/20"
      >
        {isExpanded ? (
          <CaretDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <CaretRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}

        <span className={`text-xs font-medium ${cellTypeColor}`}>
          {cellTypeLabel}
        </span>

        <span className="text-xs text-muted-foreground">
          [{index}]
        </span>

        {cell.cell_type === 'code' && (
          <span
            data-testid="execution-count"
            className="text-xs text-muted-foreground font-mono ml-auto"
          >
            {cell.execution_count != null ? `[${cell.execution_count}]` : '[ ]'}
          </span>
        )}
      </button>

      {/* Cell content */}
      {isExpanded && (
        <div>
          {cell.cell_type === 'code' && <CodeCellContent cell={cell} />}
          {cell.cell_type === 'markdown' && <MarkdownCellContent cell={cell} />}
          {cell.cell_type === 'raw' && <RawCellContent cell={cell} />}
        </div>
      )}
    </div>
  );
}

// --- Main component ---

export function NotebookViewer({ notebook }: NotebookViewerProps) {
  const cellCount = notebook.cells.length;

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/30 text-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <BookOpen className="h-4 w-4 text-orange-400 shrink-0" />
        <span className="font-medium text-foreground">Notebook</span>
        <span
          data-testid="cell-count-badge"
          className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5 font-mono ml-auto"
        >
          {cellCount} cell{cellCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Cells */}
      <div className="border-t border-border p-2 space-y-0">
        {cellCount === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">
            No cells in this notebook
          </div>
        )}

        {notebook.cells.map((cell, index) => (
          <div key={index}>
            <NotebookCell cell={cell} index={index} />
            {index < notebook.cells.length - 1 && (
              <div
                data-testid="cell-divider"
                className="h-px bg-border/30 my-1"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
