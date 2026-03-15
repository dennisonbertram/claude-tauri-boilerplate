import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WebSearchDisplay } from '../WebSearchDisplay';
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

// Sample search results matching the expected format from the tool
const sampleSearchResults = JSON.stringify([
  {
    title: 'React Documentation',
    url: 'https://react.dev/learn',
    snippet: 'React is a JavaScript library for building user interfaces.',
  },
  {
    title: 'React Tutorial',
    url: 'https://react.dev/learn/tutorial-tic-tac-toe',
    snippet: 'Build a small tic-tac-toe game to learn React fundamentals.',
  },
  {
    title: 'React Hooks Reference',
    url: 'https://react.dev/reference/react',
    snippet: 'API reference for React hooks including useState, useEffect.',
  },
]);

const manySearchResults = JSON.stringify(
  Array.from({ length: 8 }, (_, i) => ({
    title: `Result ${i + 1}`,
    url: `https://example.com/page-${i + 1}`,
    snippet: `This is snippet for result ${i + 1}.`,
  }))
);

// =====================================================================
// WebSearchDisplay
// =====================================================================
describe('WebSearchDisplay', () => {
  it('renders the search query in the header', () => {
    render(
      <WebSearchDisplay
        toolCall={makeToolCall({
          name: 'WebSearch',
          input: JSON.stringify({ query: 'React hooks tutorial' }),
          result: sampleSearchResults,
        })}
      />
    );
    expect(screen.getByTestId('websearch-query')).toHaveTextContent(
      'React hooks tutorial'
    );
  });

  it('renders result cards with titles, URLs, and snippets', () => {
    render(
      <WebSearchDisplay
        toolCall={makeToolCall({
          name: 'WebSearch',
          input: JSON.stringify({ query: 'React' }),
          result: sampleSearchResults,
        })}
      />
    );
    const cards = screen.getAllByTestId('websearch-result-card');
    expect(cards).toHaveLength(3);

    // Check first card content
    expect(screen.getByText('React Documentation')).toBeInTheDocument();
    expect(screen.getByText('https://react.dev/learn')).toBeInTheDocument();
    expect(
      screen.getByText(
        'React is a JavaScript library for building user interfaces.'
      )
    ).toBeInTheDocument();
  });

  it('renders titles as clickable links with correct href', () => {
    render(
      <WebSearchDisplay
        toolCall={makeToolCall({
          name: 'WebSearch',
          input: JSON.stringify({ query: 'React' }),
          result: sampleSearchResults,
        })}
      />
    );
    const links = screen.getAllByTestId('websearch-result-link');
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute('href', 'https://react.dev/learn');
    expect(links[0]).toHaveAttribute('target', '_blank');
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows result count badge', () => {
    render(
      <WebSearchDisplay
        toolCall={makeToolCall({
          name: 'WebSearch',
          input: JSON.stringify({ query: 'React' }),
          result: sampleSearchResults,
        })}
      />
    );
    const badge = screen.getByTestId('websearch-result-count');
    expect(badge).toHaveTextContent('3');
  });

  it('shows first 5 results and hides rest behind expand button when many results', () => {
    render(
      <WebSearchDisplay
        toolCall={makeToolCall({
          name: 'WebSearch',
          input: JSON.stringify({ query: 'many results' }),
          result: manySearchResults,
        })}
      />
    );
    // Should show 5 results initially
    const cards = screen.getAllByTestId('websearch-result-card');
    expect(cards).toHaveLength(5);

    // Should show expand button
    const expandBtn = screen.getByTestId('websearch-expand-btn');
    expect(expandBtn).toBeInTheDocument();
    expect(expandBtn).toHaveTextContent('3 more');
  });

  it('expands to show all results when expand button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <WebSearchDisplay
        toolCall={makeToolCall({
          name: 'WebSearch',
          input: JSON.stringify({ query: 'many results' }),
          result: manySearchResults,
        })}
      />
    );
    const expandBtn = screen.getByTestId('websearch-expand-btn');
    await user.click(expandBtn);

    const cards = screen.getAllByTestId('websearch-result-card');
    expect(cards).toHaveLength(8);
  });

  it('does not show expand button when results are 5 or fewer', () => {
    render(
      <WebSearchDisplay
        toolCall={makeToolCall({
          name: 'WebSearch',
          input: JSON.stringify({ query: 'React' }),
          result: sampleSearchResults,
        })}
      />
    );
    expect(screen.queryByTestId('websearch-expand-btn')).not.toBeInTheDocument();
  });

  it('shows empty state when no results', () => {
    render(
      <WebSearchDisplay
        toolCall={makeToolCall({
          name: 'WebSearch',
          input: JSON.stringify({ query: 'nonsense query' }),
          result: '[]',
        })}
      />
    );
    expect(screen.getByTestId('websearch-empty')).toBeInTheDocument();
  });

  it('handles empty string result gracefully', () => {
    render(
      <WebSearchDisplay
        toolCall={makeToolCall({
          name: 'WebSearch',
          input: JSON.stringify({ query: 'test' }),
          result: '',
        })}
      />
    );
    expect(screen.getByTestId('websearch-empty')).toBeInTheDocument();
  });

  it('handles non-JSON result gracefully (plain text)', () => {
    render(
      <WebSearchDisplay
        toolCall={makeToolCall({
          name: 'WebSearch',
          input: JSON.stringify({ query: 'test' }),
          result: 'Some plain text result that is not JSON',
        })}
      />
    );
    // Should show empty state since we can't parse results
    expect(screen.getByTestId('websearch-empty')).toBeInTheDocument();
  });

  it('renders status indicator for running state', () => {
    render(
      <WebSearchDisplay
        toolCall={makeToolCall({
          name: 'WebSearch',
          status: 'running',
          input: JSON.stringify({ query: 'React' }),
        })}
      />
    );
    expect(screen.getByTestId('status-running')).toBeInTheDocument();
  });

  it('renders status indicator for complete state', () => {
    render(
      <WebSearchDisplay
        toolCall={makeToolCall({
          name: 'WebSearch',
          status: 'complete',
          input: JSON.stringify({ query: 'React' }),
          result: sampleSearchResults,
        })}
      />
    );
    expect(screen.getByTestId('status-complete')).toBeInTheDocument();
  });

  it('renders status indicator for error state', () => {
    render(
      <WebSearchDisplay
        toolCall={makeToolCall({
          name: 'WebSearch',
          status: 'error',
          input: JSON.stringify({ query: 'React' }),
        })}
      />
    );
    expect(screen.getByTestId('status-error')).toBeInTheDocument();
  });

  it('handles running state with no result yet', () => {
    render(
      <WebSearchDisplay
        toolCall={makeToolCall({
          name: 'WebSearch',
          status: 'running',
          input: JSON.stringify({ query: 'loading query' }),
        })}
      />
    );
    expect(screen.getByTestId('websearch-query')).toHaveTextContent(
      'loading query'
    );
    // Should not crash, no result cards
    expect(screen.queryAllByTestId('websearch-result-card')).toHaveLength(0);
  });
});

// =====================================================================
// ToolCallBlock routing for WebSearch
// =====================================================================
describe('ToolCallBlock routing for WebSearch', () => {
  it('routes WebSearch tool calls to WebSearchDisplay', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({
          name: 'WebSearch',
          input: JSON.stringify({ query: 'React hooks' }),
          result: sampleSearchResults,
        })}
      />
    );
    // WebSearchDisplay renders query in header
    expect(screen.getByTestId('websearch-query')).toHaveTextContent(
      'React hooks'
    );
  });

  it('routes WebSearch to WebSearchDisplay instead of generic display', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({
          name: 'WebSearch',
          input: JSON.stringify({ query: 'test query' }),
          result: sampleSearchResults,
        })}
      />
    );
    // WebSearchDisplay renders result cards, not generic raw JSON
    expect(screen.getAllByTestId('websearch-result-card').length).toBeGreaterThan(0);
  });
});
