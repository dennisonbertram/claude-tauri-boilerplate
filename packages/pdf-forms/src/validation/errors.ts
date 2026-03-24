import type { ValidationError } from '../types/result-types';

export function requiredError(fieldId: string, label: string): ValidationError {
  return {
    type: 'validation',
    fieldId,
    message: `${label} is required`,
    code: 'REQUIRED',
  };
}

export function formatError(fieldId: string, label: string, expected: string): ValidationError {
  return {
    type: 'validation',
    fieldId,
    message: `${label} has invalid format. Expected: ${expected}`,
    code: 'FORMAT',
  };
}

export function rangeError(
  fieldId: string,
  label: string,
  min?: number,
  max?: number,
): ValidationError {
  let msg: string;
  if (min !== undefined && max !== undefined) {
    msg = `${label} must be between ${min} and ${max}`;
  } else if (min !== undefined) {
    msg = `${label} must be at least ${min}`;
  } else if (max !== undefined) {
    msg = `${label} must be at most ${max}`;
  } else {
    msg = `${label} is out of range`;
  }
  return {
    type: 'validation',
    fieldId,
    message: msg,
    code: 'RANGE',
  };
}

export function typeError(
  fieldId: string,
  label: string,
  expectedType: string,
): ValidationError {
  return {
    type: 'validation',
    fieldId,
    message: `${label} must be of type ${expectedType}`,
    code: 'TYPE',
  };
}

export function dependencyError(
  fieldId: string,
  label: string,
  dependsOn: string,
): ValidationError {
  return {
    type: 'validation',
    fieldId,
    message: `${label} is required when ${dependsOn} is set`,
    code: 'DEPENDENCY',
  };
}
