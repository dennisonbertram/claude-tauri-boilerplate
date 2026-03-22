export type DiffMode = 'unified' | 'side-by-side';
export type DiffLineType = 'meta' | 'hunk' | 'context' | 'added' | 'removed';

export interface ParsedDiffLine {
  type: DiffLineType;
  content: string;
  oldLine?: number | null;
  newLine?: number | null;
}

export interface ParsedDiffFile {
  path: string;
  lines: ParsedDiffLine[];
}

/** @deprecated Use DiffComment from shared types instead */
export interface InlineComment {
  id: string;
  markdown: string;
  isAI?: boolean;
  severity?: import('@claude-tauri/shared').CodeReviewComment['severity'];
}

export const statusLabels: Record<string, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  untracked: '?',
};

export const statusColors: Record<string, string> = {
  modified: 'text-yellow-400',
  added: 'text-green-400',
  deleted: 'text-red-400',
  renamed: 'text-blue-400',
  untracked: 'text-muted-foreground',
};

export function parseWorkspaceDiff(rawDiff: string): ParsedDiffFile[] {
  const parsedFiles: ParsedDiffFile[] = [];
  let currentFile: ParsedDiffFile | null = null;

  let oldLine = 0;
  let newLine = 0;

  const lines = rawDiff.split('\n');

  const flushFile = () => {
    if (currentFile) {
      parsedFiles.push(currentFile);
    }
  };

  for (const rawLine of lines) {
    const fileHeaderMatch = rawLine.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (fileHeaderMatch) {
      flushFile();
      currentFile = {
        path: fileHeaderMatch[2],
        lines: [],
      };
      oldLine = 0;
      newLine = 0;
      currentFile.lines.push({ type: 'meta', content: rawLine });
      continue;
    }

    if (!currentFile) {
      continue;
    }

    const hunkMatch = rawLine.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      oldLine = Number(hunkMatch[1]);
      newLine = Number(hunkMatch[3]);
      currentFile.lines.push({ type: 'hunk', content: rawLine });
      continue;
    }

    if (rawLine.startsWith('index ') || rawLine.startsWith('---') || rawLine.startsWith('+++') || rawLine.startsWith('\\ No newline at end of file')) {
      currentFile.lines.push({ type: 'meta', content: rawLine });
      continue;
    }

    if (rawLine.startsWith('+')) {
      currentFile.lines.push({
        type: 'added',
        content: rawLine.slice(1),
        oldLine: null,
        newLine: newLine++,
      });
      continue;
    }

    if (rawLine.startsWith('-')) {
      currentFile.lines.push({
        type: 'removed',
        content: rawLine.slice(1),
        oldLine: oldLine++,
        newLine: null,
      });
      continue;
    }

    if (rawLine.startsWith(' ')) {
      currentFile.lines.push({
        type: 'context',
        content: rawLine.slice(1),
        oldLine: oldLine++,
        newLine: newLine++,
      });
      continue;
    }

    currentFile.lines.push({ type: 'meta', content: rawLine });
  }

  flushFile();
  return parsedFiles;
}

export function lineClassName(type: DiffLineType): string {
  if (type === 'added') return 'bg-green-950/40 text-green-300';
  if (type === 'removed') return 'bg-red-950/40 text-red-300';
  if (type === 'context') return 'text-zinc-300 bg-zinc-900/20';
  if (type === 'hunk') return 'text-cyan-400 bg-zinc-900/50';
  return 'text-zinc-500 bg-zinc-900/30';
}

export function commentKey(filePath: string, lineIndex: number) {
  return `${filePath}:${lineIndex}`;
}
