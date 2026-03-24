/**
 * IRS 2024 federal income tax brackets and standard deductions.
 * All monetary values in cents (integers).
 */

export interface TaxBracket {
  min: number;      // in cents
  max: number;      // in cents (Infinity for top bracket)
  rate: number;     // decimal (0.10 = 10%)
  baseTax: number;  // in cents — cumulative tax from lower brackets
}

export type FilingStatus = 'single' | 'married_joint' | 'married_separate' | 'head_of_household';

export interface TaxTableRegistry {
  lookup(table: string, incomeCents: number, filingStatus: string): number;
}

// Helper: convert dollar amount to cents
function $(dollars: number): number {
  return dollars * 100;
}

/**
 * 2024 Federal Income Tax Brackets.
 * Rates: 10%, 12%, 22%, 24%, 32%, 35%, 37%
 */
const BRACKETS_2024: Record<FilingStatus, TaxBracket[]> = {
  single: [
    { min: $(0),       max: $(11600),   rate: 0.10, baseTax: $(0) },
    { min: $(11600),   max: $(47150),   rate: 0.12, baseTax: $(1160) },
    { min: $(47150),   max: $(100525),  rate: 0.22, baseTax: $(5426) },
    { min: $(100525),  max: $(191950),  rate: 0.24, baseTax: $(17168.50) },
    { min: $(191950),  max: $(243725),  rate: 0.32, baseTax: $(39110.50) },
    { min: $(243725),  max: $(609350),  rate: 0.35, baseTax: $(55678.50) },
    { min: $(609350),  max: Infinity,   rate: 0.37, baseTax: $(183647.25) },
  ],
  married_joint: [
    { min: $(0),       max: $(23200),   rate: 0.10, baseTax: $(0) },
    { min: $(23200),   max: $(94300),   rate: 0.12, baseTax: $(2320) },
    { min: $(94300),   max: $(201050),  rate: 0.22, baseTax: $(10852) },
    { min: $(201050),  max: $(383900),  rate: 0.24, baseTax: $(34337) },
    { min: $(383900),  max: $(487450),  rate: 0.32, baseTax: $(78221) },
    { min: $(487450),  max: $(731200),  rate: 0.35, baseTax: $(111357) },
    { min: $(731200),  max: Infinity,   rate: 0.37, baseTax: $(196669.50) },
  ],
  married_separate: [
    { min: $(0),       max: $(11600),   rate: 0.10, baseTax: $(0) },
    { min: $(11600),   max: $(47150),   rate: 0.12, baseTax: $(1160) },
    { min: $(47150),   max: $(100525),  rate: 0.22, baseTax: $(5426) },
    { min: $(100525),  max: $(191950),  rate: 0.24, baseTax: $(17168.50) },
    { min: $(191950),  max: $(243725),  rate: 0.32, baseTax: $(39110.50) },
    { min: $(243725),  max: $(365600),  rate: 0.35, baseTax: $(55678.50) },
    { min: $(365600),  max: Infinity,   rate: 0.37, baseTax: $(98334.75) },
  ],
  head_of_household: [
    { min: $(0),       max: $(16550),   rate: 0.10, baseTax: $(0) },
    { min: $(16550),   max: $(63100),   rate: 0.12, baseTax: $(1655) },
    { min: $(63100),   max: $(100500),  rate: 0.22, baseTax: $(7241) },
    { min: $(100500),  max: $(191950),  rate: 0.24, baseTax: $(15469) },
    { min: $(191950),  max: $(243700),  rate: 0.32, baseTax: $(37417) },
    { min: $(243700),  max: $(609350),  rate: 0.35, baseTax: $(53977) },
    { min: $(609350),  max: Infinity,   rate: 0.37, baseTax: $(181954.50) },
  ],
};

/**
 * 2024 Standard Deductions in cents.
 */
const STANDARD_DEDUCTIONS_2024: Record<FilingStatus, number> = {
  single: $(14600),
  married_joint: $(29200),
  married_separate: $(14600),
  head_of_household: $(21900),
};

/**
 * Calculate tax from brackets for a given taxable income in cents.
 */
function calculateBracketTax(brackets: TaxBracket[], incomeCents: number): number {
  if (incomeCents <= 0) return 0;

  for (let i = brackets.length - 1; i >= 0; i--) {
    const bracket = brackets[i];
    if (incomeCents > bracket.min) {
      const taxableInBracket = Math.min(incomeCents, bracket.max) - bracket.min;
      return Math.round(bracket.baseTax + taxableInBracket * bracket.rate);
    }
  }

  return 0;
}

/**
 * Create a TaxTableRegistry with 2024 IRS tables.
 */
export function createTaxTableRegistry(): TaxTableRegistry {
  return {
    lookup(table: string, incomeCents: number, filingStatus: string): number {
      const status = filingStatus as FilingStatus;

      if (table === 'federal_income_tax' || table === 'income_tax') {
        const brackets = BRACKETS_2024[status];
        if (!brackets) {
          throw Object.assign(
            new Error(`Unknown filing status: ${filingStatus}`),
            { type: 'calculation' as const, code: 'MISSING_INPUT' as const }
          );
        }
        return calculateBracketTax(brackets, incomeCents);
      }

      if (table === 'standard_deduction') {
        const deduction = STANDARD_DEDUCTIONS_2024[status];
        if (deduction === undefined) {
          throw Object.assign(
            new Error(`Unknown filing status for standard deduction: ${filingStatus}`),
            { type: 'calculation' as const, code: 'MISSING_INPUT' as const }
          );
        }
        return deduction;
      }

      throw Object.assign(
        new Error(`Unknown tax table: ${table}`),
        { type: 'calculation' as const, code: 'MISSING_INPUT' as const }
      );
    },
  };
}
