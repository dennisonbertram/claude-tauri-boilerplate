/**
 * Model pricing constants and cost calculation utilities.
 *
 * Pricing is approximate and intended for display purposes only.
 * Rates are in USD per million tokens.
 */

export interface ModelPricing {
  /** USD per million input tokens */
  inputPerMillion: number;
  /** USD per million output tokens */
  outputPerMillion: number;
  /** Discount multiplier for cache read tokens (0.9 = 90% off input price) */
  cacheReadDiscount: number;
  /** Premium multiplier for cache write tokens (0.25 = 25% more than input price) */
  cacheWritePremium: number;
}

export type ModelTier = 'opus' | 'sonnet' | 'haiku';

export const MODEL_PRICING: Record<ModelTier, ModelPricing> = {
  opus: {
    inputPerMillion: 15,
    outputPerMillion: 75,
    cacheReadDiscount: 0.9,
    cacheWritePremium: 0.25,
  },
  sonnet: {
    inputPerMillion: 3,
    outputPerMillion: 15,
    cacheReadDiscount: 0.9,
    cacheWritePremium: 0.25,
  },
  haiku: {
    inputPerMillion: 0.25,
    outputPerMillion: 1.25,
    cacheReadDiscount: 0.9,
    cacheWritePremium: 0.25,
  },
};

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

/**
 * Determine the model tier from a model name string.
 * Falls back to 'sonnet' for unknown models.
 */
export function getModelFromName(modelName: string): ModelTier {
  const lower = modelName.toLowerCase();
  if (lower.includes('opus')) return 'opus';
  if (lower.includes('haiku')) return 'haiku';
  if (lower.includes('sonnet')) return 'sonnet';
  return 'sonnet'; // default fallback
}

/**
 * Calculate the cost in USD for a given token usage and model tier.
 *
 * - Cache read tokens are charged at (1 - cacheReadDiscount) * input price
 * - Cache write tokens are charged at (1 + cacheWritePremium) * input price
 */
export function calculateCost(usage: TokenUsage, model: ModelTier): number {
  const pricing = MODEL_PRICING[model];
  const perToken = 1_000_000;

  const inputCost = (usage.inputTokens / perToken) * pricing.inputPerMillion;
  const outputCost = (usage.outputTokens / perToken) * pricing.outputPerMillion;
  const cacheReadCost =
    (usage.cacheReadTokens / perToken) *
    pricing.inputPerMillion *
    (1 - pricing.cacheReadDiscount);
  const cacheWriteCost =
    (usage.cacheCreationTokens / perToken) *
    pricing.inputPerMillion *
    (1 + pricing.cacheWritePremium);

  return inputCost + outputCost + cacheReadCost + cacheWriteCost;
}

/**
 * Format a cost in USD for display.
 *
 * - Costs >= $0.01 are shown with 2 decimal places: "$1.24"
 * - Costs < $0.01 are shown with 4 decimal places: "$0.0042"
 * - Zero is shown as "$0.00"
 */
export function formatCost(costUsd: number): string {
  const isNegative = costUsd < 0;
  const abs = Math.abs(costUsd);
  const prefix = isNegative ? '-' : '';

  if (abs < 0.005 && abs > 0) {
    // Sub-cent: show 4 decimal places
    return `${prefix}$${abs.toFixed(4)}`;
  }

  return `${prefix}$${abs.toFixed(2)}`;
}
