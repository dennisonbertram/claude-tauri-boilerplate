import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WebFetchDisplay } from '../WebFetchDisplay';
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

const shortContent = 'This is a short piece of extracted content from the web page.';

const longContent =
  'This is a very long piece of content that was extracted from the web page. '.repeat(
    20
  ) + 'End of content.';

// =====================================================================
// WebFetchDisplay
// =====================================================================
describe('WebFetchDisplay', () => {
  it('renders the source URL in the header', () => {
    render(
      <WebFetchDisplay
        toolCall={makeToolCall({
          name: 'WebFetch',
          input: JSON.stringify({
            url: 'https://react.dev/learn',
            prompt: 'Extract the main tutorial content',
          }),
          result: shortContent,
        })}
      />
    );
    const urlLink = screen.getByTestId('webfetch-url');
    expect(urlLink).toHaveTextContent('https://react.dev/learn');
    expect(urlLink).toHaveAttribute('href', 'https://react.dev/learn');
    expect(urlLink).toHaveAttribute('target', '_blank');
    expect(urlLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders the content preview', () => {
    render(
      <WebFetchDisplay
        toolCall={makeToolCall({
          name: 'WebFetch',
          input: JSON.stringify({
            url: 'https://example.com',
            prompt: 'Get content',
          }),
          result: shortContent,
        })}
      />
    );
    expect(screen.getByTestId('webfetch-content')).toHaveTextContent(
      shortContent
    );
  });

  it('renders the prompt used for extraction', () => {
    render(
      <WebFetchDisplay
        toolCall={makeToolCall({
          name: 'WebFetch',
          input: JSON.stringify({
            url: 'https://example.com',
            prompt: 'Extract the main tutorial content',
          }),
          result: shortContent,
        })}
      />
    );
    expect(screen.getByTestId('webfetch-prompt')).toHaveTextContent(
      'Extract the main tutorial content'
    );
  });

  it('truncates long content and shows expand button', () => {
    render(
      <WebFetchDisplay
        toolCall={makeToolCall({
          name: 'WebFetch',
          input: JSON.stringify({
            url: 'https://example.com',
            prompt: 'Get content',
          }),
          result: longContent,
        })}
      />
    );
    // Content should be truncated
    const contentEl = screen.getByTestId('webfetch-content');
    // The displayed text should be shorter than the full content
    expect(contentEl.textContent!.length).toBeLessThan(longContent.length);

    // Expand button should be visible
    const expandBtn = screen.getByTestId('webfetch-expand-btn');
    expect(expandBtn).toBeInTheDocument();
  });

  it('expands full content when expand button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <WebFetchDisplay
        toolCall={makeToolCall({
          name: 'WebFetch',
          input: JSON.stringify({
            url: 'https://example.com',
            prompt: 'Get content',
          }),
          result: longContent,
        })}
      />
    );
    const expandBtn = screen.getByTestId('webfetch-expand-btn');
    await user.click(expandBtn);

    const contentEl = screen.getByTestId('webfetch-content');
    expect(contentEl).toHaveTextContent('End of content.');
  });

  it('does not show expand button for short content', () => {
    render(
      <WebFetchDisplay
        toolCall={makeToolCall({
          name: 'WebFetch',
          input: JSON.stringify({
            url: 'https://example.com',
            prompt: 'Get content',
          }),
          result: shortContent,
        })}
      />
    );
    expect(
      screen.queryByTestId('webfetch-expand-btn')
    ).not.toBeInTheDocument();
  });

  it('shows copy URL button that copies the URL on click', async () => {
    const user = userEvent.setup();
    // Mock clipboard
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    render(
      <WebFetchDisplay
        toolCall={makeToolCall({
          name: 'WebFetch',
          input: JSON.stringify({
            url: 'https://react.dev/learn',
            prompt: 'Get content',
          }),
          result: shortContent,
        })}
      />
    );
    const copyBtn = screen.getByTestId('webfetch-copy-url');
    await user.click(copyBtn);
    expect(writeText).toHaveBeenCalledWith('https://react.dev/learn');
  });

  it('renders status indicator for running state', () => {
    render(
      <WebFetchDisplay
        toolCall={makeToolCall({
          name: 'WebFetch',
          status: 'running',
          input: JSON.stringify({
            url: 'https://example.com',
            prompt: 'Get content',
          }),
        })}
      />
    );
    expect(screen.getByTestId('status-running')).toBeInTheDocument();
  });

  it('renders status indicator for complete state', () => {
    render(
      <WebFetchDisplay
        toolCall={makeToolCall({
          name: 'WebFetch',
          status: 'complete',
          input: JSON.stringify({
            url: 'https://example.com',
            prompt: 'Get content',
          }),
          result: shortContent,
        })}
      />
    );
    expect(screen.getByTestId('status-complete')).toBeInTheDocument();
  });

  it('renders status indicator for error state', () => {
    render(
      <WebFetchDisplay
        toolCall={makeToolCall({
          name: 'WebFetch',
          status: 'error',
          input: JSON.stringify({
            url: 'https://example.com',
            prompt: 'Get content',
          }),
        })}
      />
    );
    expect(screen.getByTestId('status-error')).toBeInTheDocument();
  });

  it('handles running state with no result yet', () => {
    render(
      <WebFetchDisplay
        toolCall={makeToolCall({
          name: 'WebFetch',
          status: 'running',
          input: JSON.stringify({
            url: 'https://example.com',
            prompt: 'Get content',
          }),
        })}
      />
    );
    expect(screen.getByTestId('webfetch-url')).toHaveTextContent(
      'https://example.com'
    );
    // Should not crash - no content to show
    expect(screen.queryByTestId('webfetch-content')).not.toBeInTheDocument();
  });

  it('handles empty result gracefully', () => {
    render(
      <WebFetchDisplay
        toolCall={makeToolCall({
          name: 'WebFetch',
          input: JSON.stringify({
            url: 'https://example.com',
            prompt: 'Get content',
          }),
          result: '',
        })}
      />
    );
    // Should not show content section for empty result
    expect(screen.queryByTestId('webfetch-content')).not.toBeInTheDocument();
  });
});

// =====================================================================
// ToolCallBlock routing for WebFetch
// =====================================================================
describe('ToolCallBlock routing for WebFetch', () => {
  it('routes WebFetch tool calls to WebFetchDisplay', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({
          name: 'WebFetch',
          input: JSON.stringify({
            url: 'https://react.dev/learn',
            prompt: 'Get content',
          }),
          result: shortContent,
        })}
      />
    );
    // WebFetchDisplay renders URL in header
    expect(screen.getByTestId('webfetch-url')).toHaveTextContent(
      'https://react.dev/learn'
    );
  });

  it('routes WebFetch to WebFetchDisplay instead of generic display', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({
          name: 'WebFetch',
          input: JSON.stringify({
            url: 'https://example.com',
            prompt: 'Get content',
          }),
          result: shortContent,
        })}
      />
    );
    // WebFetchDisplay renders content preview, not generic raw JSON
    expect(screen.getByTestId('webfetch-content')).toBeInTheDocument();
  });
});
