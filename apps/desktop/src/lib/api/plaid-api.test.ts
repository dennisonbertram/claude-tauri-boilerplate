import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  startLinkSession,
  finalizeLinkSession,
  reauthPlaidItem,
  fetchPlaidItems,
} from './plaid-api';

const originalFetch = global.fetch;

describe('plaid-api', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('maps snake_case link-session responses to camelCase', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hosted_link_url: 'https://secure.plaid.com/link/test',
        session_id: 'session-123',
        state: 'state-123',
      }),
    }) as typeof fetch;

    await expect(startLinkSession()).resolves.toEqual({
      hostedLinkUrl: 'https://secure.plaid.com/link/test',
      sessionId: 'session-123',
      state: 'state-123',
    });
  });

  it('maps snake_case reauth responses to camelCase', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hosted_link_url: 'https://secure.plaid.com/link/reauth',
        session_id: 'session-reauth',
        state: 'state-reauth',
      }),
    }) as typeof fetch;

    await expect(reauthPlaidItem('item-123')).resolves.toEqual({
      hostedLinkUrl: 'https://secure.plaid.com/link/reauth',
      sessionId: 'session-reauth',
      state: 'state-reauth',
    });
  });

  it('normalizes plaid items so missing accounts become an empty array', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          id: 'item-1',
          itemId: 'plaid-item-1',
          institutionId: 'ins_1',
          institutionName: 'Test Bank',
          createdAt: '2026-03-25T00:00:00.000Z',
        },
      ]),
    }) as typeof fetch;

    await expect(fetchPlaidItems()).resolves.toEqual([
      {
        id: 'item-1',
        itemId: 'plaid-item-1',
        institutionId: 'ins_1',
        institutionName: 'Test Bank',
        createdAt: '2026-03-25T00:00:00.000Z',
        accounts: [],
      },
    ]);
  });

  it('sends public_token when finalizing a link session', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ item: { id: 'item-1' } }),
    });
    global.fetch = fetchMock as typeof fetch;

    await finalizeLinkSession('state-123', 'public-sandbox-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.body).toBe(JSON.stringify({
      state: 'state-123',
      public_token: 'public-sandbox-token',
    }));
  });

  it('can finalize a link session with state only', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ item: { id: 'item-1' } }),
    });
    global.fetch = fetchMock as typeof fetch;

    await finalizeLinkSession('state-only-123');

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.body).toBe(JSON.stringify({
      state: 'state-only-123',
    }));
  });

  it('sends completion_redirect_uri when creating a browser link session', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hosted_link_url: 'https://secure.plaid.com/link/test',
        session_id: 'session-123',
        state: 'state-123',
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    await startLinkSession(undefined, 'http://localhost:1757/#/finance/callback');

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.body).toBe(JSON.stringify({
      completion_redirect_uri: 'http://localhost:1757/#/finance/callback',
    }));
  });

  it('sends completion_redirect_uri for reauth when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hosted_link_url: 'https://secure.plaid.com/link/reauth',
        session_id: 'session-reauth',
        state: 'state-reauth',
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    await reauthPlaidItem('item-123', 'http://localhost:1757/#/finance/callback');

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.body).toBe(JSON.stringify({
      completion_redirect_uri: 'http://localhost:1757/#/finance/callback',
    }));
  });
});
