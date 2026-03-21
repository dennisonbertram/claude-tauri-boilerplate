import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';

export function createGithubReposRouter(_db: Database) {
  const app = new Hono();

  // GET /api/github/repos?q=<search>
  // Proxies to GitHub search API using token from Authorization header
  app.get('/repos', async (c) => {
    const token = c.req.header('Authorization')?.replace('Bearer ', '') ?? '';
    const query = c.req.query('q') ?? '';

    if (!token) {
      return c.json({ error: 'GitHub token required', code: 'GH_AUTH_MISSING' }, 401);
    }

    // Call GitHub API: search repos
    const url = query
      ? `https://api.github.com/search/repositories?q=${encodeURIComponent(query + ' in:name,description')}&sort=stars&per_page=20`
      : `https://api.github.com/user/repos?sort=updated&per_page=30`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (res.status === 401) {
      return c.json({ error: 'GitHub token invalid or expired', code: 'GH_AUTH_ERROR' }, 401);
    }
    if (!res.ok) {
      return c.json({ error: `GitHub API error: ${res.status}`, code: 'GH_API_ERROR' }, 502);
    }

    const data = await res.json() as any;
    // Normalize: search returns { items }, user/repos returns array
    const items = Array.isArray(data) ? data : (data.items ?? []);
    const total_count = Array.isArray(data) ? data.length : (data.total_count ?? items.length);

    return c.json({
      items: items.map((r: any) => ({
        id: r.id,
        name: r.name,
        full_name: r.full_name,
        description: r.description ?? null,
        url: r.html_url,
        owner: { login: r.owner?.login ?? '', avatar_url: r.owner?.avatar_url ?? '' },
        private: r.private ?? false,
        default_branch: r.default_branch ?? 'main',
      })),
      total_count,
    });
  });

  // POST /api/github/test
  // Validate PAT
  app.post('/test', async (c) => {
    const token = c.req.header('Authorization')?.replace('Bearer ', '') ?? '';
    if (!token) {
      return c.json({ ok: false, error: 'No token provided' }, 400);
    }

    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!res.ok) {
      return c.json({ ok: false, error: 'Invalid or expired token' });
    }

    const user = await res.json() as any;
    return c.json({ ok: true, user: { login: user.login, name: user.name ?? null } });
  });

  return app;
}
