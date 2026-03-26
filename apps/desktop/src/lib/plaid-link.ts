export interface PlaidCallbackLocation {
  origin: string;
  pathname: string;
  search: string;
  hash?: string;
}

export function getBrowserPlaidCompletionRedirectUri(origin: string): string {
  return `${origin}/#/finance/callback`;
}

export function parsePlaidCallbackParams(
  location: Pick<PlaidCallbackLocation, 'pathname' | 'search' | 'hash'>,
): { state: string; publicToken?: string } | null {
  const params = new URLSearchParams(location.search);
  const hashQuery = location.hash?.includes('?') ? location.hash.slice(location.hash.indexOf('?') + 1) : '';
  if (!params.size && hashQuery) {
    const hashParams = new URLSearchParams(hashQuery);
    for (const [key, value] of hashParams.entries()) params.set(key, value);
  }

  if (!location.pathname.startsWith('/finance/callback')) return null;

  const state = params.get('state');
  const publicToken = params.get('public_token');
  if (!state) return null;

  return {
    state,
    ...(publicToken ? { publicToken } : {}),
  };
}
