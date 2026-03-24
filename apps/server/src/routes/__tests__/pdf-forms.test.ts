import { describe, test, expect, beforeAll } from 'bun:test';
import { Hono } from 'hono';
import { PDFDocument } from 'pdf-lib';
import { createPdfFormsRouter } from '../pdf-forms';
import { errorHandler } from '../../middleware/error-handler';

// ─── Test app setup ─────────────────────────────────────────────────────────

let app: Hono;

beforeAll(() => {
  app = new Hono();
  app.onError(errorHandler);
  // pdf-forms routes are stateless — db is unused, pass null
  app.route('/api/pdf-forms', createPdfFormsRouter(null as any));
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Create a minimal PDF with AcroForm text + checkbox fields for testing.
 */
async function createTestPdf(fields?: { texts?: string[]; checkboxes?: string[] }) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 400]);
  const form = doc.getForm();

  const texts = fields?.texts ?? ['name', 'address'];
  const checkboxes = fields?.checkboxes ?? ['agree'];

  let y = 350;
  for (const name of texts) {
    const tf = form.createTextField(name);
    tf.addToPage(page, { x: 50, y, width: 200, height: 20 });
    y -= 30;
  }
  for (const name of checkboxes) {
    const cb = form.createCheckBox(name);
    cb.addToPage(page, { x: 50, y, width: 15, height: 15 });
    y -= 30;
  }

  return await doc.save();
}

/**
 * Create a PDF that mimics the W-9 field names so the fill pipeline
 * can map schema fields to actual PDF fields.
 */
async function createW9LikePdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const form = doc.getForm();

  // Must match the pdfFieldName values from the W-9 schema
  const textFields = [
    'topmostSubform[0].Page1[0].f1_1[0]',  // name
    'topmostSubform[0].Page1[0].f1_2[0]',  // business_name
    'topmostSubform[0].Page1[0].f1_3[0]',  // llc_classification
    'topmostSubform[0].Page1[0].f1_4[0]',  // other_description
    'topmostSubform[0].Page1[0].f1_5[0]',  // exempt_payee_code
    'topmostSubform[0].Page1[0].f1_6[0]',  // fatca_exemption_code
    'topmostSubform[0].Page1[0].f1_7[0]',  // address
    'topmostSubform[0].Page1[0].f1_8[0]',  // city_state_zip
    'topmostSubform[0].Page1[0].f1_9[0]',  // account_numbers
    'topmostSubform[0].Page1[0].f1_10[0]', // requester_name
    'topmostSubform[0].Page1[0].f1_11[0]', // ssn
    'topmostSubform[0].Page1[0].f1_12[0]', // ein
    'topmostSubform[0].Page1[0].f1_13[0]', // signature_date
  ];

  const checkboxFields = [
    'topmostSubform[0].Page1[0].c1_1[0]',  // tax_class_individual
    'topmostSubform[0].Page1[0].c1_2[0]',  // tax_class_c_corp
    'topmostSubform[0].Page1[0].c1_3[0]',  // tax_class_s_corp
    'topmostSubform[0].Page1[0].c1_4[0]',  // tax_class_partnership
    'topmostSubform[0].Page1[0].c1_5[0]',  // tax_class_trust_estate
    'topmostSubform[0].Page1[0].c1_6[0]',  // tax_class_llc
    'topmostSubform[0].Page1[0].c1_7[0]',  // tax_class_other
    'topmostSubform[0].Page1[0].c1_8[0]',  // certification
  ];

  let y = 750;
  for (const name of textFields) {
    const tf = form.createTextField(name);
    tf.addToPage(page, { x: 50, y, width: 200, height: 18 });
    y -= 25;
  }
  for (const name of checkboxFields) {
    const cb = form.createCheckBox(name);
    cb.addToPage(page, { x: 50, y, width: 14, height: 14 });
    y -= 20;
  }

  return await doc.save();
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

// ─── GET /api/pdf-forms/schemas ─────────────────────────────────────────────

describe('GET /api/pdf-forms/schemas', () => {
  test('returns 200 with schemas array', async () => {
    const res = await app.request('/api/pdf-forms/schemas');
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.schemas).toBeDefined();
    expect(Array.isArray(body.schemas)).toBe(true);
    expect(body.schemas.length).toBeGreaterThanOrEqual(1);
  });

  test('contains W-9 with correct fieldCount', async () => {
    const res = await app.request('/api/pdf-forms/schemas');
    const body = (await res.json()) as any;

    const w9 = body.schemas.find((s: any) => s.formCode === 'W-9');
    expect(w9).toBeDefined();
    expect(w9.name).toBe('Request for Taxpayer Identification Number and Certification');
    expect(w9.fieldCount).toBeGreaterThan(0);
    expect(w9.taxYear).toBe(2024);
  });

  test('response shape matches expected structure', async () => {
    const res = await app.request('/api/pdf-forms/schemas');
    const body = (await res.json()) as any;

    for (const schema of body.schemas) {
      expect(typeof schema.formCode).toBe('string');
      expect(typeof schema.taxYear).toBe('number');
      expect(typeof schema.name).toBe('string');
      expect(typeof schema.fieldCount).toBe('number');
    }
  });
});

// ─── GET /api/pdf-forms/schemas/:formId ─────────────────────────────────────

describe('GET /api/pdf-forms/schemas/:formId', () => {
  test('W-9 returns the schema with latest year', async () => {
    const res = await app.request('/api/pdf-forms/schemas/W-9');
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.schema).toBeDefined();
    expect(body.schema.formCode).toBe('W-9');
    expect(body.schema.taxYear).toBe(2024);
    expect(Array.isArray(body.schema.fields)).toBe(true);
    expect(body.schema.fields.length).toBeGreaterThan(0);
  });

  test('W-9-2024 returns the specific year schema', async () => {
    const res = await app.request('/api/pdf-forms/schemas/W-9-2024');
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.schema).toBeDefined();
    expect(body.schema.formCode).toBe('W-9');
    expect(body.schema.taxYear).toBe(2024);
  });

  test('nonexistent returns 404', async () => {
    const res = await app.request('/api/pdf-forms/schemas/NONEXISTENT');
    expect(res.status).toBe(404);

    const body = (await res.json()) as any;
    expect(body.error).toContain('Schema not found');
    expect(body.code).toBe('NOT_FOUND');
  });

  test('schema has correct field definitions', async () => {
    const res = await app.request('/api/pdf-forms/schemas/W-9');
    const body = (await res.json()) as any;

    const nameField = body.schema.fields.find((f: any) => f.id === 'name');
    expect(nameField).toBeDefined();
    expect(nameField.type).toBe('text');
    expect(nameField.required).toBe(true);
    expect(typeof nameField.pdfFieldName).toBe('string');

    const ssnField = body.schema.fields.find((f: any) => f.id === 'ssn');
    expect(ssnField).toBeDefined();
    expect(ssnField.type).toBe('ssn');
  });
});

// ─── POST /api/pdf-forms/analyze ────────────────────────────────────────────

describe('POST /api/pdf-forms/analyze', () => {
  test('upload a test PDF returns field list with types', async () => {
    const pdfBytes = await createTestPdf();
    const formData = new FormData();
    formData.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), 'test.pdf');

    const res = await app.request('/api/pdf-forms/analyze', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.fieldCount).toBeGreaterThan(0);
    expect(Array.isArray(body.fields)).toBe(true);

    // Should have our text + checkbox fields
    const names = body.fields.map((f: any) => f.name);
    expect(names).toContain('name');
    expect(names).toContain('address');
    expect(names).toContain('agree');

    // Each field should have a suggestion
    for (const field of body.fields) {
      expect(field.suggestion).toBeDefined();
      expect(field.suggestion.suggestedId).toBeDefined();
      expect(field.suggestion.suggestedType).toBeDefined();
      expect(field.suggestion.confidence).toBeDefined();
    }
  });

  test('no file returns 400', async () => {
    const formData = new FormData();
    formData.append('other', 'value');

    const res = await app.request('/api/pdf-forms/analyze', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(400);

    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.error).toContain('No PDF file');
  });
});

// ─── POST /api/pdf-forms/fill (JSON body) ───────────────────────────────────

describe('POST /api/pdf-forms/fill', () => {
  test('valid fill with base64 PDF returns success with pdfBase64', async () => {
    const pdfBytes = await createW9LikePdf();
    const base64 = toBase64(pdfBytes);

    const res = await app.request('/api/pdf-forms/fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formId: 'W-9',
        taxYear: 2024,
        templatePdfBase64: base64,
        data: {
          name: 'John Doe',
          address: '123 Main St',
          city_state_zip: 'Springfield, IL 62701',
          ssn: '123-45-6789',
          tax_class_individual: true,
        },
        options: { skipVerification: true },
      }),
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.pdfBase64).toBeDefined();
    expect(typeof body.pdfBase64).toBe('string');
    expect(body.pdfBase64.length).toBeGreaterThan(100);
  });

  test('missing formId returns 400', async () => {
    const pdfBytes = await createW9LikePdf();
    const base64 = toBase64(pdfBytes);

    const res = await app.request('/api/pdf-forms/fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templatePdfBase64: base64,
        data: { name: 'John' },
      }),
    });

    expect(res.status).toBe(400);

    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.error).toContain('formId');
  });

  test('missing PDF returns 400', async () => {
    const res = await app.request('/api/pdf-forms/fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formId: 'W-9',
        data: { name: 'John' },
      }),
    });

    expect(res.status).toBe(400);

    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.error).toContain('template PDF');
  });

  test('unknown formId returns error in result', async () => {
    const pdfBytes = await createTestPdf();
    const base64 = toBase64(pdfBytes);

    const res = await app.request('/api/pdf-forms/fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formId: 'NONEXISTENT',
        taxYear: 2024,
        templatePdfBase64: base64,
        data: {},
      }),
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.errors).toBeDefined();
    expect(body.errors.length).toBeGreaterThan(0);
    expect(body.errors[0].code).toBe('WRONG_FORM');
  });

  test('invalid SSN with strictValidation returns errors', async () => {
    const pdfBytes = await createW9LikePdf();
    const base64 = toBase64(pdfBytes);

    const res = await app.request('/api/pdf-forms/fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formId: 'W-9',
        taxYear: 2024,
        templatePdfBase64: base64,
        data: {
          name: 'John Doe',
          address: '123 Main St',
          city_state_zip: 'Springfield, IL 62701',
          ssn: 'not-a-valid-ssn',
        },
        options: { strictValidation: true },
      }),
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.errors).toBeDefined();
    expect(body.errors.length).toBeGreaterThan(0);
    // Should have a validation error about SSN format
    const ssnError = body.errors.find(
      (e: any) => e.type === 'validation' && e.fieldId === 'ssn',
    );
    expect(ssnError).toBeDefined();
  });

  test('multipart fill with file upload works', async () => {
    const pdfBytes = await createW9LikePdf();
    const formData = new FormData();
    formData.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), 'w9.pdf');
    formData.append(
      'data',
      JSON.stringify({
        formId: 'W-9',
        taxYear: 2024,
        data: {
          name: 'Jane Smith',
          address: '456 Oak Ave',
          city_state_zip: 'Chicago, IL 60601',
        },
        options: { skipVerification: true },
      }),
    );

    const res = await app.request('/api/pdf-forms/fill', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.pdfBase64).toBeDefined();
  });
});

// ─── POST /api/pdf-forms/verify ─────────────────────────────────────────────

describe('POST /api/pdf-forms/verify', () => {
  test('verify a correctly filled PDF passes', async () => {
    // First fill a PDF
    const pdfBytes = await createW9LikePdf();
    const base64 = toBase64(pdfBytes);

    const fillRes = await app.request('/api/pdf-forms/fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formId: 'W-9',
        taxYear: 2024,
        templatePdfBase64: base64,
        data: {
          name: 'John Doe',
          address: '123 Main St',
          city_state_zip: 'Springfield, IL 62701',
        },
        options: { skipVerification: true },
      }),
    });

    const fillBody = (await fillRes.json()) as any;
    expect(fillBody.success).toBe(true);

    // Now verify it
    const verifyRes = await app.request('/api/pdf-forms/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formId: 'W-9',
        taxYear: 2024,
        filledPdfBase64: fillBody.pdfBase64,
        expectedValues: {
          'topmostSubform[0].Page1[0].f1_1[0]': 'John Doe',
          'topmostSubform[0].Page1[0].f1_7[0]': '123 Main St',
        },
      }),
    });

    expect(verifyRes.status).toBe(200);

    const verifyBody = (await verifyRes.json()) as any;
    expect(verifyBody.verification).toBeDefined();
    expect(verifyBody.verification.passed).toBe(true);
    expect(verifyBody.verification.mismatches).toHaveLength(0);
  });

  test('verify with wrong expected values reports mismatches', async () => {
    // Fill a PDF
    const pdfBytes = await createW9LikePdf();
    const base64 = toBase64(pdfBytes);

    const fillRes = await app.request('/api/pdf-forms/fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formId: 'W-9',
        taxYear: 2024,
        templatePdfBase64: base64,
        data: {
          name: 'John Doe',
          address: '123 Main St',
          city_state_zip: 'Springfield, IL 62701',
        },
        options: { skipVerification: true },
      }),
    });

    const fillBody = (await fillRes.json()) as any;

    // Verify with wrong expected name
    const verifyRes = await app.request('/api/pdf-forms/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formId: 'W-9',
        taxYear: 2024,
        filledPdfBase64: fillBody.pdfBase64,
        expectedValues: {
          'topmostSubform[0].Page1[0].f1_1[0]': 'WRONG NAME',
        },
      }),
    });

    expect(verifyRes.status).toBe(200);

    const verifyBody = (await verifyRes.json()) as any;
    expect(verifyBody.verification).toBeDefined();
    expect(verifyBody.verification.passed).toBe(false);
    expect(verifyBody.verification.mismatches.length).toBeGreaterThan(0);
  });

  test('missing PDF returns 400', async () => {
    const res = await app.request('/api/pdf-forms/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formId: 'W-9',
        taxYear: 2024,
        expectedValues: {},
      }),
    });

    expect(res.status).toBe(400);

    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.error).toContain('filled PDF');
  });

  test('missing formId returns 400', async () => {
    const pdfBytes = await createTestPdf();
    const base64 = toBase64(pdfBytes);

    const res = await app.request('/api/pdf-forms/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filledPdfBase64: base64,
        expectedValues: {},
      }),
    });

    expect(res.status).toBe(400);

    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.error).toContain('formId');
  });

  test('unknown formId returns 404', async () => {
    const pdfBytes = await createTestPdf();
    const base64 = toBase64(pdfBytes);

    const res = await app.request('/api/pdf-forms/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formId: 'NONEXISTENT',
        taxYear: 2024,
        filledPdfBase64: base64,
        expectedValues: {},
      }),
    });

    expect(res.status).toBe(404);

    const body = (await res.json()) as any;
    expect(body.code).toBe('NOT_FOUND');
  });
});

// ─── POST /api/pdf-forms/builder/start ──────────────────────────────────────

describe('POST /api/pdf-forms/builder/start', () => {
  test('upload PDF returns fields with suggestions', async () => {
    const pdfBytes = await createTestPdf({
      texts: ['ssn_field', 'amount_total', 'date_signed'],
      checkboxes: ['consent'],
    });
    const formData = new FormData();
    formData.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), 'template.pdf');

    const res = await app.request('/api/pdf-forms/builder/start', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.fields).toBeDefined();
    expect(Array.isArray(body.fields)).toBe(true);
    expect(body.fields.length).toBe(4);

    for (const field of body.fields) {
      expect(field.name).toBeDefined();
      expect(field.type).toBeDefined();
      expect(field.suggestion).toBeDefined();
      expect(field.suggestion.suggestedId).toBeDefined();
      expect(field.suggestion.suggestedType).toBeDefined();
      expect(['high', 'medium', 'low']).toContain(field.suggestion.confidence);
    }
  });

  test('no file returns 400', async () => {
    const formData = new FormData();
    formData.append('other', 'nope');

    const res = await app.request('/api/pdf-forms/builder/start', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(400);

    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

// ─── POST /api/pdf-forms/builder/export ─────────────────────────────────────

describe('POST /api/pdf-forms/builder/export', () => {
  test('valid config returns TypeScript source string', async () => {
    const res = await app.request('/api/pdf-forms/builder/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formCode: 'W-4',
        taxYear: 2025,
        irsRevision: 'Rev. December 2024',
        name: "Employee's Withholding Certificate",
        fields: [
          {
            pdfFieldName: 'f1_1',
            id: 'first_name',
            type: 'text',
            label: 'First name',
            required: true,
          },
          {
            pdfFieldName: 'f1_2',
            id: 'last_name',
            type: 'text',
            label: 'Last name',
            required: true,
          },
          {
            pdfFieldName: 'f1_3',
            id: 'ssn',
            type: 'ssn',
            label: 'Social security number',
            required: true,
          },
        ],
      }),
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.source).toBeDefined();
    expect(typeof body.source).toBe('string');
    expect(body.source).toContain('FormSchema');
    expect(body.source).toContain('FieldType');
    expect(body.source).toContain('W-4');
    expect(body.source).toContain('first_name');
    expect(body.source).toContain('last_name');
  });

  test('missing required fields returns 400', async () => {
    const res = await app.request('/api/pdf-forms/builder/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formCode: 'W-4',
        // missing taxYear, name, fields
      }),
    });

    expect(res.status).toBe(400);

    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.error).toContain('Required');
  });

  test('missing formCode returns 400', async () => {
    const res = await app.request('/api/pdf-forms/builder/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taxYear: 2025,
        name: 'Test Form',
        fields: [],
      }),
    });

    expect(res.status).toBe(400);

    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});
