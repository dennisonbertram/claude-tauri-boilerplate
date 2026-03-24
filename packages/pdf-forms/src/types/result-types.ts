export interface ValidationError {
  type: 'validation';
  fieldId?: string;
  message: string;
  code: 'REQUIRED' | 'FORMAT' | 'RANGE' | 'TYPE' | 'DEPENDENCY';
}

export interface CompatibilityError {
  type: 'compatibility';
  fieldId?: string;
  message: string;
  code: 'MISSING_FIELD' | 'EXTRA_FIELD' | 'WRONG_TYPE' | 'WRONG_FORM';
}

export interface CalculationError {
  type: 'calculation';
  fieldId?: string;
  message: string;
  code: 'CYCLE' | 'MISSING_INPUT' | 'OVERFLOW' | 'DIVISION_BY_ZERO';
}

export interface PdfWriteError {
  type: 'pdfWrite';
  fieldId?: string;
  message: string;
  code: 'FIELD_NOT_FOUND' | 'WRITE_FAILED' | 'FLATTEN_FAILED';
}

export interface VerificationError {
  type: 'verification';
  fieldId?: string;
  message: string;
  code: 'MISMATCH' | 'READ_FAILED' | 'CALC_MISMATCH';
}

export type FormError =
  | ValidationError
  | CompatibilityError
  | CalculationError
  | PdfWriteError
  | VerificationError;

export interface CalculationLogEntry {
  fieldId: string;
  formula: string;
  inputs: Record<string, number>;
  result: number;
}

export interface FieldMismatch {
  fieldId: string;
  expected: string;
  actual: string;
}

export interface VerificationReport {
  passed: boolean;
  fieldCount: number;
  verifiedCount: number;
  mismatches: FieldMismatch[];
}

export interface FillResult {
  success: boolean;
  pdfBytes: Uint8Array;
  errors: FormError[];
  calculationLog: CalculationLogEntry[];
  verificationReport: VerificationReport;
}

export interface PdfFieldInfo {
  name: string;
  type: 'text' | 'checkbox' | 'radio' | 'dropdown';
  page: number;
  options?: string[];
  defaultValue?: string;
}

export interface FillOptions {
  flatten?: boolean;
  skipVerification?: boolean;
  strictValidation?: boolean;
}
