const API_BASE = 'http://localhost:3131';

export type LinearStatus = {
  connected: boolean;
};

export type LinearIssue = {
  id: string; // Linear identifier, e.g. ENG-123
  title: string;
  summary?: string;
  url?: string;
  createdAt?: string;
};

async function expectOk(res: Response): Promise<void> {
  if (res.ok) return;
  let message = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (body?.error) message = String(body.error);
  } catch {
    // ignore
  }
  throw new Error(message);
}

export async function getStatus(): Promise<LinearStatus> {
  const res = await fetch(`${API_BASE}/api/linear/status`);
  await expectOk(res);
  return (await res.json()) as LinearStatus;
}

export async function getAuthorizeUrl(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/linear/oauth/authorize-url`);
  await expectOk(res);
  const body = (await res.json()) as { url: string };
  return body.url;
}

export async function disconnect(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/linear/disconnect`, { method: 'POST' });
  await expectOk(res);
}

export async function listIssues(query?: string): Promise<LinearIssue[]> {
  const params = new URLSearchParams();
  if (query && query.trim()) params.set('q', query.trim());
  const res = await fetch(`${API_BASE}/api/linear/issues?${params.toString()}`);
  await expectOk(res);
  const body = (await res.json()) as { issues: LinearIssue[] };
  return body.issues ?? [];
}

export async function getIssue(identifier: string): Promise<LinearIssue> {
  const res = await fetch(`${API_BASE}/api/linear/issues/${encodeURIComponent(identifier)}`);
  await expectOk(res);
  return (await res.json()) as LinearIssue;
}

