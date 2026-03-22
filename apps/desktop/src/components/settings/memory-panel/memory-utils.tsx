import type React from 'react';

export function formatBytesInline(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);

  if (idx === -1) return text;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);

  return (
    <>
      {before}
      <mark className="bg-yellow-500/30 text-foreground rounded px-0.5">
        {match}
      </mark>
      {after}
    </>
  );
}
