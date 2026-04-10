import { describe, test, expect } from 'bun:test';
import { sanitizeOrderId, sanitizeDateParam } from './sanitize';

// ---------------------------------------------------------------------------
// sanitizeOrderId
// ---------------------------------------------------------------------------

describe('sanitizeOrderId', () => {
  test('accepts a valid Amazon order ID', () => {
    expect(sanitizeOrderId('123-1234567-1234567')).toBe('123-1234567-1234567');
  });

  test('accepts another valid Amazon order ID pattern', () => {
    expect(sanitizeOrderId('D01-1234567-1234567')).toBe('D01-1234567-1234567');
  });

  test('throws for order ID containing colon operator', () => {
    expect(() => sanitizeOrderId('123-1234567-1234567 OR from:attacker@evil.com')).toThrow(
      'Invalid order ID'
    );
  });

  test('throws for order ID containing double-quote injection', () => {
    expect(() => sanitizeOrderId('123" OR from:evil@example.com "')).toThrow('Invalid order ID');
  });

  test('throws for order ID containing curly brace', () => {
    expect(() => sanitizeOrderId('123-{inject}')).toThrow('Invalid order ID');
  });

  test('throws for order ID containing parenthesis', () => {
    expect(() => sanitizeOrderId('abc (OR something)')).toThrow('Invalid order ID');
  });

  test('throws for order ID containing OR keyword injection', () => {
    expect(() => sanitizeOrderId('123 OR label:inbox')).toThrow('Invalid order ID');
  });

  test('throws for order ID containing AND keyword injection', () => {
    expect(() => sanitizeOrderId('123 AND label:inbox')).toThrow('Invalid order ID');
  });

  test('throws for order ID with dash-negation operator', () => {
    expect(() => sanitizeOrderId('-label:spam 123')).toThrow('Invalid order ID');
  });

  test('throws for empty string', () => {
    expect(() => sanitizeOrderId('')).toThrow('Invalid order ID');
  });

  test('throws for order ID that is too long', () => {
    expect(() => sanitizeOrderId('123-1234567-1234567-extra-garbage')).toThrow('Invalid order ID');
  });
});

// ---------------------------------------------------------------------------
// sanitizeDateParam
// ---------------------------------------------------------------------------

describe('sanitizeDateParam', () => {
  test('accepts valid YYYY/MM/DD date', () => {
    expect(sanitizeDateParam('2024/01/15')).toBe('2024/01/15');
  });

  test('accepts valid YYYY/MM/DD at year boundary', () => {
    expect(sanitizeDateParam('2023/12/31')).toBe('2023/12/31');
  });

  test('throws for date with query operator injection (colon)', () => {
    expect(() => sanitizeDateParam('2024/01/01 OR from:evil')).toThrow('Invalid date');
  });

  test('throws for date with YYYY-MM-DD format (wrong separator)', () => {
    expect(() => sanitizeDateParam('2024-01-15')).toThrow('Invalid date');
  });

  test('throws for date with MM/DD/YYYY format', () => {
    expect(() => sanitizeDateParam('01/15/2024')).toThrow('Invalid date');
  });

  test('throws for date with only year', () => {
    expect(() => sanitizeDateParam('2024')).toThrow('Invalid date');
  });

  test('throws for empty string', () => {
    expect(() => sanitizeDateParam('')).toThrow('Invalid date');
  });

  test('throws for date with extra characters appended', () => {
    expect(() => sanitizeDateParam('2024/01/15 label:inbox')).toThrow('Invalid date');
  });

  test('throws for date with month out of range', () => {
    expect(() => sanitizeDateParam('2024/13/01')).toThrow('Invalid date');
  });

  test('throws for date with day out of range', () => {
    expect(() => sanitizeDateParam('2024/01/32')).toThrow('Invalid date');
  });
});
