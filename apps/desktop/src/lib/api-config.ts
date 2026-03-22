// Singleton — port and token are set once by sidecar.ts at startup
let _baseUrl = 'http://localhost:3131'; // fallback for browser dev
let _bearerToken = '';

export function setSidecarConfig(port: number, token: string) {
  _baseUrl = `http://localhost:${port}`;
  _bearerToken = token;
}

export function getApiBase(): string {
  return _baseUrl;
}

export function getAuthHeaders(): Record<string, string> {
  return _bearerToken ? { Authorization: `Bearer ${_bearerToken}` } : {};
}

/** Convenience: fetch with auth headers pre-applied */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith('http') ? path : `${_baseUrl}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...init?.headers,
    },
  });
}
