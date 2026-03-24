import type { CompatibilityError, FormSchema } from '../types';
import type { PdfReader } from './interfaces';

/**
 * Validates that an uploaded PDF template matches the expected form schema.
 * Checks that all required schema fields exist in the PDF's AcroForm.
 *
 * Extra fields in the PDF are acceptable (they just won't be filled).
 * Missing fields are reported as MISSING_FIELD errors.
 */
export async function checkCompatibility(
  pdfBytes: Uint8Array,
  schema: FormSchema,
  reader: PdfReader,
): Promise<CompatibilityError[]> {
  const errors: CompatibilityError[] = [];
  const pdfFields = await reader.extractFields(pdfBytes);
  const pdfFieldNames = new Set(pdfFields.map((f) => f.name));

  for (const field of schema.fields) {
    // Skip fields without a pdfFieldName (e.g., calculated-only fields)
    if (!field.pdfFieldName) continue;

    if (!pdfFieldNames.has(field.pdfFieldName)) {
      errors.push({
        type: 'compatibility',
        fieldId: field.id,
        message: `PDF is missing expected field: ${field.pdfFieldName}`,
        code: 'MISSING_FIELD',
      });
    }
  }

  return errors;
}
