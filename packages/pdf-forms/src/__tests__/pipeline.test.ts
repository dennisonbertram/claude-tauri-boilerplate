import { describe, test, expect } from 'bun:test';
import { PDFDocument } from 'pdf-lib';
import { fillTaxForm, getSchemaInfo } from '../pipeline';
import { FormSchemaRegistry } from '../types/schema-types';
import { FieldType } from '../types/field-types';
import type { FormSchema } from '../types/schema-types';
import { classifyField } from '../builder/field-classifier';
import { generateSchemaSource } from '../builder/schema-writer';
import { analyzeFormTemplate } from '../builder';
import { w9_2024 } from '../schemas/w9';
import { globalRegistry } from '../schemas';

// ---------------------------------------------------------------------------
// Helper: create a simple W-9-like test PDF with text fields and a checkbox
// ---------------------------------------------------------------------------
async function createW9LikePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const form = doc.getForm();

  // All W-9 text fields
  const textFields = [
    'topmostSubform[0].Page1[0].f1_1[0]',   // name
    'topmostSubform[0].Page1[0].f1_2[0]',   // business name
    'topmostSubform[0].Page1[0].f1_3[0]',   // LLC classification
    'topmostSubform[0].Page1[0].f1_4[0]',   // other description
    'topmostSubform[0].Page1[0].f1_5[0]',   // exempt payee code
    'topmostSubform[0].Page1[0].f1_6[0]',   // FATCA code
    'topmostSubform[0].Page1[0].f1_7[0]',   // address
    'topmostSubform[0].Page1[0].f1_8[0]',   // city/state/zip
    'topmostSubform[0].Page1[0].f1_9[0]',   // account numbers
    'topmostSubform[0].Page1[0].f1_10[0]',  // requester name
    'topmostSubform[0].Page1[0].f1_11[0]',  // SSN
    'topmostSubform[0].Page1[0].f1_12[0]',  // EIN
    'topmostSubform[0].Page1[0].f1_13[0]',  // signature date
  ];

  let y = 750;
  for (const name of textFields) {
    const tf = form.createTextField(name);
    tf.addToPage(page, { x: 50, y, width: 200, height: 15 });
    y -= 25;
  }

  // All W-9 checkboxes
  const checkboxFields = [
    'topmostSubform[0].Page1[0].c1_1[0]',   // individual
    'topmostSubform[0].Page1[0].c1_2[0]',   // C corp
    'topmostSubform[0].Page1[0].c1_3[0]',   // S corp
    'topmostSubform[0].Page1[0].c1_4[0]',   // partnership
    'topmostSubform[0].Page1[0].c1_5[0]',   // trust/estate
    'topmostSubform[0].Page1[0].c1_6[0]',   // LLC
    'topmostSubform[0].Page1[0].c1_7[0]',   // other
    'topmostSubform[0].Page1[0].c1_8[0]',   // certification
  ];

  for (const name of checkboxFields) {
    const cb = form.createCheckBox(name);
    cb.addToPage(page, { x: 50, y, width: 15, height: 15 });
    y -= 25;
  }

  const bytes = await doc.save();
  return new Uint8Array(bytes);
}

// ---------------------------------------------------------------------------
// Helper: create a minimal test schema with a calculated field
// ---------------------------------------------------------------------------
function createCalcSchema(): FormSchema {
  return {
    formCode: 'CALC-TEST',
    taxYear: 2024,
    irsRevision: '2024-01',
    name: 'Calculation Test Form',
    fields: [
      {
        id: 'wages',
        pdfFieldName: 'wages_field',
        label: 'Wages',
        type: FieldType.Currency,
        required: true,
      },
      {
        id: 'other_income',
        pdfFieldName: 'other_income_field',
        label: 'Other Income',
        type: FieldType.Currency,
      },
      {
        id: 'total_income',
        pdfFieldName: 'total_income_field',
        label: 'Total Income',
        type: FieldType.Currency,
        calculation: {
          formula: {
            op: 'add',
            operands: [
              { op: 'ref', field: 'wages' },
              { op: 'ref', field: 'other_income' },
            ],
          },
        },
      },
    ],
  };
}

async function createCalcPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 400]);
  const form = doc.getForm();

  const f1 = form.createTextField('wages_field');
  f1.addToPage(page, { x: 50, y: 300, width: 200, height: 20 });

  const f2 = form.createTextField('other_income_field');
  f2.addToPage(page, { x: 50, y: 260, width: 200, height: 20 });

  const f3 = form.createTextField('total_income_field');
  f3.addToPage(page, { x: 50, y: 220, width: 200, height: 20 });

  const bytes = await doc.save();
  return new Uint8Array(bytes);
}

// ---------------------------------------------------------------------------
// Pipeline tests
// ---------------------------------------------------------------------------

describe('fillTaxForm pipeline', () => {
  test('fills W-9 with valid data — success', async () => {
    const pdf = await createW9LikePdf();
    const registry = new FormSchemaRegistry();
    registry.register(w9_2024);

    const result = await fillTaxForm({
      formId: 'W-9',
      taxYear: 2024,
      templatePdf: pdf,
      data: {
        name: 'John Doe',
        business_name: 'Doe LLC',
        tax_class_individual: true,
        address: '123 Main St',
        city_state_zip: 'Springfield, IL 62704',
        ssn: '123-45-6789',
        certification: true,
        signature_date: '03/24/2026',
      },
      options: { skipVerification: false },
      registry,
    });

    expect(result.pdfBytes.length).toBeGreaterThan(0);
    expect(result.success).toBe(true);
    expect(result.verificationReport.passed).toBe(true);
  });

  test('returns validation errors for invalid SSN with strictValidation', async () => {
    // Use a minimal schema that exactly matches our test PDF to avoid compatibility errors
    const minimalSchema: FormSchema = {
      formCode: 'MINI-W9',
      taxYear: 2024,
      irsRevision: '2024-01',
      name: 'Minimal W-9 Test',
      fields: [
        { id: 'name', pdfFieldName: 'topmostSubform[0].Page1[0].f1_1[0]', label: 'Name', type: FieldType.Text, required: true },
        { id: 'address', pdfFieldName: 'topmostSubform[0].Page1[0].f1_7[0]', label: 'Address', type: FieldType.Text, required: true },
        { id: 'city_state_zip', pdfFieldName: 'topmostSubform[0].Page1[0].f1_8[0]', label: 'City', type: FieldType.Text, required: true },
        { id: 'ssn', pdfFieldName: 'topmostSubform[0].Page1[0].f1_11[0]', label: 'SSN', type: FieldType.SSN },
      ],
    };

    const pdf = await createW9LikePdf();
    const registry = new FormSchemaRegistry();
    registry.register(minimalSchema);

    const result = await fillTaxForm({
      formId: 'MINI-W9',
      taxYear: 2024,
      templatePdf: pdf,
      data: {
        name: 'John Doe',
        address: '123 Main St',
        city_state_zip: 'Springfield, IL 62704',
        ssn: 'not-a-ssn',
      },
      options: { strictValidation: true },
      registry,
    });

    expect(result.success).toBe(false);
    expect(result.pdfBytes.length).toBe(0);
    const validationErrors = result.errors.filter((e) => e.type === 'validation');
    expect(validationErrors.length).toBeGreaterThan(0);
  });

  test('fills with invalid data when strictValidation=false — includes errors but produces PDF', async () => {
    // Use a minimal schema that exactly matches our test PDF to avoid compatibility noise
    const minimalSchema: FormSchema = {
      formCode: 'MINI-W9-2',
      taxYear: 2024,
      irsRevision: '2024-01',
      name: 'Minimal W-9 Test 2',
      fields: [
        { id: 'name', pdfFieldName: 'topmostSubform[0].Page1[0].f1_1[0]', label: 'Name', type: FieldType.Text, required: true },
        { id: 'address', pdfFieldName: 'topmostSubform[0].Page1[0].f1_7[0]', label: 'Address', type: FieldType.Text, required: true },
        { id: 'city_state_zip', pdfFieldName: 'topmostSubform[0].Page1[0].f1_8[0]', label: 'City', type: FieldType.Text, required: true },
        { id: 'ssn', pdfFieldName: 'topmostSubform[0].Page1[0].f1_11[0]', label: 'SSN', type: FieldType.SSN },
      ],
    };

    const pdf = await createW9LikePdf();
    const registry = new FormSchemaRegistry();
    registry.register(minimalSchema);

    const result = await fillTaxForm({
      formId: 'MINI-W9-2',
      taxYear: 2024,
      templatePdf: pdf,
      data: {
        name: 'John Doe',
        address: '123 Main St',
        city_state_zip: 'Springfield, IL 62704',
        ssn: 'not-a-ssn',
      },
      options: { strictValidation: false },
      registry,
    });

    // Should still produce a PDF (only name/address/city filled successfully)
    expect(result.pdfBytes.length).toBeGreaterThan(0);
    // Validation errors should be present
    const validationErrors = result.errors.filter((e) => e.type === 'validation');
    expect(validationErrors.length).toBeGreaterThan(0);
  });

  test('calculation integration — computes total_income', async () => {
    const pdf = await createCalcPdf();
    const schema = createCalcSchema();
    const registry = new FormSchemaRegistry();
    registry.register(schema);

    const result = await fillTaxForm({
      formId: 'CALC-TEST',
      taxYear: 2024,
      templatePdf: pdf,
      data: {
        wages: '50000.00',
        other_income: '10000.00',
      },
      options: { skipVerification: false },
      registry,
    });

    expect(result.pdfBytes.length).toBeGreaterThan(0);
    expect(result.calculationLog.length).toBeGreaterThan(0);

    // The total should be wages + other_income in cents: 5000000 + 1000000 = 6000000
    const totalEntry = result.calculationLog.find((e) => e.fieldId === 'total_income');
    expect(totalEntry).toBeDefined();
    expect(totalEntry!.result).toBe(6000000);
  });

  test('compatibility error — wrong schema for PDF', async () => {
    const pdf = await createCalcPdf(); // has wages_field, other_income_field, total_income_field
    const registry = new FormSchemaRegistry();
    registry.register(w9_2024); // W-9 expects topmostSubform fields

    const result = await fillTaxForm({
      formId: 'W-9',
      taxYear: 2024,
      templatePdf: pdf,
      data: { name: 'John Doe', address: '123 Main', city_state_zip: 'X, Y 12345' },
      options: { strictValidation: true },
      registry,
    });

    expect(result.success).toBe(false);
    const compatErrors = result.errors.filter((e) => e.type === 'compatibility');
    expect(compatErrors.length).toBeGreaterThan(0);
  });

  test('returns schema-not-found error for unknown form', async () => {
    const pdf = await createW9LikePdf();
    const registry = new FormSchemaRegistry();

    const result = await fillTaxForm({
      formId: 'UNKNOWN',
      taxYear: 2024,
      templatePdf: pdf,
      data: {},
      registry,
    });

    expect(result.success).toBe(false);
    expect(result.errors[0].code).toBe('WRONG_FORM');
  });
});

// ---------------------------------------------------------------------------
// getSchemaInfo tests
// ---------------------------------------------------------------------------
describe('getSchemaInfo', () => {
  test('returns W-9 schema from registry', () => {
    const schema = getSchemaInfo('W-9', 2024, globalRegistry);
    expect(schema).not.toBeNull();
    expect(schema!.formCode).toBe('W-9');
  });

  test('returns null for unknown form', () => {
    const schema = getSchemaInfo('UNKNOWN', 2024, globalRegistry);
    expect(schema).toBeNull();
  });

  test('returns latest when no year specified', () => {
    const schema = getSchemaInfo('W-9', undefined, globalRegistry);
    expect(schema).not.toBeNull();
    expect(schema!.taxYear).toBe(2024);
  });
});

// ---------------------------------------------------------------------------
// W-9 schema tests
// ---------------------------------------------------------------------------
describe('W-9 schema', () => {
  test('has expected structure', () => {
    expect(w9_2024.formCode).toBe('W-9');
    expect(w9_2024.taxYear).toBe(2024);
    expect(w9_2024.fields.length).toBeGreaterThan(10);
  });

  test('name field is required', () => {
    const nameField = w9_2024.fields.find((f) => f.id === 'name');
    expect(nameField).toBeDefined();
    expect(nameField!.required).toBe(true);
  });

  test('LLC classification has requiredIf rule', () => {
    const llcClass = w9_2024.fields.find((f) => f.id === 'llc_classification');
    expect(llcClass).toBeDefined();
    expect(llcClass!.requiredIf).toBeDefined();
    expect(llcClass!.requiredIf!.field).toBe('tax_class_llc');
  });
});

// ---------------------------------------------------------------------------
// Field classifier tests
// ---------------------------------------------------------------------------
describe('classifyField', () => {
  test('SSN pattern — high confidence', () => {
    const result = classifyField('social_security_number', 'text');
    expect(result.suggestedType).toBe(FieldType.SSN);
    expect(result.confidence).toBe('high');
  });

  test('EIN pattern — high confidence', () => {
    const result = classifyField('employer_id_number', 'text');
    expect(result.suggestedType).toBe(FieldType.EIN);
    expect(result.confidence).toBe('high');
  });

  test('checkbox PDF type — high confidence', () => {
    const result = classifyField('some_field', 'checkbox');
    expect(result.suggestedType).toBe(FieldType.Checkbox);
    expect(result.confidence).toBe('high');
  });

  test('amount pattern — currency, medium confidence', () => {
    const result = classifyField('total_amount', 'text');
    expect(result.suggestedType).toBe(FieldType.Currency);
    expect(result.confidence).toBe('medium');
  });

  test('zip pattern — high confidence', () => {
    const result = classifyField('mailing_zip', 'text');
    expect(result.suggestedType).toBe(FieldType.ZipCode);
    expect(result.confidence).toBe('high');
  });

  test('unknown field — text, low confidence', () => {
    const result = classifyField('f1_99', 'text');
    expect(result.suggestedType).toBe(FieldType.Text);
    expect(result.confidence).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// Schema writer tests
// ---------------------------------------------------------------------------
describe('generateSchemaSource', () => {
  test('generates valid TypeScript string', () => {
    const source = generateSchemaSource({
      formCode: 'W-2',
      taxYear: 2024,
      irsRevision: '2024-01',
      name: 'Wage and Tax Statement',
      fields: [
        {
          pdfFieldName: 'f_wages',
          id: 'wages',
          type: FieldType.Currency,
          label: 'Wages, tips, other compensation',
          required: true,
        },
        {
          pdfFieldName: 'f_ssn',
          id: 'ssn',
          type: FieldType.SSN,
          label: "Employee's SSN",
          required: true,
        },
      ],
    });

    expect(source).toContain('export const w_2_2024');
    expect(source).toContain("formCode: \"W-2\"");
    expect(source).toContain('FieldType.Currency');
    expect(source).toContain('FieldType.SSN');
    expect(source).toContain('required: true');
    expect(source).toContain("import { FieldType }");
  });
});

// ---------------------------------------------------------------------------
// analyzeFormTemplate tests
// ---------------------------------------------------------------------------
describe('analyzeFormTemplate', () => {
  test('extracts fields with suggestions from a PDF', async () => {
    const pdf = await createW9LikePdf();
    const result = await analyzeFormTemplate(pdf);

    expect(result.fields.length).toBeGreaterThan(0);

    // Every field should have a suggestion
    for (const field of result.fields) {
      expect(field.suggestion).toBeDefined();
      expect(field.suggestion.suggestedId).toBeTruthy();
      expect(field.suggestion.suggestedType).toBeTruthy();
      expect(field.suggestion.confidence).toBeTruthy();
    }

    // The checkbox fields should be classified as Checkbox
    const checkboxFields = result.fields.filter((f) => f.type === 'checkbox');
    expect(checkboxFields.length).toBeGreaterThan(0);
    for (const cb of checkboxFields) {
      expect(cb.suggestion.suggestedType).toBe(FieldType.Checkbox);
    }
  });
});
