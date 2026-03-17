import { describe, it, expect } from 'vitest';
import { rankCommandsByRelevance } from './commandSearch';

describe('rankCommandsByRelevance', () => {
  const commands = [
    { name: 'compact', description: 'Compact the active conversation context' },
    { name: 'cost', description: 'Show current cost and token usage' },
    { name: 'clear', description: 'Clear current chat session' },
    { name: 'sessions', description: 'List and switch between saved sessions' },
  ];

  it('returns all commands when query is empty', () => {
    const ranked = rankCommandsByRelevance(commands, '   ');
    expect(ranked).toEqual(commands);
  });

  it('prefers exact prefix name matches over substring and fuzzy matches', () => {
    const ranked = rankCommandsByRelevance(commands, 'co');
    expect(ranked.slice(0, 2).map((item) => item.name)).toEqual([
      'cost',
      'compact',
    ]);
  });

  it('includes name and description matches with description-based fallback', () => {
    const ranked = rankCommandsByRelevance(
      [
        { name: 'clear', description: 'session is pending' },
        { name: 'export', description: 'session export tool' },
      ],
      'session'
    );
    expect(ranked.map((item) => item.name)).toEqual(['clear', 'export']);
  });

  it('orders fuzzy subsequence results by score', () => {
    const ranked = rankCommandsByRelevance(
      [
        { name: 'compact', description: '...' },
        { name: 'copilot', description: '...' },
      ],
      'cp'
    );
    expect(ranked.map((item) => item.name)).toEqual(['copilot', 'compact']);
  });
});
