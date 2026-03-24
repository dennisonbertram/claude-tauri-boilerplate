/**
 * IRS rounding rules for tax calculations.
 * All monetary values are in cents (integers).
 */

/**
 * Round cents to the nearest dollar boundary (multiple of 100).
 * - 'nearest': 50+ cents rounds up, below rounds down
 * - 'down': floor to dollar
 * - 'up': ceil to dollar
 */
export function irsRound(cents: number, rule: 'nearest' | 'down' | 'up' = 'nearest'): number {
  switch (rule) {
    case 'nearest': {
      const remainder = cents % 100;
      if (remainder === 0) return cents;
      if (cents >= 0) {
        return remainder >= 50 ? cents + (100 - remainder) : cents - remainder;
      }
      // Negative: -150 nearest → -200, -149 nearest → -100
      const absRemainder = ((cents % 100) + 100) % 100;
      return absRemainder >= 50 ? cents - absRemainder + 100 : cents - absRemainder;
    }
    case 'down':
      return Math.floor(cents / 100) * 100;
    case 'up':
      return Math.ceil(cents / 100) * 100;
  }
}

/**
 * Round to the nearest cent (integer). For intermediate calculations
 * that may produce fractional cents from multiplication/division.
 */
export function roundToCents(value: number): number {
  return Math.round(value);
}
