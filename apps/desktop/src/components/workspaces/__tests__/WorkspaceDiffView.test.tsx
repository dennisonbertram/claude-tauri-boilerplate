import { describe, it, expect } from 'vitest';
import { parseWorkspaceDiff } from '../WorkspaceDiffView';

describe('WorkspaceDiffView', () => {
  it('parses unified diff into side-by-side-ready file rows', () => {
    const diff = [
      'diff --git a/src/app.js b/src/app.js',
      'index 1111111..2222222 100644',
      '--- a/src/app.js',
      '+++ b/src/app.js',
      '@@ -1,2 +1,3 @@',
      ' line-1',
      '-line-2',
      '+line-2 changed',
      '+line-3',
      ' line-4',
    ].join('\n');

    const parsed = parseWorkspaceDiff(diff);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].path).toBe('src/app.js');
    expect(parsed[0].lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'context', oldLine: 1, newLine: 1, content: 'line-1' }),
        expect.objectContaining({ type: 'removed', oldLine: 2, content: 'line-2' }),
        expect.objectContaining({ type: 'added', newLine: 2, content: 'line-2 changed' }),
        expect.objectContaining({ type: 'added', newLine: 3, content: 'line-3' }),
        expect.objectContaining({ type: 'context', oldLine: 3, newLine: 4, content: 'line-4' }),
      ])
    );
  });
});
