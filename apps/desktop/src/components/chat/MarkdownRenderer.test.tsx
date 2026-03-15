import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownRenderer } from './MarkdownRenderer';

describe('MarkdownRenderer', () => {
  it('renders plain text', () => {
    render(<MarkdownRenderer content="Hello, world!" />);
    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });

  it('renders h1 through h6 headers', () => {
    const md = [
      '# Heading 1',
      '## Heading 2',
      '### Heading 3',
      '#### Heading 4',
      '##### Heading 5',
      '###### Heading 6',
    ].join('\n\n');

    const { container } = render(<MarkdownRenderer content={md} />);

    expect(container.querySelector('h1')).toHaveTextContent('Heading 1');
    expect(container.querySelector('h2')).toHaveTextContent('Heading 2');
    expect(container.querySelector('h3')).toHaveTextContent('Heading 3');
    expect(container.querySelector('h4')).toHaveTextContent('Heading 4');
    expect(container.querySelector('h5')).toHaveTextContent('Heading 5');
    expect(container.querySelector('h6')).toHaveTextContent('Heading 6');
  });

  it('renders fenced code blocks with a language label', () => {
    const md = '```typescript\nconst x = 42;\n```';
    const { container } = render(<MarkdownRenderer content={md} />);

    // Should have a <pre> and <code> element
    const pre = container.querySelector('pre');
    expect(pre).toBeInTheDocument();

    const code = container.querySelector('pre code');
    expect(code).toBeInTheDocument();

    // Language label should be displayed
    expect(screen.getByText('typescript')).toBeInTheDocument();
  });

  it('renders inline code distinctly from code blocks', () => {
    const md = 'Use `console.log()` for debugging';
    const { container } = render(<MarkdownRenderer content={md} />);

    const inlineCode = container.querySelector('code');
    expect(inlineCode).toBeInTheDocument();
    expect(inlineCode?.textContent).toBe('console.log()');

    // Inline code should NOT be inside a <pre>
    expect(inlineCode?.closest('pre')).toBeNull();
  });

  it('renders GFM tables', () => {
    const md = [
      '| Name | Age |',
      '| ---- | --- |',
      '| Alice | 30 |',
      '| Bob | 25 |',
    ].join('\n');

    const { container } = render(<MarkdownRenderer content={md} />);

    const table = container.querySelector('table');
    expect(table).toBeInTheDocument();

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders unordered lists', () => {
    const md = '- Item A\n- Item B\n- Item C';
    const { container } = render(<MarkdownRenderer content={md} />);

    const ul = container.querySelector('ul');
    expect(ul).toBeInTheDocument();

    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(3);
  });

  it('renders ordered lists', () => {
    const md = '1. First\n2. Second\n3. Third';
    const { container } = render(<MarkdownRenderer content={md} />);

    const ol = container.querySelector('ol');
    expect(ol).toBeInTheDocument();

    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(3);
  });

  it('renders GFM task lists', () => {
    const md = '- [x] Done\n- [ ] Not done';
    const { container } = render(<MarkdownRenderer content={md} />);

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(2);

    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it('renders links with proper attributes', () => {
    const md = '[Visit Google](https://google.com)';
    const { container } = render(<MarkdownRenderer content={md} />);

    const link = container.querySelector('a');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://google.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders blockquotes', () => {
    const md = '> This is a quote';
    const { container } = render(<MarkdownRenderer content={md} />);

    const blockquote = container.querySelector('blockquote');
    expect(blockquote).toBeInTheDocument();
    expect(blockquote).toHaveTextContent('This is a quote');
  });

  it('renders a copy button on code blocks', () => {
    const md = '```js\nalert("hi")\n```';
    render(<MarkdownRenderer content={md} />);

    const copyButton = screen.getByRole('button', { name: /copy/i });
    expect(copyButton).toBeInTheDocument();
  });

  it('does not render raw HTML (XSS prevention)', () => {
    const md = '<script>alert("xss")</script>';
    const { container } = render(<MarkdownRenderer content={md} />);

    // react-markdown does not render raw HTML by default
    const script = container.querySelector('script');
    expect(script).toBeNull();

    // The raw HTML tags should not appear in the output
    expect(container.innerHTML).not.toContain('<script>');
  });

  it('renders strikethrough text (GFM)', () => {
    const md = '~~deleted~~';
    const { container } = render(<MarkdownRenderer content={md} />);

    const del = container.querySelector('del');
    expect(del).toBeInTheDocument();
    expect(del).toHaveTextContent('deleted');
  });

  it('renders images with alt text', () => {
    const md = '![Alt text](https://example.com/image.png)';
    const { container } = render(<MarkdownRenderer content={md} />);

    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', 'Alt text');
    expect(img).toHaveAttribute('src', 'https://example.com/image.png');
  });
});
