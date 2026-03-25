import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { FileReadDisplay } from '../FileReadDisplay';
import { FileEditDisplay } from '../FileEditDisplay';
import { FileWriteDisplay } from '../FileWriteDisplay';
import { ToolCallBlock } from '../ToolCallBlock';
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
// FileReadDisplay
// =====================================================================
describe('FileReadDisplay', () => {
  const defaultInput = {
    file_path: '/src/components/App.tsx',
  };

  const sampleContent =
    '     1\timport React from "react";\n     2\t\n     3\texport function App() {\n     4\t  return <div>Hello</div>;\n     5\t}';

  it('renders the file path in the header', () => {
    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          input: JSON.stringify(defaultInput),
          result: sampleContent,
        })}
      />
    );
    expect(screen.getByText('/src/components/App.tsx')).toBeInTheDocument();
  });

  it('detects language from file extension and shows label', () => {
    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          input: JSON.stringify(defaultInput),
          result: sampleContent,
        })}
      />
    );
    expect(screen.getByText('tsx')).toBeInTheDocument();
  });

  it('detects various file extensions correctly', () => {
    const extensions: Record<string, string> = {
      'file.py': 'python',
      'file.rs': 'rust',
      'file.go': 'go',
      'file.js': 'javascript',
      'file.ts': 'typescript',
      'file.json': 'json',
      'file.md': 'markdown',
      'file.css': 'css',
      'file.html': 'html',
    };

    for (const [filename, expectedLang] of Object.entries(extensions)) {
      const { unmount } = render(
        <FileReadDisplay
          toolCall={makeToolCall({
            name: 'Read',
            input: JSON.stringify({ file_path: `/path/${filename}` }),
            result: 'content',
          })}
        />
      );
      expect(screen.getByTestId('language-label')).toHaveTextContent(expectedLang);
      unmount();
    }
  });

  it('renders line numbers from file content', () => {
    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          input: JSON.stringify(defaultInput),
          result: sampleContent,
        })}
      />
    );
    // The content has line numbers 1-5 in the Read tool format
    expect(screen.getByTestId('file-content')).toBeInTheDocument();
  });

  it('collapses content for files over 50 lines', () => {
    const longContent = Array.from(
      { length: 60 },
      (_, i) => `     ${i + 1}\tline ${i + 1}`
    ).join('\n');

    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          input: JSON.stringify(defaultInput),
          result: longContent,
        })}
      />
    );

    // Should be collapsed by default
    expect(screen.getByTestId('expand-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('expand-toggle')).toHaveTextContent(/show all/i);
  });

  it('expands collapsed content when toggle is clicked', () => {
    const longContent = Array.from(
      { length: 60 },
      (_, i) => `     ${i + 1}\tline ${i + 1}`
    ).join('\n');

    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          input: JSON.stringify(defaultInput),
          result: longContent,
        })}
      />
    );

    fireEvent.click(screen.getByTestId('expand-toggle'));
    expect(screen.getByTestId('expand-toggle')).toHaveTextContent(/collapse/i);
  });

  it('does not show expand toggle for short files', () => {
    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          input: JSON.stringify(defaultInput),
          result: sampleContent,
        })}
      />
    );
    expect(screen.queryByTestId('expand-toggle')).not.toBeInTheDocument();
  });

  it('shows copy-path button', () => {
    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          input: JSON.stringify(defaultInput),
          result: sampleContent,
        })}
      />
    );
    expect(screen.getByLabelText('Copy file path')).toBeInTheDocument();
  });

  it('handles offset and limit params display', () => {
    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          input: JSON.stringify({
            file_path: '/src/App.tsx',
            offset: 10,
            limit: 20,
          }),
          result: '    10\tline 10\n    11\tline 11',
        })}
      />
    );
    expect(screen.getByTestId('line-range')).toHaveTextContent('Lines 10-29');
  });

  it('renders status indicator', () => {
    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          status: 'running',
          input: JSON.stringify(defaultInput),
        })}
      />
    );
    expect(screen.getByTestId('status-running')).toBeInTheDocument();
  });

  it('handles missing result gracefully (still running)', () => {
    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          status: 'running',
          input: JSON.stringify(defaultInput),
        })}
      />
    );
    expect(screen.getByText('/src/components/App.tsx')).toBeInTheDocument();
    expect(screen.queryByTestId('file-content')).not.toBeInTheDocument();
  });
});

// =====================================================================
// FileEditDisplay
// =====================================================================
describe('FileEditDisplay', () => {
  const defaultInput = {
    file_path: '/src/utils/helpers.ts',
    old_string: 'const x = 1;\nconst y = 2;',
    new_string: 'const x = 10;\nconst y = 20;\nconst z = 30;',
  };

  it('renders the file path', () => {
    render(
      <FileEditDisplay
        toolCall={makeToolCall({
          name: 'Edit',
          input: JSON.stringify(defaultInput),
        })}
      />
    );
    expect(screen.getByText('/src/utils/helpers.ts')).toBeInTheDocument();
  });

  it('shows removed lines with red styling', () => {
    render(
      <FileEditDisplay
        toolCall={makeToolCall({
          name: 'Edit',
          input: JSON.stringify(defaultInput),
        })}
      />
    );
    const removedLines = screen.getAllByTestId('diff-removed');
    expect(removedLines.length).toBe(2); // 'const x = 1;' and 'const y = 2;'
    expect(removedLines[0]).toHaveTextContent('const x = 1;');
  });

  it('shows added lines with green styling', () => {
    render(
      <FileEditDisplay
        toolCall={makeToolCall({
          name: 'Edit',
          input: JSON.stringify(defaultInput),
        })}
      />
    );
    const addedLines = screen.getAllByTestId('diff-added');
    expect(addedLines.length).toBe(3); // three new lines
    expect(addedLines[2]).toHaveTextContent('const z = 30;');
  });

  it('shows replace_all indicator when set', () => {
    render(
      <FileEditDisplay
        toolCall={makeToolCall({
          name: 'Edit',
          input: JSON.stringify({ ...defaultInput, replace_all: true }),
        })}
      />
    );
    expect(screen.getByTestId('replace-all-badge')).toBeInTheDocument();
    expect(screen.getByTestId('replace-all-badge')).toHaveTextContent(/replace all/i);
  });

  it('does not show replace_all when not set', () => {
    render(
      <FileEditDisplay
        toolCall={makeToolCall({
          name: 'Edit',
          input: JSON.stringify(defaultInput),
        })}
      />
    );
    expect(screen.queryByTestId('replace-all-badge')).not.toBeInTheDocument();
  });

  it('shows change summary', () => {
    render(
      <FileEditDisplay
        toolCall={makeToolCall({
          name: 'Edit',
          input: JSON.stringify(defaultInput),
        })}
      />
    );
    // Should show lines added/removed count
    expect(screen.getByTestId('change-summary')).toHaveTextContent('-2');
    expect(screen.getByTestId('change-summary')).toHaveTextContent('+3');
  });

  it('handles single-line edits', () => {
    render(
      <FileEditDisplay
        toolCall={makeToolCall({
          name: 'Edit',
          input: JSON.stringify({
            file_path: '/src/app.ts',
            old_string: 'hello',
            new_string: 'world',
          }),
        })}
      />
    );
    expect(screen.getAllByTestId('diff-removed')).toHaveLength(1);
    expect(screen.getAllByTestId('diff-added')).toHaveLength(1);
  });

  it('renders status indicator for running state', () => {
    render(
      <FileEditDisplay
        toolCall={makeToolCall({
          name: 'Edit',
          status: 'running',
          input: JSON.stringify(defaultInput),
        })}
      />
    );
    expect(screen.getByTestId('status-running')).toBeInTheDocument();
  });
});

// =====================================================================
// FileWriteDisplay
// =====================================================================
describe('FileWriteDisplay', () => {
  const defaultInput = {
    file_path: '/src/new-file.ts',
    content: 'export const greeting = "hello";\n\nexport function greet(name: string) {\n  return `${greeting}, ${name}`;\n}\n',
  };

  it('renders file path', () => {
    render(
      <FileWriteDisplay
        toolCall={makeToolCall({
          name: 'Write',
          input: JSON.stringify(defaultInput),
        })}
      />
    );
    expect(screen.getByText('/src/new-file.ts')).toBeInTheDocument();
  });

  it('shows directory in header', () => {
    render(
      <FileWriteDisplay
        toolCall={makeToolCall({
          name: 'Write',
          input: JSON.stringify(defaultInput),
        })}
      />
    );
    expect(screen.getByTestId('file-directory')).toHaveTextContent('/src');
  });

  it('shows content preview with syntax highlighting', () => {
    render(
      <FileWriteDisplay
        toolCall={makeToolCall({
          name: 'Write',
          input: JSON.stringify(defaultInput),
        })}
      />
    );
    expect(screen.getByTestId('write-content')).toBeInTheDocument();
    expect(screen.getByTestId('write-content')).toHaveTextContent('export const greeting');
  });

  it('truncates long content and shows expand toggle', () => {
    const longContent = Array.from(
      { length: 60 },
      (_, i) => `// line ${i + 1}`
    ).join('\n');

    render(
      <FileWriteDisplay
        toolCall={makeToolCall({
          name: 'Write',
          input: JSON.stringify({
            file_path: '/src/big-file.ts',
            content: longContent,
          }),
        })}
      />
    );
    expect(screen.getByTestId('expand-toggle')).toBeInTheDocument();
  });

  it('expands full content when toggle is clicked', () => {
    const longContent = Array.from(
      { length: 60 },
      (_, i) => `// line ${i + 1}`
    ).join('\n');

    render(
      <FileWriteDisplay
        toolCall={makeToolCall({
          name: 'Write',
          input: JSON.stringify({
            file_path: '/src/big-file.ts',
            content: longContent,
          }),
        })}
      />
    );

    fireEvent.click(screen.getByTestId('expand-toggle'));
    expect(screen.getByTestId('expand-toggle')).toHaveTextContent(/collapse/i);
  });

  it('shows language label', () => {
    render(
      <FileWriteDisplay
        toolCall={makeToolCall({
          name: 'Write',
          input: JSON.stringify(defaultInput),
        })}
      />
    );
    expect(screen.getByTestId('language-label')).toHaveTextContent('typescript');
  });

  it('renders status indicator', () => {
    render(
      <FileWriteDisplay
        toolCall={makeToolCall({
          name: 'Write',
          status: 'complete',
          input: JSON.stringify(defaultInput),
        })}
      />
    );
    expect(screen.getByTestId('status-complete')).toBeInTheDocument();
  });

  it('handles missing content gracefully during streaming', () => {
    render(
      <FileWriteDisplay
        toolCall={makeToolCall({
          name: 'Write',
          status: 'running',
          input: '{"file_path": "/src/new.ts"',  // partial JSON during streaming
        })}
      />
    );
    // Should not crash
    expect(screen.getByText('Write')).toBeInTheDocument();
  });
});

// =====================================================================
// ToolCallBlock integration - routing to specialized displays
// =====================================================================
describe('ToolCallBlock routing to specialized displays', () => {
  it('renders FileReadDisplay for Read tool calls', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({
          name: 'Read',
          input: JSON.stringify({ file_path: '/src/app.ts' }),
          result: '     1\tconst x = 1;',
        })}
      />
    );
    // FileReadDisplay shows the file path prominently
    expect(screen.getByText('/src/app.ts')).toBeInTheDocument();
  });

  it('renders FileEditDisplay for Edit tool calls', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({
          name: 'Edit',
          input: JSON.stringify({
            file_path: '/src/app.ts',
            old_string: 'old',
            new_string: 'new',
          }),
        })}
      />
    );
    expect(screen.getByText('/src/app.ts')).toBeInTheDocument();
    expect(screen.getByTestId('diff-removed')).toBeInTheDocument();
  });

  it('renders FileWriteDisplay for Write tool calls', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({
          name: 'Write',
          input: JSON.stringify({
            file_path: '/src/new.ts',
            content: 'export const x = 1;',
          }),
        })}
      />
    );
    expect(screen.getByText('/src/new.ts')).toBeInTheDocument();
  });

  it('routes Bash tool calls to BashDisplay', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({
          name: 'Bash',
          input: JSON.stringify({ command: 'ls -la' }),
          result: 'file1.txt\nfile2.txt',
        })}
      />
    );
    // BashDisplay renders the command in a code element
    expect(screen.getByTestId('bash-command')).toBeInTheDocument();
  });

  it('routes Grep tool calls to GrepDisplay', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({
          name: 'Grep',
          input: JSON.stringify({ pattern: 'TODO', path: '/src' }),
          result: 'src/app.ts:5: // TODO fix this',
        })}
      />
    );
    expect(screen.getByTestId('grep-pattern')).toHaveTextContent('TODO');
  });

  it('routes Glob tool calls to GlobDisplay', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({
          name: 'Glob',
          input: JSON.stringify({ pattern: '**/*.ts' }),
          result: 'src/app.ts\nsrc/utils.ts',
        })}
      />
    );
    expect(screen.getByTestId('glob-pattern')).toHaveTextContent('**/*.ts');
  });
});

// =====================================================================
// Language detection utility
// =====================================================================
describe('Language detection from file extension', () => {
  // This is tested through the components but we also test edge cases
  it('handles files with no extension', () => {
    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          input: JSON.stringify({ file_path: '/path/Makefile' }),
          result: 'all: build',
        })}
      />
    );
    expect(screen.getByTestId('language-label')).toHaveTextContent('text');
  });

  it('handles dotfiles', () => {
    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          input: JSON.stringify({ file_path: '/path/.gitignore' }),
          result: 'node_modules/',
        })}
      />
    );
    expect(screen.getByTestId('language-label')).toHaveTextContent('text');
  });
});

// =====================================================================
// Copy path functionality
// =====================================================================
describe('Copy path functionality', () => {
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
  });

  it('copies file path to clipboard on Read display', async () => {
    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          input: JSON.stringify({ file_path: '/src/app.ts' }),
          result: 'content',
        })}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Copy file path'));
      await Promise.resolve();
    });
    expect(writeTextMock).toHaveBeenCalledWith('/src/app.ts');
  });

  it('copies file path to clipboard on Edit display', async () => {
    render(
      <FileEditDisplay
        toolCall={makeToolCall({
          name: 'Edit',
          input: JSON.stringify({
            file_path: '/src/app.ts',
            old_string: 'a',
            new_string: 'b',
          }),
        })}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Copy file path'));
      await Promise.resolve();
    });
    expect(writeTextMock).toHaveBeenCalledWith('/src/app.ts');
  });

  it('copies file path to clipboard on Write display', async () => {
    render(
      <FileWriteDisplay
        toolCall={makeToolCall({
          name: 'Write',
          input: JSON.stringify({
            file_path: '/src/new.ts',
            content: 'x',
          }),
        })}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Copy file path'));
      await Promise.resolve();
    });
    expect(writeTextMock).toHaveBeenCalledWith('/src/new.ts');
  });
});
