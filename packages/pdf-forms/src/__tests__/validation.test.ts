import { describe, it, expect } from 'bun:test';
import {
  validateSSN,
  validateEIN,
  validateDate,
  validateCurrency,
  validatePercentage,
  validateInteger,
  validateZipCode,
  validatePhone,
  coerceCurrency,
  coercePercentage,
  coerceSSN,
  coerceEIN,
  coerceDate,
  coerceZipCode,
  coercePhone,
  coerceFieldValue,
  evaluateCondition,
  validateCrossFieldDependencies,
  validateFormData,
  requiredError,
  formatError,
  rangeError,
  typeError,
  dependencyError,
} from '../validation';
import { FieldType } from '../types/field-types';
import type { FormSchema, ConditionalRule } from '../types/schema-types';

// ─── Type Validators ────────────────────────────────────────────────

describe('validateSSN', () => {
  it('accepts valid SSN', () => {
    expect(validateSSN('123-45-6789')).toBeNull();
    expect(validateSSN('999-99-9999')).toBeNull();
  });

  it('rejects wrong format', () => {
    expect(validateSSN('123456789')).not.toBeNull();
    expect(validateSSN('12-345-6789')).not.toBeNull();
    expect(validateSSN('abc-de-fghi')).not.toBeNull();
    expect(validateSSN('')).not.toBeNull();
  });

  it('rejects all-zeros groups', () => {
    expect(validateSSN('000-45-6789')).not.toBeNull();
    expect(validateSSN('123-00-6789')).not.toBeNull();
    expect(validateSSN('123-45-0000')).not.toBeNull();
    expect(validateSSN('000-00-0000')).not.toBeNull();
  });

  it('handles non-string input', () => {
    expect(validateSSN(123 as unknown as string)).not.toBeNull();
    expect(validateSSN(null as unknown as string)).not.toBeNull();
  });
});

describe('validateEIN', () => {
  it('accepts valid EIN', () => {
    expect(validateEIN('12-3456789')).toBeNull();
    expect(validateEIN('00-1234567')).toBeNull();
  });

  it('rejects wrong format', () => {
    expect(validateEIN('123456789')).not.toBeNull();
    expect(validateEIN('123-456789')).not.toBeNull();
    expect(validateEIN('')).not.toBeNull();
  });
});

describe('validateDate', () => {
  it('accepts valid dates', () => {
    expect(validateDate('01/15/2024')).toBeNull();
    expect(validateDate('12/31/2023')).toBeNull();
    expect(validateDate('02/29/2024')).toBeNull(); // leap year
  });

  it('rejects invalid month', () => {
    expect(validateDate('13/01/2024')).not.toBeNull();
    expect(validateDate('00/01/2024')).not.toBeNull();
  });

  it('rejects invalid day', () => {
    expect(validateDate('02/30/2024')).not.toBeNull();
    expect(validateDate('04/31/2024')).not.toBeNull();
    expect(validateDate('01/00/2024')).not.toBeNull();
  });

  it('rejects Feb 29 on non-leap year', () => {
    expect(validateDate('02/29/2023')).not.toBeNull();
    expect(validateDate('02/29/2100')).not.toBeNull(); // century, not leap
  });

  it('accepts Feb 29 on century leap years', () => {
    expect(validateDate('02/29/2000')).toBeNull(); // divisible by 400
  });

  it('rejects wrong format', () => {
    expect(validateDate('2024-01-15')).not.toBeNull();
    expect(validateDate('1/5/2024')).not.toBeNull();
    expect(validateDate('')).not.toBeNull();
  });
});

describe('validateCurrency', () => {
  it('accepts valid currency strings', () => {
    expect(validateCurrency('$1,234.56')).toBeNull();
    expect(validateCurrency('1234.56')).toBeNull();
    expect(validateCurrency('$0.00')).toBeNull();
    expect(validateCurrency('999999999.99')).toBeNull();
    expect(validateCurrency('$999,999,999.99')).toBeNull();
    expect(validateCurrency('1,234')).toBeNull();
    expect(validateCurrency('0')).toBeNull();
  });

  it('accepts valid currency numbers (cents)', () => {
    expect(validateCurrency(0)).toBeNull();
    expect(validateCurrency(123456)).toBeNull();
  });

  it('rejects invalid strings', () => {
    expect(validateCurrency('abc')).not.toBeNull();
    expect(validateCurrency('$1,23.45')).not.toBeNull(); // bad comma
    expect(validateCurrency('1234.5')).toBeNull(); // 1 decimal is ok (1-2 allowed)
    expect(validateCurrency('1234.567')).not.toBeNull(); // 3 decimals
  });

  it('rejects negative numbers', () => {
    expect(validateCurrency(-100)).not.toBeNull();
  });

  it('rejects non-integer numbers', () => {
    expect(validateCurrency(123.45)).not.toBeNull();
  });

  it('handles null/undefined', () => {
    expect(validateCurrency(null as unknown as number)).not.toBeNull();
    expect(validateCurrency(undefined as unknown as number)).not.toBeNull();
  });
});

describe('validatePercentage', () => {
  it('accepts valid percentages', () => {
    expect(validatePercentage(0)).toBeNull();
    expect(validatePercentage(50.5)).toBeNull();
    expect(validatePercentage(100)).toBeNull();
    expect(validatePercentage('50%')).toBeNull();
    expect(validatePercentage('0')).toBeNull();
  });

  it('rejects out of range', () => {
    expect(validatePercentage(-1)).not.toBeNull();
    expect(validatePercentage(101)).not.toBeNull();
    expect(validatePercentage('150%')).not.toBeNull();
  });

  it('rejects non-numeric strings', () => {
    expect(validatePercentage('abc')).not.toBeNull();
  });
});

describe('validateInteger', () => {
  it('accepts valid integers', () => {
    expect(validateInteger(0)).toBeNull();
    expect(validateInteger(42)).toBeNull();
    expect(validateInteger(-5)).toBeNull();
    expect(validateInteger('123')).toBeNull();
    expect(validateInteger('-7')).toBeNull();
  });

  it('rejects decimals', () => {
    expect(validateInteger(1.5)).not.toBeNull();
    expect(validateInteger('1.5')).not.toBeNull();
  });

  it('handles null/undefined', () => {
    expect(validateInteger(null as unknown as number)).not.toBeNull();
    expect(validateInteger(undefined as unknown as number)).not.toBeNull();
  });
});

describe('validateZipCode', () => {
  it('accepts valid zip codes', () => {
    expect(validateZipCode('12345')).toBeNull();
    expect(validateZipCode('12345-6789')).toBeNull();
  });

  it('rejects invalid formats', () => {
    expect(validateZipCode('1234')).not.toBeNull();
    expect(validateZipCode('123456')).not.toBeNull();
    expect(validateZipCode('12345-678')).not.toBeNull();
    expect(validateZipCode('abcde')).not.toBeNull();
    expect(validateZipCode('')).not.toBeNull();
  });
});

describe('validatePhone', () => {
  it('accepts valid formats', () => {
    expect(validatePhone('(123) 456-7890')).toBeNull();
    expect(validatePhone('123-456-7890')).toBeNull();
    expect(validatePhone('1234567890')).toBeNull();
  });

  it('rejects invalid formats', () => {
    expect(validatePhone('123 456 7890')).not.toBeNull();
    expect(validatePhone('12345')).not.toBeNull();
    expect(validatePhone('')).not.toBeNull();
    expect(validatePhone('(123)456-7890')).not.toBeNull(); // no space after paren
  });
});

// ─── Coercion ───────────────────────────────────────────────────────

describe('coerceCurrency', () => {
  it('coerces dollar strings to cents', () => {
    expect(coerceCurrency('$1,234.56')).toBe(123456);
    expect(coerceCurrency('1234')).toBe(123400);
    expect(coerceCurrency('$0.00')).toBe(0);
    expect(coerceCurrency('1234.56')).toBe(123456);
    expect(coerceCurrency('$100')).toBe(10000);
  });

  it('passes through numbers', () => {
    expect(coerceCurrency(123456)).toBe(123456);
    expect(coerceCurrency(0)).toBe(0);
  });

  it('throws on invalid input', () => {
    expect(() => coerceCurrency('abc')).toThrow();
    expect(() => coerceCurrency('')).toThrow();
  });
});

describe('coercePercentage', () => {
  it('coerces percentage strings', () => {
    expect(coercePercentage('50.5%')).toBe(50.5);
    expect(coercePercentage('50.5')).toBe(50.5);
    expect(coercePercentage('0%')).toBe(0);
  });

  it('passes through numbers', () => {
    expect(coercePercentage(75)).toBe(75);
  });

  it('throws on invalid input', () => {
    expect(() => coercePercentage('abc')).toThrow();
    expect(() => coercePercentage('')).toThrow();
  });
});

describe('coerceSSN', () => {
  it('normalizes SSN', () => {
    expect(coerceSSN('123456789')).toBe('123-45-6789');
    expect(coerceSSN('123-45-6789')).toBe('123-45-6789');
  });

  it('throws on invalid input', () => {
    expect(() => coerceSSN('12345')).toThrow();
    expect(() => coerceSSN('abcdefghi')).toThrow();
  });
});

describe('coerceEIN', () => {
  it('normalizes EIN', () => {
    expect(coerceEIN('123456789')).toBe('12-3456789');
    expect(coerceEIN('12-3456789')).toBe('12-3456789');
  });

  it('throws on invalid input', () => {
    expect(() => coerceEIN('12345')).toThrow();
  });
});

describe('coerceDate', () => {
  it('normalizes US dates', () => {
    expect(coerceDate('1/5/2024')).toBe('01/05/2024');
    expect(coerceDate('01/05/2024')).toBe('01/05/2024');
    expect(coerceDate('12/31/2023')).toBe('12/31/2023');
  });

  it('normalizes ISO dates', () => {
    expect(coerceDate('2024-01-05')).toBe('01/05/2024');
    expect(coerceDate('2024-12-31')).toBe('12/31/2024');
  });

  it('throws on invalid input', () => {
    expect(() => coerceDate('not-a-date')).toThrow();
    expect(() => coerceDate('')).toThrow();
  });
});

describe('coerceZipCode', () => {
  it('normalizes zip codes', () => {
    expect(coerceZipCode('12345')).toBe('12345');
    expect(coerceZipCode(' 12345 ')).toBe('12345');
    expect(coerceZipCode('12345-6789')).toBe('12345-6789');
  });

  it('throws on invalid input', () => {
    expect(() => coerceZipCode('1234')).toThrow();
  });
});

describe('coercePhone', () => {
  it('normalizes phone numbers', () => {
    expect(coercePhone('1234567890')).toBe('(123) 456-7890');
    expect(coercePhone('(123) 456-7890')).toBe('(123) 456-7890');
    expect(coercePhone('123-456-7890')).toBe('(123) 456-7890');
    expect(coercePhone('1-123-456-7890')).toBe('(123) 456-7890');
  });

  it('throws on invalid input', () => {
    expect(() => coercePhone('12345')).toThrow();
    expect(() => coercePhone('')).toThrow();
  });
});

describe('coerceFieldValue', () => {
  it('dispatches to correct coercion', () => {
    expect(coerceFieldValue('$100', FieldType.Currency)).toBe(10000);
    expect(coerceFieldValue('50%', FieldType.Percentage)).toBe(50);
    expect(coerceFieldValue('123456789', FieldType.SSN)).toBe('123-45-6789');
    expect(coerceFieldValue('123456789', FieldType.EIN)).toBe('12-3456789');
    expect(coerceFieldValue('1/5/2024', FieldType.Date)).toBe('01/05/2024');
    expect(coerceFieldValue(' 12345 ', FieldType.ZipCode)).toBe('12345');
    expect(coerceFieldValue('1234567890', FieldType.Phone)).toBe('(123) 456-7890');
  });

  it('passes null/undefined through', () => {
    expect(coerceFieldValue(null, FieldType.SSN)).toBeNull();
    expect(coerceFieldValue(undefined as unknown as null, FieldType.SSN)).toBeUndefined();
  });

  it('coerces text passthrough', () => {
    expect(coerceFieldValue('hello', FieldType.Text)).toBe('hello');
  });

  it('coerces checkbox from string', () => {
    expect(coerceFieldValue('true', FieldType.Checkbox)).toBe(true);
    expect(coerceFieldValue('false', FieldType.Checkbox)).toBe(false);
    expect(coerceFieldValue('1', FieldType.Checkbox)).toBe(true);
  });

  it('coerces integer from string', () => {
    expect(coerceFieldValue('42', FieldType.Integer)).toBe(42);
  });
});

// ─── Coercion Round-Trip ────────────────────────────────────────────

describe('coercion round-trips', () => {
  it('coerced SSN passes validation', () => {
    const coerced = coerceSSN('123456789');
    expect(validateSSN(coerced)).toBeNull();
  });

  it('coerced EIN passes validation', () => {
    const coerced = coerceEIN('123456789');
    expect(validateEIN(coerced)).toBeNull();
  });

  it('coerced date passes validation', () => {
    const coerced = coerceDate('1/5/2024');
    expect(validateDate(coerced)).toBeNull();
  });

  it('coerced zip passes validation', () => {
    const coerced = coerceZipCode('12345');
    expect(validateZipCode(coerced)).toBeNull();
  });

  it('coerced phone passes validation', () => {
    const coerced = coercePhone('1234567890');
    expect(validatePhone(coerced)).toBeNull();
  });

  it('coerced currency passes validation', () => {
    const coerced = coerceCurrency('$1,234.56');
    expect(validateCurrency(coerced)).toBeNull();
  });

  it('coerced percentage passes validation', () => {
    const coerced = coercePercentage('50.5%');
    expect(validatePercentage(coerced)).toBeNull();
  });
});

// ─── Cross-Field ────────────────────────────────────────────────────

describe('evaluateCondition', () => {
  it('evaluates eq', () => {
    const cond: ConditionalRule = { field: 'status', operator: 'eq', value: 'married' };
    expect(evaluateCondition(cond, { status: 'married' })).toBe(true);
    expect(evaluateCondition(cond, { status: 'single' })).toBe(false);
  });

  it('evaluates neq', () => {
    const cond: ConditionalRule = { field: 'status', operator: 'neq', value: 'married' };
    expect(evaluateCondition(cond, { status: 'single' })).toBe(true);
    expect(evaluateCondition(cond, { status: 'married' })).toBe(false);
  });

  it('evaluates truthy', () => {
    const cond: ConditionalRule = { field: 'hasIncome', operator: 'truthy' };
    expect(evaluateCondition(cond, { hasIncome: true })).toBe(true);
    expect(evaluateCondition(cond, { hasIncome: 'yes' })).toBe(true);
    expect(evaluateCondition(cond, { hasIncome: false })).toBe(false);
    expect(evaluateCondition(cond, { hasIncome: null })).toBe(false);
    expect(evaluateCondition(cond, {})).toBe(false);
  });

  it('evaluates falsy', () => {
    const cond: ConditionalRule = { field: 'hasIncome', operator: 'falsy' };
    expect(evaluateCondition(cond, { hasIncome: false })).toBe(true);
    expect(evaluateCondition(cond, { hasIncome: null })).toBe(true);
    expect(evaluateCondition(cond, {})).toBe(true);
    expect(evaluateCondition(cond, { hasIncome: true })).toBe(false);
  });

  it('evaluates in', () => {
    const cond: ConditionalRule = {
      field: 'filingStatus',
      operator: 'in',
      value: ['married', 'head_of_household'],
    };
    expect(evaluateCondition(cond, { filingStatus: 'married' })).toBe(true);
    expect(evaluateCondition(cond, { filingStatus: 'head_of_household' })).toBe(true);
    expect(evaluateCondition(cond, { filingStatus: 'single' })).toBe(false);
  });

  it('returns false for in with non-array value', () => {
    const cond: ConditionalRule = { field: 'x', operator: 'in', value: 'not-array' };
    expect(evaluateCondition(cond, { x: 'not-array' })).toBe(false);
  });
});

describe('validateCrossFieldDependencies', () => {
  const schema: FormSchema = {
    formCode: 'TEST',
    taxYear: 2024,
    irsRevision: 'test',
    name: 'Test Form',
    fields: [
      {
        id: 'filingStatus',
        pdfFieldName: 'f1',
        label: 'Filing Status',
        type: FieldType.Text,
      },
      {
        id: 'spouseName',
        pdfFieldName: 'f2',
        label: 'Spouse Name',
        type: FieldType.Text,
        requiredIf: { field: 'filingStatus', operator: 'eq', value: 'married' },
      },
    ],
  };

  it('returns error when condition met and field missing', () => {
    const errors = validateCrossFieldDependencies(schema, { filingStatus: 'married' });
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('DEPENDENCY');
    expect(errors[0].fieldId).toBe('spouseName');
  });

  it('no error when condition met and field present', () => {
    const errors = validateCrossFieldDependencies(schema, {
      filingStatus: 'married',
      spouseName: 'Jane',
    });
    expect(errors).toHaveLength(0);
  });

  it('no error when condition not met', () => {
    const errors = validateCrossFieldDependencies(schema, { filingStatus: 'single' });
    expect(errors).toHaveLength(0);
  });
});

// ─── Error Helpers ──────────────────────────────────────────────────

describe('error helpers', () => {
  it('creates required error', () => {
    const err = requiredError('f1', 'Name');
    expect(err.type).toBe('validation');
    expect(err.code).toBe('REQUIRED');
    expect(err.fieldId).toBe('f1');
    expect(err.message).toContain('Name');
  });

  it('creates format error', () => {
    const err = formatError('f1', 'SSN', 'XXX-XX-XXXX');
    expect(err.code).toBe('FORMAT');
    expect(err.message).toContain('XXX-XX-XXXX');
  });

  it('creates range error with min and max', () => {
    const err = rangeError('f1', 'Age', 0, 120);
    expect(err.code).toBe('RANGE');
    expect(err.message).toContain('between');
  });

  it('creates range error with only min', () => {
    const err = rangeError('f1', 'Age', 0);
    expect(err.message).toContain('at least');
  });

  it('creates range error with only max', () => {
    const err = rangeError('f1', 'Age', undefined, 120);
    expect(err.message).toContain('at most');
  });

  it('creates type error', () => {
    const err = typeError('f1', 'Amount', 'number');
    expect(err.code).toBe('TYPE');
  });

  it('creates dependency error', () => {
    const err = dependencyError('f2', 'Spouse Name', 'filingStatus');
    expect(err.code).toBe('DEPENDENCY');
    expect(err.message).toContain('filingStatus');
  });
});

// ─── validateFormData ───────────────────────────────────────────────

describe('validateFormData', () => {
  const schema: FormSchema = {
    formCode: '1040',
    taxYear: 2024,
    irsRevision: '2024-01',
    name: 'Form 1040',
    fields: [
      {
        id: 'firstName',
        pdfFieldName: 'first_name',
        label: 'First Name',
        type: FieldType.Text,
        required: true,
        maxLength: 50,
      },
      {
        id: 'ssn',
        pdfFieldName: 'ssn',
        label: 'Social Security Number',
        type: FieldType.SSN,
        required: true,
      },
      {
        id: 'wages',
        pdfFieldName: 'wages',
        label: 'Wages',
        type: FieldType.Currency,
        min: 0,
      },
      {
        id: 'filingStatus',
        pdfFieldName: 'filing_status',
        label: 'Filing Status',
        type: FieldType.Dropdown,
        required: true,
        allowedValues: ['single', 'married', 'head_of_household'],
      },
      {
        id: 'spouseSSN',
        pdfFieldName: 'spouse_ssn',
        label: 'Spouse SSN',
        type: FieldType.SSN,
        requiredIf: { field: 'filingStatus', operator: 'eq', value: 'married' },
      },
      {
        id: 'zipCode',
        pdfFieldName: 'zip',
        label: 'Zip Code',
        type: FieldType.ZipCode,
      },
      {
        id: 'dependents',
        pdfFieldName: 'dependents',
        label: 'Number of Dependents',
        type: FieldType.Integer,
        min: 0,
        max: 20,
      },
    ],
  };

  it('returns no errors for valid complete data', () => {
    const data = {
      firstName: 'John',
      ssn: '123-45-6789',
      wages: 50000,
      filingStatus: 'single',
      zipCode: '12345',
      dependents: 2,
    };
    const errors = validateFormData(schema, data);
    expect(errors).toHaveLength(0);
  });

  it('returns REQUIRED errors for missing required fields', () => {
    const errors = validateFormData(schema, {});
    const requiredErrors = errors.filter((e) => e.code === 'REQUIRED');
    expect(requiredErrors.length).toBeGreaterThanOrEqual(3); // firstName, ssn, filingStatus
  });

  it('returns TYPE error for invalid SSN format', () => {
    const data = {
      firstName: 'John',
      ssn: 'not-an-ssn',
      filingStatus: 'single',
    };
    const errors = validateFormData(schema, data);
    const ssnErrors = errors.filter((e) => e.fieldId === 'ssn');
    expect(ssnErrors).toHaveLength(1);
    expect(ssnErrors[0].code).toBe('TYPE');
  });

  it('validates allowed values', () => {
    const data = {
      firstName: 'John',
      ssn: '123-45-6789',
      filingStatus: 'invalid_status',
    };
    const errors = validateFormData(schema, data);
    const statusErrors = errors.filter((e) => e.fieldId === 'filingStatus');
    expect(statusErrors).toHaveLength(1);
    expect(statusErrors[0].code).toBe('FORMAT');
  });

  it('validates range constraints', () => {
    const data = {
      firstName: 'John',
      ssn: '123-45-6789',
      filingStatus: 'single',
      dependents: 25,
    };
    const errors = validateFormData(schema, data);
    const depErrors = errors.filter((e) => e.fieldId === 'dependents');
    expect(depErrors).toHaveLength(1);
    expect(depErrors[0].code).toBe('RANGE');
  });

  it('validates maxLength', () => {
    const data = {
      firstName: 'A'.repeat(51),
      ssn: '123-45-6789',
      filingStatus: 'single',
    };
    const errors = validateFormData(schema, data);
    const nameErrors = errors.filter((e) => e.fieldId === 'firstName');
    expect(nameErrors).toHaveLength(1);
    expect(nameErrors[0].code).toBe('RANGE');
  });

  it('validates cross-field dependency', () => {
    const data = {
      firstName: 'John',
      ssn: '123-45-6789',
      filingStatus: 'married',
      // spouseSSN is missing
    };
    const errors = validateFormData(schema, data);
    const depErrors = errors.filter((e) => e.fieldId === 'spouseSSN');
    expect(depErrors).toHaveLength(1);
    expect(depErrors[0].code).toBe('DEPENDENCY');
  });

  it('skips cross-field when condition not met', () => {
    const data = {
      firstName: 'John',
      ssn: '123-45-6789',
      filingStatus: 'single',
      // spouseSSN missing but not required for single
    };
    const errors = validateFormData(schema, data);
    const depErrors = errors.filter((e) => e.fieldId === 'spouseSSN');
    expect(depErrors).toHaveLength(0);
  });

  it('does not validate type for empty optional fields', () => {
    const data = {
      firstName: 'John',
      ssn: '123-45-6789',
      filingStatus: 'single',
      // wages, zipCode, dependents are all absent and optional
    };
    const errors = validateFormData(schema, data);
    expect(errors).toHaveLength(0);
  });

  it('returns all errors at once, not just the first', () => {
    // All required fields missing, should get multiple errors
    const errors = validateFormData(schema, { dependents: 25 });
    expect(errors.length).toBeGreaterThan(1);
  });
});
