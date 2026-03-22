interface FileMentionPaletteProps {
  candidates: string[];
  selectedIndex: number;
  onSelect: (path: string) => void;
  onHover: (index: number) => void;
}

export function FileMentionPalette({
  candidates,
  selectedIndex,
  onSelect,
  onHover,
}: FileMentionPaletteProps) {
  return (
    <div
      className="absolute bottom-full left-0 right-0 z-10 mb-1 rounded-lg border border-border bg-popover shadow-lg"
      data-testid="file-mention-palette"
    >
      {candidates.length === 0 && (
        <div className="px-3 py-2 text-sm text-muted-foreground">
          No matching files
        </div>
      )}
      {candidates.length > 0 && (
        <ul>
          {candidates.map((filePath, index) => (
            <li
              key={filePath}
              data-testid="file-mention-item"
              data-selected={selectedIndex === index ? 'true' : 'false'}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(filePath)}
              onMouseEnter={() => onHover(index)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                selectedIndex === index
                  ? 'bg-accent text-accent-foreground'
                  : 'text-popover-foreground'
              }`}
            >
              {filePath}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
