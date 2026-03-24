/**
 * Evaluate FormulaExpression trees given a values map.
 * All monetary values are in cents (integers).
 */

import type { FormulaExpression } from '../types/calculation-types';
import type { ConditionalRule } from '../types/schema-types';
import type { CalculationError } from '../types/result-types';
import type { TaxTableRegistry } from './tax-tables';
import { roundToCents, irsRound } from './rounding';

/**
 * Evaluate a numeric condition for calculation branching.
 * Operates on numbers (cents) rather than general FieldValues.
 */
function evaluateCalcCondition(
  condition: ConditionalRule,
  values: Map<string, number>
): boolean {
  const fieldValue = values.get(condition.field);

  switch (condition.operator) {
    case 'truthy':
      return fieldValue !== undefined && fieldValue !== 0;
    case 'falsy':
      return fieldValue === undefined || fieldValue === 0;
    case 'eq':
      if (fieldValue === undefined) return false;
      if (typeof condition.value === 'number') {
        return fieldValue === condition.value;
      }
      // For string comparisons (e.g., filing status encoded as number)
      return String(fieldValue) === String(condition.value);
    case 'neq':
      if (fieldValue === undefined) return true;
      if (typeof condition.value === 'number') {
        return fieldValue !== condition.value;
      }
      return String(fieldValue) !== String(condition.value);
    case 'in': {
      if (fieldValue === undefined) return false;
      if (!Array.isArray(condition.value)) return false;
      return condition.value.some((v) =>
        typeof v === 'number' ? fieldValue === v : String(fieldValue) === String(v)
      );
    }
    default:
      return false;
  }
}

function throwCalcError(code: CalculationError['code'], message: string, fieldId?: string): never {
  const error: CalculationError = { type: 'calculation', code, message, fieldId };
  throw error;
}

/**
 * Recursively evaluate a FormulaExpression.
 */
export function evaluateFormula(
  expr: FormulaExpression,
  values: Map<string, number>,
  taxTables: TaxTableRegistry
): number {
  switch (expr.op) {
    case 'ref': {
      const val = values.get(expr.field);
      if (val === undefined) {
        throwCalcError('MISSING_INPUT', `Missing input value for field: ${expr.field}`, expr.field);
      }
      return val;
    }

    case 'literal':
      return expr.value;

    case 'add': {
      let sum = 0;
      for (const operand of expr.operands) {
        sum += evaluateFormula(operand, values, taxTables);
      }
      return roundToCents(sum);
    }

    case 'subtract': {
      const left = evaluateFormula(expr.left, values, taxTables);
      const right = evaluateFormula(expr.right, values, taxTables);
      return roundToCents(left - right);
    }

    case 'multiply': {
      const left = evaluateFormula(expr.left, values, taxTables);
      const right = evaluateFormula(expr.right, values, taxTables);
      return roundToCents(left * right);
    }

    case 'divide': {
      const left = evaluateFormula(expr.left, values, taxTables);
      const right = evaluateFormula(expr.right, values, taxTables);
      if (right === 0) {
        throwCalcError('DIVISION_BY_ZERO', 'Division by zero');
      }
      return roundToCents(left / right);
    }

    case 'min': {
      const vals = expr.operands.map((o) => evaluateFormula(o, values, taxTables));
      return Math.min(...vals);
    }

    case 'max': {
      const vals = expr.operands.map((o) => evaluateFormula(o, values, taxTables));
      return Math.max(...vals);
    }

    case 'if': {
      const condResult = evaluateCalcCondition(expr.condition, values);
      return condResult
        ? evaluateFormula(expr.then, values, taxTables)
        : evaluateFormula(expr.else, values, taxTables);
    }

    case 'taxTableLookup': {
      const income = evaluateFormula(expr.input, values, taxTables);
      const filingStatusNum = evaluateFormula(expr.filingStatus, values, taxTables);
      // Filing status might be stored as a string key in the values map,
      // but since our values are numbers, we pass the table name and let
      // the caller provide filing status as a string.
      // For now, treat the filingStatus expression result as-is.
      return taxTables.lookup(expr.table, income, String(filingStatusNum));
    }

    case 'round': {
      const val = evaluateFormula(expr.operand, values, taxTables);
      return irsRound(val, expr.rule);
    }

    default: {
      // Exhaustive check
      const _never: never = expr;
      throw new Error(`Unknown formula operation: ${(_never as any).op}`);
    }
  }
}
