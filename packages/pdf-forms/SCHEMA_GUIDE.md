# Schema Authoring Guide

This guide covers everything you need to write a `FormSchema` for a new IRS tax form.

## Schema Structure

A `FormSchema` is the top-level object that defines a single form for a specific tax year:

```typescript
interface FormSchema {
  formCode: string;       // IRS form identifier, e.g. 'W-9', '1040', '1099-NEC'
  taxYear: number;        // Tax year this schema applies to, e.g. 2024
  irsRevision: string;    // IRS revision string, e.g. 'Rev. October 2024'
  name: string;           // Human-readable form name
  fields: FieldDefinition[];
}
```

Each form+year combination is a unique schema. The same form code can have multiple schemas for different tax years (e.g., the 2023 and 2024 versions of form 1040).

## Field Definition

Each field in the `fields` array maps a semantic identifier to a PDF AcroForm field:

```typescript
interface FieldDefinition {
  id: string;                        // Semantic ID (snake_case), e.g. 'total_income'
  pdfFieldName: string;              // Exact AcroForm field name in the PDF
  label: string;                     // Human-readable label
  type: FieldType;                   // Enum value — see FieldType Reference below
  required?: boolean;                // Unconditionally required
  requiredIf?: ConditionalRule;      // Conditionally required (see Cross-Field Dependencies)
  format?: string;                   // Regex pattern for additional validation
  minLength?: number;                // Minimum string length
  maxLength?: number;                // Maximum string length
  min?: number;                      // Minimum numeric value
  max?: number;                      // Maximum numeric value
  allowedValues?: string[];          // Whitelist of valid string values
  defaultValue?: FieldValue;         // Default if not provided
  calculation?: CalculationRule;     // Formula for computed fields (see Calculation Rules)
  page?: number;                     // PDF page number (informational)
}
```

### Finding PDF Field Names

PDF field names are often opaque (e.g., `topmostSubform[0].Page1[0].f1_1[0]`). To discover them:

1. Use `analyzeFormTemplate(pdfBytes)` or the `/api/pdf-forms/builder/start` endpoint
2. Use a PDF form editor like Adobe Acrobat or pdf-lib's inspection tools
3. The builder will extract all field names and suggest types

The `pdfFieldName` must match the PDF field name exactly, including case and array indices.

## FieldType Reference

| FieldType | Stored As | Input Accepts | Validation Rules | Coercion |
|-----------|-----------|---------------|------------------|----------|
| `Text` | `string` | Any string | `format` regex, `minLength`/`maxLength`, `allowedValues` | None |
| `Checkbox` | `boolean` | `boolean`, `'true'`, `'1'`, `'yes'` | Must be boolean | String to boolean |
| `Radio` | `string` | String matching an option | `allowedValues` | None |
| `Dropdown` | `string` | String matching an option | `allowedValues` | None |
| `SSN` | `string` | `'123-45-6789'` or `'123456789'` | Format `XXX-XX-XXXX`, no all-zeros groups | Normalizes to `XXX-XX-XXXX` |
| `EIN` | `string` | `'12-3456789'` or `'123456789'` | Format `XX-XXXXXXX` | Normalizes to `XX-XXXXXXX` |
| `Date` | `string` | `'MM/DD/YYYY'`, `'M/D/YYYY'`, `'YYYY-MM-DD'` | Valid month (1-12), valid day for month, leap year aware | Normalizes to `MM/DD/YYYY` |
| `Currency` | `number` (cents) | `'$1,234.56'`, `'1234.56'`, `123456` (cents) | Integer (when numeric), non-negative, valid format (when string) | Converts to integer cents |
| `Percentage` | `number` | `'50.5%'`, `'50.5'`, `50.5` | Between 0 and 100 | Strips `%`, parses float |
| `Integer` | `number` | `'42'`, `42` | Whole number | Parses string to int |
| `ZipCode` | `string` | `'12345'`, `'12345-6789'` | Format `XXXXX` or `XXXXX-XXXX` | Strips whitespace |
| `Phone` | `string` | `'(212) 555-1234'`, `'212-555-1234'`, `'2125551234'` | 10 digits (or 11 starting with 1) | Normalizes to `(XXX) XXX-XXXX` |

### Currency: The Integer-Cents Convention

All currency values are stored internally as integers representing cents. This is critical for deterministic tax calculations:

- Input `"$1,234.56"` is coerced to `123456` (cents)
- Input `1234` (numeric, already integer) is stored as `1234` (cents = $12.34)
- When writing to PDF, cents are converted back: `123456` becomes `"1234.56"`
- All arithmetic in the calculation engine operates on cents
- The `irsRound` function rounds to the nearest dollar boundary (multiple of 100 cents)

If you define a `Currency` field with `min`/`max`, those bounds are in cents.

## Cross-Field Dependencies

Use `requiredIf` to make a field conditionally required based on another field's value:

```typescript
interface ConditionalRule {
  field: string;                                    // ID of the field to check
  operator: 'eq' | 'neq' | 'truthy' | 'falsy' | 'in';
  value?: FieldValue | FieldValue[];                // Comparison value (not needed for truthy/falsy)
}
```

### Operators

| Operator | Meaning | Value Required |
|----------|---------|----------------|
| `eq` | Field equals value | Yes |
| `neq` | Field does not equal value | Yes |
| `truthy` | Field is non-null, non-empty, non-false | No |
| `falsy` | Field is null, empty, or false | No |
| `in` | Field value is in the array | Yes (array) |

### Examples

**Required when a checkbox is checked:**

```typescript
{
  id: 'llc_classification',
  pdfFieldName: 'f1_3[0]',
  label: 'LLC tax classification (C, S, or P)',
  type: FieldType.Text,
  allowedValues: ['C', 'S', 'P'],
  requiredIf: {
    field: 'tax_class_llc',
    operator: 'eq',
    value: true,
  },
}
```

**Required when filing status is one of several values:**

```typescript
{
  id: 'spouse_ssn',
  pdfFieldName: 'f_spouse_ssn',
  label: 'Spouse SSN',
  type: FieldType.SSN,
  requiredIf: {
    field: 'filing_status',
    operator: 'in',
    value: ['married_joint', 'married_separate'],
  },
}
```

**Required when another field has any value:**

```typescript
{
  id: 'other_description',
  pdfFieldName: 'f_other_desc',
  label: 'Other classification description',
  type: FieldType.Text,
  requiredIf: {
    field: 'tax_class_other',
    operator: 'truthy',
  },
}
```

## Calculation Rules

Computed fields use a `CalculationRule` attached to the field definition:

```typescript
interface CalculationRule {
  formula: FormulaExpression;
  roundingRule?: 'nearest' | 'down' | 'up';
}
```

The `roundingRule` applies IRS-style rounding to the nearest dollar boundary after the formula is evaluated. If omitted, the raw cents value is used.

### FormulaExpression Types

All formulas are expression trees. The calculation engine builds a DAG from all calculated fields, sorts them topologically, and evaluates each in order.

#### `ref` -- Reference a field

```typescript
{ op: 'ref', field: 'line_1' }
```

Reads the current value of field `line_1`. If the field hasn't been computed yet and isn't in the input data, throws `MISSING_INPUT`.

#### `literal` -- Constant value

```typescript
{ op: 'literal', value: 1460000 }  // $14,600.00 in cents
```

#### `add` -- Sum

```typescript
{
  op: 'add',
  operands: [
    { op: 'ref', field: 'line_1' },
    { op: 'ref', field: 'line_2' },
    { op: 'ref', field: 'line_3' },
  ]
}
```

#### `subtract` -- Difference

```typescript
{
  op: 'subtract',
  left: { op: 'ref', field: 'gross_income' },
  right: { op: 'ref', field: 'adjustments' },
}
```

#### `multiply` -- Product

```typescript
{
  op: 'multiply',
  left: { op: 'ref', field: 'income' },
  right: { op: 'literal', value: 0.153 },  // 15.3% self-employment tax rate
}
```

#### `divide` -- Quotient

```typescript
{
  op: 'divide',
  left: { op: 'ref', field: 'total' },
  right: { op: 'literal', value: 2 },
}
```

Throws `DIVISION_BY_ZERO` if the right operand evaluates to zero.

#### `min` / `max` -- Bounds

```typescript
{
  op: 'min',
  operands: [
    { op: 'ref', field: 'calculated_credit' },
    { op: 'literal', value: 200000 },  // Cap at $2,000.00
  ]
}
```

#### `if` -- Conditional

```typescript
{
  op: 'if',
  condition: {
    field: 'filing_status',
    operator: 'eq',
    value: 1,  // 1 = single (encoded as number in the values map)
  },
  then: { op: 'literal', value: 1460000 },
  else: { op: 'literal', value: 2920000 },
}
```

The condition uses the same `ConditionalRule` structure as `requiredIf`, but operates on numeric values since all data is converted to numbers in the calculation engine.

#### `taxTableLookup` -- Tax bracket calculation

```typescript
{
  op: 'taxTableLookup',
  table: 'federal_income_tax',
  input: { op: 'ref', field: 'taxable_income' },
  filingStatus: { op: 'ref', field: 'filing_status' },
}
```

Available tables: `federal_income_tax` (alias: `income_tax`), `standard_deduction`. Both use 2024 IRS brackets.

#### `round` -- Rounding

```typescript
{
  op: 'round',
  operand: { op: 'ref', field: 'tax_before_rounding' },
  rule: 'nearest',  // 'nearest' | 'down' | 'up'
}
```

Rounds to the nearest dollar boundary (multiple of 100 cents).

### Worked Example: 1040 Line 15 (Tax)

```typescript
{
  id: 'line_15_tax',
  pdfFieldName: 'f1_15',
  label: 'Tax (from Tax Table or Tax Computation Worksheet)',
  type: FieldType.Currency,
  calculation: {
    formula: {
      op: 'taxTableLookup',
      table: 'federal_income_tax',
      input: { op: 'ref', field: 'line_14_taxable_income' },
      filingStatus: { op: 'ref', field: 'filing_status' },
    },
    roundingRule: 'nearest',
  },
}
```

### Worked Example: Net Income (Line A - Line B, minimum 0)

```typescript
{
  id: 'net_income',
  pdfFieldName: 'f_net',
  label: 'Net income',
  type: FieldType.Currency,
  calculation: {
    formula: {
      op: 'max',
      operands: [
        {
          op: 'subtract',
          left: { op: 'ref', field: 'gross_income' },
          right: { op: 'ref', field: 'total_deductions' },
        },
        { op: 'literal', value: 0 },
      ],
    },
  },
}
```

## Naming Conventions

### Field IDs

- Use `snake_case` for all field IDs
- Match IRS line numbers where possible: `line_1`, `line_2a`, `line_15`
- Use descriptive names for fields without line numbers: `filing_status`, `spouse_ssn`
- Prefix related fields: `tax_class_individual`, `tax_class_c_corp`, `tax_class_llc`

### Form Codes

- Use the official IRS form number: `W-9`, `1040`, `1099-NEC`, `W-4`
- Schema variable names: `w9_2024`, `f1040_2024`, `f1099_nec_2024`
- Schema file names: `w9.ts`, `f1040.ts`, `f1099-nec.ts`

## Testing Your Schema

Write tests covering three areas:

### 1. Validation

```typescript
import { validateFormData } from '@claude-tauri/pdf-forms';

test('rejects missing required fields', () => {
  const errors = validateFormData(mySchema, {});
  expect(errors.some(e => e.code === 'REQUIRED' && e.fieldId === 'name')).toBe(true);
});

test('rejects invalid SSN', () => {
  const errors = validateFormData(mySchema, { ssn: '000-00-0000' });
  expect(errors.some(e => e.code === 'TYPE' && e.fieldId === 'ssn')).toBe(true);
});
```

### 2. Calculations

```typescript
import { calculateFields } from '@claude-tauri/pdf-forms';

test('computes total correctly', () => {
  const result = calculateFields(mySchema, { line_1: 500000, line_2: 300000 });
  expect(result.values['line_3_total']).toBe(800000);  // 8000.00 in cents
});
```

### 3. Round-trip (fill + verify)

```typescript
import { fillTaxForm } from '@claude-tauri/pdf-forms';

test('fills and verifies W-9', async () => {
  const result = await fillTaxForm({
    formId: 'W-9',
    taxYear: 2024,
    templatePdf: blankPdfBytes,
    data: { name: 'Test User', address: '123 Test St', city_state_zip: 'Test, TS 00000' },
  });
  expect(result.success).toBe(true);
  expect(result.verificationReport.passed).toBe(true);
});
```

## Common Pitfalls

### 1. PDF field name mismatch

The `pdfFieldName` must match the AcroForm field name character-for-character, including array indices like `[0]`. Use `analyzeFormTemplate` to extract the exact names. A mismatch produces a `FIELD_NOT_FOUND` error at fill time, not at schema registration time.

### 2. Currency fields stored as dollars instead of cents

If you pass `1000` to a Currency field, it means $10.00 (1000 cents), not $1,000.00. To represent $1,000.00, pass `100000` or the string `"$1,000.00"` (which gets coerced to `100000`).

### 3. Circular calculation dependencies

If field A's formula references field B and field B's formula references field A, the DAG builder throws a `CYCLE` error. Review your dependency chain if this happens. The `extractDependencies` function can help debug which fields a formula references.

### 4. Missing `requiredIf` field reference

If a `requiredIf` condition references a field ID that doesn't exist in the schema, the condition will evaluate against `undefined`. This is technically valid (the condition may simply never trigger), but it's likely a bug. Double-check field IDs in conditional rules.

### 5. Forgetting to register the schema

Creating a schema file is not enough. You must import it in `src/schemas/index.ts` and call `globalRegistry.register(mySchema)`. Otherwise `fillTaxForm` will return a `WRONG_FORM` error.

### 6. Checkbox values in the PDF

Some IRS PDFs use `'Yes'`/`'Off'` for checkbox values, not `true`/`false`. The `PdfLibFiller` handles this internally -- you should always use `boolean` values in your schema data. The filler calls `.check()` or `.uncheck()` on the PDF checkbox widget.

### 7. Flattened PDFs can't be verified

If you set `flatten: true`, the verification step reads the flattened PDF. Most PDF libraries can still read field values from flattened forms, but some edge cases may produce `READ_FAILED` errors. Consider running verification before flattening, or use `skipVerification: true` when flattening.
