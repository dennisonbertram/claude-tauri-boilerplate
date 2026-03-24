# @claude-tauri/pdf-forms

Deterministic PDF tax form filling with validation, calculation, and verification. This package provides a complete pipeline for programmatically filling IRS tax forms: it validates input data against a typed schema, computes calculated fields via a DAG-based formula engine, writes values into a PDF template using pdf-lib, and then reads the result back to verify every field was written correctly.

## Installation

This is a workspace package. Add it as a dependency from within the monorepo:

```jsonc
// package.json
{
  "dependencies": {
    "@claude-tauri/pdf-forms": "workspace:*"
  }
}
```

Then import from the package:

```typescript
import { fillTaxForm, globalRegistry } from '@claude-tauri/pdf-forms';
```

## Quick Start

Fill a W-9 form in one call:

```typescript
import { fillTaxForm } from '@claude-tauri/pdf-forms';
import { readFile, writeFile } from 'fs/promises';

const templatePdf = new Uint8Array(await readFile('fw9.pdf'));

const result = await fillTaxForm({
  formId: 'W-9',
  taxYear: 2024,
  templatePdf,
  data: {
    name: 'John Doe',
    ssn: '123-45-6789',
    address: '123 Main St',
    city_state_zip: 'New York, NY 10001',
    tax_class_individual: true,
  },
  options: { flatten: true },
});

if (result.success) {
  await writeFile('filled-w9.pdf', result.pdfBytes);
} else {
  console.error('Errors:', result.errors);
}
```

## Architecture

The pipeline executes eight steps in sequence. If `strictValidation` is set, it short-circuits on the first error category.

```
                         fillTaxForm(params)
                               |
                    1. Schema Lookup
                        (registry.get)
                               |
                    2. Compatibility Check
                       (checkCompatibility)
                               |
                    3. Coerce Input Values
                       (coerceFieldValue)
                               |
                    4. Validate
                       (validateFormData)
                               |
                    5. Calculate Computed Fields
                       (calculateFields via DAG)
                               |
                    6. Map to PDF Field Names
                       (toPdfValue)
                               |
                    7. Fill PDF
                       (PdfLibFiller.fill)
                               |
                    8. Verify Round-Trip
                       (verifyFilledPdf)
                               |
                         FillResult
```

Each step is also independently callable for fine-grained control.

## Package Structure

```
packages/pdf-forms/
  src/
    index.ts                   # Re-exports everything
    pipeline.ts                # fillTaxForm() orchestrator, getSchemaInfo()
    types/
      field-types.ts           # FieldType enum, FieldValue union
      schema-types.ts          # FormSchema, FieldDefinition, FormSchemaRegistry, ConditionalRule, CalculationRule
      calculation-types.ts     # FormulaExpression union, CalcNode, CalcDAG
      result-types.ts          # FillResult, FillOptions, error types, VerificationReport, PdfFieldInfo
    validation/
      index.ts                 # validateFormData() + re-exports
      type-validators.ts       # validateSSN, validateEIN, validateDate, etc.
      coercion.ts              # coerceCurrency, coerceSSN, coerceFieldValue, etc.
      cross-field.ts           # evaluateCondition, validateCrossFieldDependencies
      errors.ts                # requiredError, formatError, rangeError, typeError, dependencyError
    calculation/
      index.ts                 # calculateFields() + re-exports
      dag.ts                   # buildCalcDAG, extractDependencies (Kahn's algorithm)
      formulas.ts              # evaluateFormula (recursive tree evaluator)
      tax-tables.ts            # 2024 federal brackets, TaxTableRegistry
      rounding.ts              # irsRound, roundToCents
    pdf/
      interfaces.ts            # PdfReader, PdfFiller, PdfVerifier abstractions
      reader.ts                # PdfLibReader (pdf-lib implementation)
      filler.ts                # PdfLibFiller (pdf-lib implementation)
      verifier.ts              # PdfLibVerifier, verifyFilledPdf()
      compatibility.ts         # checkCompatibility()
    schemas/
      index.ts                 # globalRegistry instance, registers all schemas
      w9.ts                    # W-9 2024 schema definition
    builder/
      index.ts                 # analyzeFormTemplate()
      field-classifier.ts      # classifyField() heuristic classifier
      schema-writer.ts         # generateSchemaSource() code generator
    __tests__/
      pipeline.test.ts
      validation.test.ts
      calculation.test.ts
      dag.test.ts
      pdf.test.ts
```

## API Reference

### `fillTaxForm(params): Promise<FillResult>`

The main entry point. Runs the full pipeline: schema lookup, compatibility check, coercion, validation, calculation, PDF fill, and verification.

**Parameters:**

```typescript
{
  formId: string;                          // Form code, e.g. 'W-9'
  taxYear: number;                         // Tax year, e.g. 2024
  templatePdf: Uint8Array;                 // Blank IRS PDF template bytes
  data: Record<string, FieldValue>;        // Field values keyed by field ID
  options?: FillOptions;                   // See FillOptions below
  registry?: FormSchemaRegistry;           // Custom registry (defaults to globalRegistry)
}
```

**FillOptions:**

| Option             | Type    | Default | Description |
|--------------------|---------|---------|-------------|
| `flatten`          | boolean | false   | Flatten form fields (makes them non-editable) |
| `skipVerification` | boolean | false   | Skip the read-back verification step |
| `strictValidation` | boolean | false   | Abort on first validation or compatibility error |

**Returns `FillResult`:**

```typescript
{
  success: boolean;                        // true if no blocking errors and verification passed
  pdfBytes: Uint8Array;                    // Filled PDF bytes (empty on fatal error)
  errors: FormError[];                     // All errors encountered
  calculationLog: CalculationLogEntry[];   // Trace of every calculated field
  verificationReport: VerificationReport;  // Round-trip verification results
}
```

---

### `validateFormData(schema, data): ValidationError[]`

Validates field data against a schema without filling a PDF. Checks required fields, type constraints, format patterns, range/length limits, allowed values, and cross-field dependencies.

```typescript
import { validateFormData, globalRegistry } from '@claude-tauri/pdf-forms';

const schema = globalRegistry.get('W-9', 2024)!;
const errors = validateFormData(schema, { name: '', ssn: '000-00-0000' });
// errors: [{ code: 'REQUIRED', fieldId: 'name', ... }, { code: 'TYPE', fieldId: 'ssn', ... }]
```

---

### `calculateFields(schema, data): { values, log }`

Builds a DAG from all fields with `calculation` rules, topologically sorts them, and evaluates each formula in order. All monetary values are integers in cents.

```typescript
import { calculateFields } from '@claude-tauri/pdf-forms';

const result = calculateFields(schema, inputData);
// result.values — Record<string, number> of all field values (inputs + computed)
// result.log — CalculationLogEntry[] trace of each calculation step
```

---

### `PdfLibReader.extractFields(pdfBytes): Promise<PdfFieldInfo[]>`

Extracts AcroForm field metadata from a PDF. Returns an array of `PdfFieldInfo` objects:

```typescript
{
  name: string;                     // PDF field name (e.g. 'topmostSubform[0].Page1[0].f1_1[0]')
  type: 'text' | 'checkbox' | 'radio' | 'dropdown';
  page: number;                     // Page index (0-based)
  options?: string[];               // For radio/dropdown fields
  defaultValue?: string;
}
```

---

### `PdfLibFiller.fill(templateBytes, fieldValues, options): Promise<{ pdfBytes, errors }>`

Fills PDF form fields and returns the result bytes. Collects all errors instead of throwing on the first failure.

```typescript
const filler = new PdfLibFiller();
const { pdfBytes, errors } = await filler.fill(templatePdf, {
  'topmostSubform[0].Page1[0].f1_1[0]': 'John Doe',
  'topmostSubform[0].Page1[0].c1_1[0]': true,
}, { flatten: true });
```

---

### `verifyFilledPdf(filledPdfBytes, expectedValues, schema): Promise<VerificationReport>`

Reads back every field from a filled PDF and compares against expected values. Returns a report:

```typescript
{
  passed: boolean;         // true if zero mismatches
  fieldCount: number;      // Total fields in schema
  verifiedCount: number;   // Fields that matched
  mismatches: FieldMismatch[];  // { fieldId, expected, actual }
}
```

---

### `checkCompatibility(pdfBytes, schema, reader): Promise<CompatibilityError[]>`

Validates that a PDF template contains all fields expected by the schema. Missing fields produce `MISSING_FIELD` errors. Extra fields in the PDF are silently ignored.

---

### `globalRegistry: FormSchemaRegistry`

The default registry instance with the W-9 (2024) schema pre-loaded.

**Methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `(schema: FormSchema) => void` | Add a schema |
| `get` | `(formCode: string, taxYear: number) => FormSchema \| undefined` | Look up by code + year |
| `getLatest` | `(formCode: string) => FormSchema \| undefined` | Latest year for a form code |
| `list` | `() => FormSchema[]` | All registered schemas |

---

### `analyzeFormTemplate(pdfBytes): Promise<{ fields }>`

Builder utility. Extracts all fields from a PDF and runs heuristic classification on each, suggesting a semantic ID, FieldType, and confidence level.

```typescript
const analysis = await analyzeFormTemplate(pdfBytes);
for (const f of analysis.fields) {
  console.log(f.name, '->', f.suggestion.suggestedId, f.suggestion.suggestedType);
}
```

---

### `generateSchemaSource(config: SchemaConfig): string`

Builder utility. Generates a complete TypeScript source file for a `FormSchema` from a `SchemaConfig` object. The output can be saved directly to `src/schemas/`.

```typescript
const source = generateSchemaSource({
  formCode: '1099-NEC',
  taxYear: 2024,
  irsRevision: 'Rev. January 2024',
  name: 'Nonemployee Compensation',
  fields: [
    { pdfFieldName: 'f1_1', id: 'payer_name', type: FieldType.Text, label: 'Payer name', required: true },
    // ...
  ],
});
```

---

### `getSchemaInfo(formId, taxYear?, registry?): FormSchema | null`

Convenience function to look up a schema by form ID and optional tax year. If no year is given, returns the latest available.

## Adding New Forms

### Step-by-step

1. **Obtain a blank IRS PDF** for the form you want to support.

2. **Extract fields** using the builder:
   ```typescript
   const analysis = await analyzeFormTemplate(pdfBytes);
   ```
   Or via the server endpoint: `POST /api/pdf-forms/builder/start` (multipart with the PDF).

3. **Map each field** from the PDF field name to a semantic ID. For each field, decide:
   - `id` — a snake_case semantic identifier (e.g. `payer_name`, `total_income`)
   - `pdfFieldName` — the exact AcroForm field name from the PDF
   - `type` — one of the `FieldType` enum values
   - `label` — human-readable description
   - Validation rules: `required`, `format` (regex), `min`/`max`, `allowedValues`

4. **Define calculations** for computed fields using `FormulaExpression` trees. See the Formula DSL section below.

5. **Define cross-field dependencies** using `requiredIf` with a `ConditionalRule`.

6. **Create the schema file** at `src/schemas/{formcode}.ts` and register it in `src/schemas/index.ts`:
   ```typescript
   import { myForm_2024 } from './myform';
   globalRegistry.register(myForm_2024);
   export { myForm_2024 };
   ```

7. **Write tests** in `src/__tests__/` covering validation, calculation, and round-trip fill+verify.

## Formula DSL

Calculated fields use a `FormulaExpression` tree. Each node has an `op` and type-specific properties.

| Op | Shape | Description | Example |
|----|-------|-------------|---------|
| `ref` | `{ op: 'ref', field: string }` | Reference another field's value | `{ op: 'ref', field: 'line_1' }` |
| `literal` | `{ op: 'literal', value: number }` | Constant (in cents for currency) | `{ op: 'literal', value: 100 }` |
| `add` | `{ op: 'add', operands: FormulaExpression[] }` | Sum of N operands | `{ op: 'add', operands: [ref('a'), ref('b')] }` |
| `subtract` | `{ op: 'subtract', left, right }` | left - right | `{ op: 'subtract', left: ref('gross'), right: ref('deductions') }` |
| `multiply` | `{ op: 'multiply', left, right }` | left * right | `{ op: 'multiply', left: ref('income'), right: { op: 'literal', value: 0.10 } }` |
| `divide` | `{ op: 'divide', left, right }` | left / right (throws on zero) | `{ op: 'divide', left: ref('total'), right: { op: 'literal', value: 2 } }` |
| `min` | `{ op: 'min', operands: FormulaExpression[] }` | Minimum of N values | `{ op: 'min', operands: [ref('a'), { op: 'literal', value: 500000 }] }` |
| `max` | `{ op: 'max', operands: FormulaExpression[] }` | Maximum of N values | `{ op: 'max', operands: [ref('a'), { op: 'literal', value: 0 }] }` |
| `if` | `{ op: 'if', condition: ConditionalRule, then, else }` | Conditional branch | See below |
| `taxTableLookup` | `{ op: 'taxTableLookup', table, input, filingStatus }` | Tax bracket lookup | `{ op: 'taxTableLookup', table: 'federal_income_tax', input: ref('taxable_income'), filingStatus: ref('filing_status') }` |
| `round` | `{ op: 'round', operand, rule }` | IRS rounding (nearest/down/up) | `{ op: 'round', operand: ref('tax'), rule: 'nearest' }` |

**Conditional example:**

```typescript
{
  op: 'if',
  condition: { field: 'filing_status', operator: 'eq', value: 'single' },
  then: { op: 'literal', value: 1460000 },  // $14,600 standard deduction in cents
  else: { op: 'literal', value: 2920000 },  // $29,200 married filing jointly
}
```

All arithmetic operates on integers (cents). Intermediate results are rounded to the nearest cent via `roundToCents`. The `irsRound` function rounds to the nearest dollar boundary for final line items.

## Server API Endpoints

All endpoints are mounted at `/api/pdf-forms`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/schemas` | List all registered form schemas (code, year, name, field count) |
| GET | `/schemas/:formId` | Get a specific schema's full definition. Accepts `W-9` (latest year) or `W-9-2024` (specific year) |
| POST | `/analyze` | Upload a PDF (multipart, field: `file`), get field metadata with heuristic type suggestions |
| POST | `/fill` | Full pipeline: validate, calculate, fill, verify. Accepts multipart (file + JSON `data`) or JSON with `templatePdfBase64` |
| POST | `/verify` | Verify a previously filled PDF against expected values. Accepts multipart or JSON with `filledPdfBase64` |
| POST | `/builder/start` | Upload a PDF (multipart), get analyzed fields for schema building (same as `/analyze`) |
| POST | `/builder/export` | Submit field mappings as JSON, receive generated TypeScript schema source |

### Example: Fill via JSON

```bash
curl -X POST http://localhost:3131/api/pdf-forms/fill \
  -H 'Content-Type: application/json' \
  -d '{
    "formId": "W-9",
    "taxYear": 2024,
    "templatePdfBase64": "<base64-encoded-pdf>",
    "data": {
      "name": "John Doe",
      "ssn": "123-45-6789",
      "address": "123 Main St",
      "city_state_zip": "New York, NY 10001"
    },
    "options": { "flatten": true }
  }'
```

**Response:**
```json
{
  "success": true,
  "pdfBase64": "<base64-encoded-filled-pdf>",
  "errors": [],
  "calculationLog": [],
  "verification": {
    "passed": true,
    "fieldCount": 20,
    "verifiedCount": 4,
    "mismatches": []
  }
}
```

### Example: Builder Export

```bash
curl -X POST http://localhost:3131/api/pdf-forms/builder/export \
  -H 'Content-Type: application/json' \
  -d '{
    "formCode": "1099-NEC",
    "taxYear": 2024,
    "irsRevision": "Rev. January 2024",
    "name": "Nonemployee Compensation",
    "fields": [
      { "pdfFieldName": "f1_1", "id": "payer_name", "type": "text", "label": "Payer name", "required": true }
    ]
  }'
```

**Response:**
```json
{
  "source": "/**\n * Nonemployee Compensation\n * Form 1099-NEC ...\n"
}
```

## Design Decisions

### Integer Cents

All monetary values are stored and computed as integers representing cents. This eliminates floating-point rounding errors that would be unacceptable on tax forms. The `coerceCurrency` function converts string inputs like `"$1,234.56"` to `123456`. The `toPdfValue` function converts cents back to dollar strings like `"1234.56"` when writing to PDF fields.

### DAG-Based Calculations

Calculated fields form a directed acyclic graph. The engine uses Kahn's algorithm for topological sort, guaranteeing every field's dependencies are computed before the field itself. Circular dependencies are detected and produce a `CYCLE` error.

### Round-Trip Verification

After filling a PDF, the pipeline reads every field value back from the filled PDF and compares it against what was written. This catches silent PDF library failures, encoding issues, or field name mismatches. The verification step can be skipped with `skipVerification: true` for performance.

### Library Abstraction

PDF operations are behind interfaces (`PdfReader`, `PdfFiller`, `PdfVerifier`). The current implementations use pdf-lib, but the interfaces allow swapping to a different library (e.g., pdf.js, HummusJS) without changing any pipeline or schema code.

### Type Coercion

Input data is coerced to canonical formats before validation. SSNs are normalized to `XXX-XX-XXXX`, dates to `MM/DD/YYYY`, currency strings to integer cents, phone numbers to `(XXX) XXX-XXXX`. This means consumers can provide data in flexible formats and the pipeline handles normalization.

## Error Types

Every error has a `type` discriminator and a `code`:

| Type | Codes | When |
|------|-------|------|
| `validation` | `REQUIRED`, `FORMAT`, `RANGE`, `TYPE`, `DEPENDENCY` | Input data doesn't match schema |
| `compatibility` | `MISSING_FIELD`, `EXTRA_FIELD`, `WRONG_TYPE`, `WRONG_FORM` | PDF template doesn't match schema |
| `calculation` | `CYCLE`, `MISSING_INPUT`, `OVERFLOW`, `DIVISION_BY_ZERO` | Formula evaluation failure |
| `pdfWrite` | `FIELD_NOT_FOUND`, `WRITE_FAILED`, `FLATTEN_FAILED` | PDF fill operation failure |
| `verification` | `MISMATCH`, `READ_FAILED`, `CALC_MISMATCH` | Round-trip verification failure |
