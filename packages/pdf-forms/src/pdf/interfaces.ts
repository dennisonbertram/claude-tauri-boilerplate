import type { PdfFieldInfo, PdfWriteError } from '../types';

/**
 * Abstraction for reading PDF form field metadata.
 * Allows swapping the underlying PDF library without changing consumers.
 */
export interface PdfReader {
  extractFields(pdfBytes: Uint8Array): Promise<PdfFieldInfo[]>;
}

/**
 * Abstraction for filling PDF form fields.
 * Returns filled PDF bytes plus any errors encountered during filling.
 */
export interface PdfFiller {
  fill(
    templateBytes: Uint8Array,
    fieldValues: Record<string, string | boolean>,
    options?: { flatten?: boolean },
  ): Promise<{ pdfBytes: Uint8Array; errors: PdfWriteError[] }>;
}

/**
 * Abstraction for reading back field values from a filled PDF.
 */
export interface PdfVerifier {
  readFieldValues(
    pdfBytes: Uint8Array,
  ): Promise<Record<string, string | boolean | null>>;
}
