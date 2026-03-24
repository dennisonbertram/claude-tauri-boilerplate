/**
 * Pipeline orchestrator — the main public API for filling tax forms.
 * Ties together schema lookup, validation, calculation, PDF filling, and verification.
 */

import type {
  FormSchema,
  FieldValue,
  FillResult,
  FillOptions,
  FormError,
  CalculationLogEntry,
  VerificationReport,
} from './types';
import { FormSchemaRegistry } from './types';
import { FieldType } from './types';
import { validateFormData } from './validation';
import { coerceFieldValue } from './validation/coercion';
import { calculateFields } from './calculation';
import { PdfLibReader, PdfLibFiller, verifyFilledPdf, checkCompatibility } from './pdf';

// Lazy-import global registry to avoid circular deps
let _globalRegistry: FormSchemaRegistry | null = null;
function getGlobalRegistry(): FormSchemaRegistry {
  if (!_globalRegistry) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { globalRegistry } = require('./schemas');
    _globalRegistry = globalRegistry;
  }
  return _globalRegistry!;
}

/**
 * Convert a FieldValue to a PDF-ready string (or boolean for checkboxes).
 */
function toPdfValue(value: FieldValue, fieldType: FieldType): string | boolean {
  if (value === null || value === undefined) return '';
  if (fieldType === FieldType.Checkbox) {
    return Boolean(value);
  }
  if (fieldType === FieldType.Currency && typeof value === 'number') {
    // Currency is stored as cents — convert to dollar string without $
    const dollars = Math.abs(value) / 100;
    const formatted = dollars.toFixed(2);
    return value < 0 ? `-${formatted}` : formatted;
  }
  return String(value);
}

/**
 * Fill a tax form PDF end-to-end.
 */
export async function fillTaxForm(params: {
  formId: string;
  taxYear: number;
  templatePdf: Uint8Array;
  data: Record<string, FieldValue>;
  options?: FillOptions;
  registry?: FormSchemaRegistry;
}): Promise<FillResult> {
  const {
    formId,
    taxYear,
    templatePdf,
    data,
    options = {},
    registry,
  } = params;

  const errors: FormError[] = [];
  const calcLog: CalculationLogEntry[] = [];

  const emptyVerification: VerificationReport = {
    passed: false,
    fieldCount: 0,
    verifiedCount: 0,
    mismatches: [],
  };

  const emptyResult = new Uint8Array(0);

  // 1. Look up schema
  const reg = registry ?? getGlobalRegistry();
  const schema = reg.get(formId, taxYear);
  if (!schema) {
    errors.push({
      type: 'compatibility',
      message: `No schema found for form "${formId}" tax year ${taxYear}`,
      code: 'WRONG_FORM',
    });
    return {
      success: false,
      pdfBytes: emptyResult,
      errors,
      calculationLog: calcLog,
      verificationReport: emptyVerification,
    };
  }

  // 2. Compatibility check
  const reader = new PdfLibReader();
  const compatErrors = await checkCompatibility(templatePdf, schema, reader);
  errors.push(...compatErrors);

  if (compatErrors.length > 0 && options.strictValidation) {
    return {
      success: false,
      pdfBytes: emptyResult,
      errors,
      calculationLog: calcLog,
      verificationReport: emptyVerification,
    };
  }

  // 3. Coerce input values
  const coercedData: Record<string, FieldValue> = { ...data };
  const fieldTypeMap = new Map<string, FieldType>();

  for (const field of schema.fields) {
    fieldTypeMap.set(field.id, field.type);
    if (coercedData[field.id] !== undefined && coercedData[field.id] !== null) {
      try {
        coercedData[field.id] = coerceFieldValue(coercedData[field.id], field.type);
      } catch {
        // Coercion failure is fine — validation will catch it
      }
    }
  }

  // 4. Validate
  const validationErrors = validateFormData(schema, coercedData);
  errors.push(...validationErrors);

  if (validationErrors.length > 0 && options.strictValidation) {
    return {
      success: false,
      pdfBytes: emptyResult,
      errors,
      calculationLog: calcLog,
      verificationReport: emptyVerification,
    };
  }

  // 5. Calculate computed fields
  const hasCalculations = schema.fields.some((f) => f.calculation);
  if (hasCalculations) {
    try {
      const calcResult = calculateFields(schema, coercedData);
      calcLog.push(...calcResult.log);

      // Merge computed values — only override fields with calculations
      for (const field of schema.fields) {
        if (field.calculation && calcResult.values[field.id] !== undefined) {
          coercedData[field.id] = calcResult.values[field.id];
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({
        type: 'calculation',
        message: `Calculation failed: ${message}`,
        code: 'MISSING_INPUT',
      });
    }
  }

  // 6. Build field values map: pdfFieldName -> PDF-ready value
  const fieldValues: Record<string, string | boolean> = {};
  for (const field of schema.fields) {
    const value = coercedData[field.id];
    if (value === undefined || value === null) continue;

    const pdfVal = toPdfValue(value, field.type);
    fieldValues[field.pdfFieldName] = pdfVal;
  }

  // 7. Fill the PDF
  const filler = new PdfLibFiller();
  const fillResult = await filler.fill(templatePdf, fieldValues, {
    flatten: options.flatten,
  });

  errors.push(...fillResult.errors);

  // 8. Verify (unless skipped)
  let verification = emptyVerification;
  if (!options.skipVerification && fillResult.pdfBytes.length > 0) {
    try {
      verification = await verifyFilledPdf(fillResult.pdfBytes, fieldValues, schema);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({
        type: 'verification',
        message: `Verification failed: ${message}`,
        code: 'READ_FAILED',
      });
    }
  }

  // Determine overall success
  const hasBlockingErrors = errors.some(
    (e) => e.type === 'pdfWrite' || (e.type === 'validation' && options.strictValidation),
  );
  const success = !hasBlockingErrors && (verification.passed || !!options.skipVerification);

  return {
    success,
    pdfBytes: fillResult.pdfBytes,
    errors,
    calculationLog: calcLog,
    verificationReport: verification,
  };
}

/**
 * Convenience: look up a schema by form ID and optional tax year.
 */
export function getSchemaInfo(
  formId: string,
  taxYear?: number,
  registry?: FormSchemaRegistry,
): FormSchema | null {
  const reg = registry ?? getGlobalRegistry();
  if (taxYear !== undefined) {
    return reg.get(formId, taxYear) ?? null;
  }
  return reg.getLatest(formId) ?? null;
}
