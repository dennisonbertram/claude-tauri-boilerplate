/**
 * Calculation engine entry point.
 * Builds a DAG, evaluates formulas in topological order, and returns results with a log.
 */

import type { FormSchema } from '../types/schema-types';
import type { FieldValue } from '../types/field-types';
import { FieldType } from '../types/field-types';
import type { CalculationLogEntry } from '../types/result-types';
import { buildCalcDAG } from './dag';
import { evaluateFormula } from './formulas';
import { createTaxTableRegistry } from './tax-tables';
import { irsRound } from './rounding';

export { buildCalcDAG, extractDependencies } from './dag';
export { evaluateFormula } from './formulas';
export { createTaxTableRegistry } from './tax-tables';
export type { TaxBracket, FilingStatus, TaxTableRegistry } from './tax-tables';
export { irsRound, roundToCents } from './rounding';

/**
 * Convert a FieldValue to cents (number).
 * - number: assumed already in cents
 * - string: parse as dollar amount (e.g., "1234.56" -> 123456 cents),
 *           or as plain integer if no decimal
 * - boolean: 1 or 0
 * - null/undefined: 0
 */
function toNumericCents(value: FieldValue, fieldType?: FieldType): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Remove commas, dollar signs, whitespace
    const cleaned = value.replace(/[$,\s]/g, '');
    if (cleaned === '') return 0;
    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    // If the field type is currency, interpret as dollars -> cents
    if (fieldType === FieldType.Currency) {
      return Math.round(num * 100);
    }
    // Otherwise treat as raw number (could be cents already or a plain integer)
    return Math.round(num);
  }
  return 0;
}

/**
 * Generate a human-readable description of a formula for logging.
 */
function describeFormula(expr: import('../types/calculation-types').FormulaExpression): string {
  switch (expr.op) {
    case 'ref': return expr.field;
    case 'literal': return String(expr.value);
    case 'add': return expr.operands.map(describeFormula).join(' + ');
    case 'subtract': return `${describeFormula(expr.left)} - ${describeFormula(expr.right)}`;
    case 'multiply': return `${describeFormula(expr.left)} * ${describeFormula(expr.right)}`;
    case 'divide': return `${describeFormula(expr.left)} / ${describeFormula(expr.right)}`;
    case 'min': return `min(${expr.operands.map(describeFormula).join(', ')})`;
    case 'max': return `max(${expr.operands.map(describeFormula).join(', ')})`;
    case 'if': return `if(${expr.condition.field} ${expr.condition.operator} ${String(expr.condition.value ?? '')}) then ${describeFormula(expr.then)} else ${describeFormula(expr.else)}`;
    case 'taxTableLookup': return `taxTable(${expr.table}, ${describeFormula(expr.input)})`;
    case 'round': return `round(${describeFormula(expr.operand)}, ${expr.rule})`;
  }
}

/**
 * Main calculation function.
 * Evaluates all calculated fields in dependency order.
 */
export function calculateFields(
  schema: FormSchema,
  inputData: Record<string, FieldValue>
): { values: Record<string, number>; log: CalculationLogEntry[] } {
  // 1. Build DAG and get execution order
  const dag = buildCalcDAG(schema);

  // 2. Build a field type lookup
  const fieldTypeMap = new Map<string, FieldType>();
  for (const field of schema.fields) {
    fieldTypeMap.set(field.id, field.type);
  }

  // 3. Convert input data to numeric map
  const values = new Map<string, number>();
  for (const [key, val] of Object.entries(inputData)) {
    values.set(key, toNumericCents(val, fieldTypeMap.get(key)));
  }

  // 4. Create tax table registry
  const taxTables = createTaxTableRegistry();

  // 5. Evaluate each calculated field in order
  const log: CalculationLogEntry[] = [];

  for (const fieldId of dag.executionOrder) {
    const node = dag.nodes.find((n) => n.fieldId === fieldId)!;
    const fieldDef = schema.fields.find((f) => f.id === fieldId);

    // Collect input values used by this formula
    const inputs: Record<string, number> = {};
    for (const dep of node.dependencies) {
      inputs[dep] = values.get(dep) ?? 0;
    }

    // Evaluate formula
    let result = evaluateFormula(node.formula, values, taxTables);

    // Apply rounding rule if specified
    const roundingRule = fieldDef?.calculation?.roundingRule;
    if (roundingRule) {
      result = irsRound(result, roundingRule);
    }

    // Store result
    values.set(fieldId, result);

    // Log
    log.push({
      fieldId,
      formula: describeFormula(node.formula),
      inputs,
      result,
    });
  }

  // 6. Convert values map to record
  const resultValues: Record<string, number> = {};
  for (const [key, val] of values) {
    resultValues[key] = val;
  }

  return { values: resultValues, log };
}
