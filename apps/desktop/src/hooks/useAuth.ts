import { useState, useEffect, useCallback } from 'react';
import type { AuthStatus } from '@claude-tauri/shared';

const API_BASE = 'http://localhost:3131';

export function useAuth() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/status`);
      const data = await res.json();
      setAuth(data);
    } catch {
      setAuth({ authenticated: false, error: 'Server not reachable' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  return { auth, loading, checkAuth };
}
