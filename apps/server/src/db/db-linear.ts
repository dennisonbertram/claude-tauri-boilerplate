import { Database } from 'bun:sqlite';

export type LinearOAuthRecord = {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  scope?: string;
  expiresAt?: string;
  updatedAt?: string;
};

export function getLinearOAuth(db: Database): LinearOAuthRecord | null {
  const stmt = db.prepare(
    `SELECT access_token, refresh_token, token_type, scope, expires_at, updated_at FROM linear_oauth WHERE id = 1`
  );
  const row = stmt.get() as
    | {
        access_token: string;
        refresh_token: string | null;
        token_type: string | null;
        scope: string | null;
        expires_at: string | null;
        updated_at: string | null;
      }
    | undefined;
  if (!row?.access_token) return null;

  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token ?? undefined,
    tokenType: row.token_type ?? undefined,
    scope: row.scope ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

export function upsertLinearOAuth(
  db: Database,
  token: Omit<LinearOAuthRecord, 'updatedAt'>
): void {
  const stmt = db.prepare(
    `INSERT INTO linear_oauth (id, access_token, refresh_token, token_type, scope, expires_at, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       token_type = excluded.token_type,
       scope = excluded.scope,
       expires_at = excluded.expires_at,
       updated_at = datetime('now')`
  );

  stmt.run(
    token.accessToken,
    token.refreshToken ?? null,
    token.tokenType ?? null,
    token.scope ?? null,
    token.expiresAt ?? null
  );
}

export function clearLinearOAuth(db: Database): void {
  const stmt = db.prepare(`DELETE FROM linear_oauth WHERE id = 1`);
  stmt.run();
}
