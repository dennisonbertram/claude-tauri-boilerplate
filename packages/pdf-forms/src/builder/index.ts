/**
 * Builder module — tools for analyzing PDF templates and generating schema files.
 */

export { classifyField } from './field-classifier';
export type { FieldSuggestion } from './field-classifier';

export { generateSchemaSource } from './schema-writer';
export type { FieldMapping, SchemaConfig } from './schema-writer';

import type { PdfFieldInfo } from '../types';
import type { FieldSuggestion } from './field-classifier';
import { classifyField } from './field-classifier';
import { PdfLibReader } from '../pdf';

/**
 * Analyze a PDF form template: extract all fields and provide
 * heuristic classification suggestions for each.
 */
export async function analyzeFormTemplate(
  pdfBytes: Uint8Array,
): Promise<{
  fields: Array<PdfFieldInfo & { suggestion: FieldSuggestion }>;
}> {
  const reader = new PdfLibReader();
  const pdfFields = await reader.extractFields(pdfBytes);

  const fields = pdfFields.map((pdfField) => ({
    ...pdfField,
    suggestion: classifyField(pdfField.name, pdfField.type),
  }));

  return { fields };
}
