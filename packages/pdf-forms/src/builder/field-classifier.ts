/**
 * Heuristic field classifier — suggests semantic field IDs and types
 * based on PDF AcroForm field names and types.
 */

import { FieldType } from '../types';

export interface FieldSuggestion {
  suggestedId: string;
  suggestedType: FieldType;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Classify a PDF field based on its name and type, returning a suggested
 * semantic ID, FieldType, and confidence level.
 */
export function classifyField(pdfFieldName: string, pdfFieldType: string): FieldSuggestion {
  const lower = pdfFieldName.toLowerCase();

  // High-confidence type matches based on field name patterns
  if (/ssn|social.?sec/i.test(lower)) {
    return {
      suggestedId: toSnakeCase(pdfFieldName, 'ssn'),
      suggestedType: FieldType.SSN,
      confidence: 'high',
      reason: 'Field name contains SSN / social security pattern',
    };
  }

  if (/\bein\b|employer.?id/i.test(lower)) {
    return {
      suggestedId: toSnakeCase(pdfFieldName, 'ein'),
      suggestedType: FieldType.EIN,
      confidence: 'high',
      reason: 'Field name contains EIN / employer identification pattern',
    };
  }

  if (/zip|postal/i.test(lower)) {
    return {
      suggestedId: toSnakeCase(pdfFieldName, 'zip_code'),
      suggestedType: FieldType.ZipCode,
      confidence: 'high',
      reason: 'Field name contains zip / postal pattern',
    };
  }

  if (/phone|tel(?:ephone)?/i.test(lower)) {
    return {
      suggestedId: toSnakeCase(pdfFieldName, 'phone'),
      suggestedType: FieldType.Phone,
      confidence: 'high',
      reason: 'Field name contains phone / telephone pattern',
    };
  }

  // PDF-level type overrides (checkboxes, radios, dropdowns)
  if (pdfFieldType === 'checkbox') {
    return {
      suggestedId: toSnakeCase(pdfFieldName, 'checkbox'),
      suggestedType: FieldType.Checkbox,
      confidence: 'high',
      reason: 'PDF field type is checkbox',
    };
  }

  if (pdfFieldType === 'radio') {
    return {
      suggestedId: toSnakeCase(pdfFieldName, 'radio'),
      suggestedType: FieldType.Radio,
      confidence: 'high',
      reason: 'PDF field type is radio group',
    };
  }

  if (pdfFieldType === 'dropdown') {
    return {
      suggestedId: toSnakeCase(pdfFieldName, 'dropdown'),
      suggestedType: FieldType.Dropdown,
      confidence: 'high',
      reason: 'PDF field type is dropdown',
    };
  }

  // Medium-confidence content-based matches
  if (/\bdate\b|_dt\b/i.test(lower)) {
    return {
      suggestedId: toSnakeCase(pdfFieldName, 'date'),
      suggestedType: FieldType.Date,
      confidence: 'medium',
      reason: 'Field name contains date pattern',
    };
  }

  if (/amount|total|income|tax|wages|salary|payment|balance|deduction/i.test(lower)) {
    return {
      suggestedId: toSnakeCase(pdfFieldName, 'amount'),
      suggestedType: FieldType.Currency,
      confidence: 'medium',
      reason: 'Field name contains financial amount pattern',
    };
  }

  if (/percent|rate|pct/i.test(lower)) {
    return {
      suggestedId: toSnakeCase(pdfFieldName, 'percentage'),
      suggestedType: FieldType.Percentage,
      confidence: 'medium',
      reason: 'Field name contains percentage pattern',
    };
  }

  // Default: text with low confidence
  return {
    suggestedId: toSnakeCase(pdfFieldName, 'field'),
    suggestedType: FieldType.Text,
    confidence: 'low',
    reason: 'No specific pattern matched — defaulting to text',
  };
}

/**
 * Extract a meaningful snake_case ID from a PDF field name.
 * Handles IRS-style names like "topmostSubform[0].Page1[0].f1_1[0]"
 */
function toSnakeCase(pdfFieldName: string, fallback: string): string {
  // Strip common IRS prefixes and array indices
  let cleaned = pdfFieldName
    .replace(/topmostSubform\[\d+\]/gi, '')
    .replace(/Page\d+\[\d+\]/gi, '')
    .replace(/\[\d+\]/g, '')
    .replace(/^\.+|\.+$/g, '');

  // If nothing meaningful remains, use the fallback
  if (!cleaned || cleaned.length < 2) {
    return fallback;
  }

  // Convert camelCase/PascalCase to snake_case
  cleaned = cleaned
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[.\-\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();

  return cleaned || fallback;
}
