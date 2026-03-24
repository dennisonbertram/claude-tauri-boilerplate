import type { FormSchema } from '../types/schema-types';
import type { FieldValue } from '../types/field-types';
import { FieldType } from '../types/field-types';
import type { ValidationError } from '../types/result-types';
import {
  validateSSN,
  validateEIN,
  validateDate,
  validateCurrency,
  validatePercentage,
  validateInteger,
  validateZipCode,
  validatePhone,
} from './type-validators';
import { validateCrossFieldDependencies } from './cross-field';
import { requiredError, formatError, rangeError, typeError } from './errors';

/**
 * Returns true if the value is considered empty/missing.
 */
function isEmpty(value: FieldValue): boolean {
  return value === null || value === undefined || value === '';
}

/**
 * Returns a type-specific validator error message, or null if valid.
 */
function validateFieldType(value: FieldValue, fieldType: FieldType): string | null {
  switch (fieldType) {
    case FieldType.SSN:
      return typeof value === 'string' ? validateSSN(value) : 'SSN must be a string';
    case FieldType.EIN:
      return typeof value === 'string' ? validateEIN(value) : 'EIN must be a string';
    case FieldType.Date:
      return typeof value === 'string' ? validateDate(value) : 'Date must be a string';
    case FieldType.Currency:
      return typeof value === 'string' || typeof value === 'number'
        ? validateCurrency(value)
        : 'Currency must be a string or number';
    case FieldType.Percentage:
      return typeof value === 'string' || typeof value === 'number'
        ? validatePercentage(value)
        : 'Percentage must be a string or number';
    case FieldType.Integer:
      return typeof value === 'string' || typeof value === 'number'
        ? validateInteger(value)
        : 'Integer must be a string or number';
    case FieldType.ZipCode:
      return typeof value === 'string' ? validateZipCode(value) : 'Zip code must be a string';
    case FieldType.Phone:
      return typeof value === 'string' ? validatePhone(value) : 'Phone must be a string';
    case FieldType.Checkbox:
      return typeof value === 'boolean' ? null : 'Checkbox must be a boolean';
    case FieldType.Text:
    case FieldType.Radio:
    case FieldType.Dropdown:
      return null; // No specific type validation beyond format/range
    default:
      return null;
  }
}

/**
 * Validates all form data against a schema. Returns all errors found.
 */
export function validateFormData(
  schema: FormSchema,
  data: Record<string, FieldValue>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const field of schema.fields) {
    const value = data[field.id];

    // 1. Required check
    if (field.required && isEmpty(value)) {
      errors.push(requiredError(field.id, field.label));
      continue; // No point checking format on a missing required field
    }

    // Skip remaining checks if value is empty and not required
    if (isEmpty(value)) {
      continue;
    }

    // 2. Type-specific validation
    const typeErr = validateFieldType(value, field.type);
    if (typeErr) {
      errors.push(typeError(field.id, field.label, typeErr));
      continue; // Don't check format/range if type is wrong
    }

    // 3. Format regex validation
    if (field.format && typeof value === 'string') {
      const regex = new RegExp(field.format);
      if (!regex.test(value)) {
        errors.push(formatError(field.id, field.label, field.format));
      }
    }

    // 4. Range/length validation
    if (typeof value === 'number') {
      if (field.min !== undefined && value < field.min) {
        errors.push(rangeError(field.id, field.label, field.min, field.max));
      } else if (field.max !== undefined && value > field.max) {
        errors.push(rangeError(field.id, field.label, field.min, field.max));
      }
    }
    if (typeof value === 'string') {
      if (field.minLength !== undefined && value.length < field.minLength) {
        errors.push(rangeError(field.id, field.label, field.minLength, field.maxLength));
      } else if (field.maxLength !== undefined && value.length > field.maxLength) {
        errors.push(rangeError(field.id, field.label, field.minLength, field.maxLength));
      }
    }

    // 5. Allowed values check
    if (field.allowedValues && typeof value === 'string') {
      if (!field.allowedValues.includes(value)) {
        errors.push(formatError(field.id, field.label, `one of: ${field.allowedValues.join(', ')}`));
      }
    }
  }

  // 6. Cross-field dependency checks
  const crossFieldErrors = validateCrossFieldDependencies(schema, data);
  errors.push(...crossFieldErrors);

  return errors;
}

// Re-export all modules
export {
  validateSSN,
  validateEIN,
  validateDate,
  validateCurrency,
  validatePercentage,
  validateInteger,
  validateZipCode,
  validatePhone,
} from './type-validators';

export {
  coerceCurrency,
  coercePercentage,
  coerceSSN,
  coerceEIN,
  coerceDate,
  coerceZipCode,
  coercePhone,
  coerceFieldValue,
} from './coercion';

export { evaluateCondition, validateCrossFieldDependencies } from './cross-field';

export {
  requiredError,
  formatError,
  rangeError,
  typeError,
  dependencyError,
} from './errors';
