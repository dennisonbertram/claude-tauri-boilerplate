import { describe, expect, it } from 'vitest';
import { getBrowserPlaidCompletionRedirectUri, parsePlaidCallbackParams } from '../plaid-link';

describe('plaid-link helpers', () => {
  it('builds a browser callback URL under the finance route', () => {
    expect(getBrowserPlaidCompletionRedirectUri('http://localhost:1757')).toBe(
      'http://localhost:1757/#/finance/callback',
    );
  });

  it('parses callback params from finance callback search params', () => {
    expect(
      parsePlaidCallbackParams({
        pathname: '/finance/callback',
        search: '?state=abc&public_token=public-sandbox-123',
        hash: '#/finance/callback?state=abc&public_token=public-sandbox-123',
      }),
    ).toEqual({
      state: 'abc',
      publicToken: 'public-sandbox-123',
    });
  });

  it('parses callback params when only state is present', () => {
    expect(
      parsePlaidCallbackParams({
        pathname: '/finance/callback',
        search: '?state=abc',
        hash: '#/finance/callback?state=abc',
      }),
    ).toEqual({
      state: 'abc',
    });
  });

  it('returns null when state is missing', () => {
    expect(
      parsePlaidCallbackParams({
        pathname: '/finance/callback',
        search: '',
        hash: '#/finance/callback',
      }),
    ).toBeNull();
  });
});
