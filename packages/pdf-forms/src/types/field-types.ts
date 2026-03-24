export enum FieldType {
  Text = 'text',
  Checkbox = 'checkbox',
  Radio = 'radio',
  Dropdown = 'dropdown',
  SSN = 'ssn',
  EIN = 'ein',
  Date = 'date',
  Currency = 'currency',
  Percentage = 'percentage',
  Integer = 'integer',
  ZipCode = 'zipcode',
  Phone = 'phone',
}

export type FieldValue = string | number | boolean | null;
