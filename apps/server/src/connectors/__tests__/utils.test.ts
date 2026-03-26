import { describe, test, expect } from 'bun:test';
import { sanitizeError } from '../utils';

describe('sanitizeError', () => {
  test('returns error message unchanged for simple errors', () => {
    const err = new Error('something went wrong');
    expect(sanitizeError(err)).toBe('something went wrong');
  });

  test('handles non-Error values', () => {
    expect(sanitizeError('plain string error')).toBe('plain string error');
    expect(sanitizeError(42)).toBe('42');
  });

  test('redacts Bearer tokens', () => {
    const err = new Error('Got 401: Bearer eyJhbGciOiJSUzI1NiJ9.secret123 is invalid');
    const result = sanitizeError(err);
    expect(result).toContain('Bearer [REDACTED]');
    expect(result).not.toContain('eyJhbGciOiJSUzI1NiJ9.secret123');
  });

  test('redacts token= patterns', () => {
    const err = new Error('Auth failed: token=secret-token-value');
    const result = sanitizeError(err);
    expect(result).toContain('token=[REDACTED]');
    expect(result).not.toContain('secret-token-value');
  });

  test('redacts token: patterns', () => {
    const err = new Error('Unauthorized: token: abc123xyz');
    const result = sanitizeError(err);
    expect(result).toContain('token=[REDACTED]');
    expect(result).not.toContain('abc123xyz');
  });

  test('redacts URLs with embedded credentials', () => {
    const err = new Error('Could not connect to https://user:password@api.example.com/data');
    const result = sanitizeError(err);
    expect(result).toContain('[REDACTED_URL]');
    expect(result).not.toContain('password');
  });

  test('caps message length at 500 characters', () => {
    const longMsg = 'x'.repeat(1000);
    const err = new Error(longMsg);
    const result = sanitizeError(err);
    expect(result.length).toBe(500);
  });

  test('does not truncate messages under 500 characters', () => {
    const shortMsg = 'short error';
    expect(sanitizeError(new Error(shortMsg))).toBe(shortMsg);
  });

  test('handles Bearer token with case-insensitivity', () => {
    const err = new Error('BEARER mytoken is invalid');
    const result = sanitizeError(err);
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('mytoken');
  });
});
