import { describe, expect, test } from 'bun:test';
import { buildCalcDAG, extractDependencies } from '../calculation/dag';
import type { FormSchema } from '../types/schema-types';
import { FieldType } from '../types/field-types';
import type { FormulaExpression } from '../types/calculation-types';
import type { CalculationError } from '../types/result-types';

function makeSchema(fields: Array<{
  id: string;
  formula?: FormulaExpression;
  roundingRule?: 'nearest' | 'down' | 'up';
}>): FormSchema {
  return {
    formCode: 'test',
    taxYear: 2024,
    irsRevision: '2024-01',
    name: 'Test Form',
    fields: fields.map((f) => ({
      id: f.id,
      pdfFieldName: f.id,
      label: f.id,
      type: FieldType.Currency,
      ...(f.formula ? { calculation: { formula: f.formula, roundingRule: f.roundingRule } } : {}),
    })),
  };
}

describe('extractDependencies', () => {
  test('ref returns field id', () => {
    const expr: FormulaExpression = { op: 'ref', field: 'income' };
    expect(extractDependencies(expr)).toEqual(['income']);
  });

  test('literal returns empty', () => {
    const expr: FormulaExpression = { op: 'literal', value: 100 };
    expect(extractDependencies(expr)).toEqual([]);
  });

  test('add with multiple refs', () => {
    const expr: FormulaExpression = {
      op: 'add',
      operands: [
        { op: 'ref', field: 'a' },
        { op: 'ref', field: 'b' },
        { op: 'ref', field: 'c' },
      ],
    };
    expect(extractDependencies(expr)).toEqual(['a', 'b', 'c']);
  });

  test('deduplicates refs', () => {
    const expr: FormulaExpression = {
      op: 'add',
      operands: [
        { op: 'ref', field: 'a' },
        { op: 'ref', field: 'a' },
      ],
    };
    expect(extractDependencies(expr)).toEqual(['a']);
  });

  test('nested expressions', () => {
    const expr: FormulaExpression = {
      op: 'subtract',
      left: { op: 'ref', field: 'gross' },
      right: {
        op: 'add',
        operands: [
          { op: 'ref', field: 'deduction1' },
          { op: 'ref', field: 'deduction2' },
        ],
      },
    };
    expect(extractDependencies(expr).sort()).toEqual(['deduction1', 'deduction2', 'gross']);
  });

  test('if condition field is included', () => {
    const expr: FormulaExpression = {
      op: 'if',
      condition: { field: 'status', operator: 'eq', value: 1 },
      then: { op: 'ref', field: 'a' },
      else: { op: 'ref', field: 'b' },
    };
    expect(extractDependencies(expr).sort()).toEqual(['a', 'b', 'status']);
  });

  test('taxTableLookup extracts input and filingStatus deps', () => {
    const expr: FormulaExpression = {
      op: 'taxTableLookup',
      table: 'income_tax',
      input: { op: 'ref', field: 'taxable_income' },
      filingStatus: { op: 'ref', field: 'filing_status' },
    };
    expect(extractDependencies(expr).sort()).toEqual(['filing_status', 'taxable_income']);
  });
});

describe('buildCalcDAG', () => {
  test('empty schema returns empty DAG', () => {
    const schema = makeSchema([
      { id: 'a' },
      { id: 'b' },
    ]);
    const dag = buildCalcDAG(schema);
    expect(dag.nodes).toEqual([]);
    expect(dag.executionOrder).toEqual([]);
  });

  test('single node with no dependencies', () => {
    const schema = makeSchema([
      { id: 'total', formula: { op: 'literal', value: 100 } },
    ]);
    const dag = buildCalcDAG(schema);
    expect(dag.executionOrder).toEqual(['total']);
    expect(dag.nodes).toHaveLength(1);
    expect(dag.nodes[0].dependencies).toEqual([]);
  });

  test('linear chain: A depends on B, B depends on C', () => {
    const schema = makeSchema([
      { id: 'C' },  // input, no calc
      { id: 'B', formula: { op: 'ref', field: 'C' } },
      { id: 'A', formula: { op: 'ref', field: 'B' } },
    ]);
    const dag = buildCalcDAG(schema);
    expect(dag.executionOrder).toEqual(['B', 'A']);
  });

  test('diamond dependency: A depends on B and C, both depend on D', () => {
    const schema = makeSchema([
      { id: 'D' },  // input
      { id: 'B', formula: { op: 'ref', field: 'D' } },
      { id: 'C', formula: { op: 'ref', field: 'D' } },
      {
        id: 'A',
        formula: {
          op: 'add',
          operands: [
            { op: 'ref', field: 'B' },
            { op: 'ref', field: 'C' },
          ],
        },
      },
    ]);
    const dag = buildCalcDAG(schema);
    // D is not a calc node (no formula), so B and C have 0 in-degree
    // A depends on B and C
    const orderOfA = dag.executionOrder.indexOf('A');
    const orderOfB = dag.executionOrder.indexOf('B');
    const orderOfC = dag.executionOrder.indexOf('C');
    expect(orderOfA).toBeGreaterThan(orderOfB);
    expect(orderOfA).toBeGreaterThan(orderOfC);
    expect(dag.executionOrder).toHaveLength(3);
  });

  test('cycle detection: A -> B -> C -> A throws CYCLE', () => {
    const schema = makeSchema([
      { id: 'A', formula: { op: 'ref', field: 'C' } },
      { id: 'B', formula: { op: 'ref', field: 'A' } },
      { id: 'C', formula: { op: 'ref', field: 'B' } },
    ]);
    try {
      buildCalcDAG(schema);
      expect(true).toBe(false); // should not reach here
    } catch (e) {
      const err = e as CalculationError;
      expect(err.type).toBe('calculation');
      expect(err.code).toBe('CYCLE');
      expect(err.message).toContain('Circular dependency');
    }
  });

  test('mixed calculated and input fields', () => {
    const schema = makeSchema([
      { id: 'wages' },          // input
      { id: 'interest' },       // input
      {
        id: 'total_income',
        formula: {
          op: 'add',
          operands: [
            { op: 'ref', field: 'wages' },
            { op: 'ref', field: 'interest' },
          ],
        },
      },
      {
        id: 'tax',
        formula: {
          op: 'multiply',
          left: { op: 'ref', field: 'total_income' },
          right: { op: 'literal', value: 0.22 },
        },
      },
    ]);
    const dag = buildCalcDAG(schema);
    expect(dag.executionOrder).toEqual(['total_income', 'tax']);
  });
});
