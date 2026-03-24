/**
 * Build a DAG from schema fields that have calculation rules,
 * then topological sort using Kahn's algorithm.
 */

import type { FormSchema } from '../types/schema-types';
import type { FormulaExpression, CalcDAG, CalcNode } from '../types/calculation-types';
import type { CalculationError } from '../types/result-types';

/**
 * Recursively walk a FormulaExpression tree and collect all field references.
 */
export function extractDependencies(expr: FormulaExpression): string[] {
  const deps: string[] = [];

  function walk(e: FormulaExpression): void {
    switch (e.op) {
      case 'ref':
        deps.push(e.field);
        break;
      case 'literal':
        break;
      case 'add':
      case 'min':
      case 'max':
        for (const operand of e.operands) walk(operand);
        break;
      case 'subtract':
      case 'multiply':
      case 'divide':
        walk(e.left);
        walk(e.right);
        break;
      case 'if':
        // The condition references a field too
        deps.push(e.condition.field);
        walk(e.then);
        walk(e.else);
        break;
      case 'taxTableLookup':
        walk(e.input);
        walk(e.filingStatus);
        break;
      case 'round':
        walk(e.operand);
        break;
    }
  }

  walk(expr);
  // Deduplicate
  return [...new Set(deps)];
}

/**
 * Build a CalcDAG from a FormSchema.
 * Throws CalculationError with code CYCLE if circular dependencies are detected.
 */
export function buildCalcDAG(schema: FormSchema): CalcDAG {
  // 1. Collect all fields with calculation rules
  const calcFields = schema.fields.filter((f) => f.calculation != null);

  if (calcFields.length === 0) {
    return { nodes: [], executionOrder: [] };
  }

  // 2. Build CalcNode for each
  const nodeMap = new Map<string, CalcNode>();
  for (const field of calcFields) {
    const formula = field.calculation!.formula;
    const dependencies = extractDependencies(formula);
    nodeMap.set(field.id, { fieldId: field.id, formula, dependencies });
  }

  // 3. Topological sort using Kahn's algorithm
  const calcFieldIds = new Set(nodeMap.keys());

  // Compute in-degree (only counting edges within calc nodes)
  const inDegree = new Map<string, number>();
  for (const id of calcFieldIds) {
    inDegree.set(id, 0);
  }

  for (const node of nodeMap.values()) {
    for (const dep of node.dependencies) {
      if (calcFieldIds.has(dep)) {
        inDegree.set(node.fieldId, (inDegree.get(node.fieldId) ?? 0) + 1);
      }
    }
  }

  // Start with nodes that have 0 in-degree
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  // Build adjacency list: dep -> dependents
  const dependents = new Map<string, string[]>();
  for (const node of nodeMap.values()) {
    for (const dep of node.dependencies) {
      if (calcFieldIds.has(dep)) {
        const list = dependents.get(dep) ?? [];
        list.push(node.fieldId);
        dependents.set(dep, list);
      }
    }
  }

  const executionOrder: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    executionOrder.push(current);

    const deps = dependents.get(current) ?? [];
    for (const dependent of deps) {
      const newDeg = (inDegree.get(dependent) ?? 1) - 1;
      inDegree.set(dependent, newDeg);
      if (newDeg === 0) {
        queue.push(dependent);
      }
    }
  }

  // 4. Cycle detection
  if (executionOrder.length < calcFieldIds.size) {
    const cycleFields = [...calcFieldIds].filter(
      (id) => !executionOrder.includes(id)
    );
    const error: CalculationError = {
      type: 'calculation',
      message: `Circular dependency detected among fields: ${cycleFields.join(', ')}`,
      code: 'CYCLE',
    };
    throw error;
  }

  const nodes = executionOrder.map((id) => nodeMap.get(id)!);

  return { nodes, executionOrder };
}
