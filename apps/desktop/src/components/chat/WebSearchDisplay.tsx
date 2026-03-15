import { useState } from 'react';
import {
  Globe,
  CheckCircle2,
  Loader2,
  XCircle,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import type { ToolCallState } from '@/hooks/useStreamEvents';
import { parseToolInput } from './file-utils';

interface WebSearchDisplayProps {
  toolCall: ToolCallState;
}

interface WebSearchInput {
  query: string;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/** Maximum number of results shown before collapsing */
const INITIAL_RESULT_COUNT = 5;

/**
 * Parse the search result from the tool output.
 * The result may be a JSON string of an array, or an already-parsed array.
 */
function parseSearchResults(result: unknown): SearchResult[] {
  if (!result) return [];

  let parsed: unknown;
  if (typeof result === 'string') {
    if (!result.trim()) return [];
    try {
      parsed = JSON.parse(result);
    } catch {
      return [];
    }
  } else {
    parsed = result;
  }

  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (item): item is SearchResult =>
      item &&
      typeof item === 'object' &&
      typeof item.title === 'string' &&
      typeof item.url === 'string'
  );
}

function StatusIndicator({ status }: { status: ToolCallState['status'] }) {
  switch (status) {
    case 'running':
      return (
        <Loader2
          className="h-4 w-4 animate-spin text-blue-400"
          data-testid="status-running"
        />
      );
    case 'complete':
      return (
        <CheckCircle2
          className="h-4 w-4 text-green-400"
          data-testid="status-complete"
        />
      );
    case 'error':
      return (
        <XCircle
          className="h-4 w-4 text-red-400"
          data-testid="status-error"
        />
      );
  }
}

export function WebSearchDisplay({ toolCall }: WebSearchDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const input = parseToolInput<WebSearchInput>(toolCall.input);
  const query = input.query || '';
  const results = parseSearchResults(toolCall.result);
  const hasResults = results.length > 0;
  const needsCollapse = results.length > INITIAL_RESULT_COUNT;
  const visibleResults = isExpanded
    ? results
    : results.slice(0, INITIAL_RESULT_COUNT);
  const hiddenCount = results.length - INITIAL_RESULT_COUNT;

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/30 text-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Globe className="h-4 w-4 text-blue-400 shrink-0" />
        <span className="font-medium text-foreground">Web Search</span>
        <code
          data-testid="websearch-query"
          className="text-xs font-mono bg-muted rounded px-1.5 py-0.5 text-foreground/80 truncate"
        >
          {query}
        </code>

        {hasResults && (
          <span
            data-testid="websearch-result-count"
            className="ml-auto text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 font-mono"
          >
            {results.length}
          </span>
        )}

        <span className="shrink-0">
          <StatusIndicator status={toolCall.status} />
        </span>
      </div>

      {/* Empty state */}
      {toolCall.status !== 'running' && !hasResults && (
        <div
          data-testid="websearch-empty"
          className="px-3 py-3 text-sm text-muted-foreground italic border-t border-border"
        >
          No search results found
        </div>
      )}

      {/* Result cards */}
      {hasResults && (
        <div className="border-t border-border">
          {visibleResults.map((result, i) => (
            <div
              key={`${result.url}-${i}`}
              data-testid="websearch-result-card"
              className="px-3 py-2 border-b border-border/30 last:border-b-0 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <a
                    data-testid="websearch-result-link"
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-400 hover:text-blue-300 hover:underline transition-colors truncate block"
                  >
                    {result.title}
                  </a>
                  <div className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                    {result.url}
                  </div>
                  {result.snippet && (
                    <div className="text-xs text-foreground/70 mt-1 line-clamp-2">
                      {result.snippet}
                    </div>
                  )}
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              </div>
            </div>
          ))}

          {/* Expand/collapse button */}
          {needsCollapse && !isExpanded && (
            <button
              data-testid="websearch-expand-btn"
              onClick={() => setIsExpanded(true)}
              className="flex w-full items-center justify-center gap-1 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <ChevronDown className="h-3 w-3" />
              {hiddenCount} more result{hiddenCount !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
