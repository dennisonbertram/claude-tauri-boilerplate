/**
 * Pure type-specific validation functions.
 * Each returns null if valid, or an error message string if invalid.
 */

export function validateSSN(value: string): string | null {
  if (typeof value !== 'string') {
    return 'SSN must be a string';
  }
  if (!/^\d{3}-\d{2}-\d{4}$/.test(value)) {
    return 'SSN must match format XXX-XX-XXXX';
  }
  const [area, group, serial] = value.split('-');
  if (area === '000' || group === '00' || serial === '0000') {
    return 'SSN contains invalid all-zeros group';
  }
  return null;
}

export function validateEIN(value: string): string | null {
  if (typeof value !== 'string') {
    return 'EIN must be a string';
  }
  if (!/^\d{2}-\d{7}$/.test(value)) {
    return 'EIN must match format XX-XXXXXXX';
  }
  return null;
}

export function validateDate(value: string): string | null {
  if (typeof value !== 'string') {
    return 'Date must be a string';
  }
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return 'Date must match format MM/DD/YYYY';
  }
  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (month < 1 || month > 12) {
    return `Invalid month: ${month}`;
  }

  const daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && isLeapYear(year)) {
    daysInMonth[2] = 29;
  }

  if (day < 1 || day > daysInMonth[month]) {
    return `Invalid day ${day} for month ${month}`;
  }

  return null;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validateCurrency(value: string | number): string | null {
  if (value === null || value === undefined) {
    return 'Currency value is required';
  }
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      return 'Numeric currency must be an integer (cents)';
    }
    if (value < 0) {
      return 'Currency cannot be negative';
    }
    return null;
  }
  if (typeof value !== 'string') {
    return 'Currency must be a string or number';
  }
  // Optional $, digits with optional commas, optional .XX
  if (!/^\$?\d{1,3}(,\d{3})*(\.\d{1,2})?$|^\$?\d+(\.\d{1,2})?$/.test(value)) {
    return 'Invalid currency format. Expected: $1,234.56 or 1234.56';
  }
  return null;
}

export function validatePercentage(value: string | number): string | null {
  if (value === null || value === undefined) {
    return 'Percentage value is required';
  }
  const num = typeof value === 'string' ? parseFloat(value.replace('%', '')) : value;
  if (isNaN(num)) {
    return 'Percentage must be a valid number';
  }
  if (num < 0 || num > 100) {
    return `Percentage must be between 0 and 100, got ${num}`;
  }
  return null;
}

export function validateInteger(value: string | number): string | null {
  if (value === null || value === undefined) {
    return 'Integer value is required';
  }
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      return 'Value must be a whole number';
    }
    return null;
  }
  if (typeof value === 'string') {
    if (!/^-?\d+$/.test(value)) {
      return 'Value must be a whole number';
    }
    return null;
  }
  return 'Integer must be a string or number';
}

export function validateZipCode(value: string): string | null {
  if (typeof value !== 'string') {
    return 'Zip code must be a string';
  }
  if (!/^\d{5}(-\d{4})?$/.test(value)) {
    return 'Zip code must match format XXXXX or XXXXX-XXXX';
  }
  return null;
}

export function validatePhone(value: string): string | null {
  if (typeof value !== 'string') {
    return 'Phone must be a string';
  }
  // Accept: (XXX) XXX-XXXX, XXX-XXX-XXXX, XXXXXXXXXX
  if (
    !/^\(\d{3}\) \d{3}-\d{4}$/.test(value) &&
    !/^\d{3}-\d{3}-\d{4}$/.test(value) &&
    !/^\d{10}$/.test(value)
  ) {
    return 'Phone must match (XXX) XXX-XXXX, XXX-XXX-XXXX, or XXXXXXXXXX';
  }
  return null;
}
