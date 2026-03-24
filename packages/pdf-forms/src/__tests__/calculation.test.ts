import { describe, expect, test } from 'bun:test';
import { evaluateFormula } from '../calculation/formulas';
import { createTaxTableRegistry } from '../calculation/tax-tables';
import { irsRound, roundToCents } from '../calculation/rounding';
import { calculateFields } from '../calculation/index';
import type { FormulaExpression } from '../types/calculation-types';
import type { FormSchema } from '../types/schema-types';
import { FieldType } from '../types/field-types';
import type { CalculationError } from '../types/result-types';

const taxTables = createTaxTableRegistry();
const emptyValues = new Map<string, number>();

function eval_(expr: FormulaExpression, values?: Map<string, number>) {
  return evaluateFormula(expr, values ?? emptyValues, taxTables);
}

// ─── Formula evaluation ───

describe('evaluateFormula', () => {
  test('literal returns value', () => {
    expect(eval_({ op: 'literal', value: 5000 })).toBe(5000);
  });

  test('ref returns stored value', () => {
    const vals = new Map([['income', 100000]]);
    expect(eval_({ op: 'ref', field: 'income' }, vals)).toBe(100000);
  });

  test('ref throws MISSING_INPUT for unknown field', () => {
    try {
      eval_({ op: 'ref', field: 'missing' });
      expect(true).toBe(false);
    } catch (e) {
      expect((e as CalculationError).code).toBe('MISSING_INPUT');
    }
  });

  test('add sums operands', () => {
    const vals = new Map([['a', 100], ['b', 200], ['c', 300]]);
    const expr: FormulaExpression = {
      op: 'add',
      operands: [
        { op: 'ref', field: 'a' },
        { op: 'ref', field: 'b' },
        { op: 'ref', field: 'c' },
      ],
    };
    expect(eval_(expr, vals)).toBe(600);
  });

  test('subtract', () => {
    const vals = new Map([['gross', 10000], ['deduction', 3000]]);
    const expr: FormulaExpression = {
      op: 'subtract',
      left: { op: 'ref', field: 'gross' },
      right: { op: 'ref', field: 'deduction' },
    };
    expect(eval_(expr, vals)).toBe(7000);
  });

  test('multiply', () => {
    const vals = new Map([['amount', 10000]]);
    const expr: FormulaExpression = {
      op: 'multiply',
      left: { op: 'ref', field: 'amount' },
      right: { op: 'literal', value: 0.10 },
    };
    expect(eval_(expr, vals)).toBe(1000);
  });

  test('divide', () => {
    const vals = new Map([['total', 10000]]);
    const expr: FormulaExpression = {
      op: 'divide',
      left: { op: 'ref', field: 'total' },
      right: { op: 'literal', value: 4 },
    };
    expect(eval_(expr, vals)).toBe(2500);
  });

  test('divide by zero throws DIVISION_BY_ZERO', () => {
    const vals = new Map([['a', 100]]);
    const expr: FormulaExpression = {
      op: 'divide',
      left: { op: 'ref', field: 'a' },
      right: { op: 'literal', value: 0 },
    };
    try {
      eval_(expr, vals);
      expect(true).toBe(false);
    } catch (e) {
      expect((e as CalculationError).code).toBe('DIVISION_BY_ZERO');
    }
  });

  test('min returns minimum', () => {
    const vals = new Map([['a', 500], ['b', 300], ['c', 700]]);
    const expr: FormulaExpression = {
      op: 'min',
      operands: [
        { op: 'ref', field: 'a' },
        { op: 'ref', field: 'b' },
        { op: 'ref', field: 'c' },
      ],
    };
    expect(eval_(expr, vals)).toBe(300);
  });

  test('max returns maximum', () => {
    const vals = new Map([['a', 500], ['b', 300], ['c', 700]]);
    const expr: FormulaExpression = {
      op: 'max',
      operands: [
        { op: 'ref', field: 'a' },
        { op: 'ref', field: 'b' },
        { op: 'ref', field: 'c' },
      ],
    };
    expect(eval_(expr, vals)).toBe(700);
  });

  test('if true branch', () => {
    const vals = new Map([['flag', 1], ['a', 100], ['b', 200]]);
    const expr: FormulaExpression = {
      op: 'if',
      condition: { field: 'flag', operator: 'truthy' },
      then: { op: 'ref', field: 'a' },
      else: { op: 'ref', field: 'b' },
    };
    expect(eval_(expr, vals)).toBe(100);
  });

  test('if false branch', () => {
    const vals = new Map([['flag', 0], ['a', 100], ['b', 200]]);
    const expr: FormulaExpression = {
      op: 'if',
      condition: { field: 'flag', operator: 'truthy' },
      then: { op: 'ref', field: 'a' },
      else: { op: 'ref', field: 'b' },
    };
    expect(eval_(expr, vals)).toBe(200);
  });

  test('round nearest within formula', () => {
    const vals = new Map([['amount', 1050]]);
    const expr: FormulaExpression = {
      op: 'round',
      operand: { op: 'ref', field: 'amount' },
      rule: 'nearest',
    };
    expect(eval_(expr, vals)).toBe(1100);
  });
});

// ─── Rounding ───

describe('irsRound', () => {
  test('149 cents nearest -> 100', () => {
    expect(irsRound(149, 'nearest')).toBe(100);
  });

  test('150 cents nearest -> 200', () => {
    expect(irsRound(150, 'nearest')).toBe(200);
  });

  test('151 cents nearest -> 200', () => {
    expect(irsRound(151, 'nearest')).toBe(200);
  });

  test('0 cents nearest -> 0', () => {
    expect(irsRound(0, 'nearest')).toBe(0);
  });

  test('100 cents nearest -> 100 (exact dollar)', () => {
    expect(irsRound(100, 'nearest')).toBe(100);
  });

  test('down rounds to floor', () => {
    expect(irsRound(199, 'down')).toBe(100);
    expect(irsRound(100, 'down')).toBe(100);
    expect(irsRound(201, 'down')).toBe(200);
  });

  test('up rounds to ceil', () => {
    expect(irsRound(101, 'up')).toBe(200);
    expect(irsRound(100, 'up')).toBe(100);
    expect(irsRound(200, 'up')).toBe(200);
  });
});

describe('roundToCents', () => {
  test('rounds fractional to nearest integer', () => {
    expect(roundToCents(100.4)).toBe(100);
    expect(roundToCents(100.5)).toBe(101);
    expect(roundToCents(100.6)).toBe(101);
  });
});

// ─── Tax tables ───

describe('tax tables', () => {
  test('single filer $50,000 income (in cents)', () => {
    // $50,000 falls in the 22% bracket for single
    // Tax = $5,426 + 22% * ($50,000 - $47,150) = $5,426 + $627 = $6,053
    const incomeCents = 50000 * 100;
    const tax = taxTables.lookup('federal_income_tax', incomeCents, 'single');
    expect(tax).toBe(605300); // $6,053.00 in cents
  });

  test('single filer $10,000 income (10% bracket only)', () => {
    // $10,000 in the 10% bracket: $10,000 * 0.10 = $1,000
    const incomeCents = 10000 * 100;
    const tax = taxTables.lookup('federal_income_tax', incomeCents, 'single');
    expect(tax).toBe(100000); // $1,000.00 in cents
  });

  test('married joint $100,000 income', () => {
    // $100,000 falls in the 22% bracket for married_joint
    // Tax = $10,852 + 22% * ($100,000 - $94,300) = $10,852 + $1,254 = $12,106
    const incomeCents = 100000 * 100;
    const tax = taxTables.lookup('federal_income_tax', incomeCents, 'married_joint');
    expect(tax).toBe(1210600); // $12,106.00 in cents
  });

  test('zero income returns zero tax', () => {
    expect(taxTables.lookup('federal_income_tax', 0, 'single')).toBe(0);
  });

  test('standard deduction lookup', () => {
    expect(taxTables.lookup('standard_deduction', 0, 'single')).toBe(1460000); // $14,600
    expect(taxTables.lookup('standard_deduction', 0, 'married_joint')).toBe(2920000); // $29,200
  });

  test('unknown table throws', () => {
    try {
      taxTables.lookup('unknown_table', 100, 'single');
      expect(true).toBe(false);
    } catch (e) {
      expect((e as any).code).toBe('MISSING_INPUT');
    }
  });

  test('unknown filing status throws', () => {
    try {
      taxTables.lookup('federal_income_tax', 100, 'invalid_status');
      expect(true).toBe(false);
    } catch (e) {
      expect((e as any).code).toBe('MISSING_INPUT');
    }
  });
});

// ─── Full calculateFields ───

describe('calculateFields', () => {
  test('3 computed fields with dependencies', () => {
    const schema: FormSchema = {
      formCode: '1040-simple',
      taxYear: 2024,
      irsRevision: '2024-01',
      name: 'Simplified 1040',
      fields: [
        { id: 'wages', pdfFieldName: 'wages', label: 'Wages', type: FieldType.Currency },
        { id: 'interest', pdfFieldName: 'interest', label: 'Interest', type: FieldType.Currency },
        {
          id: 'total_income',
          pdfFieldName: 'total_income',
          label: 'Total Income',
          type: FieldType.Currency,
          calculation: {
            formula: {
              op: 'add',
              operands: [
                { op: 'ref', field: 'wages' },
                { op: 'ref', field: 'interest' },
              ],
            },
          },
        },
        {
          id: 'deduction',
          pdfFieldName: 'deduction',
          label: 'Standard Deduction',
          type: FieldType.Currency,
          calculation: {
            formula: { op: 'literal', value: 1460000 }, // $14,600 in cents
          },
        },
        {
          id: 'taxable_income',
          pdfFieldName: 'taxable_income',
          label: 'Taxable Income',
          type: FieldType.Currency,
          calculation: {
            formula: {
              op: 'max',
              operands: [
                {
                  op: 'subtract',
                  left: { op: 'ref', field: 'total_income' },
                  right: { op: 'ref', field: 'deduction' },
                },
                { op: 'literal', value: 0 },
              ],
            },
            roundingRule: 'down',
          },
        },
      ],
    };

    const result = calculateFields(schema, {
      wages: 5000000,     // $50,000 in cents
      interest: 100000,   // $1,000 in cents
    });

    // total_income = 5000000 + 100000 = 5100000
    expect(result.values['total_income']).toBe(5100000);
    // deduction = 1460000
    expect(result.values['deduction']).toBe(1460000);
    // taxable_income = max(5100000 - 1460000, 0) = 3640000 (already dollar-aligned)
    expect(result.values['taxable_income']).toBe(3640000);

    // Log should have 3 entries
    expect(result.log).toHaveLength(3);
    expect(result.log[0].fieldId).toBe('total_income');
    expect(result.log[1].fieldId).toBe('deduction');
    expect(result.log[2].fieldId).toBe('taxable_income');
  });

  test('empty schema with no calculated fields', () => {
    const schema: FormSchema = {
      formCode: 'test',
      taxYear: 2024,
      irsRevision: '2024-01',
      name: 'Test',
      fields: [
        { id: 'name', pdfFieldName: 'name', label: 'Name', type: FieldType.Text },
      ],
    };
    const result = calculateFields(schema, { name: 'John' });
    expect(result.log).toHaveLength(0);
  });

  test('rounding is applied to results', () => {
    const schema: FormSchema = {
      formCode: 'test',
      taxYear: 2024,
      irsRevision: '2024-01',
      name: 'Test',
      fields: [
        { id: 'amount', pdfFieldName: 'amount', label: 'Amount', type: FieldType.Currency },
        {
          id: 'half',
          pdfFieldName: 'half',
          label: 'Half',
          type: FieldType.Currency,
          calculation: {
            formula: {
              op: 'divide',
              left: { op: 'ref', field: 'amount' },
              right: { op: 'literal', value: 3 },
            },
            roundingRule: 'nearest',
          },
        },
      ],
    };
    // 10000 / 3 = 3333.33... -> roundToCents -> 3333 -> irsRound nearest -> 3300
    const result = calculateFields(schema, { amount: 10000 });
    expect(result.values['half']).toBe(3300);
  });
});
