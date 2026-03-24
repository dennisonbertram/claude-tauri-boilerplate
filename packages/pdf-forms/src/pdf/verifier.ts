import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
} from 'pdf-lib';
import type {
  FieldMismatch,
  FormSchema,
  VerificationReport,
} from '../types';
import type { PdfVerifier } from './interfaces';

/**
 * pdf-lib implementation of PdfVerifier.
 * Reads back field values from a filled PDF for verification.
 */
export class PdfLibVerifier implements PdfVerifier {
  async readFieldValues(
    pdfBytes: Uint8Array,
  ): Promise<Record<string, string | boolean | null>> {
    const doc = await PDFDocument.load(pdfBytes);
    const form = doc.getForm();
    const fields = form.getFields();
    const result: Record<string, string | boolean | null> = {};

    for (const field of fields) {
      const name = field.getName();

      if (field instanceof PDFTextField) {
        result[name] = form.getTextField(name).getText() ?? null;
      } else if (field instanceof PDFCheckBox) {
        result[name] = form.getCheckBox(name).isChecked();
      } else if (field instanceof PDFRadioGroup) {
        result[name] = form.getRadioGroup(name).getSelected() ?? null;
      } else if (field instanceof PDFDropdown) {
        const selected = form.getDropdown(name).getSelected();
        result[name] = selected.length > 0 ? selected[0] : null;
      } else {
        result[name] = null;
      }
    }

    return result;
  }
}

/**
 * Verifies a filled PDF against expected values using a form schema.
 * Compares each field's actual value to the expected value and reports mismatches.
 */
export async function verifyFilledPdf(
  filledPdfBytes: Uint8Array,
  expectedValues: Record<string, string | boolean>,
  schema: FormSchema,
): Promise<VerificationReport> {
  const verifier = new PdfLibVerifier();
  const actualValues = await verifier.readFieldValues(filledPdfBytes);

  const mismatches: FieldMismatch[] = [];
  let verifiedCount = 0;

  for (const field of schema.fields) {
    const expected = expectedValues[field.pdfFieldName];
    if (expected === undefined) continue; // field wasn't filled

    const actual = actualValues[field.pdfFieldName];
    const expectedStr = String(expected);
    const actualStr = actual === null ? '' : String(actual);

    if (expectedStr === actualStr) {
      verifiedCount++;
    } else {
      mismatches.push({
        fieldId: field.id,
        expected: expectedStr,
        actual: actualStr,
      });
    }
  }

  return {
    passed: mismatches.length === 0,
    fieldCount: schema.fields.length,
    verifiedCount,
    mismatches,
  };
}
