# PDF Forms System

## Problem

Tax form filling is error-prone: formats vary between fields (SSN, EIN, currency, dates), forms have computed fields that depend on each other, and a single miswritten value can invalidate a filing. Manual filling through PDF editors is slow, inconsistent, and impossible to verify programmatically.

This system makes tax form filling deterministic: given a schema and input data, the output is always the same, always validated, and always verified by reading the filled values back from the PDF.

## Architecture Overview

The system has three layers:

```
Server Layer (apps/server)
  /api/pdf-forms/*  — 7 REST endpoints
       |
Package Layer (packages/pdf-forms)
  pipeline.ts       — fillTaxForm() orchestrator
  validation/       — type checking, coercion, cross-field rules
  calculation/      — DAG builder, formula evaluator, tax tables
  pdf/              — reader, filler, verifier (pdf-lib implementations behind interfaces)
  schemas/          — FormSchema definitions (W-9 2024 included)
  builder/          — tools for creating new schemas from blank PDFs
       |
PDF Library Layer
  pdf-lib            — reads/writes AcroForm fields in PDF documents
```

### Pipeline Flow

`fillTaxForm` runs eight steps:

1. **Schema lookup** -- resolves formId + taxYear to a `FormSchema` from the registry
2. **Compatibility check** -- verifies the uploaded PDF template has all expected AcroForm fields
3. **Coercion** -- normalizes inputs (e.g., `"123456789"` to `"123-45-6789"` for SSN, `"$1,234.56"` to `123456` cents)
4. **Validation** -- checks required fields, type constraints, format patterns, ranges, allowed values, and cross-field dependencies
5. **Calculation** -- builds a DAG of computed fields, topologically sorts it, evaluates each formula in order
6. **Field mapping** -- converts validated/computed values to PDF-ready strings/booleans keyed by PDF field name
7. **PDF fill** -- writes values into the template using pdf-lib, optionally flattens
8. **Verification** -- reads every value back from the filled PDF and compares against expected values

Steps 2-4 can short-circuit the pipeline when `strictValidation` is enabled.

### Key Design Decisions

**Integer cents** -- All monetary values are integers representing cents. This eliminates floating-point errors. The coercion layer handles conversion from dollar strings.

**DAG calculations** -- Calculated fields are topologically sorted before evaluation. This guarantees that every field's dependencies are available when its formula runs. Cycles are detected at build time.

**Round-trip verification** -- After filling, the pipeline reads every field back and compares values. This catches encoding issues, field name mismatches, and pdf-lib failures that might otherwise go undetected.

**Library abstraction** -- PDF operations sit behind `PdfReader`, `PdfFiller`, and `PdfVerifier` interfaces. The current implementations use pdf-lib, but could be swapped without changing pipeline or schema code.

## Server Integration

The server module (`apps/server/src/routes/pdf-forms.ts`) exposes the package through a Hono router mounted at `/api/pdf-forms`:

| Endpoint | Purpose |
|----------|---------|
| `GET /schemas` | List registered schemas |
| `GET /schemas/:formId` | Get schema details |
| `POST /analyze` | Extract fields from a blank PDF |
| `POST /fill` | Full fill pipeline (validate + calculate + fill + verify) |
| `POST /verify` | Verify a previously filled PDF |
| `POST /builder/start` | Analyze a PDF for schema building |
| `POST /builder/export` | Generate TypeScript schema source from field mappings |

The `/fill` endpoint accepts either multipart (PDF file + JSON data) or plain JSON with a base64-encoded PDF. It returns the filled PDF as base64 along with errors, calculation logs, and verification results.

## How to Extend

### Adding a new form

1. Get the blank IRS PDF
2. Use `POST /api/pdf-forms/builder/start` to extract field metadata
3. Create a schema file at `packages/pdf-forms/src/schemas/{form}.ts`
4. Define all fields with their IDs, PDF field names, types, and validation rules
5. Add calculation rules for computed fields
6. Register the schema in `packages/pdf-forms/src/schemas/index.ts`
7. Write tests

See `packages/pdf-forms/SCHEMA_GUIDE.md` for the full authoring guide.

### Adding a new field type

1. Add the value to the `FieldType` enum in `src/types/field-types.ts`
2. Add a validator function in `src/validation/type-validators.ts`
3. Add a coercion function in `src/validation/coercion.ts`
4. Register both in `src/validation/index.ts`
5. Handle the type in `toPdfValue` in `src/pipeline.ts` if PDF output differs from internal storage

### Adding a new tax table

1. Define bracket data in `src/calculation/tax-tables.ts`
2. Add a case to the `lookup` method in `createTaxTableRegistry`
3. Reference it from formulas with `{ op: 'taxTableLookup', table: 'your_table_name', ... }`

### Swapping the PDF library

1. Implement the `PdfReader`, `PdfFiller`, and `PdfVerifier` interfaces from `src/pdf/interfaces.ts`
2. Replace the imports in `src/pipeline.ts`
3. No schema or validation code needs to change

## Known Limitations

- **Single-page field indexing** -- `PdfLibReader` reports `page: 0` for all fields because pdf-lib doesn't expose page association for AcroForm fields. This is cosmetic only; filling works on all pages.

- **Tax tables are 2024 only** -- The tax bracket data and standard deductions in `tax-tables.ts` are hardcoded for the 2024 tax year. Supporting other years requires adding year-parameterized table data.

- **No attachment support** -- The system only handles AcroForm fields. It cannot attach supplemental documents, add signatures, or handle PDF annotations.

- **Flatten + verify edge cases** -- Flattening removes the form structure. Most pdf-lib read-back still works on flattened PDFs, but some field types may not round-trip cleanly after flattening.

- **W-9 only** -- Currently only the W-9 (2024) schema is included. The 1040, 1099, W-4 and other forms need schema definitions authored following the schema guide.

- **No state tax tables** -- Only federal income tax brackets are included. State-specific calculations would need additional table data.

## File Locations

- Package: `packages/pdf-forms/`
- Package README: `packages/pdf-forms/README.md`
- Schema guide: `packages/pdf-forms/SCHEMA_GUIDE.md`
- Server routes: `apps/server/src/routes/pdf-forms.ts`
- Tests: `packages/pdf-forms/src/__tests__/`
