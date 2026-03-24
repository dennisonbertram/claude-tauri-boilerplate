import { describe, test, expect } from 'bun:test';
import { PDFDocument } from 'pdf-lib';
import { PdfLibReader } from '../pdf/reader';
import { PdfLibFiller } from '../pdf/filler';
import { PdfLibVerifier, verifyFilledPdf } from '../pdf/verifier';
import { checkCompatibility } from '../pdf/compatibility';
import type { FormSchema } from '../types';
import { FieldType } from '../types';

// ---------------------------------------------------------------------------
// Helper: create a simple test form PDF with text, checkbox, dropdown fields
// ---------------------------------------------------------------------------
async function createTestFormPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 400]);
  const form = doc.getForm();

  // Text fields
  const nameField = form.createTextField('name');
  nameField.addToPage(page, { x: 50, y: 300, width: 200, height: 20 });

  const ssnField = form.createTextField('ssn');
  ssnField.addToPage(page, { x: 50, y: 260, width: 200, height: 20 });

  // Checkbox
  const checkbox = form.createCheckBox('agree');
  checkbox.addToPage(page, { x: 50, y: 220, width: 15, height: 15 });

  // Dropdown
  const dropdown = form.createDropdown('status');
  dropdown.addOptions(['Single', 'Married', 'Head of Household']);
  dropdown.addToPage(page, { x: 50, y: 180, width: 200, height: 20 });

  const bytes = await doc.save();
  return new Uint8Array(bytes);
}

// ---------------------------------------------------------------------------
// Helper: create a matching FormSchema for the test PDF
// ---------------------------------------------------------------------------
function createTestSchema(): FormSchema {
  return {
    formCode: 'TEST-1',
    taxYear: 2024,
    irsRevision: '2024-01',
    name: 'Test Form',
    fields: [
      {
        id: 'name',
        pdfFieldName: 'name',
        label: 'Full Name',
        type: FieldType.Text,
        required: true,
      },
      {
        id: 'ssn',
        pdfFieldName: 'ssn',
        label: 'SSN',
        type: FieldType.SSN,
      },
      {
        id: 'agree',
        pdfFieldName: 'agree',
        label: 'I Agree',
        type: FieldType.Checkbox,
      },
      {
        id: 'status',
        pdfFieldName: 'status',
        label: 'Filing Status',
        type: FieldType.Dropdown,
        allowedValues: ['Single', 'Married', 'Head of Household'],
      },
    ],
  };
}

// ===========================================================================
// Reader Tests
// ===========================================================================
describe('PdfLibReader', () => {
  test('extracts all field names and types from test PDF', async () => {
    const pdfBytes = await createTestFormPdf();
    const reader = new PdfLibReader();
    const fields = await reader.extractFields(pdfBytes);

    expect(fields).toHaveLength(4);

    const byName = Object.fromEntries(fields.map((f) => [f.name, f]));
    expect(byName['name'].type).toBe('text');
    expect(byName['ssn'].type).toBe('text');
    expect(byName['agree'].type).toBe('checkbox');
    expect(byName['status'].type).toBe('dropdown');
  });

  test('returns dropdown options', async () => {
    const pdfBytes = await createTestFormPdf();
    const reader = new PdfLibReader();
    const fields = await reader.extractFields(pdfBytes);

    const statusField = fields.find((f) => f.name === 'status');
    expect(statusField?.options).toEqual([
      'Single',
      'Married',
      'Head of Household',
    ]);
  });
});

// ===========================================================================
// Filler Tests
// ===========================================================================
describe('PdfLibFiller', () => {
  test('fills text, checkbox, and dropdown fields', async () => {
    const templateBytes = await createTestFormPdf();
    const filler = new PdfLibFiller();

    const { pdfBytes, errors } = await filler.fill(templateBytes, {
      name: 'John Doe',
      ssn: '123-45-6789',
      agree: true,
      status: 'Married',
    });

    expect(errors).toHaveLength(0);
    expect(pdfBytes.byteLength).toBeGreaterThan(0);
    // Filled PDF should be different from template
    expect(pdfBytes.byteLength).not.toBe(templateBytes.byteLength);
  });

  test('collects errors for nonexistent fields without stopping', async () => {
    const templateBytes = await createTestFormPdf();
    const filler = new PdfLibFiller();

    const { pdfBytes, errors } = await filler.fill(templateBytes, {
      name: 'Jane Doe',
      nonexistent_field: 'value',
      ssn: '999-99-9999',
    });

    // Should have filled the valid fields and collected one error
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('FIELD_NOT_FOUND');
    expect(errors[0].fieldId).toBe('nonexistent_field');
    // PDF should still be returned with the valid fields filled
    expect(pdfBytes.byteLength).toBeGreaterThan(0);
  });

  test('unchecks checkbox when value is false', async () => {
    const templateBytes = await createTestFormPdf();
    const filler = new PdfLibFiller();
    const verifier = new PdfLibVerifier();

    // First check it
    const { pdfBytes: checked } = await filler.fill(templateBytes, {
      agree: true,
    });
    const checkedValues = await verifier.readFieldValues(checked);
    expect(checkedValues['agree']).toBe(true);

    // Then uncheck it
    const { pdfBytes: unchecked } = await filler.fill(checked, {
      agree: false,
    });
    const uncheckedValues = await verifier.readFieldValues(unchecked);
    expect(uncheckedValues['agree']).toBe(false);
  });
});

// ===========================================================================
// Verifier Tests
// ===========================================================================
describe('PdfLibVerifier', () => {
  test('reads back filled field values correctly', async () => {
    const templateBytes = await createTestFormPdf();
    const filler = new PdfLibFiller();
    const verifier = new PdfLibVerifier();

    const { pdfBytes } = await filler.fill(templateBytes, {
      name: 'Alice Smith',
      ssn: '555-55-5555',
      agree: true,
      status: 'Single',
    });

    const values = await verifier.readFieldValues(pdfBytes);
    expect(values['name']).toBe('Alice Smith');
    expect(values['ssn']).toBe('555-55-5555');
    expect(values['agree']).toBe(true);
    expect(values['status']).toBe('Single');
  });

  test('returns null for unfilled fields', async () => {
    const templateBytes = await createTestFormPdf();
    const verifier = new PdfLibVerifier();

    const values = await verifier.readFieldValues(templateBytes);
    expect(values['name']).toBeNull();
    expect(values['ssn']).toBeNull();
    expect(values['agree']).toBe(false); // checkbox defaults to unchecked
    expect(values['status']).toBeNull();
  });
});

// ===========================================================================
// verifyFilledPdf Tests
// ===========================================================================
describe('verifyFilledPdf', () => {
  test('passes when all values match', async () => {
    const templateBytes = await createTestFormPdf();
    const filler = new PdfLibFiller();
    const schema = createTestSchema();

    const fieldValues = {
      name: 'Bob Jones',
      ssn: '111-22-3333',
      agree: true,
      status: 'Single',
    };

    const { pdfBytes } = await filler.fill(
      templateBytes,
      fieldValues as Record<string, string | boolean>,
    );

    const report = await verifyFilledPdf(
      pdfBytes,
      fieldValues as Record<string, string | boolean>,
      schema,
    );

    expect(report.passed).toBe(true);
    expect(report.mismatches).toHaveLength(0);
    expect(report.verifiedCount).toBe(4);
    expect(report.fieldCount).toBe(4);
  });

  test('reports mismatches for wrong expected values', async () => {
    const templateBytes = await createTestFormPdf();
    const filler = new PdfLibFiller();
    const schema = createTestSchema();

    const { pdfBytes } = await filler.fill(templateBytes, {
      name: 'Actual Name',
      ssn: '111-22-3333',
    });

    const report = await verifyFilledPdf(
      pdfBytes,
      { name: 'Wrong Name', ssn: '111-22-3333' },
      schema,
    );

    expect(report.passed).toBe(false);
    expect(report.mismatches).toHaveLength(1);
    expect(report.mismatches[0].fieldId).toBe('name');
    expect(report.mismatches[0].expected).toBe('Wrong Name');
    expect(report.mismatches[0].actual).toBe('Actual Name');
    expect(report.verifiedCount).toBe(1);
  });
});

// ===========================================================================
// Compatibility Tests
// ===========================================================================
describe('checkCompatibility', () => {
  test('passes when PDF contains all schema fields', async () => {
    const pdfBytes = await createTestFormPdf();
    const schema = createTestSchema();
    const reader = new PdfLibReader();

    const errors = await checkCompatibility(pdfBytes, schema, reader);
    expect(errors).toHaveLength(0);
  });

  test('reports MISSING_FIELD when schema expects a field not in PDF', async () => {
    const pdfBytes = await createTestFormPdf();
    const reader = new PdfLibReader();

    const schema: FormSchema = {
      formCode: 'TEST-2',
      taxYear: 2024,
      irsRevision: '2024-01',
      name: 'Extended Test',
      fields: [
        {
          id: 'name',
          pdfFieldName: 'name',
          label: 'Name',
          type: FieldType.Text,
        },
        {
          id: 'address',
          pdfFieldName: 'address',
          label: 'Address',
          type: FieldType.Text,
        },
        {
          id: 'income',
          pdfFieldName: 'total_income',
          label: 'Total Income',
          type: FieldType.Currency,
        },
      ],
    };

    const errors = await checkCompatibility(pdfBytes, schema, reader);
    expect(errors).toHaveLength(2);

    const missingIds = errors.map((e) => e.fieldId);
    expect(missingIds).toContain('address');
    expect(missingIds).toContain('income');

    for (const error of errors) {
      expect(error.type).toBe('compatibility');
      expect(error.code).toBe('MISSING_FIELD');
    }
  });
});

// ===========================================================================
// Round-Trip Determinism Test
// ===========================================================================
describe('Round-trip', () => {
  test('fill → read back produces identical values', async () => {
    const templateBytes = await createTestFormPdf();
    const filler = new PdfLibFiller();
    const verifier = new PdfLibVerifier();

    const input: Record<string, string | boolean> = {
      name: 'Determinism Test',
      ssn: '000-00-0000',
      agree: true,
      status: 'Head of Household',
    };

    const { pdfBytes } = await filler.fill(templateBytes, input);
    const readBack = await verifier.readFieldValues(pdfBytes);

    expect(readBack['name']).toBe(input['name']);
    expect(readBack['ssn']).toBe(input['ssn']);
    expect(readBack['agree']).toBe(input['agree']);
    expect(readBack['status']).toBe(input['status']);
  });
});

// ===========================================================================
// Flatten Test
// ===========================================================================
describe('Flatten', () => {
  test('flattened PDF has no editable form fields', async () => {
    const templateBytes = await createTestFormPdf();
    const filler = new PdfLibFiller();

    const { pdfBytes, errors } = await filler.fill(
      templateBytes,
      { name: 'Flatten Test', agree: true },
      { flatten: true },
    );

    expect(errors).toHaveLength(0);

    // Re-load the flattened PDF — form.getFields() should return empty
    const doc = await PDFDocument.load(pdfBytes);
    const form = doc.getForm();
    const fields = form.getFields();
    expect(fields).toHaveLength(0);
  });
});
