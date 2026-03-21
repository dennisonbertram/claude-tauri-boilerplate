import { describe, test, expect } from 'bun:test';
import { createGithubReposRouter } from './github-repos';
import { createProjectsGithubRouter } from './projects-github';
import { createDb } from '../db/index';

describe('GitHub repos router', () => {
  test('GET /repos without token returns 401', async () => {
    const router = createGithubReposRouter(createDb(':memory:'));
    const req = new Request('http://localhost/repos');
    const res = await router.fetch(req);
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.code).toBe('GH_AUTH_MISSING');
  });

  test('POST /test without token returns 400', async () => {
    const router = createGithubReposRouter(createDb(':memory:'));
    const req = new Request('http://localhost/test', { method: 'POST' });
    const res = await router.fetch(req);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.ok).toBe(false);
    expect(body.error).toBe('No token provided');
  });
});

describe('Projects GitHub router', () => {
  test('POST /from-github without owner returns 400', async () => {
    const db = createDb(':memory:');
    const router = createProjectsGithubRouter(db);
    const req = new Request('http://localhost/from-github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo: 'test' }), // missing owner
    });
    const res = await router.fetch(req);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('POST /from-github without repo returns 400', async () => {
    const db = createDb(':memory:');
    const router = createProjectsGithubRouter(db);
    const req = new Request('http://localhost/from-github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner: 'octocat' }), // missing repo
    });
    const res = await router.fetch(req);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('POST /from-github with empty body returns 400', async () => {
    const db = createDb(':memory:');
    const router = createProjectsGithubRouter(db);
    const req = new Request('http://localhost/from-github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await router.fetch(req);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.error).toBe('owner and repo are required');
  });

  test('POST /from-github with invalid JSON body returns 400', async () => {
    const db = createDb(':memory:');
    const router = createProjectsGithubRouter(db);
    const req = new Request('http://localhost/from-github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await router.fetch(req);
    expect(res.status).toBe(400);
  });
});
