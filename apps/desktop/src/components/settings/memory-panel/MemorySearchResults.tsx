import type { MemorySearchResult } from '@claude-tauri/shared';
import { highlightMatch } from './memory-utils';

interface MemorySearchResultsProps {
  query: string;
  results: MemorySearchResult[];
  isSearching: boolean;
}

export function MemorySearchResults({ query, results, isSearching }: MemorySearchResultsProps) {
  if (!query.trim()) return null;

  return (
    <div data-testid="memory-search-results" className="space-y-2">
      <h3 className="text-sm font-medium text-foreground">
        Search Results{' '}
        <span className="text-xs text-muted-foreground">
          ({results.length} match{results.length !== 1 ? 'es' : ''})
        </span>
      </h3>
      {isSearching ? (
        <div className="text-xs text-muted-foreground">Searching...</div>
      ) : results.length === 0 ? (
        <div className="text-xs text-muted-foreground">No results found.</div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {results.map((result, i) => (
            <div
              key={`${result.file}-${result.line}-${i}`}
              data-testid="memory-search-result-item"
              className="rounded-lg border border-border px-3 py-2 text-xs"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-foreground">{result.file}</span>
                <span className="text-muted-foreground">line {result.line}</span>
              </div>
              <div className="font-mono text-foreground/80 whitespace-pre-wrap">
                {highlightMatch(result.text, query)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
