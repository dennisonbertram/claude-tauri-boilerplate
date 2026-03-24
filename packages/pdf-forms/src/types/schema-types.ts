import type { FieldType, FieldValue } from './field-types';
import type { FormulaExpression } from './calculation-types';

export interface ConditionalRule {
  field: string;
  operator: 'eq' | 'neq' | 'truthy' | 'falsy' | 'in';
  value?: FieldValue | FieldValue[];
}

export interface CalculationRule {
  formula: FormulaExpression;
  roundingRule?: 'nearest' | 'down' | 'up';
}

export interface FieldDefinition {
  id: string;
  pdfFieldName: string;
  label: string;
  type: FieldType;
  required?: boolean;
  requiredIf?: ConditionalRule;
  format?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  allowedValues?: string[];
  defaultValue?: FieldValue;
  calculation?: CalculationRule;
  page?: number;
}

export interface FormSchema {
  formCode: string;
  taxYear: number;
  irsRevision: string;
  name: string;
  fields: FieldDefinition[];
}

export class FormSchemaRegistry {
  private schemas = new Map<string, FormSchema>();

  private key(formCode: string, taxYear: number): string {
    return `${formCode}:${taxYear}`;
  }

  register(schema: FormSchema): void {
    this.schemas.set(this.key(schema.formCode, schema.taxYear), schema);
  }

  get(formCode: string, taxYear: number): FormSchema | undefined {
    return this.schemas.get(this.key(formCode, taxYear));
  }

  list(): FormSchema[] {
    return Array.from(this.schemas.values());
  }

  getLatest(formCode: string): FormSchema | undefined {
    let latest: FormSchema | undefined;
    for (const schema of this.schemas.values()) {
      if (schema.formCode === formCode) {
        if (!latest || schema.taxYear > latest.taxYear) {
          latest = schema;
        }
      }
    }
    return latest;
  }
}
