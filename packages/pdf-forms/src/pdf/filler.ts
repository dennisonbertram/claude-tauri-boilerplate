import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
} from 'pdf-lib';
import type { PdfWriteError } from '../types';
import type { PdfFiller } from './interfaces';

/**
 * pdf-lib implementation of PdfFiller.
 * Fills form fields and collects all errors instead of throwing on first failure.
 */
export class PdfLibFiller implements PdfFiller {
  async fill(
    templateBytes: Uint8Array,
    fieldValues: Record<string, string | boolean>,
    options?: { flatten?: boolean },
  ): Promise<{ pdfBytes: Uint8Array; errors: PdfWriteError[] }> {
    const doc = await PDFDocument.load(templateBytes);
    const form = doc.getForm();
    const errors: PdfWriteError[] = [];

    for (const [fieldName, value] of Object.entries(fieldValues)) {
      try {
        const field = form.getField(fieldName);

        if (field instanceof PDFTextField) {
          form.getTextField(fieldName).setText(String(value));
        } else if (field instanceof PDFCheckBox) {
          const cb = form.getCheckBox(fieldName);
          if (value === true || value === 'Yes' || value === 'true') {
            cb.check();
          } else {
            cb.uncheck();
          }
        } else if (field instanceof PDFRadioGroup) {
          form.getRadioGroup(fieldName).select(String(value));
        } else if (field instanceof PDFDropdown) {
          form.getDropdown(fieldName).select(String(value));
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        // Determine error code based on the failure
        const lowerMessage = message.toLowerCase();
        const isNotFound =
          lowerMessage.includes('no form field') ||
          lowerMessage.includes('no field') ||
          lowerMessage.includes('does not exist') ||
          lowerMessage.includes('not found');
        const code = isNotFound
          ? ('FIELD_NOT_FOUND' as const)
          : ('WRITE_FAILED' as const);

        errors.push({
          type: 'pdfWrite',
          fieldId: fieldName,
          message: `Failed to fill field "${fieldName}": ${message}`,
          code,
        });
      }
    }

    if (options?.flatten) {
      try {
        form.flatten();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        errors.push({
          type: 'pdfWrite',
          message: `Failed to flatten form: ${message}`,
          code: 'FLATTEN_FAILED',
        });
      }
    }

    const pdfBytes = await doc.save();
    return { pdfBytes: new Uint8Array(pdfBytes), errors };
  }
}
