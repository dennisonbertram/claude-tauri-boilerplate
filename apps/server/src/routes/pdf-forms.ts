import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import {
  globalRegistry,
  FormSchemaRegistry,
  PdfLibReader,
  PdfLibFiller,
  verifyFilledPdf,
  validateFormData,
  calculateFields,
  fillTaxForm,
  analyzeFormTemplate,
  classifyField,
  generateSchemaSource,
} from '@claude-tauri/pdf-forms';

export function createPdfFormsRouter(db: Database) {
  const router = new Hono();

  // GET /schemas — list available form schemas
  router.get('/schemas', (c) => {
    const schemas = globalRegistry.list().map((s) => ({
      formCode: s.formCode,
      taxYear: s.taxYear,
      name: s.name,
      fieldCount: s.fields.length,
    }));
    return c.json({ schemas });
  });

  // GET /schemas/:formId — get specific schema details
  router.get('/schemas/:formId', (c) => {
    const formId = c.req.param('formId');
    const parts = formId.split('-');
    const lastPart = parts[parts.length - 1];
    const hasYear = /^\d{4}$/.test(lastPart);

    let schema;
    if (hasYear) {
      const formCode = parts.slice(0, -1).join('-');
      const taxYear = parseInt(lastPart, 10);
      schema = globalRegistry.get(formCode, taxYear);
    } else {
      schema = globalRegistry.getLatest(formId);
    }

    if (!schema) {
      return c.json({ error: `Schema not found: ${formId}`, code: 'NOT_FOUND' }, 404);
    }
    return c.json({ schema });
  });

  // POST /analyze — upload PDF, extract field metadata with suggestions
  router.post('/analyze', async (c) => {
    try {
      const body = await c.req.parseBody();
      const file = body['file'];
      if (!file || typeof file === 'string') {
        return c.json({ error: 'No PDF file provided. Send as multipart with field name "file".', code: 'VALIDATION_ERROR' }, 400);
      }

      const pdfBytes = new Uint8Array(await file.arrayBuffer());
      const analysis = await analyzeFormTemplate(pdfBytes);
      return c.json({ fieldCount: analysis.fields.length, fields: analysis.fields });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: `Failed to analyze PDF: ${message}`, code: 'INTERNAL_ERROR' }, 500);
    }
  });

  // POST /fill — validate + calculate + fill a form
  router.post('/fill', async (c) => {
    try {
      const contentType = c.req.header('content-type') || '';
      let formId: string | undefined;
      let taxYear: number | undefined;
      let templatePdfBytes: Uint8Array | undefined;
      let data: Record<string, any> = {};
      let options: { flatten?: boolean; skipVerification?: boolean; strictValidation?: boolean } = {};

      if (contentType.includes('multipart/form-data')) {
        const body = await c.req.parseBody();
        const file = body['file'];
        if (!file || typeof file === 'string') {
          return c.json({ error: 'No PDF file provided.', code: 'VALIDATION_ERROR' }, 400);
        }
        templatePdfBytes = new Uint8Array(await file.arrayBuffer());

        const dataStr = body['data'];
        if (typeof dataStr !== 'string') {
          return c.json({ error: 'Missing "data" field with JSON payload.', code: 'VALIDATION_ERROR' }, 400);
        }
        const parsed = JSON.parse(dataStr);
        formId = parsed.formId;
        taxYear = parsed.taxYear;
        data = parsed.data || {};
        options = parsed.options || {};
      } else {
        const bodyRaw = await c.req.json();
        formId = bodyRaw.formId;
        taxYear = bodyRaw.taxYear;
        data = bodyRaw.data || {};
        options = bodyRaw.options || {};
        if (bodyRaw.templatePdfBase64) {
          templatePdfBytes = new Uint8Array(Buffer.from(bodyRaw.templatePdfBase64, 'base64'));
        }
      }

      if (!formId) {
        return c.json({ error: 'formId is required.', code: 'VALIDATION_ERROR' }, 400);
      }
      if (!templatePdfBytes) {
        return c.json({ error: 'No template PDF provided.', code: 'VALIDATION_ERROR' }, 400);
      }

      const result = await fillTaxForm({
        formId,
        taxYear: taxYear || new Date().getFullYear(),
        templatePdf: templatePdfBytes,
        data,
        options,
        registry: globalRegistry,
      });

      return c.json({
        success: result.success,
        pdfBase64: Buffer.from(result.pdfBytes).toString('base64'),
        errors: result.errors,
        calculationLog: result.calculationLog,
        verification: result.verificationReport,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: `Failed to fill form: ${message}`, code: 'INTERNAL_ERROR' }, 500);
    }
  });

  // POST /verify — verify a previously filled form
  router.post('/verify', async (c) => {
    try {
      const contentType = c.req.header('content-type') || '';
      let filledPdfBytes: Uint8Array | undefined;
      let expectedValues: Record<string, string | boolean> = {};
      let formId: string | undefined;
      let taxYear: number | undefined;

      if (contentType.includes('multipart/form-data')) {
        const body = await c.req.parseBody();
        const file = body['file'];
        if (!file || typeof file === 'string') {
          return c.json({ error: 'No PDF file provided.', code: 'VALIDATION_ERROR' }, 400);
        }
        filledPdfBytes = new Uint8Array(await file.arrayBuffer());
        const dataStr = body['data'];
        if (typeof dataStr === 'string') {
          const parsed = JSON.parse(dataStr);
          expectedValues = parsed.expectedValues || {};
          formId = parsed.formId;
          taxYear = parsed.taxYear;
        }
      } else {
        const bodyRaw = await c.req.json();
        formId = bodyRaw.formId;
        taxYear = bodyRaw.taxYear;
        expectedValues = bodyRaw.expectedValues || {};
        if (bodyRaw.filledPdfBase64) {
          filledPdfBytes = new Uint8Array(Buffer.from(bodyRaw.filledPdfBase64, 'base64'));
        }
      }

      if (!filledPdfBytes) return c.json({ error: 'No filled PDF provided.', code: 'VALIDATION_ERROR' }, 400);
      if (!formId) return c.json({ error: 'formId is required.', code: 'VALIDATION_ERROR' }, 400);

      const schema = taxYear ? globalRegistry.get(formId, taxYear) : globalRegistry.getLatest(formId);
      if (!schema) return c.json({ error: `Schema not found: ${formId}`, code: 'NOT_FOUND' }, 404);

      const report = await verifyFilledPdf(filledPdfBytes, expectedValues, schema);
      return c.json({ verification: report });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: `Verification failed: ${message}`, code: 'INTERNAL_ERROR' }, 500);
    }
  });

  // POST /builder/start — upload PDF, get analyzed fields for schema building
  router.post('/builder/start', async (c) => {
    try {
      const body = await c.req.parseBody();
      const file = body['file'];
      if (!file || typeof file === 'string') {
        return c.json({ error: 'No PDF file provided.', code: 'VALIDATION_ERROR' }, 400);
      }
      const pdfBytes = new Uint8Array(await file.arrayBuffer());
      const analysis = await analyzeFormTemplate(pdfBytes);
      return c.json(analysis);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: `Failed to analyze PDF: ${message}`, code: 'INTERNAL_ERROR' }, 500);
    }
  });

  // POST /builder/export — submit field mappings, get schema TypeScript source
  router.post('/builder/export', async (c) => {
    try {
      const bodyRaw = await c.req.json();
      if (!bodyRaw.formCode || !bodyRaw.taxYear || !bodyRaw.name || !bodyRaw.fields) {
        return c.json({ error: 'Required: formCode, taxYear, name, fields.', code: 'VALIDATION_ERROR' }, 400);
      }
      const source = generateSchemaSource(bodyRaw);
      return c.json({ source });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: `Failed to generate schema: ${message}`, code: 'INTERNAL_ERROR' }, 500);
    }
  });

  return router;
}
