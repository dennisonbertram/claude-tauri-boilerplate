import { FieldType } from '../types/field-types';
import type { FieldValue } from '../types/field-types';

/**
 * Coerces currency input to integer cents.
 * "$1,234.56" -> 123456, "1234" -> 123400 (assumes dollars), 123456 (number) -> 123456
 */
export function coerceCurrency(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new Error(`Invalid currency number: ${input}`);
    }
    return Math.round(input);
  }
  if (typeof input !== 'string' || input.trim() === '') {
    throw new Error('Currency input must be a non-empty string or number');
  }
  const cleaned = input.replace(/[$,\s]/g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error(`Invalid currency string: ${input}`);
  }
  const parts = cleaned.split('.');
  const dollars = parseInt(parts[0], 10);
  let cents = 0;
  if (parts[1]) {
    const centStr = parts[1].padEnd(2, '0');
    cents = parseInt(centStr, 10);
  }
  const sign = dollars < 0 ? -1 : 1;
  return Math.abs(dollars) * 100 * sign + cents * sign;
}

/**
 * Coerces percentage input to a number 0-100.
 * "50.5%" -> 50.5, "50.5" -> 50.5, 50.5 -> 50.5
 */
export function coercePercentage(input: string | number): number {
  if (typeof input === 'number') {
    return input;
  }
  if (typeof input !== 'string' || input.trim() === '') {
    throw new Error('Percentage input must be a non-empty string or number');
  }
  const cleaned = input.replace(/%/g, '').trim();
  const num = parseFloat(cleaned);
  if (isNaN(num)) {
    throw new Error(`Invalid percentage string: ${input}`);
  }
  return num;
}

/**
 * Normalizes SSN to XXX-XX-XXXX.
 * "123456789" -> "123-45-6789", "123-45-6789" -> "123-45-6789"
 */
export function coerceSSN(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('SSN input must be a string');
  }
  const digits = input.replace(/[\s-]/g, '');
  if (!/^\d{9}$/.test(digits)) {
    throw new Error(`Invalid SSN: ${input}`);
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

/**
 * Normalizes EIN to XX-XXXXXXX.
 * "123456789" -> "12-3456789", "12-3456789" -> "12-3456789"
 */
export function coerceEIN(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('EIN input must be a string');
  }
  const digits = input.replace(/[\s-]/g, '');
  if (!/^\d{9}$/.test(digits)) {
    throw new Error(`Invalid EIN: ${input}`);
  }
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

/**
 * Normalizes date to MM/DD/YYYY.
 * "1/5/2024" -> "01/05/2024", "2024-01-05" -> "01/05/2024"
 */
export function coerceDate(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('Date input must be a string');
  }
  const trimmed = input.trim();

  // ISO format: YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${month}/${day}/${isoMatch[1]}`;
  }

  // US format: M/D/YYYY or MM/DD/YYYY
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const month = usMatch[1].padStart(2, '0');
    const day = usMatch[2].padStart(2, '0');
    return `${month}/${day}/${usMatch[3]}`;
  }

  throw new Error(`Unrecognized date format: ${input}`);
}

/**
 * Normalizes zip code, strips spaces.
 */
export function coerceZipCode(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('Zip code input must be a string');
  }
  const cleaned = input.replace(/\s/g, '');
  if (!/^\d{5}(-\d{4})?$/.test(cleaned)) {
    throw new Error(`Invalid zip code: ${input}`);
  }
  return cleaned;
}

/**
 * Normalizes phone to (XXX) XXX-XXXX.
 * Strips non-digits, then formats.
 */
export function coercePhone(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('Phone input must be a string');
  }
  const digits = input.replace(/\D/g, '');
  // Handle 1-prefixed 11-digit numbers
  const normalized = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (normalized.length !== 10) {
    throw new Error(`Invalid phone number: ${input}`);
  }
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}

/**
 * Dispatcher: coerces a FieldValue based on the FieldType.
 */
export function coerceFieldValue(value: FieldValue, fieldType: FieldType): FieldValue {
  if (value === null || value === undefined) {
    return value;
  }

  switch (fieldType) {
    case FieldType.Currency:
      return coerceCurrency(value as string | number);
    case FieldType.Percentage:
      return coercePercentage(value as string | number);
    case FieldType.SSN:
      return coerceSSN(value as string);
    case FieldType.EIN:
      return coerceEIN(value as string);
    case FieldType.Date:
      return coerceDate(value as string);
    case FieldType.ZipCode:
      return coerceZipCode(value as string);
    case FieldType.Phone:
      return coercePhone(value as string);
    case FieldType.Integer:
      if (typeof value === 'string') {
        const parsed = parseInt(value, 10);
        if (isNaN(parsed)) throw new Error(`Invalid integer: ${value}`);
        return parsed;
      }
      return value;
    case FieldType.Checkbox:
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1' || value === 'yes';
      }
      return value;
    default:
      return value;
  }
}
