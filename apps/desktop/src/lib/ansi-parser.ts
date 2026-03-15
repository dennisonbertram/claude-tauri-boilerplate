/**
 * Minimal ANSI escape code parser.
 * Converts ANSI escape sequences into structured segments
 * that can be rendered as styled React elements.
 */

export interface AnsiSegment {
  text: string;
  color?: string;
  bold?: boolean;
  underline?: boolean;
}

/** Maps standard ANSI color codes (30-37) to CSS-friendly names */
const ANSI_COLOR_MAP: Record<number, string> = {
  30: 'black',
  31: 'red',
  32: 'green',
  33: 'yellow',
  34: 'blue',
  35: 'magenta',
  36: 'cyan',
  37: 'white',
  // Bright variants (90-97)
  90: 'bright-black',
  91: 'bright-red',
  92: 'bright-green',
  93: 'bright-yellow',
  94: 'bright-blue',
  95: 'bright-magenta',
  96: 'bright-cyan',
  97: 'bright-white',
};

/** CSS color values for ANSI color names */
export const ANSI_CSS_COLORS: Record<string, string> = {
  black: '#1e1e1e',
  red: '#f87171',
  green: '#4ade80',
  yellow: '#facc15',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#e5e7eb',
  'bright-black': '#6b7280',
  'bright-red': '#fca5a5',
  'bright-green': '#86efac',
  'bright-yellow': '#fde68a',
  'bright-blue': '#93c5fd',
  'bright-magenta': '#d8b4fe',
  'bright-cyan': '#67e8f9',
  'bright-white': '#f9fafb',
};

/**
 * Parse a string containing ANSI escape codes into an array of AnsiSegments.
 * Each segment has the text content plus any active styles.
 */
export function parseAnsi(input: string): AnsiSegment[] {
  const segments: AnsiSegment[] = [];

  // Match ANSI escape sequences: ESC[ ... m
  const ansiRegex = /\x1b\[([0-9;]*)m/g;

  let currentColor: string | undefined;
  let currentBold = false;
  let currentUnderline = false;
  let lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = ansiRegex.exec(input)) !== null) {
    // Push text before this escape sequence
    if (match.index > lastIndex) {
      const text = input.slice(lastIndex, match.index);
      if (text) {
        segments.push({
          text,
          color: currentColor,
          bold: currentBold || undefined,
          underline: currentUnderline || undefined,
        });
      }
    }

    // Parse the codes (semicolon-separated)
    const codes = match[1]
      .split(';')
      .map(c => parseInt(c, 10))
      .filter(c => !isNaN(c));

    // If empty or 0, reset
    if (codes.length === 0 || (codes.length === 1 && codes[0] === 0)) {
      currentColor = undefined;
      currentBold = false;
      currentUnderline = false;
    } else {
      for (const code of codes) {
        if (code === 0) {
          currentColor = undefined;
          currentBold = false;
          currentUnderline = false;
        } else if (code === 1) {
          currentBold = true;
        } else if (code === 4) {
          currentUnderline = true;
        } else if (code === 22) {
          currentBold = false;
        } else if (code === 24) {
          currentUnderline = false;
        } else if (ANSI_COLOR_MAP[code]) {
          currentColor = ANSI_COLOR_MAP[code];
        }
        // Extended color codes (38;5;N) — we strip but render text
        // No special handling needed, they just won't set a color
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // Push remaining text after last escape sequence
  if (lastIndex < input.length) {
    const text = input.slice(lastIndex);
    if (text) {
      segments.push({
        text,
        color: currentColor,
        bold: currentBold || undefined,
        underline: currentUnderline || undefined,
      });
    }
  }

  // If no segments at all (no ANSI codes and no text), handle empty string
  if (segments.length === 0 && input.length > 0) {
    segments.push({ text: input });
  }

  return segments;
}

/**
 * Strip all ANSI escape codes from a string, returning plain text.
 */
export function stripAnsi(input: string): string {
  return input.replace(/\x1b\[[0-9;]*m/g, '');
}
