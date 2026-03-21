import { useState, useRef, useEffect } from 'react';

interface McpStatusPillProps {
  serverNames: string[];
}

/**
 * Compact pill shown in the chat composer toolbar when there are enabled
 * non-internal MCP servers. Clicking it opens a small dropdown listing them.
 */
export function McpStatusPill({ serverNames }: McpStatusPillProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-testid="mcp-status-pill"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title={`${serverNames.length} MCP server${serverNames.length !== 1 ? 's' : ''} active`}
      >
        {/* Green dot */}
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" />
        <span>{serverNames.length} MCP{serverNames.length !== 1 ? 's' : ''}</span>
      </button>

      {open && (
        <div
          data-testid="mcp-status-dropdown"
          className="absolute bottom-full left-0 z-20 mb-1.5 min-w-[160px] rounded-lg border border-border bg-popover py-1 shadow-lg"
        >
          <p className="px-3 py-1 text-xs font-medium text-muted-foreground">Active MCP servers</p>
          <ul>
            {serverNames.map((name) => (
              <li
                key={name}
                className="flex items-center gap-2 px-3 py-1 text-xs text-foreground"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" aria-hidden="true" />
                {name}
              </li>
            ))}
          </ul>
          <div className="mt-1 border-t border-border/50 px-3 py-1">
            <a
              href="https://modelcontextprotocol.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              MCP documentation
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
