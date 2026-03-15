import { describe, it, expect } from 'vitest';
import {
  MODEL_PRICING,
  calculateCost,
  formatCost,
  getModelFromName,
  type TokenUsage,
} from '../pricing';

describe('MODEL_PRICING', () => {
  it('has pricing for opus', () => {
    const opus = MODEL_PRICING.opus;
    expect(opus).toBeDefined();
    expect(opus.inputPerMillion).toBe(15);
    expect(opus.outputPerMillion).toBe(75);
  });

  it('has pricing for sonnet', () => {
    const sonnet = MODEL_PRICING.sonnet;
    expect(sonnet).toBeDefined();
    expect(sonnet.inputPerMillion).toBe(3);
    expect(sonnet.outputPerMillion).toBe(15);
  });

  it('has pricing for haiku', () => {
    const haiku = MODEL_PRICING.haiku;
    expect(haiku).toBeDefined();
    expect(haiku.inputPerMillion).toBe(0.25);
    expect(haiku.outputPerMillion).toBe(1.25);
  });

  it('applies 90% discount on cache read tokens', () => {
    const opus = MODEL_PRICING.opus;
    expect(opus.cacheReadDiscount).toBe(0.9);
  });

  it('applies 25% premium on cache write tokens', () => {
    const opus = MODEL_PRICING.opus;
    expect(opus.cacheWritePremium).toBe(0.25);
  });
});

describe('getModelFromName', () => {
  it('identifies opus models', () => {
    expect(getModelFromName('claude-opus-4')).toBe('opus');
    expect(getModelFromName('claude-opus-4-20250514')).toBe('opus');
  });

  it('identifies sonnet models', () => {
    expect(getModelFromName('claude-sonnet-4-20250514')).toBe('sonnet');
    expect(getModelFromName('claude-3-5-sonnet-20241022')).toBe('sonnet');
  });

  it('identifies haiku models', () => {
    expect(getModelFromName('claude-3-5-haiku-20241022')).toBe('haiku');
    expect(getModelFromName('claude-haiku-3')).toBe('haiku');
  });

  it('defaults to sonnet for unknown models', () => {
    expect(getModelFromName('unknown-model')).toBe('sonnet');
    expect(getModelFromName('')).toBe('sonnet');
  });
});

describe('calculateCost', () => {
  it('calculates cost for input and output tokens', () => {
    const usage: TokenUsage = {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    };
    // Opus: $15/M input + $75/M output = $90
    const cost = calculateCost(usage, 'opus');
    expect(cost).toBeCloseTo(90, 2);
  });

  it('calculates cost with sonnet pricing', () => {
    const usage: TokenUsage = {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    };
    // Sonnet: $3/M input + $15/M output = $18
    const cost = calculateCost(usage, 'sonnet');
    expect(cost).toBeCloseTo(18, 2);
  });

  it('calculates cost with haiku pricing', () => {
    const usage: TokenUsage = {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    };
    // Haiku: $0.25/M input + $1.25/M output = $1.50
    const cost = calculateCost(usage, 'haiku');
    expect(cost).toBeCloseTo(1.5, 2);
  });

  it('applies cache read discount (90% off input price)', () => {
    const usage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 1_000_000,
      cacheCreationTokens: 0,
    };
    // Opus cache read: $15 * (1 - 0.9) = $1.50 per million
    const cost = calculateCost(usage, 'opus');
    expect(cost).toBeCloseTo(1.5, 2);
  });

  it('applies cache write premium (25% more than input price)', () => {
    const usage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 1_000_000,
    };
    // Opus cache write: $15 * (1 + 0.25) = $18.75 per million
    const cost = calculateCost(usage, 'opus');
    expect(cost).toBeCloseTo(18.75, 2);
  });

  it('calculates cost for realistic small usage', () => {
    const usage: TokenUsage = {
      inputTokens: 5_000,
      outputTokens: 1_000,
      cacheReadTokens: 10_000,
      cacheCreationTokens: 2_000,
    };
    // Sonnet:
    // Input: 5000/1M * $3 = $0.015
    // Output: 1000/1M * $15 = $0.015
    // Cache read: 10000/1M * $3 * 0.1 = $0.003
    // Cache write: 2000/1M * $3 * 1.25 = $0.0075
    // Total = $0.0405
    const cost = calculateCost(usage, 'sonnet');
    expect(cost).toBeCloseTo(0.0405, 4);
  });

  it('returns 0 when all token counts are 0', () => {
    const usage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    };
    expect(calculateCost(usage, 'opus')).toBe(0);
  });

  it('handles very small token counts without precision issues', () => {
    const usage: TokenUsage = {
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    };
    // Sonnet: 100/1M * $3 + 50/1M * $15 = $0.0003 + $0.00075 = $0.00105
    const cost = calculateCost(usage, 'sonnet');
    expect(cost).toBeCloseTo(0.00105, 5);
  });
});

describe('formatCost', () => {
  it('formats zero cost', () => {
    expect(formatCost(0)).toBe('$0.00');
  });

  it('formats small costs with two decimal places', () => {
    expect(formatCost(0.03)).toBe('$0.03');
  });

  it('formats costs over a dollar', () => {
    expect(formatCost(1.24)).toBe('$1.24');
  });

  it('formats costs over ten dollars', () => {
    expect(formatCost(12.5)).toBe('$12.50');
  });

  it('formats very small costs (sub-cent) with enough precision', () => {
    // Sub-cent values should show at least 4 decimal places
    expect(formatCost(0.001)).toBe('$0.0010');
  });

  it('formats sub-cent values with trailing zeros for clarity', () => {
    expect(formatCost(0.0042)).toBe('$0.0042');
  });

  it('rounds appropriately', () => {
    expect(formatCost(0.999)).toBe('$1.00');
  });

  it('handles negative values (should not happen but be safe)', () => {
    expect(formatCost(-0.05)).toBe('-$0.05');
  });
});
