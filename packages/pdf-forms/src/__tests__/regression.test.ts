/**
 * Regression & edge-case tests for pdf-forms package.
 * Covers monetary precision, PDF edge cases, validation edge cases,
 * calculation edge cases, cross-field regression, pipeline regression,
 * and determinism tests.
 */

import { describe, test, expect } from 'bun:test';
import { PDFDocument } from 'pdf-lib';

// Validation imports
import {
  validateSSN,
  validateEIN,
  validateDate,
  validateCurrency,
  validateZipCode,
  validatePhone,
  coerceCurrency,
  coerceFieldValue,
  validateFormData,
  validateCrossFieldDependencies,
} from '../validation';

// Calculation imports
import { evaluateFormula } from '../calculation/formulas';
import { createTaxTableRegistry } from '../calculation/tax-tables';
import { irsRound, roundToCents } from '../calculation/rounding';
import { calculateFields } from '../calculation/index';
import { buildCalcDAG } from '../calculation/dag';

// PDF imports
import { PdfLibReader } from '../pdf/reader';
import { PdfLibFiller } from '../pdf/filler';
import { PdfLibVerifier } from '../pdf/verifier';
import { checkCompatibility } from '../pdf/compatibility';

// Pipeline imports
import { fillTaxForm } from '../pipeline';
import { FormSchemaRegistry } from '../types/schema-types';
import { FieldType } from '../types/field-types';
import type { FormSchema } from '../types/schema-types';
import type { FormulaExpression } from '../types/calculation-types';
import type { CalculationError } from '../types/result-types';

// ─── Helpers ────────────────────────────────────────────────────────

const taxTables = createTaxTableRegistry();

function evalFormula(expr: FormulaExpression, values?: Map<string, number>) {
  return evaluateFormula(expr, values ?? new Map(), taxTables);
}

async function createTestFormPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 400]);
  const form = doc.getForm();

  const nameField = form.createTextField('name');
  nameField.addToPage(page, { x: 50, y: 300, width: 200, height: 20 });

  const ssnField = form.createTextField('ssn');
  ssnField.addToPage(page, { x: 50, y: 260, width: 200, height: 20 });

  const checkbox = form.createCheckBox('agree');
  checkbox.addToPage(page, { x: 50, y: 220, width: 15, height: 15 });

  const dropdown = form.createDropdown('status');
  dropdown.addOptions(['Single', 'Married', 'Head of Household']);
  dropdown.addToPage(page, { x: 50, y: 180, width: 200, height: 20 });

  return new Uint8Array(await doc.save());
}

function makeSchema(
  fields: Array<{
    id: string;
    type?: FieldType;
    pdfFieldName?: string;
    formula?: FormulaExpression;
    roundingRule?: 'nearest' | 'down' | 'up';
    required?: boolean;
    requiredIf?: any;
    allowedValues?: string[];
    maxLength?: number;
    min?: number;
    max?: number;
  }>,
): FormSchema {
  return {
    formCode: 'TEST',
    taxYear: 2024,
    irsRevision: '2024-01',
    name: 'Test Form',
    fields: fields.map((f) => ({
      id: f.id,
      pdfFieldName: f.pdfFieldName ?? f.id,
      label: f.id,
      type: f.type ?? FieldType.Currency,
      ...(f.formula ? { calculation: { formula: f.formula, roundingRule: f.roundingRule } } : {}),
      ...(f.required !== undefined ? { required: f.required } : {}),
      ...(f.requiredIf ? { requiredIf: f.requiredIf } : {}),
      ...(f.allowedValues ? { allowedValues: f.allowedValues } : {}),
      ...(f.maxLength !== undefined ? { maxLength: f.maxLength } : {}),
      ...(f.min !== undefined ? { min: f.min } : {}),
      ...(f.max !== undefined ? { max: f.max } : {}),
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 1. MONETARY PRECISION (Critical)
// ═══════════════════════════════════════════════════════════════════════

describe('Monetary Precision', () => {
  test('chain addition: $100.01 + $200.02 + $300.03 = 60006 cents', () => {
    const vals = new Map([
      ['a', 10001], // $100.01
      ['b', 20002], // $200.02
      ['c', 30003], // $300.03
    ]);
    const expr: FormulaExpression = {
      op: 'add',
      operands: [
        { op: 'ref', field: 'a' },
        { op: 'ref', field: 'b' },
        { op: 'ref', field: 'c' },
      ],
    };
    expect(evalFormula(expr, vals)).toBe(60006);
  });

  test('multiply: $999,999.99 * 0.37 — no precision loss', () => {
    const vals = new Map([['income', 99999999]]); // $999,999.99 in cents
    const expr: FormulaExpression = {
      op: 'multiply',
      left: { op: 'ref', field: 'income' },
      right: { op: 'literal', value: 0.37 },
    };
    // 99999999 * 0.37 = 36999999.63 -> roundToCents -> 37000000
    const result = evalFormula(expr, vals);
    expect(result).toBe(37000000);
    expect(Number.isInteger(result)).toBe(true);
  });

  test('divide: $100.00 / 3 — rounding handles thirds', () => {
    const vals = new Map([['total', 10000]]); // $100.00 in cents
    const expr: FormulaExpression = {
      op: 'divide',
      left: { op: 'ref', field: 'total' },
      right: { op: 'literal', value: 3 },
    };
    // 10000 / 3 = 3333.333... -> roundToCents -> 3333
    const result = evalFormula(expr, vals);
    expect(result).toBe(3333);
    expect(Number.isInteger(result)).toBe(true);
  });

  test('negative amounts: deduction of -$5,000', () => {
    const vals = new Map([
      ['income', 10000000], // $100,000
      ['deduction', 500000], // $5,000
    ]);
    const expr: FormulaExpression = {
      op: 'subtract',
      left: { op: 'ref', field: 'income' },
      right: { op: 'ref', field: 'deduction' },
    };
    expect(evalFormula(expr, vals)).toBe(9500000);
  });

  test('zero amount: $0.00 through calculations', () => {
    const vals = new Map([['amount', 0]]);
    const expr: FormulaExpression = {
      op: 'multiply',
      left: { op: 'ref', field: 'amount' },
      right: { op: 'literal', value: 0.37 },
    };
    expect(evalFormula(expr, vals)).toBe(0);
  });

  test('very large: $999,999,999.99 — no overflow in cents', () => {
    const largeCents = 99999999999; // $999,999,999.99
    // Verify it fits in JS Number (safe integer range)
    expect(largeCents).toBeLessThan(Number.MAX_SAFE_INTEGER);
    expect(Number.isSafeInteger(largeCents)).toBe(true);

    const vals = new Map([['amount', largeCents]]);
    const expr: FormulaExpression = {
      op: 'add',
      operands: [
        { op: 'ref', field: 'amount' },
        { op: 'literal', value: 1 },
      ],
    };
    expect(evalFormula(expr, vals)).toBe(100000000000);
  });

  test('very small: $0.01 — minimum cent value', () => {
    const vals = new Map([['amount', 1]]);
    const expr: FormulaExpression = {
      op: 'multiply',
      left: { op: 'ref', field: 'amount' },
      right: { op: 'literal', value: 2 },
    };
    expect(evalFormula(expr, vals)).toBe(2);
  });

  test('coerceCurrency: various zero formats all produce 0 cents', () => {
    expect(coerceCurrency('$0')).toBe(0);
    expect(coerceCurrency('0')).toBe(0);
    expect(coerceCurrency('0.00')).toBe(0);
    expect(coerceCurrency('$0.00')).toBe(0);
    expect(coerceCurrency(0)).toBe(0);
  });

  test('coerceCurrency: commas in correct places', () => {
    expect(coerceCurrency('1,234,567.89')).toBe(123456789);
  });

  test('coerceCurrency: no commas still works', () => {
    expect(coerceCurrency('1234567.89')).toBe(123456789);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. PDF EDGE CASES
// ═══════════════════════════════════════════════════════════════════════

describe('PDF Edge Cases', () => {
  test('empty PDF (no form fields) — reader returns empty array', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([600, 400]);
    const pdfBytes = new Uint8Array(await doc.save());

    const reader = new PdfLibReader();
    const fields = await reader.extractFields(pdfBytes);
    expect(fields).toHaveLength(0);
  });

  test('empty PDF — filler handles gracefully with empty data', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([600, 400]);
    const pdfBytes = new Uint8Array(await doc.save());

    const filler = new PdfLibFiller();
    const result = await filler.fill(pdfBytes, {});
    expect(result.errors).toHaveLength(0);
    expect(result.pdfBytes.byteLength).toBeGreaterThan(0);
  });

  test('corrupted PDF bytes — should throw meaningful error', async () => {
    const garbage = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const reader = new PdfLibReader();

    let threw = false;
    try {
      await reader.extractFields(garbage);
    } catch (e) {
      threw = true;
      expect(e).toBeDefined();
    }
    expect(threw).toBe(true);
  });

  test('PDF with only checkboxes — reader and filler work', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 400]);
    const form = doc.getForm();

    const cb1 = form.createCheckBox('checkbox1');
    cb1.addToPage(page, { x: 50, y: 300, width: 15, height: 15 });
    const cb2 = form.createCheckBox('checkbox2');
    cb2.addToPage(page, { x: 50, y: 260, width: 15, height: 15 });

    const pdfBytes = new Uint8Array(await doc.save());

    const reader = new PdfLibReader();
    const fields = await reader.extractFields(pdfBytes);
    expect(fields).toHaveLength(2);
    expect(fields.every((f) => f.type === 'checkbox')).toBe(true);

    const filler = new PdfLibFiller();
    const { pdfBytes: filled, errors } = await filler.fill(pdfBytes, {
      checkbox1: true,
      checkbox2: false,
    });
    expect(errors).toHaveLength(0);
    expect(filled.byteLength).toBeGreaterThan(0);
  });

  test('fill same PDF twice with same data — byte-identical (determinism)', async () => {
    const template = await createTestFormPdf();
    const filler = new PdfLibFiller();
    const data = { name: 'John Doe', ssn: '123-45-6789', agree: true, status: 'Single' };

    const { pdfBytes: result1 } = await filler.fill(template, data);
    const { pdfBytes: result2 } = await filler.fill(template, data);

    expect(result1.byteLength).toBe(result2.byteLength);
    // Compare every byte
    let identical = true;
    for (let i = 0; i < result1.byteLength; i++) {
      if (result1[i] !== result2[i]) {
        identical = false;
        break;
      }
    }
    expect(identical).toBe(true);
  });

  test('fill same PDF twice with different data — different output', async () => {
    const template = await createTestFormPdf();
    const filler = new PdfLibFiller();

    const { pdfBytes: result1 } = await filler.fill(template, { name: 'Alice' });
    const { pdfBytes: result2 } = await filler.fill(template, { name: 'Bob' });

    // They should differ in at least some bytes
    let same = true;
    const minLen = Math.min(result1.byteLength, result2.byteLength);
    for (let i = 0; i < minLen; i++) {
      if (result1[i] !== result2[i]) {
        same = false;
        break;
      }
    }
    expect(same).toBe(false);
  });

  test('radio group field — extract and fill', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 400]);
    const form = doc.getForm();

    const radio = form.createRadioGroup('filing_status');
    radio.addOptionToPage('Single', page, { x: 50, y: 300, width: 15, height: 15 });
    radio.addOptionToPage('Married', page, { x: 50, y: 260, width: 15, height: 15 });

    const pdfBytes = new Uint8Array(await doc.save());

    const reader = new PdfLibReader();
    const fields = await reader.extractFields(pdfBytes);
    const radioField = fields.find((f) => f.name === 'filing_status');
    expect(radioField).toBeDefined();
    expect(radioField!.type).toBe('radio');

    // Fill the radio group
    const filler = new PdfLibFiller();
    const { errors } = await filler.fill(pdfBytes, { filing_status: 'Single' });
    expect(errors).toHaveLength(0);
  });

  test('checkbox with string "Yes" value', async () => {
    const template = await createTestFormPdf();
    const filler = new PdfLibFiller();
    const verifier = new PdfLibVerifier();

    const { pdfBytes } = await filler.fill(template, { agree: 'Yes' as unknown as boolean });
    const values = await verifier.readFieldValues(pdfBytes);
    expect(values['agree']).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. VALIDATION EDGE CASES
// ═══════════════════════════════════════════════════════════════════════

describe('Validation Edge Cases', () => {
  // SSN
  test('SSN with leading zeros: "001-01-0001" — should be valid', () => {
    expect(validateSSN('001-01-0001')).toBeNull();
  });

  test('SSN "000-00-0000" — INVALID (all groups have zeros)', () => {
    expect(validateSSN('000-00-0000')).not.toBeNull();
  });

  test('SSN "666-12-3456" — should be valid (not historically invalid per current regex)', () => {
    // The validator only rejects all-zeros groups, 666 prefix is not checked
    expect(validateSSN('666-12-3456')).toBeNull();
  });

  // EIN
  test('EIN "00-0000000" — should be valid per format (regex allows it)', () => {
    // The validator only checks format XX-XXXXXXX
    expect(validateEIN('00-0000000')).toBeNull();
  });

  // Date boundaries
  test('Date "12/31/9999" — valid date', () => {
    expect(validateDate('12/31/9999')).toBeNull();
  });

  test('Date "02/29/2100" — NOT a leap year (century rule)', () => {
    expect(validateDate('02/29/2100')).not.toBeNull();
  });

  test('Date "02/29/2000" — IS a leap year (divisible by 400)', () => {
    expect(validateDate('02/29/2000')).toBeNull();
  });

  // Currency edge cases
  test('Currency: "$0" is valid', () => {
    expect(validateCurrency('$0')).toBeNull();
  });

  test('Currency: "0" is valid', () => {
    expect(validateCurrency('0')).toBeNull();
  });

  test('Currency: "0.00" is valid', () => {
    expect(validateCurrency('0.00')).toBeNull();
  });

  test('Currency: "$0.00" is valid', () => {
    expect(validateCurrency('$0.00')).toBeNull();
  });

  test('Currency: "1,234,567.89" — commas in right places', () => {
    expect(validateCurrency('1,234,567.89')).toBeNull();
  });

  test('Currency: "1234567.89" — no commas, still works', () => {
    expect(validateCurrency('1234567.89')).toBeNull();
  });

  test('Currency: negative number rejected', () => {
    expect(validateCurrency(-100)).not.toBeNull();
  });

  // Phone
  test('Phone: "+1 (555) 123-4567" with country code — coercion strips it', () => {
    // validatePhone doesn't accept +1 format directly
    expect(validatePhone('+1 (555) 123-4567')).not.toBeNull();
    // But coercePhone can handle it (strips non-digits, handles 11-digit with leading 1)
    const coerced = coerceFieldValue('+1 (555) 123-4567', FieldType.Phone);
    expect(coerced).toBe('(555) 123-4567');
  });

  // ZipCode
  test('ZipCode: "00501" — valid (IRS center)', () => {
    expect(validateZipCode('00501')).toBeNull();
  });

  // Empty/null for required fields
  test('empty string for required field — treated as missing', () => {
    const schema = makeSchema([
      { id: 'name', type: FieldType.Text, required: true },
    ]);
    const errors = validateFormData(schema, { name: '' });
    // The validator treats empty string as missing for required fields
    const requiredErrors = errors.filter((e) => e.code === 'REQUIRED');
    expect(requiredErrors).toHaveLength(1);
    expect(requiredErrors[0].fieldId).toBe('name');
  });

  test('null for optional field — OK', () => {
    const schema = makeSchema([
      { id: 'notes', type: FieldType.Text },
    ]);
    const errors = validateFormData(schema, { notes: null });
    expect(errors).toHaveLength(0);
  });

  test('undefined for optional field — OK', () => {
    const schema = makeSchema([
      { id: 'notes', type: FieldType.Text },
    ]);
    const errors = validateFormData(schema, {});
    expect(errors).toHaveLength(0);
  });

  test('boolean "true" string coerced to true for checkbox', () => {
    const result = coerceFieldValue('true', FieldType.Checkbox);
    expect(result).toBe(true);
  });

  test('boolean "false" string coerced to false for checkbox', () => {
    const result = coerceFieldValue('false', FieldType.Checkbox);
    expect(result).toBe(false);
  });

  test('string "1" coerced to true for checkbox', () => {
    const result = coerceFieldValue('1', FieldType.Checkbox);
    expect(result).toBe(true);
  });

  test('string "yes" coerced to true for checkbox', () => {
    const result = coerceFieldValue('yes', FieldType.Checkbox);
    expect(result).toBe(true);
  });

  test('string "0" coerced to false for checkbox', () => {
    const result = coerceFieldValue('0', FieldType.Checkbox);
    expect(result).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. CALCULATION EDGE CASES
// ═══════════════════════════════════════════════════════════════════════

describe('Calculation Edge Cases', () => {
  test('DAG with self-referencing field — should detect cycle', () => {
    const schema = makeSchema([
      { id: 'A', formula: { op: 'ref', field: 'A' } },
    ]);
    try {
      buildCalcDAG(schema);
      expect(true).toBe(false); // should not reach
    } catch (e) {
      const err = e as CalculationError;
      expect(err.code).toBe('CYCLE');
    }
  });

  test('formula referencing non-existent field — MISSING_INPUT', () => {
    const vals = new Map<string, number>();
    try {
      evalFormula({ op: 'ref', field: 'nonexistent' }, vals);
      expect(true).toBe(false);
    } catch (e) {
      expect((e as CalculationError).code).toBe('MISSING_INPUT');
    }
  });

  test('tax table lookup at exact bracket boundary ($11,600 single)', () => {
    // $11,600 is the top of the 10% bracket for single filers
    // Tax = $11,600 * 0.10 = $1,160
    const incomeCents = 11600 * 100;
    const tax = taxTables.lookup('federal_income_tax', incomeCents, 'single');
    expect(tax).toBe(116000); // $1,160.00 in cents
  });

  test('tax table lookup at $0 income', () => {
    expect(taxTables.lookup('federal_income_tax', 0, 'single')).toBe(0);
  });

  test('tax table lookup at very high income ($10,000,000)', () => {
    const incomeCents = 10000000 * 100; // $10M
    const tax = taxTables.lookup('federal_income_tax', incomeCents, 'single');
    // Should be in the 37% bracket
    // baseTax for 37%: $183,647.25 = 18364725 cents
    // taxable in bracket: ($10,000,000 - $609,350) * 0.37 = $9,390,650 * 0.37 = $3,474,540.50
    // Total: $183,647.25 + $3,474,540.50 = $3,658,187.75
    // Math.round(18364725 + 939065000 * 0.37) = Math.round(18364725 + 347454050) = 365818775
    expect(tax).toBeGreaterThan(0);
    expect(Number.isInteger(tax)).toBe(true);
    // Verify it's in a reasonable range (>$3.5M in cents)
    expect(tax).toBeGreaterThan(350000000);
  });

  test('all filing statuses have tax tables', () => {
    const statuses = ['single', 'married_joint', 'married_separate', 'head_of_household'];
    for (const status of statuses) {
      const tax = taxTables.lookup('federal_income_tax', 5000000, status);
      expect(tax).toBeGreaterThan(0);
    }
  });

  test('standard deduction for all filing statuses', () => {
    expect(taxTables.lookup('standard_deduction', 0, 'single')).toBe(1460000);
    expect(taxTables.lookup('standard_deduction', 0, 'married_joint')).toBe(2920000);
    expect(taxTables.lookup('standard_deduction', 0, 'married_separate')).toBe(1460000);
    expect(taxTables.lookup('standard_deduction', 0, 'head_of_household')).toBe(2190000);
  });

  test('calculation with all-zero inputs', () => {
    const schema = makeSchema([
      { id: 'a' },
      { id: 'b' },
      {
        id: 'total',
        formula: {
          op: 'add',
          operands: [
            { op: 'ref', field: 'a' },
            { op: 'ref', field: 'b' },
          ],
        },
      },
    ]);
    const result = calculateFields(schema, { a: 0, b: 0 });
    expect(result.values['total']).toBe(0);
  });

  test('division by very small number (not zero)', () => {
    const vals = new Map([['amount', 10000]]);
    const expr: FormulaExpression = {
      op: 'divide',
      left: { op: 'ref', field: 'amount' },
      right: { op: 'literal', value: 0.001 },
    };
    // 10000 / 0.001 = 10000000 -> roundToCents -> 10000000
    const result = evalFormula(expr, vals);
    expect(result).toBe(10000000);
    expect(Number.isInteger(result)).toBe(true);
  });

  test('irsRound negative values', () => {
    // Negative nearest rounding
    expect(irsRound(-150, 'nearest')).toBe(-100);
    expect(irsRound(-149, 'nearest')).toBe(-100);
    // Down for negative
    expect(irsRound(-150, 'down')).toBe(-200);
    // Up for negative
    expect(irsRound(-150, 'up')).toBe(-100);
  });

  test('roundToCents for exact integer returns same', () => {
    expect(roundToCents(12345)).toBe(12345);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. CROSS-FIELD REGRESSION
// ═══════════════════════════════════════════════════════════════════════

describe('Cross-Field Regression', () => {
  test('both SSN and EIN provided — valid (W-9 requires at least one)', () => {
    const schema = makeSchema([
      { id: 'ssn', type: FieldType.SSN },
      { id: 'ein', type: FieldType.EIN },
    ]);
    const errors = validateFormData(schema, {
      ssn: '123-45-6789',
      ein: '12-3456789',
    });
    expect(errors).toHaveLength(0);
  });

  test('neither SSN nor EIN provided — OK if neither is required', () => {
    const schema = makeSchema([
      { id: 'ssn', type: FieldType.SSN },
      { id: 'ein', type: FieldType.EIN },
    ]);
    const errors = validateFormData(schema, {});
    expect(errors).toHaveLength(0);
  });

  test('LLC checkbox checked but no LLC classification — should fail', () => {
    const schema: FormSchema = {
      formCode: 'W9-TEST',
      taxYear: 2024,
      irsRevision: '2024-01',
      name: 'W-9 LLC Test',
      fields: [
        {
          id: 'tax_class_llc',
          pdfFieldName: 'llc_cb',
          label: 'LLC',
          type: FieldType.Checkbox,
        },
        {
          id: 'llc_classification',
          pdfFieldName: 'llc_class',
          label: 'LLC Classification',
          type: FieldType.Text,
          allowedValues: ['C', 'S', 'P'],
          requiredIf: { field: 'tax_class_llc', operator: 'eq', value: true },
        },
      ],
    };

    const errors = validateCrossFieldDependencies(schema, { tax_class_llc: true });
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('DEPENDENCY');
    expect(errors[0].fieldId).toBe('llc_classification');
  });

  test('LLC checkbox NOT checked, LLC classification provided — OK (extra data)', () => {
    const schema: FormSchema = {
      formCode: 'W9-TEST',
      taxYear: 2024,
      irsRevision: '2024-01',
      name: 'W-9 LLC Test',
      fields: [
        {
          id: 'tax_class_llc',
          pdfFieldName: 'llc_cb',
          label: 'LLC',
          type: FieldType.Checkbox,
        },
        {
          id: 'llc_classification',
          pdfFieldName: 'llc_class',
          label: 'LLC Classification',
          type: FieldType.Text,
          allowedValues: ['C', 'S', 'P'],
          requiredIf: { field: 'tax_class_llc', operator: 'eq', value: true },
        },
      ],
    };

    const errors = validateCrossFieldDependencies(schema, {
      tax_class_llc: false,
      llc_classification: 'C',
    });
    expect(errors).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. PIPELINE REGRESSION
// ═══════════════════════════════════════════════════════════════════════

describe('Pipeline Regression', () => {
  // Helper to create a simple PDF matching the test schema
  async function createSimplePdf(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 400]);
    const form = doc.getForm();

    const f1 = form.createTextField('name_field');
    f1.addToPage(page, { x: 50, y: 300, width: 200, height: 20 });
    const f2 = form.createTextField('ssn_field');
    f2.addToPage(page, { x: 50, y: 260, width: 200, height: 20 });

    return new Uint8Array(await doc.save());
  }

  function simpleSchema(): FormSchema {
    return {
      formCode: 'SIMPLE',
      taxYear: 2024,
      irsRevision: '2024-01',
      name: 'Simple Form',
      fields: [
        { id: 'name', pdfFieldName: 'name_field', label: 'Name', type: FieldType.Text, required: true },
        { id: 'ssn', pdfFieldName: 'ssn_field', label: 'SSN', type: FieldType.SSN },
      ],
    };
  }

  test('fill with empty data {} — should get required field errors', async () => {
    const pdf = await createSimplePdf();
    const registry = new FormSchemaRegistry();
    registry.register(simpleSchema());

    const result = await fillTaxForm({
      formId: 'SIMPLE',
      taxYear: 2024,
      templatePdf: pdf,
      data: {},
      options: { strictValidation: true },
      registry,
    });

    expect(result.success).toBe(false);
    const requiredErrors = result.errors.filter((e) => e.code === 'REQUIRED');
    expect(requiredErrors.length).toBeGreaterThan(0);
  });

  test('fill with extra fields not in schema — should be ignored', async () => {
    const pdf = await createSimplePdf();
    const registry = new FormSchemaRegistry();
    registry.register(simpleSchema());

    const result = await fillTaxForm({
      formId: 'SIMPLE',
      taxYear: 2024,
      templatePdf: pdf,
      data: {
        name: 'John Doe',
        extra_field: 'should be ignored',
        another_extra: 42,
      },
      options: { skipVerification: true },
      registry,
    });

    // Extra fields should not cause errors (they're just ignored during coercion/validation)
    // The PDF filler may produce FIELD_NOT_FOUND for extra_field if it tries to write it
    // But the pipeline only writes fields that are in the schema
    expect(result.pdfBytes.length).toBeGreaterThan(0);
  });

  test('fill with wrong types (number where string expected) — coercion handles', async () => {
    const pdf = await createSimplePdf();
    const registry = new FormSchemaRegistry();
    registry.register(simpleSchema());

    const result = await fillTaxForm({
      formId: 'SIMPLE',
      taxYear: 2024,
      templatePdf: pdf,
      data: {
        name: 12345 as unknown as string, // number where string expected
      },
      options: { skipVerification: true },
      registry,
    });

    // Text coercion should convert number to string
    expect(result.pdfBytes.length).toBeGreaterThan(0);
  });

  test('compatibility: PDF with extra fields not in schema — passes', async () => {
    // Create a PDF with more fields than the schema expects
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 400]);
    const form = doc.getForm();

    const f1 = form.createTextField('name_field');
    f1.addToPage(page, { x: 50, y: 300, width: 200, height: 20 });
    const f2 = form.createTextField('ssn_field');
    f2.addToPage(page, { x: 50, y: 260, width: 200, height: 20 });
    const f3 = form.createTextField('extra_pdf_field');
    f3.addToPage(page, { x: 50, y: 220, width: 200, height: 20 });

    const pdfBytes = new Uint8Array(await doc.save());
    const reader = new PdfLibReader();
    const errors = await checkCompatibility(pdfBytes, simpleSchema(), reader);

    // Extra fields in PDF are fine — compatibility only checks that schema fields exist
    expect(errors).toHaveLength(0);
  });

  test('skipVerification option — pipeline succeeds without verify step', async () => {
    const pdf = await createSimplePdf();
    const registry = new FormSchemaRegistry();
    registry.register(simpleSchema());

    const result = await fillTaxForm({
      formId: 'SIMPLE',
      taxYear: 2024,
      templatePdf: pdf,
      data: { name: 'John Doe' },
      options: { skipVerification: true },
      registry,
    });

    expect(result.success).toBe(true);
    expect(result.pdfBytes.length).toBeGreaterThan(0);
  });

  test('strictValidation=false with invalid data — fills and returns errors', async () => {
    const pdf = await createSimplePdf();
    const registry = new FormSchemaRegistry();
    registry.register(simpleSchema());

    const result = await fillTaxForm({
      formId: 'SIMPLE',
      taxYear: 2024,
      templatePdf: pdf,
      data: {
        name: 'John Doe',
        ssn: 'not-valid-ssn',
      },
      options: { strictValidation: false, skipVerification: true },
      registry,
    });

    // Should produce a PDF despite validation errors
    expect(result.pdfBytes.length).toBeGreaterThan(0);
    const validationErrors = result.errors.filter((e) => e.type === 'validation');
    expect(validationErrors.length).toBeGreaterThan(0);
  });

  test('schema-not-found for unknown form', async () => {
    const pdf = await createSimplePdf();
    const registry = new FormSchemaRegistry();

    const result = await fillTaxForm({
      formId: 'DOES_NOT_EXIST',
      taxYear: 2024,
      templatePdf: pdf,
      data: {},
      registry,
    });

    expect(result.success).toBe(false);
    expect(result.errors[0].code).toBe('WRONG_FORM');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. DETERMINISM TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('Determinism Tests', () => {
  test('fill form 10 times with identical data — all outputs byte-identical', async () => {
    const template = await createTestFormPdf();
    const filler = new PdfLibFiller();
    const data = {
      name: 'Determinism Test User',
      ssn: '555-55-5555',
      agree: true,
      status: 'Married',
    };

    const results: Uint8Array[] = [];
    for (let i = 0; i < 10; i++) {
      const { pdfBytes } = await filler.fill(template, data);
      results.push(pdfBytes);
    }

    // All should be same length
    const firstLen = results[0].byteLength;
    for (const r of results) {
      expect(r.byteLength).toBe(firstLen);
    }

    // All should be byte-identical to the first
    for (let i = 1; i < results.length; i++) {
      let identical = true;
      for (let j = 0; j < firstLen; j++) {
        if (results[0][j] !== results[i][j]) {
          identical = false;
          break;
        }
      }
      expect(identical).toBe(true);
    }
  });

  test('fill, verify, fill again — same result', async () => {
    const template = await createTestFormPdf();
    const filler = new PdfLibFiller();
    const verifier = new PdfLibVerifier();
    const data = { name: 'Verify Then Fill Again', agree: false };

    // First fill
    const { pdfBytes: first } = await filler.fill(template, data);

    // Verify (read back)
    const values = await verifier.readFieldValues(first);
    expect(values['name']).toBe('Verify Then Fill Again');

    // Fill again with same template and data
    const { pdfBytes: second } = await filler.fill(template, data);

    // Should be identical
    expect(first.byteLength).toBe(second.byteLength);
    let identical = true;
    for (let i = 0; i < first.byteLength; i++) {
      if (first[i] !== second[i]) {
        identical = false;
        break;
      }
    }
    expect(identical).toBe(true);
  });
});
