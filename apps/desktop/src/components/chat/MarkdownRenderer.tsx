import { useState, useCallback, isValidElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { Components } from 'react-markdown';
import { ImageViewer } from './ImageViewer';
import { MermaidDiagram } from './MermaidDiagram';

interface MarkdownRendererProps {
  content: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      aria-label="Copy code"
      className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors text-muted-foreground"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

/**
 * Checks whether a React node tree contains a mermaid code element.
 * Used by the `pre` renderer to pass through mermaid blocks without wrapping
 * them in a `<pre>` tag (the MermaidDiagram component handles its own container).
 */
function hasMermaidChild(children: ReactNode): boolean {
  if (!isValidElement(children)) return false;

  // The immediate child of `pre` is the `code` element rendered by our custom
  // `code` renderer. That renderer returns a `MermaidDiagram` element for
  // mermaid blocks. Check both cases:
  // 1. Direct MermaidDiagram child (our custom code renderer)
  // 2. A code element with language-mermaid class (rehype default)
  const el = children as React.ReactElement<{ className?: string }>;
  if (el.type === MermaidDiagram) return true;
  if (typeof el.props.className === 'string' && el.props.className.includes('language-mermaid')) {
    return true;
  }
  return false;
}

const components: Components = {
  // Code blocks and inline code
  pre({ children, ...props }) {
    // Mermaid diagrams handle their own container; don't wrap in <pre>
    if (hasMermaidChild(children as ReactNode)) {
      return <>{children}</>;
    }

    return (
      <pre
        className="overflow-x-auto rounded-lg bg-zinc-900 text-sm my-3"
        {...props}
      >
        {children}
      </pre>
    );
  },

  code({ children, className, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    const isBlock = Boolean(match);

    if (isBlock) {
      const language = match![1];
      const codeText =
        typeof children === 'string'
          ? children
          : String(children).replace(/\n$/, '');

      // Mermaid diagrams get their own component with pan/zoom/fullscreen
      if (language === 'mermaid') {
        return <MermaidDiagram code={codeText.trim()} />;
      }

      const lines = codeText.split('\n');
      const showLineNumbers = lines.length > 5;

      return (
        <div>
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
            <span
              data-testid="code-language-label"
              className="text-xs text-muted-foreground font-mono"
            >
              {language}
            </span>
            <CopyButton text={codeText} />
          </div>
          {showLineNumbers ? (
            <div className="relative">
              <code
                className={`${className} block p-4 pl-14`}
                {...props}
              >
                {lines.map((line, i) => (
                  <span key={i} className="block relative">
                    <span
                      data-testid="code-line-number"
                      className="absolute -left-10 w-8 text-right select-none text-zinc-600 text-xs"
                    >
                      {i + 1}
                    </span>
                    {line}
                    {i < lines.length - 1 ? '\n' : ''}
                  </span>
                ))}
              </code>
            </div>
          ) : (
            <code className={`${className} block p-4`} {...props}>
              {children}
            </code>
          )}
        </div>
      );
    }

    // Inline code
    return (
      <code
        className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono text-foreground"
        {...props}
      >
        {children}
      </code>
    );
  },

  // Links open in external browser
  a({ children, href, ...props }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
        {...props}
      >
        {children}
      </a>
    );
  },

  // Headers
  h1({ children, ...props }) {
    return (
      <h1 className="text-2xl font-bold mt-6 mb-3" {...props}>
        {children}
      </h1>
    );
  },
  h2({ children, ...props }) {
    return (
      <h2 className="text-xl font-bold mt-5 mb-2" {...props}>
        {children}
      </h2>
    );
  },
  h3({ children, ...props }) {
    return (
      <h3 className="text-lg font-semibold mt-4 mb-2" {...props}>
        {children}
      </h3>
    );
  },
  h4({ children, ...props }) {
    return (
      <h4 className="text-base font-semibold mt-3 mb-1" {...props}>
        {children}
      </h4>
    );
  },
  h5({ children, ...props }) {
    return (
      <h5 className="text-sm font-semibold mt-3 mb-1" {...props}>
        {children}
      </h5>
    );
  },
  h6({ children, ...props }) {
    return (
      <h6 className="text-sm font-medium mt-3 mb-1 text-muted-foreground" {...props}>
        {children}
      </h6>
    );
  },

  // Lists
  ul({ children, ...props }) {
    return (
      <ul className="list-disc list-inside space-y-1 my-2" {...props}>
        {children}
      </ul>
    );
  },
  ol({ children, ...props }) {
    return (
      <ol className="list-decimal list-inside space-y-1 my-2" {...props}>
        {children}
      </ol>
    );
  },
  li({ children, ...props }) {
    return (
      <li className="leading-relaxed" {...props}>
        {children}
      </li>
    );
  },

  // Blockquotes
  blockquote({ children, ...props }) {
    return (
      <blockquote
        className="border-l-4 border-muted-foreground/30 pl-4 my-3 italic text-muted-foreground"
        {...props}
      >
        {children}
      </blockquote>
    );
  },

  // Tables
  table({ children, ...props }) {
    return (
      <div className="overflow-x-auto my-3">
        <table className="min-w-full border-collapse text-sm" {...props}>
          {children}
        </table>
      </div>
    );
  },
  thead({ children, ...props }) {
    return (
      <thead className="border-b border-border" {...props}>
        {children}
      </thead>
    );
  },
  th({ children, ...props }) {
    return (
      <th
        className="px-3 py-2 text-left font-semibold text-foreground"
        {...props}
      >
        {children}
      </th>
    );
  },
  td({ children, ...props }) {
    return (
      <td className="px-3 py-2 border-t border-border" {...props}>
        {children}
      </td>
    );
  },

  // Images - rendered with clickable lightbox viewer
  img({ alt, src }) {
    return <ImageViewer src={src || ''} alt={alt || ''} />;
  },

  // Paragraphs
  p({ children, ...props }) {
    return (
      <p className="my-2 leading-relaxed" {...props}>
        {children}
      </p>
    );
  },

  // Horizontal rules
  hr({ ...props }) {
    return <hr className="my-4 border-border" {...props} />;
  },

  // Strong/emphasis
  strong({ children, ...props }) {
    return (
      <strong className="font-bold" {...props}>
        {children}
      </strong>
    );
  },
  em({ children, ...props }) {
    return (
      <em className="italic" {...props}>
        {children}
      </em>
    );
  },
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-content text-sm break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
