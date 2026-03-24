import type { ConditionalRule } from './schema-types';

export type FormulaExpression =
  | { op: 'ref'; field: string }
  | { op: 'literal'; value: number }
  | { op: 'add'; operands: FormulaExpression[] }
  | { op: 'subtract'; left: FormulaExpression; right: FormulaExpression }
  | { op: 'multiply'; left: FormulaExpression; right: FormulaExpression }
  | { op: 'divide'; left: FormulaExpression; right: FormulaExpression }
  | { op: 'min'; operands: FormulaExpression[] }
  | { op: 'max'; operands: FormulaExpression[] }
  | { op: 'if'; condition: ConditionalRule; then: FormulaExpression; else: FormulaExpression }
  | { op: 'taxTableLookup'; table: string; input: FormulaExpression; filingStatus: FormulaExpression }
  | { op: 'round'; operand: FormulaExpression; rule: 'nearest' | 'down' | 'up' };

export interface CalcNode {
  fieldId: string;
  formula: FormulaExpression;
  dependencies: string[];
}

export interface CalcDAG {
  nodes: CalcNode[];
  executionOrder: string[];
}
