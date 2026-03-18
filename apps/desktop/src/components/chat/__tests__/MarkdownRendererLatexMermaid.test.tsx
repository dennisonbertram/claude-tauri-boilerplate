/**
 * Tests for LaTeX and Mermaid rendering in MarkdownRenderer (issue #102).
 *
 * TDD: these tests were written before the implementation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MarkdownRenderer } from '../MarkdownRenderer';

// Mermaid uses dynamic import + async rendering; mock it for tests
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg data-testid="mermaid-svg"><text>flowchart</text></svg>' }),
  },
}));

describe('MarkdownRenderer - LaTeX rendering', () => {
  it('renders inline LaTeX math ($...$) using KaTeX', () => {
    const { container } = render(<MarkdownRenderer content="Inline math: $E=mc^2$" />);

    // KaTeX produces a <span class="katex"> for inline math
    const katexSpan = container.querySelector('.katex');
    expect(katexSpan).toBeInTheDocument();
  });

  it('renders block LaTeX math ($$...$$) using KaTeX', () => {
    const { container } = render(<MarkdownRenderer content={'$$\nx^2 + y^2 = z^2\n$$'} />);

    // KaTeX produces a <span class="katex-display"> for display math
    const katexDisplay = container.querySelector('.katex-display');
    expect(katexDisplay).toBeInTheDocument();
  });

  it('renders inline math with complex expressions', () => {
    const { container } = render(
      <MarkdownRenderer content="The formula $\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$ solves quadratics." />
    );

    const katexSpan = container.querySelector('.katex');
    expect(katexSpan).toBeInTheDocument();
  });

  it('renders block math with summation notation', () => {
    // remark-math requires $$ to be on its own paragraph line for display mode
    const { container } = render(
      <MarkdownRenderer content={'$$\n\\sum_{i=0}^{n} i = \\frac{n(n+1)}{2}\n$$'} />
    );

    const katexDisplay = container.querySelector('.katex-display');
    expect(katexDisplay).toBeInTheDocument();
  });

  it('does not break regular markdown text surrounding math', () => {
    const content = 'Before $x = 1$ after';
    const { container } = render(<MarkdownRenderer content={content} />);

    // KaTeX renders inline math
    expect(container.querySelector('.katex')).toBeInTheDocument();
    // The surrounding text is still present
    expect(container.textContent).toContain('Before');
    expect(container.textContent).toContain('after');
  });

  it('renders multiple inline math expressions in one paragraph', () => {
    const content = 'Let $a = 1$ and $b = 2$, then $a + b = 3$.';
    const { container } = render(<MarkdownRenderer content={content} />);

    const katexSpans = container.querySelectorAll('.katex');
    expect(katexSpans.length).toBeGreaterThanOrEqual(3);
  });
});

describe('MarkdownRenderer - Mermaid diagram rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a mermaid code block as MermaidDiagram component', async () => {
    const content = '```mermaid\ngraph TD\n  A --> B\n```';
    const { container } = render(<MarkdownRenderer content={content} />);

    // Should render a mermaid diagram container, not a plain code block
    await waitFor(() => {
      const mermaidContainer = container.querySelector('[data-testid="mermaid-diagram"]');
      expect(mermaidContainer).toBeInTheDocument();
    });
  });

  it('does NOT render a plain code block for mermaid language', async () => {
    const content = '```mermaid\ngraph TD\n  A --> B\n```';
    const { container } = render(<MarkdownRenderer content={content} />);

    await waitFor(() => {
      const mermaidContainer = container.querySelector('[data-testid="mermaid-diagram"]');
      expect(mermaidContainer).toBeInTheDocument();
    });

    // The mermaid source should not be displayed as raw code text in a pre block
    // (the mermaid diagram replaced the code block)
    const codeBlocks = container.querySelectorAll('pre');
    expect(codeBlocks).toHaveLength(0);
  });

  it('renders a non-mermaid code block normally', async () => {
    const content = '```javascript\nconst x = 1;\n```';
    const { container } = render(<MarkdownRenderer content={content} />);

    const pre = container.querySelector('pre');
    expect(pre).toBeInTheDocument();

    const mermaidContainer = container.querySelector('[data-testid="mermaid-diagram"]');
    expect(mermaidContainer).toBeNull();
  });

  it('renders an expand button for fullscreen on mermaid diagrams', async () => {
    const content = '```mermaid\nsequenceDiagram\n  Alice->>Bob: Hello\n```';
    render(<MarkdownRenderer content={content} />);

    await waitFor(() => {
      const expandButton = screen.getByRole('button', { name: /expand|fullscreen/i });
      expect(expandButton).toBeInTheDocument();
    });
  });

  it('shows a loading state while mermaid renders', () => {
    const content = '```mermaid\ngraph LR\n  A --> B\n```';
    const { container } = render(<MarkdownRenderer content={content} />);

    // Before async render completes, the container should exist
    const mermaidContainer = container.querySelector('[data-testid="mermaid-diagram"]');
    expect(mermaidContainer).toBeInTheDocument();
  });

  it('handles mermaid render errors gracefully', async () => {
    const mermaid = await import('mermaid');
    vi.mocked(mermaid.default.render).mockRejectedValueOnce(
      new Error('Invalid mermaid syntax')
    );

    const content = '```mermaid\ninvalid syntax here\n```';
    const { container } = render(<MarkdownRenderer content={content} />);

    await waitFor(() => {
      const mermaidContainer = container.querySelector('[data-testid="mermaid-diagram"]');
      expect(mermaidContainer).toBeInTheDocument();
    });

    // Should show an error state rather than crashing
    await waitFor(() => {
      const errorEl = container.querySelector('[data-testid="mermaid-error"]');
      expect(errorEl).toBeInTheDocument();
    });
  });

  it('handles unicode characters in mermaid diagrams', async () => {
    const content = '```mermaid\ngraph TD\n  A["Héllo Wörld"] --> B["日本語"]\n```';
    const { container } = render(<MarkdownRenderer content={content} />);

    await waitFor(() => {
      const mermaidContainer = container.querySelector('[data-testid="mermaid-diagram"]');
      expect(mermaidContainer).toBeInTheDocument();
    });
  });
});
