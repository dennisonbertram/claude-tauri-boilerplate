import type { ConditionalRule, FormSchema } from '../types/schema-types';
import type { FieldValue } from '../types/field-types';
import type { ValidationError } from '../types/result-types';
import { dependencyError } from './errors';

/**
 * Evaluates a ConditionalRule against a data map.
 */
export function evaluateCondition(
  condition: ConditionalRule,
  data: Record<string, FieldValue>,
): boolean {
  const fieldValue = data[condition.field];

  switch (condition.operator) {
    case 'eq':
      return fieldValue === condition.value;
    case 'neq':
      return fieldValue !== condition.value;
    case 'truthy':
      return !!fieldValue;
    case 'falsy':
      return !fieldValue;
    case 'in': {
      if (!Array.isArray(condition.value)) {
        return false;
      }
      return (condition.value as FieldValue[]).includes(fieldValue);
    }
    default:
      return false;
  }
}

/**
 * Checks all fields with requiredIf conditions.
 * If the condition is met and the field is missing/empty, returns a DEPENDENCY error.
 */
export function validateCrossFieldDependencies(
  schema: FormSchema,
  data: Record<string, FieldValue>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const field of schema.fields) {
    if (!field.requiredIf) continue;

    const conditionMet = evaluateCondition(field.requiredIf, data);
    if (!conditionMet) continue;

    const value = data[field.id];
    if (value === null || value === undefined || value === '') {
      errors.push(dependencyError(field.id, field.label, field.requiredIf.field));
    }
  }

  return errors;
}
